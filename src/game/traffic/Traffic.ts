import * as THREE from 'three';
import { NET, SPEED, baseH, type Edge } from '@/game/world/guzor/network';
import { VEHICLES, VEHICLE_MAP, TRAFFIC_COLORS, categoryOf } from '@/config/vehicles';
import type { VehicleCategory, VehicleSpec } from '@/types';

const DISTRICT_WEIGHTS: Record<string, Partial<Record<VehicleCategory, number>>> = {
  downtown: { sedan: 4, suv: 3, hatchback: 2, sports: 1.2, bus: 0.6, emergency: 0.4, van: 1, classic: 0.4, service: 0.5 },
  mahalla: { sedan: 4, hatchback: 3, van: 2.5, classic: 1.2, pickup: 0.8, suv: 1 },
  apartments: { sedan: 4, hatchback: 3, suv: 2, van: 1.5, bus: 0.6, service: 0.4 },
  industrial: { truck: 3, van: 3, pickup: 2.5, sedan: 2, service: 1.5, hatchback: 1 },
  village: { van: 2.5, pickup: 2.5, classic: 2, sedan: 2, truck: 1, hatchback: 1 },
  ring: { truck: 2.5, bus: 1.2, sedan: 3, suv: 2.5, van: 1.5, pickup: 1.5, sports: 0.6 },
};
import { lowGeometry, lowMats, lowPaint } from '@/game/vehicles/vehicleModel';
import type { Obstacle } from '@/game/vehicles/VehiclePhysics';
import { clamp, pick } from '@/utils/math';

interface Car {
  mesh: THREE.Group;
  e: number;
  dir: number;
  s: number;
  speed: number;
  turning: { p0: THREE.Vector2; p1: THREE.Vector2; p2: THREE.Vector2; t: number; len: number; ne: number; ndir: number; s0: number } | null;
  stun: number;
  x: number;
  z: number;
  heading: number;
  len: number;
  active: boolean;
  specId: string;
  color: string;
}

const ZONE_WEIGHTS: Record<string, string> = { center: 'downtown', mahalla: 'mahalla', villas: 'apartments', industrial: 'industrial', village: 'village', fields: 'ring' };

/** junction radius: cars leave the straight lane this far from the node centre */
function nodeR(id: number) {
  const n = NET.nodes[id];
  if (n.roundabout) return 22;
  let w = 0;
  for (const e of n.edges) w = Math.max(w, NET.edges[e].width);
  return w / 2 + 2.5;
}
const endNode = (e: Edge, dir: number) => (dir > 0 ? e.b : e.a);
const startNode = (e: Edge, dir: number) => (dir > 0 ? e.a : e.b);
/** lane position on an edge, s measured from the start node in travel direction */
function lanePos(e: Edge, dir: number, s: number) {
  const p = NET.pointAt(e, dir > 0 ? s : e.len - s);
  const tx = p.tx * dir, tz = p.tz * dir;
  return { x: p.x - tz * e.lane, z: p.z + tx * e.lane, tx, tz };
}

export interface TrafficCarInfo { ref: object; speed: number; specId: string; color: string; x: number; z: number; heading: number }

export class Traffic {
  readonly group = new THREE.Group();
  private cars: Car[] = [];
  private pool: Car[] = [];
  target = 12;
  lightPhaseTime = 0;
  phase = 0;
  readonly obstacles: Obstacle[] = [];

  constructor(max: number) {
    for (let n = 0; n < max; n++) {
      const spec = VEHICLES[n % VEHICLES.length];
      const g = lowGeometry(spec);
      const mesh = new THREE.Group();
      const body = new THREE.Mesh(g.body, lowPaint(pick(Math.random, TRAFFIC_COLORS)));
      body.castShadow = true;
      mesh.add(body, new THREE.Mesh(g.glass, lowMats.glass), new THREE.Mesh(g.dark, lowMats.dark), new THREE.Mesh(g.lights, lowMats.lights));
      mesh.visible = false;
      this.group.add(mesh);
      this.pool.push({ mesh, e: 0, dir: 1, s: 0, speed: 0, turning: null, stun: 0, x: 0, z: 0, heading: 0, len: spec.dims.length, active: false, specId: spec.id, color: '#f2f2ef' });
    }
  }

