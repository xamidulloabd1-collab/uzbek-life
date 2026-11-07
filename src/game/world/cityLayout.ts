import type { Side, Vec2 } from '@/types';
import { PROPERTIES } from '@/config/properties';
import type { RNG } from '@/utils/math';
import { pick, rand } from '@/utils/math';

/** Blocks per side */
export const N = 9;
export const BLOCK = 76;
export const ROAD = 14;
export const PITCH = BLOCK + ROAD;
export const HALF = (N * PITCH) / 2;
export const SIDEWALK = 4;
export const CURB_H = 0.15;
export const LANE = 2.6;
export const WORLD_HALF = HALF + 70;

export type District = 'downtown' | 'mahalla' | 'apartments' | 'industrial' | 'village';

export const DISTRICT_NAMES: Record<District, string> = {
  downtown: 'Markaz',
  mahalla: 'Mahalla',
  apartments: 'Turar-joy massivi',
  industrial: 'Sanoat zonasi',
  village: 'Qishloq',
};

export const DISTRICT_COLORS: Record<District, string> = {
  downtown: '#4b5a6e',
  mahalla: '#b49a72',
  apartments: '#8c949c',
  industrial: '#6b6358',
  village: '#71834f',
};

export const roadLine = (k: number) => (k - N / 2) * PITCH;

export interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  cx: number;
  cz: number;
}

export function blockRect(i: number, j: number): Rect {
  const x0 = roadLine(i) + ROAD / 2;
  const z0 = roadLine(j) + ROAD / 2;
  return { x0, z0, x1: x0 + BLOCK, z1: z0 + BLOCK, cx: x0 + BLOCK / 2, cz: z0 + BLOCK / 2 };
}

export function districtOf(i: number, j: number): District {
  if (i >= 3 && i <= 5 && j >= 3 && j <= 5) return 'downtown';
  if (j >= 7) return 'village';
  if (i >= 6) return 'industrial';
  if (i <= 2) return 'mahalla';
  return 'apartments';
}

export type SpecialKind =
  | 'plaza'
  | 'bank'
  | 'jobs'
  | 'realty'
  | 'bazaar'
  | 'school'
  | 'park'
  | 'dealership'
  | 'service'
  | 'osh'
  | 'warehouse'
  | 'farm'
  | 'fuel'
  | 'home';

export const SPECIAL: Record<string, SpecialKind> = {
  '4,4': 'plaza',
  '3,4': 'bank',
  '5,4': 'jobs',
  '4,3': 'realty',
  '5,3': 'osh',
  '1,3': 'bazaar',
  '1,5': 'school',
  '4,1': 'park',
  '7,5': 'dealership',
  '7,1': 'service',
  '7,3': 'warehouse',
  '2,7': 'farm',
  '8,3': 'fuel',
  '0,7': 'fuel',
  '1,1': 'home',
};

export const specialAt = (i: number, j: number): SpecialKind | undefined => SPECIAL[`${i},${j}`];

export function propertyAt(i: number, j: number) {
  return PROPERTIES.find((p) => p.block[0] === i && p.block[1] === j);
}

/** blocks whose yard is level with the road (cars drive in) */
export function isFlatBlock(i: number, j: number) {
  const s = specialAt(i, j);
  return districtOf(i, j) === 'village' || s === 'fuel' || s === 'service';
}

export function blockAt(x: number, z: number): { i: number; j: number } | null {
  const fx = x + HALF;
  const fz = z + HALF;
  const i = Math.floor(fx / PITCH);
  const j = Math.floor(fz / PITCH);
  if (i < 0 || j < 0 || i >= N || j >= N) return null;
  const lx = fx - i * PITCH;
  const lz = fz - j * PITCH;
  if (lx < ROAD / 2 || lx > ROAD / 2 + BLOCK || lz < ROAD / 2 || lz > ROAD / 2 + BLOCK) return null;
  return { i, j };
}

export function groundHeight(x: number, z: number) {
  const b = blockAt(x, z);
  if (!b || isFlatBlock(b.i, b.j)) return 0;
  return CURB_H;
}

/** G‘uzordaryo crosses the town through this block row (bridges carry every north–south street) */
export const RIVER_ROW = 6;
export const RIVER = (() => {
  const zc = roadLine(RIVER_ROW) + ROAD / 2 + BLOCK / 2;
  return { zc, z0: zc - 14, z1: zc + 14 };
})();
/** railway (1520 mm gauge) north of the ring road, station opposite the centre */
export const RAIL_Z = -(HALF + ROAD / 2 + 8) - 60;
export const STATION_X = 40;

