import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { VehicleCustom, VehicleSpec } from '@/types';
import { TINT_LEVELS, WHEEL_STYLES } from '@/config/vehicles';
import type { TextureLib } from '@/game/world/textures';

/**
 * Original, realistic car bodies (no real brand designs or logos).
 * The body is a lofted surface: ~70 cross-sections along the car, each a smooth
 * section with side bulge, shoulder crease, tumblehome greenhouse and crowned roof,
 * a superellipse plan view (rounded corners) and true wheel-arch cut-outs.
 * Faces are split into paint / glass so pillars, windscreen and windows fall out of
 * the same surface. Lights, grille, seams, handles, mirrors and wheels are fitted to it.
 */

// ------------------------------------------------------------------ helpers
function monotone(xs: number[], ys: number[]) {
  const n = xs.length;
  const d: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ------------------------------------------------------------------ body definition
interface BodyDef {
  L: number;
  W: number;
  H: number;
  c: number;
  r: number;
  wb: number;
  belt: number;
  zC: number;
  zRF: number;
  zRB: number;
  rwBase: number;
  zB: number;
  sideFrom: number;
  sideTo: number;
  van: boolean;
  sedan: boolean;
  top: (z: number) => number;
  hw: (z: number) => number;
  bottom: (z: number) => number;
}

function bodyDef(spec: VehicleSpec): BodyDef {
  const { length: L, width: W, height: H, clearance: c, wheelRadius: r, wheelbase: wb } = spec.dims;
  const { belt, hood, trunk, wsRun, rwRun } = spec.shape;
  const van = spec.body === 'van';
  const sedan = spec.body === 'sedan';
  const zC = L / 2 - hood;
  const zRF = zC - wsRun;
  const rwBase = -L / 2 + Math.max(trunk, 0.05);
  const zRB = rwBase + rwRun;
  let pts: [number, number][];
  if (van) {
    pts = [[-L / 2, belt - 0.1], [-L / 2 + 0.03, H - 0.14], [-L / 2 + 0.14, H - 0.02], [(zRF - L / 2) / 2, H], [zRF, H - 0.03], [zC, belt + 0.07], [L / 2 - 0.08, belt - 0.02], [L / 2, belt - 0.16]];
  } else if (sedan) {
    pts = [[-L / 2, belt - 0.17], [-L / 2 + 0.1, belt - 0.02], [rwBase, belt + 0.04], [zRB, H - 0.035], [(zRB + zRF) / 2, H], [zRF, H - 0.03], [zC, belt + 0.05], [L / 2 - 0.35, belt - 0.02], [L / 2 - 0.06, belt - 0.11], [L / 2, belt - 0.21]];
  } else {
    pts = [[-L / 2, belt - 0.15], [-L / 2 + 0.03, belt + 0.02], [rwBase, belt + 0.12], [zRB, H - 0.04], [(zRB + zRF) / 2, H], [zRF, H - 0.03], [zC, belt + 0.05], [L / 2 - 0.3, belt - 0.01], [L / 2 - 0.06, belt - 0.1], [L / 2, belt - 0.21]];
  }
  const top = monotone(pts.map((p) => p[0]), pts.map((p) => p[1]));
  const hw = (z: number) => {
    const zn = Math.min(1, Math.abs(z) / (L / 2));
    return (W / 2) * Math.pow(Math.max(0, 1 - Math.pow(zn, 6)), 1 / 6);
  };
  const ra = r + 0.07;
  const bottom = (z: number) => {
    let y = c + 0.1 + 0.12 * sstep(L / 2 - 0.5, L / 2, Math.abs(z));
    for (const zw of [wb / 2, -wb / 2]) {
      const dz = z - zw;
      if (Math.abs(dz) < ra) y = Math.max(y, r + Math.sqrt(ra * ra - dz * dz));
    }
    return y;
  };
  const sideFrom = van ? -L / 2 + 0.3 : rwBase + (zRB - rwBase) * (sedan ? 0.55 : 0.35);
  const sideTo = zRF + (zC - zRF) * 0.45;
  const zB = (zRF + sideFrom) / 2 + 0.1;
  return { L, W, H, c, r, wb, belt, zC, zRF, zRB, rwBase, zB, sideFrom, sideTo, van, sedan, top, hw, bottom };
}

/** half cross-section at z: 10 points from bottom centre to top centre (x ≥ 0) */
function section(d: BodyDef, z: number): [number, number][] {
  const t = d.top(z), hw = d.hw(z), b = d.bottom(z);
  const yb = Math.min(d.belt, t - 0.03);
  const g = sstep(d.belt + 0.04, d.belt + 0.2, t);
  const L = (a: [number, number], c: [number, number]): [number, number] => [a[0] + (c[0] - a[0]) * g, a[1] + (c[1] - a[1]) * g];
  return [
    [0, b],
    [hw * 0.88, b],
    [hw * 0.975, b + 0.05],
    [hw, b + (yb - b) * 0.45],
    [hw * 0.99, yb - 0.04],
    [hw * 0.955, yb],
    L([hw * 0.9, t - 0.015], [hw * 0.925, yb + 0.03]),
    L([hw * 0.72, t - 0.005], [hw * 0.79, t - 0.07]),
    L([hw * 0.42, t], [hw * 0.6, t - 0.012]),
    L([0, t + 0.004], [0, t]),
  ];
}

function stations(d: BodyDef, n: number) {
  const zs = new Set<number>();
  for (let i = 0; i <= n; i++) zs.add(+((-Math.cos((i / n) * Math.PI) * d.L) / 2).toFixed(4));
  const ra = d.r + 0.07;
  for (const zw of [d.wb / 2, -d.wb / 2]) for (let k = -ra - 0.02; k <= ra + 0.02; k += ra / 6) zs.add(+(zw + k).toFixed(4));
  for (const z of [d.zC, d.zRF, d.zRB, d.rwBase, d.sideFrom, d.sideTo, d.zB - 0.045, d.zB + 0.045]) zs.add(+z.toFixed(4));
  return [...zs].filter((z) => z >= -d.L / 2 && z <= d.L / 2).sort((a, b) => a - b);
}

/** lofted body split into paint and glass geometry */
function loft(d: BodyDef, detail: number) {
  const zs = stations(d, Math.round(44 * detail));
  const K = 10;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx = (side: number, s: number, k: number) => side * zs.length * K + s * K + k;
  for (const side of [1, -1]) {
    zs.forEach((z, s) => {
      section(d, z).forEach(([x, y], k) => {
        pos.push(x * side, y, z);
        uv.push(z / d.L + 0.5, k / (K - 1));
      });
    });
  }
  const paint: number[] = [];
  const glass: number[] = [];
  for (const [si, side] of [[0, 1], [1, -1]] as const) {
    for (let s = 0; s < zs.length - 1; s++) {
      const zm = (zs[s] + zs[s + 1]) / 2;
      const g = sstep(d.belt + 0.04, d.belt + 0.2, d.top(zm));
      for (let k = 0; k < K - 1; k++) {
        let isGlass = false;
        if (k === 6 && g > 0.6 && zm > d.sideFrom && zm < d.sideTo && (d.van || Math.abs(zm - d.zB) > 0.045)) isGlass = true;
        if ((k === 7 || k === 8) && zm > d.zRF + 0.02 && zm < d.zC - 0.04) isGlass = true;
        if (!d.van && (k === 7 || k === 8) && zm > d.rwBase + 0.05 && zm < d.zRB - 0.02) isGlass = true;
        const a = idx(si, s, k), b = idx(si, s + 1, k), c2 = idx(si, s + 1, k + 1), e = idx(si, s, k + 1);
        const tri = side > 0 ? [a, c2, b, a, e, c2] : [a, b, c2, a, c2, e];
        (isGlass ? glass : paint).push(...tri);
      }
    }
  }
  const all = new THREE.BufferGeometry();
  all.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  all.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  all.setIndex([...paint, ...glass]);
  all.computeVertexNormals();
  // smooth the centre seam between the two halves
  const nrm = all.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < nrm.count; i++) {
    if (Math.abs(pos[i * 3]) < 1e-5) {
      const v = new THREE.Vector3(0, nrm.getY(i), nrm.getZ(i)).normalize();
      nrm.setXYZ(i, v.x, v.y, v.z);
    }
  }
  const part = (list: number[]) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', all.attributes.position);
    g.setAttribute('normal', all.attributes.normal);
    g.setAttribute('uv', all.attributes.uv);
    g.setIndex(list);
    return g;
  };
  return { paint: part(paint), glass: part(glass) };
}

