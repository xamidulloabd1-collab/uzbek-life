import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { RNG } from '@/utils/math';

/**
 * Modular facade kit. Buildings keep their textured walls for distant LOD and,
 * inside the detail distance, receive real geometry: framed windows with sills
 * and lintels, glass that lights up at night, panelled doors with canopies and
 * glazed balconies — all instanced, so each module type costs one draw call per chunk.
 */
export type FrameStyle = 'pvc' | 'blue' | 'wood';

export interface FacadeSet {
  frames: Record<FrameStyle, THREE.Matrix4[]>;
  glassDark: THREE.Matrix4[];
  glassLit: THREE.Matrix4[];
  doors: THREE.Matrix4[];
  balconies: { m: THREE.Matrix4; color: THREE.Color }[];
  balconyGlass: THREE.Matrix4[];
}

export const newFacadeSet = (): FacadeSet => ({
  frames: { pvc: [], blue: [], wood: [] },
  glassDark: [],
  glassLit: [],
  doors: [],
  balconies: [],
  balconyGlass: [],
});

/** A wall plane: origin at its bottom-left, u = along the wall, n = outward normal (world space) */
export interface Face {
  ox: number;
  oy: number;
  oz: number;
  ux: number;
  uz: number;
  nx: number;
  nz: number;
  width: number;
}

const M = new THREE.Matrix4();
const X = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3();

function place(face: Face, u: number, y: number, out: number, sx = 1, sy = 1, sz = 1) {
  X.set(face.ux, 0, face.uz);
  Z.set(face.nx, 0, face.nz);
  const m = new THREE.Matrix4().makeBasis(X, Y, Z);
  m.multiply(M.makeScale(sx, sy, sz));
  m.setPosition(face.ox + face.ux * u + face.nx * out, face.oy + y, face.oz + face.uz * u + face.nz * out);
  return m;
}

export interface WindowGrid {
  bay: number;
  floorH: number;
  floors: number;
  winW: number;
  winH: number;
  sill: number;
  style: FrameStyle;
  lit: number;
  balcony?: number;
  /** return true to leave a slot empty (e.g. where a door goes) */
  skip?: (bay: number, floor: number) => boolean;
  /** centre windows inside each bay starting at u = 0 (aligned with facade textures) */
  aligned?: boolean;
}

export function addWindowGrid(set: FacadeSet, face: Face, g: WindowGrid, rng: RNG) {
  const bays = Math.floor(face.width / g.bay + 1e-3);
  if (bays < 1) return;
  const start = g.aligned ? 0 : (face.width - bays * g.bay) / 2;
  const sx = g.winW / 1.6, sy = g.winH / 1.6;
  for (let f = 0; f < g.floors; f++) {
    for (let k = 0; k < bays; k++) {
      if (g.skip?.(k, f)) continue;
      const u = start + (k + 0.5) * g.bay;
      const y = f * g.floorH + g.sill;
      set.frames[g.style].push(place(face, u, y, 0.01, sx, sy, 1));
      (rng() < g.lit ? set.glassLit : set.glassDark).push(place(face, u, y, 0.01, sx, sy, 1));
      if (g.balcony && f > 0 && rng() < g.balcony) {
        const tint = new THREE.Color().setHSL(0.08 + rng() * 0.5, 0.08 + rng() * 0.12, 0.72 + rng() * 0.16);
        set.balconies.push({ m: place(face, u, f * g.floorH, 0, g.bay / 3.2, 1, 1), color: tint });
        set.balconyGlass.push(place(face, u, f * g.floorH, 0, g.bay / 3.2, 1, 1));
      }
    }
  }
}

export function addDoor(set: FacadeSet, face: Face, u: number) {
  set.doors.push(place(face, u, 0, 0.01));
}

// ------------------------------------------------------------------ geometry
const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y, z).toNonIndexed();

function windowFrame() {
  const t = 0.085, d = 0.12;
  return mergeGeometries([
    box(t, 1.6, d, -0.8 + t / 2, 0.8, d / 2),
    box(t, 1.6, d, 0.8 - t / 2, 0.8, d / 2),
    box(1.6, t, d, 0, t / 2, d / 2),
    box(1.6, t, d, 0, 1.6 - t / 2, d / 2),
    box(0.06, 1.6, d * 0.8, 0.05, 0.8, d * 0.4),
    box(0.75, 0.06, d * 0.8, -0.38, 1.12, d * 0.4),
    box(1.86, 0.05, 0.26, 0, -0.03, 0.12), // sill
    box(1.9, 0.14, 0.09, 0, 1.69, 0.045), // lintel
  ])!;
}

function windowGlass() {
  return new THREE.PlaneGeometry(1.5, 1.5).translate(0, 0.8, 0.02);
}

