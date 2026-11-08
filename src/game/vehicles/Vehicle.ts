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
    // measure in the car's own frame (heading and position would distort world-space boxes)
    const savedPos = m.root.position.clone(), savedRot = m.root.rotation.clone();
    m.root.position.set(0, 0, 0);
    m.root.rotation.set(0, 0, 0);
    m.root.add(root);
    m.root.updateMatrixWorld(true);
    // wheels: candidates by name, then by shape (round, near the ground, wheel-sized);
    // one per corner (front-left, front-right, rear-left, rear-right), largest wins
    const L = this.spec.dims.length;
    const rootBox = new THREE.Box3().setFromObject(root);
    const height = rootBox.max.y - rootBox.min.y;
    const wheelLike = (o: THREE.Object3D) => {
      const box = new THREE.Box3().setFromObject(o);
      if (box.isEmpty()) return null;
      const size = box.getSize(new THREE.Vector3());
      const c = m.root.worldToLocal(box.getCenter(new THREE.Vector3()));
      const dia = Math.max(size.y, size.z);
      const round = Math.abs(size.y - size.z) < dia * 0.35;
      const sized = dia > L * 0.1 && dia < L * 0.32;
      const low = c.y - rootBox.min.y < height * 0.45;
      return round && sized && low ? { c, dia } : null;
    };
    const named: THREE.Object3D[] = [];
    root.traverse((o) => {
      if (/wheel|tire|tyre|rim/i.test(o.name) && !/steer|spare|well|arch|cover|brake|caliper|disc/i.test(o.name) && !named.some((x) => isAncestor(x, o))) named.push(o);
    });
    const pickCorners = (list: THREE.Object3D[]) => {
      const best = new Map<string, { node: THREE.Object3D; c: THREE.Vector3; dia: number }>();
      for (const node of list) {
        const w = wheelLike(node);
        if (!w) continue;
        const key = `${w.c.z > 0 ? 'f' : 'r'}${w.c.x > 0 ? 'l' : 'r'}`;
        const cur = best.get(key);
        if (!cur || w.dia > cur.dia) best.set(key, { node, ...w });
      }
      return best;
    };
    let corners = pickCorners(named);
    if (corners.size < 4) {
      const meshes: THREE.Object3D[] = [];
      root.traverse((o) => (o as THREE.Mesh).isMesh && meshes.push(o));
      const byShape = pickCorners(meshes);
      if (byShape.size === 4) corners = byShape;
    }
    if (corners.size === 4) {
      for (const { node, c } of corners.values()) {
        const pivot = new THREE.Object3D();
        pivot.position.copy(c);
        m.root.add(pivot);
        pivot.updateMatrixWorld(true);
        pivot.attach(node);
        wheels.push({ node: pivot, front: c.z > 0, baseY: 0 });
      }
    }
    m.root.position.copy(savedPos);
    m.root.rotation.copy(savedRot);
    m.root.updateMatrixWorld(true);
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
    m.wheels.forEach((w) => (w.pivot.visible = wheels.length !== 4));
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
