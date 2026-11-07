// Scans public/assets/vehicles/<category>/<id>/ for model.glb (or *.glb) + vehicle.json,
// validates licence information and writes public/assets/vehicles/catalog.json.
// Run automatically before `npm run build` / `npm run dev`, or manually: npm run vehicles:scan
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'public/assets/vehicles';
const CATS = ['sedan', 'hatchback', 'suv', 'pickup', 'van', 'truck', 'bus', 'service', 'emergency', 'sports', 'classic'];
const BAD = /\bNC\b|NonCommercial|\bND\b|NoDerivatives|editorial/i;
const out = [];
const problems = [];
if (existsSync(ROOT)) {
  for (const cat of readdirSync(ROOT)) {
    const dir = join(ROOT, cat);
    if (!statSync(dir).isDirectory()) continue;
    if (!CATS.includes(cat)) { problems.push(`${cat}: unknown category folder`); continue; }
    for (const id of readdirSync(dir)) {
      const vdir = join(dir, id);
      if (!statSync(vdir).isDirectory()) continue;
      const glb = readdirSync(vdir).find((f) => f.toLowerCase().endsWith('.glb'));
      const jsonPath = join(vdir, 'vehicle.json');
      if (!glb) { problems.push(`${cat}/${id}: no .glb file`); continue; }
      if (!existsSync(jsonPath)) { problems.push(`${cat}/${id}: vehicle.json missing (licence data required)`); continue; }
      const v = JSON.parse(readFileSync(jsonPath, 'utf8'));
      const lic = v.license ?? {};
      const missing = ['title', 'author', 'license', 'source'].filter((k) => !lic[k]);
      if (missing.length) { problems.push(`${cat}/${id}: licence fields missing: ${missing.join(', ')}`); continue; }
      if (BAD.test(lic.license) && !v.allowRestrictedLicense) { problems.push(`${cat}/${id}: licence "${lic.license}" is not compatible (NC/ND/editorial)`); continue; }
      out.push({ id, name: v.name ?? id, category: cat, model: `${cat}/${id}/${glb}`, sizeMB: +(statSync(join(vdir, glb)).size / 1e6).toFixed(2), ...v, license: lic });
    }
  }
}
writeFileSync(join(ROOT, 'catalog.json'), JSON.stringify({ generated: new Date().toISOString(), vehicles: out }, null, 1));
// credits block
const credits = out.map((v) => `| ${v.name} | ${v.license.title} | ${v.license.author} | ${v.license.source} | ${v.license.license} | ${v.license.downloaded ?? ''} | ${v.license.modifications ?? 'qayta o‘lchamlash, yo‘nalish'} |`).join('\n');
const head = '| Mashina | Model nomi | Muallif | Manba | Litsenziya | Yuklab olingan | O‘zgarishlar |\n|---|---|---|---|---|---|---|\n';
writeFileSync(join(ROOT, 'CREDITS.generated.md'), `# Mashina modellari (avtomatik ro‘yxat)\n\n${out.length ? head + credits : 'Hozircha model qo‘shilmagan.'}\n`);
console.log(`[vehicles] ${out.length} vehicle(s) in catalog${problems.length ? '; skipped:\n  ' + problems.join('\n  ') : ''}`);