  /** 0: group-0 green, 1: group-0 yellow, 2: group-1 green, 3: group-1 yellow */
  private updateLights(dt: number) {
    this.lightPhaseTime = (this.lightPhaseTime + dt) % 26;
    const t = this.lightPhaseTime;
    this.phase = t < 10 ? 0 : t < 13 ? 1 : t < 23 ? 2 : 3;
  }

  private green(group: number) {
    return (group === 0 && this.phase === 0) || (group === 1 && this.phase === 2);
  }

  /** loaded GLB models per spec (clone source); missing ones fall back to the procedural low-detail body */
  private models = new Map<string, THREE.Object3D>();
  /** asks the game to lazy-load a catalog model the first time it is needed */
  onNeedModel: ((specId: string) => void) | null = null;

  private buildMesh(car: Car) {
    car.mesh.clear();
    const spec = VEHICLE_MAP[car.specId];
    const src = this.models.get(car.specId);
    if (src) {
      const clone = src.clone(true);
      const box = new THREE.Box3().setFromObject(clone);
      const size = box.getSize(new THREE.Vector3());
      clone.rotation.y = (size.z >= size.x ? 0 : Math.PI / 2) + ((src.userData.rotateY as number) ?? 0);
      const holder = new THREE.Group();
      holder.add(clone);
      holder.updateMatrixWorld(true);
      const b2 = new THREE.Box3().setFromObject(holder);
      const k = car.len / Math.max(b2.max.x - b2.min.x, b2.max.z - b2.min.z);
      holder.scale.setScalar(k);
      holder.position.set(-((b2.min.x + b2.max.x) / 2) * k, -b2.min.y * k, -((b2.min.z + b2.max.z) / 2) * k);
      holder.traverse((o) => ((o as THREE.Mesh).castShadow = true));
      car.mesh.add(holder);
      return;
    }
    const g = lowGeometry(spec);
    const body = new THREE.Mesh(g.body, lowPaint(car.color));
    body.castShadow = true;
    car.mesh.add(body, new THREE.Mesh(g.glass, lowMats.glass), new THREE.Mesh(g.dark, lowMats.dark), new THREE.Mesh(g.lights, lowMats.lights));
  }

  setModel(specId: string, obj: THREE.Object3D) {
    this.models.set(specId, obj);
    for (const c of this.pool) if (c.specId === specId) this.buildMesh(c);
  }

  /** compatibility with the GLB library: register several models at once */
  applyModels(models: Map<string, THREE.Object3D>) {
    for (const [id, obj] of models) this.setModel(id, obj);
  }

