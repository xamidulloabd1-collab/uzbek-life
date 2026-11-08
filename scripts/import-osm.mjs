// Converts an OpenStreetMap XML export (.osm) of G‘uzor into src/game/world/guzor/osm.json.
// Usage: node scripts/import-osm.mjs path/to/map.osm
// Export: openstreetmap.org → Export → bbox around G‘uzor (≈ 66.20–66.33 E, 38.57–38.66 N).
// Data © OpenStreetMap contributors, ODbL 1.0 — keep the attribution in the game credits.
import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) { console.error('usage: node scripts/import-osm.mjs map.osm'); process.exit(1); }
const xml = readFileSync(file, 'utf8');
// same projection as the traced screenshots: origin 38.620902 N, 66.2571795 E; game scale 1:2
const LAT0 = 38.620902, LON0 = 66.2571795, M_LAT = 111_320, M_LON = 111_320 * Math.cos((LAT0 * Math.PI) / 180), GAME = 0.5;
const proj = (lat, lon) => [+((lon - LON0) * M_LON * GAME).toFixed(2), +(-(lat - LAT0) * M_LAT * GAME).toFixed(2)];

const nodes = new Map();
for (const m of xml.matchAll(/<node\b[^>]*\bid="(-?\d+)"[^>]*\blat="([-\d.]+)"[^>]*\blon="([-\d.]+)"[^>]*?(\/>|>([\s\S]*?)<\/node>)/g)) nodes.set(m[1], { lat: +m[2], lon: +m[3], body: m[5] ?? '' });
const tagsOf = (body) => Object.fromEntries([...body.matchAll(/<tag\s+k="([^"]+)"\s+v="([^"]*)"/g)].map((t) => [t[1], t[2]]));
const CLS = {
  motorway: 'highway', trunk: 'highway', primary: 'highway', motorway_link: 'highway', trunk_link: 'highway', primary_link: 'main',
  secondary: 'main', secondary_link: 'main', tertiary: 'main', tertiary_link: 'main',
  residential: 'street', unclassified: 'street', living_street: 'street', service: 'street', road: 'street',
  track: 'rural',
};
const roads = [], river = [], pois = [];
for (const m of xml.matchAll(/<way\b[^>]*\bid="(-?\d+)"[^>]*>([\s\S]*?)<\/way>/g)) {
  const tags = tagsOf(m[2]);
  const pts = [...m[2].matchAll(/<nd\s+ref="(-?\d+)"/g)].map((r) => nodes.get(r[1])).filter(Boolean).map((n) => proj(n.lat, n.lon));
  if (pts.length < 2) continue;
  const cls = CLS[tags.highway];
  if (cls) roads.push({ cls, name: tags['name:uz'] || tags.name || '', pts });
  else if (tags.waterway === 'river' && /g.?uzor|гузар|guzar/i.test(tags.name || '')) river.push(...pts);
}
for (const [, n] of nodes) {
  const t = tagsOf(n.body);
  if (t.amenity === 'place_of_worship' || t.historic || t.amenity === 'fountain' || t.leisure === 'park' || t.leisure === 'stadium' || t.amenity === 'school' || t.amenity === 'marketplace')
    pois.push({ name: t['name:uz'] || t.name || '', kind: t.amenity || t.historic || t.leisure, pos: proj(n.lat, n.lon) });
}
writeFileSync('src/game/world/guzor/osm.json', JSON.stringify({ source: `© OpenStreetMap contributors (ODbL) — ${file}`, roads, river, pois }));
const byCls = roads.reduce((a, r) => ((a[r.cls] = (a[r.cls] || 0) + 1), a), {});
console.log(`[osm] ${roads.length} roads ${JSON.stringify(byCls)}, river points ${river.length}, landmarks ${pois.length}`);
