import * as THREE from 'three';
import type { Side } from '@/types';
import type { GeoBuilder } from './builder';
import type { CollisionWorld } from '@/game/physics/collision';
import type { TextureLib } from './textures';
import { BLOCK, type Rect, propertyAt, specialAt, districtOf, RIVER, RIVER_ROW } from './cityLayout';
import { VEHICLES, TRAFFIC_COLORS } from '@/config/vehicles';
import { lowGeometry } from '@/game/vehicles/vehicleModel';
import { pick, rand, randInt, type RNG } from '@/utils/math';
import { addDoor, addWindowGrid, type Face, type FacadeSet, type FrameStyle } from './facadeKit';

export type TreeType = 'chinor' | 'terak' | 'fruit' | 'pine' | 'bush' | 'grass';
export interface TreeInst { type: TreeType; x: number; z: number; s: number }
export interface LampInst { x: number; z: number; rot: number; tall?: boolean }
export interface SignInst { tex: THREE.Texture; x: number; y: number; z: number; w: number; h: number; rot: number }

interface Frame { ox: number; oz: number; rot: number }

/** placement slot for an external GLB asset (world space; rot = yaw that turns a +Z-facing model toward the street) */
export interface Slot { x: number; z: number; rot: number; w: number; d: number; gy: number }

export interface ParkedInst { x: number; z: number; rot: number; specId: string; color: string; gy: number; colId: number; display: boolean }

export interface BlockOptions { skipHouses?: boolean; skipGates?: boolean; skipParked?: boolean }

export interface BlockCtx {
  b: GeoBuilder;
  d: GeoBuilder;
  col: CollisionWorld;
  rng: RNG;
  tex: TextureLib;
  i: number;
  j: number;
  r: Rect;
  gy: number;
  trees: TreeInst[];
  lamps: LampInst[];
  signs: SignInst[];
  frame: Frame;
  facade: FacadeSet;
  opts: BlockOptions;
  slots: { houses: Slot[]; gates: Slot[] };
  parked: ParkedInst[];
}

const M = new THREE.Matrix4();
const MR = new THREE.Matrix4();

export function sideFrame(r: Rect, side: Side | 'c'): Frame {
  switch (side) {
    case 'n':
    case 'c':
      return { ox: r.x0, oz: r.z0, rot: 0 };
    case 's':
      return { ox: r.x1, oz: r.z1, rot: Math.PI };
    case 'w':
      return { ox: r.x0, oz: r.z1, rot: Math.PI / 2 };
    case 'e':
      return { ox: r.x1, oz: r.z0, rot: -Math.PI / 2 };
  }
}

export function setFrame(ctx: BlockCtx, f: Frame) {
  ctx.frame = f;
  M.makeTranslation(f.ox, 0, f.oz).multiply(MR.makeRotationY(f.rot));
  ctx.b.base.copy(M);
  ctx.d.base.copy(M);
}

function W(ctx: BlockCtx, lx: number, lz: number) {
  const { ox, oz, rot } = ctx.frame;
  const c = Math.round(Math.cos(rot)), s = Math.round(Math.sin(rot));
  return { x: ox + lx * c + lz * s, z: oz - lx * s + lz * c };
}

function col(ctx: BlockCtx, lx: number, lz: number, w: number, d: number, h: number) {
  const p = W(ctx, lx, lz);
  const swap = Math.abs(Math.sin(ctx.frame.rot)) > 0.5;
  ctx.col.addCentered(p.x, p.z, swap ? d : w, swap ? w : d, h);
}

/** wall face of a box in the current frame → world-space Face for the facade kit */
function face(ctx: BlockCtx, lx: number, lz: number, ux: number, uz: number, nx: number, nz: number, width: number, oy: number): Face {
  const p = W(ctx, lx, lz);
  const c = Math.round(Math.cos(ctx.frame.rot)), s = Math.round(Math.sin(ctx.frame.rot));
  const r = (x: number, z: number) => [x * c + z * s, -x * s + z * c];
  const [wux, wuz] = r(ux, uz);
  const [wnx, wnz] = r(nx, nz);
  return { ox: p.x, oy, oz: p.z, ux: wux, uz: wuz, nx: wnx, nz: wnz, width };
}

/** the four faces of a box (same u directions as BoxGeometry UVs, so windows line up with facade textures) */
function boxFaces(ctx: BlockCtx, lx: number, lz: number, w: number, d: number, oy: number) {
  return {
    pz: face(ctx, lx - w / 2, lz + d / 2, 1, 0, 0, 1, w, oy),
    nz: face(ctx, lx + w / 2, lz - d / 2, -1, 0, 0, -1, w, oy),
    px: face(ctx, lx + w / 2, lz + d / 2, 0, -1, 1, 0, d, oy),
    nx: face(ctx, lx - w / 2, lz - d / 2, 0, 1, -1, 0, d, oy),
  };
}

function scatter(ctx: BlockCtx, type: TreeType, x0: number, z0: number, x1: number, z1: number, n: number, s = 1) {
  for (let k = 0; k < n; k++) tree(ctx, rand(ctx.rng, x0, x1), rand(ctx.rng, z0, z1), type, s);
}

function tree(ctx: BlockCtx, lx: number, lz: number, type: TreeType, s = 1) {
  const p = W(ctx, lx, lz);
  ctx.trees.push({ type, x: p.x, z: p.z, s: s * rand(ctx.rng, 0.8, 1.2) });
}

function lamp(ctx: BlockCtx, lx: number, lz: number) {
  const p = W(ctx, lx, lz);
  ctx.lamps.push({ x: p.x, z: p.z, rot: ctx.frame.rot + Math.PI });
}

function sign(ctx: BlockCtx, tex: THREE.Texture, lx: number, y: number, lz: number, w: number, h: number) {
  const p = W(ctx, lx, lz);
  // signs face the street (local -z)
  ctx.signs.push({ tex, x: p.x, y, z: p.z, w, h, rot: ctx.frame.rot + Math.PI });
}

function slot(ctx: BlockCtx, lx: number, lz: number, w: number, d: number): Slot {
  const p = W(ctx, lx, lz);
  return { x: p.x, z: p.z, rot: ctx.frame.rot + Math.PI, w, d, gy: ctx.gy };
}

function parkedCar(ctx: BlockCtx, lx: number, lz: number, rot: number, specId?: string, display = false) {
  if (ctx.opts.skipParked) return;
  {
    const spec = specId ? VEHICLES.find((v) => v.id === specId)! : pick(ctx.rng, VEHICLES);
    const color = pick(ctx.rng, TRAFFIC_COLORS);
    const p = W(ctx, lx, lz);
    const along = Math.abs(Math.sin(rot)) > 0.5;
    const lw = along ? spec.dims.length : spec.dims.width, ld = along ? spec.dims.width : spec.dims.length;
    const swap = Math.abs(Math.sin(ctx.frame.rot)) > 0.5;
    const colId = ctx.col.addCentered(p.x, p.z, swap ? ld : lw, swap ? lw : ld, 1.4);
    ctx.parked.push({ x: p.x, z: p.z, rot: ctx.frame.rot + rot, specId: spec.id, color, gy: ctx.gy, colId, display });
    return;
  }
  const spec = specId ? VEHICLES.find((v) => v.id === specId)! : pick(ctx.rng, VEHICLES);
  const g = lowGeometry(spec);
  const color = pick(ctx.rng, TRAFFIC_COLORS);
  M.makeTranslation(lx, ctx.gy, lz).multiply(MR.makeRotationY(rot));
  ctx.d.add(`car-${color}`, g.body.clone(), M);
  ctx.d.add('car-glass', g.glass.clone(), M);
  ctx.d.add('car-dark', g.dark.clone(), M);
  ctx.d.add('car-lights', g.lights.clone(), M);
  col(ctx, lx, lz, Math.abs(Math.sin(rot)) > 0.5 ? spec.dims.length : spec.dims.width, Math.abs(Math.sin(rot)) > 0.5 ? spec.dims.width : spec.dims.length, 1.4);
}

