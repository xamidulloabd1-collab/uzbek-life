import type { Side, Vec2 } from '@/types';
import { mulberry32, type RNG } from '@/utils/math';
import OSM from './osm.json';
import DEM from '../gis/dem.json';

/** optional OpenStreetMap import (scripts/import-osm.mjs); ODbL © OpenStreetMap contributors */
interface OsmData { source?: string; roads: { cls: RoadClass; name: string; pts: [number, number][] }[]; river?: [number, number][] }
const OSM_DATA = OSM as unknown as OsmData;
export const OSM_ROADS = OSM_DATA.roads.length > 0;

/**
 * G‘uzor world model.
 * Major roads, the river and landmark positions were traced by hand from two Google Maps
 * screenshots supplied by the user (used only as a visual reference — no imagery is shipped).
 * Pixel → metre scale comes from the 500 m scale bar (≈ 4.76 m/px); the game uses a 1:2 scale.
 * Local streets are generated inside each neighbourhood, following the orientation visible in
 * the screenshots, then connected to the main roads. Exact street geometry is NOT reproduced.
 */
export const PX_M = 2.38;
const PX0 = 1005, PY0 = 570;
export const P = (px: number, py: number): Vec2 => ({ x: (px - PX0) * PX_M, z: (py - PY0) * PX_M });
export const BOUNDS = { x0: (300 - PX0) * PX_M, x1: (1850 - PX0) * PX_M, z0: (130 - PY0) * PX_M, z1: (1690 - PY0) * PX_M };

export type RoadClass = 'highway' | 'main' | 'street' | 'rural' | 'lane';
export type Zone = 'center' | 'mahalla' | 'villas' | 'industrial' | 'village' | 'fields';

export const ZONE_NAMES: Record<Zone, string> = {
  center: 'G‘uzor markazi', mahalla: 'Mahalla', villas: 'Yangi uylar', industrial: 'Sanoat hududi', village: 'Qishloq', fields: 'Dalalar',
};
export const ZONE_COLORS: Record<Zone, string> = {
  center: '#55647a', mahalla: '#b49a72', villas: '#c9a37a', industrial: '#6b6358', village: '#8f9a5c', fields: '#a99467',
};
export const MAHALLA_NAMES = ['Gulshan', 'Eskibog‘', 'Istiqbol', 'Tinchlik', 'Mustaqillik', 'Navro‘z', 'Do‘stlik', 'Mevazor', 'Bo‘ston', 'Abod', 'Obihayot', 'Fayziobod', 'Amir Temur', 'Yangihayot', 'Mehnatobod', 'Chanoq'];

const W = (pts: [number, number][]) => pts.map(([a, b]) => P(a, b));

// ------------------------------------------------------------------ traced reference data (screenshot pixels)
const MAJORS: { name: string; cls: RoadClass; pts: Vec2[] }[] = [
  { name: 'A380 yo‘li', cls: 'highway', pts: W([[300, 278], [415, 336], [560, 428], [632, 486]]) },
  { name: 'A380 yo‘li', cls: 'highway', pts: W([[632, 486], [700, 432], [790, 352], [870, 288], [960, 262], [1085, 256], [1200, 272], [1300, 300], [1360, 322], [1435, 355]]) },
  { name: 'M39 yo‘li', cls: 'highway', pts: W([[1435, 355], [1500, 290], [1570, 222], [1700, 150], [1790, 120]]) },
  { name: 'M39 yo‘li', cls: 'highway', pts: W([[1435, 355], [1442, 450], [1462, 560], [1475, 665], [1458, 780], [1442, 880], [1436, 955], [1416, 1075], [1356, 1195], [1446, 1300], [1581, 1425], [1680, 1530], [1790, 1640]]) },
  { name: 'Kitob yo‘li', cls: 'main', pts: W([[870, 288], [888, 210], [900, 140]]) },
  { name: 'Markaziy ko‘cha', cls: 'main', pts: W([[870, 288], [866, 360], [860, 440], [855, 520], [852, 600], [856, 700], [860, 800], [866, 900], [880, 1000], [900, 1150], [925, 1350], [955, 1560], [970, 1680]]) },
  { name: 'Mustaqillik ko‘chasi', cls: 'main', pts: W([[420, 640], [520, 610], [700, 585], [852, 562], [1000, 590], [1150, 600], [1300, 582], [1462, 560]]) },
  { name: 'Amir Temur ko‘chasi', cls: 'main', pts: W([[632, 486], [750, 540], [852, 600], [1000, 690], [1150, 775], [1300, 840], [1442, 880]]) },
  { name: 'Janubiy yo‘l', cls: 'main', pts: W([[880, 1000], [1000, 1080], [1120, 1180], [1250, 1230], [1356, 1195]]) },
  { name: 'Feruzbek yo‘li', cls: 'rural', pts: W([[860, 800], [760, 860], [680, 960], [620, 1100], [580, 1220], [556, 1335], [520, 1500], [480, 1680]]) },
  { name: 'G‘arbiy yo‘l', cls: 'rural', pts: W([[420, 640], [330, 668]]) },
];

/** G‘uzordaryo — approximate course traced from the screenshots */
export const RIVER: Vec2[] = W([[1700, 1720], [1586, 1635], [1486, 1555], [1386, 1465], [1316, 1395], [1266, 1325], [1216, 1255], [1156, 1195], [1146, 1125], [1096, 1055], [1036, 975], [996, 915], [960, 868], [905, 840], [840, 850], [760, 872], [660, 895], [540, 915], [420, 945], [300, 980]]);

/** railway west–east north of the A380 (direction approximate); station next to the map’s station icon */
export const RAIL_Z = P(0, 222).z;
export const STATION = P(955, 240);

export const ZONES: { zone: Zone; name?: string; poly: Vec2[]; angle: number; spacing: [number, number]; skip: number }[] = [
  { zone: 'center', poly: W([[790, 400], [960, 385], [1030, 470], [1040, 640], [980, 720], [800, 720], [760, 600], [765, 470]]), angle: 0.03, spacing: [84, 96], skip: 0.05 },
  { zone: 'industrial', poly: W([[860, 232], [1180, 232], [1185, 252], [960, 268], [872, 292]]), angle: 0.0, spacing: [70, 200], skip: 0 },
  { zone: 'industrial', poly: W([[1372, 330], [1480, 318], [1500, 420], [1404, 432]]), angle: -0.6, spacing: [70, 90], skip: 0 },
  { zone: 'villas', poly: W([[1240, 400], [1420, 392], [1440, 540], [1250, 560]]), angle: -0.6, spacing: [66, 100], skip: 0.05 },
  { zone: 'mahalla', poly: W([[560, 450], [640, 500], [720, 420], [860, 330], [1100, 300], [1360, 340], [1430, 380], [1440, 900], [1380, 960], [1200, 980], [1000, 960], [860, 960], [700, 920], [600, 800], [540, 640]]), angle: -0.61, spacing: [67, 116], skip: 0.06 },
  { zone: 'village', name: 'Jarariq', poly: W([[700, 960], [1000, 990], [1300, 1010], [1400, 1100], [1420, 1300], [1200, 1420], [1000, 1500], [800, 1460], [640, 1300], [600, 1150]]), angle: -0.61, spacing: [92, 150], skip: 0.2 },
  { zone: 'village', poly: W([[300, 300], [480, 330], [540, 400], [520, 460], [330, 420]]), angle: -0.55, spacing: [92, 140], skip: 0.2 },
  { zone: 'village', poly: W([[440, 1240], [660, 1250], [660, 1440], [440, 1440]]), angle: -0.61, spacing: [92, 150], skip: 0.25 },
];

