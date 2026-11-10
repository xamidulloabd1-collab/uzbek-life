import * as THREE from 'three';
import type { World } from './World';
import type { Interiors } from './Interiors';

/** where each downloaded material goes: world material keys, per-key tint, texture repeats per UV tile */
const TARGETS: Record<string, { keys: string[]; tint?: Record<string, string>; repeat: number }> = {
  asphalt: { keys: ['asphalt', 'junction'], repeat: 4 },
  concrete: { keys: ['concrete', 'curb'], repeat: 2 },
  paving: { keys: ['pavers', 'plaza'], repeat: 2 },
  plaster: { keys: ['plaster', 'plaster2', 'plaster3', 'plaster4'], tint: { plaster2: '#efe5d3', plaster3: '#e9c9a6', plaster4: '#d7dbd6' }, repeat: 2 },
  grass: { keys: ['grass'], repeat: 3 },
  roof: { keys: ['tin', 'tin-red', 'tin-green', 'tin-grey'], tint: { 'tin-red': '#b0493c', 'tin-green': '#4c8a5c', 'tin-grey': '#a5aab0' }, repeat: 2 },
  bricks: { keys: ['brick'], repeat: 2 },
};

/**
 * Optional photographic PBR materials (CC0, ambientCG) from public/assets/materials/materials.json,
 * written by `npm run assets:fetch`. Without the folder the procedural textures stay in place.
 */
export async function applyPhotoMaterials(world: World, interiors?: Interiors): Promise<string[]> {
  if (!/^https?:$/.test(location.protocol)) return [];
  const base = `${import.meta.env.BASE_URL}assets/materials/`;
  let manifest: { materials: Record<string, { id: string; files: Record<string, string> }> };
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 1500);
    const r = await fetch(`${base}materials.json`, { cache: 'no-cache', signal: ac.signal });
    clearTimeout(t);
    if (!r.ok) return [];
    manifest = await r.json();
  } catch {
    return [];
  }
  const loader = new THREE.TextureLoader();
  const load = (name: string, file?: string) => (file ? loader.loadAsync(`${base}${name}/${file}`).catch(() => null) : Promise.resolve(null));
  const applied: string[] = [];
  for (const [name, m] of Object.entries(manifest.materials ?? {})) {
    const [color, normal, rough] = await Promise.all([load(name, m.files.color), load(name, m.files.normal), load(name, m.files.roughness)]);
    if (!color) continue;
    color.colorSpace = THREE.SRGBColorSpace;
    const prep = (tx: THREE.Texture | null, rep: number) => {
      if (!tx) return null;
      const c = tx.clone();
      c.wrapS = c.wrapT = THREE.RepeatWrapping;
      c.repeat.set(rep, rep);
      c.anisotropy = 8;
      c.needsUpdate = true;
      return c;
    };
    const tg = TARGETS[name];
    if (tg) {
      for (const key of tg.keys) {
        const mat = world.mats[key] as THREE.MeshStandardMaterial | undefined;
        if (!mat || !mat.isMeshStandardMaterial) continue;
        mat.map = prep(color, tg.repeat);
        mat.normalMap = prep(normal, tg.repeat);
        if (rough) {
          mat.roughnessMap = prep(rough, tg.repeat);
          mat.roughness = 1;
        }
        mat.color.set(tg.tint?.[key] ?? '#ffffff');
        mat.needsUpdate = true;
      }
    }
    if (name === 'ground') world.applyTerrainPhoto(prep(color, 6)!, prep(normal, 6), prep(rough, 6));
    if ((name === 'woodfloor' || name === 'tiles') && interiors) interiors.applyFloor(name === 'woodfloor' ? 'wood' : 'tiles', prep(color, 3)!, prep(normal, 3), prep(rough, 3));
    applied.push(`${name}:${m.id}`);
  }
  return applied;
}
