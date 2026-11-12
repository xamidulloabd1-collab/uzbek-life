// Downloads one Sketchfab model with YOUR API token and registers it as a game vehicle.
//   node scripts/fetch-sketchfab.mjs <uid> --token <SKETCHFAB_API_TOKEN> --category sedan --id cobalt --name "Chevrolet Cobalt" --length 4.48
// Token: sketchfab.com → Settings → Password & API → API token (you can revoke it afterwards).
// Only models whose licence is CC0 or CC BY (incl. BY-SA) are accepted; the licence, author and URL go into vehicle.json.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { unzipSync } from 'fflate';

const args = process.argv.slice(2);
const uid = args[0];
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const token = opt('token', process.env.SKETCHFAB_TOKEN);
if (!uid) { console.error('usage: node scripts/fetch-sketchfab.mjs <uid> --token T --category sedan --id cobalt --name "…" [--length 4.5]'); process.exit(1); }
const api = (p, auth) => fetch(`https://api.sketchfab.com/v3${p}`, { headers: auth ? { Authorization: `Token ${token}` } : {} });

const meta = await (await api(`/models/${uid}`)).json();
const lic = meta.license?.label ?? 'unknown';
console.log(`[sketchfab] ${meta.name} by ${meta.user?.username} — ${lic}, ${meta.faceCount} faces`);
if (!/CC0|Attribution(?!.*NonCommercial)(?!.*NoDerivs)/i.test(lic)) { console.error(`[sketchfab] licence "${lic}" is not allowed for this game — skipped`); process.exit(2); }
if (/hum3d|ripped|beamng|gta|forza|assetto|not mine/i.test(meta.description ?? '')) { console.error('[sketchfab] description suggests a re-upload of someone else’s model — skipped'); process.exit(3); }
if (!token) { console.error('[sketchfab] an API token is required to download (Sketchfab returns 401 without one)'); process.exit(4); }
const dl = await api(`/models/${uid}/download`, true);
if (!dl.ok) { console.error(`[sketchfab] download refused: HTTP ${dl.status}`); process.exit(5); }
const d = await dl.json();
const cat = opt('category', 'sedan'), id = opt('id', uid.slice(0, 8));
const dir = join('public/assets/vehicles', cat, id);
mkdirSync(dir, { recursive: true });
if (d.glb?.url) {
  writeFileSync(join(dir, 'model.glb'), new Uint8Array(await (await fetch(d.glb.url)).arrayBuffer()));
} else if (d.gltf?.url) {
  const files = unzipSync(new Uint8Array(await (await fetch(d.gltf.url)).arrayBuffer()));
  for (const [f, data] of Object.entries(files)) { mkdirSync(join(dir, f, '..'), { recursive: true }); writeFileSync(join(dir, f), data); }
  console.log('[sketchfab] glTF archive saved — convert to model.glb with tools/blender/prepare_vehicle.py or gltf-transform');
} else { console.error('[sketchfab] no glb/gltf archive offered'); process.exit(6); }
const length = Number(opt('length', 0)) || undefined;
writeFileSync(join(dir, 'vehicle.json'), JSON.stringify({
  name: opt('name', meta.name), price: Number(opt('price', 0)) || undefined, ...(length ? { dims: { length } } : {}),
  license: { title: meta.name, author: meta.user?.username, license: lic, source: meta.viewerUrl, downloaded: new Date().toISOString().slice(0, 10), modifications: 'scaled / re-oriented for the game' },
}, null, 1));
console.log(`[sketchfab] saved to ${dir} — run npm run vehicles:scan (or npm run dev) to register it`);