export type SiteKind =
  | 'hokimiyat' | 'park' | 'stadium' | 'bazaar' | 'mosque' | 'mirijanda' | 'station' | 'complex' | 'bank' | 'jobs' | 'realty' | 'osh'
  | 'dealership' | 'service' | 'warehouse' | 'fuel' | 'school' | 'restaurant' | 'hotel' | 'farm';

export interface SiteDef { kind: SiteKind; px: number; py: number; front: Side; name: string; verified: 'map' | 'osm' | 'fictional'; sub?: string }

/** landmark / service sites: verified = position read from the screenshots (map) or OpenStreetMap (osm) */
export const SITE_DEFS: SiteDef[] = [
  { kind: 'hokimiyat', px: 845, py: 520, front: 's', name: 'G‘uzor tuman hokimiyati', verified: 'map' },
  { kind: 'park', px: 955, py: 425, front: 's', name: 'Humo bog‘i', verified: 'map' },
  { kind: 'stadium', px: 995, py: 625, front: 's', name: 'Sho‘rtan stadioni', verified: 'map' },
  { kind: 'bazaar', px: 862, py: 808, front: 's', name: 'G‘uzor eski dehqon bozori', verified: 'map' },
  { kind: 'mirijanda', px: 866, py: 905, front: 's', name: 'Xazrati Mirijanda jome masjidi', verified: 'map' },
  { kind: 'mosque', px: 1194, py: 290, front: 's', name: 'Musofir ota jome masjidi', verified: 'osm', sub: 'Chinobod ko‘chasi, 4' },
  { kind: 'school', px: 1460, py: 872, front: 's', name: '79-maktab', verified: 'map' },
  { kind: 'school', px: 1131, py: 1335, front: 's', name: '17-maktab', verified: 'map' },
  { kind: 'school', px: 1396, py: 1255, front: 's', name: '70-maktab', verified: 'map' },
  { kind: 'complex', px: 1135, py: 470, front: 's', name: '«Yangi hayot» majmuasi', verified: 'fictional' },
  { kind: 'bank', px: 905, py: 475, front: 's', name: 'Bank', verified: 'fictional' },
  { kind: 'jobs', px: 800, py: 610, front: 's', name: 'Mehnat birjasi', verified: 'fictional' },
  { kind: 'realty', px: 930, py: 545, front: 's', name: 'Ko‘chmas mulk agentligi', verified: 'fictional' },
  { kind: 'osh', px: 905, py: 760, front: 's', name: 'Osh markazi', verified: 'fictional' },
  { kind: 'dealership', px: 1405, py: 420, front: 'w', name: 'Avtosalon', verified: 'fictional' },
  { kind: 'service', px: 1080, py: 245, front: 's', name: 'Avtoservis', verified: 'fictional' },
  { kind: 'warehouse', px: 900, py: 250, front: 's', name: 'Pochta ombori', verified: 'fictional' },
  { kind: 'fuel', px: 500, py: 385, front: 'e', name: 'AYOQSH', verified: 'fictional' },
  { kind: 'fuel', px: 1478, py: 720, front: 'e', name: 'AYOQSH', verified: 'fictional' },
  { kind: 'restaurant', px: 420, py: 312, front: 's', name: 'To‘yxona', verified: 'fictional' },
  { kind: 'hotel', px: 1690, py: 175, front: 's', name: 'Mehmonxona', verified: 'fictional' },
  { kind: 'farm', px: 960, py: 1250, front: 'n', name: 'Fermer xo‘jaligi', verified: 'fictional' },
];

// ------------------------------------------------------------------ geometry helpers
const cross = (ax: number, az: number, bx: number, bz: number) => ax * bz - az * bx;
const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function pointInPoly(p: Vec2, poly: Vec2[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

function distToPolyline(x: number, z: number, pts: Vec2[]) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z;
    const l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
    best = Math.min(best, Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t)));
  }
  return best;
}

// ------------------------------------------------------------------ terrain
/** smooth terrain: gentle undulation in town, foothills rising to the north and east */
/** real elevation (Copernicus GLO-30 via scripts/gis/fetch-dem.mjs) when present; game is 1:2 horizontally and vertically */
interface DemData { heights: number[]; nx?: number; nz?: number; stepM?: number; bbox?: { s: number; w: number; n: number; e: number }; origin?: { lat: number; lon: number }; refElevation?: number }
const DEM_DATA = DEM as unknown as DemData;
export const HAS_DEM = DEM_DATA.heights.length > 0;
function demAt(x: number, z: number) {
  const d = DEM_DATA, M_LAT = 111320, M_LON = 111320 * Math.cos((d.origin!.lat * Math.PI) / 180);
  const lon = d.origin!.lon + (x * 2) / M_LON, lat = d.origin!.lat - (z * 2) / M_LAT;
  const fi = ((lon - d.bbox!.w) * M_LON) / d.stepM!, fj = ((d.bbox!.n - lat) * M_LAT) / d.stepM!;
  const i = Math.max(0, Math.min(d.nx! - 2, Math.floor(fi))), j = Math.max(0, Math.min(d.nz! - 2, Math.floor(fj)));
  const tx = Math.min(1, Math.max(0, fi - i)), tz = Math.min(1, Math.max(0, fj - j)), H = d.heights, n = d.nx!;
  const h = H[j * n + i] * (1 - tx) * (1 - tz) + H[j * n + i + 1] * tx * (1 - tz) + H[(j + 1) * n + i] * (1 - tx) * tz + H[(j + 1) * n + i + 1] * tx * tz;
  return (h - (d.refElevation ?? 0)) * 0.5;
}

export function baseH(x: number, z: number) {
  if (HAS_DEM) return demAt(x, z);
  let h = 1.3 * Math.sin(x * 0.0041 + 0.7) * Math.cos(z * 0.0033 - 0.4) + 0.65 * Math.sin((x * 0.7 + z) * 0.0072 + 1.3) + 0.3 * Math.sin(x * 0.013 - z * 0.011);
  h += 24 * sstep(1250, 2100, x) * (0.65 + 0.35 * Math.sin(z * 0.0045 + 0.6));
  h += 14 * sstep(-650, -1050, z) * (0.6 + 0.4 * Math.sin(x * 0.004));
  h += 6 * sstep(2200, 2650, z);
  return h;
}
export const riverDist = (x: number, z: number) => distToPolyline(x, z, RIVER);
export const riverCut = (x: number, z: number) => 3.3 * (1 - sstep(7, 17, riverDist(x, z)));
export const terrainH = (x: number, z: number) => baseH(x, z) - riverCut(x, z);

