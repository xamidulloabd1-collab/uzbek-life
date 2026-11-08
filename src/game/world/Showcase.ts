import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { World } from './World';
import type { Slot } from './buildings';

/** The premium Mahalla showcase: the player's home block, where GLB assets replace procedural parts. */
export const SHOWCASE_BLOCK: [number, number] = [1, 1];

export interface ShowcaseAssets {
  houses: GLTF[];
  gates: GLTF[];
  lamps: GLTF[];
  benches: GLTF[];
  trees: GLTF[];
  bushes: GLTF[];
  vehiclesAvailable: boolean;
  rotate: Map<GLTF, number>;
}

export interface ShowcaseReport {
  houses: number;
  gates: number;
  lamps: number;
  trees: number;
  bushes: number;
  benches: number;
  proceduralHousesLeft: number;
}

const M = new THREE.Matrix4();

function bounds(g: GLTF) {
  g.scene.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(g.scene);
}

/** instance every mesh of a GLB at many transforms (one draw call per mesh) */
function instance(g: GLTF, mats: THREE.Matrix4[], shadow: boolean): THREE.Group {
  const out = new THREE.Group();
  if (!mats.length) return out;
  g.scene.updateMatrixWorld(true);
  g.scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || (mesh as THREE.SkinnedMesh).isSkinnedMesh) return;
    const im = new THREE.InstancedMesh(mesh.geometry, mesh.material, mats.length);
    mats.forEach((m, i) => im.setMatrixAt(i, M.multiplyMatrices(m, mesh.matrixWorld)));
    im.castShadow = shadow;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    out.add(im);
  });
  return out;
}

/** model → slot: rotate (+Z front toward street), fit footprint, sit on the ground */
function fitMatrix(box: THREE.Box3, s: Slot, extraRot: number, mode: 'footprint' | 'height', target = 1) {
  const size = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3());
  const quarter = Math.round(extraRot / (Math.PI / 2)) % 2 !== 0;
  const sx = quarter ? size.z : size.x, sz = quarter ? size.x : size.z;
  const k = mode === 'footprint' ? Math.min(s.w / Math.max(0.01, sx), s.d / Math.max(0.01, sz)) : target / Math.max(0.01, size.y);
  return new THREE.Matrix4()
    .makeTranslation(s.x, s.gy, s.z)
    .multiply(new THREE.Matrix4().makeRotationY(s.rot + extraRot))
    .multiply(new THREE.Matrix4().makeScale(k, k, k))
    .multiply(new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z));
}

export class Showcase {
  readonly group = new THREE.Group();
  report: ShowcaseReport = { houses: 0, gates: 0, lamps: 0, trees: 0, bushes: 0, benches: 0, proceduralHousesLeft: 0 };

  constructor(private world: World, private shadows: boolean) {}

  apply(a: ShowcaseAssets) {
    this.group.clear();
    const [i, j] = SHOWCASE_BLOCK;
    const replace = a.houses.length > 0 || a.gates.length > 0 || a.vehiclesAvailable;
    const slots = replace
      ? this.world.rebuildBlock(i, j, { skipHouses: a.houses.length > 0, skipGates: a.gates.length > 0, skipParked: a.vehiclesAvailable })
      : this.world.slotsOf(i, j);
    const rot = (g: GLTF) => a.rotate.get(g) ?? 0;
    const place = (list: GLTF[], targets: Slot[], mode: 'footprint' | 'height', height = 1) => {
      if (!list.length) return 0;
      const per = new Map<GLTF, THREE.Matrix4[]>();
      targets.forEach((s, n) => {
        const g = list[n % list.length];
        if (!per.has(g)) per.set(g, []);
        per.get(g)!.push(fitMatrix(bounds(g), s, rot(g), mode, height));
      });
      for (const [g, mats] of per) this.group.add(instance(g, mats, this.shadows));
      return targets.length;
    };
    this.report.houses = place(a.houses, slots.houses, 'footprint');
    this.report.gates = place(a.gates, slots.gates, 'footprint');
    this.report.proceduralHousesLeft = a.houses.length ? 0 : slots.houses.length;

    void i;
    void j;
    const r = this.world.homeRect();
    const pad = 8;
    const asSlot = (p: { x: number; z: number; rot: number }): Slot => ({ x: p.x, z: p.z, rot: p.rot, w: 1, d: 1, gy: 0.15 });
    if (a.trees.length) {
      const hidden = this.world.hideProps(r.x0 - pad, r.z0 - pad, r.x1 + pad, r.z1 + pad, ['chinor', 'terak', 'fruit', 'pine']);
      const byHeight = (k: string) => (k === 'terak' ? 11 : k === 'fruit' ? 4.6 : k === 'pine' ? 8 : 10);
      this.report.trees = 0;
      for (const h of [4.6, 8, 10, 11]) {
        const group = hidden.filter((p) => byHeight(p.kind) === h);
        this.report.trees += place(a.trees, group.map(asSlot), 'height', h);
      }
    }
    if (a.bushes.length) {
      const hidden = this.world.hideProps(r.x0 - pad, r.z0 - pad, r.x1 + pad, r.z1 + pad, ['bush']);
      this.report.bushes = place(a.bushes, hidden.map(asSlot), 'height', 1.4);
    }
    if (a.lamps.length) {
      const hidden = this.world.hideProps(r.x0 - pad, r.z0 - pad, r.x1 + pad, r.z1 + pad, ['lamp']);
      this.report.lamps = place(a.lamps, hidden.map((p) => ({ ...asSlot(p), rot: p.rot })), 'height', 7.2);
    }
    if (a.benches.length) {
      const pts: Slot[] = [];
      for (let t = 0.2; t < 0.85; t += 0.22) pts.push({ x: r.x1 - 76 * t, z: r.z1 - 1.4, rot: 0, w: 1, d: 1, gy: 0.15 });
      this.report.benches = place(a.benches, pts, 'height', 0.9);
    }
    return this.report;
  }
}
