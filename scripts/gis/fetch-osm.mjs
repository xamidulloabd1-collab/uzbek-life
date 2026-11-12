// Downloads OpenStreetMap data for G‘uzor (Overpass API) and converts it with scripts/import-osm.mjs.
//   node scripts/gis/fetch-osm.mjs [south west north east]      default bbox: 38.57 66.20 38.66 66.33
// Data © OpenStreetMap contributors, ODbL 1.0. Hosts needed: overpass-api.de (or another Overpass mirror).
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const [s, w, n, e] = process.argv.slice(2).map(Number).length === 4 ? process.argv.slice(2).map(Number) : [38.57, 66.2, 38.66, 66.33];
const q = `[out:xml][timeout:120];(
  way["highway"](${s},${w},${n},${e});
  way["waterway"](${s},${w},${n},${e});
  way["railway"](${s},${w},${n},${e});
  way["building"](${s},${w},${n},${e});
  node["amenity"](${s},${w},${n},${e});
  node["historic"](${s},${w},${n},${e});
  node["leisure"](${s},${w},${n},${e});
  node["place"](${s},${w},${n},${e});
);(._;>;);out body;`;
const mirrors = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
mkdirSync('public/geo', { recursive: true });
for (const m of mirrors) {
  try {
    const r = await fetch(m, { method: 'POST', body: new URLSearchParams({ data: q }) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const xml = await r.text();
    writeFileSync('public/geo/guzor.osm', xml);
    console.log(`[osm] ${m} → public/geo/guzor.osm (${(xml.length / 1e6).toFixed(1)} MB, ${new Date().toISOString().slice(0, 10)})`);
    execFileSync('node', ['scripts/import-osm.mjs', 'public/geo/guzor.osm'], { stdio: 'inherit' });
    process.exit(0);
  } catch (err) {
    console.warn(`[osm] ${m}: ${err.cause?.code ?? err.message}`);
  }
}
console.error('[osm] no Overpass mirror reachable — add overpass-api.de to the allowed hosts or run this on your PC');
process.exit(1);
