import * as THREE from 'three';
import type { CollisionWorld } from '@/game/physics/collision';
import { clamp, damp, dampAngle } from '@/utils/math';
import type { InputFrame } from '@/game/input/InputManager';

export class CameraRig {
  yaw = 0;
  pitch = 0.32;
  private dist = 5.2;
  private distFoot = 5.2;
  private distCar = 8.5;
  private curDist = 5.2;
  private target = new THREE.Vector3();
  private lastLook = 0;
  private mode: 'foot' | 'car' | 'orbit' = 'foot';

  constructor(public camera: THREE.PerspectiveCamera) {}

  setMode(mode: 'foot' | 'car' | 'orbit') {
    this.mode = mode;
    this.dist = mode === 'car' ? this.distCar : this.distFoot;
  }

  snap(x: number, y: number, z: number, yaw: number) {
    this.target.set(x, y, z);
    this.yaw = yaw;
    this.curDist = this.dist;
  }

  update(dt: number, inp: InputFrame | null, tx: number, ty: number, tz: number, followHeading: number | null, speed: number, world: CollisionWorld) {
    const now = performance.now();
    if (inp) {
      const sens = inp.analogLook ? 0.0042 : 0.0026;
      if (inp.lookX || inp.lookY) this.lastLook = now;
      this.yaw -= inp.lookX * sens;
      this.pitch = clamp(this.pitch + inp.lookY * sens, -0.25, 1.25);
      if (inp.zoom) {
        const range = this.mode === 'car' ? [5, 16] : [2.4, 11];
        this.dist = clamp(this.dist + inp.zoom * 0.8, range[0], range[1]);
        if (this.mode === 'car') this.distCar = this.dist;
        else this.distFoot = this.dist;
      }
    }
    // auto-follow behind the vehicle when the player isn't steering the camera
    if (followHeading !== null && now - this.lastLook > 1400 && speed > 1.5) {
      this.yaw = dampAngle(this.yaw, followHeading, 2.2, dt);
      this.pitch = damp(this.pitch, 0.22, 1.5, dt);
    }
    this.target.x = damp(this.target.x, tx, 14, dt);
    this.target.y = damp(this.target.y, ty, 10, dt);
    this.target.z = damp(this.target.z, tz, 14, dt);

    const cp = Math.cos(this.pitch);
    const dx = Math.sin(this.yaw) * cp;
    const dz = Math.cos(this.yaw) * cp;
    const dy = -Math.sin(this.pitch);
    const want = this.dist + (this.mode === 'car' ? Math.min(3, speed * 0.05) : 0);
    // collision: shorten the boom if a building is in the way
    const hd = Math.hypot(dx, dz) || 1;
    const hit = world.raycast(this.target.x, this.target.z, -dx / hd, -dz / hd, want * hd + 0.4, Math.max(0.5, this.target.y + 0.5));
    const allowed = Math.max(1.2, (hit - 0.4) / hd);
    const goal = Math.min(want, allowed);
    this.curDist = goal < this.curDist ? goal : damp(this.curDist, goal, 3, dt);
    const cx = this.target.x - dx * this.curDist;
    const cz = this.target.z - dz * this.curDist;
    const cy = Math.max(0.35, this.target.y - dy * this.curDist);
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(this.target.x, this.target.y + (this.mode === 'car' ? 0.4 : 0.1), this.target.z);
  }

  /** slow cinematic orbit for the main menu */
  orbit(dt: number, cx: number, cz: number, radius: number, height: number) {
    this.yaw += dt * 0.05;
    this.camera.position.set(cx + Math.sin(this.yaw) * radius, height, cz + Math.cos(this.yaw) * radius);
    this.camera.lookAt(cx, 18, cz);
  }
}
