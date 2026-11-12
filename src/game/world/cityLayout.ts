import type { Side, Vec2 } from '@/types';
import { PROPERTIES } from '@/config/properties';
import type { RNG } from '@/utils/math';
import { pick, rand } from '@/utils/math';
import { NET, STATION, RAIL_Z as RAIL_Z_NET, P as GP, frameToWorld, groundAt, zoneLabel, type Edge, type Lot, type LotKind, type SiteKind, type Zone } from './guzor/network';

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
  | 'home'
  | 'mosque'
  | 'complex'
  | 'villas'
  | 'newdev'
  | 'mirijanda';

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
  // landmark / district identity blocks
  '5,1': 'mosque',
  '3,0': 'complex',
  '3,1': 'complex',
  '0,0': 'villas',
  '2,0': 'villas',
  '0,5': 'newdev',
  '3,8': 'mirijanda',
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

/** height of the ground the player / vehicles stand on (G‘uzor terrain, roads, lot plinths) */
export function groundHeight(x: number, z: number) {
  return groundAt(x, z);
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
  const sp = specialAt(i, j);
  if (sp === 'mosque') return 'Amir Temur mahallasi';
  if (sp === 'complex') return '«Yangi hayot» turar-joy majmuasi';
  if (sp === 'villas' || sp === 'newdev') return 'Yangi uylar dahasi';
  if (sp === 'mirijanda') return 'Mardtepa qishlog‘i';
  const d = districtOf(i, j);
  const n = MAHALLA_NAMES[(i * 5 + j * 3) % MAHALLA_NAMES.length];
  if (d === 'mahalla') return `${n} mahallasi`;
  if (d === 'apartments') return `${n} massivi`;
  return DISTRICT_NAMES[d];
}