function rooftop(ctx: BlockCtx, lx: number, lz: number, w: number, d: number, y: number) {
  const n = randInt(ctx.rng, 1, 4);
  for (let k = 0; k < n; k++) {
    ctx.d.box('metal', lx + rand(ctx.rng, -w / 3, w / 3), y, lz + rand(ctx.rng, -d / 3, d / 3), 1.4, 1, 1.1);
  }
  if (ctx.rng() < 0.5) ctx.d.cyl('metal', lx + w / 4, y, lz - d / 4, 1, 1, 1.8, 10);
  if (ctx.rng() < 0.4) ctx.d.box('concrete', lx - w / 4, y, lz + d / 5, 3, 2.6, 3);
}

/** generic building with facade texture, cornice and optional shop ground floor */
function building(ctx: BlockCtx, lx: number, lz: number, w: number, d: number, h: number, kind: Parameters<TextureLib['facade']>[0], shop = false, roofKey = 'roof', entrances?: 'pz' | 'nz') {
  const gy = ctx.gy;
  const off = Math.floor(ctx.rng() * 4) * 0.25;
  const sh = shop ? 4.2 : 0;
  if (shop) ctx.b.box('fac-shop', lx, gy, lz, w, sh, d, ctx.tex.facade('shop').tile, 0, off);
  ctx.b.box(`fac-${kind}`, lx, gy + sh, lz, w, h - sh, d, ctx.tex.facade(kind).tile, 0, off);
  ctx.b.box(roofKey, lx, gy + h, lz, w + 0.4, 0.5, d + 0.4, [4, 4]);
  if (shop) ctx.d.box('concrete', lx, gy + sh, lz, w + 0.6, 0.25, d + 0.6);
  if (h > 9) rooftop(ctx, lx, lz, w, d, gy + h + 0.5);
  col(ctx, lx, lz, w, d, h);
  if (kind === 'panel' || kind === 'modern') {
    const floors = Math.floor((h - sh) / 3.2 + 1e-3);
    const faces = boxFaces(ctx, lx, lz, w, d, gy + sh);
    for (const [key, f] of Object.entries(faces) as [keyof typeof faces, Face][]) {
      const doorFace = entrances === key && !shop;
      const doorBay = (k: number) => doorFace && k % 5 === 2;
      addWindowGrid(ctx.facade, f, {
        bay: 3.2, floorH: 3.2, floors, winW: 1.8, winH: 1.6, sill: 0.9, style: 'pvc', lit: 0.35, aligned: true,
        balcony: kind === 'panel' && f.width > 20 ? 0.26 : 0,
        skip: (k, fl) => fl === 0 && doorBay(k),
      }, ctx.rng);
      if (doorFace) for (let k = 2; (k + 1) * 3.2 <= f.width; k += 5) addDoor(ctx.facade, f, (k + 0.5) * 3.2);
    }
  }
}

// ---------------------------------------------------------------- ground
export function blockGround(ctx: BlockCtx, inner: string, kind: 'curb' | 'flat', aryk = false) {
  const { r, b } = ctx;
  setFrame(ctx, sideFrame(r, 'c'));
  b.base.identity();
  if (kind === 'flat') {
    b.quad(inner, r.x0, r.z0, r.x1, r.z1, 0.012, 'world', inner === 'plaza' ? 6 : 8);
    return;
  }
  const h = 0.15;
  const SW = 4;
  // curbs
  b.box('curb', r.cx, 0, r.z0 + 0.15, BLOCK, h + 0.01, 0.3);
  b.box('curb', r.cx, 0, r.z1 - 0.15, BLOCK, h + 0.01, 0.3);
  b.box('curb', r.x0 + 0.15, 0, r.cz, 0.3, h + 0.01, BLOCK - 0.6);
  b.box('curb', r.x1 - 0.15, 0, r.cz, 0.3, h + 0.01, BLOCK - 0.6);
  // sidewalks
  b.quad('pavers', r.x0 + 0.3, r.z0 + 0.3, r.x1 - 0.3, r.z0 + SW, h, 'world', 2.4);
  b.quad('pavers', r.x0 + 0.3, r.z1 - SW, r.x1 - 0.3, r.z1 - 0.3, h, 'world', 2.4);
  b.quad('pavers', r.x0 + 0.3, r.z0 + SW, r.x0 + SW, r.z1 - SW, h, 'world', 2.4);
  b.quad('pavers', r.x1 - SW, r.z0 + SW, r.x1 - 0.3, r.z1 - SW, h, 'world', 2.4);
  b.quad(inner, r.x0 + SW, r.z0 + SW, r.x1 - SW, r.z1 - SW, h, 'world', inner === 'plaza' ? 6 : 8);
  if (aryk) {
    // irrigation channels (aryk) along the street, typical of mahalla streets
    const a0 = 2.7, a1 = 3.4;
    b.quad('water', r.x0 + a0, r.z0 + a0, r.x1 - a0, r.z0 + a1, h - 0.08, 'world', 4);
    b.quad('water', r.x0 + a0, r.z1 - a1, r.x1 - a0, r.z1 - a0, h - 0.08, 'world', 4);
    b.quad('water', r.x0 + a0, r.z0 + a1, r.x0 + a1, r.z1 - a1, h - 0.08, 'world', 4);
    b.quad('water', r.x1 - a1, r.z0 + a1, r.x1 - a0, r.z1 - a1, h - 0.08, 'world', 4);
    // concrete channel lips
    for (const a of [a0, a1]) {
      b.box('curb', r.cx, h - 0.1, r.z0 + a, BLOCK - a * 2, 0.14, 0.12);
      b.box('curb', r.cx, h - 0.1, r.z1 - a, BLOCK - a * 2, 0.14, 0.12);
      b.box('curb', r.x0 + a, h - 0.1, r.cz, 0.12, 0.14, BLOCK - a * 2);
      b.box('curb', r.x1 - a, h - 0.1, r.cz, 0.12, 0.14, BLOCK - a * 2);
    }
  }
}

/** lamps + street trees on each side */
function streetFurniture(ctx: BlockCtx, treeType: TreeType | null, lampEvery = 26, treeEvery = 13, treeLz = 2.4) {
  for (const side of ['n', 's', 'e', 'w'] as Side[]) {
    setFrame(ctx, sideFrame(ctx.r, side));
    for (let lx = 8; lx < BLOCK - 4; lx += lampEvery) lamp(ctx, lx, 0.8);
    if (treeType) for (let lx = 6 + treeEvery / 2; lx < BLOCK - 5; lx += treeEvery) if (ctx.rng() < 0.9) tree(ctx, lx, treeLz, treeType);
  }
}

// ---------------------------------------------------------------- downtown
function downtown(ctx: BlockCtx, reserveSouth: boolean) {
  blockGround(ctx, 'asphalt', 'curb');
  streetFurniture(ctx, 'chinor', 22, 11);
  setFrame(ctx, sideFrame(ctx.r, 'c'));
  const quads: [number, number][] = reserveSouth ? [[21, 21], [55, 21]] : [[21, 21], [55, 21], [21, 55], [55, 55]];
  if (!reserveSouth && ctx.rng() < 0.25) {
    // shopping mall spanning the south half
    building(ctx, 38, 56, 62, 26, rand(ctx.rng, 12, 16), 'office', true);
    quads.splice(2, 2);
  }
  for (const [qx, qz] of quads) {
    const roll = ctx.rng();
    if (roll < 0.38) {
      const w = rand(ctx.rng, 17, 24), d = rand(ctx.rng, 17, 24);
      building(ctx, qx, qz, w, d, rand(ctx.rng, 38, 92), 'glass', true);
    } else if (roll < 0.78) {
      const w = rand(ctx.rng, 22, 28), d = rand(ctx.rng, 18, 26);
      building(ctx, qx, qz, w, d, rand(ctx.rng, 18, 40), 'office', true);
    } else if (roll < 0.9) {
      building(ctx, qx, qz, 26, 14, rand(ctx.rng, 14, 22), 'modern', true);
      parkedCar(ctx, qx - 8, qz + 11, Math.PI / 2);
      parkedCar(ctx, qx - 4, qz + 11, Math.PI / 2);
      parkedCar(ctx, qx + 4, qz + 11, Math.PI / 2);
    } else {
      // surface parking with trees
      for (let k = 0; k < 6; k++) parkedCar(ctx, qx - 11 + k * 4.4, qz - 4, 0);
      for (let k = 0; k < 6; k++) if (ctx.rng() < 0.7) parkedCar(ctx, qx - 11 + k * 4.4, qz + 6, Math.PI);
      tree(ctx, qx - 13, qz + 12, 'chinor');
      tree(ctx, qx + 13, qz + 12, 'chinor');
    }
  }
}