/** front/rear surface depth at lateral offset x (plan superellipse) */
const frontZ = (d: BodyDef, x: number) => (d.L / 2) * Math.pow(Math.max(0, 1 - Math.pow(Math.min(1, Math.abs(x) / (d.W / 2)), 6)), 1 / 6);
const planYaw = (d: BodyDef, x: number, front: boolean) => {
  const e = 0.01;
  const dz = frontZ(d, x + e) - frontZ(d, x - e);
  const n = new THREE.Vector2(-dz / (2 * e), 1).normalize();
  return front ? Math.atan2(n.x, n.y) : Math.PI - Math.atan2(n.x, n.y);
};

function roundedRect(w: number, h: number, rad: number) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + rad, y);
  s.lineTo(x + w - rad, y);
  s.quadraticCurveTo(x + w, y, x + w, y + rad);
  s.lineTo(x + w, y + h - rad);
  s.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  s.lineTo(x + rad, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - rad);
  s.lineTo(x, y + rad);
  s.quadraticCurveTo(x, y, x + rad, y);
  return s;
}

const lens = (w: number, h: number, depth: number) =>
  new THREE.ExtrudeGeometry(roundedRect(w, h, Math.min(w, h) * 0.32), { depth, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 6 });

/** strip glued onto the body surface following the section at z (vertical seam) */
function seam(d: BodyDef, z: number, k0: number, k1: number, side: number, half = 0.004) {
  const a = section(d, z - half), b = section(d, z + half);
  const pos: number[] = [];
  for (let k = k0; k < k1; k++) {
    const p = [a[k], b[k], b[k + 1], a[k + 1]].map(([x, y], i) => [x * 1.004 * side + 0.001 * side, y, i === 0 || i === 3 ? z - half : z + half]);
    const tri = side > 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
    for (const t of tri) pos.push(...p[t]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2));
  return g;
}

