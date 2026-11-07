import * as THREE from 'three';
import { BLOCK, N, blockRect, districtOf, groundHeight } from '@/game/world/cityLayout';
import { pick } from '@/utils/math';

interface Ped {
  i: number;
  j: number;
  p: number;
  dir: number;
  speed: number;
  phase: number;
  inset: number;
  dodge: number;
  x: number;
  z: number;
  heading: number;
  active: boolean;
  shirt: THREE.Color;
  cap: boolean;
}

const PERIM = (BLOCK - 4) * 4;
const SHIRTS = ['#8c2f39', '#2d5f8a', '#e0d8c8', '#3b6b4a', '#6b4f8c', '#c47a2c', '#2b2b2b', '#a8a19a', '#c9356b', '#1aa3b4'];
const SKINS = ['#c99a74', '#b5835f', '#d9ad88', '#a87452'];

export class Pedestrians {
  readonly group = new THREE.Group();
  private peds: Ped[] = [];
  private parts: { torso: THREE.InstancedMesh; head: THREE.InstancedMesh; legL: THREE.InstancedMesh; legR: THREE.InstancedMesh; cap: THREE.InstancedMesh };
  private o = new THREE.Object3D();
  private leg = new THREE.Object3D();
  private base = new THREE.Matrix4();
  private tmp = new THREE.Matrix4();
  private zero = new THREE.Matrix4().makeScale(0, 0, 0);
  target = 20;

  constructor(private max: number) {
    const mat = (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
    const torsoG = new THREE.CapsuleGeometry(0.19, 0.42, 3, 8).scale(1.05, 1, 0.65).translate(0, 1.22, 0);
    const headG = new THREE.SphereGeometry(0.115, 10, 8).translate(0, 1.66, 0);
    const legG = new THREE.CapsuleGeometry(0.075, 0.68, 3, 6).translate(0, -0.42, 0);
    const capG = new THREE.CylinderGeometry(0.105, 0.12, 0.07, 4).rotateY(Math.PI / 4).translate(0, 1.77, 0);
    const im = (g: THREE.BufferGeometry, m: THREE.Material) => {
      const x = new THREE.InstancedMesh(g, m, max);
      x.castShadow = true;
      x.count = 0;
      x.frustumCulled = false;
      this.group.add(x);
      return x;
    };
    this.parts = {
      torso: im(torsoG, mat('#ffffff')),
      head: im(headG, mat('#ffffff')),
      legL: im(legG, mat('#2a2e36')),
      legR: im(legG, mat('#2a2e36')),
      cap: im(capG, mat('#141414')),
    };
    for (let n = 0; n < max; n++) {
      this.peds.push({ i: 0, j: 0, p: 0, dir: 1, speed: 1.3, phase: 0, inset: 2, dodge: 0, x: 0, z: 0, heading: 0, active: false, shirt: new THREE.Color(), cap: false });
    }
    const skin = new THREE.Color();
    for (let n = 0; n < max; n++) {
      skin.set(pick(Math.random, SKINS));
      this.parts.head.setColorAt(n, skin);
    }
  }

  private place(ped: Ped) {
    const r = blockRect(ped.i, ped.j);
    const L = BLOCK - 4;
    const p = ((ped.p % PERIM) + PERIM) % PERIM;
    const a = r.x0 + ped.inset, b = r.z0 + ped.inset, c = r.x1 - ped.inset, d = r.z1 - ped.inset;
    const side = Math.floor(p / L);
    const t = (p - side * L) / L;
    let x: number, z: number, hx: number, hz: number;
    if (side === 0) { x = a + (c - a) * t; z = b; hx = 1; hz = 0; }
    else if (side === 1) { x = c; z = b + (d - b) * t; hx = 0; hz = 1; }
    else if (side === 2) { x = c - (c - a) * t; z = d; hx = -1; hz = 0; }
    else { x = a; z = d - (d - b) * t; hx = 0; hz = -1; }
    ped.x = x;
    ped.z = z;
    ped.heading = Math.atan2(hx * ped.dir, hz * ped.dir);
  }

  private spawn(px: number, pz: number) {
    const ped = this.peds.find((q) => !q.active);
    if (!ped) return;
    for (let tries = 0; tries < 10; tries++) {
      const i = Math.floor(Math.random() * N), j = Math.floor(Math.random() * N);
      const dist = districtOf(i, j);
      if (dist === 'village' && Math.random() < 0.7) continue;
      const r = blockRect(i, j);
      const d = Math.hypot(r.cx - px, r.cz - pz);
      if (d > 170 || d < 20) continue;
      Object.assign(ped, { i, j, p: Math.random() * PERIM, dir: Math.random() < 0.5 ? 1 : -1, speed: 1.1 + Math.random() * 0.6, inset: 1.6 + Math.random() * 1.2, dodge: 0, active: true, cap: Math.random() < 0.3 });
      ped.shirt.set(pick(Math.random, SHIRTS));
      this.place(ped);
      if (Math.hypot(ped.x - px, ped.z - pz) < 25) continue;
      return;
    }
    ped.active = false;
  }

  update(dt: number, px: number, pz: number, threats: { x: number; z: number; speed: number }[]) {
    const active = this.peds.filter((p) => p.active);
    if (active.length < Math.min(this.max, Math.round(this.target))) this.spawn(px, pz);
    let n = 0;
    const P = this.parts;
    for (const ped of this.peds) {
      if (!ped.active) continue;
      if (Math.hypot(ped.x - px, ped.z - pz) > 200 || active.length > this.target + 2) {
        ped.active = false;
        continue;
      }
      let speed = ped.speed;
      for (const t of threats) {
        const d = Math.hypot(t.x - ped.x, t.z - ped.z);
        if (d < 7 && t.speed > 1.2) {
          ped.dodge = Math.min(1.6, ped.dodge + dt * 4);
          speed *= 1.8;
        } else if (d < 1.2) {
          ped.dodge = Math.min(1, ped.dodge + dt * 3);
        }
      }
      ped.dodge = Math.max(0, ped.dodge - dt * 0.4);
      ped.p += speed * dt * ped.dir;
      ped.phase += dt * speed * 4.2;
      const saved = ped.inset;
      ped.inset = saved + ped.dodge;
      this.place(ped);
      ped.inset = saved;
      const gy = groundHeight(ped.x, ped.z);
      const o = this.o;
      o.position.set(ped.x, gy, ped.z);
      o.rotation.set(0, ped.heading, 0);
      o.scale.setScalar(1);
      o.updateMatrix();
      P.torso.setMatrixAt(n, o.matrix);
      P.head.setMatrixAt(n, o.matrix);
      P.torso.setColorAt(n, ped.shirt);
      this.base.copy(o.matrix);
      if (ped.cap) P.cap.setMatrixAt(n, this.base);
      else P.cap.setMatrixAt(n, this.zero);
      const sw = Math.sin(ped.phase) * 0.5;
      for (const [mesh, side, sgn] of [[P.legL, 0.1, 1], [P.legR, -0.1, -1]] as const) {
        this.leg.position.set(side, 0.92, 0);
        this.leg.rotation.set(sw * sgn, 0, 0);
        this.leg.updateMatrix();
        this.tmp.multiplyMatrices(this.base, this.leg.matrix);
        mesh.setMatrixAt(n, this.tmp);
      }
      n++;
    }
    for (const m of Object.values(P)) {
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  /** positions for collision checks with the player's car */
  positions() {
    return this.peds.filter((p) => p.active).map((p) => ({ x: p.x, z: p.z }));
  }
}