function downtownSpecial(ctx: BlockCtx, kind: string) {
  downtown(ctx, true);
  setFrame(ctx, sideFrame(ctx.r, 's'));
  // local frame: street at lz=0, building fronts at lz≈6
  const T = ctx.tex;
  if (kind === 'bank') {
    building(ctx, 38, 15, 40, 18, 34, 'glass', false);
    ctx.b.box('chalk', 38, ctx.gy, 5.6, 14, 6, 0.6);
    sign(ctx, T.sign('BANK', '#1b4f8a', '#fff', 'G‘uzor milliy banki'), 38, 7.4, 5.4, 10, 2.5);
  } else if (kind === 'jobs') {
    building(ctx, 38, 15, 42, 18, 18, 'office', false);
    sign(ctx, T.sign('MEHNAT BIRJASI', '#2f6b3f', '#fff', 'Ish o‘rinlari markazi'), 38, 5.5, 5.4, 12, 3);
  } else if (kind === 'realty') {
    building(ctx, 38, 15, 40, 18, 16, 'modern', false);
    sign(ctx, T.sign('KO‘CHMAS MULK', '#5a3f8c', '#fff', 'Uy va tijorat binolari'), 38, 5.5, 5.4, 12, 3);
  } else if (kind === 'osh') {
    building(ctx, 38, 14, 34, 16, 7, 'brick', false, 'chalk');
    ctx.b.cyl('chalk', 38, ctx.gy + 7.5, 14, 4.2, 4.2, 1.5, 20);
    ctx.b.dome('dome', 38, ctx.gy + 9, 14, 4.2, 1.1, 18, [2, 2]);
    // giant kazan + tapchans on the terrace
    ctx.d.cyl('darkmetal', 24, ctx.gy, 4.8, 1.3, 0.9, 1.1, 16);
    ctx.d.box('brick', 24, ctx.gy, 4.8, 3.2, 0.5, 3.2);
    for (const x of [44, 50]) {
      ctx.d.box('wood', x, ctx.gy, 4, 3, 0.55, 2.2);
      ctx.d.box('red', x, ctx.gy + 0.55, 4, 2.8, 0.06, 2);
    }
    sign(ctx, T.sign('OSH MARKAZI', '#a33a2c', '#fff', 'Haqiqiy to‘y oshi'), 38, 5.2, 5.6, 12, 3);
  }
}

// ---------------------------------------------------------------- landmark plaza
function plaza(ctx: BlockCtx) {
  blockGround(ctx, 'plaza', 'curb');
  streetFurniture(ctx, null, 19);
  setFrame(ctx, sideFrame(ctx.r, 'c'));
  const b = ctx.b, d = ctx.d, gy = ctx.gy;
  const cx = 38;
  // main hall with tiled dome
  b.box('fac-brick', cx, gy, 28, 22, 13, 20, ctx.tex.facade('brick').tile);
  b.box('chalk', cx, gy + 13, 28, 22.6, 0.6, 20.6);
  b.cyl('majolica', cx, gy + 13.6, 28, 7, 7, 4, 24, [4, 4]);
  b.dome('dome', cx, gy + 17.6, 28, 7.2, 1.35, 24, [2.2, 2.2]);
  b.cyl('gold', cx, gy + 27.2, 28, 0.15, 0.25, 2.2, 8);
  col(ctx, cx, 28, 22, 20, 30);
  // side wings with small domes
  for (const sx of [-1, 1]) {
    b.box('fac-brick', cx + sx * 19, gy, 30, 16, 8, 16, ctx.tex.facade('brick').tile);
    b.box('chalk', cx + sx * 19, gy + 8, 30, 16.4, 0.4, 16.4);
    b.dome('dome', cx + sx * 19, gy + 8.4, 30, 3.6, 1.2, 16, [2, 2]);
    col(ctx, cx + sx * 19, 30, 16, 16, 8);
  }
  // pishtaq portal facing south (+z)
  b.box('majolica', cx, gy, 41, 18, 21, 4, [5, 5]);
  b.box('chalk', cx, gy + 21, 41, 18.6, 0.8, 4.4);
  const arch = (r: number, h: number, z: number, key: string) => {
    b.box(key, cx, gy, z, r * 2, h, 0.16);
    const g = new THREE.CylinderGeometry(r, r, 0.16, 20, 1, false, -Math.PI / 2, Math.PI);
    g.rotateX(-Math.PI / 2);
    M.makeTranslation(cx, gy + h, z);
    b.add(key, g, M);
  };
  arch(4.8, 12, 43.05, 'gold');
  arch(4.2, 12, 43.15, 'lapis');
  col(ctx, cx, 41, 18, 4, 21);
  // minarets
  for (const sx of [-1, 1]) {
    const mx = cx + sx * 10.5;
    b.cyl('chalk', mx, gy, 42, 1.7, 1.8, 1.5, 16);
    b.cyl('majolica', mx, gy + 1.5, 42, 1.15, 1.45, 30, 16, [4.5, 4.5]);
    b.cyl('chalk', mx, gy + 31.5, 42, 1.7, 1.2, 1.2, 16);
    b.cyl('brick', mx, gy + 32.7, 42, 1.4, 1.4, 2.4, 16);
    b.dome('dome', mx, gy + 35.1, 42, 1.4, 1.3, 14, [1.5, 1.5]);
    col(ctx, mx, 42, 3.4, 3.4, 36);
  }
  // fountain + benches + gardens
  d.cyl('chalk', cx, gy, 60, 5.5, 5.8, 0.7, 28);
  d.cyl('water', cx, gy + 0.55, 60, 5.0, 5.0, 0.2, 28);
  d.cyl('chalk', cx, gy, 60, 0.8, 1, 2.6, 12);
  d.cyl('water', cx, gy + 2.6, 60, 1.6, 0.2, 0.3, 14);
  col(ctx, cx, 60, 11, 11, 0.8);
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      d.box('wood', cx + sx * 9, gy, 54 + k * 6, 0.6, 0.45, 2);
      d.box('foliage', cx + sx * 20, gy, 52 + k * 7, 8, 0.25, 4);
      scatter(ctx, 'bush', cx + sx * 20 - 3.5, 50.5 + k * 7, cx + sx * 20 + 3.5, 53.5 + k * 7, 5, 0.7);
      tree(ctx, cx + sx * 27, 50 + k * 8, 'chinor', 1.1);
    }
    tree(ctx, cx + sx * 31, 12, 'pine');
    tree(ctx, cx + sx * 31, 24, 'pine');
  }
}

// ---------------------------------------------------------------- apartments (panel blocks)
function panelBlock(ctx: BlockCtx, lx: number, lz: number, w: number, d: number, floors: number, kind: 'panel' | 'modern', shop: boolean, mosaicEnds: boolean) {
  const h = floors * 3.2;
  building(ctx, lx, lz, w, d, h, kind, shop, 'roof', lz < 38 ? 'pz' : 'nz');
  if (mosaicEnds && w > d) {
    const tex = 'mosaic-' + (ctx.i + ctx.j) % 3;
    for (const sx of [-1, 1]) {
      M.makeTranslation(lx + sx * (w / 2 + 0.06), ctx.gy + h * 0.5, lz).multiply(MR.makeRotationY(sx * Math.PI / 2));
      ctx.b.add(tex, new THREE.PlaneGeometry(Math.min(d - 2, 9), h * 0.7), M);
    }
  }
}