// ------------------------------------------------------------------ wheels
function tyreGeo(r: number, w: number, seg: number) {
  const pts = [
    [r * 0.64, -w / 2], [r * 0.9, -w / 2], [r * 0.975, -w / 2 + 0.018], [r, -w / 2 + 0.05],
    [r, w / 2 - 0.05], [r * 0.975, w / 2 - 0.018], [r * 0.9, w / 2], [r * 0.64, w / 2],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(pts, seg);
  g.rotateZ(Math.PI / 2);
  return g;
}

function rimGeo(r: number, w: number, spokes: number, seg: number) {
  const rr = r * 0.64;
  const parts: THREE.BufferGeometry[] = [];
  // barrel + lip + dish
  const barrel = new THREE.LatheGeometry([new THREE.Vector2(rr * 0.98, -w / 2 + 0.01), new THREE.Vector2(rr, -w / 2 + 0.02), new THREE.Vector2(rr, w / 2 - 0.01), new THREE.Vector2(rr * 1.02, w / 2)], seg);
  barrel.rotateZ(-Math.PI / 2);
  parts.push(barrel);
  const dishPts = [new THREE.Vector2(0.001, w / 2 - 0.035), new THREE.Vector2(rr * 0.22, w / 2 - 0.03), new THREE.Vector2(rr * 0.3, w / 2 - 0.06), new THREE.Vector2(rr * 0.92, w / 2 - 0.06), new THREE.Vector2(rr, w / 2 - 0.01)];
  if (spokes === 0) {
    const hub = new THREE.LatheGeometry(dishPts, seg);
    hub.rotateZ(-Math.PI / 2);
    parts.push(hub);
  } else {
    const centre = new THREE.CylinderGeometry(rr * 0.28, rr * 0.3, 0.05, 16).rotateZ(Math.PI / 2).translate(w / 2 - 0.045, 0, 0);
    parts.push(centre);
    for (let k = 0; k < spokes; k++) {
      const s = new THREE.BoxGeometry(0.04, rr * 0.72, rr * (spokes > 6 ? 0.1 : 0.16)).translate(w / 2 - 0.05, rr * 0.6, 0);
      s.rotateX((k / spokes) * Math.PI * 2);
      parts.push(s);
    }
  }
  const disc = new THREE.CylinderGeometry(rr * 0.82, rr * 0.82, 0.02, 24).rotateZ(Math.PI / 2).translate(-0.02, 0, 0);
  parts.push(disc);
  return mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))!;
}

