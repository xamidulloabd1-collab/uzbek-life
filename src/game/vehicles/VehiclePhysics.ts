import type { OwnedVehicle, VehicleSpec } from '@/types';
import type { CollisionWorld } from '@/game/physics/collision';
import { clamp, damp } from '@/utils/math';

export interface DriveInput {
  throttle: number;
  brake: number;
  steer: number;
  handbrake: boolean;
}

export interface Obstacle {
  x: number;
  z: number;
  r: number;
  onHit?: (impact: number) => void;
}

const G = 9.81;
const STEP = 1 / 120;

/**
 * Arcade-realistic single-track ("bicycle") model:
 * slip-angle tyre forces with a grip limit, weight-light yaw inertia,
 * engine force curve, braking, handbrake rear-grip loss, drag,
 * plus a kinematic blend at low speed for stability.
 */
export class VehiclePhysics {
  x = 0;
  z = 0;
  y = 0;
  heading = 0;
  vx = 0; // forward speed (m/s)
  vy = 0; // lateral speed, + = left
  yawRate = 0;
  steerAngle = 0;
  wheelSpin = 0;
  rpm = 900;
  gear = 'N';
  pitch = 0;
  roll = 0;
  fuel: number;
  health: number;
  braking = false;
  throttleOut = 0;
  lastImpact = 0;
  engineOn = true;
  private acc = 0;
  private longAcc = 0;
  private latAcc = 0;
  private maxV = 40;
  private accel = 3;
  private grip = 1;
  constructor(public spec: VehicleSpec, owned: OwnedVehicle) {
    this.fuel = owned.fuel;
    this.health = owned.health;
    this.applyUpgrades(owned);
  }

  applyUpgrades(o: Pick<OwnedVehicle, 'engine' | 'handling'>) {
    const p = this.spec.perf;
    this.maxV = (p.maxSpeedKmh / 3.6) * (1 + 0.08 * o.engine);
    this.accel = p.accel * (1 + 0.18 * o.engine);
    this.grip = p.grip * (1 + 0.07 * o.handling);
  }

  get speedKmh() {
    return Math.abs(this.vx) * 3.6;
  }

  get fwdX() {
    return Math.sin(this.heading);
  }
  get fwdZ() {
    return Math.cos(this.heading);
  }

