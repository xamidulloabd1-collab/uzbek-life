import * as THREE from 'three';
import type { Vec2 } from '@/types';
import { NET, groundAt, type Edge } from '@/game/world/guzor/network';

/** central GPS: A* over the road graph, route ribbon, remaining distance, ETA and next turn — used by every job */
export class Navigator {
  route: Vec2[] = [];
  target: Vec2 | null = null;
  distance = 0;
  eta = 0;
  turn: { dir: 'chap' | 'o‘ng' | 'to‘g‘ri'; dist: number } | null = null;
  readonly mesh: THREE.Mesh;
  private calcTimer = 0;
  private cum: number[] = [];

  constructor() {
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: '#2bb3c0', transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
    this.mesh.renderOrder = 3;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  setTarget(t: Vec2 | null) {
    const changed = !t !== !this.target || (t && this.target && Math.hypot(t.x - this.target.x, t.z - this.target.z) > 1);
    this.target = t;
    if (changed) this.calcTimer = 0;
  }

  update(dt: number, pos: Vec2, speedKmh: number) {
    if (!this.target) {
      this.route = [];
      this.mesh.visible = false;
      this.turn = null;
      return;
    }
    this.calcTimer -= dt;
    const off = this.offRoute(pos);
    if (this.calcTimer <= 0 || off > 24) {
      this.route = findPath(pos, this.target);
      this.cum = [0];
      for (let i = 1; i < this.route.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(this.route[i].x - this.route[i - 1].x, this.route[i].z - this.route[i - 1].z));
      this.buildMesh();
      this.calcTimer = 4;
    }
    // progress along the route
    const { i, t } = this.closest(pos);
    const along = this.cum[i] + t * ((this.cum[i + 1] ?? this.cum[i]) - this.cum[i]);
    this.distance = Math.max(0, (this.cum[this.cum.length - 1] ?? 0) - along);
    this.eta = this.distance / (Math.max(speedKmh, 30) / 3.6);
    this.turn = null;
    for (let k = i + 1; k < this.route.length - 1; k++) {
      const a = this.route[k - 1], b = this.route[k], c = this.route[k + 1];
      const h1 = Math.atan2(b.x - a.x, b.z - a.z), h2 = Math.atan2(c.x - b.x, c.z - b.z);
      let d = h2 - h1;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      const dist = this.cum[k] - along;
      if (dist > 400) break;
      if (Math.abs(d) > 0.6 && dist > 12) {
        this.turn = { dir: d > 0 ? 'chap' : 'o‘ng', dist };
        break;
      }
    }
    if (!this.turn) this.turn = { dir: 'to‘g‘ri', dist: this.distance };
    this.mesh.visible = this.route.length > 1;
  }

  private closest(p: Vec2) {
    let best = { i: 0, t: 0, d: Infinity };
    for (let i = 0; i < this.route.length - 1; i++) {
      const a = this.route[i], b = this.route[i + 1];
      const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2));
      const d = Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
      if (d < best.d) best = { i, t, d };
    }
    return best;
  }

  private offRoute(p: Vec2) {
    return this.route.length < 2 ? Infinity : this.closest(p).d;
  }

  private buildMesh() {
    const pos: number[] = [];
    const pts: Vec2[] = [];
    for (let i = 0; i < this.route.length - 1; i++) {
      const a = this.route[i], b = this.route[i + 1], L = Math.hypot(b.x - a.x, b.z - a.z);
      for (let s = 0; s < L; s += 4) pts.push({ x: a.x + ((b.x - a.x) * s) / L, z: a.z + ((b.z - a.z) * s) / L });
    }
    if (this.route.length) pts.push(this.route[this.route.length - 1]);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], L = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const nx = (-(b.z - a.z) / L) * 0.7, nz = ((b.x - a.x) / L) * 0.7;
      const ya = groundAt(a.x, a.z) + 0.22, yb = groundAt(b.x, b.z) + 0.22;
      pos.push(a.x + nx, ya, a.z + nz, b.x + nx, yb, b.z + nz, a.x - nx, ya, a.z - nz, a.x - nx, ya, a.z - nz, b.x + nx, yb, b.z + nz, b.x - nx, yb, b.z - nz);
    }
    this.mesh.geometry.dispose();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.mesh.geometry = g;
  }
}

/** shortest road route between two points (A* on the network); falls back to a straight line off the network */
export function findPath(from: Vec2, to: Vec2): Vec2[] {
  const a = NET.nearestRoad(from.x, from.z, 60) ?? NET.nearestRoad(from.x, from.z, 200);
  const b = NET.nearestRoad(to.x, to.z, 60) ?? NET.nearestRoad(to.x, to.z, 200);
  if (!a || !b) return [from, to];
  const pa = { x: a.px, z: a.pz }, pb = { x: b.px, z: b.pz };
  if (a.e.id === b.e.id) return [from, pa, ...between(a.e, a.s, b.s), pb, to];
  const N = NET.nodes;
  const g = new Map<number, number>(), came = new Map<number, number>(), via = new Map<number, number>();
  const open: number[] = [];
  const h = (n: number) => Math.hypot(N[n].x - pb.x, N[n].z - pb.z);
  // start: both ends of the starting edge
  for (const [n, cost] of [[a.e.a, a.s], [a.e.b, a.e.len - a.s]] as const) {
    if (!g.has(n) || cost < g.get(n)!) { g.set(n, cost); came.set(n, -1); open.push(n); }
  }
  const goal = new Map<number, number>([[b.e.a, b.s], [b.e.b, b.e.len - b.s]]);
  let best = -1, bestCost = Infinity;
  const closed = new Set<number>();
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (g.get(open[i])! + h(open[i]) < g.get(open[bi])! + h(open[bi])) bi = i;
    const u = open.splice(bi, 1)[0];
    if (closed.has(u)) continue;
    closed.add(u);
    const gu = g.get(u)!;
    if (gu >= bestCost) break;
    if (goal.has(u) && gu + goal.get(u)! < bestCost) { bestCost = gu + goal.get(u)!; best = u; }
    for (const eid of N[u].edges) {
      const e = NET.edges[eid];
      const v = e.a === u ? e.b : e.a;
      const c = gu + e.len * (e.cls === 'lane' ? 3 : 1);
      if (c < (g.get(v) ?? Infinity)) { g.set(v, c); came.set(v, u); via.set(v, eid); open.push(v); }
    }
  }
  if (best < 0) return [from, to];
  const nodes: number[] = [];
  for (let n = best; n !== -1; n = came.get(n) ?? -1) nodes.unshift(n);
  const out: Vec2[] = [from, pa];
  out.push(...between(a.e, a.s, nodes[0] === a.e.a ? 0 : a.e.len));
  for (let i = 1; i < nodes.length; i++) {
    const e = NET.edges[via.get(nodes[i])!];
    const pts = e.a === nodes[i - 1] ? e.pts : [...e.pts].reverse();
    out.push(...pts);
  }
  const last = nodes[nodes.length - 1];
  out.push(...between(b.e, last === b.e.a ? 0 : b.e.len, b.s), pb, to);
  return out;
}

/** points of an edge between two arc-length positions (in travel order) */
function between(e: Edge, s0: number, s1: number): Vec2[] {
  const out: Vec2[] = [];
  const fwd = s1 >= s0;
  const idx = e.cum.map((c, i) => ({ c, i })).filter(({ c }) => (fwd ? c > s0 && c < s1 : c < s0 && c > s1));
  if (!fwd) idx.reverse();
  for (const { i } of idx) out.push(e.pts[i]);
  return out;
}

export const NAV = new Navigator();