function apartments(ctx: BlockCtx) {
  blockGround(ctx, 'grass', 'curb');
  streetFurniture(ctx, 'chinor', 26, 13);
  setFrame(ctx, sideFrame(ctx.r, 'c'));
  const prop = propertyAt(ctx.i, ctx.j);
  const modern = prop?.id === 'apt-yangi';
  const f5 = 5;
  panelBlock(ctx, 38, 13, 58, 12, modern ? 12 : f5, modern ? 'modern' : 'panel', true, !modern);
  panelBlock(ctx, 38, 63, 58, 12, f5, 'panel', true, true);
  panelBlock(ctx, 13, 38, 12, 26, 9, 'panel', false, false);
  panelBlock(ctx, 63, 38, 12, 26, ctx.rng() < 0.5 ? 9 : 5, 'panel', false, false);
  // courtyard: driveway, parked cars, playground
  ctx.b.quad('asphalt', ctx.r.x0 + 22, ctx.r.z0 + 22, ctx.r.x0 + 54, ctx.r.z0 + 27, ctx.gy + 0.01, 'world', 8);
  for (let k = 0; k < 6; k++) if (ctx.rng() < 0.75) parkedCar(ctx, 24 + k * 4.8, 29, Math.PI);
  ctx.d.box('red', 32, ctx.gy, 44, 3, 0.4, 3);
  ctx.d.box('yellow', 38, ctx.gy, 46, 0.2, 2.6, 0.2);
  ctx.d.box('yellow', 41, ctx.gy, 46, 0.2, 2.6, 0.2);
  ctx.d.box('metal', 39.5, ctx.gy + 2.5, 46, 3.4, 0.15, 0.15);
  ctx.d.box('green-paint', 45, ctx.gy, 43, 2.2, 1.2, 4);
  for (let k = 0; k < 4; k++) ctx.d.box('wood', 26 + k * 7, ctx.gy, 50, 2, 0.45, 0.6);
  tree(ctx, 28, 40, 'chinor');
  tree(ctx, 50, 52, 'chinor');
  scatter(ctx, 'grass', 24, 32, 52, 54, 70);
  scatter(ctx, 'bush', 22, 31, 54, 33, 9);
  for (let x = 12; x < 66; x += 4) tree(ctx, x, 21, 'bush', 0.8);
  tree(ctx, 30, 54, 'fruit');
  tree(ctx, 48, 36, 'pine');
}

function park(ctx: BlockCtx) {
  blockGround(ctx, 'grass', 'curb');
  streetFurniture(ctx, null, 22);
  setFrame(ctx, sideFrame(ctx.r, 'c'));
  const gy = ctx.gy;
  ctx.b.quad('pavers', ctx.r.x0 + 35, ctx.r.z0 + 4, ctx.r.x0 + 41, ctx.r.z1 - 4, gy + 0.01, 'world', 2.4);
  ctx.b.quad('pavers', ctx.r.x0 + 4, ctx.r.z0 + 35, ctx.r.x1 - 4, ctx.r.z0 + 41, gy + 0.01, 'world', 2.4);
  // pond
  ctx.b.cyl('chalk', 20, gy - 0.1, 20, 9.5, 9.5, 0.35, 28);
  ctx.b.cyl('water', 20, gy - 0.05, 20, 9, 9, 0.35, 28);
  col(ctx, 20, 20, 18, 18, 0.4);
  // choyxona pavilion (ayvon) with tapchans
  const px = 56, pz = 56;
  for (const [x, z] of [[-6, -4], [6, -4], [-6, 4], [6, 4]]) ctx.b.cyl('wood', px + x, gy, pz + z, 0.22, 0.25, 3.6, 8);
  ctx.b.box('tin-green', px, gy + 3.6, pz, 14, 0.3, 10);
  ctx.b.prism('tin-green', px, gy + 3.9, pz, 14, 1.4, 10);
  for (const x of [-3.5, 3.5]) {
    ctx.d.box('wood', px + x, gy, pz, 3, 0.55, 3.6);
    ctx.d.box('red', px + x, gy + 0.55, pz, 2.8, 0.06, 3.4);
    ctx.d.box('wood', px + x, gy + 0.6, pz, 1, 0.3, 1);
  }
  col(ctx, px, pz, 14, 10, 0.6);
  // monument
  ctx.b.box('chalk', 38, gy, 38, 3, 1.2, 3);
  ctx.b.box('concrete', 38, gy + 1.2, 38, 1.2, 7, 1.2);
  ctx.b.sphere('gold', 38, gy + 9, 38, 0.9, 1, 1, 1, 1);
  col(ctx, 38, 38, 3, 3, 9);
  for (let n = 0; n < 26; n++) {
    const x = rand(ctx.rng, 8, 68), z = rand(ctx.rng, 8, 68);
    if (Math.abs(x - 38) < 5 || Math.abs(z - 38) < 5 || Math.hypot(x - 20, z - 20) < 12 || Math.hypot(x - 56, z - 56) < 10) continue;
    tree(ctx, x, z, ctx.rng() < 0.7 ? 'chinor' : 'pine', 1.1);
  }
  for (let k = 0; k < 6; k++) ctx.d.box('wood', 30 + (k % 2) * 16, gy, 12 + k * 9, 0.6, 0.45, 2);
  scatter(ctx, 'grass', 6, 6, 70, 70, 160);
  scatter(ctx, 'bush', 6, 6, 70, 70, 26);
}

function school(ctx: BlockCtx) {
  blockGround(ctx, 'grass', 'curb');
  streetFurniture(ctx, 'chinor', 26, 13);
  setFrame(ctx, sideFrame(ctx.r, 's'));
  building(ctx, 38, 18, 46, 13, 10, 'panel', false);
  building(ctx, 12, 32, 13, 26, 10, 'panel', false);
  setFrame(ctx, sideFrame(ctx.r, 'c'));
  const r = ctx.r;
  ctx.b.quad('sport', r.x0 + 30, r.z0 + 8, r.x0 + 70, r.z0 + 36, ctx.gy + 0.02, 'world', 40);
  for (const x of [31, 69]) {
    ctx.d.box('white', x, ctx.gy, 22, 0.15, 2.4, 0.15);
    ctx.d.box('white', x, ctx.gy + 2.4, 22, 0.15, 0.15, 7.3);
  }
  setFrame(ctx, sideFrame(ctx.r, 's'));
  sign(ctx, ctx.tex.sign('7-MAKTAB', '#1d6b8f', '#fff', 'Umumta’lim maktabi'), 38, 6, 11.4, 9, 2.2);
}