// ------------------------------------------------------------------ graph types
export interface Edge {
  id: number; a: number; b: number; pts: Vec2[]; cum: number[]; len: number;
  cls: RoadClass; width: number; lane: number; name: string; zone: Zone; bridge: boolean; sidewalk: boolean; major: boolean;
  /** dead-end mahalla lane (berk ko‘cha) — kept even though one end is open */
  alley: boolean;
  /** true when the geometry came from OpenStreetMap, false when traced or generated */
  osm: boolean;
}
export interface GNode { id: number; x: number; z: number; edges: number[]; light: boolean; roundabout: boolean }
export type LotKind = 'house' | 'villa' | 'commercial' | 'apartment' | 'industrial' | 'farm' | 'orchard' | 'site';
export interface Lot {
  id: number; kind: LotKind; site?: SiteDef; ox: number; oz: number; rot: number; w: number; d: number;
  cx: number; cz: number; gy: number; zone: Zone; cls: RoadClass; seed: number; chunk: string; edge: number; home?: boolean; propertyId?: string;
  /** original frame (World Editor moves are stored relative to it) */
  base: { ox: number; oz: number; rot: number };
  hidden?: boolean;
}

const WIDTH: Record<RoadClass, number> = { highway: 16, main: 13, street: 8, rural: 7, lane: 5 };
const LANE: Record<RoadClass, number> = { highway: 3.3, main: 2.8, street: 1.9, rural: 1.7, lane: 1.2 };
export const SPEED: Record<RoadClass, number> = { highway: 19, main: 13, street: 9, rural: 11, lane: 5 };
export const CHUNK = 160;
export const chunkKey = (x: number, z: number) => `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;

/** frame rotation that maps local (1,0) → t (local z then points to (-t.z, t.x)) */
const rotFor = (tx: number, tz: number) => Math.atan2(-tz, tx);
/** world point of a local point in a frame */
export function frameToWorld(ox: number, oz: number, rot: number, lx: number, lz: number): Vec2 {
  const c = Math.cos(rot), s = Math.sin(rot);
  return { x: ox + lx * c + lz * s, z: oz - lx * s + lz * c };
}

// ------------------------------------------------------------------ the network
class Network {
  nodes: GNode[] = [];
  edges: Edge[] = [];
  lots: Lot[] = [];
  parked: { x: number; z: number; rot: number; edge: number }[] = [];
  trees: { x: number; z: number; type: 'chinor' | 'terak' | 'fruit' | 'pine' | 'bush' | 'grass'; s: number }[] = [];
  lamps: { x: number; z: number; rot: number; tall?: boolean; pole?: boolean }[] = [];
  /** overhead power/phone lines between mahalla utility poles: [x0, z0, x1, z1] */
  wires: [number, number, number, number][] = [];
  furniture: { x: number; z: number; rot: number; kind: 'bench' | 'bin' }[] = [];
  private eGrid = new Map<string, number[]>(); // cell → edge ids
  private lGrid = new Map<string, number[]>(); // cell → lot ids
  private static EC = 30;
  private static LC = 40;

  constructor() {
    const rng = mulberry32(2026);
    const t0 = performance.now();
    this.buildGraph(rng);
    this.indexEdges();
    this.dropParallelDuplicates();
    this.placeSites();
    this.dropIslands();
    this.markJunctions();
    this.placeLots(rng);
    this.placeProps(rng);
    this.placeInfill(rng);
    this.stats.ms = Math.round(performance.now() - t0);
  }
  stats = { ms: 0, dupesRemoved: 0, islandsRemoved: 0 };

  // ------------------------------------------------ graph
  private buildGraph(rng: RNG) {
    type PL = { pts: Vec2[]; cls: RoadClass; name: string; major: boolean; zone?: Zone; keep?: boolean };
    const lines: PL[] = OSM_ROADS
      ? OSM_DATA.roads.map((r) => ({ pts: r.pts.map(([x, z]) => ({ x, z })), cls: r.cls, name: r.name, major: true }))
      : MAJORS.map((m) => ({ pts: m.pts, cls: m.cls, name: m.name, major: true }));
    // local streets: a jittered, rotated grid clipped to each neighbourhood polygon
    const hash = (a: number, b: number) => Math.abs(Math.sin(a * 127.1 + b * 311.7) * 43758.5453) % 1;
    /** a street with a gentle, smooth sideways wander (real mahalla streets are rarely ruler-straight) */
    const curvy = (a: Vec2, b: Vec2, amp: number): Vec2[] => {
      const L = Math.hypot(b.x - a.x, b.z - a.z), nx = -(b.z - a.z) / L, nz = (b.x - a.x) / L;
      const k = Math.max(1, Math.round(L / 45)), ph = rng() * 6.28, out: Vec2[] = [a];
      for (let i = 1; i < k; i++) {
        const t = i / k, off = Math.sin(t * Math.PI) * amp * Math.sin(ph + t * 4.1);
        out.push({ x: a.x + (b.x - a.x) * t + nx * off, z: a.z + (b.z - a.z) * t + nz * off });
      }
      out.push(b);
      return out;
    };
    const subZones: { zone: Zone; poly: Vec2[]; angle: number; spacing: [number, number]; skip: number; rect?: [number, number, number, number] }[] = [];
    for (const z of OSM_ROADS ? [] : ZONES) {
      if (z.zone !== 'mahalla' && z.zone !== 'village') { subZones.push(z); continue; }
      // every ~380 m neighbourhood gets its own street orientation and block size
      const xs = z.poly.map((p) => p.x), zs = z.poly.map((p) => p.z);
      for (let x = Math.floor(Math.min(...xs) / 380) * 380; x < Math.max(...xs); x += 380)
        for (let q = Math.floor(Math.min(...zs) / 380) * 380; q < Math.max(...zs); q += 380) {
          const h1 = hash(x, q), h2 = hash(q, x);
          subZones.push({ ...z, angle: z.angle + (h1 - 0.5) * 0.2, spacing: [z.spacing[0] * (0.97 + h2 * 0.1), z.spacing[1] * (0.9 + h1 * 0.25)], rect: [x, q, x + 380, q + 380] });
        }
    }
    for (const z of subZones) {
      const c = z.rect ? { x: (z.rect[0] + z.rect[2]) / 2, z: (z.rect[1] + z.rect[3]) / 2 } : z.poly.reduce((a, p) => ({ x: a.x + p.x / z.poly.length, z: a.z + p.z / z.poly.length }), { x: 0, z: 0 });
      for (let fam = 0; fam < 2; fam++) {
        const ang = z.angle + fam * Math.PI / 2;
        const d = { x: Math.cos(ang), z: Math.sin(ang) };
        const nrm = { x: -d.z, z: d.x };
        const ref = z.rect ? [{ x: z.rect[0], z: z.rect[1] }, { x: z.rect[2], z: z.rect[1] }, { x: z.rect[2], z: z.rect[3] }, { x: z.rect[0], z: z.rect[3] }] : z.poly;
        const proj = ref.map((p) => (p.x - c.x) * nrm.x + (p.z - c.z) * nrm.z);
        const lo = Math.min(...proj), hi = Math.max(...proj);
        const sp = z.spacing[fam];
        for (let t = lo + sp * 0.5; t < hi; t += sp * (0.85 + rng() * 0.3)) {
          if (rng() < z.skip) continue;
          const a2 = ang + (rng() - 0.5) * 0.08;
          const dd = { x: Math.cos(a2), z: Math.sin(a2) };
          const o = { x: c.x + nrm.x * t, z: c.z + nrm.z * t };
          for (const [p0, p1] of this.clipLine(z.poly, o, dd)) {
            let t0 = p0, t1 = p1;
            if (z.rect) {
              const r = this.clipRect(z.rect, o, dd);
              if (!r) continue;
              t0 = Math.max(t0, r[0]);
              t1 = Math.min(t1, r[1]);
            }
            if (t1 - t0 < 30) continue;
            const e0 = t0 - 34, e1 = t1 + 34;
            const A = { x: o.x + dd.x * e0, z: o.z + dd.z * e0 }, B = { x: o.x + dd.x * e1, z: o.z + dd.z * e1 };
            const village = z.zone === 'village';
            lines.push({ pts: curvy(A, B, village ? 6 : 3), cls: village ? 'rural' : 'street', name: '', major: false, zone: z.zone });
            // berk ko‘chalar: short dead-end lanes into the block
            if (z.zone === 'mahalla' && fam === 0) {
              for (let t = t0 + 30; t < t1 - 30; t += 38 + rng() * 30) {
                if (rng() > 0.32) continue;
                const side = rng() < 0.5 ? 1 : -1, len = 20 + rng() * 9;
                const s = { x: o.x + dd.x * t - nrm.x * side, z: o.z + dd.z * t - nrm.z * side };
                lines.push({ pts: [s, { x: s.x + nrm.x * side * len, z: s.z + nrm.z * side * len }], cls: 'lane', name: '', major: false, zone: z.zone, keep: true });
              }
            }
          }
        }
      }
    }
    // pieces + intersections
    type Piece = { li: number; k: number; a: Vec2; b: Vec2; s0: number };
    const pieces: Piece[] = [];
    const lens: number[][] = lines.map((l) => {
      const cum = [0];
      for (let k = 1; k < l.pts.length; k++) cum.push(cum[k - 1] + Math.hypot(l.pts[k].x - l.pts[k - 1].x, l.pts[k].z - l.pts[k - 1].z));
      return cum;
    });
    lines.forEach((l, li) => {
      for (let k = 0; k < l.pts.length - 1; k++) pieces.push({ li, k, a: l.pts[k], b: l.pts[k + 1], s0: lens[li][k] });
    });
    const G = 60, grid = new Map<string, number[]>();
    pieces.forEach((p, i) => {
      for (let gx = Math.floor(Math.min(p.a.x, p.b.x) / G); gx <= Math.floor(Math.max(p.a.x, p.b.x) / G); gx++)
        for (let gz = Math.floor(Math.min(p.a.z, p.b.z) / G); gz <= Math.floor(Math.max(p.a.z, p.b.z) / G); gz++) {
          const key = `${gx},${gz}`;
          if (!grid.has(key)) grid.set(key, []);
          grid.get(key)!.push(i);
        }
    });
    const cuts: { s: number; node: number }[][] = lines.map(() => []);
    const nodeAt = (x: number, z: number) => {
      for (const n of this.nodes) if (Math.abs(n.x - x) < 6 && Math.abs(n.z - z) < 6 && Math.hypot(n.x - x, n.z - z) < 6) return n.id;
      this.nodes.push({ id: this.nodes.length, x, z, edges: [], light: false, roundabout: false });
      return this.nodes.length - 1;
    };
    const seen = new Set<string>();
    for (const list of grid.values()) {
      for (let i = 0; i < list.length; i++)
        for (let j = i + 1; j < list.length; j++) {
          const A = pieces[list[i]], B = pieces[list[j]];
          if (A.li === B.li) continue;
          const key = list[i] < list[j] ? `${list[i]}_${list[j]}` : `${list[j]}_${list[i]}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const rx = A.b.x - A.a.x, rz = A.b.z - A.a.z, sx = B.b.x - B.a.x, sz = B.b.z - B.a.z;
          const rxs = cross(rx, rz, sx, sz);
          if (Math.abs(rxs) < 1e-9) continue;
          const qx = B.a.x - A.a.x, qz = B.a.z - A.a.z;
          const t = cross(qx, qz, sx, sz) / rxs, u = cross(qx, qz, rx, rz) / rxs;
          if (t < 0 || t > 1 || u < 0 || u > 1) continue;
          const x = A.a.x + rx * t, z = A.a.z + rz * t;
          const n = nodeAt(x, z);
          cuts[A.li].push({ s: A.s0 + Math.hypot(rx, rz) * t, node: n });
          cuts[B.li].push({ s: B.s0 + Math.hypot(sx, sz) * u, node: n });
        }
    }
    lines.forEach((l, li) => {
      const total = lens[li][lens[li].length - 1];
      if (l.major || l.keep) {
        cuts[li].push({ s: 0, node: nodeAt(l.pts[0].x, l.pts[0].z) }, { s: total, node: nodeAt(l.pts[l.pts.length - 1].x, l.pts[l.pts.length - 1].z) });
      }
      const cs = cuts[li].sort((a, b) => a.s - b.s).filter((c, i, arr) => i === 0 || c.node !== arr[i - 1].node);
      if (cs.length < 2) return;
      for (let i = 0; i < cs.length - 1; i++) {
        const c0 = cs[i], c1 = cs[i + 1];
        if (c1.s - c0.s < 4) continue;
        const pts: Vec2[] = [{ x: this.nodes[c0.node].x, z: this.nodes[c0.node].z }];
        for (let k = 1; k < l.pts.length - 1; k++) if (lens[li][k] > c0.s && lens[li][k] < c1.s) pts.push(l.pts[k]);
        pts.push({ x: this.nodes[c1.node].x, z: this.nodes[c1.node].z });
        this.addEdge(c0.node, c1.node, pts, l.cls, l.name, l.major, !!l.keep);
      }
    });
  }

  private addEdge(a: number, b: number, pts: Vec2[], cls: RoadClass, name: string, major: boolean, alley = false) {
    const cum = [0];
    for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k].x - pts[k - 1].x, pts[k].z - pts[k - 1].z));
    const mid = pts[Math.floor(pts.length / 2)];
    const zone = zoneAt(mid.x, mid.z);
    const e: Edge = {
      id: this.edges.length, a, b, pts, cum, len: cum[cum.length - 1], cls, width: WIDTH[cls], lane: LANE[cls], name, zone,
      bridge: false, sidewalk: (cls === 'main' && zone !== 'fields') || (zone === 'center' && cls !== 'lane'), major, alley, osm: OSM_ROADS,
    };
    for (let s = 0; s <= e.len; s += 6) {
      const p = this.pointAt(e, s);
      if (riverDist(p.x, p.z) < 15) e.bridge = true;
    }
    this.edges.push(e);
    this.nodes[a].edges.push(e.id);
    this.nodes[b].edges.push(e.id);
  }

  private clipLine(poly: Vec2[], o: Vec2, d: Vec2): [number, number][] {
    const ts: number[] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const sx = b.x - a.x, sz = b.z - a.z;
      const den = cross(d.x, d.z, sx, sz);
      if (Math.abs(den) < 1e-9) continue;
      const qx = a.x - o.x, qz = a.z - o.z;
      const t = cross(qx, qz, sx, sz) / den, u = cross(qx, qz, d.x, d.z) / den;
      if (u >= 0 && u <= 1) ts.push(t);
    }
    ts.sort((a, b) => a - b);
    const out: [number, number][] = [];
    for (let i = 0; i + 1 < ts.length; i += 2) out.push([ts[i], ts[i + 1]]);
    return out;
  }

  /** parameter range of a line inside an axis-aligned rectangle (Liang–Barsky) */
  private clipRect(r: [number, number, number, number], o: Vec2, d: Vec2): [number, number] | null {
    let t0 = -Infinity, t1 = Infinity;
    for (const [p, q, lo, hi] of [[o.x, d.x, r[0], r[2]], [o.z, d.z, r[1], r[3]]]) {
      if (Math.abs(q) < 1e-9) { if (p < lo || p > hi) return null; continue; }
      let a = (lo - p) / q, b = (hi - p) / q;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, b);
    }
    return t0 < t1 ? [t0, t1] : null;
  }

  pointAt(e: Edge, s: number) {
    s = Math.max(0, Math.min(e.len, s));
    let k = 0;
    while (k < e.cum.length - 2 && e.cum[k + 1] < s) k++;
    const a = e.pts[k], b = e.pts[k + 1];
    const seg = e.cum[k + 1] - e.cum[k] || 1;
    const t = (s - e.cum[k]) / seg;
    const tx = (b.x - a.x) / seg, tz = (b.z - a.z) / seg;
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, tx, tz };
  }

  // ------------------------------------------------ spatial index of road pieces
  private indexEdges() {
    this.eGrid.clear();
    const C = Network.EC;
    for (const e of this.edges) {
      for (let k = 0; k < e.pts.length - 1; k++) {
        const a = e.pts[k], b = e.pts[k + 1], r = e.width / 2 + 4;
        for (let gx = Math.floor((Math.min(a.x, b.x) - r) / C); gx <= Math.floor((Math.max(a.x, b.x) + r) / C); gx++)
          for (let gz = Math.floor((Math.min(a.z, b.z) - r) / C); gz <= Math.floor((Math.max(a.z, b.z) + r) / C); gz++) {
            const key = `${gx},${gz}`;
            let l = this.eGrid.get(key);
            if (!l) this.eGrid.set(key, (l = []));
            if (l[l.length - 1] !== e.id) l.push(e.id);
          }
      }
    }
  }

  /** nearest road point within maxD (≤ 30 m reliable) */
  nearestRoad(x: number, z: number, maxD = 30, skip = -1) {
    const C = Network.EC;
    let best: { e: Edge; dist: number; s: number; px: number; pz: number } | null = null;
    const r = Math.ceil(maxD / C);
    const cx = Math.floor(x / C), cz = Math.floor(z / C);
    const checked = new Set<number>();
    for (let gx = cx - r; gx <= cx + r; gx++)
      for (let gz = cz - r; gz <= cz + r; gz++) {
        const l = this.eGrid.get(`${gx},${gz}`);
        if (!l) continue;
        for (const id of l) {
          if (checked.has(id) || id === skip) continue;
          checked.add(id);
          const e = this.edges[id];
          for (let k = 0; k < e.pts.length - 1; k++) {
            const a = e.pts[k], b = e.pts[k + 1];
            const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1;
            const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
            const px = a.x + dx * t, pz = a.z + dz * t;
            const d = Math.hypot(x - px, z - pz);
            if (d < maxD && (!best || d < best.dist)) best = { e, dist: d, s: e.cum[k] + Math.sqrt(l2) * t, px, pz };
          }
        }
      }
    return best;
  }

  onRoad(x: number, z: number, pad = 0.5) {
    const r = this.nearestRoad(x, z, 14);
    return !!r && r.dist < r.e.width / 2 + pad;
  }

  // ------------------------------------------------ lots (OBB) helpers
  private lotCorners(ox: number, oz: number, rot: number, w: number, d: number) {
    return [[0, 0], [w, 0], [w, d], [0, d], [w / 2, 0], [w, d / 2], [w / 2, d], [0, d / 2], [w / 2, d / 2]].map(([a, b]) => frameToWorld(ox, oz, rot, a, b));
  }

  private overlaps(c: Vec2[]) {
    // SAT on the two rectangles' axes, using cached corners
    const minX = Math.min(...c.map((p) => p.x)), maxX = Math.max(...c.map((p) => p.x));
    const minZ = Math.min(...c.map((p) => p.z)), maxZ = Math.max(...c.map((p) => p.z));
    const C = Network.LC;
    for (let gx = Math.floor(minX / C); gx <= Math.floor(maxX / C); gx++)
      for (let gz = Math.floor(minZ / C); gz <= Math.floor(maxZ / C); gz++) {
        for (const id of this.lGrid.get(`${gx},${gz}`) ?? []) {
          const L = this.lots[id];
          const o = this.lotCorners(L.ox, L.oz, L.rot, L.w, L.d).slice(0, 4);
          if (satOverlap(c.slice(0, 4), o)) return true;
        }
      }
    return false;
  }

  private addLot(l: Omit<Lot, 'id' | 'chunk' | 'cx' | 'cz' | 'gy' | 'base'>, corners: Vec2[]) {
    const ctr = corners[8];
    let gy = -Infinity;
    for (const p of corners) gy = Math.max(gy, baseH(p.x, p.z));
    const lot: Lot = { ...l, id: this.lots.length, cx: ctr.x, cz: ctr.z, gy: gy + 0.08, chunk: chunkKey(ctr.x, ctr.z), base: { ox: l.ox, oz: l.oz, rot: l.rot } };
    this.lots.push(lot);
    const C = Network.LC;
    const xs = corners.map((p) => p.x), zs = corners.map((p) => p.z);
    for (let gx = Math.floor(Math.min(...xs) / C); gx <= Math.floor(Math.max(...xs) / C); gx++)
      for (let gz = Math.floor(Math.min(...zs) / C); gz <= Math.floor(Math.max(...zs) / C); gz++) {
        const key = `${gx},${gz}`;
        if (!this.lGrid.has(key)) this.lGrid.set(key, []);
        this.lGrid.get(key)!.push(lot.id);
      }
    return lot;
  }

  /** move a lot (World Editor): updates its frame, centre, plinth height and the lookup grid used by groundAt */
  moveLot(id: number, ox: number, oz: number, rot: number) {
    const L = this.lots[id];
    const C = Network.LC;
    const cells = () => {
      const c = this.lotCorners(L.ox, L.oz, L.rot, L.w, L.d);
      const xs = c.map((p) => p.x), zs = c.map((p) => p.z), out: string[] = [];
      for (let gx = Math.floor(Math.min(...xs) / C); gx <= Math.floor(Math.max(...xs) / C); gx++)
        for (let gz = Math.floor(Math.min(...zs) / C); gz <= Math.floor(Math.max(...zs) / C); gz++) out.push(`${gx},${gz}`);
      return { c, out };
    };
    for (const k of cells().out) {
      const l = this.lGrid.get(k);
      const i = l ? l.indexOf(id) : -1;
      if (l && i >= 0) l.splice(i, 1);
    }
    L.ox = ox;
    L.oz = oz;
    L.rot = rot;
    const { c, out } = cells();
    L.cx = c[8].x;
    L.cz = c[8].z;
    let gy = -Infinity;
    for (const p of c) gy = Math.max(gy, baseH(p.x, p.z));
    L.gy = gy + 0.08;
    for (const k of out) {
      if (!this.lGrid.has(k)) this.lGrid.set(k, []);
      this.lGrid.get(k)!.push(id);
    }
  }

  lotAt(x: number, z: number): Lot | null {
    for (const id of this.lGrid.get(`${Math.floor(x / Network.LC)},${Math.floor(z / Network.LC)}`) ?? []) {
      const L = this.lots[id];
      const c = Math.cos(L.rot), s = Math.sin(L.rot);
      const dx = x - L.ox, dz = z - L.oz;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      if (lx >= 0 && lx <= L.w && lz >= 0 && lz <= L.d && !L.hidden) return L;
    }
    return null;
  }

  // ------------------------------------------------ sites
  private placeSites() {
    const local: Record<Side, { u: Vec2; m: Vec2 }> = {
      n: { u: { x: 0, z: -1 }, m: { x: 38, z: 0 } }, s: { u: { x: 0, z: 1 }, m: { x: 38, z: 76 } },
      w: { u: { x: -1, z: 0 }, m: { x: 0, z: 38 } }, e: { u: { x: 1, z: 0 }, m: { x: 76, z: 38 } },
    };
    for (const def of SITE_DEFS) {
      const target = P(def.px, def.py);
      let r = this.nearestRoad(target.x, target.z, 30);
      if (!r) r = this.nearestRoadFar(target.x, target.z);
      if (!r) continue;
      const pt = this.pointAt(r.e, r.s);
      let nx = -pt.tz, nz = pt.tx;
      if ((target.x - pt.x) * nx + (target.z - pt.z) * nz < 0) { nx = -nx; nz = -nz; }
      // rotate so the site's front side faces the road
      const { u, m } = local[def.front];
      const phi = Math.atan2(-nz, -nx) - Math.atan2(u.z, u.x);
      const rot = -phi;
      const frontPt = { x: pt.x + nx * (r.e.width / 2 + 1.2), z: pt.z + nz * (r.e.width / 2 + 1.2) };
      const mw = frameToWorld(0, 0, rot, m.x, m.z);
      const ox = frontPt.x - mw.x, oz = frontPt.z - mw.z;
      const corners = this.lotCorners(ox, oz, rot, 76, 76);
      this.addLot({ kind: 'site', site: def, ox, oz, rot, w: 76, d: 76, zone: zoneAt(target.x, target.z), cls: r.e.cls, seed: this.lots.length * 97 + 13, edge: r.e.id }, corners);
    }
    // remove local streets running through sites, then dead ends
    const sites = this.lots.filter((l) => l.kind === 'site');
    const dead = new Set<number>();
    for (const e of this.edges) {
      if (e.major) continue;
      for (let s = 0; s <= e.len; s += 5) {
        const p = this.pointAt(e, s);
        if (sites.some((L) => insideLot(L, p.x, p.z, 4))) { dead.add(e.id); break; }
      }
    }
    this.removeEdges(dead);
  }

  private nearestRoadFar(x: number, z: number) {
    let best: { e: Edge; dist: number; s: number; px: number; pz: number } | null = null;
    for (const e of this.edges) for (let s = 0; s <= e.len; s += 10) {
      const p = this.pointAt(e, s);
      const d = Math.hypot(p.x - x, p.z - z);
      if (!best || d < best.dist) best = { e, dist: d, s, px: p.x, pz: p.z };
    }
    return best;
  }

  private removeEdges(dead: Set<number>) {
    let changed = dead.size > 0;
    while (changed) {
      changed = false;
      const deg = new Map<number, number>();
      for (const e of this.edges) if (!dead.has(e.id)) { deg.set(e.a, (deg.get(e.a) ?? 0) + 1); deg.set(e.b, (deg.get(e.b) ?? 0) + 1); }
      for (const e of this.edges) {
        if (dead.has(e.id) || e.major || e.alley) continue;
        if ((deg.get(e.a) ?? 0) < 2 || (deg.get(e.b) ?? 0) < 2) { dead.add(e.id); changed = true; }
      }
    }
    const keep = this.edges.filter((e) => !dead.has(e.id));
    const remap = new Map<number, number>();
    this.edges = keep.map((e, i) => { remap.set(e.id, i); return { ...e, id: i }; });
    for (const n of this.nodes) n.edges = n.edges.filter((id) => remap.has(id)).map((id) => remap.get(id)!);
    for (const l of this.lots) if (remap.has(l.edge)) l.edge = remap.get(l.edge)!;
    this.indexEdges();
  }

  /** remove small road pieces that ended up disconnected from the main network (e.g. lanes whose street was removed) */
  private dropIslands() {
    const comp = new Map<number, number>();
    const sizes: number[] = [];
    for (const n of this.nodes) {
      if (!n.edges.length || comp.has(n.id)) continue;
      const id = sizes.length, stack = [n.id];
      let size = 0;
      comp.set(n.id, id);
      while (stack.length) {
        const u = stack.pop()!;
        size++;
        for (const eid of this.nodes[u].edges) {
          const e = this.edges[eid], v = e.a === u ? e.b : e.a;
          if (!comp.has(v)) { comp.set(v, id); stack.push(v); }
        }
      }
      sizes.push(size);
    }
    const main = sizes.indexOf(Math.max(...sizes));
    const dead = new Set(this.edges.filter((e) => comp.get(e.a) !== main).map((e) => e.id));
    if (dead.size) this.removeEdges(dead);
    this.stats.islandsRemoved = dead.size;
  }

  /** remove generated streets that run alongside a main road (they looked like doubled, overlapping roads) */
  private dropParallelDuplicates() {
    const dead = new Set<number>();
    for (const e of this.edges) {
      if (e.major || e.alley || e.len < 12) continue;
      let near = 0, tot = 0;
      for (let s = 6; s < e.len - 6; s += 6) {
        const p = this.pointAt(e, s);
        tot++;
        const r = this.nearestRoad(p.x, p.z, 18, e.id);
        if (r && r.e.major && r.dist < r.e.width / 2 + e.width / 2 + 4) near++;
      }
      if (tot && near / tot > 0.6) dead.add(e.id);
    }
    if (dead.size) this.removeEdges(dead);
    this.stats.dupesRemoved = dead.size;
  }

  /** traffic lights where two or more main roads meet inside town; the A380/M39 junction is a roundabout */
  private markJunctions() {
    const rb = P(1435, 355);
    for (const n of this.nodes) {
      const majors = n.edges.filter((id) => this.edges[id].cls === 'main' || this.edges[id].cls === 'highway').length;
      const z = zoneAt(n.x, n.z);
      n.light = (majors >= 3 && (z === 'center' || z === 'mahalla')) || (z === 'center' && n.edges.length >= 4 && majors >= 2);
      n.roundabout = Math.hypot(n.x - rb.x, n.z - rb.z) < 12;
      if (n.roundabout) n.light = false;
    }
  }

  /** light group of an edge leaving a node: 0 or 1 by its direction */
  lightGroup(e: Edge, nodeId: number) {
    const p = nodeId === e.a ? e.pts[1] : e.pts[e.pts.length - 2];
    const n = this.nodes[nodeId];
    let a = Math.atan2(p.z - n.z, p.x - n.x);
    a = ((a % Math.PI) + Math.PI) % Math.PI;
    return a >= Math.PI / 4 && a < (3 * Math.PI) / 4 ? 1 : 0;
  }

  // ------------------------------------------------ lots along streets
  private placeLots(rng: RNG) {
    const pick = (zone: Zone, cls: RoadClass): { kind: LotKind; w: number; d: number } | null => {
      const r = rng();
      if (zone === 'center') return r < (cls === 'main' ? 0.55 : 0.4) ? { kind: 'commercial', w: 16 + rng() * 10, d: 20 } : { kind: 'apartment', w: 40 + rng() * 16, d: 30 };
      if (zone === 'mahalla') return (cls !== 'street' ? r < 0.25 : r < 0.04) ? { kind: 'commercial', w: 14 + rng() * 6, d: 18 } : { kind: 'house', w: 13 + rng() * 6, d: 26 };
      if (zone === 'villas') return { kind: 'villa', w: 18 + rng() * 5, d: 26 };
      if (zone === 'industrial') return { kind: 'industrial', w: 32 + rng() * 18, d: 44 };
      if (zone === 'village') return r < 0.55 ? { kind: 'farm', w: 26 + rng() * 10, d: 34 } : r < 0.8 ? { kind: 'orchard', w: 30 + rng() * 14, d: 40 } : { kind: 'house', w: 14 + rng() * 6, d: 26 };
      return null;
    };
    for (const e of this.edges) {
      if (e.cls === 'highway' && e.zone === 'fields') continue;
      for (const side of [1, -1]) {
        let s = e.width / 2 + 9;
        while (s < e.len - e.width / 2 - 9) {
          const p = this.pointAt(e, s);
          const nx = -p.tz * side, nz = p.tx * side;
          const probe = { x: p.x + nx * 14, z: p.z + nz * 14 };
          const zone = zoneAt(probe.x, probe.z);
          const choice = pick(zone, e.cls);
          if (!choice) { s += 25; continue; }
          const { kind, w, d } = choice;
          if (s + w > e.len - e.width / 2 - 6) break;
          const q = this.pointAt(e, s + w / 2);
          // frame: local x along the street, local z into the lot
          const tx = side > 0 ? q.tx : -q.tx, tz = side > 0 ? q.tz : -q.tz;
          const rot = rotFor(tx, tz);
          const off = e.width / 2 + (e.sidewalk ? 3.2 : 1.4);
          const start = side > 0 ? this.pointAt(e, s) : this.pointAt(e, s + w);
          const ox = start.x + nx * off, oz = start.z + nz * off;
          const corners = this.lotCorners(ox, oz, rot, w, d);
          const ok =
            corners.every((c) => c.x > BOUNDS.x0 + 20 && c.x < BOUNDS.x1 - 20 && c.z > BOUNDS.z0 + 20 && c.z < BOUNDS.z1 - 20) &&
            corners.every((c) => riverDist(c.x, c.z) > 18 && Math.abs(c.z - RAIL_Z) > 16 && Math.hypot(c.x - STATION.x, c.z - STATION.z) > 75) &&
            corners.slice(0, 8).every((c) => !this.onRoad(c.x, c.z, 1.2)) &&
            [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75], [0.5, 0.5]].every(([a, b]) => { const p = frameToWorld(ox, oz, rot, w * a, d * b); return !this.onRoad(p.x, p.z, 0.6); }) &&
            !this.overlaps(corners);
          if (ok) {
            this.addLot({ kind, ox, oz, rot, w, d, zone, cls: e.cls, seed: Math.floor(rng() * 1e9), edge: e.id }, corners);
            s += w + 0.4;
          } else s += 5;
        }
      }
    }
  }

  // ------------------------------------------------ gardens and greenery between plots
  /** fill the leftover ground with what belongs there: gardens in mahallas, lawns in the centre, orchards in villages */
  private placeInfill(rng: RNG) {
    const S = 11;
    for (let x = BOUNDS.x0 + 30; x < BOUNDS.x1 - 30; x += S)
      for (let z = BOUNDS.z0 + 30; z < BOUNDS.z1 - 30; z += S) {
        const px = x + (rng() - 0.5) * 7, pz = z + (rng() - 0.5) * 7;
        const zone = zoneAt(px, pz);
        if (zone === 'fields' || zone === 'industrial') continue;
        if (this.lotAt(px, pz) || this.onRoad(px, pz, 2.5) || riverDist(px, pz) < 14 || Math.abs(pz - RAIL_Z) < 18) continue;
        const r = rng();
        // performance pass (0.22): about half the garden trees, no infill grass clumps (the ground colour carries the green)
        if (zone === 'mahalla') {
          if (r < 0.22) this.trees.push({ x: px, z: pz, type: rng() < 0.7 ? 'fruit' : 'terak', s: 0.85 + rng() * 0.35 });
          else if (r < 0.32) this.trees.push({ x: px, z: pz, type: 'bush', s: 0.9 + rng() * 0.5 });
        } else if (zone === 'center' || zone === 'villas') {
          if (r < 0.15) this.trees.push({ x: px, z: pz, type: rng() < 0.6 ? 'chinor' : 'pine', s: 0.85 + rng() * 0.3 });
          else if (r < 0.3) this.trees.push({ x: px, z: pz, type: 'bush', s: 1 + rng() * 0.4 });
        } else if (zone === 'village') {
          if (r < 0.18) this.trees.push({ x: px, z: pz, type: rng() < 0.75 ? 'fruit' : 'terak', s: 0.8 + rng() * 0.3 });
        }
      }
  }

  // ------------------------------------------------ street props, parked cars
  private placeProps(rng: RNG) {
    for (const e of this.edges) {
      const town = e.zone === 'center' || e.zone === 'mahalla' || e.zone === 'villas';
      const step = e.cls === 'highway' ? 11 : e.zone === 'center' ? 14 : 10;
      for (let s = 10; s < e.len - 10; s += step) {
        const p = this.pointAt(e, s);
        for (const side of [1, -1]) {
          const nx = -p.tz * side, nz = p.tx * side;
          const off = e.cls === 'highway' ? e.width / 2 + 6 : e.width / 2 + (e.sidewalk ? 2.4 : 1.0);
          const x = p.x + nx * off, z = p.z + nz * off;
          if (this.lotAt(x, z) || this.onRoad(x, z, 0.8) || riverDist(x, z) < 12) continue;
          if (e.cls === 'highway' && rng() < 0.75) this.trees.push({ x, z, type: 'terak', s: 0.9 + rng() * 0.3 });
          else if (e.zone === 'center' && rng() < 0.85) this.trees.push({ x, z, type: 'chinor', s: 0.9 + rng() * 0.3 });
          else if ((e.zone === 'mahalla' || e.zone === 'village') && rng() < 0.55) this.trees.push({ x, z, type: rng() < 0.75 ? 'terak' : 'chinor', s: 0.85 + rng() * 0.3 });
        }
      }
      if ((e.zone === 'mahalla' || e.zone === 'village' || e.zone === 'villas') && (e.cls === 'street' || e.cls === 'rural')) {
        const side = e.id % 2 ? 1 : -1;
        let prev: { x: number; z: number } | null = null;
        for (let s = 10; s < e.len - 6; s += 30) {
          const p = this.pointAt(e, s);
          const nx = -p.tz * side, nz = p.tx * side, off = e.width / 2 + 0.9;
          const x = p.x + nx * off, z = p.z + nz * off;
          if (this.lotAt(x, z) || riverDist(x, z) < 10) { prev = null; continue; }
          this.lamps.push({ x, z, rot: Math.atan2(-nx, -nz), pole: true });
          if (prev) this.wires.push([prev.x, prev.z, x, z]);
          prev = { x, z };
        }
      } else if (town || e.cls === 'highway') {
        const ls = e.cls === 'highway' ? 46 : e.zone === 'center' ? 26 : 34;
        for (let s = 12; s < e.len - 8; s += ls) {
          const p = this.pointAt(e, s);
          const side = Math.floor(s / ls) % 2 ? 1 : -1;
          const nx = -p.tz * side, nz = p.tx * side;
          const off = e.width / 2 + 0.8;
          const x = p.x + nx * off, z = p.z + nz * off;
          if (this.lotAt(x, z) || riverDist(x, z) < 10) continue;
          this.lamps.push({ x, z, rot: Math.atan2(-nx, -nz), tall: e.cls === 'highway' });
        }
      }
      // benches and litter bins on pavements
      if (e.sidewalk) {
        for (let s = 18, k = 0; s < e.len - 12; s += 34, k++) {
          const p = this.pointAt(e, s);
          const side = k % 2 ? 1 : -1;
          const nx = -p.tz * side, nz = p.tx * side, off = e.width / 2 + 2.6;
          const x = p.x + nx * off, z = p.z + nz * off;
          if (this.lotAt(x, z) || this.onRoad(x, z, 0.4) || riverDist(x, z) < 12) continue;
          this.furniture.push({ x, z, rot: Math.atan2(-nx, -nz), kind: k % 3 === 2 ? 'bin' : 'bench' });
        }
      }
      // kerbside parking in town
      if (town && e.cls !== 'highway' && e.cls !== 'lane') {
        for (let s = 14; s < e.len - 14; s += 22) {
          if (rng() > 0.17) continue;
          const p = this.pointAt(e, s);
          const side = rng() < 0.5 ? 1 : -1;
          const nx = -p.tz * side, nz = p.tx * side;
          const off = e.width / 2 - 1.1;
          const x = p.x + nx * off, z = p.z + nz * off;
          if (this.parked.some((q) => Math.hypot(q.x - x, q.z - z) < 7)) continue;
          // right-hand traffic: the kerb on the right of the driving direction
          const dx = nz, dz = -nx;
          this.parked.push({ x, z, rot: Math.atan2(dx, dz), edge: e.id });
        }
      }
    }
  }
}