// ------------------------------------------------------------------ full model
export interface VehicleModel {
  root: THREE.Group;
  body: THREE.Group;
  wheels: { pivot: THREE.Group; spin: THREE.Group; front: boolean }[];
  steering: THREE.Group;
  paint: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  head: THREE.MeshStandardMaterial;
  tail: THREE.MeshStandardMaterial;
  amberL: THREE.MeshStandardMaterial;
  amberR: THREE.MeshStandardMaterial;
  spot: THREE.SpotLight | null;
  dispose: () => void;
}

const sharedMats = {
  trim: new THREE.MeshStandardMaterial({ color: '#16181b', roughness: 0.55, metalness: 0.1 }),
  plastic: new THREE.MeshStandardMaterial({ color: '#1f2124', roughness: 0.8 }),
  tire: new THREE.MeshStandardMaterial({ color: '#131313', roughness: 0.88, side: THREE.DoubleSide }),
  interior: new THREE.MeshStandardMaterial({ color: '#2a2826', roughness: 0.85 }),
  seat: new THREE.MeshStandardMaterial({ color: '#3a3632', roughness: 0.9 }),
  chrome: new THREE.MeshStandardMaterial({ color: '#e6e9ed', roughness: 0.08, metalness: 1 }),
  seam: new THREE.MeshStandardMaterial({ color: '#0a0a0a', roughness: 0.9 }),
  disc: new THREE.MeshStandardMaterial({ color: '#77797c', roughness: 0.4, metalness: 0.8 }),
  reflector: new THREE.MeshStandardMaterial({ color: '#c9ced4', roughness: 0.15, metalness: 1 }),
};

export function makePaint(color: string, physical: boolean): THREE.MeshStandardMaterial {
  return physical
    ? new THREE.MeshPhysicalMaterial({ color, metalness: 0.6, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.2 })
    : new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.3 });
}