/** real mahalla names of G‘uzor tumani (gov.uz) used for the game's mahallas */
export const MAHALLA_NAMES = ['Gulshan', 'Eskibog‘', 'Istiqbol', 'Tinchlik', 'Mustaqillik', 'Navro‘z', 'Do‘stlik', 'Mevazor', 'Bo‘ston', 'Abod', 'Obihayot', 'Fayziobod', 'Amir Temur', 'Yangihayot', 'Mehnatobod', 'Chanoq'];

export function blockName(i: number, j: number) {
  if (j === RIVER_ROW) return 'G‘uzordaryo sohili';
  const d = districtOf(i, j);
  const n = MAHALLA_NAMES[(i * 5 + j * 3) % MAHALLA_NAMES.length];
  if (d === 'mahalla') return `${n} mahallasi`;
  if (d === 'apartments') return `${n} massivi`;
  return DISTRICT_NAMES[d];
}

export function districtNameAt(x: number, z: number) {
  if (Math.abs(z - RAIL_Z) < 40 && Math.abs(x - STATION_X) < 120) return 'G‘uzor temir yo‘l vokzali';
  if (Math.abs(x) > HALF - ROAD || Math.abs(z) > HALF - ROAD) return 'Katta halqa yo‘li';
  const i = Math.min(N - 1, Math.max(0, Math.floor((x + HALF) / PITCH)));
  const j = Math.min(N - 1, Math.max(0, Math.floor((z + HALF) / PITCH)));
  return blockName(i, j);
}

/** point on the block's own sidewalk/yard, `inset` metres in from the edge, `t` 0..1 along the side */
export function sidePoint(i: number, j: number, side: Side, inset = 2, t = 0.5): Vec2 {
  const r = blockRect(i, j);
  switch (side) {
    case 'n':
      return { x: r.x0 + BLOCK * t, z: r.z0 + inset };
    case 's':
      return { x: r.x1 - BLOCK * t, z: r.z1 - inset };
    case 'w':
      return { x: r.x0 + inset, z: r.z1 - BLOCK * t };
    case 'e':
      return { x: r.x1 - inset, z: r.z0 + BLOCK * t };
  }
}

/** point on the road lane next to the block's curb */
export function curbPoint(i: number, j: number, side: Side, t = 0.5): Vec2 {
  return sidePoint(i, j, side, -(ROAD / 2 - LANE), t);
}

/** heading (rad) of right-hand traffic in the lane next to a block side */
export function curbHeading(side: Side) {
  return side === 's' ? -Math.PI / 2 : side === 'n' ? Math.PI / 2 : side === 'w' ? Math.PI : 0;
}

export function randomCurbPoint(rng: RNG, districts?: District[], avoid?: Vec2, minDist = 0): Vec2 {
  for (let tries = 0; tries < 60; tries++) {
    const i = Math.floor(rng() * N);
    const j = Math.floor(rng() * N);
    if (districts && !districts.includes(districtOf(i, j))) continue;
    const p = curbPoint(i, j, pick(rng, ['n', 's', 'e', 'w'] as Side[]), rand(rng, 0.2, 0.8));
    if (avoid && Math.hypot(p.x - avoid.x, p.z - avoid.z) < minDist) continue;
    return p;
  }
  return curbPoint(4, 4, 's', 0.5);
}

export type POIKind = SpecialKind | 'property';

export interface POI {
  id: string;
  kind: POIKind;
  name: string;
  pos: Vec2;
  radius: number;
  propertyId?: string;
  /** short glyph for the map */
  glyph: string;
}

