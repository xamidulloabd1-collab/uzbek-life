import * as THREE from 'three';
import type { OwnedVehicle } from '@/types';
import type { TextureLib } from '@/game/world/textures';
import type { CollisionWorld } from '@/game/physics/collision';
import { Vehicle } from '@/game/vehicles/Vehicle';
import type { Obstacle } from '@/game/vehicles/VehiclePhysics';
import { LANE, N, nodePos, rightOf, DIRS } from '@/game/world/cityLayout';
import { angleDiff, clamp } from '@/utils/math';

interface Unit {
  v: Vehicle;
  red: THREE.MeshStandardMaterial;
  blue: THREE.MeshStandardMaterial;
  stuck: number;
  reverse: number;
}

/**
 * Fictional police response for the wanted system (levels 0–3).
 * Level 2 → one patrol car, level 3 → two. Cars use the same driving physics as the
 * player and simple pursuit steering with look-ahead obstacle avoidance.
 */
export class Police {
  readonly units: Unit[] = [];
  private spawnTimer = 0;
  private catchTimer = 0;
  private serial = 0;

  constructor(private tex: TextureLib, private scene: THREE.Scene) {}

  private spawn(px: number, pz: number) {
    for (let tries = 0; tries < 20; tries++) {
      const k = Math.floor(Math.random() * (N + 1)), l = Math.floor(Math.random() * (N + 1));
      const p = nodePos(k, l);
      const d = Math.hypot(p.x - px, p.z - pz);
      if (d < 120 || d > 260) continue;
      const dir = Math.floor(Math.random() * 4);
      const [rx, rz] = rightOf(dir);
      const rec: OwnedVehicle = {
        uid: `police-${this.serial++}`, specId: 'amir', color: '#f4f4f2', wheels: 2, tint: 2, plate: '70 P 112 UZ', engine: 2, handling: 3, health: 100, fuel: 60,
      };
      const v = new Vehicle(rec, this.tex, false, false);
      v.borrowed = true;
      const red = new THREE.MeshStandardMaterial({ color: '#5a0000', emissive: '#ff1010', emissiveIntensity: 0 });
      const blue = new THREE.MeshStandardMaterial({ color: '#00144a', emissive: '#1a4dff', emissiveIntensity: 0 });
      const H = v.spec.dims.height;
      for (const [m, x] of [[red, 0.32], [blue, -0.32]] as const) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.26), m);
        bar.position.set(x, H + 0.06, -0.15);
        v.model.body.add(bar);
      }
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(v.spec.dims.width + 0.02, 0.12, 2.2), new THREE.MeshStandardMaterial({ color: '#1f4e8c', roughness: 0.4 }));
      stripe.position.set(0, v.spec.shape.belt - 0.28, 0);
      v.model.body.add(stripe);
      v.place(p.x + DIRS[dir][0] * 8 + rx * LANE, p.z + DIRS[dir][1] * 8 + rz * LANE, Math.atan2(px - p.x, pz - p.z));
      this.scene.add(v.group);
      this.units.push({ v, red, blue, stuck: 0, reverse: 0 });
      return;
    }
  }

  clear() {
    for (const u of this.units) {
      this.scene.remove(u.v.group);
      u.v.dispose();
    }
    this.units.length = 0;
  }

  /** returns distance to the nearest unit and whether the player has been caught */
  update(dt: number, wanted: number, px: number, pz: number, playerSpeed: number, world: CollisionWorld, obstacles: Obstacle[], night: number) {
    const want = wanted >= 3 ? 2 : wanted >= 2 ? 1 : 0;
    this.spawnTimer -= dt;
    if (this.units.length < want && this.spawnTimer <= 0) {
      this.spawnTimer = 3;
      this.spawn(px, pz);
    }
    if (wanted === 0 && this.units.length) this.clear();
    let nearest = Infinity;
    const blink = Math.floor(performance.now() / 180) % 2 === 0;
    for (const u of this.units) {
      const p = u.v.physics;
      const dx = px - p.x, dz = pz - p.z;
      const dist = Math.hypot(dx, dz);
      nearest = Math.min(nearest, dist);
      const desired = Math.atan2(dx, dz);
      let diff = angleDiff(p.heading, desired);
      // look-ahead obstacle avoidance
      const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
      const ahead = world.raycast(p.x, p.z, fx, fz, 14, 0.5);
      if (ahead < 10) {
        const l = world.raycast(p.x, p.z, Math.sin(p.heading + 0.7), Math.cos(p.heading + 0.7), 14, 0.5);
        const r = world.raycast(p.x, p.z, Math.sin(p.heading - 0.7), Math.cos(p.heading - 0.7), 14, 0.5);
        diff += l > r ? 0.9 : -0.9;
      }
      let throttle = dist > 9 ? (Math.abs(diff) > 1.3 ? 0.45 : 1) : 0;
      let brake = dist < 9 ? 1 : 0;
      if (Math.abs(p.vx) < 0.8 && throttle > 0) u.stuck += dt;
      else u.stuck = Math.max(0, u.stuck - dt);
      if (u.stuck > 1.8) {
        u.reverse = 1.3;
        u.stuck = 0;
      }
      let steer = -clamp(diff * 2.2, -1, 1);
      if (u.reverse > 0) {
        u.reverse -= dt;
        throttle = 0;
        brake = 1;
        steer = -steer;
      }
      u.v.update(dt, { throttle, brake, steer, handbrake: false }, world, obstacles);
      u.v.sync(night, dt);
      u.red.emissiveIntensity = blink ? 4 : 0.2;
      u.blue.emissiveIntensity = blink ? 0.2 : 4;
    }
    if (wanted >= 1 && nearest < 7 && playerSpeed < 1) this.catchTimer += dt;
    else this.catchTimer = Math.max(0, this.catchTimer - dt);
    const caught = this.catchTimer > 2.5;
    if (caught) this.catchTimer = 0;
    return { nearest, caught };
  }

  obstacles(): Obstacle[] {
    const out: Obstacle[] = [];
    for (const u of this.units) {
      const p = u.v.physics;
      const off = u.v.spec.dims.length * 0.28;
      out.push({ x: p.x + Math.sin(p.heading) * off, z: p.z + Math.cos(p.heading) * off, r: 0.95 }, { x: p.x - Math.sin(p.heading) * off, z: p.z - Math.cos(p.heading) * off, r: 0.95 });
    }
    return out;
  }
}
