// Copernicus GLO-30 DEM tile around G‘uzor → game heightmap (src/game/world/gis/dem.json).
//   node scripts/gis/fetch-dem.mjs                (downloads N38/E066 tile from copernicus-dem-30m.s3.amazonaws.com)
//   node scripts/gis/fetch-dem.mjs local.tif      (any GeoTIFF in EPSG:4326 covering the area)
// Licence: Copernicus DEM GLO-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018, provided under COPERNICUS by the
// European Union and ESA; free use with attribution (see docs/GEOGRAPHIC_SOURCES.md).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fromArrayBuffer } from 'geotiff';
const URL = 'https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N38_00_E066_00_DEM/Copernicus_DSM_COG_10_N38_00_E066_00_DEM.tif';
const BBOX = { s: 38.5, w: 66.0, n: 38.85, e: 66.5 };
const STEP_M = 60; // heightmap spacing (metres)
let buf;
if (process.argv[2]) buf = readFileSync(process.argv[2]).buffer;
else {
  const r = await fetch(URL).catch((e) => ({ ok: false, statusText: e.cause?.code ?? e.message }));
  if (!r.ok) { console.error(`[dem] download failed (${r.status ?? ''} ${r.statusText}) — add copernicus-dem-30m.s3.amazonaws.com to the allowed hosts or pass a local GeoTIFF`); process.exit(1); }
  buf = await r.arrayBuffer();
}
const tiff = await fromArrayBuffer(buf);
const img = await tiff.getImage();
const [ox, oy] = img.getOrigin(), [rx, ry] = img.getResolution();
const W = img.getWidth(), H = img.getHeight();
const raster = (await img.readRasters({ interleave: true }));
const LAT0 = 38.620902, LON0 = 66.2571795, M_LAT = 111320, M_LON = 111320 * Math.cos((LAT0 * Math.PI) / 180);
const sample = (lat, lon) => {
  const px = (lon - ox) / rx, py = (lat - oy) / ry;
  const x = Math.max(0, Math.min(W - 2, Math.floor(px))), y = Math.max(0, Math.min(H - 2, Math.floor(py)));
  const fx = px - x, fy = py - y, at = (i, j) => raster[j * W + i];
  return at(x, y) * (1 - fx) * (1 - fy) + at(x + 1, y) * fx * (1 - fy) + at(x, y + 1) * (1 - fx) * fy + at(x + 1, y + 1) * fx * fy;
};
const nx = Math.round(((BBOX.e - BBOX.w) * M_LON) / STEP_M), nz = Math.round(((BBOX.n - BBOX.s) * M_LAT) / STEP_M);
const h = new Array(nx * nz);
for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) h[j * nx + i] = Math.round(sample(BBOX.n - (j * STEP_M) / M_LAT, BBOX.w + (i * STEP_M) / M_LON) * 10) / 10;
const ref = sample(LAT0, LON0);
mkdirSync('src/game/world/gis', { recursive: true });
writeFileSync('src/game/world/gis/dem.json', JSON.stringify({ source: process.argv[2] ?? URL, refElevation: ref, bbox: BBOX, stepM: STEP_M, nx, nz, origin: { lat: LAT0, lon: LON0 }, heights: h }));
console.log(`[dem] ${nx}×${nz} heights @ ${STEP_M} m, ref ${ref.toFixed(1)} m (G‘uzor centre), min ${h.reduce((a, b) => Math.min(a, b), Infinity)} max ${h.reduce((a, b) => Math.max(a, b), -Infinity)}`);