function satOverlap(a: Vec2[], b: Vec2[]) {
  for (const poly of [a, b]) {
    for (let i = 0; i < 4; i++) {
      const p = poly[i], q = poly[(i + 1) % 4];
      const ax = -(q.z - p.z), az = q.x - p.x;
      let amin = Infinity, amax = -Infinity, bmin = Infinity, bmax = -Infinity;
      for (const v of a) { const d = v.x * ax + v.z * az; amin = Math.min(amin, d); amax = Math.max(amax, d); }
      for (const v of b) { const d = v.x * ax + v.z * az; bmin = Math.min(bmin, d); bmax = Math.max(bmax, d); }
      if (amax < bmin + 1e-6 || bmax < amin + 1e-6) return false;
    }
  }
  return true;
}

export function insideLot(L: Lot, x: number, z: number, pad = 0) {
  const c = Math.cos(L.rot), s = Math.sin(L.rot);
  const dx = x - L.ox, dz = z - L.oz;
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  return lx >= -pad && lx <= L.w + pad && lz >= -pad && lz <= L.d + pad;
}

export function zoneAt(x: number, z: number): Zone {
  const p = { x, z };
  for (const want of ['center', 'industrial', 'villas', 'mahalla', 'village'] as Zone[]) {
    for (const zz of ZONES) if (zz.zone === want && pointInPoly(p, zz.poly)) return want;
  }
  return 'fields';
}