// ---------------------------------------------------------------- mahalla
function houseLot(ctx: BlockCtx, lx0: number, w: number, depth: number, closeRight: boolean, big = false) {
  const gy = ctx.gy;
  const rng = ctx.rng;
  const wallKey = pick(rng, ['plaster', 'plaster2', 'plaster']);
  const wallZ = 4.7;
  const gateW = 3.4;
  const gx = lx0 + rand(rng, 1.2, Math.max(1.3, w - gateW - 1.2));
  // street wall with gate
  const segL = gx - lx0;
  const segR = lx0 + w - (gx + gateW);
  if (segL > 0.1) {
    ctx.b.box(wallKey, lx0 + segL / 2, gy, wallZ, segL, 2.5, 0.3, [4, 2.5]);
    col(ctx, lx0 + segL / 2, wallZ, segL, 0.3, 2.5);
  }
  if (segR > 0.1) {
    ctx.b.box(wallKey, gx + gateW + segR / 2, gy, wallZ, segR, 2.5, 0.3, [4, 2.5]);
    col(ctx, gx + gateW + segR / 2, wallZ, segR, 0.3, 2.5);
  }
  const gateKey = pick(rng, ['gate-blue', 'gate-green', 'gate-blue', 'gate-brown']);
  col(ctx, gx + gateW / 2, wallZ, gateW, 0.3, 2.4);
  ctx.slots.gates.push(slot(ctx, gx + gateW / 2, wallZ, gateW + 1, 0.8));
  if (!ctx.opts.skipGates) {
    ctx.b.box(gateKey, gx + gateW / 2, gy, wallZ, gateW, 2.35, 0.1);
    ctx.d.box('brick', gx - 0.25, gy, wallZ, 0.5, 2.9, 0.5);
    ctx.d.box('brick', gx + gateW + 0.25, gy, wallZ, 0.5, 2.9, 0.5);
    ctx.d.box('tin-green', gx + gateW / 2, gy + 2.9, wallZ - 0.2, gateW + 1.4, 0.12, 1.2);
  }
  // side + back walls
  ctx.b.box(wallKey, lx0, gy, (wallZ + depth) / 2, 0.3, 2.4, depth - wallZ, [4, 2.4]);
  col(ctx, lx0, (wallZ + depth) / 2, 0.3, depth - wallZ, 2.4);
  if (closeRight) {
    ctx.b.box(wallKey, lx0 + w, gy, (wallZ + depth) / 2, 0.3, 2.4, depth - wallZ, [4, 2.4]);
    col(ctx, lx0 + w, (wallZ + depth) / 2, 0.3, depth - wallZ, 2.4);
  }
  ctx.b.box(wallKey, lx0 + w / 2, gy, depth, w, 2.4, 0.3, [4, 2.4]);
  // house at the back of the courtyard
  const hd = big ? 11 : rand(rng, 8, 10);
  const hw = w - 1.6;
  const floors = big ? 2 : rng() < 0.35 ? 2 : 1;
  const hh = floors * 3.3;
  const hz = depth - 0.4 - hd / 2;
  const kind = big || rng() < 0.4 ? 'brick' : 'house';
  ctx.slots.houses.push(slot(ctx, lx0 + w / 2, hz, hw, hd));
  col(ctx, lx0 + w / 2, hz, hw, hd, hh);
  if (ctx.opts.skipHouses) {
    tree(ctx, lx0 + rand(rng, 2, w - 2), rand(rng, wallZ + 2.5, hz - hd / 2 - 3), 'fruit');
    return;
  }
  ctx.b.box(`fac-${kind}plain`, lx0 + w / 2, gy, hz, hw, hh, hd, ctx.tex.plainWall(kind).tile, 0, rng());
  ctx.b.box('chalk', lx0 + w / 2, gy + hh - 0.25, hz, hw + 0.16, 0.25, hd + 0.16);
  {
    const style: FrameStyle = rng() < 0.6 ? 'blue' : 'wood';
    const faces = boxFaces(ctx, lx0 + w / 2, hz, hw, hd, gy);
    const bays = Math.max(1, Math.floor(hw / 2.7));
    const mid = Math.floor(bays / 2);
    addWindowGrid(ctx.facade, faces.nz, { bay: 2.7, floorH: 3.3, floors, winW: 1.3, winH: 1.5, sill: 0.95, style, lit: 0.45, skip: (k, f) => f === 0 && k === mid }, rng);
    addDoor(ctx.facade, faces.nz, (hw - bays * 2.7) / 2 + (mid + 0.5) * 2.7);
    addWindowGrid(ctx.facade, faces.pz, { bay: 3.4, floorH: 3.3, floors, winW: 1.1, winH: 1.3, sill: 1.1, style, lit: 0.3 }, rng);
  }
  if (rng() < 0.75) {
    const tin = pick(rng, ['tin-green', 'tin-red', 'tin-grey', 'tin-green']);
    ctx.b.box(tin, lx0 + w / 2, gy + hh, hz, hw + 0.6, 0.15, hd + 0.6);
    ctx.b.prism(tin, lx0 + w / 2, gy + hh + 0.15, hz, hw + 0.6, rand(rng, 1, 1.6), hd + 0.6);
  } else {
    ctx.b.box('roof', lx0 + w / 2, gy + hh, hz, hw + 0.3, 0.4, hd + 0.3, [4, 4]);
  }
  // ayvon (veranda) with carved wooden columns
  const az = hz - hd / 2 - 1.4;
  for (let x = lx0 + 1.4; x < lx0 + w - 1; x += 2.6) ctx.d.cyl('wood', x, gy, az, 0.13, 0.15, 3, 8);
  ctx.d.box('wood', lx0 + w / 2, gy + 3, az + 0.6, hw, 0.18, 3.2);
  // courtyard: fruit tree, grape trellis or tapchan
  tree(ctx, lx0 + rand(rng, 2, w - 2), rand(rng, wallZ + 2.5, az - 2), 'fruit');
  if (rng() < 0.45) {
    const tx = lx0 + w / 2;
    for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) ctx.d.cyl('metal', tx + x, gy, wallZ + 5 + z, 0.05, 0.05, 2.6, 6);
    ctx.d.box('foliage', tx, gy + 2.6, wallZ + 5, 4.8, 0.25, 4.8);
  } else if (rng() < 0.5) {
    ctx.d.box('wood', lx0 + w / 2, gy, wallZ + 4, 2.6, 0.5, 2.2);
    ctx.d.box('red', lx0 + w / 2, gy + 0.5, wallZ + 4, 2.4, 0.06, 2);
  }
  if (rng() < 0.3) ctx.d.cyl('white', lx0 + w / 2 + 2, gy + hh + 0.6, hz, 0.45, 0.45, 0.08, 12);
}

function mahalla(ctx: BlockCtx) {
  blockGround(ctx, 'steppe', 'curb', true);
  const prop = propertyAt(ctx.i, ctx.j);
  for (const side of ['n', 's', 'e', 'w'] as Side[]) {
    setFrame(ctx, sideFrame(ctx.r, side));
    for (let lx = 10; lx < BLOCK - 6; lx += 24) lamp(ctx, lx, 0.8);
    for (let lx = 5; lx < BLOCK - 4; lx += 7) if (ctx.rng() < 0.75) tree(ctx, lx + rand(ctx.rng, -1, 1), 4.05, ctx.rng() < 0.7 ? 'terak' : 'chinor', 0.9);
    if (side === 'n' || side === 's') {
      let lx = 4.6;
      while (lx < 71) {
        const w = Math.min(rand(ctx.rng, 13, 19), 71.4 - lx);
        if (w < 8) break;
        houseLot(ctx, lx, w, 29.5, lx + w > 66);
        lx += w;
      }
    } else {
      houseLot(ctx, 29.5, 17, 29.5, true, prop?.side === side);
    }
  }
  setFrame(ctx, sideFrame(ctx.r, 'c'));
  tree(ctx, 38, 38, 'chinor', 1.5);
  scatter(ctx, 'grass', 31, 31, 45, 45, 30);
  scatter(ctx, 'bush', 31, 31, 45, 45, 5);
  tree(ctx, 33, 42, 'fruit');
  tree(ctx, 43, 34, 'fruit');
}

function bazaar(ctx: BlockCtx) {
  blockGround(ctx, 'asphalt', 'curb');
  streetFurniture(ctx, 'chinor', 24, 12);
  setFrame(ctx, sideFrame(ctx.r, 's'));
  const gy = ctx.gy;
  // covered market hall with arched roof
  building(ctx, 38, 46, 50, 26, 8, 'brick', false, 'chalk');
  const g = new THREE.CylinderGeometry(13, 13, 50, 20, 1, false, -Math.PI / 2, Math.PI);
  g.rotateX(-Math.PI / 2);
  g.rotateY(Math.PI / 2);
  M.makeTranslation(38, gy + 8.4, 46).multiply(MR.makeScale(1, 0.45, 1));
  ctx.b.add('dome', g, M);
  // open-air stalls with colourful awnings
  const awn = ['red', 'yellow', 'awning-blue', 'green-paint'];
  for (let row = 0; row < 2; row++)
    for (let k = 0; k < 7; k++) {
      const x = 12 + k * 8.5, z = 13 + row * 9;
      ctx.d.box('wood', x, gy, z, 5, 0.9, 2.4);
      ctx.d.box(awn[(k + row) % awn.length], x, gy + 2.5, z, 5.6, 0.12, 3.4);
      for (const sx of [-2.6, 2.6]) ctx.d.cyl('metal', x + sx, gy, z + 1.5, 0.05, 0.05, 2.5, 6);
      ctx.d.box(pick(ctx.rng, ['yellow', 'red', 'green-paint', 'hay']), x, gy + 0.9, z, 4.4, 0.35, 1.8);
      col(ctx, x, z, 5, 2.4, 1);
    }
  sign(ctx, ctx.tex.sign('DEHQON BOZORI', '#c27c1a', '#fff', 'Har kuni 6:00 – 19:00'), 38, 9.5, 32.6, 14, 3.4);
}

