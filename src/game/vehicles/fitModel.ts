import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** clone a vehicle GLB and fit it to a target length: +Z forward, wheels on the ground, centred */
export function fitVehicleModel(gltf: GLTF, length: number, rotateY = 0, cloneMaterials = false) {
  const clone = gltf.scene.clone(true);
  if (cloneMaterials) {
    clone.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.material = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : m.material.clone();
    });
  }
  const size = new THREE.Box3().setFromObject(clone).getSize(new THREE.Vector3());
  clone.rotation.y = (size.z >= size.x ? 0 : Math.PI / 2) + rotateY;
  const holder = new THREE.Group();
  holder.add(clone);
  holder.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(holder);
  const k = length / Math.max(b.max.x - b.min.x, b.max.z - b.min.z);
  holder.scale.setScalar(k);
  holder.position.set(-((b.min.x + b.max.x) / 2) * k, -b.min.y * k, -((b.min.z + b.max.z) / 2) * k);
  holder.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  const outer = new THREE.Group();
  outer.add(holder);
  return outer;
}

/** paint-coloured materials of a GLB (names containing body / paint / carpaint) */
export function paintMaterials(root: THREE.Object3D) {
  const out: THREE.MeshStandardMaterial[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      if (/body|paint|carpaint|exterior/i.test(mat.name + ' ' + o.name) && (mat as THREE.MeshStandardMaterial).color) out.push(mat as THREE.MeshStandardMaterial);
    }
  });
  return out;
}
