import * as THREE from 'three';
import type { OwnedVehicle, VehicleSpec } from '@/types';
import { VEHICLE_MAP } from '@/config/vehicles';
import type { TextureLib } from '@/game/world/textures';
import type { CollisionWorld } from '@/game/physics/collision';
import { groundHeight } from '@/game/world/cityLayout';
import { buildVehicleModel, type VehicleModel } from './vehicleModel';
import { VehiclePhysics, type DriveInput, type Obstacle } from './VehiclePhysics';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

const IDLE: DriveInput = { throttle: 0, brake: 0, steer: 0, handbrake: true };

function isAncestor(a: THREE.Object3D, b: THREE.Object3D) {
  for (let p: THREE.Object3D | null = b.parent; p; p = p.parent) if (p === a) return true;
  return false;
}

export class Vehicle {
  spec: VehicleSpec;
  physics: VehiclePhysics;
  model: VehicleModel;
  owned: OwnedVehicle;
  readonly group = new THREE.Group();
  lightsMode: 'auto' | 'on' | 'off' = 'auto';
  signal: 'none' | 'left' | 'right' | 'hazard' = 'none';
  private night = 0;
  /** true for NPC cars the player is using temporarily */
  borrowed = false;

  get lightsOn() {
    return this.lightsMode === 'on' || (this.lightsMode === 'auto' && this.night > 0.35);
  }
  private visualKey = '';
  private glb: { root: THREE.Object3D; wheels: { node: THREE.Object3D; front: boolean; baseY: number }[]; paint: THREE.MeshStandardMaterial[] } | null = null;
  private glbSource: GLTF | null = null;

  constructor(owned: OwnedVehicle, private tex: TextureLib, private physical: boolean, private withSpot: boolean) {
    this.owned = owned;
    this.spec = VEHICLE_MAP[owned.specId];
    this.physics = new VehiclePhysics(this.spec, owned);
    this.model = this.makeModel(owned);
  }

  private keyOf(o: OwnedVehicle) {
    return [o.specId, o.color, o.wheels, o.tint, o.plate].join('|');
  }

  private makeModel(o: OwnedVehicle) {
    const m = buildVehicleModel(this.spec, o, this.tex, this.physical, this.withSpot);
    this.group.add(m.root);
    this.visualKey = this.keyOf(o);
    if (this.glbSource) this.attachGLB(m, this.glbSource);
    return m;
  }

  /** replace the procedural body with a licensed GLB model (see src/assets/manifest.ts) */
  private glbRotate = 0;

  useGLB(gltf: GLTF, rotateY = 0) {
    this.glbRotate = rotateY;
    this.glbSource = gltf;
    this.attachGLB(this.model, gltf);
  }

  private attachGLB(m: VehicleModel, gltf: GLTF) {
    const root = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const alongZ = size.z >= size.x;
    root.rotation.y = (alongZ ? 0 : Math.PI / 2) + this.glbRotate;
    const s = this.spec.dims.length / Math.max(size.x, size.z);
    root.scale.setScalar(s);
    const b2 = new THREE.Box3().setFromObject(root);
    root.position.set(-(b2.min.x + b2.max.x) / 2, -b2.min.y, -(b2.min.z + b2.max.z) / 2);
    const wheels: { node: THREE.Object3D; front: boolean; baseY: number }[] = [];
    const paint: THREE.MeshStandardMaterial[] = [];
    m.root.add(root);
    m.root.updateMatrixWorld(true);
    // wheels: outermost nodes whose name mentions wheel/tyre/rim; side from the position
    const cands: THREE.Object3D[] = [];
    root.traverse((o) => {
      if (/wheel|tire|tyre|rim/i.test(o.name) && !/steer|spare|well|arch|cover/i.test(o.name) && !cands.some((c) => isAncestor(c, o))) cands.push(o);
    });
    if (cands.length >= 4) {
      for (const node of cands) {
        const box = new THREE.Box3().setFromObject(node);
        const c = box.getCenter(new THREE.Vector3());
        const local = m.root.worldToLocal(c.clone());
        const pivot = new THREE.Object3D();
        pivot.position.copy(local);
        m.root.add(pivot);
        pivot.updateMatrixWorld(true);
        pivot.attach(node);
        wheels.push({ node: pivot, front: local.z > 0, baseY: 0 });
      }
    }
    root.traverse((o) => {
      const name = o.name.toLowerCase();
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          if (/body|paint/.test((mat.name + name).toLowerCase()) && (mat as THREE.MeshStandardMaterial).color) paint.push(mat as THREE.MeshStandardMaterial);
        }
      }
    });
    paint.forEach((p) => p.color.set(this.owned.color));
    m.body.visible = false;
    m.wheels.forEach((w) => (w.pivot.visible = wheels.length < 4));
    this.glb = { root, wheels, paint };
  }

  get usesLicensedModel() {
    return !!this.glb;
  }

  /** apply garage changes (paint, wheels, plate, upgrades, repairs, fuel) */
  applyOwned(o: OwnedVehicle) {
    this.owned = o;
    if (this.keyOf(o) !== this.visualKey) {
      this.group.remove(this.model.root);
      this.model.dispose();
      this.model = this.makeModel(o);
    }
    this.physics.applyUpgrades(o);
    this.physics.fuel = o.fuel;
    this.physics.health = o.health;
  }

  place(x: number, z: number, heading: number) {
    this.physics.place(x, z, heading);
    this.physics.y = groundHeight(x, z);
    this.sync(0, 0);
  }

  update(dt: number, input: DriveInput | null, world: CollisionWorld, obstacles: Obstacle[]) {
    const p = this.physics;
    p.update(dt, input ?? IDLE, world, obstacles, groundHeight(p.x, p.z), !!input);
  }

  sync(night: number, _dt: number) {
    const p = this.physics;
    const m = this.model;
    m.root.position.set(p.x, p.y, p.z);
    m.root.rotation.y = p.heading;
    m.body.rotation.x = p.pitch;
    m.body.rotation.z = p.roll;
    for (const w of m.wheels) {
      if (w.front) w.pivot.rotation.y = p.steerAngle;
      w.spin.rotation.x = p.wheelSpin;
    }
    m.steering.rotation.z = p.steerAngle * 6;
    if (this.glb && this.glb.wheels.length >= 4) {
      for (const w of this.glb.wheels) {
        w.node.rotation.x = p.wheelSpin;
        if (w.front) w.node.rotation.y = w.baseY + p.steerAngle;
      }
    }
    this.night = night;
    const on = this.lightsOn && p.engineOn;
    m.head.emissiveIntensity = on ? 2.6 : 0.08;
    m.tail.emissiveIntensity = (on ? 1.1 : 0.12) + (p.braking ? 2.8 : 0);
    const blink = Math.floor(performance.now() / 380) % 2 === 0;
    m.amberL.emissiveIntensity = blink && (this.signal === 'left' || this.signal === 'hazard') ? 3.2 : 0.06;
    m.amberR.emissiveIntensity = blink && (this.signal === 'right' || this.signal === 'hazard') ? 3.2 : 0.06;
    if (m.spot) m.spot.intensity = night * 260;
  }

  dispose() {
    this.group.remove(this.model.root);
    this.model.dispose();
  }
}
