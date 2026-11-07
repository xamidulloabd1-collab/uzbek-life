import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GeoBuilder } from './builder';
import { TextureLib } from './textures';
import { CollisionWorld } from '@/game/physics/collision';
import {
  BLOCK, CURB_H, DIRS, HALF, N, PITCH, POIS, ROAD, blockRect, districtOf, isFlatBlock, isLightNode, isRuralSegment, rightOf, roadLine,
  RIVER, RAIL_Z, STATION_X,
} from './cityLayout';
import { buildBlock, type BlockCtx, type BlockOptions, type LampInst, type ParkedInst, type SignInst, type Slot, type TreeInst, type TreeType } from './buildings';
import { VEHICLE_MAP } from '@/config/vehicles';
import { lowGeometry as lowGeo } from '@/game/vehicles/vehicleModel';
import { buildFacadeMeshes, makeFacadeMaterials, newFacadeSet, type FacadeMaterials } from './facadeKit';
import { PROPERTIES } from '@/config/properties';
import { TRAFFIC_COLORS } from '@/config/vehicles';
import { lowMats, lowPaint } from '@/game/vehicles/vehicleModel';
import { mulberry32, rand } from '@/utils/math';

interface Chunk { base: THREE.Group; detail: THREE.Group; x: number; z: number; i: number; j: number; slots: { houses: Slot[]; gates: Slot[] } }

/** one instanced prop (tree / lamp) that can be hidden and replaced by a GLB */
export interface PropInstance { meshes: THREE.InstancedMesh[]; index: number; x: number; z: number; rot: number; s: number; kind: TreeType | 'lamp' }
interface Region { group: THREE.Group; x: number; z: number }

const tmpObj = new THREE.Object3D();

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


export class World {
  readonly group = new THREE.Group();
  readonly col = new CollisionWorld();
  readonly tex: TextureLib;
  mats: Record<string, THREE.Material> = {};
  private chunks: Chunk[] = [];
  private props: PropInstance[] = [];
  /** NPC cars parked around town: instanced, enterable, some locked */
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
  lodDistance = 150;
  readonly facadeMats: FacadeMaterials = makeFacadeMaterials();
  renderDistance = 400;

