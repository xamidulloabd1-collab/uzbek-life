import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GeoBuilder } from './builder';
import { TextureLib } from './textures';
import { CollisionWorld } from '@/game/physics/collision';
import { POIS, blockRect } from './cityLayout';
import { buildLot, buildSite, setSite, type BlockCtx, type BlockOptions, type LampInst, type ParkedInst, type SignInst, type Slot, type TreeInst, type TreeType } from './buildings';
import { VEHICLE_MAP, VEHICLES, TRAFFIC_COLORS } from '@/config/vehicles';
import { lowGeometry as lowGeo, lowMats, lowPaint } from '@/game/vehicles/vehicleModel';
import { buildFacadeMeshes, makeFacadeMaterials, newFacadeSet, type FacadeMaterials, type FacadeSet } from './facadeKit';
import { PROPERTIES } from '@/config/properties';
import { mulberry32, pick, rand } from '@/utils/math';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { frameToWorld } from './guzor/network';
import { NET, BOUNDS, CHUNK, RIVER, RAIL_Z, STATION, baseH, terrainH, riverDist, zoneAt, groundAt, type Edge, type Lot } from './guzor/network';

export interface PropInstance { meshes: THREE.InstancedMesh[]; index: number; x: number; z: number; rot: number; s: number; kind: TreeType | 'lamp' | 'bench' | 'bin'; key?: string; colId?: number }
interface Region { group: THREE.Group; x: number; z: number }
interface LotChunk { key: string; group: THREE.Group; detail: THREE.Group; colIds: number[]; props: PropInstance[]; x: number; z: number; slots: { houses: Slot[]; gates: Slot[] } }
interface Sink { groups: THREE.Group[]; colIds: number[]; props: PropInstance[] }

const tmpObj = new THREE.Object3D();

/** World Environment Editor: per-lot change, saved in the browser */
export interface LotEdit { hidden?: boolean; dx?: number; dz?: number; drot?: number; scale?: number; model?: string }
const EDIT_KEY = 'uzbek-life:world-edits';
/** edits are tied to this exact generated world (lot ids change when the world generator changes) */
const WORLD_SIG = () => `${NET.lots.length}:${NET.edges.length}`;
function loadEdits(): { lots: Record<number, LotEdit>; props: Record<string, LotEdit> } {
  try {
    const d = JSON.parse(localStorage.getItem(EDIT_KEY) ?? 'null') as { sig: string; edits: Record<number, LotEdit>; props?: Record<string, LotEdit> } | null;
    return d && d.sig === WORLD_SIG() ? { lots: d.edits, props: d.props ?? {} } : { lots: {}, props: {} };
  } catch {
    return { lots: {}, props: {} };
  }
}
/** fit a building GLB into a lot footprint: centred, standing on the ground */
function fitBuilding(g: GLTF, maxW: number, maxD: number, rotate: number) {
  const clone = g.scene.clone(true);
  clone.rotation.y = rotate;
  const holder = new THREE.Group();
  holder.add(clone);
  holder.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(holder);
  const size = b.getSize(new THREE.Vector3());
  const k = Math.min(maxW / Math.max(size.x, 0.01), maxD / Math.max(size.z, 0.01));
  holder.scale.setScalar(k);
  holder.position.set(-((b.min.x + b.max.x) / 2) * k, -b.min.y * k, -((b.min.z + b.max.z) / 2) * k);
  holder.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
  });
  const outer = new THREE.Group();
  outer.add(holder);
  outer.userData.size = [size.x * k, size.y * k, size.z * k];
  return outer;
}
const RECT0 = blockRect(0, 0);

/** branching trunk: tapered cylinder plus a few angled limbs */
function trunkWithBranches(rTop: number, rBot: number, h: number, branches: number, seed: number) {
  const rng = mulberry32(seed);
  const parts: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(rTop, rBot, h, 8).translate(0, h / 2, 0)];
  for (let n = 0; n < branches; n++) {
    const len = h * (0.35 + rng() * 0.2);
    const g = new THREE.CylinderGeometry(rTop * 0.35, rTop * 0.7, len, 6).translate(0, len / 2, 0);
    g.rotateZ(0.6 + rng() * 0.4);
    g.rotateY((n / Math.max(1, branches)) * Math.PI * 2 + rng());
    g.translate(0, h * (0.7 + rng() * 0.2), 0);
    parts.push(g);
  }
  const merged = mergeGeometries(parts.map((p) => p.toNonIndexed()), false)!;
  const uv = merged.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * h * 0.6);
  return merged;
}

/** three crossed alpha-tested blade cards with upward normals (soft, non-faceted grass) */
function grassClump() {
  const parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 3; k++) parts.push(new THREE.PlaneGeometry(0.9, 0.55).translate(0, 0.27, 0).rotateY((k / 3) * Math.PI).toNonIndexed());
  const g = mergeGeometries(parts)!;
  const n = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g;
}

/**
 * Crown made of alpha-tested leaf cards with normals bent away from the
 * crown centre, the usual technique for convincing real-time foliage.
 */