export function zoneLabel(x: number, z: number) {
  const zone = zoneAt(x, z);
  if (zone === 'mahalla') return `${MAHALLA_NAMES[(Math.floor(x / 380) * 7 + Math.floor(z / 380) * 3 + 64) % MAHALLA_NAMES.length]} mahallasi`;
  if (zone === 'village') {
    const named = ZONES.find((zz) => zz.zone === 'village' && zz.name && pointInPoly({ x, z }, zz.poly));
    return named ? `${named.name} qishlog‘i` : 'Qishloq';
  }
  return ZONE_NAMES[zone];
}

export const NET = new Network();

/** height the player / cars stand on: road deck, lot plinth or terrain */
/** flat floors of interiors (they stand outside the map) */
export const INTERIOR_FLOORS: { x0: number; z0: number; x1: number; z1: number; y: number }[] = [];

export function groundAt(x: number, z: number) {
  for (const f of INTERIOR_FLOORS) if (x >= f.x0 && x <= f.x1 && z >= f.z0 && z <= f.z1) return f.y;
  const r = NET.nearestRoad(x, z, 12);
  if (r) {
    if (r.dist < r.e.width / 2 + 0.6) return baseH(x, z) + 0.06;
    if (r.e.sidewalk && r.dist < r.e.width / 2 + 3.2) return baseH(x, z) + 0.2;
  }
  const L = NET.lotAt(x, z);
  if (L) return L.gy;
  return terrainH(x, z);
}

export const roadWidth = (cls: RoadClass) => WIDTH[cls];

if (typeof window !== 'undefined') (window as unknown as { __net: Network }).__net = NET;
