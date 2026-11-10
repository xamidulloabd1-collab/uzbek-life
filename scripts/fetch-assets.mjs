// Downloads CC0 PBR materials from ambientCG into public/assets/materials/ (run on a machine with internet):
//   npm run assets:fetch
// ambientCG: every asset is CC0 1.0 (https://ambientcg.com/license) — no attribution required; we credit it anyway.
// Note: downloads are served from acg-download.struffelproductions.com (that host must be reachable).
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { unzipSync } from 'fflate';

const OUT = 'public/assets/materials';
/** game material → ambientCG asset id (picked by hand; ids verified via the ambientCG API) */
const PICK = {
  asphalt: 'Asphalt031', concrete: 'Concrete034', paving: 'PavingStones138', plaster: 'Plaster001', ground: 'Ground109',
  grass: 'Grass004', roof: 'CorrugatedSteel005', bricks: 'Bricks105', woodfloor: 'WoodFloor051', tiles: 'Tiles139',
};
const RES = process.argv.includes('--2k') ? '2K' : '1K';
const manifest = { source: 'ambientCG (https://ambientcg.com)', license: 'CC0 1.0 Universal', resolution: RES, downloaded: new Date().toISOString().slice(0, 10), materials: {} };
mkdirSync(OUT, { recursive: true });
let ok = 0;
for (const [name, id] of Object.entries(PICK)) {
  const url = `https://ambientcg.com/get?file=${id}_${RES}-JPG.zip`;
  try {
    const r = await fetch(url, { redirect: 'follow' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const files = unzipSync(new Uint8Array(await r.arrayBuffer()));
    const dir = join(OUT, name);
    mkdirSync(dir, { recursive: true });
    const out = {};
    for (const [fname, data] of Object.entries(files)) {
      const m = fname.match(/_(Color|NormalGL|Roughness|AmbientOcclusion)\.jpg$/);
      if (!m) continue;
      const key = { Color: 'color', NormalGL: 'normal', Roughness: 'roughness', AmbientOcclusion: 'ao' }[m[1]];
      writeFileSync(join(dir, `${key}.jpg`), data);
      out[key] = `${key}.jpg`;
    }
    if (!out.color) throw new Error('no colour map in archive');
    manifest.materials[name] = { id, page: `https://ambientcg.com/view?id=${id}`, files: out };
    ok++;
    console.log(`[assets] ${name.padEnd(10)} ← ${id} (${Object.keys(out).join(', ')})`);
  } catch (e) {
    console.warn(`[assets] ${name.padEnd(10)} ✗ ${id}: ${e.message}${String(e.cause ?? '').includes('ENOTFOUND') ? ' (download host not reachable)' : ''}`);
  }
}
writeFileSync(join(OUT, 'materials.json'), JSON.stringify(manifest, null, 1));
console.log(`[assets] ${ok}/${Object.keys(PICK).length} materials in ${OUT}${existsSync(OUT) ? '' : ''}`);