// ---------------------------------------------------------------- industrial
function concreteFence(ctx: BlockCtx, gaps: Side[]) {
  for (const side of ['n', 's', 'e', 'w'] as Side[]) {
    setFrame(ctx, sideFrame(ctx.r, side));
    const gap = gaps.includes(side);
    const segs: [number, number][] = gap ? [[4.5, 33], [43, 71.5]] : [[4.5, 71.5]];
    for (const [a, b2] of segs) {
      ctx.b.box('fence', (a + b2) / 2, ctx.gy, 4.6, b2 - a, 2.4, 0.2, [3, 2.4]);
      col(ctx, (a + b2) / 2, 4.6, b2 - a, 0.25, 2.4);
    }
    for (let lx = 8; lx < BLOCK - 4; lx += 30) lamp(ctx, lx, 0.8);
  }
}

function industrial(ctx: BlockCtx) {
  blockGround(ctx, 'asphalt', 'curb');
  concreteFence(ctx, ['s', 'n']);
  setFrame(ctx, sideFrame(ctx.r, 'c'));
  const rng = ctx.rng;
  const corr = pick(rng, ['corr-blue', 'corr-beige', 'corr-grey']);
  const big = (x: number, z: number, w: number, d: number, h: number) => {
    ctx.b.box(corr, x, ctx.gy, z, w, h, d, [4, h]);
    ctx.b.prism('corr-grey', x, ctx.gy + h, z, w, 2.2, d + 0.6);
    for (let k = -1; k <= 1; k += 2) ctx.d.box('darkmetal', x + k * w * 0.25, ctx.gy, z + d / 2 + 0.05, 4.5, 4.5, 0.15);
    col(ctx, x, z, w, d, h);
  };
  big(24, 22, 30, 18, rand(rng, 8, 11));
  if (rng() < 0.5) {
    big(52, 52, 30, 20, rand(rng, 9, 12));
  } else {
    // factory with chimney
    building(ctx, 52, 52, 28, 20, 12, 'office', false);
    ctx.b.cyl('fence', 64, ctx.gy, 38, 1.4, 2, 34, 14);
    for (let k = 0; k < 3; k++) ctx.b.cyl('red', 64, ctx.gy + 22 + k * 4, 38, 1.55 - k * 0.05, 1.6 - k * 0.05, 1.6, 14);
    col(ctx, 64, 38, 4, 4, 34);
  }
  // containers
  const cc = ['red', 'awning-blue', 'green-paint', 'yellow'];
  for (let k = 0; k < 4; k++) {
    const x = 14 + k * 3;
    ctx.b.box(cc[k % 4], x, ctx.gy, 52, 2.4, 2.6, 12, null);
    col(ctx, x, 52, 2.4, 12, 2.6);
    if (rng() < 0.5) ctx.b.box(cc[(k + 1) % 4], x, ctx.gy + 2.6, 52, 2.4, 2.6, 12);
  }
  parkedCar(ctx, 40, 34, Math.PI / 2, 'karvon');
  if (rng() < 0.6) parkedCar(ctx, 40, 38, Math.PI / 2, 'karvon');
}

function service(ctx: BlockCtx) {
  blockGround(ctx, 'asphalt', 'flat');
  setFrame(ctx, sideFrame(ctx.r, 's'));
  const gy = 0;
  // workshop: three open bays facing the street
  ctx.b.box('corr-blue', 38, gy, 46, 44, 7, 0.4, [4, 7]);
  ctx.b.box('corr-blue', 16.2, gy, 33, 0.4, 7, 26, [4, 7]);
  ctx.b.box('corr-blue', 59.8, gy, 33, 0.4, 7, 26, [4, 7]);
  ctx.b.box('roof', 38, gy + 7, 33, 45, 0.5, 27, [4, 4]);
  for (const x of [30.75, 45.25]) {
    ctx.b.box('concrete', x, gy, 20, 0.6, 5, 0.6);
    col(ctx, x, 20, 0.6, 0.6, 5);
  }
  for (const x of [23.5, 38, 52.5]) {
    ctx.d.box('yellow', x, gy, 34, 0.3, 1.8, 6);
    ctx.d.box('darkmetal', x, gy + 1.8, 34, 3.2, 0.15, 5);
  }
  ctx.b.box('corr-blue', 38, gy + 5, 20, 44, 2, 0.4, [4, 2]);
  col(ctx, 38, 46, 44, 0.5, 7);
  col(ctx, 16.2, 33, 0.5, 26, 7);
  col(ctx, 59.8, 33, 0.5, 26, 7);
  for (let k = 0; k < 5; k++) ctx.d.cyl('tire', 64 + (k % 2) * 1.6, gy + Math.floor(k / 2) * 0.5, 18, 0.45, 0.45, 0.45, 12);
  parkedCar(ctx, 23.5, 36, 0);
  sign(ctx, ctx.tex.sign('AVTOSERVIS', '#1d6b8f', '#fff', 'Ta’mir · Tuning · Garaj'), 38, 7.8, 19.6, 12, 3);
}

function warehouse(ctx: BlockCtx) {
  blockGround(ctx, 'asphalt', 'curb');
  concreteFence(ctx, ['s']);
  setFrame(ctx, sideFrame(ctx.r, 's'));
  ctx.b.box('corr-beige', 38, ctx.gy, 44, 56, 11, 28, [4, 11]);
  ctx.b.box('roof', 38, ctx.gy + 11, 44, 56.4, 0.5, 28.4, [4, 4]);
  for (let k = 0; k < 5; k++) {
    ctx.d.box('darkmetal', 16 + k * 11, ctx.gy, 29.9, 4, 4.4, 0.2);
    ctx.d.box('concrete', 16 + k * 11, ctx.gy, 28.6, 5, 1.2, 2.4);
  }
  col(ctx, 38, 44, 56, 28, 11);
  parkedCar(ctx, 20, 22, 0, 'karvon');
  parkedCar(ctx, 30, 22, 0, 'karvon');
  sign(ctx, ctx.tex.sign('POCHTA OMBORI', '#c27c1a', '#fff', 'Saralash markazi'), 38, 12.5, 29.6, 14, 3.4);
}

function dealership(ctx: BlockCtx) {
  blockGround(ctx, 'asphalt', 'curb');
  streetFurniture(ctx, null, 24);
  setFrame(ctx, sideFrame(ctx.r, 'w'));
  const gy = ctx.gy;
  // glass showroom
  ctx.b.box('showglass', 38, gy, 30, 40, 8, 20);
  ctx.b.box('chalk', 38, gy + 8, 30, 41, 0.8, 21);
  ctx.b.box('chalk', 38, gy, 30, 40.2, 0.3, 20.2);
  col(ctx, 38, 30, 40, 20, 8);
  for (let k = 0; k < 3; k++) parkedCar(ctx, 26 + k * 12, 30, 0.6, VEHICLES[(k * 3 + 1) % VEHICLES.length].id, true);
  // outdoor lot with flags
  for (let k = 0; k < 7; k++) parkedCar(ctx, 14 + k * 7.5, 52, 0, VEHICLES[k % VEHICLES.length].id, true);
  for (let k = 0; k < 8; k++) {
    ctx.d.cyl('white', 10 + k * 8, gy, 9, 0.06, 0.06, 6, 6);
    ctx.d.box(k % 2 ? 'awning-blue' : 'red', 10 + k * 8 + 0.6, gy + 4.6, 9, 1.2, 1.4, 0.04);
  }
  sign(ctx, ctx.tex.sign('AVTOSALON', '#16181c', '#ffffff', 'Yangi va ishlatilgan mashinalar'), 38, 9.4, 19.6, 14, 3.4);
}

function carWash(ctx: BlockCtx) {
  blockGround(ctx, 'asphalt', 'curb');
  concreteFence(ctx, ['s']);
  setFrame(ctx, sideFrame(ctx.r, 's'));
  ctx.b.box('corr-grey', 38, ctx.gy, 30, 36, 6, 16, [4, 6]);
  ctx.b.box('roof', 38, ctx.gy + 6, 30, 36.4, 0.4, 16.4, [4, 4]);
  for (let k = 0; k < 3; k++) ctx.d.box('darkmetal', 26 + k * 12, ctx.gy, 21.9, 5, 4.2, 0.2);
  col(ctx, 38, 30, 36, 16, 6);
  sign(ctx, ctx.tex.sign('AVTOYUVISH', '#1aa3b4', '#fff', '24/7'), 38, 6.8, 21.6, 10, 2.5);
  industrialBack(ctx);
}