  constructor(textureSize: number, private shadows: boolean, private treeShadows: boolean, private treeDetail = 1) {
    this.tex = new TextureLib(textureSize);
    this.makeMaterials();
    this.buildGround();
    this.buildRoads();
    const trees: TreeInst[] = [];
    const lamps: LampInst[] = [];
    const signs: SignInst[] = [];
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++) this.chunks.push(this.makeChunk(i, j, {}, trees, lamps, signs));
    this.buildParked();
    this.buildOutskirts(trees, lamps);
    this.buildRailway(signs, trees);
    this.buildProps(trees, lamps);
    this.buildSigns(signs);
    this.buildTrafficLights();
    this.buildPOIRings();
    this.buildMountains();
  }

  private makeChunk(i: number, j: number, opts: BlockOptions, trees: TreeInst[], lamps: LampInst[], signs: SignInst[]): Chunk {
    const r = blockRect(i, j);
    const ctx: BlockCtx = {
      b: new GeoBuilder(), d: new GeoBuilder(), col: this.col, rng: mulberry32(i * 7349 + j * 9151 + 17), tex: this.tex,
      i, j, r, gy: isFlatBlock(i, j) ? 0 : CURB_H, trees, lamps, signs, frame: { ox: 0, oz: 0, rot: 0 }, facade: newFacadeSet(),
      opts, slots: { houses: [], gates: [] }, parked: this.parkedSrc,
    };
    buildBlock(ctx);
    const base = ctx.b.build(this.mats, { cast: this.shadows, receive: true }, new Set(['pavers', 'water', 'curb']));
    const detail = ctx.d.build(this.mats, { cast: this.shadows, receive: true });
    detail.add(buildFacadeMeshes(ctx.facade, this.facadeMats, this.shadows));
    this.group.add(base, detail);
    return { base, detail, x: r.cx, z: r.cz, i, j, slots: ctx.slots };
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

  slotsOf(i: number, j: number) {
    return this.chunks.find((c) => c.i === i && c.j === j)!.slots;
  }

  /** rebuild one block without selected procedural parts (used when GLB assets replace them) */
  rebuildBlock(i: number, j: number, opts: BlockOptions) {
    const k = this.chunks.findIndex((c) => c.i === i && c.j === j);
    const old = this.chunks[k];
    for (const g of [old.base, old.detail]) {
      this.group.remove(g);
      g.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    }
    // props/signs of the block already exist as instances; collisions from the first build are kept
    const scratchCol = this.col;
    const dummy = new CollisionWorld();
    (this as unknown as { col: CollisionWorld }).col = dummy;
    const keep = this.parkedSrc;
    this.parkedSrc = [];
    const chunk = this.makeChunk(i, j, opts, [], [], []);
    this.parkedSrc = keep;
    if (opts.skipParked) {
      const r = blockRect(i, j);
      this.parked.filter((p) => !p.taken && p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1).forEach((p) => this.takeParked(p));
    }
    (this as unknown as { col: CollisionWorld }).col = scratchCol;
    this.chunks[k] = chunk;
    return chunk.slots;
  }

  /** hide instanced props inside a rectangle; returns them so GLB versions can take their place */
  hideProps(x0: number, z0: number, x1: number, z1: number, kinds: (TreeType | 'lamp')[]) {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    const hit = this.props.filter((p) => p.x >= x0 && p.x <= x1 && p.z >= z0 && p.z <= z1 && kinds.includes(p.kind));
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
    std('rural', { ...nm(T.rural(), 2.5), roughness: 0.95 });
    std('pavers', { ...nm(T.pavers(), 4), roughness: 0.85 });
    std('plaza', { ...nm(T.plaza(), 3), roughness: 0.7 });
    ['road', 'asphalt', 'rural', 'pavers', 'plaza'].forEach(wet);
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
    for (let s = 0; s < 3; s++) std(`mosaic-${s}`, { map: T.mosaic(101 + s * 7), roughness: 0.6 });
    for (const c of new Set(TRAFFIC_COLORS)) this.mats[`car-${c}`] = lowPaint(c);
    this.mats['car-glass'] = lowMats.glass;
    this.mats['car-dark'] = lowMats.dark;
    this.mats['car-lights'] = lowMats.lights;
  }

  // ------------------------------------------------------------ ground & roads
  private buildGround() {
    const b = new GeoBuilder();
    // ground is split so the G‘uzordaryo valley can cut through it
    b.quad('steppe', -3200, -3200, 3200, RIVER.z0 - 3, -0.3, 'world', 18);
    b.quad('steppe', -3200, RIVER.z1 + 3, 3200, 3200, -0.3, 'world', 18);
    const bank = (z0: number, y0: number, z1: number, y1: number) => {
      const pos = [-3200, y0, z0, -3200, y1, z1, 3200, y1, z1, -3200, y0, z0, 3200, y1, z1, 3200, y0, z0];
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute([0, z0 / 6, 0, z1 / 6, 1066, z1 / 6, 0, z0 / 6, 1066, z1 / 6, 1066, z0 / 6], 2));
      g.computeVertexNormals();
      if (g.attributes.normal.getY(0) < 0) g.index = null;
      b.add('steppe', g);
    };
    bank(RIVER.z0 - 3, -0.3, RIVER.z0 + 1.5, -2.1);
    bank(RIVER.z1 - 1.5, -2.1, RIVER.z1 + 3, -0.3);
    b.quad('river', -3200, RIVER.z0 - 1, 3200, RIVER.z1 + 1, -1.65, 'world', 12);
    b.quad('riverbed', -3200, RIVER.z0 - 2, 3200, RIVER.z1 + 2, -2.3, 'world', 12);
    // keep people and cars out of the water outside the embanked town
    const G = HALF + ROAD / 2 + 8.5;
    for (const z of [RIVER.z0 - 2.5, RIVER.z1 + 2.5]) {
      this.col.add(-3200, z - 0.5, -G, z + 0.5, 1.2);
      this.col.add(G, z - 0.5, 3200, z + 0.5, 1.2);
    }
    const g = b.build(this.mats, { cast: false, receive: true });
    this.group.add(g);
  }

  private buildRoads() {
    const b = new GeoBuilder();
    const R = ROAD;
    for (let k = 0; k <= N; k++) {
      const x = roadLine(k);
      for (let l = 0; l < N; l++) {
        const z0 = roadLine(l) + R / 2, z1 = roadLine(l + 1) - R / 2;
        b.quad(isRuralSegment(true, k, l) ? 'rural' : 'road', x - R / 2, z0, x + R / 2, z1, 0, 'z', 14);
        const hz = roadLine(k);
        const hx0 = roadLine(l) + R / 2, hx1 = roadLine(l + 1) - R / 2;
        b.quad(isRuralSegment(false, l, k) ? 'rural' : 'road', hx0, hz - R / 2, hx1, hz + R / 2, 0, 'x', 14);
      }
      for (let l = 0; l <= N; l++) {
        const z = roadLine(l);
        b.quad('asphalt', x - R / 2, z - R / 2, x + R / 2, z + R / 2, 0.001, 'world', 10);
        const urban = l <= 7 && k > 0 && k < N && l > 0;
        if (urban) {
          b.quad('zebra', x - R / 2, z - R / 2 - 3.4, x + R / 2, z - R / 2 - 0.4, 0.012, 'z', 3);
          b.quad('zebra', x - R / 2, z + R / 2 + 0.4, x + R / 2, z + R / 2 + 3.4, 0.012, 'z', 3);
          b.quad('zebra', x - R / 2 - 3.4, z - R / 2, x - R / 2 - 0.4, z + R / 2, 0.012, 'x', 3);
          b.quad('zebra', x + R / 2 + 0.4, z - R / 2, x + R / 2 + 3.4, z + R / 2, 0.012, 'x', 3);
        }
      }
    }
    // bridges over G‘uzordaryo: deck girders and piers under every crossing street
    for (let k = 0; k <= N; k++) {
      const x = roadLine(k);
      const x0 = k === 0 ? x - R / 2 - 8 : x - R / 2 - 4, x1 = k === N ? x + R / 2 + 8 : x + R / 2 + 4;
      b.box('concrete', (x0 + x1) / 2, -0.95, (RIVER.z0 + RIVER.z1) / 2, x1 - x0, 0.9, RIVER.z1 - RIVER.z0 + 1.5);
      for (const px of [x0 + 2, x1 - 2]) b.cyl('concrete', px, -2.4, (RIVER.z0 + RIVER.z1) / 2, 0.7, 0.8, 1.5, 12);
      if (k === 0 || k === N) {
        const ex = k === 0 ? x0 + 0.2 : x1 - 0.2;
        b.box('metal', ex, 0, (RIVER.z0 + RIVER.z1) / 2, 0.15, 1.0, RIVER.z1 - RIVER.z0 + 4);
      }
    }
    // stop lines at signalised junctions, manholes and storm drains
    const rng = mulberry32(606);
    for (let k = 3; k <= 6; k++)
      for (let l = 3; l <= 6; l++) {
        const x = roadLine(k), z = roadLine(l);
        b.quad('white', x - R / 2, z - R / 2 - 3.9, x, z - R / 2 - 3.5, 0.014, 'world', 4);
        b.quad('white', x, z + R / 2 + 3.5, x + R / 2, z + R / 2 + 3.9, 0.014, 'world', 4);
        b.quad('white', x - R / 2 - 3.9, z, x - R / 2 - 3.5, z + R / 2, 0.014, 'world', 4);
        b.quad('white', x + R / 2 + 3.5, z - R / 2, x + R / 2 + 3.9, z, 0.014, 'world', 4);
      }
    for (let k = 1; k < N; k++)
      for (let l = 0; l < N; l++) {
        const x = roadLine(k), z0 = roadLine(l) + R / 2;
        if (rng() < 0.7) b.cyl('darkmetal', x + (rng() < 0.5 ? -2.6 : 2.6), 0.004, z0 + 20 + rng() * 40, 0.36, 0.36, 0.02, 16);
        for (let t = 12; t < PITCH - R; t += 26) {
          b.box('darkmetal', x - R / 2 + 0.25, 0.003, z0 + t, 0.4, 0.02, 0.9);
          b.box('darkmetal', x + R / 2 - 0.25, 0.003, z0 + t + 9, 0.4, 0.02, 0.9);
        }
      }
    // ring highway: extra outer lanes, guardrails
    const E = HALF + R / 2;
    const S = 8;
    b.quad('asphalt', -E - S, -E - S, E + S, -E, 0, 'world', 10);
    b.quad('asphalt', -E - S, E, E + S, E + S, 0, 'world', 10);
    b.quad('asphalt', -E - S, -E, -E, E, 0, 'world', 10);
    b.quad('asphalt', E, -E, E + S, E, 0, 'world', 10);
    const G = E + S + 0.4;
    for (const [x0, z0, x1, z1] of [[-G, -G, G, -G + 0.3], [-G, G - 0.3, G, G], [-G, -G, -G + 0.3, G], [G - 0.3, -G, G, G]]) {
      const exits = 30; // gaps where the highway stubs leave the city
      const horiz = Math.abs(z1 - z0) < 1;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const len = horiz ? x1 - x0 : z1 - z0;
      // gaps: highway stubs (south, east) and the station access road (north)
      const gapAt = (horiz && cz > 0) || (!horiz && cx > 0) ? 0 : horiz && cz < 0 ? STATION_X : null;
      const segs: [number, number][] = gapAt === null ? [[-len / 2, len / 2]] : [[-len / 2, gapAt - exits / 2], [gapAt + exits / 2, len / 2]];
      for (const [a, c] of segs) {
        const mid = (a + c) / 2, l = c - a;
        if (horiz) {
          b.box('metal', cx + mid, 0, cz, l, 0.8, 0.3);
          this.col.addCentered(cx + mid, cz, l, 0.4, 0.8);
        } else {
          b.box('metal', cx, 0, cz + mid, 0.3, 0.8, l);
          this.col.addCentered(cx, cz + mid, 0.4, l, 0.8);
        }
      }
    }
    // highway stubs leaving the city (east + south) towards the mountains
    const stubLen = 700;
    b.quad('road', G, -R / 2 - 4, G + stubLen, R / 2 + 4, 0, 'x', 14);
    b.quad('road', -R / 2 - 4, G, R / 2 + 4, G + stubLen, 0, 'z', 14);
    // world boundary
    const B = G + stubLen;
    this.col.addCentered(B + 2, 0, 2, B * 2, 5);
    this.col.addCentered(0, B + 2, B * 2, 2, 5);
    this.col.addCentered(-B - 2, 0, 2, B * 2, 5);
    this.col.addCentered(0, -B - 2, B * 2, 2, 5);
    const g = b.build(this.mats, { cast: false, receive: true });
    g.name = 'roads';
    this.group.add(g);
  }

  private buildOutskirts(trees: TreeInst[], lamps: LampInst[]) {
    const rng = mulberry32(4242);
    const E = HALF + ROAD / 2 + 8;
    // highway lamps
    for (let t = -E + 20; t < E; t += 46) {
      lamps.push({ x: t, z: -E - 1.2, rot: 0, tall: true });
      lamps.push({ x: t, z: E + 1.2, rot: Math.PI, tall: true });
      lamps.push({ x: -E - 1.2, z: t, rot: Math.PI / 2, tall: true });
      lamps.push({ x: E + 1.2, z: t, rot: -Math.PI / 2, tall: true });
    }
    // windbreak poplars + scattered steppe trees
    for (let t = -E; t < E; t += 7) {
      for (const [x, z] of [[t, -E - 14], [t, E + 14], [-E - 14, t], [E + 14, t]]) {
        if (Math.abs(x) < 20 && z > 0) continue;
        if (Math.abs(z) < 20 && x > 0) continue;
        if (rng() < 0.85) trees.push({ type: 'terak', x: x + rand(rng, -1, 1), z: z + rand(rng, -1, 1), s: rand(rng, 0.9, 1.2) });
      }
    }
    for (let n = 0; n < 420; n++) {
      const a = rng() * Math.PI * 2;
      const r = rand(rng, E + 30, E + 600);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if ((Math.abs(z) < 25 && x > 0) || (Math.abs(x) < 25 && z > 0)) continue;
      trees.push({ type: rng() < 0.6 ? 'fruit' : 'chinor', x, z, s: rand(rng, 0.7, 1.3) });
    }
  }

  // ------------------------------------------------------------ instanced props
  private buildProps(trees: TreeInst[], lamps: LampInst[]) {
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

    const regionKey = (x: number, z: number) => {
      const rx = Math.max(-1, Math.min(3, Math.floor((x + HALF) / (PITCH * 3))));
      const rz = Math.max(-1, Math.min(3, Math.floor((z + HALF) / (PITCH * 3))));
      return `${rx},${rz}`;
    };
    const buckets = new Map<string, { trees: TreeInst[]; lamps: LampInst[] }>();
    const bucket = (k: string) => {
      let b = buckets.get(k);
      if (!b) buckets.set(k, (b = { trees: [], lamps: [] }));
      return b;
    };
    for (const t of trees) {
      bucket(regionKey(t.x, t.z)).trees.push(t);
      if (t.type === 'bush' || t.type === 'grass') continue;
      const w = t.type === 'fruit' ? 0.35 : t.type === 'terak' ? 0.4 : 0.6;
      this.col.addCentered(t.x, t.z, w * t.s, w * t.s, 3);
    }
    for (const l of lamps) {
      bucket(regionKey(l.x, l.z)).lamps.push(l);
      this.col.addCentered(l.x, l.z, 0.3, 0.3, 7);
    }
    const color = new THREE.Color();
    const rng = mulberry32(99);
    for (const [key, b] of buckets) {
      const [rx, rz] = key.split(',').map(Number);
      const group = new THREE.Group();
      for (const type of Object.keys(geos) as TreeType[]) {
        const list = b.trees.filter((t) => t.type === type);
        if (!list.length) continue;
        const tg = geos[type].trunk;
        const trunk = tg ? new THREE.InstancedMesh(tg, trunkMat, list.length) : null;
        const crown = new THREE.InstancedMesh(geos[type].crown, crownMats[type], list.length);
        list.forEach((t, n) => {
          const gy = this.groundAt(t.x, t.z);
          tmpObj.position.set(t.x, gy, t.z);
          tmpObj.rotation.set(0, rng() * Math.PI * 2, 0);
          tmpObj.scale.setScalar(t.s);
          tmpObj.updateMatrix();
          trunk?.setMatrixAt(n, tmpObj.matrix);
          crown.setMatrixAt(n, tmpObj.matrix);
          this.props.push({ meshes: trunk ? [trunk, crown] : [crown], index: n, x: t.x, z: t.z, rot: tmpObj.rotation.y, s: t.s, kind: type });
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
      if (b.lamps.length) {
        const meshes = [new THREE.InstancedMesh(pole, lampMat, b.lamps.length), new THREE.InstancedMesh(arm, lampMat, b.lamps.length), new THREE.InstancedMesh(head, headMat, b.lamps.length)];
        const pools = new THREE.InstancedMesh(pool, this.poolMat, b.lamps.length);
        b.lamps.forEach((l, n) => {
          const gy = this.groundAt(l.x, l.z);
          const s = l.tall ? 1.4 : 1;
          tmpObj.position.set(l.x, gy, l.z);
          tmpObj.rotation.set(0, l.rot, 0);
          tmpObj.scale.setScalar(s);
          tmpObj.updateMatrix();
          meshes.forEach((m) => m.setMatrixAt(n, tmpObj.matrix));
          this.props.push({ meshes: [...meshes, pools], index: n, x: l.x, z: l.z, rot: l.rot, s, kind: 'lamp' });
          tmpObj.position.set(l.x + Math.sin(l.rot) * 1.8 * s, 0.03, l.z + Math.cos(l.rot) * 1.8 * s);
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
      this.group.add(group);
      this.regions.push({ group, x: -HALF + (rx + 0.5) * PITCH * 3, z: -HALF + (rz + 0.5) * PITCH * 3 });
    }
  }

  private groundAt(x: number, z: number) {
    const fx = x + HALF, fz = z + HALF;
    const i = Math.floor(fx / PITCH), j = Math.floor(fz / PITCH);
    if (i < 0 || j < 0 || i >= N || j >= N) return 0;
    const lx = fx - i * PITCH, lz = fz - j * PITCH;
    if (lx < ROAD / 2 || lx > ROAD / 2 + BLOCK || lz < ROAD / 2 || lz > ROAD / 2 + BLOCK) return 0;
    return isFlatBlock(i, j) ? 0 : CURB_H;
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
    // property "for sale" boards
    const postMat = this.mats.darkmetal;
    for (const p of PROPERTIES) {
      const poi = POIS.find((x) => x.propertyId === p.id)!;
      const rot = p.side === 's' ? 0 : p.side === 'n' ? Math.PI : p.side === 'e' ? Math.PI / 2 : -Math.PI / 2;
      const inward = { s: [0, -1], n: [0, 1], e: [-1, 0], w: [1, 0] }[p.side];
      const g = new THREE.Group();
      g.position.set(poi.pos.x + inward[0] * 1.2, this.groundAt(poi.pos.x, poi.pos.z), poi.pos.z + inward[1] * 1.2);
      g.rotation.y = rot;
      const board = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshStandardMaterial({ map: this.tex.sign('SOTILADI', '#c8423b', '#fff', 'Ko‘chmas mulk agentligi'), roughness: 0.6 }));
      board.position.y = 2.2;
      for (const x of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.8, 0.08), postMat);
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
    for (let k = 3; k <= 6; k++)
      for (let l = 3; l <= 6; l++) {
        if (!isLightNode(k, l)) continue;
        const nx = roadLine(k), nz = roadLine(l);
        for (let d = 0; d < 4; d++) {
          const [dx, dz] = DIRS[d];
          const [rx, rz] = rightOf(d);
          pts.push({ x: nx - dx * (ROAD / 2 + 1.2) + rx * (ROAD / 2 + 1), z: nz - dz * (ROAD / 2 + 1.2) + rz * (ROAD / 2 + 1), rot: Math.atan2(-dx, -dz), axis: d % 2 });
        }
      }
    const pole = new THREE.CylinderGeometry(0.08, 0.1, 4.4, 6).translate(0, 2.2, 0);
    const box = new THREE.BoxGeometry(0.4, 1.15, 0.3).translate(0, 4.3, 0);
    const poles = new THREE.InstancedMesh(pole, this.mats.darkmetal, pts.length);
    const boxes = new THREE.InstancedMesh(box, this.mats.darkmetal, pts.length);
    const lampGeo = new THREE.SphereGeometry(0.12, 10, 8);
    this.tlMesh = new THREE.InstancedMesh(lampGeo, new THREE.MeshBasicMaterial({ color: '#ffffff' }), pts.length * 3);
    pts.forEach((p, n) => {
      const gy = this.groundAt(p.x, p.z);
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
      tmpObj.position.set(p.pos.x, this.groundAt(p.pos.x, p.pos.z) + 0.04, p.pos.z);
      tmpObj.rotation.set(0, 0, 0);
      tmpObj.scale.setScalar(p.radius * 0.8);
      tmpObj.updateMatrix();
      mesh.setMatrixAt(n, tmpObj.matrix);
    });
    mesh.computeBoundingSphere();
    mesh.renderOrder = 1;
    this.group.add(mesh);
  }

  /** 1520 mm railway with G‘uzor station (junction towards Qarshi, Kitob and Qumqo‘rg‘on) */
  private buildRailway(signs: SignInst[], trees: TreeInst[]) {
    const b = new GeoBuilder();
    const z = RAIL_Z;
    b.box('ballast', 0, -0.3, z, 6400, 0.55, 4.4, [4, 4]);
    for (const dx of [-0.76, 0.76]) b.box('metal', 0, 0.37, z + dx, 6400, 0.15, 0.08);
    // concrete sleepers near town (instanced)
    const sleeper = new THREE.BoxGeometry(0.26, 0.16, 2.7);
    const count = Math.floor(1800 / 0.6);
    const sl = new THREE.InstancedMesh(sleeper, this.mats.concrete, count);
    for (let i = 0; i < count; i++) {
      tmpObj.position.set(-900 + i * 0.6, 0.29, z);
      tmpObj.rotation.set(0, 0, 0);
      tmpObj.scale.setScalar(1);
      tmpObj.updateMatrix();
      sl.setMatrixAt(i, tmpObj.matrix);
    }
    sl.receiveShadow = true;
    sl.computeBoundingSphere();
    this.group.add(sl);
    // platform + station building
    const sx = STATION_X;
    b.box('concrete', sx, -0.3, z + 6, 140, 1.25, 6);
    this.col.addCentered(sx, z + 6, 140, 6, 1.2);
    for (let px = sx - 60; px <= sx + 60; px += 15) {
      b.cyl('metal', px, 0.95, z + 7.6, 0.12, 0.12, 3.4, 8);
      b.box('tin-green', px, 4.35, z + 6.4, 15, 0.12, 4.6);
    }
    b.box('fac-brick', sx, 0, z + 17, 44, 8.5, 12, this.tex.facade('brick').tile);
    b.box('chalk', sx, 8.5, z + 17, 44.6, 0.6, 12.6);
    b.prism('tin-green', sx, 9.1, z + 17, 44.6, 2.4, 12.6);
    b.box('fac-brick', sx, 0, z + 17, 10, 12, 12.4, this.tex.facade('brick').tile);
    b.box('chalk', sx, 12, z + 17, 10.6, 0.6, 12.8);
    this.col.addCentered(sx, z + 17, 44, 12, 9);
    signs.push({ tex: this.tex.sign('G‘UZOR', '#1d3b5c', '#ffffff', 'Temir yo‘l vokzali'), x: sx, y: 9.6, z: z + 23.35, w: 9, h: 2.2, rot: 0 });
    // a passenger train waiting at the platform
    for (let k = 0; k < 6; k++) {
      const cx = sx - 62 + k * 25;
      b.box('train', cx, 1.0, z, 24, 3.3, 3.2);
      b.box('window-band', cx, 2.5, z, 22, 0.9, 3.26);
      b.box('metal', cx, 4.3, z, 23.6, 0.35, 2.9);
      b.box('darkmetal', cx, 0.35, z, 20, 0.65, 2.6);
      this.col.addCentered(cx, z, 24, 3.4, 4);
    }
    // access road from the ring road + forecourt
    const E = HALF + ROAD / 2 + 8;
    b.quad('asphalt', sx - 5, z + 23, sx + 5, -E, 0.005, 'world', 10);
    b.quad('asphalt', sx - 30, z + 23, sx + 30, z + 40, 0.005, 'world', 10);
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
  private visTimer = 0;
  update(dt: number, cam: THREE.Vector3, night: number, wet: number, horizon: THREE.Color, daylight: number) {
    this.visTimer -= dt;
    if (this.visTimer <= 0) {
      this.visTimer = 0.35;
      for (const c of this.chunks) {
        const d = Math.hypot(cam.x - c.x, cam.z - c.z) - 54;
        c.base.visible = d < this.renderDistance;
        c.detail.visible = d < this.lodDistance;
      }
      for (const r of this.regions) {
        r.group.visible = Math.hypot(cam.x - r.x, cam.z - r.z) - 200 < this.renderDistance;
      }
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

  /** district-level info for the minimap */
  static districtColor(i: number, j: number) {
    return districtOf(i, j);
  }
}