export function buildVehicleModel(spec: VehicleSpec, custom: VehicleCustom, tex: TextureLib, physical: boolean, withSpot: boolean): VehicleModel {
  const d = bodyDef(spec);
  const { L, W, r, c } = d;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const disposables: { dispose(): void }[] = [];
  const add = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D = body, cast = true) => {
    const x = new THREE.Mesh(g, m);
    x.castShadow = cast;
    parent.add(x);
    disposables.push(g);
    return x;
  };

  const paint = makePaint(custom.color, physical);
  const glass = new THREE.MeshPhysicalMaterial({
    color: '#0a1014', metalness: 0.1, roughness: 0.02, transparent: true, opacity: TINT_LEVELS[custom.tint]?.opacity ?? 0.62,
    depthWrite: false, envMapIntensity: 1.6, clearcoat: 1, clearcoatRoughness: 0.02, side: THREE.DoubleSide,
  });
  const head = new THREE.MeshPhysicalMaterial({ color: '#b9c2c8', emissive: '#fff4dc', emissiveIntensity: 0.08, roughness: 0.02, metalness: 0.3, clearcoat: 1 });
  const tail = new THREE.MeshPhysicalMaterial({ color: '#4a0606', emissive: '#ff1a10', emissiveIntensity: 0.12, roughness: 0.05, metalness: 0.2, clearcoat: 1 });
  const ws = WHEEL_STYLES[custom.wheels] ?? WHEEL_STYLES[0];
  const rimMat = new THREE.MeshStandardMaterial({ color: ws.color, metalness: ws.metal, roughness: ws.rough, side: THREE.DoubleSide });
  const mkAmber = () => new THREE.MeshPhysicalMaterial({ color: '#c97a14', emissive: '#ff9a1a', emissiveIntensity: 0.06, roughness: 0.05, clearcoat: 1 });
  const amberL = mkAmber(), amberR = mkAmber();
  disposables.push(paint, glass, head, tail, rimMat, amberL, amberR);

  // body shell
  const { paint: pg, glass: gg } = loft(d, 1.6);
  add(pg, paint);
  const gm = add(gg, glass, body, false);
  gm.renderOrder = 2;
  if (d.van) {
    const rw = new THREE.PlaneGeometry(W * 0.62, 0.55).rotateY(Math.PI).translate(0, d.H - 0.42, -L / 2 - 0.002);
    add(rw, glass, body, false).renderOrder = 2;
  }

  // shut lines, beltline seal, door handles
  const k0 = 1, k1 = 5;
  const doorSeams = d.van ? [d.wb / 2 - d.r - 0.12, d.zB + 0.25, -d.wb / 2 + d.r + 0.15] : d.sedan || spec.body !== 'hatch' ? [d.wb / 2 - d.r - 0.1, d.zB, -d.wb / 2 + d.r + 0.1] : [d.wb / 2 - d.r - 0.1, d.zB + 0.05];
  for (const side of [1, -1]) {
    for (const z of doorSeams) add(seam(d, z, k0, k1 + 1, side), sharedMats.seam, body, false);
    // window seal along the beltline
    const seal = new THREE.BoxGeometry(0.02, 0.018, d.sideTo - d.sideFrom);
    const zs = (d.sideTo + d.sideFrom) / 2;
    seal.translate(side * (d.hw(zs) * 0.93 + 0.004), Math.min(d.belt, d.top(zs) - 0.03) + 0.025, zs);
    add(seal, sharedMats.trim, body, false);
    // handles
    for (const z of d.van ? [d.zB + 0.05] : [d.zB + 0.18, ...(doorSeams.length > 2 ? [doorSeams[2] + 0.22] : [])]) {
      const h = new THREE.BoxGeometry(0.03, 0.035, 0.17);
      h.translate(side * (d.hw(z) * 0.99 + 0.012), d.belt - 0.1, z);
      add(h, physical ? sharedMats.chrome : paint, body, false);
    }
    // mirrors
    const mz = d.zC - 0.14, my = d.belt + 0.07;
    const mx = side * (d.hw(mz) * 0.95 + 0.11);
    const housing = new THREE.SphereGeometry(1, 16, 10).scale(0.07, 0.065, 0.12).translate(mx, my, mz);
    add(housing, paint);
    const stalk = new THREE.BoxGeometry(0.1, 0.03, 0.06).translate(mx - side * 0.06, my - 0.02, mz + 0.01);
    add(stalk, sharedMats.trim, body, false);
    const mglass = new THREE.CircleGeometry(1, 16).scale(0.055, 0.045, 1).rotateY(Math.PI).translate(mx, my, mz - 0.121);
    add(mglass, sharedMats.chrome, body, false);
  }
  // hood / trunk shut lines across the top
  const across = (z: number) => {
    const a = section(d, z - 0.004), b = section(d, z + 0.004);
    const pos: number[] = [];
    for (const side of [1, -1]) for (let k = 5; k < 9; k++) {
      const p = [a[k], b[k], b[k + 1], a[k + 1]].map(([x, y], i) => [x * side, y + 0.003, i === 0 || i === 3 ? z - 0.004 : z + 0.004]);
      const tri = side > 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
      for (const t of tri) pos.push(...p[t]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    add(g, sharedMats.seam, body, false);
  };
  across(d.zC + 0.03);
  if (d.sedan) across(d.rwBase - 0.03);

  // front: headlights, grille, intakes, fog lamps
  const ybF = Math.min(d.belt, d.top(L / 2 - 0.12) - 0.03);
  for (const side of [1, -1]) {
    const x = side * (W / 2 - 0.34);
    const z = frontZ(d, x);
    const yaw = planYaw(d, x, true);
    const bezel = lens(0.5, 0.14, 0.015);
    bezel.rotateY(yaw).translate(x, ybF - 0.09, z - 0.03);
    add(bezel, sharedMats.reflector, body, false);
    const l = lens(0.46, 0.105, 0.02);
    l.rotateY(yaw).translate(x, ybF - 0.09, z - 0.016);
    add(l, head, body, false);
    for (const off of [-0.09, 0.07]) {
      const proj = new THREE.CylinderGeometry(0.032, 0.036, 0.03, 18).rotateX(Math.PI / 2).rotateY(yaw).translate(x - side * off, ybF - 0.085, z + 0.004);
      add(proj, sharedMats.reflector, body, false);
    }
    const drl = new THREE.BoxGeometry(0.34, 0.012, 0.012).rotateY(yaw).translate(x, ybF - 0.142, z + 0.002);
    add(drl, head, body, false);
    const ind = lens(0.07, 0.05, 0.015);
    ind.rotateY(yaw).translate(x + side * 0.24, ybF - 0.09, frontZ(d, x + side * 0.24) - 0.014);
    add(ind, side > 0 ? amberL : amberR, body, false);
    const fz = frontZ(d, side * (W / 2 - 0.3));
    const fog = new THREE.CylinderGeometry(0.045, 0.045, 0.02, 16).rotateX(Math.PI / 2).translate(side * (W / 2 - 0.3), c + 0.32, fz - 0.025);
    add(fog, sharedMats.reflector, body, false);
    // rear lights
    const rx = side * (W / 2 - 0.26);
    const rz = -frontZ(d, rx);
    const ybR = Math.min(d.belt, d.top(-L / 2 + 0.12) - 0.03);
    const tl = lens(0.34, d.sedan ? 0.13 : 0.2, 0.02);
    tl.rotateY(planYaw(d, rx, false)).translate(rx, ybR - (d.sedan ? 0.08 : 0.04), rz + 0.016);
    add(tl, tail, body, false);
    const ri = lens(0.08, 0.05, 0.015);
    ri.rotateY(planYaw(d, rx - side * 0.21, false)).translate(rx - side * 0.21, ybR - (d.sedan ? 0.08 : 0.04), -frontZ(d, rx - side * 0.21) + 0.02);
    add(ri, side > 0 ? amberL : amberR, body, false);
  }
  const grille = new THREE.BoxGeometry(W * 0.4, 0.15, 0.03).translate(0, ybF - 0.12, L / 2 - 0.012);
  add(grille, sharedMats.trim, body, false);
  for (let k = 0; k < 3; k++) add(new THREE.BoxGeometry(W * 0.38, 0.012, 0.02).translate(0, ybF - 0.17 + k * 0.045, L / 2 + 0.006), sharedMats.chrome, body, false);
  add(new THREE.BoxGeometry(W * 0.56, 0.1, 0.04).translate(0, c + 0.24, frontZ(d, W * 0.28) - 0.01), sharedMats.plastic, body, false);
  add(new THREE.BoxGeometry(W * 0.7, 0.09, 0.05).translate(0, c + 0.2, -frontZ(d, W * 0.35) + 0.015), sharedMats.plastic, body, false);
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 12).rotateX(Math.PI / 2).translate(-W * 0.3, c + 0.17, -L / 2 + 0.02), sharedMats.chrome, body, false);
  // wipers + roof antenna
  for (const sx of [-0.25, 0.25]) {
    const wpr = new THREE.BoxGeometry(0.5, 0.012, 0.012);
    wpr.rotateY(sx > 0 ? 0.12 : 0.12).translate(sx, d.top(d.zC - 0.06) + 0.01, d.zC - 0.06);
    add(wpr, sharedMats.trim, body, false);
  }
  const fin = new THREE.ConeGeometry(0.035, 0.07, 4).scale(1, 1, 2.2).translate(0, d.top(d.zRB + 0.15) + 0.03, d.zRB + 0.15);
  add(fin, sharedMats.trim, body, false);

  // plates
  const plateTex = tex.plate(custom.plate);
  const plateMat = new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.4 });
  disposables.push(plateTex, plateMat);
  add(new THREE.PlaneGeometry(0.52, 0.113), plateMat, body, false).position.set(0, c + 0.24, L / 2 + 0.012);
  const pb = add(new THREE.PlaneGeometry(0.52, 0.113), plateMat, body, false);
  pb.position.set(0, d.sedan ? c + 0.4 : c + 0.45, -L / 2 - 0.012);
  pb.rotation.y = Math.PI;

  // wheel-arch liners
  for (const zw of [d.wb / 2, -d.wb / 2])
    for (const side of [1, -1]) {
      const liner = new THREE.CylinderGeometry(r + 0.07, r + 0.07, 0.28, 20, 1, true, 0, Math.PI);
      liner.rotateZ(Math.PI / 2).translate(side * (W / 2 - 0.18), r, zw);
      const m = add(liner, sharedMats.plastic, body, false);
      m.material = sharedMats.plastic;
      (m.material as THREE.Material).side = THREE.DoubleSide;
    }

  // interior
  const seatZ = d.zC - 1.05;
  add(new THREE.BoxGeometry(W - 0.3, 0.2, 0.5).translate(0, d.belt - 0.06, d.zC - 0.28), sharedMats.interior, body, false);
  add(new THREE.BoxGeometry(0.22, 0.25, 0.7).translate(0, d.belt - 0.38, seatZ + 0.3), sharedMats.interior, body, false);
  for (const sx of [1, -1]) {
    add(new THREE.BoxGeometry(0.5, 0.13, 0.52).translate(sx * 0.36, d.belt - 0.42, seatZ), sharedMats.seat, body, false);
    add(new THREE.BoxGeometry(0.48, 0.62, 0.12).rotateX(-0.12).translate(sx * 0.36, d.belt - 0.08, seatZ - 0.3), sharedMats.seat, body, false);
    add(new THREE.BoxGeometry(0.26, 0.16, 0.1).translate(sx * 0.36, d.belt + 0.3, seatZ - 0.36), sharedMats.seat, body, false);
  }
  if (spec.body !== 'hatch' || L > 3.6) add(new THREE.BoxGeometry(W - 0.36, 0.5, 0.14).translate(0, d.belt - 0.14, Math.max(d.zRB + 0.25, seatZ - 0.95)), sharedMats.seat, body, false);
  const steering = new THREE.Group();
  steering.position.set(0.36, d.belt + 0.06, d.zC - 0.62);
  steering.rotation.x = -0.45;
  body.add(steering);
  add(new THREE.TorusGeometry(0.17, 0.022, 10, 28), sharedMats.trim, steering, false);
  add(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 14).rotateX(Math.PI / 2), sharedMats.trim, steering, false);
  add(new THREE.BoxGeometry(0.3, 0.035, 0.02), sharedMats.trim, steering, false);

  // wheels
  const tyre = tyreGeo(r, 0.205, 32);
  const rim = rimGeo(r, 0.205, ws.spokes, 28);
  disposables.push(tyre, rim);
  const wheels: VehicleModel['wheels'] = [];
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * (W / 2 - 0.15), r, (sz * d.wb) / 2);
    const spin = new THREE.Group();
    pivot.add(spin);
    const holder = new THREE.Group();
    holder.scale.x = sx;
    spin.add(holder);
    const t = new THREE.Mesh(tyre, sharedMats.tire);
    t.castShadow = true;
    holder.add(t, new THREE.Mesh(rim, rimMat));
    const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.16), ws.spokes >= 6 ? new THREE.MeshStandardMaterial({ color: '#b3261e', roughness: 0.4 }) : sharedMats.disc);
    caliper.position.set(sx * -0.02, r * 0.38, sz * -0.06);
    pivot.add(caliper);
    root.add(pivot);
    wheels.push({ pivot, spin, front: sz > 0 });
  }

  let spot: THREE.SpotLight | null = null;
  if (withSpot) {
    spot = new THREE.SpotLight('#fff3dc', 0, 55, 0.62, 0.55, 1.6);
    spot.position.set(0, d.belt - 0.15, L / 2);
    spot.target.position.set(0, -1.5, L / 2 + 14);
    root.add(spot, spot.target);
  }
  body.traverse((o) => ((o as THREE.Mesh).receiveShadow = true));
  return { root, body, wheels, steering, paint, glass, head, tail, amberL, amberR, spot, dispose: () => disposables.forEach((x) => x.dispose()) };
}