const POI_DEFS: { kind: SpecialKind; name: string; block: [number, number]; side: Side; inset: number; radius: number; glyph: string }[] = [
  { kind: 'bank', name: 'Bank', block: [3, 4], side: 's', inset: 2.5, radius: 3, glyph: 'B' },
  { kind: 'jobs', name: 'Mehnat birjasi', block: [5, 4], side: 's', inset: 2.5, radius: 3, glyph: 'I' },
  { kind: 'realty', name: 'Ko‘chmas mulk agentligi', block: [4, 3], side: 's', inset: 2.5, radius: 3, glyph: 'M' },
  { kind: 'dealership', name: 'Avtosalon', block: [7, 5], side: 'w', inset: 2.5, radius: 3.5, glyph: 'A' },
  { kind: 'service', name: 'Avtoservis va garaj', block: [7, 1], side: 's', inset: 9, radius: 7, glyph: 'S' },
  { kind: 'osh', name: 'Osh markazi', block: [5, 3], side: 's', inset: 2.5, radius: 3, glyph: 'O' },
  { kind: 'warehouse', name: 'Pochta ombori', block: [7, 3], side: 's', inset: 2.5, radius: 3, glyph: 'P' },
  { kind: 'farm', name: 'Fermer xo‘jaligi', block: [2, 7], side: 'n', inset: 6, radius: 4, glyph: 'F' },
  { kind: 'bazaar', name: 'Dehqon bozori', block: [1, 3], side: 's', inset: 2.5, radius: 3.5, glyph: 'D' },
  { kind: 'fuel', name: 'AYOQSH', block: [8, 3], side: 'e', inset: 12, radius: 7, glyph: '⛽' },
  { kind: 'fuel', name: 'AYOQSH', block: [0, 7], side: 'w', inset: 12, radius: 7, glyph: '⛽' },
  { kind: 'home', name: 'Ijaradagi uyingiz', block: [1, 1], side: 's', inset: 2.5, radius: 2.5, glyph: 'U' },
];

export const POIS: POI[] = [
  ...POI_DEFS.map((d, n) => ({
    id: `${d.kind}-${n}`,
    kind: d.kind,
    name: d.name,
    pos: sidePoint(d.block[0], d.block[1], d.side, d.inset),
    radius: d.radius,
    glyph: d.glyph,
  })),
  ...PROPERTIES.map((p) => ({
    id: `prop-${p.id}`,
    kind: 'property' as const,
    name: p.name,
    pos: sidePoint(p.block[0], p.block[1], p.side, 2.5, 0.42),
    radius: 2.6,
    propertyId: p.id,
    glyph: '₪',
  })),
];

export const poiOf = (kind: SpecialKind) => POIS.find((p) => p.kind === kind)!;

export const PLAYER_SPAWN = sidePoint(1, 1, 's', 2, 0.5);
export const STARTER_CAR = { ...curbPoint(1, 1, 's', 0.36), heading: curbHeading('s') };
export const DEALERSHIP_SPAWN = { ...curbPoint(7, 5, 'w', 0.3), heading: curbHeading('w') };

/** where a vehicle appears when taken out of a garage near `p` */
export function garageSpawnNear(p: Vec2) {
  const b = blockAt(p.x, p.z);
  if (!b) return { x: p.x, z: p.z, heading: 0 };
  const r = blockRect(b.i, b.j);
  const d = { n: p.z - r.z0, s: r.z1 - p.z, w: p.x - r.x0, e: r.x1 - p.x };
  const side = (Object.keys(d) as Side[]).reduce((a, c) => (d[c] < d[a] ? c : a), 'n');
  const t =
    side === 'n' ? (p.x - r.x0) / BLOCK : side === 's' ? (r.x1 - p.x) / BLOCK : side === 'w' ? (r.z1 - p.z) / BLOCK : (p.z - r.z0) / BLOCK;
  return { ...curbPoint(b.i, b.j, side, Math.min(0.9, Math.max(0.1, t + 0.08))), heading: curbHeading(side) };
}

/** Road graph used by traffic */
export const DIRS: [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];
export const rightOf = (d: number): [number, number] => [-DIRS[d][1], DIRS[d][0]];
export const nodePos = (k: number, l: number): Vec2 => ({ x: roadLine(k), z: roadLine(l) });
export const isLightNode = (k: number, l: number) => k >= 3 && k <= 6 && l >= 3 && l <= 6;
export const nodeValid = (k: number, l: number) => k >= 0 && l >= 0 && k <= N && l <= N;

export function segmentSpeed(k: number, l: number, d: number) {
  const ring = d % 2 === 1 ? k === 0 || k === N : l === 0 || l === N;
  if (ring) return 17;
  if (k >= 3 && k <= 6 && l >= 3 && l <= 6) return 11;
  return 13;
}

/** true when a road segment runs through farmland (rural asphalt) */
export function isRuralSegment(vertical: boolean, k: number, l: number) {
  // vertical road on x-line k between z-lines l..l+1 ; horizontal road on z-line l between x-lines k..k+1
  if (vertical) {
    if (k === 0 || k === N) return false;
    return l >= 7;
  }
  if (l === 0 || l === N) return false;
  return l >= 8;
}