export function districtNameAt(x: number, z: number) {
  const L = NET.lotAt(x, z);
  if (L?.site) return L.site.name;
  if (Math.hypot(x - STATION.x, z - (RAIL_Z_NET + 17)) < 70) return 'G‘uzor temir yo‘l vokzali';
  const r = NET.nearestRoad(x, z, 10);
  if (r && r.dist < r.e.width / 2 + 1 && r.e.major && r.e.name) return r.e.name;
  return zoneLabel(x, z);
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

const ZONE_OF: Record<District, Zone[]> = {
  downtown: ['center'], apartments: ['center', 'mahalla'], mahalla: ['mahalla', 'villas'], industrial: ['industrial'], village: ['village', 'fields'],
};

/** kerb-side point on an edge; heading follows right-hand traffic on that side */
export function kerbPoint(e: Edge, s: number, side: number) {
  const p = NET.pointAt(e, s);
  const nx = -p.tz * side, nz = p.tx * side;
  const off = e.width / 2 - 1.2;
  return { x: p.x + nx * off, z: p.z + nz * off, heading: Math.atan2(nz, -nx) };
}

export function randomCurbPoint(rng: RNG, districts?: District[], avoid?: Vec2, minDist = 0): Vec2 {
  const zones = districts ? districts.flatMap((d) => ZONE_OF[d]) : null;
  for (let tries = 0; tries < 120; tries++) {
    const e = NET.edges[Math.floor(rng() * NET.edges.length)];
    if (e.cls === 'highway' || e.cls === 'lane' || e.len < 30) continue;
    if (zones && !zones.includes(e.zone)) continue;
    const p = kerbPoint(e, 12 + rng() * (e.len - 24), rng() < 0.5 ? 1 : -1);
    if (avoid && Math.hypot(p.x - avoid.x, p.z - avoid.z) < minDist) continue;
    return { x: p.x, z: p.z };
  }
  const e = NET.edges.find((x) => x.zone === 'center') ?? NET.edges[0];
  const p = kerbPoint(e, e.len / 2, 1);
  return { x: p.x, z: p.z };
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
  /** facing of boards placed at the POI */
  rot?: number;
}

const SITE_POI: Partial<Record<SiteKind, { kind: SpecialKind; inset: number; radius: number; glyph: string }>> = {
  bank: { kind: 'bank', inset: 2.5, radius: 3, glyph: 'B' },
  jobs: { kind: 'jobs', inset: 2.5, radius: 3, glyph: 'I' },
  realty: { kind: 'realty', inset: 2.5, radius: 3, glyph: 'M' },
  dealership: { kind: 'dealership', inset: 2.5, radius: 3.5, glyph: 'A' },
  service: { kind: 'service', inset: 9, radius: 7, glyph: 'S' },
  osh: { kind: 'osh', inset: 2.5, radius: 3, glyph: 'O' },
  warehouse: { kind: 'warehouse', inset: 2.5, radius: 3, glyph: 'P' },
  farm: { kind: 'farm', inset: 6, radius: 4, glyph: 'F' },
  bazaar: { kind: 'bazaar', inset: 2.5, radius: 3.5, glyph: 'D' },
  fuel: { kind: 'fuel', inset: 12, radius: 7, glyph: '⛽' },
};
const LOCAL_FRONT: Record<Side, (inset: number) => [number, number]> = {
  s: (i) => [38, 76 - i], n: (i) => [38, i], w: (i) => [i, 38], e: (i) => [76 - i, 38],
};
export const SITES = NET.lots.filter((l) => l.kind === 'site');

const PROP_TARGET: Record<string, { px: number; py: number; kinds: LotKind[] }> = {
  'apt-yunusobod': { px: 820, py: 450, kinds: ['apartment'] },
  'apt-yangi': { px: 980, py: 520, kinds: ['apartment'] },
  'hovli-bogbon': { px: 700, py: 620, kinds: ['house'] },
  'hovli-katta': { px: 1100, py: 700, kinds: ['house'] },
  'villa-qishloq': { px: 1330, py: 470, kinds: ['villa', 'house'] },
  'biz-choyxona': { px: 900, py: 600, kinds: ['commercial'] },
  'biz-avtoyuvish': { px: 1420, py: 380, kinds: ['industrial', 'commercial'] },
  'biz-supermarket': { px: 870, py: 680, kinds: ['commercial'] },
  'garaj-ikki': { px: 1000, py: 262, kinds: ['industrial', 'commercial'] },
};
const usedLots = new Set<number>();
function nearestLot(px: number, py: number, kinds: LotKind[]) {
  const t = GP(px, py);
  let best: Lot | null = null, bd = Infinity;
  for (const L of NET.lots) {
    if (!kinds.includes(L.kind) || usedLots.has(L.id)) continue;
    const d = Math.hypot(L.cx - t.x, L.cz - t.z);
    if (d < bd) { bd = d; best = L; }
  }
  if (best) usedLots.add(best.id);
  return best!;
}
const lotFront = (L: Lot) => frameToWorld(L.ox, L.oz, L.rot, L.w * 0.5, L.kind === 'commercial' ? 1.4 : 2.2);
const HOME_LOT = nearestLot(1060, 650, ['house']);
HOME_LOT.home = true;

export const POIS: POI[] = [
  ...SITES.flatMap((L, n) => {
    const def = L.site!;
    const m = SITE_POI[def.kind];
    if (!m) return [];
    const [lx, lz] = LOCAL_FRONT[def.front](m.inset);
    return [{ id: `${m.kind}-${n}`, kind: m.kind, name: def.name, pos: frameToWorld(L.ox, L.oz, L.rot, lx, lz), radius: m.radius, glyph: m.glyph, rot: L.rot }];
  }),
  { id: 'home-0', kind: 'home' as const, name: 'Ijaradagi uyingiz', pos: lotFront(HOME_LOT), radius: 2.5, glyph: 'U', rot: HOME_LOT.rot + Math.PI },
  ...PROPERTIES.map((p) => {
    const tg = PROP_TARGET[p.id] ?? { px: 900, py: 600, kinds: ['house'] as LotKind[] };
    const L = nearestLot(tg.px, tg.py, tg.kinds);
    L.propertyId = p.id;
    return { id: `prop-${p.id}`, kind: 'property' as const, name: p.name, pos: lotFront(L), radius: 2.6, propertyId: p.id, glyph: '₪', rot: L.rot + Math.PI };
  }),
];

export const poiOf = (kind: SpecialKind) => POIS.find((p) => p.kind === kind)!;

/** kerb spot on the nearest street, on the same side as p */
export function garageSpawnNear(p: Vec2) {
  const r = NET.nearestRoad(p.x, p.z, 30) ?? NET.nearestRoad(p.x, p.z, 90);
  if (!r) return { x: p.x, z: p.z, heading: 0 };
  const q = NET.pointAt(r.e, r.s);
  const side = (p.x - q.x) * -q.tz + (p.z - q.z) * q.tx >= 0 ? 1 : -1;
  const s = Math.max(8, Math.min(r.e.len - 8, r.s + 4));
  return kerbPoint(r.e, s, side);
}

/** courtyard house layout shared by the house builder and the home parking spot (local lot frame, metres) */
export const HOUSE_WALL_Z = 4.7;
export const HOUSE_GATE_W = 3.6;
export const HOME_HOUSE_DEPTH = 11;
/** gate opening (local x of its left edge) of a house lot: deterministic, so street trees and kerb parking can keep it clear */
export function houseGateX(id: number, w: number, home: boolean) {
  if (home) return w / 2 - HOUSE_GATE_W / 2;
  const h = Math.sin(id * 12.9898 + 78.233) * 43758.5453;
  return 1.5 + (h - Math.floor(h)) * Math.max(0.1, w - HOUSE_GATE_W - 3);
}
export function houseYard(depth: number, hd: number) {
  const front = depth - 0.4 - hd;
  const az = front - 1.4;
  const padLen = Math.max(0, Math.min(6.2, az - 2.4 - HOUSE_WALL_Z - 0.2));
  return { front, az, padLen, padZ0: HOUSE_WALL_Z + 0.2, padZ1: HOUSE_WALL_Z + 0.2 + padLen };
}
/** player's rented home: car parks inside the courtyard, nose to the open gate */
export const HOME_HEADING = HOME_LOT.rot;
export const HOME_GATE = frameToWorld(HOME_LOT.ox, HOME_LOT.oz, HOME_LOT.rot, HOME_LOT.w / 2, HOUSE_WALL_Z);
export const HOME_PARKING = (() => {
  const y = houseYard(HOME_LOT.d - 0.3, HOME_HOUSE_DEPTH);
  if (y.padLen < 4.6) return garageSpawnNear(lotFront(HOME_LOT));
  const p = frameToWorld(HOME_LOT.ox, HOME_LOT.oz, HOME_LOT.rot, HOME_LOT.w / 2, (y.padZ0 + y.padZ1) / 2 + 0.2);
  return { x: p.x, z: p.z, heading: HOME_LOT.rot + Math.PI };
})();
export const PLAYER_SPAWN = poiOf('home').pos;
export const STARTER_CAR = HOME_PARKING;
export const DEALERSHIP_SPAWN = garageSpawnNear(poiOf('dealership').pos);

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

if (typeof window !== 'undefined') {
  (window as unknown as { __POIS_SITES: unknown }).__POIS_SITES = SITES.map((L) => {
    const f = frameToWorld(L.ox, L.oz, L.rot, 38, L.site!.front === 'n' ? -14 : 90);
    return { name: L.site!.name, x: f.x, z: f.z, rot: L.rot + (L.site!.front === 'n' ? 0 : Math.PI) };
  });
}
