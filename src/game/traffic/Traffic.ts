import * as THREE from 'three';
import { DIRS, HALF, LANE, N, PITCH, ROAD, districtOf, isLightNode, nodePos, nodeValid, rightOf, segmentSpeed } from '@/game/world/cityLayout';
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
  k: number;
  l: number;
  d: number;
  s: number;
  speed: number;
  turning: { p0: THREE.Vector2; p1: THREE.Vector2; p2: THREE.Vector2; t: number; len: number; nd: number } | null;
  stun: number;
  x: number;
  z: number;
  heading: number;
  len: number;
  active: boolean;
  specId: string;
  color: string;
}

export interface TrafficCarInfo { ref: object; speed: number; specId: string; color: string; x: number; z: number; heading: number }

const START = ROAD / 2 + 1.5;
const END = PITCH - ROAD / 2 - 1.5;
const STOP = PITCH - ROAD / 2 - 4.5;

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
      this.pool.push({ mesh, k: 0, l: 0, d: 0, s: 0, speed: 0, turning: null, stun: 0, x: 0, z: 0, heading: 0, len: spec.dims.length, active: false, specId: spec.id, color: '#f2f2ef' });
    }
  }

  /** 0: X green, 1: X yellow, 2: Z green, 3: Z yellow */
  private updateLights(dt: number) {
    this.lightPhaseTime = (this.lightPhaseTime + dt) % 26;
    const t = this.lightPhaseTime;
    this.phase = t < 10 ? 0 : t < 13 ? 1 : t < 23 ? 2 : 3;
  }

  private green(d: number) {
    return (d % 2 === 0 && this.phase === 0) || (d % 2 === 1 && this.phase === 2);
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
  private chooseSpec(x: number, z: number): VehicleSpec {
    const fx = Math.min(N - 1, Math.max(0, Math.floor((x + HALF) / PITCH)));
    const fz = Math.min(N - 1, Math.max(0, Math.floor((z + HALF) / PITCH)));
    const ring = Math.abs(x) > HALF - ROAD || Math.abs(z) > HALF - ROAD;
    const w = ring ? DISTRICT_WEIGHTS.ring : DISTRICT_WEIGHTS[districtOf(fx, fz)];
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
    for (let tries = 0; tries < 12; tries++) {
      const k = Math.floor(Math.random() * (N + 1));
      const l = Math.floor(Math.random() * (N + 1));
      const d = Math.floor(Math.random() * 4);
      if (!nodeValid(k + DIRS[d][0], l + DIRS[d][1])) continue;
      const s = START + Math.random() * (STOP - START - 6);
      const p = nodePos(k, l);
      const [rx, rz] = rightOf(d);
      const x = p.x + DIRS[d][0] * s + rx * LANE;
      const z = p.z + DIRS[d][1] * s + rz * LANE;
      const dist = Math.hypot(x - px, z - pz);
      if (dist < minR || dist > maxR) continue;
      if (this.cars.some((c) => Math.hypot(c.x - x, c.z - z) < 12)) continue;
      const spec = this.chooseSpec(x, z);
      car.specId = spec.id;
      car.len = spec.dims.length;
      car.color = pick(Math.random, TRAFFIC_COLORS);
      this.buildMesh(car);
      if (spec.modelUrl && !this.models.has(spec.id)) this.onNeedModel?.(spec.id);
      Object.assign(car, { k, l, d, s, speed: segmentSpeed(k, l, d) * 0.7, turning: null, stun: 0, x, z, heading: Math.atan2(DIRS[d][0], DIRS[d][1]), active: true });
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
      const limit = segmentSpeed(c.k, c.l, c.d);
      let desired = limit;
      const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
      // leader car / player ahead
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
        const endK = c.k + DIRS[c.d][0], endL = c.l + DIRS[c.d][1];
        if (isLightNode(endK, endL) && !this.green(c.d) && c.s < STOP + 0.5 && c.s > STOP - 30) {
          desired = Math.min(desired, Math.max(0, (STOP - c.s) * 0.7));
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
          c.k += DIRS[c.d][0];
          c.l += DIRS[c.d][1];
          c.d = T.nd;
          c.s = START;
          c.turning = null;
        }
      } else {
        c.s += c.speed * dt;
        const p = nodePos(c.k, c.l);
        const [rx, rz] = rightOf(c.d);
        c.x = p.x + DIRS[c.d][0] * c.s + rx * LANE;
        c.z = p.z + DIRS[c.d][1] * c.s + rz * LANE;
        c.heading = Math.atan2(DIRS[c.d][0], DIRS[c.d][1]);
        if (c.s >= END) this.beginTurn(c);
      }
      c.mesh.position.set(c.x, 0, c.z);
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
    const endK = c.k + DIRS[c.d][0], endL = c.l + DIRS[c.d][1];
    const options: number[] = [];
    for (let nd = 0; nd < 4; nd++) {
      if (nd === (c.d + 2) % 4) continue;
      if (nodeValid(endK + DIRS[nd][0], endL + DIRS[nd][1])) options.push(nd);
    }
    const nd = options.length ? (Math.random() < 0.5 && options.includes(c.d) ? c.d : pick(Math.random, options)) : (c.d + 2) % 4;
    const node = nodePos(endK, endL);
    const [rx, rz] = rightOf(c.d);
    const [nrx, nrz] = rightOf(nd);
    const p0 = new THREE.Vector2(c.x, c.z);
    const p2 = new THREE.Vector2(node.x + DIRS[nd][0] * START + nrx * LANE, node.z + DIRS[nd][1] * START + nrz * LANE);
    let p1: THREE.Vector2;
    if (nd === c.d) p1 = p0.clone().add(p2).multiplyScalar(0.5);
    else if (nd === (c.d + 2) % 4) p1 = new THREE.Vector2(node.x + DIRS[c.d][0] * 4, node.z + DIRS[c.d][1] * 4);
    else p1 = new THREE.Vector2(node.x + rx * LANE + nrx * LANE, node.z + rz * LANE + nrz * LANE);
    const len = p0.distanceTo(p1) + p1.distanceTo(p2);
    c.turning = { p0, p1, p2, t: 0, len, nd };
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
