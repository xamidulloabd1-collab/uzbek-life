import civilianUrl from './characters/civilian-michelle.glb?url';
import locomotionUrl from './characters/mixamo-locomotion.glb?url';
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
    url: civilianUrl,
    type: 'gltf',
    license: 'Adobe Mixamo — royalty-free in projects, not redistributable as a standalone asset',
    source: 'Mixamo civilian character "Michelle" (casual clothing), via three.js examples (unmodified file)',
    status: 'temporary',
  },
  'anim.locomotion': {
    url: locomotionUrl,
    type: 'gltf',
    license: 'Adobe Mixamo — royalty-free in projects, not redistributable as a standalone asset',
    source: 'Mixamo Idle / Walk / Run clips (skeleton only, meshes stripped), retargeted by bone name',
    status: 'temporary',
  },
};

/**
 * Licensed vehicle models (see MISSING_ASSETS.md for the exact specification).
 *   import cobaltUrl from './vehicles/cobalt.glb?url';
 *   zarafshon: { url: cobaltUrl, license: '…' }
 * Empty: no licensed vehicle model has been added yet — the procedural models are used and labelled as unfinished.
 */
export const VEHICLE_MODELS: Record<string, { url: string; license: string } | undefined> = {};
