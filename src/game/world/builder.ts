import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const tmpM = new THREE.Matrix4();
const tmpR = new THREE.Matrix4();

function scaleBoxUV(geo: THREE.BufferGeometry, w: number, h: number, d: number, tu: number, tv: number, off: number) {
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  // face order: +x, -x, +y, -y, +z, -z (4 verts each)
  const dims: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [fu, fv] = dims[f];
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * (fu / tu) + off, uv.getY(i) * (fv / tv));
    }
  }
  uv.needsUpdate = true;
}

/**
 * Collects static geometry per material key and merges it into a handful of
 * meshes — the main draw-call optimisation for the city.
 */
export class GeoBuilder {
  private parts = new Map<string, THREE.BufferGeometry[]>();
  base = new THREE.Matrix4();

  add(key: string, geo: THREE.BufferGeometry, m?: THREE.Matrix4) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    if (!g.attributes.uv) {
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((g.attributes.position.count) * 2), 2));
    }
    if (m) g.applyMatrix4(m);
    g.applyMatrix4(this.base);
    let list = this.parts.get(key);
    if (!list) this.parts.set(key, (list = []));
    list.push(g);
  }

  /** box with its BOTTOM at y; optional UV tiling in metres */
  box(key: string, x: number, y: number, z: number, w: number, h: number, d: number, tile?: [number, number] | null, rotY = 0, uvOff = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (tile) scaleBoxUV(g, w, h, d, tile[0], tile[1], uvOff);
    tmpM.makeTranslation(x, y + h / 2, z);
    if (rotY) tmpM.multiply(tmpR.makeRotationY(rotY));
    this.add(key, g, tmpM);
  }

  cyl(key: string, x: number, y: number, z: number, rTop: number, rBot: number, h: number, seg = 12, tile?: [number, number], rotY = 0) {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, false);
    if (tile) {
      const uv = g.attributes.uv as THREE.BufferAttribute;
      const circ = Math.PI * 2 * Math.max(rTop, rBot);
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (circ / tile[0]), uv.getY(i) * (h / tile[1]));
    }
    tmpM.makeTranslation(x, y + h / 2, z);
    if (rotY) tmpM.multiply(tmpR.makeRotationY(rotY));
    this.add(key, g, tmpM);
  }

  /** half sphere dome sitting on y */
  dome(key: string, x: number, y: number, z: number, r: number, stretch = 1, seg = 16, tile?: [number, number]) {
    const g = new THREE.SphereGeometry(r, seg, Math.max(6, seg / 2), 0, Math.PI * 2, 0, Math.PI / 2);
    if (tile) {
      const uv = g.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ((Math.PI * 2 * r) / tile[0]), uv.getY(i) * ((r * 1.5) / tile[1]));
    }
    tmpM.makeTranslation(x, y, z).multiply(tmpR.makeScale(1, stretch, 1));
    this.add(key, g, tmpM);
  }

  sphere(key: string, x: number, y: number, z: number, r: number, sx = 1, sy = 1, sz = 1, detail = 1) {
    const g = new THREE.IcosahedronGeometry(r, detail);
    tmpM.makeTranslation(x, y, z).multiply(tmpR.makeScale(sx, sy, sz));
    this.add(key, g, tmpM);
  }

  cone(key: string, x: number, y: number, z: number, r: number, h: number, seg = 8) {
    const g = new THREE.ConeGeometry(r, h, seg);
    tmpM.makeTranslation(x, y + h / 2, z);
    this.add(key, g, tmpM);
  }

  /** triangular prism roof: ridge along local x */
  prism(key: string, x: number, y: number, z: number, w: number, h: number, d: number, rotY = 0) {
    const s = new THREE.Shape();
    s.moveTo(-d / 2, 0);
    s.lineTo(d / 2, 0);
    s.lineTo(0, h);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
    g.translate(0, 0, -w / 2);
    g.rotateY(Math.PI / 2);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.5, uv.getY(i) * 0.5);
    tmpM.makeTranslation(x, y, z);
    if (rotY) tmpM.multiply(tmpR.makeRotationY(rotY));
    this.add(key, g, tmpM);
  }

  /** flat quad facing up. uv: 'world' tiles in world space, 'z'/'x' = road strips running along that axis */
  quad(key: string, x0: number, z0: number, x1: number, z1: number, y: number, uvMode: 'world' | 'x' | 'z', tile: number) {
    const pos = [x0, y, z0, x0, y, z1, x1, y, z1, x0, y, z0, x1, y, z1, x1, y, z0];
    const uv: number[] = [];
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i], z = pos[i + 2];
      if (uvMode === 'world') uv.push(x / tile, -z / tile);
      else if (uvMode === 'z') uv.push((x - x0) / (x1 - x0), (z - z0) / tile);
      else uv.push((z - z0) / (z1 - z0), (x - x0) / tile);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    this.add(key, g);
  }

  /** vertical plane facing +z (local), bottom at y */
  panel(key: string, x: number, y: number, z: number, w: number, h: number, rotY = 0) {
    const g = new THREE.PlaneGeometry(w, h);
    tmpM.makeTranslation(x, y + h / 2, z);
    if (rotY) tmpM.multiply(tmpR.makeRotationY(rotY));
    this.add(key, g, tmpM);
  }

  get empty() {
    return this.parts.size === 0;
  }

  build(materials: Record<string, THREE.Material>, shadows: { cast: boolean; receive: boolean }, noShadowKeys?: Set<string>): THREE.Group {
    const group = new THREE.Group();
    for (const [key, list] of this.parts) {
      const mat = materials[key];
      if (!mat || list.length === 0) continue;
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      const ns = noShadowKeys?.has(key);
      mesh.castShadow = shadows.cast && !ns;
      mesh.receiveShadow = shadows.receive;
      mesh.matrixAutoUpdate = false;
      mesh.name = key;
      group.add(mesh);
    }
    this.parts.clear();
    return group;
  }
}
