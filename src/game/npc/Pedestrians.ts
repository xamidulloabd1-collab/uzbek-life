import * as THREE from 'three';
import { groundHeight } from '@/game/world/cityLayout';
import { NET } from '@/game/world/guzor/network';
import { pick } from '@/utils/math';

interface Ped {
  e: number;
  s: number;
  side: number;
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
      this.peds.push({ e: 0, s: 0, side: 1, dir: 1, speed: 1.3, phase: 0, inset: 2, dodge: 0, x: 0, z: 0, heading: 0, active: false, shirt: new THREE.Color(), cap: false });
    }
    const skin = new THREE.Color();
    for (let n = 0; n < max; n++) {
      skin.set(pick(Math.random, SKINS));
      this.parts.head.setColorAt(n, skin);
    }
  }

  /** walk along the edge of a street; at a junction carry on along another street */
  private place(ped: Ped) {
    let e = NET.edges[ped.e];
    if (ped.s > e.len - 2.5 || ped.s < 2.5) {
      const nodeId = ped.s > e.len / 2 ? e.b : e.a;
      const opts = NET.nodes[nodeId].edges.filter((id) => id !== e.id && NET.edges[id].cls !== 'highway');
      if (opts.length) {
        const ne = NET.edges[pick(Math.random, opts)];
        ped.e = ne.id;
        ped.dir = ne.a === nodeId ? 1 : -1;
        ped.s = ped.dir > 0 ? 3 : ne.len - 3;
        e = ne;
      } else {
        ped.dir = -ped.dir;
        ped.s = Math.max(2.6, Math.min(e.len - 2.6, ped.s));
      }
    }
    const p = NET.pointAt(e, ped.s);
    const off = e.width / 2 + (e.sidewalk ? 1.6 : 0.9) + ped.inset;
    ped.x = p.x - p.tz * off * ped.side;
    ped.z = p.z + p.tx * off * ped.side;
    ped.heading = Math.atan2(p.tx * ped.dir, p.tz * ped.dir);
  }

  private spawn(px: number, pz: number) {
    const ped = this.peds.find((q) => !q.active);
    if (!ped) return;
    for (let tries = 0; tries < 10; tries++) {
      const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 140;
      const hit = NET.nearestRoad(px + Math.cos(a) * r, pz + Math.sin(a) * r, 40);
      if (!hit || hit.e.cls === 'highway' || hit.e.zone === 'fields') continue;
      if (hit.e.zone === 'village' && Math.random() < 0.6) continue;
      Object.assign(ped, { e: hit.e.id, s: Math.max(3, Math.min(hit.e.len - 3, hit.s)), side: Math.random() < 0.5 ? 1 : -1, dir: Math.random() < 0.5 ? 1 : -1, speed: 1.1 + Math.random() * 0.6, inset: Math.random() * 1.2, dodge: 0, active: true, cap: Math.random() < 0.3 });
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
      ped.s += speed * dt * ped.dir;
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