function leafCrown(r: number, sy: number, cards: number, size: number, seed: number, conical = false) {
  const rng = mulberry32(seed);
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), n = new THREE.Vector3(), c = new THREE.Vector3();
  for (let k = 0; k < cards; k++) {
    let x = 0, y = 0, z = 0;
    for (let t = 0; t < 20; t++) {
      x = rng() * 2 - 1; y = rng() * 2 - 1; z = rng() * 2 - 1;
      const inside = conical ? Math.hypot(x, z) < (1 - (y + 1) / 2) * 1.05 : x * x + y * y + z * z < 1;
      if (inside) break;
    }
    const shell = 0.55 + 0.45 * Math.sqrt(rng());
    c.set(x * r * shell, y * r * sy * shell, z * r * shell);
    e.set(rng() * Math.PI, rng() * Math.PI * 2, rng() * Math.PI);
    q.setFromEuler(e);
    const s = size * (0.75 + rng() * 0.5);
    const base = pos.length / 3;
    for (const [cx, cy, u, w] of [[-0.5, -0.5, 0, 0], [0.5, -0.5, 1, 0], [0.5, 0.5, 1, 1], [-0.5, 0.5, 0, 1]]) {
      v.set(cx * s, cy * s, 0).applyQuaternion(q).add(c);
      pos.push(v.x, v.y, v.z);
      n.set(v.x, (v.y / sy) * 0.8 + r * 0.25, v.z).normalize();
      nor.push(n.x, n.y, n.z);
      uv.push(u, w);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}



/**
 * The continuous G‘uzor world: terrain, the road network, the river and railway are global;
 * street lots are streamed in 160 m chunks around the camera (built on demand, disposed when far).
 */
export class World {
  readonly group = new THREE.Group();
  readonly col = new CollisionWorld();
  readonly tex: TextureLib;
  mats: Record<string, THREE.Material> = {};
  private props: PropInstance[] = [];
  readonly parked: (ParkedInst & { meshes: THREE.InstancedMesh[]; index: number; taken: boolean; locked: boolean })[] = [];
  private parkedSrc: ParkedInst[] = [];
  private regions: Region[] = [];
  private nightMats: { m: THREE.MeshStandardMaterial; k: number }[] = [];
  private wetMats: { m: THREE.MeshStandardMaterial; rough: number; color: THREE.Color }[] = [];
  private poolMat!: THREE.MeshBasicMaterial;
  private tlMesh!: THREE.InstancedMesh;
  private tlInfo: { axis: number; lamp: number }[] = [];
  private tlPhase = -1;
  private propBoards = new Map<string, THREE.Mesh>();
  private ringMat!: THREE.MeshBasicMaterial;
  private mountainMat!: THREE.MeshBasicMaterial;
  private terrain: { mesh: THREE.Mesh; x: number; z: number }[] = [];
  private chunks = new Map<string, LotChunk>();
  private lotsByChunk = new Map<string, Lot[]>();
  private chunkOpts = new Map<string, BlockOptions>();
  private kit: ReturnType<World['makeKit']> | null = null;
  private visTimer = 0;
  readonly homeChunk: string;
  lodDistance = 150;
  readonly facadeMats: FacadeMaterials = makeFacadeMaterials();
  renderDistance = 400;
  stats = { chunks: 0, built: 0, disposed: 0 };
  /** startup phases in ms (World constructor) */
  timings: Record<string, number> = {};

  constructor(textureSize: number, private shadows: boolean, private treeShadows: boolean, private treeDetail = 1) {
    const T0 = performance.now(), mark = (k: string) => (this.timings[k] = Math.round(performance.now() - T0));
    this.tex = new TextureLib(textureSize);
    this.makeMaterials();
    mark('materials');
    this.buildTerrain();
    this.buildRoads();
    mark('roads');
    this.buildRiver();
    for (const L of NET.lots) {
      if (L.kind === 'site') continue;
      let l = this.lotsByChunk.get(L.chunk);
      if (!l) this.lotsByChunk.set(L.chunk, (l = []));
      l.push(L);
    }
    this.homeChunk = NET.lots.find((l) => l.home)?.chunk ?? '0,0';
    // saved World Editor moves first, so ground height and lot chunks see the edited layout
    for (const id of Object.keys(this.edits).map(Number)) this.applyLotFrame(id);
    const trees: TreeInst[] = NET.trees.map((t, i) => ({ type: t.type, x: t.x, z: t.z, s: t.s, key: `t:${i}` }));
    const lamps: LampInst[] = [
      ...NET.lamps.map((l, i) => ({ ...l, key: `l:${i}`, kind: 'lamp' as const })),
      ...NET.furniture.map((f, i) => ({ x: f.x, z: f.z, rot: f.rot, key: `f:${i}`, kind: f.kind })),
    ];
    const signs: SignInst[] = [];
    this.buildSites(trees, lamps, signs);
    mark('sites');
    this.addStreetParking();
    this.buildParked();
    this.buildRailway(signs, trees);
    for (const t of trees) this.regionOf(t.x, t.z).trees.push(t);
    for (const l of lamps) this.regionOf(l.x, l.z).lamps.push(l);
    this.buildSigns(signs);
    this.buildTrafficLights();
    this.buildPOIRings();
    const before = this.group.children.length;
    this.buildMountains();
    for (const c of this.group.children.slice(before)) c.scale.set(1.9, 1.3, 1.9);
    mark('total');
    for (const [x0, z0, x1, z1] of [
      [BOUNDS.x0 - 2, BOUNDS.z0, BOUNDS.x0, BOUNDS.z1], [BOUNDS.x1, BOUNDS.z0, BOUNDS.x1 + 2, BOUNDS.z1],
      [BOUNDS.x0, BOUNDS.z0 - 2, BOUNDS.x1, BOUNDS.z0], [BOUNDS.x0, BOUNDS.z1, BOUNDS.x1, BOUNDS.z1 + 2],
    ]) this.col.add(x0, z0, x1, z1, 50);
  }

  // ------------------------------------------------------------ context for the builders
  private ctx(b: GeoBuilder, d: GeoBuilder, facade: FacadeSet, trees: TreeInst[], lamps: LampInst[], signs: SignInst[], L: Lot, opts: BlockOptions, slots: { houses: Slot[]; gates: Slot[] }, colIds?: number[]): BlockCtx {
    return {
      b, d, col: this.col, rng: mulberry32(L.seed), tex: this.tex, i: L.id % 3, j: 0, r: RECT0, gy: L.gy, trees, lamps, signs,
      frame: { ox: 0, oz: 0, rot: 0 }, facade, opts, slots, parked: this.parkedSrc, colIds,
    };
  }

  private buildSites(trees: TreeInst[], lamps: LampInst[], signs: SignInst[]) {
    const b = new GeoBuilder(), d = new GeoBuilder(), facade = newFacadeSet();
    const slots = { houses: [], gates: [] };
    for (const L of NET.lots) {
      if (L.kind !== 'site' || !L.site) continue;
      setSite(L.ox, L.oz, L.rot);
      buildSite(this.ctx(b, d, facade, trees, lamps, signs, L, {}, slots), L.site.kind, L.site.name, L.site.sub ?? '');
    }
    const base = b.build(this.mats, { cast: this.shadows, receive: true }, new Set(['pavers', 'water', 'curb']));
    const detail = d.build(this.mats, { cast: this.shadows, receive: true });
    detail.add(buildFacadeMeshes(facade, this.facadeMats, this.shadows));
    this.group.add(base, detail);
  }

  /** kerbside parked cars from the network (enterable, some locked) */
  private addStreetParking() {
    const rng = mulberry32(4242);
    for (const p of NET.parked) {
      const spec = pick(rng, VEHICLES);
      const colId = this.col.addOBB(p.x, p.z, spec.dims.width / 2, spec.dims.length / 2, p.rot, 1.4);
      this.parkedSrc.push({ x: p.x, z: p.z, rot: p.rot, specId: spec.id, color: pick(rng, TRAFFIC_COLORS), gy: groundAt(p.x, p.z), colId, display: false });
    }
  }

  // ------------------------------------------------------------ streamed lot chunks
  private buildChunk(key: string) {
    const lots = this.lotsByChunk.get(key) ?? [];
    const b = new GeoBuilder(), d = new GeoBuilder(), facade = newFacadeSet();
    const trees: TreeInst[] = [], lamps: LampInst[] = [], signs: SignInst[] = [];
    const colIds: number[] = [];
    const slots = { houses: [] as Slot[], gates: [] as Slot[] };
    const opts = this.chunkOpts.get(key) ?? {};
    const glbs: { L: Lot; ed: LotEdit }[] = [];
    for (const L of lots) {
      const ed = this.edits[L.id];
      if (ed?.hidden) continue;
      setSite(L.ox, L.oz, L.rot);
      const ctx = this.ctx(b, d, facade, trees, lamps, signs, L, opts, slots, colIds);
      const useModel = !!ed?.model && this.worldModels.has(ed.model);
      buildLot(ctx, useModel ? 'empty' : L.kind, L.w, L.d, !!L.home || ctx.rng() < 0.1, L.zone === 'center');
      if (useModel) glbs.push({ L, ed: ed! });
    }
    const group = new THREE.Group();
    const base = b.build(this.mats, { cast: this.shadows, receive: true }, new Set(['pavers', 'water', 'curb']));
    const detail = d.build(this.mats, { cast: this.shadows, receive: true });
    detail.add(buildFacadeMeshes(facade, this.facadeMats, this.shadows));
    group.add(base, detail);
    for (const { L, ed } of glbs) {
      const m = this.worldModels.get(ed.model!)!;
      const rot = L.rot;
      const obj = fitBuilding(m.g, L.w - 2, L.d - 6, m.rotate);
      const k = ed.scale ?? 1;
      obj.scale.setScalar(k);
      const p = frameToWorld(L.ox, L.oz, rot, L.w / 2, 3 + (L.d - 6) / 2);
      obj.position.set(p.x, L.gy, p.z);
      obj.rotation.y = rot + Math.PI;
      group.add(obj);
      const [sx, sy, sz] = obj.userData.size as number[];
      colIds.push(this.col.addOBB(p.x, p.z, (sx * k) / 2, (sz * k) / 2, rot, sy * k));
    }
    const sink: Sink = { groups: [], colIds, props: [] };
    this.buildProps(trees, lamps, sink);
    for (const g of sink.groups) detail.add(g);
    this.group.add(group);
    const [cx, cz] = key.split(',').map(Number);
    this.chunks.set(key, { key, group, detail, colIds, props: sink.props, x: (cx + 0.5) * CHUNK, z: (cz + 0.5) * CHUNK, slots });
    this.stats.built++;
  }

  private disposeChunk(c: LotChunk) {
    this.group.remove(c.group);
    c.group.traverse((o) => {
      const im = o as THREE.InstancedMesh;
      if (im.isInstancedMesh) im.dispose();
      else if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose();
    });
    for (const id of c.colIds) this.col.remove(id);
    this.chunks.delete(c.key);
    this.stats.disposed++;
  }

  /** build every chunk around a point immediately (spawn, load, teleport) */
  prime(x: number, z: number, r = 260) {
    for (const key of [...this.terrainTodo]) {
      const [cx, cz] = key.split(',').map(Number);
      if (Math.hypot((cx + 0.5) * CHUNK - x, (cz + 0.5) * CHUNK - z) - 120 < r + 300) this.buildTerrainChunk(key);
    }
    for (const [key, reg] of [...this.pendingRegions]) {
      const [rx, rz] = key.split(',').map(Number);
      if (Math.hypot((rx + 0.5) * 240 - x, (rz + 0.5) * 240 - z) - 170 < r) {
        this.pendingRegions.delete(key);
        this.buildProps(...this.editedProps(reg.trees, reg.lamps));
      }
    }
    for (const key of this.lotsByChunk.keys()) {
      if (this.chunks.has(key)) continue;
      const [cx, cz] = key.split(',').map(Number);
      if (Math.hypot((cx + 0.5) * CHUNK - x, (cz + 0.5) * CHUNK - z) - CHUNK * 0.71 < r) this.buildChunk(key);
    }
  }

  homeRect() {
    const L = NET.lots.find((l) => l.home)!;
    return { x0: L.cx - 60, z0: L.cz - 60, x1: L.cx + 60, z1: L.cz + 60 };
  }

  slotsOf(_i: number, _j: number) {
    if (!this.chunks.has(this.homeChunk)) this.buildChunk(this.homeChunk);
    return this.chunks.get(this.homeChunk)!.slots;
  }

  rebuildBlock(_i: number, _j: number, opts: BlockOptions) {
    this.chunkOpts.set(this.homeChunk, opts);
    const c = this.chunks.get(this.homeChunk);
    if (c) this.disposeChunk(c);
    this.buildChunk(this.homeChunk);
    return this.chunks.get(this.homeChunk)!.slots;
  }

  private buildParked() {
    const bySpec = new Map<string, ParkedInst[]>();
    for (const p of this.parkedSrc) {
      if (!bySpec.has(p.specId)) bySpec.set(p.specId, []);
      bySpec.get(p.specId)!.push(p);
    }
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.55, roughness: 0.3, envMapIntensity: 1.1 });
    const rng = mulberry32(5150);
    const col = new THREE.Color();
    for (const [specId, list] of bySpec) {
      const g = lowGeo(VEHICLE_MAP[specId]);
      const meshes = [
        new THREE.InstancedMesh(g.body, bodyMat, list.length),
        new THREE.InstancedMesh(g.glass, lowMats.glass, list.length),
        new THREE.InstancedMesh(g.dark, lowMats.dark, list.length),
        new THREE.InstancedMesh(g.lights, lowMats.lights, list.length),
      ];
      list.forEach((p, n) => {
        tmpObj.position.set(p.x, p.gy, p.z);
        tmpObj.rotation.set(0, p.rot, 0);
        tmpObj.scale.setScalar(1);
        tmpObj.updateMatrix();
        meshes.forEach((m) => m.setMatrixAt(n, tmpObj.matrix));
        meshes[0].setColorAt(n, col.set(p.color));
        this.parked.push({ ...p, meshes, index: n, taken: false, locked: !p.display && rng() < 0.55 });
      });
      meshes.forEach((m) => {
        m.castShadow = this.shadows;
        m.receiveShadow = true;
        m.computeBoundingSphere();
        this.group.add(m);
      });
    }
  }

  nearestParked(x: number, z: number, maxD: number) {
    let best: World['parked'][number] | null = null;
    let bd = maxD;
    for (const p of this.parked) {
      if (p.taken) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  takeParked(p: World['parked'][number]) {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    p.meshes.forEach((m) => {
      m.setMatrixAt(p.index, zero);
      m.instanceMatrix.needsUpdate = true;
    });
    this.col.disable(p.colId);
    p.taken = true;
  }

  setParkedVisible(p: World['parked'][number], visible: boolean) {
    if (p.taken) return;
    tmpObj.position.set(p.x, p.gy, p.z);
    tmpObj.rotation.set(0, p.rot, 0);
    tmpObj.scale.setScalar(visible ? 1 : 0);
    tmpObj.updateMatrix();
    p.meshes.forEach((m) => {
      m.setMatrixAt(p.index, tmpObj.matrix);
      m.instanceMatrix.needsUpdate = true;
    });
  }

  hideProps(x0: number, z0: number, x1: number, z1: number, kinds: (TreeType | 'lamp' | 'bench' | 'bin')[]) {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    const all = [...this.props, ...[...this.chunks.values()].flatMap((c) => c.props)];
    const hit = all.filter((p) => p.x >= x0 && p.x <= x1 && p.z >= z0 && p.z <= z1 && kinds.includes(p.kind));
    for (const p of hit) {
      for (const m of p.meshes) {
        m.setMatrixAt(p.index, zero);
        m.instanceMatrix.needsUpdate = true;
      }
    }
    return hit;
  }

  // ------------------------------------------------------------ materials
  private makeMaterials() {
    const T = this.tex;
    const std = (key: string, p: THREE.MeshStandardMaterialParameters) => (this.mats[key] = new THREE.MeshStandardMaterial({ roughness: 0.85, ...p }));
    const wet = (key: string) => {
      const m = this.mats[key] as THREE.MeshStandardMaterial;
      this.wetMats.push({ m, rough: m.roughness, color: m.color.clone() });
    };
    const nm = (t: THREE.Texture, k: number) => ({ map: t, normalMap: T.normalOf(t, k) });
    std('road', { ...nm(T.road(), 2.2), roughness: 0.92 });
    std('asphalt', { ...nm(T.asphalt(), 2.2), roughness: 0.92 });
    {
      // junction surface: the plain asphalt texture tinted to the road ribbon’s average colour
      const avg = (t: THREE.Texture) => {
        const img = t.image as HTMLCanvasElement;
        const c = document.createElement('canvas');
        c.width = c.height = 16;
        const g = c.getContext('2d')!;
        g.drawImage(img, 0, 0, 16, 16);
        const d = g.getImageData(0, 0, 16, 16).data;
        let r = 0, gg = 0, b = 0;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
        return [r, gg, b];
      };
      const road = avg(T.road()), asph = avg(T.asphalt());
      const m = (this.mats.asphalt as THREE.MeshStandardMaterial).clone();
      m.color.setRGB(Math.min(1.6, road[0] / asph[0]), Math.min(1.6, road[1] / asph[1]), Math.min(1.6, road[2] / asph[2]));
      m.roughness = (this.mats.road as THREE.MeshStandardMaterial).roughness;
      this.mats.junction = m;
    }
    std('rural', { ...nm(T.rural(), 2.5), roughness: 0.95 });
    std('pavers', { ...nm(T.pavers(), 4), roughness: 0.85 });
    std('plaza', { ...nm(T.plaza(), 3), roughness: 0.7 });
    ['road', 'asphalt', 'junction', 'rural', 'pavers', 'plaza'].forEach(wet);
    this.mats.zebra = new THREE.MeshStandardMaterial({ map: T.zebra(), transparent: true, alphaTest: 0.4, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    std('grass', { ...nm(T.grass(), 3) });
    std('sport', { color: '#3d7537' });
    std('steppe', { ...nm(T.steppe(), 3), roughness: 1 });
    std('field-cotton', { ...nm(T.field('cotton'), 3), roughness: 1 });
    std('field-wheat', { ...nm(T.field('wheat'), 3), roughness: 1 });
    std('curb', { color: '#b9b3a8' });
    std('roof', { ...nm(T.roof(), 2.5) });
    std('tin-green', { ...nm(T.tin('#4f7a5a'), 4), metalness: 0.5, roughness: 0.5 });
    std('tin-red', { ...nm(T.tin('#8c3b2e'), 4), metalness: 0.5, roughness: 0.5 });
    std('tin-grey', { ...nm(T.tin('#8a9196'), 4), metalness: 0.6, roughness: 0.45 });
    std('corr-blue', { ...nm(T.corrugated('#5d7f9c'), 5), metalness: 0.4, roughness: 0.55 });
    std('corr-beige', { ...nm(T.corrugated('#b8aa8c'), 5), metalness: 0.3, roughness: 0.6 });
    std('corr-grey', { ...nm(T.corrugated('#8d9397'), 5), metalness: 0.4, roughness: 0.55 });
    std('plaster', { ...nm(T.wallPlaster('#dccfb6'), 2.5) });
    std('plaster2', { ...nm(T.wallPlaster('#e8e0cf'), 2.5) });
    std('plaster3', { ...nm(T.wallPlaster('#e2c4a4'), 2.5) });
    std('plaster4', { ...nm(T.wallPlaster('#cfd4cf'), 2.5) });
    std('wall-earth', { ...nm(T.wallPlaster('#b89b74'), 3.5), roughness: 0.95 });
    std('bronze', { color: '#5a4a35', metalness: 0.85, roughness: 0.42 });
    const flame = std('flame', { color: '#ff9a2e', emissive: '#ff7a1a', emissiveIntensity: 2.2 });
    void flame;
    std('road-mahalla', { ...nm(T.roadMahalla(), 2.6), roughness: 0.94 });
    std('road-concrete', { ...nm(T.concreteRoad(), 2.2), roughness: 0.9 });
    ['road-mahalla', 'road-concrete'].forEach(wet);
    std('fence', { ...nm(T.wallPlaster('#a8a49b'), 2.5) });
    std('gate-blue', { map: T.gate('#2d6aa0'), metalness: 0.5, roughness: 0.4 });
    std('gate-green', { map: T.gate('#2f6b4f'), metalness: 0.5, roughness: 0.4 });
    std('gate-brown', { map: T.gate('#6b4a2f'), metalness: 0.4, roughness: 0.45 });
    std('majolica', { ...nm(T.majolica(), 1.5), roughness: 0.3 });
    std('dome', { ...nm(T.domeTiles(), 2), roughness: 0.25, metalness: 0.1 });
    std('brick', { color: '#b98c58' });
    std('chalk', { color: '#e9e4d8' });
    std('white', { color: '#f1f1ee', roughness: 0.5 });
    std('concrete', { color: '#a19c92' });
    std('metal', { color: '#8b9196', metalness: 0.6, roughness: 0.45 });
    std('darkmetal', { color: '#2e3236', metalness: 0.5, roughness: 0.5 });
    std('wood', { color: '#6e4b30' });
    std('red', { color: '#a8352a' });
    std('yellow', { color: '#d9a92b' });
    std('green-paint', { color: '#3b7a46' });
    std('awning-blue', { color: '#1f5f99' });
    std('foliage', { color: '#4c6e2d', roughness: 1 });
    std('hay', { color: '#c9a453', roughness: 1 });
    std('gold', { color: '#c9a54a', metalness: 0.9, roughness: 0.3 });
    std('lapis', { color: '#13315e', roughness: 0.4 });
    std('tire', { color: '#151515', roughness: 0.95 });
    std('water', { color: '#2d5560', roughness: 0.08, metalness: 0.4 });
    std('pool', { color: '#2aa7c0', roughness: 0.05, metalness: 0.2 });
    std('river', { color: '#3c5a52', roughness: 0.05, metalness: 0.35, normalMap: T.normalOf(T.clouds(), 0.6) });
    std('riverbed', { color: '#4a4334', roughness: 1 });
    std('train', { color: '#2f6b55', roughness: 0.35, metalness: 0.4 });
    std('window-band', { color: '#162027', roughness: 0.05, metalness: 0.7 });
    std('ballast', { ...nm(T.roof(), 4), color: '#9a948a', roughness: 1 });
    this.mats.showglass = new THREE.MeshStandardMaterial({ color: '#9fc4d6', roughness: 0.05, metalness: 0.8, transparent: true, opacity: 0.35, depthWrite: false });
    const canopy = std('canopy', { color: '#f4f2ea', emissive: '#fff4dc', emissiveIntensity: 0 });
    this.nightMats.push({ m: canopy, k: 1.4 });
    for (const kind of ['glass', 'office', 'panel', 'modern', 'brick', 'house', 'shop'] as const) {
      const f = T.facade(kind);
      const m = new THREE.MeshStandardMaterial({
        map: f.map, emissiveMap: f.emissive, emissive: '#ffffff', emissiveIntensity: 0,
        normalMap: kind === 'glass' ? null : T.normalOf(f.map, kind === 'brick' ? 3 : 1.8),
        roughness: kind === 'glass' ? 0.12 : 0.82, metalness: kind === 'glass' ? 0.75 : 0.04,
      });
      this.mats[`fac-${kind}`] = m;
      this.nightMats.push({ m, k: kind === 'shop' ? 1.5 : kind === 'glass' ? 1.1 : 1.0 });
    }
    for (const k of ['house', 'brick'] as const) {
      const f = T.plainWall(k);
      std(`fac-${k}plain`, { map: f.map, normalMap: T.normalOf(f.map, k === 'brick' ? 4 : 2), roughness: 0.88 });
    }
    this.nightMats.push({ m: this.facadeMats.glassLit, k: 1.6 });
    // colour variants so neighbouring buildings never look identical
    const tint = (src: string, key: string, color: string, night = true) => {
      const m = (this.mats[src] as THREE.MeshStandardMaterial).clone();
      m.color.set(color);
      this.mats[key] = m;
      if (night) this.nightMats.push({ m, k: 1.0 });
    };
    tint('fac-panel', 'fac-panel-b', '#f0d9c4');
    tint('fac-panel', 'fac-panel-c', '#d3dde2');
    tint('fac-modern', 'fac-modern-b', '#d9c9b2');
    tint('fac-modern', 'fac-modern-c', '#e9e2d6');
    tint('fac-houseplain', 'fac-houseplain-b', '#f3d6bd', false);
    tint('fac-houseplain', 'fac-houseplain-c', '#dfe3d4', false);
    for (let s = 0; s < 3; s++) std(`mosaic-${s}`, { map: T.mosaic(101 + s * 7), roughness: 0.6 });
    for (const c of new Set(TRAFFIC_COLORS)) this.mats[`car-${c}`] = lowPaint(c);
    this.mats['car-glass'] = lowMats.glass;
    this.mats['car-dark'] = lowMats.dark;
    this.mats['car-lights'] = lowMats.lights;
  }

  // ------------------------------------------------------------ ground & roads

  // ------------------------------------------------------------ terrain
  private groundColor(x: number, z: number, y: number, c: THREE.Color) {
    const zone = x < BOUNDS.x0 || x > BOUNDS.x1 || z < BOUNDS.z0 || z > BOUNDS.z1 ? 'fields' : zoneAt(x, z);
    const rd = riverDist(x, z);
    if (zone === 'fields' || zone === 'village') {
      const a = -0.61, u = x * Math.cos(a) + z * Math.sin(a), v = -x * Math.sin(a) + z * Math.cos(a);
      const id = Math.floor(u / 66) * 7919 + Math.floor(v / 118) * 104729;
      const h = Math.abs(Math.sin(id * 12.9898) * 43758.5453) % 1;
      const pal = zone === 'village' ? ['#d9e4c4', '#a9cf8f', '#e6dccb', '#93c477'] : ['#7fc27a', '#fff0a8', '#8a6d5a', '#d8cdb8', '#5f9a5a', '#93c96f', '#fff0a8'];
      c.set(pal[Math.floor(h * pal.length)]);
    } else {
      // town ground: dusty yards mixed with garden plots, lawns and darker soil, never one flat colour
      c.set(zone === 'center' ? '#e2ddd4' : '#ece4d4');
      const cell = Math.floor(x / 13) * 92821 + Math.floor(z / 13) * 68917;
      const h = Math.abs(Math.sin(cell * 7.13) * 15731.743) % 1;
      if (h < 0.34) c.lerp(new THREE.Color(zone === 'center' ? '#b9d39c' : '#c6d9a6'), 0.75);
      else if (h < 0.48) c.lerp(new THREE.Color('#bda88c'), 0.6);
    }
    if (y > 7) c.lerp(new THREE.Color('#f4e2c4'), Math.min(1, (y - 7) / 8));
    if (rd < 34) c.lerp(new THREE.Color('#a9c88e'), (1 - rd / 34) * 0.8);
  }

  private pendingRegions = new Map<string, { trees: TreeInst[]; lamps: LampInst[] }>();
  private regionOf(x: number, z: number) {
    const k = `${Math.floor(x / 240)},${Math.floor(z / 240)}`;
    let r = this.pendingRegions.get(k);
    if (!r) this.pendingRegions.set(k, (r = { trees: [], lamps: [] }));
    return r;
  }

  private terrainMat!: THREE.MeshStandardMaterial;
  private terrainIdx: number[] = [];
  private terrainTodo = new Set<string>();

  /** terrain chunks are listed now and built when the camera comes near (see update) */
  private buildTerrain() {
    this.terrainMat = (this.mats.steppe as THREE.MeshStandardMaterial).clone();
    this.terrainMat.vertexColors = true;
    this.terrainMat.color.set('#ffffff');
    const RES = 20, n = RES + 1;
    for (let j = 0; j < RES; j++)
      for (let i = 0; i < RES; i++) {
        const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
        this.terrainIdx.push(a, c, b, b, c, d);
      }
    const cx0 = Math.floor((BOUNDS.x0 - 520) / CHUNK), cx1 = Math.floor((BOUNDS.x1 + 520) / CHUNK);
    const cz0 = Math.floor((BOUNDS.z0 - 520) / CHUNK), cz1 = Math.floor((BOUNDS.z1 + 520) / CHUNK);
    for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) this.terrainTodo.add(`${cx},${cz}`);
  }

  /** photographic ground (ambientCG) under the existing field / zone vertex colours */
  applyTerrainPhoto(color: THREE.Texture, normal: THREE.Texture | null, rough: THREE.Texture | null) {
    const m = this.terrainMat;
    m.map = color;
    m.normalMap = normal;
    if (rough) {
      m.roughnessMap = rough;
      m.roughness = 1;
    }
    m.needsUpdate = true;
  }

  private buildTerrainChunk(key: string) {
    this.terrainTodo.delete(key);
    const [cx, cz] = key.split(',').map(Number);
    const RES = 20, STEP = CHUNK / RES, n = RES + 1, m = n + 2;
    const H = new Float32Array(m * m);
    for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) H[j * m + i] = terrainH(cx * CHUNK + (i - 1) * STEP, cz * CHUNK + (j - 1) * STEP);
    const pos = new Float32Array(n * n * 3), nor = new Float32Array(n * n * 3), clr = new Float32Array(n * n * 3), uv = new Float32Array(n * n * 2);
    const col = new THREE.Color();
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const k = j * n + i, h = (jj: number, ii: number) => H[(jj + 1) * m + ii + 1];
        const x = cx * CHUNK + i * STEP, z = cz * CHUNK + j * STEP, y = h(j, i);
        const hx = (h(j, i + 1) - h(j, i - 1)) / (2 * STEP), hz = (h(j + 1, i) - h(j - 1, i)) / (2 * STEP);
        const l = Math.hypot(hx, 1, hz);
        pos.set([x, y, z], k * 3);
        nor.set([-hx / l, 1 / l, -hz / l], k * 3);
        this.groundColor(x, z, y, col);
        clr.set([col.r, col.g, col.b], k * 3);
        uv.set([x / 18, z / 18], k * 2);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(clr, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(this.terrainIdx);
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, this.terrainMat);
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.terrain.push({ mesh, x: (cx + 0.5) * CHUNK, z: (cz + 0.5) * CHUNK });
  }

  // ------------------------------------------------------------ roads
  private roadKey(e: Edge) {
    if (e.cls === 'highway') return 'road';
    if (e.cls === 'rural') return 'rural';
    if (e.cls === 'lane') return 'road-mahalla';
    if (e.zone === 'industrial') return 'road-concrete';
    if (e.zone === 'mahalla' && e.cls === 'street') return 'road-mahalla';
    return 'road';
  }

  private buildRoads() {
    const b = new GeoBuilder();
    const LIFT: Record<string, number> = { highway: 0.075, main: 0.07, street: 0.06, rural: 0.055, lane: 0.05 };
    const strip = (key: string, L: THREE.Vector3[], R: THREE.Vector3[], vs: number[], uL: number, uR: number) => {
      const pos: number[] = [], uv: number[] = [];
      for (let k = 0; k < L.length - 1; k++) {
        const a = L[k], bb = R[k], c = L[k + 1], d = R[k + 1];
        pos.push(a.x, a.y, a.z, c.x, c.y, c.z, bb.x, bb.y, bb.z, bb.x, bb.y, bb.z, c.x, c.y, c.z, d.x, d.y, d.z);
        uv.push(uL, vs[k], uL, vs[k + 1], uR, vs[k], uR, vs[k], uL, vs[k + 1], uR, vs[k + 1]);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.computeVertexNormals();
      b.add(key, g);
    };
    // junctions: ribbons stop at the junction box; a polygon fitted to the road ends fills it
    const trim = (id: number) => {
      const n = NET.nodes[id];
      if (n.roundabout) return 21;
      if (n.edges.length < 3) return 0;
      return Math.max(...n.edges.map((x) => NET.edges[x].width)) / 2 + 0.6;
    };
    for (const e of NET.edges) {
      const ss: number[] = [];
      for (let s = 0; s < e.len; s += 3) ss.push(s);
      for (const c of e.cum) ss.push(c);
      ss.sort((a, bb) => a - bb);
      const uniq = ss.filter((s, i) => i === 0 || s - ss[i - 1] > 0.3);
      if (uniq[uniq.length - 1] < e.len - 0.3) uniq.push(e.len);
      const lift = LIFT[e.cls];
      const half = e.width / 2;
      const tA = Math.min(trim(e.a), e.len * 0.45), tB = Math.min(trim(e.b), e.len * 0.45);
      const span0 = uniq.filter((s) => s > tA && s < e.len - tB);
      uniq.length = 0;
      uniq.push(tA, ...span0, e.len - tB);
      const Lr: THREE.Vector3[] = [], Rr: THREE.Vector3[] = [], vs: number[] = [];
      const SL: THREE.Vector3[] = [], SLo: THREE.Vector3[] = [], SR: THREE.Vector3[] = [], SRo: THREE.Vector3[] = [];
      const CLt: THREE.Vector3[] = [], CRt: THREE.Vector3[] = [];
      for (const s of uniq) {
        const p0 = NET.pointAt(e, Math.max(0, s - 1.5)), p1 = NET.pointAt(e, Math.min(e.len, s + 1.5)), p = NET.pointAt(e, s);
        let tx = p1.x - p0.x, tz = p1.z - p0.z;
        const tl = Math.hypot(tx, tz) || 1;
        tx /= tl; tz /= tl;
        const nx = -tz, nz = tx;
        const y = baseH(p.x, p.z) + lift;
        Lr.push(new THREE.Vector3(p.x + nx * half, y, p.z + nz * half));
        Rr.push(new THREE.Vector3(p.x - nx * half, y, p.z - nz * half));
        vs.push(s / 12);
        if (e.sidewalk) {
          const ys = baseH(p.x, p.z) + 0.2;
          SL.push(new THREE.Vector3(p.x + nx * half, ys, p.z + nz * half));
          SLo.push(new THREE.Vector3(p.x + nx * (half + 3.2), ys, p.z + nz * (half + 3.2)));
          SR.push(new THREE.Vector3(p.x - nx * (half + 3.2), ys, p.z - nz * (half + 3.2)));
          SRo.push(new THREE.Vector3(p.x - nx * half, ys, p.z - nz * half));
          CLt.push(new THREE.Vector3(p.x + nx * half, y - 0.02, p.z + nz * half));
          CRt.push(new THREE.Vector3(p.x - nx * half, y - 0.02, p.z - nz * half));
        }
        if (e.bridge && riverDist(p.x, p.z) < 15 && Math.round(s / 3) % 1 === 0) {
          const off = half + (e.sidewalk ? 3.0 : 0.3);
          for (const sd of [1, -1]) {
            b.box('metal', p.x + nx * off * sd, y + (e.sidewalk ? 0.15 : 0), p.z + nz * off * sd, 0.08, 1.05, 0.08);
          }
          b.box('concrete', p.x, y - 1.25, p.z, 0.6, 1.2, 0.6);
        }
      }
      strip(this.roadKey(e), Lr, Rr, vs, 0, 1);
      if (e.sidewalk) {
        const sv = vs.map((v) => v * 5);
        strip('pavers', SL, SLo, sv, 0, 1.3);
        strip('pavers', SR, SRo, sv, 0, 1.3);
        strip('curb', SL, CLt, sv, 0, 0.1);
        strip('curb', CRt, SRo, sv, 0, 0.1);
      }
      if (e.bridge) {
        // railings along the bridge span
        const span = uniq.filter((s) => { const p = NET.pointAt(e, s); return riverDist(p.x, p.z) < 15; });
        if (span.length > 1) {
          for (const sd of [1, -1]) {
            const top: THREE.Vector3[] = [], bot: THREE.Vector3[] = [];
            for (const s of span) {
              const p = NET.pointAt(e, s);
              const off = (half + (e.sidewalk ? 3.0 : 0.3)) * sd;
              const y = baseH(p.x, p.z) + lift + (e.sidewalk ? 0.15 : 0);
              top.push(new THREE.Vector3(p.x - p.tz * off, y + 1.05, p.z + p.tx * off));
              bot.push(new THREE.Vector3(p.x - p.tz * off, y + 0.95, p.z + p.tx * off));
            }
            strip('metal', top, bot, span.map((s) => s / 4), 0, 1);
            strip('metal', bot, top, span.map((s) => s / 4), 0, 1);
          }
        }
      }
    }
    // junction pads cover the overlap of the ribbons
    for (const n of NET.nodes) {
      const r0 = trim(n.id);
      if (r0 <= 0) continue;
      const y = baseH(n.x, n.z) + 0.085;
      if (n.roundabout) {
        const g = new THREE.CircleGeometry(22, 40).rotateX(-Math.PI / 2);
        g.translate(n.x, y, n.z);
        b.add('junction', g);
      } else {
        const pts: { a: number; x: number; z: number }[] = [];
        for (const id of n.edges) {
          const e = NET.edges[id];
          const s0 = n.id === e.a ? Math.min(r0, e.len * 0.45) : e.len - Math.min(r0, e.len * 0.45);
          const p = NET.pointAt(e, s0);
          for (const sd of [1, -1]) {
            const x = p.x - p.tz * (e.width / 2) * sd, z = p.z + p.tx * (e.width / 2) * sd;
            pts.push({ a: Math.atan2(z - n.z, x - n.x), x, z });
          }
        }
        pts.sort((a, c) => a.a - c.a);
        const pos: number[] = [], uv: number[] = [];
        for (let k = 0; k < pts.length; k++) {
          const p = pts[k], q = pts[(k + 1) % pts.length];
          pos.push(n.x, y, n.z, q.x, y, q.z, p.x, y, p.z);
          uv.push(n.x / 4, n.z / 4, q.x / 4, q.z / 4, p.x / 4, p.z / 4);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.computeVertexNormals();
        b.add('junction', g);
      }
      if (n.roundabout) {
        b.cyl('curb', n.x, y - 0.3, n.z, 9.3, 9.3, 0.62, 32);
        b.cyl('grass', n.x, y + 0.31, n.z, 9, 9, 0.02, 32);
        this.col.addCentered(n.x, n.z, 12, 12, 0.6);
      }
    }
    const g = b.build(this.mats, { cast: false, receive: true });
    g.name = 'roads';
    this.group.add(g);
    for (const n of NET.nodes) if (n.roundabout) for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      NET.trees.push({ x: n.x + Math.cos(a) * 5.5, z: n.z + Math.sin(a) * 5.5, type: 'pine', s: 1 });
    }
  }

  private buildRiver() {
    const b = new GeoBuilder();
    const L: THREE.Vector3[] = [], R: THREE.Vector3[] = [];
    let len = 0;
    const vs: number[] = [];
    for (let k = 0; k < RIVER.length - 1; k++) {
      const a = RIVER[k], c = RIVER[k + 1];
      const segL = Math.hypot(c.x - a.x, c.z - a.z);
      for (let s = 0; s < segL; s += 4) {
        const t = s / segL, x = a.x + (c.x - a.x) * t, z = a.z + (c.z - a.z) * t;
        const nx = -(c.z - a.z) / segL, nz = (c.x - a.x) / segL;
        const y = baseH(x, z) - 2.35;
        L.push(new THREE.Vector3(x + nx * 9.5, y, z + nz * 9.5));
        R.push(new THREE.Vector3(x - nx * 9.5, y, z - nz * 9.5));
        vs.push((len + s) / 12);
      }
      len += segL;
    }
    const pos: number[] = [], uv: number[] = [];
    for (let k = 0; k < L.length - 1; k++) {
      const a = L[k], bb = R[k], c = L[k + 1], d = R[k + 1];
      pos.push(a.x, a.y, a.z, c.x, c.y, c.z, bb.x, bb.y, bb.z, bb.x, bb.y, bb.z, c.x, c.y, c.z, d.x, d.y, d.z);
      uv.push(0, vs[k], 0, vs[k + 1], 1.6, vs[k], 1.6, vs[k], 0, vs[k + 1], 1.6, vs[k + 1]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    b.add('river', g);
    this.group.add(b.build(this.mats, { cast: false, receive: true }));
    // keep walkers and cars out of the water except on bridges
    for (let k = 0; k < RIVER.length - 1; k++) {
      const a = RIVER[k], c = RIVER[k + 1];
      const segL = Math.hypot(c.x - a.x, c.z - a.z);
      for (let s = 0; s < segL; s += 8) {
        const t = (s + 4) / segL, x = a.x + (c.x - a.x) * t, z = a.z + (c.z - a.z) * t;
        if (NET.nearestRoad(x, z, 26)) continue;
        this.col.addOBB(x, z, 4.5, 7, Math.atan2(-(c.z - a.z), c.x - a.x) + Math.PI / 2, 0.8);
      }
    }
  }

  // ------------------------------------------------------------ trees and lamps (instanced)
  private makeKit() {
    const T = this.tex;
    const bark = T.bark();
    const trunkMat = new THREE.MeshStandardMaterial({ map: bark, normalMap: T.normalOf(bark, 3), roughness: 0.95 });
    const leafMat = (kind: 'broad' | 'fruit' | 'poplar' | 'pine') =>
      new THREE.MeshStandardMaterial({ map: T.leaves(kind), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, color: '#ffffff' });
    const grassMat = new THREE.MeshStandardMaterial({ map: T.grassBlades(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.95 });
    const crownMats: Record<TreeType, THREE.MeshStandardMaterial> = { chinor: leafMat('broad'), terak: leafMat('poplar'), fruit: leafMat('fruit'), pine: leafMat('pine'), bush: leafMat('broad'), grass: grassMat };
    const D = this.treeDetail;
    const geos: Record<TreeType, { trunk?: THREE.BufferGeometry; crown: THREE.BufferGeometry }> = {
      chinor: { trunk: trunkWithBranches(0.24, 0.4, 4.6, 3, 11), crown: leafCrown(3.3, 0.85, Math.round(95 * D), 2.3, 21).translate(0, 6.6, 0) },
      terak: { trunk: trunkWithBranches(0.12, 0.2, 3, 0, 12), crown: leafCrown(1.25, 4.4, Math.round(70 * D), 1.5, 22).translate(0, 6.8, 0) },
      fruit: { trunk: trunkWithBranches(0.1, 0.16, 1.8, 2, 13), crown: leafCrown(1.8, 0.8, Math.round(55 * D), 1.4, 23).translate(0, 3.1, 0) },
      pine: { trunk: trunkWithBranches(0.13, 0.22, 2.4, 0, 14), crown: leafCrown(1.9, 2, Math.round(70 * D), 1.4, 24, true).translate(0, 5.4, 0) },
      bush: { crown: leafCrown(0.95, 0.7, Math.round(30 * D), 0.9, 25).translate(0, 0.75, 0) },
      grass: { crown: grassClump() },
    };
    const greens: Record<TreeType, string[]> = {
      chinor: ['#ffffff', '#e6efd8', '#f4f0d8', '#dfe8cf'],
      terak: ['#ffffff', '#eef3dc', '#e2ead0'],
      fruit: ['#ffffff', '#f0f4e0', '#e6eed6'],
      pine: ['#ffffff', '#e8eee6'],
      bush: ['#ffffff', '#e4edd2', '#f2f0d6'],
      grass: ['#ffffff', '#eef2dc', '#f4eccf'],
    };
    // lamp geometry
    const pole = new THREE.CylinderGeometry(0.07, 0.11, 7.2, 6).translate(0, 3.6, 0);
    const arm = new THREE.BoxGeometry(0.08, 0.08, 1.9).translate(0, 7.1, 0.95);
    const head = new THREE.BoxGeometry(0.34, 0.14, 0.7).translate(0, 7.0, 1.8);
    const lampMat = this.mats.darkmetal;
    const headMat = new THREE.MeshStandardMaterial({ color: '#fff7e6', emissive: '#ffd9a0', emissiveIntensity: 0 });
    this.nightMats.push({ m: headMat, k: 3 });
    this.poolMat = new THREE.MeshBasicMaterial({ map: this.tex.lightPool(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    const pool = new THREE.PlaneGeometry(11, 11).rotateX(-Math.PI / 2);

    const bench = mergeGeometries([
      new THREE.BoxGeometry(1.8, 0.07, 0.45).translate(0, 0.45, 0),
      new THREE.BoxGeometry(1.8, 0.4, 0.06).translate(0, 0.72, -0.2),
      new THREE.BoxGeometry(0.08, 0.45, 0.4).translate(-0.8, 0.22, 0),
      new THREE.BoxGeometry(0.08, 0.45, 0.4).translate(0.8, 0.22, 0),
    ])!;
    const bin = new THREE.CylinderGeometry(0.26, 0.22, 0.85, 12).translate(0, 0.425, 0);
    return { trunkMat, crownMats, geos, greens, pole, arm, head, lampMat, headMat, pool, bench, bin };
  }

  /** instanced trees and lamps; global ones go to culling regions, streamed ones into a chunk sink */
  private buildProps(trees: TreeInst[], lamps: LampInst[], sink?: Sink) {
    const kit = (this.kit ??= this.makeKit());
    const { trunkMat, crownMats, geos, greens, pole, arm, head, lampMat, headMat, pool } = kit;
    const colOf = new Map<object, number>();
    const buckets = new Map<string, { trees: TreeInst[]; lamps: LampInst[] }>();
    const bucket = (x: number, z: number) => {
      const k = sink ? 'chunk' : `${Math.floor(x / 240)},${Math.floor(z / 240)}`;
      let b = buckets.get(k);
      if (!b) buckets.set(k, (b = { trees: [], lamps: [] }));
      return b;
    };
    for (const t of trees) {
      bucket(t.x, t.z).trees.push(t);
      if (t.type === 'bush' || t.type === 'grass') continue;
      const w = t.type === 'fruit' ? 0.35 : t.type === 'terak' ? 0.4 : 0.6;
      const id = this.col.addCentered(t.x, t.z, w * t.s, w * t.s, 3);
      sink?.colIds.push(id);
      colOf.set(t, id);
    }
    for (const l of lamps) {
      bucket(l.x, l.z).lamps.push(l);
      const k = l.kind ?? 'lamp';
      const id = k === 'lamp' ? this.col.addCentered(l.x, l.z, 0.3, 0.3, 7) : this.col.addOBB(l.x, l.z, k === 'bench' ? 0.9 : 0.3, k === 'bench' ? 0.35 : 0.3, l.rot, 1);
      sink?.colIds.push(id);
      colOf.set(l, id);
    }
    const color = new THREE.Color();
    const rng = mulberry32(99 + trees.length);
    const out = sink ? sink.props : this.props;
    for (const [key, b] of buckets) {
      const group = new THREE.Group();
      for (const type of Object.keys(geos) as TreeType[]) {
        const list = b.trees.filter((t) => t.type === type);
        if (!list.length) continue;
        const tg = geos[type].trunk;
        const trunk = tg ? new THREE.InstancedMesh(tg, trunkMat, list.length) : null;
        const crown = new THREE.InstancedMesh(geos[type].crown, crownMats[type], list.length);
        list.forEach((t, n) => {
          tmpObj.position.set(t.x, groundAt(t.x, t.z), t.z);
          const r0 = rng() * Math.PI * 2;
          tmpObj.rotation.set(0, t.rot ?? r0, 0);
          tmpObj.scale.setScalar(t.s);
          tmpObj.updateMatrix();
          trunk?.setMatrixAt(n, tmpObj.matrix);
          crown.setMatrixAt(n, tmpObj.matrix);
          const pi: PropInstance = { meshes: trunk ? [trunk, crown] : [crown], index: n, x: t.x, z: t.z, rot: tmpObj.rotation.y, s: t.s, kind: type, key: t.key, colId: colOf.get(t) };
          out.push(pi);
          if (t.key) this.propByKey.set(t.key, pi);
          color.set(greens[type][n % greens[type].length]);
          color.offsetHSL(0, 0, (rng() - 0.5) * 0.06);
          crown.setColorAt(n, color);
        });
        for (const m of trunk ? [trunk, crown] : [crown]) {
          m.castShadow = this.shadows && this.treeShadows && type !== 'grass';
          m.receiveShadow = true;
          m.computeBoundingSphere();
          group.add(m);
        }
      }
      const lampList = b.lamps.filter((l) => (l.kind ?? 'lamp') === 'lamp');
      for (const fk of ['bench', 'bin'] as const) {
        const list = b.lamps.filter((l) => l.kind === fk);
        if (!list.length) continue;
        const im = new THREE.InstancedMesh(fk === 'bench' ? kit.bench : kit.bin, fk === 'bench' ? (this.mats.wood as THREE.Material) : (this.mats.darkmetal as THREE.Material), list.length);
        list.forEach((l, n) => {
          tmpObj.position.set(l.x, groundAt(l.x, l.z), l.z);
          tmpObj.rotation.set(0, l.rot, 0);
          tmpObj.scale.setScalar(l.s ?? 1);
          tmpObj.updateMatrix();
          im.setMatrixAt(n, tmpObj.matrix);
          const pi: PropInstance = { meshes: [im], index: n, x: l.x, z: l.z, rot: l.rot, s: l.s ?? 1, kind: fk, key: l.key, colId: colOf.get(l) };
          out.push(pi);
          if (l.key) this.propByKey.set(l.key, pi);
        });
        im.castShadow = this.shadows;
        im.receiveShadow = true;
        im.computeBoundingSphere();
        group.add(im);
      }
      if (lampList.length) {
        const meshes = [new THREE.InstancedMesh(pole, lampMat, lampList.length), new THREE.InstancedMesh(arm, lampMat, lampList.length), new THREE.InstancedMesh(head, headMat, lampList.length)];
        const pools = new THREE.InstancedMesh(pool, this.poolMat, lampList.length);
        lampList.forEach((l, n) => {
          const gy = groundAt(l.x, l.z);
          const s = l.tall ? 1.4 : 1;
          tmpObj.position.set(l.x, gy, l.z);
          tmpObj.rotation.set(0, l.rot, 0);
          tmpObj.scale.setScalar(s);
          tmpObj.updateMatrix();
          meshes.forEach((m) => m.setMatrixAt(n, tmpObj.matrix));
          const pi: PropInstance = { meshes: [...meshes, pools], index: n, x: l.x, z: l.z, rot: l.rot, s, kind: 'lamp', key: l.key, colId: colOf.get(l) };
          out.push(pi);
          if (l.key) this.propByKey.set(l.key, pi);
          const px = l.x + Math.sin(l.rot) * 1.8 * s, pz = l.z + Math.cos(l.rot) * 1.8 * s;
          tmpObj.position.set(px, groundAt(px, pz) + 0.03, pz);
          tmpObj.scale.setScalar(s);
          tmpObj.updateMatrix();
          pools.setMatrixAt(n, tmpObj.matrix);
        });
        meshes.forEach((m) => {
          m.computeBoundingSphere();
          group.add(m);
        });
        pools.computeBoundingSphere();
        pools.renderOrder = 1;
        group.add(pools);
      }
      if (sink) sink.groups.push(group);
      else {
        const [rx, rz] = key.split(',').map(Number);
        this.group.add(group);
        this.regions.push({ group, x: (rx + 0.5) * 240, z: (rz + 0.5) * 240 });
      }
    }
  }

  private buildSigns(signs: SignInst[]) {
    for (const s of signs) {
      const m = new THREE.MeshStandardMaterial({ map: s.tex, emissiveMap: s.tex, emissive: '#ffffff', emissiveIntensity: 0, roughness: 0.5 });
      this.nightMats.push({ m, k: 0.9 });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), m);
      mesh.position.set(s.x, s.y, s.z);
      mesh.rotation.y = s.rot;
      const back = new THREE.Mesh(new THREE.BoxGeometry(s.w + 0.2, s.h + 0.2, 0.15), this.mats.darkmetal);
      back.position.z = -0.09;
      mesh.add(back);
      this.group.add(mesh);
    }
    for (const p of PROPERTIES) {
      const poi = POIS.find((x) => x.propertyId === p.id);
      if (!poi) continue;
      const g = new THREE.Group();
      g.position.set(poi.pos.x, groundAt(poi.pos.x, poi.pos.z), poi.pos.z);
      g.rotation.y = poi.rot ?? 0;
      const board = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshStandardMaterial({ map: this.tex.sign('SOTILADI', '#c8423b', '#fff', 'Ko‘chmas mulk agentligi'), roughness: 0.6 }));
      board.position.y = 2.2;
      for (const x of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.8, 0.08), this.mats.darkmetal);
        post.position.set(x * 1.1, 1.4, -0.06);
        g.add(post);
      }
      g.add(board);
      this.group.add(g);
      this.propBoards.set(p.id, board);
    }
  }

  setOwnedProperties(owned: string[]) {
    for (const [id, board] of this.propBoards) {
      const own = owned.includes(id);
      const m = board.material as THREE.MeshStandardMaterial;
      m.map = own ? this.tex.sign('SIZNIKI', '#2f6b3f', '#fff', 'Mulk egasi: siz') : this.tex.sign('SOTILADI', '#c8423b', '#fff', 'Ko‘chmas mulk agentligi');
      m.needsUpdate = true;
    }
  }

  private buildTrafficLights() {
    const pts: { x: number; z: number; rot: number; axis: number }[] = [];
    const marks = new GeoBuilder();
    for (const n of NET.nodes) {
      if (!n.light) continue;
      for (const id of n.edges) {
        const e = NET.edges[id];
        const q = n.id === e.a ? e.pts[1] : e.pts[e.pts.length - 2];
        let dx = q.x - n.x, dz = q.z - n.z;
        const l = Math.hypot(dx, dz) || 1;
        dx /= l; dz /= l;
        const w = e.width / 2;
        // pole beside the stop line, on the right of the approaching lane, facing the approaching traffic
        const trimN = Math.max(...n.edges.map((x) => NET.edges[x].width)) / 2 + 0.6;
        pts.push({ x: n.x + dx * (trimN + 4.6) + dz * (w + 0.9), z: n.z + dz * (trimN + 4.6) - dx * (w + 0.9), rot: Math.atan2(dx, dz), axis: NET.lightGroup(e, n.id) });
        const y = baseH(n.x + dx * (trimN + 2), n.z + dz * (trimN + 2)) + 0.095;
        const rot = Math.atan2(dx, dz);
        // zebra crossing at the mouth of the junction (stripes across the whole road)
        for (let k = -w + 0.6; k <= w - 0.6; k += 1.0) {
          const g = new THREE.BoxGeometry(0.5, 0.02, 3).rotateY(rot);
          g.translate(n.x + dx * (trimN + 2) + dz * k, y, n.z + dz * (trimN + 2) - dx * k);
          marks.add('white', g);
        }
        // stop line across the approaching lane
        const sl = new THREE.BoxGeometry(w, 0.02, 0.45).rotateY(rot);
        sl.translate(n.x + dx * (trimN + 4.2) + dz * (w / 2), y, n.z + dz * (trimN + 4.2) - dx * (w / 2));
        marks.add('white', sl);
      }
    }
    if (!this.mats.white) this.mats.white = new THREE.MeshStandardMaterial({ color: '#f2f2ee', roughness: 0.7 });
    this.group.add(marks.build(this.mats, { cast: false, receive: true }));
    const pole = new THREE.CylinderGeometry(0.08, 0.1, 4.4, 6).translate(0, 2.2, 0);
    const box = new THREE.BoxGeometry(0.4, 1.15, 0.3).translate(0, 4.3, 0);
    const poles = new THREE.InstancedMesh(pole, this.mats.darkmetal, pts.length);
    const boxes = new THREE.InstancedMesh(box, this.mats.darkmetal, pts.length);
    this.tlMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' }), pts.length * 3);
    pts.forEach((p, n) => {
      const gy = groundAt(p.x, p.z);
      tmpObj.position.set(p.x, gy, p.z);
      tmpObj.rotation.set(0, p.rot, 0);
      tmpObj.scale.setScalar(1);
      tmpObj.updateMatrix();
      poles.setMatrixAt(n, tmpObj.matrix);
      boxes.setMatrixAt(n, tmpObj.matrix);
      this.col.addCentered(p.x, p.z, 0.3, 0.3, 4);
      for (let k = 0; k < 3; k++) {
        tmpObj.position.set(p.x + Math.sin(p.rot) * 0.17, gy + 4.68 - k * 0.37, p.z + Math.cos(p.rot) * 0.17);
        tmpObj.updateMatrix();
        this.tlMesh.setMatrixAt(n * 3 + k, tmpObj.matrix);
        this.tlInfo.push({ axis: p.axis, lamp: k });
      }
    });
    for (const m of [poles, boxes, this.tlMesh]) {
      m.computeBoundingSphere();
      this.group.add(m);
    }
    this.setTrafficLights(0);
  }

  /** phase 0: X-axis green, 1: X yellow, 2: Z green, 3: Z yellow */
  setTrafficLights(phase: number) {
    if (phase === this.tlPhase) return;
    this.tlPhase = phase;
    const on = ['#ff2a1a', '#ffc21a', '#2aff6a'];
    const off = ['#3a0d0a', '#3a2c0a', '#0b2e14'];
    const c = new THREE.Color();
    this.tlInfo.forEach((t, n) => {
      const green = (t.axis === 0 && phase === 0) || (t.axis === 1 && phase === 2);
      const yellow = (t.axis === 0 && phase === 1) || (t.axis === 1 && phase === 3);
      const lit = t.lamp === 2 ? green : t.lamp === 1 ? yellow : !green && !yellow;
      c.set(lit ? on[2 - t.lamp] : off[2 - t.lamp]);
      this.tlMesh.setColorAt(n, c);
    });
    if (this.tlMesh.instanceColor) this.tlMesh.instanceColor.needsUpdate = true;
  }

  private buildPOIRings() {
    const ring = new THREE.RingGeometry(0.85, 1.05, 40).rotateX(-Math.PI / 2);
    this.ringMat = new THREE.MeshBasicMaterial({ color: '#2bb3c0', transparent: true, opacity: 0.8, depthWrite: false });
    const list = POIS.filter((p) => p.kind !== 'property');
    const mesh = new THREE.InstancedMesh(ring, this.ringMat, list.length);
    list.forEach((p, n) => {
      tmpObj.position.set(p.pos.x, groundAt(p.pos.x, p.pos.z) + 0.04, p.pos.z);
      tmpObj.rotation.set(0, 0, 0);
      tmpObj.scale.setScalar(p.radius * 0.8);
      tmpObj.updateMatrix();
      mesh.setMatrixAt(n, tmpObj.matrix);
    });
    mesh.computeBoundingSphere();
    mesh.renderOrder = 1;
    this.group.add(mesh);
  }

  /** 1520 mm railway along the north of town with G‘uzor station */
  private buildRailway(signs: SignInst[], trees: TreeInst[]) {
    const b = new GeoBuilder();
    const z = RAIL_Z;
    const X0 = BOUNDS.x0 - 500, X1 = BOUNDS.x1 + 500;
    const railY = (x: number) => Math.max(baseH(x, z - 2), baseH(x, z + 2)) + 0.35;
    for (let x = X0; x < X1; x += 20) {
      const y = Math.max(railY(x), railY(x + 20));
      b.box('ballast', x + 10, y - 1.6, z, 20.4, 1.6, 4.6, [4, 4]);
      for (const dx of [-0.76, 0.76]) b.box('metal', x + 10, y + 0.02, z + dx, 20.4, 0.15, 0.08);
    }
    const sx = STATION.x;
    const sy = Math.max(railY(sx - 70), railY(sx), railY(sx + 70));
    const sleeper = new THREE.BoxGeometry(0.26, 0.16, 2.7);
    const count = Math.floor(1600 / 0.6);
    const sl = new THREE.InstancedMesh(sleeper, this.mats.concrete, count);
    for (let i = 0; i < count; i++) {
      const x = sx - 800 + i * 0.6;
      const y = Math.max(railY(Math.floor((x - X0) / 20) * 20 + X0), railY(Math.floor((x - X0) / 20) * 20 + X0 + 20));
      tmpObj.position.set(x, y - 0.06, z);
      tmpObj.rotation.set(0, 0, 0);
      tmpObj.scale.setScalar(1);
      tmpObj.updateMatrix();
      sl.setMatrixAt(i, tmpObj.matrix);
    }
    sl.receiveShadow = true;
    sl.computeBoundingSphere();
    this.group.add(sl);
    b.box('concrete', sx, sy - 1.5, z + 6, 140, 2.4, 6);
    this.col.addCentered(sx, z + 6, 140, 6, 1.2);
    for (let px = sx - 60; px <= sx + 60; px += 15) {
      b.cyl('metal', px, sy + 0.9, z + 7.6, 0.12, 0.12, 3.4, 8);
      b.box('tin-green', px, sy + 4.3, z + 6.4, 15, 0.12, 4.6);
    }
    b.box('concrete', sx, sy - 4, z + 17, 46, 4, 14);
    b.box('fac-brick', sx, sy, z + 17, 44, 8.5, 12, this.tex.facade('brick').tile);
    b.box('chalk', sx, sy + 8.5, z + 17, 44.6, 0.6, 12.6);
    b.prism('tin-green', sx, sy + 9.1, z + 17, 44.6, 2.4, 12.6);
    b.box('fac-brick', sx, sy, z + 17, 10, 12, 12.4, this.tex.facade('brick').tile);
    b.box('chalk', sx, sy + 12, z + 17, 10.6, 0.6, 12.8);
    this.col.addCentered(sx, z + 17, 44, 12, 9);
    signs.push({ tex: this.tex.sign('G‘UZOR', '#1d3b5c', '#ffffff', 'Temir yo‘l vokzali'), x: sx, y: sy + 9.6, z: z + 23.35, w: 9, h: 2.2, rot: 0 });
    for (let k = 0; k < 6; k++) {
      const cx = sx - 62 + k * 25;
      b.box('train', cx, sy + 0.7, z, 24, 3.3, 3.2);
      b.box('window-band', cx, sy + 2.2, z, 22, 0.9, 3.26);
      b.box('metal', cx, sy + 4.0, z, 23.6, 0.35, 2.9);
      b.box('darkmetal', cx, sy + 0.05, z, 20, 0.65, 2.6);
      this.col.addCentered(cx, z, 24, 3.4, 4);
    }
    // forecourt and access road down to the A380
    const road = NET.nearestRoad(sx, z + 80, 60);
    const zEnd = road ? road.pz - (road.e.width / 2 - 0.5) : z + 80;
    const ac = new THREE.PlaneGeometry(10, zEnd - (z + 23)).rotateX(-Math.PI / 2);
    const pos = ac.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = sx + pos.getX(i), zz = (z + 23 + zEnd) / 2 + pos.getZ(i);
      pos.setXYZ(i, x, baseH(x, zz) + 0.07, zz);
    }
    ac.computeVertexNormals();
    b.add('asphalt', ac);
    for (let px = sx - 26; px <= sx + 26; px += 13) trees.push({ type: 'terak', x: px, z: z + 44, s: 1.1 });
    const g = b.build(this.mats, { cast: this.shadows, receive: true });
    g.name = 'railway';
    this.group.add(g);
  }

  private buildMountains() {
    const rng = mulberry32(777);
    const parts: THREE.BufferGeometry[] = [];
    const low = new THREE.Color('#5b6b80');
    const snow = new THREE.Color('#f2f4f7');
    for (let n = 0; n < 70; n++) {
      // Zarafshon-style range mostly to the east and north
      const a = -Math.PI * 0.95 + (n / 70) * Math.PI * 1.25 + rand(rng, -0.03, 0.03);
      const r = rand(rng, 1900, 2500);
      const h = rand(rng, 180, 520);
      const g = new THREE.ConeGeometry(rand(rng, 260, 480), h, 7, 3).toNonIndexed();
      const pos = g.attributes.position as THREE.BufferAttribute;
      const cols = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i) / h + 0.5;
        pos.setX(i, pos.getX(i) * (1 + Math.sin(i * 1.7 + n) * 0.08));
        const haze = new THREE.Color('#c9d6e2');
        const c = y > 0.72 ? snow : y < 0.3 ? haze.clone().lerp(low, y / 0.3) : low.clone().lerp(snow, Math.max(0, y - 0.45));
        cols.set([c.r, c.g, c.b], i * 3);
      }
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      g.translate(Math.cos(a) * r, h / 2 - 20, Math.sin(a) * r);
      parts.push(g);
    }
    const loessA = new THREE.Color('#a89068'), loessB = new THREE.Color('#c2ad84');
    for (let n = 0; n < 46; n++) {
      const a = -Math.PI * 0.85 + (n / 46) * Math.PI * 1.05 + rand(rng, -0.04, 0.04);
      const r = rand(rng, 1000, 1650);
      const h = rand(rng, 50, 170);
      const w = rand(rng, 180, 420);
      const g = new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed();
      g.scale(w, h, w * rand(rng, 0.6, 1.1));
      const pos = g.attributes.position as THREE.BufferAttribute;
      const cols = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const c = loessA.clone().lerp(loessB, pos.getY(i) / h).offsetHSL(0, 0, (Math.sin(i * 0.37 + n) * 0.03));
        cols.set([c.r, c.g, c.b], i * 3);
      }
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      g.translate(Math.cos(a) * r, -8, Math.sin(a) * r);
      parts.push(g);
    }
    const merged = new THREE.BufferGeometry();
    let total = 0;
    parts.forEach((p) => (total += p.attributes.position.count));
    const P = new Float32Array(total * 3), C = new Float32Array(total * 3);
    let o = 0;
    for (const p of parts) {
      P.set(p.attributes.position.array as Float32Array, o * 3);
      C.set(p.attributes.color.array as Float32Array, o * 3);
      o += p.attributes.position.count;
      p.dispose();
    }
    merged.setAttribute('position', new THREE.BufferAttribute(P, 3));
    merged.setAttribute('color', new THREE.BufferAttribute(C, 3));
    this.mountainMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
    const mesh = new THREE.Mesh(merged, this.mountainMat);
    mesh.frustumCulled = false;
    this.group.add(mesh);
  }

  // ------------------------------------------------------------ per frame
  // ------------------------------------------------------------ World Environment Editor API
  private edits: Record<number, LotEdit> = loadEdits().lots;
  private propEdits: Record<string, LotEdit> = loadEdits().props;
  private propByKey = new Map<string, PropInstance>();
  private worldModels = new Map<string, { g: GLTF; rotate: number }>();
  private highlight: THREE.Group | null = null;

  setWorldModels(m: Map<string, { g: GLTF; rotate: number }>) {
    this.worldModels = m;
    for (const id of Object.keys(this.edits).map(Number)) if (this.edits[id].model) this.rebuildLot(id);
  }
  worldModelSlots() {
    return [...this.worldModels.keys()];
  }
  private clean(e: LotEdit | null) {
    return e ? (Object.fromEntries(Object.entries(e).filter(([, v]) => v !== undefined && v !== 0 && v !== false && v !== 1 && v !== '')) as LotEdit) : {};
  }
  /** lot frame = original frame + edit; also updates the ground-height grid and hidden flag */
  private applyLotFrame(id: number) {
    const L = NET.lots[id];
    if (!L) return;
    const e = this.edits[id] ?? {};
    NET.moveLot(id, L.base.ox + (e.dx ?? 0), L.base.oz + (e.dz ?? 0), L.base.rot + ((e.drot ?? 0) * Math.PI) / 180);
    L.hidden = !!e.hidden;
  }
  getEdit(target: number | string): LotEdit {
    return { ...(typeof target === 'number' ? this.edits[target] : this.propEdits[target]) ?? {} };
  }
  setEdit(target: number | string, e: LotEdit | null) {
    const c = this.clean(e);
    if (typeof target === 'number') {
      if (!Object.keys(c).length) delete this.edits[target];
      else this.edits[target] = c;
      this.applyLotFrame(target);
      this.rebuildLot(target);
    } else {
      if (!Object.keys(c).length) delete this.propEdits[target];
      else this.propEdits[target] = c;
      this.refreshProp(target);
    }
  }
  /** base data of a global prop key (t: tree, l: lamp, f: bench / bin) */
  private propBase(key: string): { x: number; z: number; rot: number; s: number; kind: string } | null {
    const [k, n] = [key[0], Number(key.slice(2))];
    if (k === 't') { const t = NET.trees[n]; return t ? { x: t.x, z: t.z, rot: 0, s: t.s, kind: t.type } : null; }
    if (k === 'l') { const l = NET.lamps[n]; return l ? { x: l.x, z: l.z, rot: l.rot, s: l.tall ? 1.4 : 1, kind: 'lamp' } : null; }
    const f = NET.furniture[n];
    return f ? { x: f.x, z: f.z, rot: f.rot, s: 1, kind: f.kind } : null;
  }
  private editedProps(trees: TreeInst[], lamps: LampInst[]): [TreeInst[], LampInst[]] {
    const ed = (it: { key?: string; x: number; z: number }) => (it.key ? this.propEdits[it.key] : undefined);
    const t2 = trees.filter((t) => !ed(t)?.hidden).map((t) => {
      const e = ed(t);
      return e ? { ...t, x: t.x + (e.dx ?? 0), z: t.z + (e.dz ?? 0), s: t.s * (e.scale ?? 1), rot: e.drot ? (e.drot * Math.PI) / 180 : undefined } : t;
    });
    const l2 = lamps.filter((l) => !ed(l)?.hidden).map((l) => {
      const e = ed(l);
      return e ? { ...l, x: l.x + (e.dx ?? 0), z: l.z + (e.dz ?? 0), rot: l.rot + ((e.drot ?? 0) * Math.PI) / 180, s: e.scale } : l;
    });
    return [t2, l2];
  }
  /** move / hide an already built prop instance in place, collision included */
  private refreshProp(key: string) {
    const p = this.propByKey.get(key), b = this.propBase(key);
    if (!p || !b) return;
    const e = this.propEdits[key] ?? {};
    const x = b.x + (e.dx ?? 0), z = b.z + (e.dz ?? 0);
    const rot = (p.kind === 'lamp' || p.kind === 'bench' || p.kind === 'bin' ? b.rot : p.rot) + ((e.drot ?? 0) * Math.PI) / 180;
    const s = e.hidden ? 0 : b.s * (e.scale ?? 1);
    tmpObj.position.set(x, groundAt(x, z), z);
    tmpObj.rotation.set(0, rot, 0);
    tmpObj.scale.setScalar(s);
    tmpObj.updateMatrix();
    p.meshes.forEach((m, i) => {
      if (p.kind === 'lamp' && i === 3) {
        const px = x + Math.sin(rot) * 1.8 * s, pz = z + Math.cos(rot) * 1.8 * s;
        const o = new THREE.Object3D();
        o.position.set(px, groundAt(px, pz) + 0.03, pz);
        o.scale.setScalar(s);
        o.updateMatrix();
        m.setMatrixAt(p.index, o.matrix);
      } else m.setMatrixAt(p.index, tmpObj.matrix);
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
    });
    if (p.colId !== undefined) this.col.remove(p.colId);
    p.colId = undefined;
    if (!e.hidden && p.kind !== 'bush' && p.kind !== 'grass') {
      const w = p.kind === 'bench' ? 0.9 : p.kind === 'lamp' || p.kind === 'bin' ? 0.3 : p.kind === 'fruit' ? 0.35 : 0.5;
      p.colId = this.col.addOBB(x, z, w * s, (p.kind === 'bench' ? 0.35 : w) * s, rot, p.kind === 'lamp' ? 7 : 2);
    }
    p.x = x;
    p.z = z;
  }
  private rebuildLot(id: number) {
    const L = NET.lots[id];
    if (!L) return;
    const c = this.chunks.get(L.chunk);
    if (c) {
      this.disposeChunk(c);
      this.buildChunk(L.chunk);
    }
  }
  saveEdits() {
    localStorage.setItem(EDIT_KEY, JSON.stringify({ sig: WORLD_SIG(), edits: this.edits, props: this.propEdits }));
  }
  resetEdits() {
    const ids = Object.keys(this.edits).map(Number), keys = Object.keys(this.propEdits);
    this.edits = {};
    this.propEdits = {};
    for (const id of ids) { this.applyLotFrame(id); this.rebuildLot(id); }
    for (const k of keys) this.refreshProp(k);
    this.saveEdits();
  }
  editCount() {
    return Object.keys(this.edits).length + Object.keys(this.propEdits).length;
  }
  lotsNear(x: number, z: number, r: number) {
    return NET.lots
      .filter((l) => l.kind !== 'site' && Math.abs(l.cx - x) < r && Math.abs(l.cz - z) < r)
      .map((l) => ({ id: l.id as number | string, kind: l.kind as string, zone: l.zone as string, w: l.w, d: l.d, dist: Math.hypot(l.cx - x, l.cz - z), owned: !!l.home || !!l.propertyId }))
      .filter((l) => l.dist < r)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 60);
  }
  propsNear(x: number, z: number, r: number) {
    const out: { id: number | string; kind: string; zone: string; w: number; d: number; dist: number; owned: boolean }[] = [];
    const add = (key: string) => {
      const b = this.propBase(key)!;
      const e = this.propEdits[key] ?? {};
      const px = b.x + (e.dx ?? 0), pz = b.z + (e.dz ?? 0), d = Math.hypot(px - x, pz - z);
      if (d < r) out.push({ id: key, kind: b.kind, zone: zoneAt(px, pz), w: 0, d: 0, dist: d, owned: false });
    };
    NET.trees.forEach((t, i) => { if (Math.abs(t.x - x) < r && Math.abs(t.z - z) < r) add(`t:${i}`); });
    NET.lamps.forEach((l, i) => { if (Math.abs(l.x - x) < r && Math.abs(l.z - z) < r) add(`l:${i}`); });
    NET.furniture.forEach((f, i) => { if (Math.abs(f.x - x) < r && Math.abs(f.z - z) < r) add(`f:${i}`); });
    return out.sort((a, b) => a.dist - b.dist).slice(0, 80);
  }
  /** cyan outlines for the selected lots / rings for the selected objects */
  highlightTargets(targets: (number | string)[]) {
    if (this.highlight) {
      this.group.remove(this.highlight);
      this.highlight.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      this.highlight = null;
    }
    if (!targets.length) return;
    const g = new THREE.Group();
    const mat = new THREE.LineBasicMaterial({ color: '#2bb3c0', depthTest: false });
    for (const t of targets) {
      if (typeof t === 'number') {
        const L = NET.lots[t];
        if (!L) continue;
        const pts = [[0, 0], [L.w, 0], [L.w, L.d], [0, L.d]].map(([x, z]) => {
          const p = frameToWorld(L.ox, L.oz, L.rot, x, z);
          return new THREE.Vector3(p.x, L.gy + 0.35, p.z);
        });
        g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), mat));
      } else {
        const b = this.propBase(t), e = this.propEdits[t] ?? {};
        if (!b) continue;
        const x = b.x + (e.dx ?? 0), z = b.z + (e.dz ?? 0), y = groundAt(x, z) + 0.15;
        const pts = Array.from({ length: 24 }, (_, k) => new THREE.Vector3(x + Math.cos((k / 24) * Math.PI * 2) * 1.2, y, z + Math.sin((k / 24) * Math.PI * 2) * 1.2));
        g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), mat));
      }
    }
    g.renderOrder = 5;
    this.highlight = g;
    this.group.add(g);
  }
  /** kept for older callers */
  highlightLot(id: number | null) {
    this.highlightTargets(id === null ? [] : [id]);
  }
  getLotEdit(id: number) {
    return this.getEdit(id);
  }
  setLotEdit(id: number, e: LotEdit | null) {
    this.setEdit(id, e);
  }

  update(dt: number, cam: THREE.Vector3, night: number, wet: number, horizon: THREE.Color, daylight: number) {
    this.visTimer -= dt;
    if (this.visTimer <= 0) {
      this.visTimer = 0.2;
      const R = Math.max(this.renderDistance, 240) + 40;
      const need: [number, string][] = [];
      const c0x = Math.floor(cam.x / CHUNK), c0z = Math.floor(cam.z / CHUNK), rr = Math.ceil(R / CHUNK) + 1;
      for (let dx = -rr; dx <= rr; dx++)
        for (let dz = -rr; dz <= rr; dz++) {
          const key = `${c0x + dx},${c0z + dz}`;
          if (!this.lotsByChunk.has(key) || this.chunks.has(key)) continue;
          const d = Math.hypot((c0x + dx + 0.5) * CHUNK - cam.x, (c0z + dz + 0.5) * CHUNK - cam.z) - CHUNK * 0.71;
          if (d < R) need.push([d, key]);
        }
      need.sort((a, b) => a[0] - b[0]);
      for (const [, key] of need.slice(0, 2)) this.buildChunk(key);
      for (const c of [...this.chunks.values()]) {
        const d = Math.hypot(cam.x - c.x, cam.z - c.z) - CHUNK * 0.71;
        if (d > R + 240) this.disposeChunk(c);
        else {
          c.group.visible = d < R;
          c.detail.visible = d < this.lodDistance + 40;
        }
      }
      this.stats.chunks = this.chunks.size;
      const TR = this.renderDistance + 700;
      let tb = 0;
      for (const key of this.terrainTodo) {
        const [cx, cz] = key.split(',').map(Number);
        if (Math.hypot((cx + 0.5) * CHUNK - cam.x, (cz + 0.5) * CHUNK - cam.z) - 120 < TR) {
          this.buildTerrainChunk(key);
          if (++tb >= 6) break;
        }
      }
      for (const [key, r] of this.pendingRegions) {
        const [rx, rz] = key.split(',').map(Number);
        if (Math.hypot((rx + 0.5) * 240 - cam.x, (rz + 0.5) * 240 - cam.z) - 170 < this.renderDistance + 60) {
          this.pendingRegions.delete(key);
          this.buildProps(...this.editedProps(r.trees, r.lamps));
          break;
        }
      }
      for (const t of this.terrain) t.mesh.visible = Math.hypot(cam.x - t.x, cam.z - t.z) - 120 < TR;
      for (const r of this.regions) r.group.visible = Math.hypot(cam.x - r.x, cam.z - r.z) - 170 < this.renderDistance;
    }
    for (const n of this.nightMats) n.m.emissiveIntensity = night * n.k;
    this.poolMat.opacity = night * 0.55;
    for (const w of this.wetMats) {
      w.m.roughness = w.rough - wet * (w.rough - 0.28);
      w.m.color.copy(w.color).multiplyScalar(1 - wet * 0.35);
    }
    this.ringMat.opacity = 0.45 + Math.sin(performance.now() / 300) * 0.25;
    this.mountainMat.color.setRGB(0.25 + daylight * 0.75, 0.27 + daylight * 0.73, 0.32 + daylight * 0.68).lerp(horizon, 0.35);
  }
}
