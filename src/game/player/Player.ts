import * as THREE from 'three';
import type { CollisionWorld } from '@/game/physics/collision';
import type { TextureLib } from '@/game/world/textures';
import { groundHeight } from '@/game/world/cityLayout';
import { clamp, damp, dampAngle } from '@/utils/math';
import type { InputFrame } from '@/game/input/InputManager';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

const WALK = 1.6;
const RUN = 3.8;
const SPRINT = 6.4;
const RADIUS = 0.34;
const LOCO = ['idle', 'walk', 'run', 'sprint'] as const;
type Loco = (typeof LOCO)[number];

/** a rigged character plus its clips by name (shared by the player, taxi passengers and NPCs) */
export interface AvatarSource { scene: THREE.Object3D; clips: Record<string, THREE.AnimationClip>; scale: number }

/** hair / eyelash cards use alpha-tested cut-outs instead of sorted transparency */
export function tuneAvatarMaterials(m: THREE.Mesh) {
  for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
    const sm = mat as THREE.MeshStandardMaterial;
    if (/opacity|hair|lash/i.test(sm.name) || sm.transparent) {
      sm.transparent = false;
      sm.alphaTest = 0.45;
      sm.depthWrite = true;
      sm.side = THREE.DoubleSide;
    }
    sm.envMapIntensity = 0.75;
  }
}

export class Player {
  readonly group = new THREE.Group();
  x = 0;
  z = 0;
  y = 0;
  vy = 0;
  heading = 0;
  speed = 0;
  onGround = true;
  walkToggle = false;
  private phase = 0;
  private lastStepSign = 0;
  onStep: (() => void) | null = null;
  private procedural = new THREE.Group();
  private mixer: THREE.AnimationMixer | null = null;
  /** loaded character + clips, cloned for visible NPCs such as taxi passengers */
  avatarSource: AvatarSource | null = null;
  hasAvatar = false;
  private parts: {
    hips: THREE.Group;
    torso: THREE.Group;
    legL: THREE.Group;
    legR: THREE.Group;
    armL: THREE.Group;
    armR: THREE.Group;
    head: THREE.Group;
  };

  constructor(tex: TextureLib) {
    const skin = new THREE.MeshStandardMaterial({ color: '#c99a74', roughness: 0.7 });
    const shirt = new THREE.MeshStandardMaterial({ color: '#2d5f8a', roughness: 0.85 });
    const jeans = new THREE.MeshStandardMaterial({ color: '#2a3140', roughness: 0.9 });
    const shoe = new THREE.MeshStandardMaterial({ color: '#1d1b19', roughness: 0.6 });
    const hair = new THREE.MeshStandardMaterial({ color: '#1a1410', roughness: 0.9 });
    const doppi = new THREE.MeshStandardMaterial({ map: tex.doppi(), roughness: 0.8 });
    const m = (g: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
      const mesh = new THREE.Mesh(g, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const hips = new THREE.Group();
    hips.position.y = 0.95;
    this.group.add(this.procedural);
    this.procedural.add(hips);
    const torso = new THREE.Group();
    hips.add(torso);
    const torsoMesh = m(new THREE.CapsuleGeometry(0.19, 0.34, 4, 10), shirt, torso, 0, 0.33, 0);
    torsoMesh.scale.set(1.12, 1, 0.68);
    m(new THREE.BoxGeometry(0.34, 0.14, 0.2), jeans, hips, 0, 0.02, 0);
    const head = new THREE.Group();
    head.position.y = 0.78;
    torso.add(head);
    m(new THREE.CylinderGeometry(0.05, 0.06, 0.09, 8), skin, head, 0, -0.06, 0);
    m(new THREE.SphereGeometry(0.115, 16, 12), skin, head, 0, 0.08, 0.005);
    const hairMesh = m(new THREE.SphereGeometry(0.12, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.1), hair, head, 0, 0.09, -0.01);
    hairMesh.scale.set(1, 0.9, 1.05);
    // chust do'ppi: a square skullcap
    const cap = m(new THREE.CylinderGeometry(0.105, 0.122, 0.075, 4, 1, true), doppi, head, 0, 0.175, 0);
    cap.rotation.y = Math.PI / 4;
    m(new THREE.CylinderGeometry(0.004, 0.105, 0.015, 4), new THREE.MeshStandardMaterial({ color: '#121212' }), head, 0, 0.218, 0).rotation.y = Math.PI / 4;
    // nose hint
    m(new THREE.BoxGeometry(0.03, 0.045, 0.04), skin, head, 0, 0.07, 0.115);

    const limb = (parent: THREE.Object3D, x: number, y: number, len: number, r: number, mat: THREE.Material, endMat?: THREE.Material) => {
      const g = new THREE.Group();
      g.position.set(x, y, 0);
      parent.add(g);
      m(new THREE.CapsuleGeometry(r, len, 3, 8), mat, g, 0, -len / 2 - r, 0);
      if (endMat) m(new THREE.BoxGeometry(r * 2.2, r * 1.6, r * 4.2), endMat, g, 0, -len - r * 2.2, r * 1.1);
      return g;
    };
    const legL = limb(hips, 0.1, -0.02, 0.72, 0.075, jeans, shoe);
    const legR = limb(hips, -0.1, -0.02, 0.72, 0.075, jeans, shoe);
    const armL = limb(torso, 0.25, 0.6, 0.5, 0.055, shirt);
    const armR = limb(torso, -0.25, 0.6, 0.5, 0.055, shirt);
    for (const a of [armL, armR]) {
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), skin);
      hand.position.y = -0.64;
      hand.castShadow = true;
      a.add(hand);
    }
    this.parts = { hips, torso, legL, legR, armL, armR, head };
  }