function industrialBack(ctx: BlockCtx) {
  setFrame(ctx, sideFrame(ctx.r, 'n'));
  ctx.b.box('corr-beige', 38, ctx.gy, 22, 40, 9, 16, [4, 9]);
  ctx.b.prism('corr-grey', 38, ctx.gy + 9, 22, 40, 2, 16.6);
  col(ctx, 38, 22, 40, 16, 9);
}

function garages(ctx: BlockCtx) {
  blockGround(ctx, 'asphalt', 'curb');
  concreteFence(ctx, ['w', 'e']);
  setFrame(ctx, sideFrame(ctx.r, 'c'));
  for (let row = 0; row < 3; row++) {
    const z = 14 + row * 22;
    for (let k = 0; k < 16; k++) {
      const x = 8 + k * 3.8;
      ctx.b.box('fence', x, ctx.gy, z, 3.7, 2.6, 6, [3, 2.6]);
      ctx.d.box(pick(ctx.rng, ['darkmetal', 'awning-blue', 'green-paint', 'metal']), x, ctx.gy, z + 3.02, 2.8, 2.2, 0.06);
    }
    ctx.b.box('roof', 38, ctx.gy + 2.6, z, 61, 0.2, 6.4);
    col(ctx, 38, z, 61, 6, 2.6);
  }
}

// ---------------------------------------------------------------- village
function farmstead(ctx: BlockCtx, lx: number, lz: number, big: boolean) {
  const gy = ctx.gy;
  const w = big ? 30 : 22;
  for (const [x, z, ww, dd] of [[lx, lz - w / 2, w, 0.3], [lx, lz + w / 2, w, 0.3], [lx - w / 2, lz, 0.3, w], [lx + w / 2, lz, 0.3, w]] as const) {
    if (z === lz + w / 2) {
      ctx.b.box('plaster2', x - w / 4 - 1, gy, z, w / 2 - 2, 2.2, 0.3, [4, 2.4]);
      ctx.b.box('plaster2', x + w / 4 + 1, gy, z, w / 2 - 2, 2.2, 0.3, [4, 2.4]);
      ctx.b.box('gate-brown', x, gy, z, 4, 2.1, 0.1);
      col(ctx, x - w / 4 - 1, z, w / 2 - 2, 0.3, 2.2);
      col(ctx, x + w / 4 + 1, z, w / 2 - 2, 0.3, 2.2);
    } else {
      ctx.b.box('plaster2', x, gy, z, ww, 2.2, dd, [4, 2.4]);
      col(ctx, x, z, ww, dd, 2.2);
    }
  }
  ctx.b.box('fac-house', lx, gy, lz - w / 4, w - 6, 3.4, 8, ctx.tex.facade('house').tile);
  ctx.b.prism('tin-red', lx, gy + 3.4, lz - w / 4, w - 5.4, 1.4, 8.6);
  col(ctx, lx, lz - w / 4, w - 6, 8, 3.4);
  ctx.d.cyl('hay', lx + w / 2 - 4, gy, lz + 3, 1.6, 1.8, 2.4, 10);
  ctx.d.cyl('hay', lx + w / 2 - 4, gy, lz + 7, 1.5, 1.7, 2.2, 10);
  tree(ctx, lx - w / 3, lz + 4, 'fruit');
  tree(ctx, lx - w / 4, lz + 7, 'fruit');
}

function village(ctx: BlockCtx) {
  const fieldKey = ctx.rng() < 0.55 ? 'field-cotton' : 'field-wheat';
  blockGround(ctx, fieldKey, 'flat');
  for (const side of ['n', 's', 'e', 'w'] as Side[]) {
    setFrame(ctx, sideFrame(ctx.r, side));
    for (let lx = 5; lx < BLOCK - 2; lx += 9) if (ctx.rng() < 0.7) tree(ctx, lx, 1.6, 'terak', 1.1);
  }
  setFrame(ctx, sideFrame(ctx.r, 'c'));
  const sp = specialAt(ctx.i, ctx.j);
  const prop = propertyAt(ctx.i, ctx.j);
  if (sp === 'farm') {
    setFrame(ctx, sideFrame(ctx.r, 'n'));
    farmstead(ctx, 38, 20, true);
    // tractor
    ctx.d.box('red', 56, 0, 14, 2, 1.4, 3.2);
    ctx.d.box('red', 56, 1.4, 13.4, 1.6, 1.3, 1.6);
    for (const [x, z, r] of [[55, 15.2, 0.75], [57, 15.2, 0.75], [55, 12.6, 0.45], [57, 12.6, 0.45]] as const) {
      ctx.d.cyl('tire', x + (x < 56 ? -0.3 : 0.3), r, z, r, r, 0.4, 12);
    }
    col(ctx, 56, 14, 2.6, 3.6, 2.5);
    sign(ctx, ctx.tex.sign('FERMER XO‘JALIGI', '#2f6b3f', '#fff', '«Oltin dala»'), 38, 3.4, 4.2, 9, 2.2);
  } else if (prop?.type === 'luxury') {
    setFrame(ctx, sideFrame(ctx.r, 'n'));
    const gy = 0;
    for (const [x, z, w, d] of [[38, 6, 60, 0.4], [38, 50, 60, 0.4], [8, 28, 0.4, 44], [68, 28, 0.4, 44]] as const) {
      if (z === 6) {
        ctx.b.box('plaster', 20, gy, z, 24, 2.6, d, [4, 2.6]);
        ctx.b.box('plaster', 56, gy, z, 24, 2.6, d, [4, 2.6]);
        ctx.b.box('gate-brown', 38, gy, z, 12, 2.5, 0.12);
        col(ctx, 20, z, 24, 0.5, 2.6);
        col(ctx, 56, z, 24, 0.5, 2.6);
      } else {
        ctx.b.box('plaster', x, gy, z, w, 2.6, d, [4, 2.6]);
        col(ctx, x, z, w, d, 2.6);
      }
    }
    ctx.b.box('fac-house', 38, gy, 36, 26, 7, 12, ctx.tex.facade('house').tile);
    ctx.b.box('showglass', 30, gy + 0.2, 29.9, 9, 6, 0.2);
    ctx.b.box('chalk', 38, gy + 7, 36, 27, 0.5, 13);
    ctx.b.box('fac-house', 44, gy + 7.5, 38, 14, 3.2, 8, ctx.tex.facade('house').tile);
    ctx.b.box('chalk', 44, gy + 10.7, 38, 14.6, 0.4, 8.6);
    col(ctx, 38, 36, 26, 12, 10);
    ctx.b.box('chalk', 38, gy, 20, 16, 0.3, 8);
    ctx.b.box('pool', 38, gy + 0.05, 20, 14, 0.3, 6.4);
    for (let k = 0; k < 6; k++) tree(ctx, 12 + k * 3, 14 + (k % 2) * 4, k % 2 ? 'pine' : 'fruit');
  } else if (ctx.rng() < 0.45) {
    setFrame(ctx, sideFrame(ctx.r, pick(ctx.rng, ['n', 's', 'e', 'w'] as Side[])));
    farmstead(ctx, rand(ctx.rng, 18, 58), 18, false);
  }
}