// ------------------------------------------------------------------ low detail (traffic, parked cars)
export interface LowGeo {
  body: THREE.BufferGeometry;
  glass: THREE.BufferGeometry;
  dark: THREE.BufferGeometry;
  lights: THREE.BufferGeometry;
}

const lowCache = new Map<string, LowGeo>();

function colorize(g: THREE.BufferGeometry, hex: string) {
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

const ni = (g: THREE.BufferGeometry) => {
  const n = g.index ? g.toNonIndexed() : g;
  if (!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(n.attributes.position.count * 2).fill(0), 2));
  if (!n.attributes.normal) n.computeVertexNormals();
  return n;
};

export function lowGeometry(spec: VehicleSpec): LowGeo {
  const hit = lowCache.get(spec.id);
  if (hit) return hit;
  const d = bodyDef(spec);
  const { L, W, r, c } = d;
  const lf = loft(d, 0.6);
  const body = ni(lf.paint);
  const glassParts = [ni(lf.glass)];
  if (d.van) glassParts.push(ni(new THREE.PlaneGeometry(W * 0.62, 0.55).rotateY(Math.PI).translate(0, d.H - 0.42, -L / 2 - 0.002)));
  const glass = mergeGeometries(glassParts)!;
  const darkParts: THREE.BufferGeometry[] = [];
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
    darkParts.push(ni(tyreGeo(r, 0.2, 14).translate(sx * (W / 2 - 0.15), r, (sz * d.wb) / 2)));
  }
  const ybF = Math.min(d.belt, d.top(L / 2 - 0.12) - 0.03);
  darkParts.push(ni(new THREE.BoxGeometry(W * 0.4, 0.15, 0.03).translate(0, ybF - 0.12, L / 2 - 0.012)));
  darkParts.push(ni(new THREE.BoxGeometry(W * 0.56, 0.1, 0.04).translate(0, c + 0.24, frontZ(d, W * 0.28) - 0.01)));
  darkParts.push(ni(new THREE.BoxGeometry(W * 0.7, 0.09, 0.05).translate(0, c + 0.2, -frontZ(d, W * 0.35) + 0.015)));
  const dark = mergeGeometries(darkParts)!;
  const lightParts: THREE.BufferGeometry[] = [];
  for (const side of [1, -1]) {
    const x = side * (W / 2 - 0.34);
    lightParts.push(colorize(ni(lens(0.46, 0.105, 0.02).rotateY(planYaw(d, x, true)).translate(x, ybF - 0.09, frontZ(d, x) - 0.016)), '#c9d0d4'));
    const rx = side * (W / 2 - 0.26);
    const ybR = Math.min(d.belt, d.top(-L / 2 + 0.12) - 0.03);
    lightParts.push(colorize(ni(lens(0.34, d.sedan ? 0.13 : 0.2, 0.02).rotateY(planYaw(d, rx, false)).translate(rx, ybR - (d.sedan ? 0.08 : 0.04), -frontZ(d, rx) + 0.016)), '#7a1210'));
  }
  const lights = mergeGeometries(lightParts)!;
  const res = { body, glass, dark, lights };
  lowCache.set(spec.id, res);
  return res;
}

export const lowMats = {
  glass: new THREE.MeshStandardMaterial({ color: '#141c21', roughness: 0.05, metalness: 0.5, envMapIntensity: 1.4 }),
  dark: sharedMats.trim,
  lights: new THREE.MeshBasicMaterial({ vertexColors: true }),
};

const paintCache = new Map<string, THREE.MeshStandardMaterial>();
export function lowPaint(hex: string) {
  let m = paintCache.get(hex);
  if (!m) paintCache.set(hex, (m = new THREE.MeshStandardMaterial({ color: hex, metalness: 0.55, roughness: 0.3, envMapIntensity: 1.1 })));
  return m;
}
