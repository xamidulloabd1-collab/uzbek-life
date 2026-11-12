import joshqinUrl from './characters/joshqin.glb?url';
import overpassHdr from './environment/pedestrian_overpass_1k.hdr?url';

/**
 * Asset manifest — every external file used by the game, with licence and status.
 * status: 'final' = production quality, licence cleared · 'temporary' = licensed, to be replaced by an original asset
 * Folders: buildings/ vehicles/ characters/ vegetation/ roads/ props/ textures/ environment/ (see README.md in each).
 */
export interface AssetEntry {
  url: string;
  type: 'gltf' | 'hdr';
  license: string;
  source: string;
  status: 'final' | 'temporary';
  /** optional lower-detail versions, nearest first (used by AssetManager.createLOD) */
  lods?: { url: string; distance: number }[];
  /** loaded only when first requested */
  lazy?: boolean;
}

export const ASSETS: Record<string, AssetEntry> = {
  'env.day': {
    url: overpassHdr,
    type: 'hdr',
    license: 'CC0 1.0 (Poly Haven)',
    source: 'Poly Haven "Pedestrian Overpass" 1k HDRI, via three.js examples',
    status: 'final',
  },
  'char.player': {
    url: joshqinUrl,
    type: 'gltf',
    license: 'MIT (Microsoft Rocketbox Avatar Library, © 2020 Microsoft)',
    source: 'Rocketbox "Male_Adult_10" + 25 Rocketbox animations, retargeted and baked in Blender 5.0, textures 1024 px, meshopt-compressed (tools/blender/rocketbox_to_glb.py)',
    status: 'final',
  },
};

/**
 * Licensed vehicle models (see MISSING_ASSETS.md for the exact specification).
 *   import cobaltUrl from './vehicles/cobalt.glb?url';
 *   zarafshon: { url: cobaltUrl, license: '…' }
 * Empty: no licensed vehicle model has been added yet — the procedural models are used and labelled as unfinished.
 */
export const VEHICLE_MODELS: Record<string, { url: string; license: string } | undefined> = {};

/** Rocketbox (MIT) NPC avatars, mesh only — clips are shared from the player GLB (same Biped skeleton) */
const npcGlob = import.meta.glob('./characters/npc/*.glb', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export const NPC_AVATARS: string[] = Object.keys(npcGlob).sort().map((k) => npcGlob[k]);
