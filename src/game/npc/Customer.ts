import * as THREE from 'three';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Vec2 } from '@/types';
import { groundAt } from '@/game/world/guzor/network';
import type { AvatarSource } from '@/game/player/Player';

export type { AvatarSource };

/** a taxi passenger who really stands in the world, waves, walks to the car, rides in the passenger seat and gets out */
export class Customer {
  readonly group = new THREE.Group();
  state: 'wait' | 'board' | 'ride' | 'alight' | 'gone' = 'wait';
  private mixer: THREE.AnimationMixer;
  private clips: Record<string, THREE.AnimationClip>;
  private cur: THREE.AnimationAction | null = null;
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private t = 0;
  private dur = 1;
  /** sub-step: crouching into the car / standing up out of it before walking away */
  private sub: 'walk' | 'crouch' | 'stand' = 'walk';
  private subT = 0;
  private waved = false;
  private waveLeft = 0;

  constructor(src: AvatarSource, pos: Vec2, facing: number) {
    const m = skClone(src.scene);
    m.getObjectByName('accessories')?.removeFromParent();
    m.scale.setScalar(src.scale);
    m.traverse((o) => ((o as THREE.Mesh).castShadow = true));
    this.group.add(m);
    this.mixer = new THREE.AnimationMixer(m);
    this.clips = src.clips;
    this.play(this.clips.wait ? 'wait' : 'idle', true, 1, Math.random() * 6);
    this.group.position.set(pos.x, groundAt(pos.x, pos.z), pos.z);
    this.group.rotation.y = facing;
  }

  private play(name: string, loop = true, timeScale = 1, start = 0, fade = 0.3) {
    const clip = this.clips[name] ?? this.clips.idle;
    if (!clip) return 0;
    const a = this.mixer.clipAction(clip);
    if (a === this.cur) return clip.duration;
    a.reset();
    a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    a.clampWhenFinished = true;
    a.time = start;
    a.timeScale = timeScale;
    a.play();
    if (this.cur) this.cur.crossFadeTo(a, fade, false);
    this.cur = a;
    return (clip.duration - start) / timeScale;
  }

  private moveTo(p: Vec2, speed: number) {
    this.from.copy(this.group.position);
    this.to.set(p.x, groundAt(p.x, p.z), p.z);
    this.t = 0;
    this.dur = Math.min(6, Math.max(0.8, this.from.distanceTo(this.to) / speed));
    this.group.rotation.y = Math.atan2(this.to.x - this.from.x, this.to.z - this.from.z);
    this.sub = 'walk';
    this.play('walk', true, 1, 0, 0.25);
  }

  /** walk to the passenger door, then duck into the car */
  board(door: Vec2) {
    this.state = 'board';
    this.moveTo(door, 1.45);
  }

  /** seat the passenger in a car (parent = vehicle group, local seat position) */
  seat(parent: THREE.Object3D, local: THREE.Vector3) {
    if (this.group.parent !== parent) {
      parent.add(this.group);
      this.group.rotation.set(0, 0, 0);
      this.play('sit', true, 1, Math.random() * 4, 0.15);
    }
    this.group.position.copy(local);
    this.group.visible = true;
  }

  /** stand up beside the car and walk away (caller re-adds the group to the scene first) */
  alight(door: Vec2, away: Vec2) {
    this.group.visible = true;
    this.group.rotation.set(0, Math.atan2(away.x - door.x, away.z - door.z), 0);
    this.group.position.set(door.x, groundAt(door.x, door.z), door.z);
    this.to.set(away.x, groundAt(away.x, away.z), away.z);
    this.state = 'alight';
    this.sub = 'stand';
    this.subT = this.clips.crouch_out ? 0.75 : 0;
    if (this.subT) this.play('crouch_out', false, 2.2, 2.3, 0.1);
  }

  /** face the taxi while waiting and wave once when it comes close */
  lookAt(p: Vec2) {
    if (this.state !== 'wait') return;
    const dx = p.x - this.group.position.x, dz = p.z - this.group.position.z;
    this.group.rotation.y = Math.atan2(dx, dz);
    if (!this.waved && dx * dx + dz * dz < 30 * 30 && this.clips.wave) {
      this.waved = true;
      this.waveLeft = this.play('wave', false, 1.1, 0.3, 0.25) - 0.3;
    }
  }

  update(dt: number) {
    this.mixer.update(dt);
    if (this.waveLeft > 0) {
      this.waveLeft -= dt;
      if (this.waveLeft <= 0 && this.state === 'wait') this.play(this.clips.wait ? 'wait' : 'idle', true, 1, 0, 0.5);
    }
    if (this.state === 'board') {
      if (this.sub === 'walk') {
        this.t = Math.min(1, this.t + dt / this.dur);
        this.group.position.lerpVectors(this.from, this.to, this.t);
        if (this.t >= 1) {
          this.sub = 'crouch';
          this.subT = this.clips.crouch_in ? 0.6 : 0;
          if (this.subT) this.play('crouch_in', false, 2.1, 0.9, 0.15);
        }
      } else {
        this.subT -= dt;
        if (this.subT <= 0) { this.state = 'ride'; this.group.visible = false; }
      }
    } else if (this.state === 'alight') {
      if (this.sub === 'stand') {
        this.subT -= dt;
        if (this.subT <= 0) this.moveTo({ x: this.to.x, z: this.to.z }, 1.4);
      } else {
        this.t = Math.min(1, this.t + dt / this.dur);
        this.group.position.lerpVectors(this.from, this.to, this.t);
        if (this.t >= 1) this.state = 'gone';
      }
    }
  }

  dispose() {
    this.group.removeFromParent();
    this.mixer.stopAllAction();
  }
}