  place(x: number, z: number, heading: number) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.vx = this.vy = this.yawRate = 0;
  }

  update(dt: number, input: DriveInput, world: CollisionWorld, obstacles: Obstacle[], groundY: number, driven: boolean) {
    this.acc += Math.min(dt, 0.1);
    while (this.acc >= STEP) {
      this.acc -= STEP;
      this.step(STEP, driven ? input : { throttle: 0, brake: 0, steer: 0, handbrake: true });
      this.collide(world, obstacles);
    }
    this.y = damp(this.y, groundY, 12, dt);
    const susp = this.spec.perf.suspension;
    this.pitch = damp(this.pitch, clamp(-this.longAcc * 0.011 * susp, -0.07, 0.07), 8, dt);
    this.roll = damp(this.roll, clamp(this.latAcc * 0.014 * susp, -0.09, 0.09), 8, dt);
    this.wheelSpin += (this.vx / this.spec.dims.wheelRadius) * dt;
    this.updateGear(input.throttle);
  }

  private step(dt: number, inp: DriveInput) {
    const p = this.spec.perf;
    const m = p.mass;
    const L = this.spec.dims.wheelbase;
    const a = L * 0.47;
    const b = L * 0.53;
    const I = m * L * L * 0.3;
    const absV = Math.abs(this.vx);
    const engineOk = this.fuel > 0 && this.health > 0 && this.engineOn;

    // steering — less lock at speed
    const lock = p.steerAngle / (1 + absV / 16);
    const target = -inp.steer * lock;
    const rate = p.steerSpeed * dt;
    this.steerAngle += clamp(target - this.steerAngle, -rate, rate);
    const d = this.steerAngle;

    // longitudinal
    let Fx = 0;
    this.braking = false;
    const power = engineOk ? (this.health < 25 ? 0.55 : 1) : 0;
    if (inp.throttle > 0) {
      if (this.vx > -0.5) {
        const r = clamp(this.vx / this.maxV, 0, 1);
        Fx += inp.throttle * m * this.accel * power * (1 - Math.pow(r, 1.7));
      } else {
        Fx += inp.throttle * m * p.brake;
        this.braking = true;
      }
    }
    if (inp.brake > 0) {
      if (this.vx > 0.6) {
        Fx -= inp.brake * m * p.brake;
        this.braking = true;
      } else if (this.vx > -6) {
        Fx -= inp.brake * m * this.accel * 0.6 * power;
      }
    }
    if (inp.handbrake && absV > 0.2) Fx -= Math.sign(this.vx) * m * 3.5;
    Fx -= 0.42 * this.vx * absV; // aero
    Fx -= m * 0.12 * this.vx; // rolling
    if (inp.throttle === 0 && inp.brake === 0 && absV > 0.05) Fx -= Math.sign(this.vx) * m * 0.45 * Math.min(1, absV);
    this.throttleOut = inp.throttle * power;

    // lateral
    let Fyf = 0;
    let Fyr = 0;
    if (absV < 1.5 || this.vx < 0) {
      const kin = (this.vx * Math.tan(d)) / L;
      this.yawRate += (kin - this.yawRate) * Math.min(1, dt * 20);
      this.vy *= Math.exp(-12 * dt);
    } else {
      const C = m * 45;
      const af = Math.atan2(this.vy + this.yawRate * a, absV) - d;
      const ar = Math.atan2(this.vy - this.yawRate * b, absV);
      const muF = this.grip * G * m * (b / L);
      const muR = this.grip * G * m * (a / L) * (inp.handbrake ? 0.38 : 1);
      Fyf = clamp(-C * af, -muF, muF);
      Fyr = clamp(-C * ar, -muR, muR);
      const torque = a * Fyf * Math.cos(d) - b * Fyr;
      this.yawRate += (torque / I) * dt;
      this.vy += ((Fyf * Math.cos(d) + Fyr) / m - this.yawRate * this.vx) * dt;
    }
    const ax = Fx / m + this.yawRate * this.vy;
    const prevVx = this.vx;
    this.vx += ax * dt;
    if (inp.throttle === 0 && Math.sign(prevVx) !== Math.sign(this.vx) && inp.brake === 0) this.vx = 0;
    if (prevVx > 0.3 && this.vx < 0 && inp.brake > 0) this.vx = 0; // stop before reversing
    if (absV < 0.05 && inp.throttle === 0 && inp.brake === 0) this.vx = 0;

    this.longAcc = ax;
    this.latAcc = (Fyf + Fyr) / m;
    this.heading += this.yawRate * dt;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const lx = Math.cos(this.heading), lz = -Math.sin(this.heading);
    this.x += (fx * this.vx + lx * this.vy) * dt;
    this.z += (fz * this.vx + lz * this.vy) * dt;

    // fuel
    if (engineOk) {
      const perM = p.consumption / 100000;
      this.fuel = Math.max(0, this.fuel - absV * dt * perM * (0.55 + 0.9 * inp.throttle) - 0.00012 * dt);
    }
  }

  private circles() {
    const { length: L, width: W } = this.spec.dims;
    const off = L / 2 - W / 2;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    return [-off, 0, off].map((o) => ({ ox: fx * o, oz: fz * o, r: W / 2 }));
  }

  private applyImpulse(nx: number, nz: number, rx: number, rz: number, restitution: number) {
    const m = this.spec.perf.mass;
    const L = this.spec.dims.wheelbase;
    const I = m * L * L * 0.3;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const lx = Math.cos(this.heading), lz = -Math.sin(this.heading);
    let wx = fx * this.vx + lx * this.vy;
    let wz = fz * this.vx + lz * this.vy;
    // point velocity: v + ω × r  (perp(r) = (rz, -rx))
    const pvx = wx + this.yawRate * rz;
    const pvz = wz - this.yawRate * rx;
    const vn = pvx * nx + pvz * nz;
    if (vn >= 0) return 0;
    const rn = rz * nx - rx * nz;
    const j = (-(1 + restitution) * vn) / (1 / m + (rn * rn) / I);
    wx += (j * nx) / m;
    wz += (j * nz) / m;
    this.yawRate += (rn * j) / I;
    // scrub energy on impact
    wx *= 0.9;
    wz *= 0.9;
    this.vx = wx * fx + wz * fz;
    this.vy = wx * lx + wz * lz;
    return -vn;
  }

  private collide(world: CollisionWorld, obstacles: Obstacle[]) {
    let worst = 0;
    for (const c of this.circles()) {
      const p = { x: this.x + c.ox, z: this.z + c.oz };
      const hit = world.resolveCircle(p, c.r);
      if (hit) {
        this.x += p.x - (this.x + c.ox);
        this.z += p.z - (this.z + c.oz);
        worst = Math.max(worst, this.applyImpulse(hit.nx, hit.nz, c.ox, c.oz, 0.15));
      }
      for (const o of obstacles) {
        const dx = this.x + c.ox - o.x;
        const dz = this.z + c.oz - o.z;
        const dd = Math.hypot(dx, dz);
        const min = c.r + o.r;
        if (dd < min && dd > 1e-4) {
          const nx = dx / dd, nz = dz / dd;
          this.x += nx * (min - dd);
          this.z += nz * (min - dd);
          const imp = this.applyImpulse(nx, nz, c.ox, c.oz, 0.2);
          if (imp > 0.5) o.onHit?.(imp);
          worst = Math.max(worst, imp);
        }
      }
    }
    if (worst > 3) {
      this.health = Math.max(0, this.health - (worst - 3) * 3.2);
      this.lastImpact = worst;
    }
  }

  private updateGear(throttle: number) {
    const v = this.speedKmh;
    if (this.vx < -0.3) {
      this.gear = 'R';
      this.rpm = 1000 + v * 90;
      return;
    }
    if (v < 1 && throttle === 0) {
      this.gear = 'N';
      this.rpm = damp(this.rpm, 850, 6, 1 / 60);
      return;
    }
    const top = this.maxV * 3.6;
    const bands = [0, 0.13, 0.27, 0.43, 0.62, 0.82, 1.05].map((f) => f * top);
    let g = 1;
    while (g < 5 && v > bands[g]) g++;
    const lo = bands[g - 1], hi = bands[g];
    const t = clamp((v - lo) / (hi - lo), 0, 1);
    this.gear = String(g);
    this.rpm = 1100 + t * 4800 + throttle * 300;
  }
}