  /** swap the procedural figure for a rigged, animated GLB character (Rocketbox Biped rig or Mixamo rig) */
  private bones: Record<string, THREE.Bone> = {};
  private clips: Record<string, THREE.AnimationClip> = {};
  private loco: Record<Loco, THREE.AnimationAction> | null = null;
  private lw: Record<Loco, number> = { idle: 1, walk: 0, run: 0, sprint: 0 };
  /** one-shot / looping override layer (door, sit, wave …) blended over locomotion */
  private over: THREE.AnimationAction | null = null;
  private overW = 0;
  private overTarget = 0;
  private overFade = 0.2;
  private overLeft = Infinity;
  private overAuto = false;
  private prev: THREE.AnimationAction | null = null;
  private prevW = 0;
  private idleTimer = 7;
  private headAlign: { q: THREE.Quaternion; top: number; eyes: THREE.Vector3 } | null = null;

  setAvatar(gltf: GLTF) {
    const model = gltf.scene;
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const h = box.max.y - box.min.y || 1.8;
    const s = 1.78 / h;
    model.scale.setScalar(s);
    model.position.y = -box.min.y * s;
    model.traverse((o) => {
      if ((o as THREE.Bone).isBone) this.bones[o.name.replace(/^Bip01_?/, '').replace(/^mixamorig:?/, '')] = o as THREE.Bone;
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = false;
        tuneAvatarMaterials(m);
      }
    });
    for (const a of gltf.animations) this.clips[a.name.toLowerCase()] = a;
    if (!this.clips.idle || !this.clips.walk || !this.clips.run) {
      console.warn('[player] character GLB has no idle/walk/run clips; using the procedural figure');
      return false;
    }
    if (!this.clips.sprint) this.clips.sprint = this.clips.run;
    model.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    const B = this.bones;
    const lf = B.L_Foot ?? B.LeftFoot, rf = B.R_Foot ?? B.RightFoot;
    const footY = () => Math.min(lf.getWorldPosition(v).y, rf.getWorldPosition(v).y);
    const bindFoot = lf && rf ? footY() : 0;
    const head = B.Head;
    if (head) {
      // accessory frame: origin at the head bone, axes aligned with the model in bind pose (Biped bones are not Y-up)
      const hq = head.getWorldQuaternion(new THREE.Quaternion());
      const hp = head.getWorldPosition(new THREE.Vector3());
      const le = B.LEye ?? B.LeftEye, re = B.REye ?? B.RightEye;
      const eyes = le && re ? le.getWorldPosition(new THREE.Vector3()).add(re.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5).sub(hp) : new THREE.Vector3(0, 0.08, 0.09);
      this.headAlign = { q: hq.invert(), top: 1.78 - hp.y, eyes };
    }
    this.mixer = new THREE.AnimationMixer(model);
    const mx = this.mixer;
    this.loco = { idle: mx.clipAction(this.clips.idle), walk: mx.clipAction(this.clips.walk), run: mx.clipAction(this.clips.run), sprint: mx.clipAction(this.clips.sprint) };
    for (const k of LOCO) {
      this.loco[k].play();
      this.loco[k].setEffectiveWeight(k === 'idle' ? 1 : 0);
    }
    mx.update(0.01);
    model.updateMatrixWorld(true);
    if (lf && rf) {
      // keep the soles on the ground whatever the clip's pelvis height
      model.position.y += clamp(bindFoot - footY(), -0.15, 0.15);
      model.updateMatrixWorld(true);
    }
    const hips = B.Pelvis ?? B.Hips;
    if (head && hips && head.getWorldPosition(v).y < hips.getWorldPosition(new THREE.Vector3()).y + 0.1) {
      console.warn('[player] clips produced an invalid pose; using the procedural figure');
      this.mixer = null;
      this.loco = null;
      return false;
    }
    this.avatarSource = { scene: model, clips: this.clips, scale: s };
    this.group.remove(this.procedural);
    this.group.add(model);
    this.hasAvatar = true;
    return true;
  }

  /** play a clip on the override layer; returns its remaining length in seconds */
  playAction(name: string, o: { loop?: boolean; start?: number; timeScale?: number; fade?: number; duration?: number; auto?: boolean } = {}) {
    const clip = this.clips[name];
    if (!this.mixer || !clip) return 0;
    const a = this.mixer.clipAction(clip);
    if (this.over && this.over !== a) {
      this.prev?.stop();
      this.prev = this.over;
      this.prevW = this.overW;
      this.overW = 0;
    }
    a.reset();
    a.setLoop(o.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    a.clampWhenFinished = true;
    a.time = o.start ?? 0;
    a.timeScale = o.timeScale ?? 1;
    a.play();
    a.setEffectiveWeight(this.overW);
    this.over = a;
    this.overTarget = 1;
    this.overFade = o.fade ?? 0.2;
    this.overLeft = o.duration ?? Infinity;
    this.overAuto = !!o.auto;
    return (clip.duration - (o.start ?? 0)) / (o.timeScale ?? 1);
  }

  clearAction(fade = 0.25) {
    this.overTarget = 0;
    this.overFade = fade;
  }

  get acting() {
    return !!this.over && this.overTarget > 0;
  }

  private accessories = Object.assign(new THREE.Group(), { name: 'accessories' });
  /** do‘ppi / cap and sunglasses as real meshes on the head bone (sized in metres whatever the rig scale) */
  setAccessories(o: { hat: string; glasses: boolean }) {
    const head = this.bones.Head;
    this.accessories.removeFromParent();
    this.accessories.clear();
    if (!head || !this.headAlign) return;
    head.updateWorldMatrix(true, false);
    const ws = new THREE.Vector3();
    head.getWorldScale(ws);
    const k = 1 / (ws.x || 1);
    const g = this.accessories;
    const { top, eyes } = this.headAlign;
    // crown centre: above the skull, a little behind the eyes
    const cy = top - 0.045, cz = eyes.z - 0.07;
    if (o.hat === 'doppi' || o.hat === 'doppi-oq') {
      const c = document.createElement('canvas');
      c.width = 256; c.height = 64;
      const x = c.getContext('2d')!;
      x.fillStyle = o.hat === 'doppi' ? '#151515' : '#f2efe6';
      x.fillRect(0, 0, 256, 64);
      x.strokeStyle = o.hat === 'doppi' ? '#f2efe6' : '#1d3f6e';
      x.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        const cx = 32 + i * 64;
        x.beginPath(); x.moveTo(cx - 14, 40); x.quadraticCurveTo(cx, 6, cx + 14, 40); x.stroke();
        x.beginPath(); x.arc(cx, 44, 5, 0, Math.PI * 2); x.stroke();
      }
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.108, 0.118, 0.085, 4, 1, false), [new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 }), new THREE.MeshStandardMaterial({ color: o.hat === 'doppi' ? '#151515' : '#f2efe6', roughness: 0.85 })]);
      m.rotation.y = Math.PI / 4;
      m.position.set(0, cy, cz);
      m.scale.setScalar(1.12);
      g.add(m);
    } else if (o.hat === 'kepka') {
      const mat = new THREE.MeshStandardMaterial({ color: '#2a4a7a', roughness: 0.8 });
      const crown = new THREE.Mesh(new THREE.SphereGeometry(0.112, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat);
      crown.position.set(0, cy - 0.06, cz);
      crown.scale.set(1, 0.8, 1.08);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.01, 20, 1, false, -Math.PI / 2, Math.PI), mat);
      brim.position.set(0, cy - 0.055, cz + 0.105);
      brim.scale.set(1.1, 1, 1);
      g.add(crown, brim);
    }
    if (o.glasses) {
      const lens = new THREE.MeshStandardMaterial({ color: '#0d0d0f', roughness: 0.08, metalness: 0.4 });
      for (const sx of [-0.034, 0.034]) {
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.006, 18).rotateX(Math.PI / 2), lens);
        l.position.set(eyes.x + sx, eyes.y, eyes.z + 0.03);
        g.add(l);
      }
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.006, 0.006), lens);
      bar.position.set(eyes.x, eyes.y + 0.006, eyes.z + 0.032);
      g.add(bar);
    }
    g.quaternion.copy(this.headAlign.q);
    g.scale.setScalar(k);
    g.traverse((o2) => ((o2 as THREE.Mesh).castShadow = true));
    head.add(g);
  }

  place(x: number, z: number, heading: number) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.y = groundHeight(x, z);
    this.vy = 0;
    this.speed = 0;
    this.sync();
  }

  update(dt: number, inp: InputFrame, camYaw: number, world: CollisionWorld) {
    if (inp.pressed.has('walk')) this.walkToggle = !this.walkToggle;
    const mag = Math.min(1, Math.hypot(inp.moveX, inp.moveY));
    let target = 0;
    if (mag > 0.05 && this.over && this.overAuto) this.clearAction(0.2);
    if (mag > 0.05) {
      // camera-relative direction
      const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
      const rx = -Math.cos(camYaw), rz = Math.sin(camYaw);
      const dx = fx * inp.moveY + rx * inp.moveX;
      const dz = fz * inp.moveY + rz * inp.moveX;
      this.heading = dampAngle(this.heading, Math.atan2(dx, dz), 12, dt);
      const analogWalk = inp.analogLook && mag < 0.55;
      target = inp.sprint ? SPRINT : this.walkToggle || analogWalk ? WALK : RUN;
      target *= inp.analogLook ? clamp(mag * 1.4, 0.3, 1) : 1;
    }
    this.speed = damp(this.speed, target, target > this.speed ? 7 : 10, dt);
    this.x += Math.sin(this.heading) * this.speed * dt;
    this.z += Math.cos(this.heading) * this.speed * dt;
    const p = { x: this.x, z: this.z };
    world.resolveCircle(p, RADIUS);
    this.x = p.x;
    this.z = p.z;

    const gy = groundHeight(this.x, this.z);
    if (inp.pressed.has('jump') && this.onGround) {
      this.vy = 5.2;
      this.onGround = false;
    }
    this.vy -= 15 * dt;
    this.y += this.vy * dt;
    if (this.y <= gy) {
      this.y = this.onGround ? damp(this.y, gy, 20, dt) : gy;
      if (this.y < gy) this.y = gy;
      this.vy = 0;
      this.onGround = true;
    } else if (this.y - gy > 0.05 && this.vy <= 0 && this.onGround) {
      // stepping down a curb
      this.y = damp(this.y, gy, 18, dt);
      this.vy = 0;
    }
    this.animate(dt);
    this.sync();
  }

  /** advance animation without input (scripted moves such as walking to a car door) */
  animateOnly(dt: number) {
    this.animate(dt);
  }

  private animateAvatar(dt: number) {
    const L = this.loco!;
    const s = this.speed;
    const t: Record<Loco, number> = { idle: 0, walk: 0, run: 0, sprint: 0 };
    if (!this.onGround) t.run = 1;
    else if (s < 0.15) t.idle = 1;
    else if (s < 2.2) t.walk = 1;
    else if (s < 4.4) { const k = (s - 2.2) / 2.2; t.walk = 1 - k; t.run = k; }
    else { const k = Math.min(1, (s - 4.4) / 1.6); t.run = 1 - k; t.sprint = k; }
    // override layer (door, sit, wave …)
    if (this.over) {
      this.overLeft -= dt;
      if (this.overLeft <= 0 && this.overTarget > 0) this.clearAction(0.3);
    }
    const kf = 1 - Math.exp(-dt / Math.max(0.04, this.overFade) * 2.5);
    this.overW += (this.overTarget - this.overW) * kf;
    if (this.prev) {
      this.prevW = Math.max(0, this.prevW - dt / Math.max(0.05, this.overFade));
      this.prev.setEffectiveWeight(this.prevW);
      if (this.prevW <= 0) { this.prev.stop(); this.prev = null; }
    }
    if (this.over) {
      this.over.setEffectiveWeight(this.overW);
      if (this.overTarget === 0 && this.overW < 0.01) { this.over.stop(); this.over = null; this.overW = 0; }
    }
    const layer = 1 - Math.max(this.overW, this.prevW);
    const k = 1 - Math.exp(-10 * dt);
    for (const key of LOCO) {
      this.lw[key] += (t[key] - this.lw[key]) * k;
      L[key].setEffectiveWeight(this.lw[key] * layer);
    }
    L.walk.timeScale = clamp(s / 1.45, 0.55, 1.7);
    L.run.timeScale = this.onGround ? clamp(s / 3.6, 0.7, 1.4) : 0.3;
    L.sprint.timeScale = clamp(s / 6.0, 0.8, 1.3);
    // keep foot phases in step while two gaits are blended
    const sync = (a: THREE.AnimationAction, b: THREE.AnimationAction, wa: number, wb: number) => {
      if (wa > 0.05 && wb > 0.05) b.time = (a.time / a.getClip().duration) * b.getClip().duration;
    };
    sync(L.walk, L.run, this.lw.walk, this.lw.run);
    sync(L.run, L.sprint, this.lw.run, this.lw.sprint);
    // an occasional look around while standing still
    if (this.onGround && s < 0.1 && !this.over) {
      this.idleTimer -= dt;
      if (this.idleTimer <= 0) {
        this.idleTimer = 9 + Math.random() * 8;
        const d = this.playAction(Math.random() < 0.5 ? 'idle_look' : 'breathe', { fade: 0.6, auto: true });
        this.overLeft = Math.max(0.5, d - 0.6);
      }
    } else if (s > 0.1) this.idleTimer = 7;
    this.mixer!.update(dt);
    this.phase += dt * (2.4 + s * 1.55);
    const sign = Math.sign(Math.sin(this.phase));
    if (this.onGround && s > 0.8 && sign !== this.lastStepSign) {
      this.lastStepSign = sign;
      this.onStep?.();
    }
  }

  private animate(dt: number) {
    if (this.loco) return this.animateAvatar(dt);
    const P = this.parts;
    const s = this.speed;
    this.phase += dt * (2.4 + s * 1.55);
    const sw = Math.sin(this.phase);
    const amp = Math.min(0.95, s * 0.17);
    if (this.onGround) {
      P.legL.rotation.x = sw * amp;
      P.legR.rotation.x = -sw * amp;
      P.armL.rotation.x = -sw * amp * 0.9;
      P.armR.rotation.x = sw * amp * 0.9;
      P.armL.rotation.z = 0.08;
      P.armR.rotation.z = -0.08;
      P.hips.position.y = 0.95 + Math.abs(Math.cos(this.phase)) * Math.min(0.06, s * 0.012) - (s > 5 ? 0.03 : 0);
      P.torso.rotation.x = damp(P.torso.rotation.x, s * 0.035, 8, dt);
      if (s < 0.2) {
        const br = Math.sin(performance.now() / 700) * 0.015;
        P.torso.rotation.x = br;
        P.armL.rotation.x = P.armR.rotation.x = 0;
        P.legL.rotation.x = P.legR.rotation.x = 0;
      }
      const sign = Math.sign(sw);
      if (s > 0.8 && sign !== this.lastStepSign) {
        this.lastStepSign = sign;
        this.onStep?.();
      }
    } else {
      P.legL.rotation.x = 0.5;
      P.legR.rotation.x = -0.2;
      P.armL.rotation.x = P.armR.rotation.x = -0.6;
      P.armL.rotation.z = 0.5;
      P.armR.rotation.z = -0.5;
    }
  }

  sync() {
    this.group.position.set(this.x, this.y, this.z);
    this.group.rotation.y = this.heading;
  }
}