  /** weighted pick: district-appropriate categories, catalog/GLB models preferred, no twins nearby */
  private chooseSpec(x: number, z: number, e: Edge): VehicleSpec {
    const w = DISTRICT_WEIGHTS[e.cls === 'highway' ? 'ring' : ZONE_WEIGHTS[e.zone] ?? 'ring'];
    const real = VEHICLES.filter((v) => v.modelUrl || this.models.has(v.id));
    const pool = real.length ? real : VEHICLES;
    let total = 0;
    const weights = pool.map((v) => {
      let wt = (w[categoryOf(v)] ?? 0.3) * (v.weight ?? 1);
      if (v.id === 'amir' && !v.modelUrl) wt *= 0.8;
      if (this.cars.some((c) => c.specId === v.id && Math.hypot(c.x - x, c.z - z) < 70)) wt *= 0.2;
      total += wt;
      return wt;
    });
    let r = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) return pool[i];
    }
    return pool[0];
  }

  private spawn(px: number, pz: number, minR: number, maxR: number) {
    const car = this.pool.find((c) => !c.active);
    if (!car) return;
    for (let tries = 0; tries < 14; tries++) {
      const a = Math.random() * Math.PI * 2, r = minR + Math.random() * (maxR - minR);
      const hit = NET.nearestRoad(px + Math.cos(a) * r, pz + Math.sin(a) * r, 40);
      if (!hit || hit.e.cls === 'lane') continue;
      const e = hit.e;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const r0 = nodeR(startNode(e, dir)), r1 = nodeR(endNode(e, dir));
      if (e.len - r0 - r1 < 8) continue;
      const s = r0 + Math.random() * (e.len - r0 - r1 - 6);
      const p = lanePos(e, dir, s);
      const dist = Math.hypot(p.x - px, p.z - pz);
      if (dist < minR || dist > maxR) continue;
      if (this.cars.some((c) => Math.hypot(c.x - p.x, c.z - p.z) < 12)) continue;
      const spec = this.chooseSpec(p.x, p.z, e);
      car.specId = spec.id;
      car.len = spec.dims.length;
      car.color = pick(Math.random, TRAFFIC_COLORS);
      this.buildMesh(car);
      if (spec.modelUrl && !this.models.has(spec.id)) this.onNeedModel?.(spec.id);
      Object.assign(car, { e: e.id, dir, s, speed: SPEED[e.cls] * 0.7, turning: null, stun: 0, x: p.x, z: p.z, heading: Math.atan2(p.tx, p.tz), active: true });
      car.mesh.visible = true;
      this.cars.push(car);
      return;
    }
  }

  private despawn(car: Car) {
    car.active = false;
    car.mesh.visible = false;
    this.cars.splice(this.cars.indexOf(car), 1);
  }

  /** `blockers` are the player / player car (cars brake for them) */
  update(dt: number, px: number, pz: number, blockers: { x: number; z: number; r: number }[], activeRadius: number) {
    this.updateLights(dt);
    const want = Math.round(this.target);
    if (this.cars.length < want) this.spawn(px, pz, 70, Math.min(activeRadius, 240));
    for (const c of [...this.cars]) {
      if (Math.hypot(c.x - px, c.z - pz) > Math.min(activeRadius, 260) + 30 || this.cars.length > want + 2) this.despawn(c);
    }

    for (const c of this.cars) {
      const e = NET.edges[c.e];
      const limit = SPEED[e.cls];
      let desired = limit;
      const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
      for (const o of this.cars) {
        if (o === c) continue;
        const dx = o.x - c.x, dz = o.z - c.z;
        const along = dx * fx + dz * fz;
        const lat = Math.abs(-dx * fz + dz * fx);
        if (along > 0 && along < 22 && lat < 2.2) desired = Math.min(desired, Math.max(0, (along - 6) * 0.9));
      }
      for (const b of blockers) {
        const dx = b.x - c.x, dz = b.z - c.z;
        const along = dx * fx + dz * fz;
        const lat = Math.abs(-dx * fz + dz * fx);
        if (along > 0 && along < 18 && lat < 1.6 + b.r) desired = Math.min(desired, Math.max(0, (along - 4 - b.r) * 1.1));
      }
      if (!c.turning) {
        const en = endNode(e, c.dir);
        const stop = e.len - nodeR(en) - 1.5;
        if (NET.nodes[en].light && !this.green(NET.lightGroup(e, en)) && c.s < stop + 0.5 && c.s > stop - 30) {
          desired = Math.min(desired, Math.max(0, (stop - c.s) * 0.7));
        }
      }
      if (c.stun > 0) {
        c.stun -= dt;
        desired = 0;
      }
      const acc = desired > c.speed ? 2.6 : 7;
      c.speed += clamp(desired - c.speed, -acc * dt, acc * dt);

      if (c.turning) {
        const T = c.turning;
        T.t = Math.min(1, T.t + (c.speed * dt) / T.len);
        const t = T.t, it = 1 - t;
        const x = it * it * T.p0.x + 2 * it * t * T.p1.x + t * t * T.p2.x;
        const z = it * it * T.p0.y + 2 * it * t * T.p1.y + t * t * T.p2.y;
        const tx = 2 * it * (T.p1.x - T.p0.x) + 2 * t * (T.p2.x - T.p1.x);
        const tz = 2 * it * (T.p1.y - T.p0.y) + 2 * t * (T.p2.y - T.p1.y);
        c.x = x;
        c.z = z;
        if (Math.hypot(tx, tz) > 1e-4) c.heading = Math.atan2(tx, tz);
        if (T.t >= 1) {
          c.e = T.ne;
          c.dir = T.ndir;
          c.s = T.s0;
          c.turning = null;
        }
      } else {
        c.s += c.speed * dt;
        const p = lanePos(e, c.dir, Math.min(c.s, e.len));
        c.x = p.x;
        c.z = p.z;
        c.heading = Math.atan2(p.tx, p.tz);
        if (c.s >= e.len - nodeR(endNode(e, c.dir))) this.beginTurn(c);
      }
      c.mesh.position.set(c.x, baseH(c.x, c.z) + 0.06, c.z);
      c.mesh.rotation.y = c.heading;
    }

    this.obstacles.length = 0;
    for (const c of this.cars) {
      const fx = Math.sin(c.heading) * c.len * 0.28, fz = Math.cos(c.heading) * c.len * 0.28;
      const hit = (imp: number) => {
        c.stun = Math.max(c.stun, 2 + imp * 0.2);
        c.speed = 0;
      };
      this.obstacles.push({ x: c.x + fx, z: c.z + fz, r: 0.95, onHit: hit }, { x: c.x - fx, z: c.z - fz, r: 0.95, onHit: hit });
    }
  }

  private beginTurn(c: Car) {
    const e = NET.edges[c.e];
    const nId = endNode(e, c.dir);
    const node = NET.nodes[nId];
    const din = lanePos(e, c.dir, e.len - nodeR(nId));
    const all = node.edges.filter((id) => id !== e.id || node.edges.length === 1);
    const roads = all.filter((id) => NET.edges[id].cls !== 'lane');
    const options = roads.length ? roads : all;
    let ne = e.id;
    if (options.length) {
      // prefer going straight on
      const scored = options.map((id) => {
        const x = NET.edges[id];
        const q = nId === x.a ? x.pts[1] : x.pts[x.pts.length - 2];
        const dx = q.x - node.x, dz = q.z - node.z, l = Math.hypot(dx, dz) || 1;
        return { id, dot: (dx * din.tx + dz * din.tz) / l };
      });
      const straight = scored.reduce((a, b) => (b.dot > a.dot ? b : a));
      ne = straight.dot > 0.8 && Math.random() < 0.55 ? straight.id : pick(Math.random, scored).id;
    }
    const nx = NET.edges[ne];
    const ndir = nx.a === nId && !(ne === e.id && nx.b === nId && c.dir < 0) ? 1 : -1;
    const s0 = nodeR(nId);
    const out = lanePos(nx, ndir, Math.min(s0, nx.len / 2));
    const p0 = new THREE.Vector2(c.x, c.z);
    const p2 = new THREE.Vector2(out.x, out.z);
    const turn = din.tx * out.tx + din.tz * out.tz;
    let p1: THREE.Vector2;
    if (node.roundabout) {
      const mx = (p0.x + p2.x) / 2 - node.x, mz = (p0.y + p2.y) / 2 - node.z;
      const ml = Math.hypot(mx, mz);
      const ux = ml > 2 ? mx / ml : din.tz, uz = ml > 2 ? mz / ml : -din.tx;
      p1 = new THREE.Vector2(node.x + ux * 26, node.z + uz * 26);
    } else if (turn > 0.94) p1 = p0.clone().add(p2).multiplyScalar(0.5);
    else if (turn < -0.9) p1 = new THREE.Vector2(node.x + din.tx * 4, node.z + din.tz * 4);
    else {
      // control point: where the incoming and outgoing lane lines meet
      const den = din.tx * out.tz - din.tz * out.tx;
      const t = ((p2.x - p0.x) * out.tz - (p2.y - p0.y) * out.tx) / (Math.abs(den) < 1e-4 ? 1e-4 : den);
      p1 = new THREE.Vector2(p0.x + din.tx * t, p0.y + din.tz * t);
      if (p1.distanceTo(p0) > 40) p1 = new THREE.Vector2(node.x, node.z);
    }
    const len = Math.max(1, p0.distanceTo(p1) + p1.distanceTo(p2));
    c.turning = { p0, p1, p2, t: 0, len, ne, ndir, s0: Math.min(s0, nx.len / 2) };
  }

  nearestCar(x: number, z: number, maxD: number): TrafficCarInfo | null {
    let best: Car | null = null;
    let bd = maxD;
    for (const c of this.cars) {
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best ? { ref: best, speed: best.speed, specId: best.specId, color: best.color, x: best.x, z: best.z, heading: best.heading } : null;
  }

  removeCar(ref: object) {
    const c = ref as Car;
    if (c.active) this.despawn(c);
  }

  get count() {
    return this.cars.length;
  }

  /** nearest traffic car distance (for ambient audio) */
  nearest(px: number, pz: number) {
    let best = Infinity;
    for (const c of this.cars) best = Math.min(best, Math.hypot(c.x - px, c.z - pz));
    return best;
  }
}