function fuel(ctx: BlockCtx) {
  const side: Side = ctx.i === 8 ? 'e' : 'w';
  blockGround(ctx, ctx.i === 8 ? 'asphalt' : 'field-wheat', 'flat');
  setFrame(ctx, sideFrame(ctx.r, side));
  const gy = 0;
  // forecourt slab in local frame
  ctx.b.box('asphalt', 38, -0.02, 14, 60, 0.05, 24, [8, 8]);
  // canopy
  for (const [x, z] of [[28, 8], [48, 8], [28, 18], [48, 18]]) {
    ctx.b.box('chalk', x, gy, z, 0.6, 5.2, 0.6);
    col(ctx, x, z, 0.6, 0.6, 5);
  }
  ctx.b.box('canopy', 38, gy + 5.2, 13, 28, 0.25, 15);
  ctx.b.box('awning-blue', 38, gy + 5.45, 13, 28.4, 0.9, 15.4);
  for (const z of [10, 16]) {
    ctx.b.box('concrete', 38, gy, z, 16, 0.25, 1.4);
    for (const x of [33, 43]) {
      ctx.d.box('white', x, gy + 0.25, z, 0.9, 1.8, 0.6);
      ctx.d.box('awning-blue', x, gy + 1.6, z, 0.95, 0.35, 0.65);
    }
    col(ctx, 38, z, 16, 1.4, 1.8);
  }
  // shop
  building(ctx, 38, 33, 18, 9, 4.6, 'office', true);
  // pylon sign
  ctx.b.box('chalk', 8, gy, 6, 0.8, 7, 0.8);
  col(ctx, 8, 6, 1, 1, 7);
  sign(ctx, ctx.tex.sign('AYOQSH', '#1b4f8a', '#fff', 'METAN · PROPAN · AI-92'), 8, 6, 5.5, 6, 1.6);
  if (ctx.i !== 8) {
    setFrame(ctx, sideFrame(ctx.r, 'c'));
    farmstead(ctx, 52, 56, false);
  }
}

// ---------------------------------------------------------------- G‘uzordaryo embankment
function riverBlock(ctx: BlockCtx) {
  const { r, b, d } = ctx;
  setFrame(ctx, sideFrame(r, 'c'));
  b.base.identity();
  d.base.identity();
  const h = 0.15, c0 = RIVER.z0, c1 = RIVER.z1;
  b.box('curb', r.cx, 0, r.z0 + 0.15, BLOCK, h + 0.01, 0.3);
  b.box('curb', r.cx, 0, r.z1 - 0.15, BLOCK, h + 0.01, 0.3);
  for (const x of [r.x0 + 0.15, r.x1 - 0.15]) {
    b.box('curb', x, 0, (r.z0 + c0) / 2, 0.3, h + 0.01, c0 - r.z0);
    b.box('curb', x, 0, (c1 + r.z1) / 2, 0.3, h + 0.01, r.z1 - c1);
  }
  // sidewalks (they continue over the bridges as decks)
  b.quad('pavers', r.x0 + 0.3, r.z0 + 0.3, r.x1 - 0.3, r.z0 + 4, h, 'world', 2.4);
  b.quad('pavers', r.x0 + 0.3, r.z1 - 4, r.x1 - 0.3, r.z1 - 0.3, h, 'world', 2.4);
  for (const [xa, xb] of [[r.x0 + 0.3, r.x0 + 4], [r.x1 - 4, r.x1 - 0.3]]) {
    b.quad('pavers', xa, r.z0 + 4, xb, c0, h, 'world', 2.4);
    b.quad('pavers', xa, c1, xb, r.z1 - 4, h, 'world', 2.4);
    b.box('concrete', (xa + xb) / 2, -0.7, (c0 + c1) / 2, xb - xa, 0.85, c1 - c0);
    b.quad('pavers', xa, c0, xb, c1, h, 'world', 2.4);
  }
  // promenades and lawns
  b.quad('grass', r.x0 + 4, r.z0 + 4, r.x1 - 4, c0 - 7, h, 'world', 8);
  b.quad('plaza', r.x0 + 4, c0 - 7, r.x1 - 4, c0, h, 'world', 6);
  b.quad('plaza', r.x0 + 4, c1, r.x1 - 4, c1 + 7, h, 'world', 6);
  b.quad('grass', r.x0 + 4, c1 + 7, r.x1 - 4, r.z1 - 4, h, 'world', 8);
  // stone channel walls with a parapet
  for (const z of [c0, c1]) {
    b.box('concrete', r.cx, -2.4, z, BLOCK, 2.55, 0.7);
    b.box('chalk', r.cx, h, z, BLOCK - 8, 0.55, 0.45);
    ctx.col.addCentered(r.cx, z, BLOCK - 8, 0.6, 1);
    for (let x = r.x0 + 6; x < r.x1 - 4; x += 3) d.box('metal', x, h + 0.55, z, 0.06, 0.45, 0.06);
    d.box('metal', r.cx, h + 1.0, z, BLOCK - 8, 0.05, 0.05);
  }
  // railings on the bridge sidewalks (inner side)
  for (const x of [r.x0 + 4.05, r.x1 - 4.05]) {
    d.box('metal', x, h + 0.95, (c0 + c1) / 2, 0.05, 0.05, c1 - c0);
    for (let z = c0 + 1; z < c1; z += 2) d.box('metal', x, h, z, 0.05, 1.0, 0.05);
    ctx.col.addCentered(x, (c0 + c1) / 2, 0.3, c1 - c0, 1);
  }
  // willow-like plane trees, benches, lamps along the water
  for (let x = r.x0 + 9; x < r.x1 - 6; x += 10) {
    tree(ctx, x - r.x0, c0 - 9 - r.z0, 'chinor', 1.1);
    tree(ctx, x + 5 - r.x0, c1 + 9 - r.z0, 'chinor', 1.1);
    d.box('wood', x + 2.5, h, c0 - 3, 1.8, 0.45, 0.6);
    d.box('wood', x + 7.5, h, c1 + 3, 1.8, 0.45, 0.6);
  }
  scatter(ctx, 'grass', 6, 6, 70, 18, 50);
  scatter(ctx, 'grass', 6, 58, 70, 70, 50);
  scatter(ctx, 'bush', 6, 6, 70, 16, 10);
  for (const side of ['n', 's'] as Side[]) {
    setFrame(ctx, sideFrame(ctx.r, side));
    for (let lx = 8; lx < BLOCK - 4; lx += 24) lamp(ctx, lx, 0.8);
  }
}

// ---------------------------------------------------------------- dispatcher
export function buildBlock(ctx: BlockCtx) {
  if (ctx.j === RIVER_ROW) return riverBlock(ctx);
  const sp = specialAt(ctx.i, ctx.j);
  const dist = districtOf(ctx.i, ctx.j);
  const prop = propertyAt(ctx.i, ctx.j);
  if (sp === 'plaza') return plaza(ctx);
  if (sp === 'bank' || sp === 'jobs' || sp === 'realty' || sp === 'osh') return downtownSpecial(ctx, sp);
  if (sp === 'bazaar') return bazaar(ctx);
  if (sp === 'school') return school(ctx);
  if (sp === 'park') return park(ctx);
  if (sp === 'service') return service(ctx);
  if (sp === 'warehouse') return warehouse(ctx);
  if (sp === 'dealership') return dealership(ctx);
  if (sp === 'fuel') return fuel(ctx);
  if (prop?.id === 'biz-avtoyuvish') return carWash(ctx);
  if (prop?.id === 'garaj-ikki') return garages(ctx);
  if (prop?.id === 'biz-choyxona' || prop?.id === 'biz-supermarket') {
    downtown(ctx, true);
    setFrame(ctx, sideFrame(ctx.r, 's'));
    if (prop.id === 'biz-choyxona') {
      building(ctx, 38, 14, 30, 14, 6, 'brick', false, 'chalk');
      for (let x = 25; x <= 51; x += 4.3) ctx.d.cyl('wood', x, ctx.gy, 6.2, 0.2, 0.24, 4.2, 8);
      ctx.d.box('wood', 38, ctx.gy + 4.2, 6.8, 30, 0.3, 2.4);
      sign(ctx, ctx.tex.sign('CHOYXONA', '#2f6b3f', '#fff', '«Do‘stlar davrasi»'), 38, 4.8, 5.4, 9, 2.2);
    } else {
      building(ctx, 38, 15, 44, 16, 10, 'office', true);
      sign(ctx, ctx.tex.sign('SUPERMARKET', '#a33a2c', '#fff', 'Har kuni 8:00 – 23:00'), 38, 7.2, 6.8, 12, 3);
    }
    return;
  }
  if (dist === 'downtown') return downtown(ctx, false);
  if (dist === 'apartments') return apartments(ctx);
  if (dist === 'mahalla') return mahalla(ctx);
  if (dist === 'industrial') return industrial(ctx);
  return village(ctx);
}
