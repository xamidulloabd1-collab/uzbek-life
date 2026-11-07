/**
 * Drop-in asset library.
 * Any GLB placed in these folders is discovered at build time — no code changes needed:
 *   vehicles/<id>.glb     id = lola | chumchuq | zarafshon | bahor | amir | karvon | qoya | burgut
 *                          (aliases: nexia3, spark, cobalt, gentra, malibu2, damas, tracker, equinox)
 *   buildings/house_*.glb  mahalla houses (several variants are mixed)
 *   buildings/gate_*.glb   darvoza gates
 *   props/lamp*.glb · props/bench*.glb
 *   vegetation/tree*.glb · vegetation/bush*.glb
 * Every GLB must have a sidecar `<name>.license.json`: { "author": "", "license": "", "source": "" }.
 */
export type SlotKind = 'vehicle' | 'house' | 'gate' | 'lamp' | 'bench' | 'tree' | 'bush';

export interface LibraryEntry {
  slot: string; // e.g. "vehicle:karvon", "house:house_a"
  kind: SlotKind;
  name: string;
  url: string;
  license: { author: string; license: string; source: string } | null;
  origin: 'bundled' | 'user';
}

export const VEHICLE_ALIASES: Record<string, string> = {
  nexia3: 'lola', nexia: 'lola', spark: 'chumchuq', cobalt: 'zarafshon', gentra: 'bahor', lacetti: 'bahor',
  malibu2: 'amir', malibu: 'amir', damas: 'karvon', tracker: 'qoya', equinox: 'burgut',
};

const files = import.meta.glob('./{vehicles,buildings,props,vegetation}/*.glb', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const licenses = import.meta.glob('./{vehicles,buildings,props,vegetation}/*.license.json', { import: 'default', eager: true }) as Record<string, LibraryEntry['license']>;

export function classify(folder: string, base: string): { kind: SlotKind; slot: string } | null {
  const b = base.toLowerCase();
  if (folder === 'vehicles') {
    const id = VEHICLE_ALIASES[b] ?? b;
    return { kind: 'vehicle', slot: `vehicle:${id}` };
  }
  if (folder === 'buildings' && b.startsWith('house')) return { kind: 'house', slot: `house:${b}` };
  if (folder === 'buildings' && b.startsWith('gate')) return { kind: 'gate', slot: `gate:${b}` };
  if (folder === 'props' && b.startsWith('lamp')) return { kind: 'lamp', slot: `lamp:${b}` };
  if (folder === 'props' && b.startsWith('bench')) return { kind: 'bench', slot: `bench:${b}` };
  if (folder === 'vegetation' && b.startsWith('tree')) return { kind: 'tree', slot: `tree:${b}` };
  if (folder === 'vegetation' && b.startsWith('bush')) return { kind: 'bush', slot: `bush:${b}` };
  return null;
}

export function bundledLibrary(): LibraryEntry[] {
  const out: LibraryEntry[] = [];
  for (const [path, url] of Object.entries(files)) {
    const m = /\.\/(\w+)\/([^/]+)\.glb$/.exec(path);
    if (!m) continue;
    const c = classify(m[1], m[2]);
    if (!c) continue;
    out.push({ ...c, name: m[2], url, license: licenses[`./${m[1]}/${m[2]}.license.json`] ?? null, origin: 'bundled' });
  }
  return out;
}