function doorGeo() {
  const parts = [
    box(0.1, 2.4, 0.14, -0.75, 1.2, 0.07),
    box(0.1, 2.4, 0.14, 0.75, 1.2, 0.07),
    box(1.6, 0.12, 0.14, 0, 2.36, 0.07),
    box(0.68, 2.28, 0.06, -0.36, 1.14, 0.03),
    box(0.68, 2.28, 0.06, 0.36, 1.14, 0.03),
  ];
  for (const sx of [-0.36, 0.36]) for (const y of [0.55, 1.25, 1.85]) parts.push(box(0.46, y === 1.25 ? 0.5 : 0.36, 0.03, sx, y, 0.07));
  parts.push(box(2.1, 0.09, 1.0, 0, 2.78, 0.5)); // canopy
  for (const sx of [-0.9, 0.9]) parts.push(box(0.06, 0.06, 0.95, sx, 2.6, 0.48));
  return mergeGeometries(parts)!;
}

function balconyGeo() {
  // glazed loggia typical of Uzbek panel housing; width 3.2 at scale 1
  return mergeGeometries([
    box(3.0, 0.14, 1.1, 0, -0.07, 0.55),
    box(3.0, 0.08, 1.1, 0, 2.62, 0.55),
    box(3.0, 1.0, 0.06, 0, 0.5, 1.07),
    box(0.06, 1.0, 1.06, -1.47, 0.5, 0.55),
    box(0.06, 1.0, 1.06, 1.47, 0.5, 0.55),
    box(0.06, 1.62, 0.06, -1.47, 1.81, 1.07),
    box(0.06, 1.62, 0.06, 1.47, 1.81, 1.07),
    box(0.05, 1.62, 0.05, -0.5, 1.81, 1.07),
    box(0.05, 1.62, 0.05, 0.5, 1.81, 1.07),
    box(3.0, 0.05, 0.08, 0, 1.02, 1.07),
  ])!;
}

function balconyGlassGeo() {
  return mergeGeometries([
    new THREE.PlaneGeometry(2.9, 1.55).translate(0, 1.82, 1.07).toNonIndexed(),
    new THREE.PlaneGeometry(1.0, 1.55).rotateY(Math.PI / 2).translate(1.47, 1.82, 0.55).toNonIndexed(),
    new THREE.PlaneGeometry(1.0, 1.55).rotateY(-Math.PI / 2).translate(-1.47, 1.82, 0.55).toNonIndexed(),
  ])!;
}

export interface FacadeMaterials {
  frames: Record<FrameStyle, THREE.Material>;
  glassDark: THREE.Material;
  glassLit: THREE.MeshStandardMaterial;
  door: THREE.Material;
  balcony: THREE.Material;
  balconyGlass: THREE.Material;
}

let geos: { frame: THREE.BufferGeometry; glass: THREE.BufferGeometry; door: THREE.BufferGeometry; balcony: THREE.BufferGeometry; bglass: THREE.BufferGeometry } | null = null;

export function makeFacadeMaterials(): FacadeMaterials {
  return {
    frames: {
      pvc: new THREE.MeshStandardMaterial({ color: '#ecebe6', roughness: 0.45 }),
      blue: new THREE.MeshStandardMaterial({ color: '#2b679b', roughness: 0.5, metalness: 0.1 }),
      wood: new THREE.MeshStandardMaterial({ color: '#6d4a2c', roughness: 0.7 }),
    },
    glassDark: new THREE.MeshStandardMaterial({ color: '#16222b', roughness: 0.04, metalness: 0.95, envMapIntensity: 1.3 }),
    glassLit: new THREE.MeshStandardMaterial({ color: '#2b2720', roughness: 0.1, metalness: 0.3, emissive: '#ffd59a', emissiveIntensity: 0 }),
    door: new THREE.MeshStandardMaterial({ color: '#7a5233', roughness: 0.62 }),
    balcony: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 }),
    balconyGlass: new THREE.MeshStandardMaterial({ color: '#9db8c6', roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.45, depthWrite: false }),
  };
}

export function buildFacadeMeshes(set: FacadeSet, mats: FacadeMaterials, castShadow: boolean): THREE.Group {
  geos ??= { frame: windowFrame(), glass: windowGlass(), door: doorGeo(), balcony: balconyGeo(), bglass: balconyGlassGeo() };
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, list: THREE.Matrix4[], shadow: boolean, colors?: THREE.Color[]) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((m, i) => im.setMatrixAt(i, m));
    colors?.forEach((c, i) => im.setColorAt(i, c));
    im.castShadow = shadow;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    g.add(im);
  };
  for (const s of ['pvc', 'blue', 'wood'] as FrameStyle[]) add(geos.frame, mats.frames[s], set.frames[s], false);
  add(geos.glass, mats.glassDark, set.glassDark, false);
  add(geos.glass, mats.glassLit, set.glassLit, false);
  add(geos.door, mats.door, set.doors, castShadow);
  add(geos.balcony, mats.balcony, set.balconies.map((b) => b.m), castShadow, set.balconies.map((b) => b.color));
  add(geos.bglass, mats.balconyGlass, set.balconyGlass, false);
  return g;
}
