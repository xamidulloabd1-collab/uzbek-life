import * as THREE from 'three';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Vec2 } from '@/types';
import { groundAt } from '@/game/world/guzor/network';

export interface AvatarSource { scene: THREE.Object3D; idle: THREE.AnimationClip; walk: THREE.AnimationClip; scale: number }

/** a taxi passenger who really stands in the world, walks to the car, rides along and gets out */
export class Customer {
  readonly group = new THREE.Group();
  state: 'wait' | 'board' | 'ride' | 'alight' | 'gone' = 'wait';
  private mixer: THREE.AnimationMixer;
  private idle: THREE.AnimationAction;
  private walk: THREE.AnimationAction;
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private t = 0;
  private dur = 1;

  constructor(src: AvatarSource, pos: Vec2, facing: number) {
    const m = skClone(src.scene);
    m.getObjectByName('accessories')?.removeFromParent();
    m.scale.setScalar(src.scale);
    m.traverse((o) => ((o as THREE.Mesh).castShadow = true));
    this.group.add(m);
    this.mixer = new THREE.AnimationMixer(m);
    this.idle = this.mixer.clipAction(src.idle).play();
    this.walk = this.mixer.clipAction(src.walk);
    this.group.position.set(pos.x, groundAt(pos.x, pos.z), pos.z);
    this.group.rotation.y = facing;
  }

  private moveTo(p: Vec2, dur: number) {
    this.from.copy(this.group.position);
    this.to.set(p.x, groundAt(p.x, p.z), p.z);
    this.t = 0;
    this.dur = dur;
    this.group.rotation.y = Math.atan2(this.to.x - this.from.x, this.to.z - this.from.z);
    this.idle.stop();
    this.walk.reset().play();
  }

  /** walk to the car door, then get in */
  board(door: Vec2) {
    this.state = 'board';
    this.moveTo(door, 1.6);
  }

  /** appear beside the car and walk away */
  alight(door: Vec2, away: Vec2) {
    this.group.visible = true;
    this.group.position.set(door.x, groundAt(door.x, door.z), door.z);
    this.state = 'alight';
    this.moveTo(away, 4);
  }

  /** face the taxi while waiting */
  lookAt(p: Vec2) {
    if (this.state === 'wait') this.group.rotation.y = Math.atan2(p.x - this.group.position.x, p.z - this.group.position.z);
  }

  update(dt: number) {
    this.mixer.update(dt);
    if (this.state === 'board' || this.state === 'alight') {
      this.t = Math.min(1, this.t + dt / this.dur);
      this.group.position.lerpVectors(this.from, this.to, this.t);
      if (this.t >= 1) {
        if (this.state === 'board') { this.state = 'ride'; this.group.visible = false; }
        else this.state = 'gone';
      }
    }
  }

  dispose() {
    this.group.removeFromParent();
    this.mixer.stopAllAction();
  }
}
