import type { VehicleCategory, VehicleSpec } from '@/types';
import type { RNG } from '@/utils/math';
import { pick, randInt } from '@/utils/math';

/**
 * All vehicles are ORIGINAL fictional designs. Each one fills the same everyday
 * role that a familiar car plays on Uzbek roads (city sedan, micro-van, crossover…).
 * Real brand names, logos and body designs are intentionally NOT used.
 * If you obtain a licence + licensed GLB models, add `modelUrl` support in
 * game/vehicles/vehicleModel.ts and rename here — physics/economy keep working.
 */
export const VEHICLES: VehicleSpec[] = [
  {
    id: 'lola',
    name: 'Sarbon S3',
    manufacturer: 'Sarbon Motors',
    year: 2025,
    niche: 'Shahar sedani',
    description: 'Arzon, chidamli va ta’mirlash oson. G‘uzor ko‘chalarida eng ko‘p uchraydigan mashina.',
    body: 'sedan',
    price: 128_000_000,
    seats: 5,
    fareFactor: 1,
    perf: { maxSpeedKmh: 190, accel: 3.9, brake: 7.4, steerAngle: 0.6, steerSpeed: 2.6, mass: 1080, grip: 0.95, suspension: 0.65, fuelCapacity: 48, consumption: 8.6 },
    dims: { length: 4.15, width: 1.68, height: 1.43, wheelbase: 2.48, wheelRadius: 0.3, clearance: 0.16 },
    shape: { belt: 0.9, hood: 1.05, trunk: 0.85, wsRun: 0.72, rwRun: 0.55 },
    defaultColor: '#f2f2ef',
  },
  {
    id: 'chumchuq',
    name: 'Sarbon City',
    manufacturer: 'Sarbon Motors',
    year: 2025,
    niche: 'Shahar hetchbegi',
    description: 'Kichkina, tejamkor, tor mahalla ko‘chalarida ham bemalol buriladi.',
    body: 'hatch',
    price: 96_000_000,
    seats: 4,
    fareFactor: 0.9,
    perf: { maxSpeedKmh: 175, accel: 3.6, brake: 7.6, steerAngle: 0.66, steerSpeed: 2.9, mass: 940, grip: 0.95, suspension: 0.6, fuelCapacity: 35, consumption: 6.4 },
    dims: { length: 3.64, width: 1.6, height: 1.52, wheelbase: 2.38, wheelRadius: 0.29, clearance: 0.15 },
    shape: { belt: 0.92, hood: 0.8, trunk: 0.16, wsRun: 0.78, rwRun: 0.22 },
    defaultColor: '#1d9aa3',
  },
  {
    id: 'zarafshon',
    name: 'Sarbon S5',
    manufacturer: 'Sarbon Motors',
    year: 2025,
    niche: 'Oilaviy sedan',
    description: 'Keng yukxona va baland shift. Oilaviy safarlar va taksi uchun eng mashhur tanlov.',
    body: 'sedan',
    price: 152_000_000,
    seats: 5,
    fareFactor: 1.1,
    perf: { maxSpeedKmh: 205, accel: 4.3, brake: 8, steerAngle: 0.58, steerSpeed: 2.6, mass: 1190, grip: 1, suspension: 0.55, fuelCapacity: 46, consumption: 7.6 },
    dims: { length: 4.48, width: 1.74, height: 1.51, wheelbase: 2.62, wheelRadius: 0.31, clearance: 0.16 },
    shape: { belt: 0.95, hood: 1.1, trunk: 0.95, wsRun: 0.8, rwRun: 0.62 },
    defaultColor: '#f2f2ef',
  },
  {
    id: 'bahor',
    name: 'Sarbon S4 Classic',
    manufacturer: 'Sarbon Motors',
    year: 2025,
    niche: 'Klassik sedan',
    description: 'Vaqt sinovidan o‘tgan muvozanatli sedan: yumshoq yurish, oson boshqaruv.',
    body: 'sedan',
    price: 166_000_000,
    seats: 5,
    fareFactor: 1.1,
    perf: { maxSpeedKmh: 215, accel: 4.6, brake: 8, steerAngle: 0.58, steerSpeed: 2.7, mass: 1240, grip: 1.01, suspension: 0.5, fuelCapacity: 60, consumption: 8.1 },
    dims: { length: 4.52, width: 1.73, height: 1.45, wheelbase: 2.6, wheelRadius: 0.31, clearance: 0.15 },
    shape: { belt: 0.9, hood: 1.12, trunk: 0.9, wsRun: 0.84, rwRun: 0.7 },
    defaultColor: '#b8bcc2',
  },
  {
    id: 'amir',
    name: 'Sarbon S7',
    manufacturer: 'Sarbon Motors',
    year: 2025,
    niche: 'Biznes sedan',
    description: 'Uzun, past va tez. Rahbarlar va VIP-taksi haydovchilarining tanlovi.',
    body: 'sedan',
    price: 385_000_000,
    seats: 5,
    fareFactor: 1.6,
    perf: { maxSpeedKmh: 255, accel: 6.2, brake: 8.8, steerAngle: 0.55, steerSpeed: 2.7, mass: 1500, grip: 1.08, suspension: 0.42, fuelCapacity: 60, consumption: 9.2 },
    dims: { length: 4.92, width: 1.85, height: 1.46, wheelbase: 2.83, wheelRadius: 0.33, clearance: 0.15 },
    shape: { belt: 0.92, hood: 1.25, trunk: 1.0, wsRun: 0.95, rwRun: 0.85 },
    defaultColor: '#16181c',
  },
  {
    id: 'karvon',
    name: 'Sarbon Van',
    manufacturer: 'Sarbon Motors',
    year: 2025,
    niche: 'Mikroavtobus',
    description: 'Kichik, ammo sig‘imli. Bozorchilar, kuryerlar va marshrutkachilarning sodiq yordamchisi.',
    body: 'van',
    price: 89_000_000,
    seats: 7,
    fareFactor: 0.95,
    perf: { maxSpeedKmh: 135, accel: 2.7, brake: 6.2, steerAngle: 0.62, steerSpeed: 2.6, mass: 930, grip: 0.84, suspension: 0.85, fuelCapacity: 38, consumption: 9 },
    dims: { length: 3.5, width: 1.42, height: 1.9, wheelbase: 1.85, wheelRadius: 0.26, clearance: 0.17 },
    shape: { belt: 0.95, hood: 0.32, trunk: 0.04, wsRun: 0.36, rwRun: 0.05 },
    defaultColor: '#f2f2ef',
  },
  {
    id: 'qoya',
    name: 'Sarbon X3',
    manufacturer: 'Sarbon Motors',
    year: 2025,
    niche: 'Ixcham krossover',
    description: 'Baland klirens va to‘rt kishilik qulaylik. Shahar va qishloq yo‘llari uchun.',
    body: 'crossover',
    price: 279_000_000,
    seats: 5,
    fareFactor: 1.3,
    perf: { maxSpeedKmh: 220, accel: 5.0, brake: 8.2, steerAngle: 0.57, steerSpeed: 2.7, mass: 1340, grip: 1, suspension: 0.58, fuelCapacity: 48, consumption: 7.9 },
    dims: { length: 4.27, width: 1.79, height: 1.65, wheelbase: 2.57, wheelRadius: 0.34, clearance: 0.2 },
    shape: { belt: 1.05, hood: 1.0, trunk: 0.2, wsRun: 0.78, rwRun: 0.3 },
    defaultColor: '#a3201d',
  },
  {
    id: 'burgut',
    name: 'Sarbon X5',
    manufacturer: 'Sarbon Motors',
    year: 2025,
    niche: 'O‘rta SUV',
    description: 'Kuchli, keng va xavfsiz. Uzoq safar va katta oila uchun eng yaxshi tanlov.',
    body: 'suv',
    price: 452_000_000,
    seats: 5,
    fareFactor: 1.5,
    perf: { maxSpeedKmh: 240, accel: 5.5, brake: 8.5, steerAngle: 0.55, steerSpeed: 2.6, mass: 1660, grip: 1.02, suspension: 0.62, fuelCapacity: 59, consumption: 10.2 },
    dims: { length: 4.65, width: 1.84, height: 1.69, wheelbase: 2.73, wheelRadius: 0.36, clearance: 0.21 },
    shape: { belt: 1.08, hood: 1.08, trunk: 0.18, wsRun: 0.8, rwRun: 0.28 },
    defaultColor: '#4a4f57',
  },
];

export const VEHICLE_MAP: Record<string, VehicleSpec> = Object.fromEntries(VEHICLES.map((v) => [v.id, v]));

const BODY_CATEGORY: Record<string, VehicleCategory> = { sedan: 'sedan', hatch: 'hatchback', van: 'van', crossover: 'suv', suv: 'suv' };
export const categoryOf = (s: VehicleSpec): VehicleCategory => s.category ?? BODY_CATEGORY[s.body] ?? 'sedan';

export const CATEGORY_NAMES: Record<VehicleCategory, string> = {
  sedan: 'Sedan', hatchback: 'Hetchbek', suv: 'SUV / krossover', pickup: 'Pikap', van: 'Furgon / miniven', truck: 'Yuk mashinasi',
  bus: 'Avtobus', service: 'Xizmat mashinasi', emergency: 'Maxsus xizmat', sports: 'Sport', classic: 'Klassik',
};

type Template = Pick<VehicleSpec, 'body' | 'dims' | 'shape' | 'perf' | 'price' | 'seats'>;
const T = (body: VehicleSpec['body'], d: number[], sh: number[], p: Partial<VehicleSpec['perf']>, price: number, seats = 5): Template => ({
  body, price, seats,
  dims: { length: d[0], width: d[1], height: d[2], wheelbase: d[3], wheelRadius: d[4], clearance: d[5] },
  shape: { belt: sh[0], hood: sh[1], trunk: sh[2], wsRun: sh[3], rwRun: sh[4] },
  perf: { maxSpeedKmh: 190, accel: 4.2, brake: 8, steerAngle: 0.58, steerSpeed: 2.6, mass: 1300, grip: 1, suspension: 0.55, fuelCapacity: 50, consumption: 8, ...p },
});
/** sensible physics/size defaults per category; vehicle.json may override any field */
export const CATEGORY_TEMPLATES: Record<VehicleCategory, Template> = {
  sedan: T('sedan', [4.5, 1.78, 1.47, 2.7, 0.32, 0.15], [0.93, 1.1, 0.9, 0.82, 0.65], {}, 180_000_000),
  hatchback: T('hatch', [4.0, 1.72, 1.48, 2.5, 0.31, 0.15], [0.92, 0.9, 0.18, 0.8, 0.25], { maxSpeedKmh: 180, mass: 1100 }, 140_000_000),
  suv: T('suv', [4.6, 1.85, 1.7, 2.72, 0.36, 0.21], [1.08, 1.05, 0.18, 0.8, 0.28], { maxSpeedKmh: 200, mass: 1650, consumption: 10 }, 420_000_000),
  pickup: T('suv', [5.3, 1.9, 1.8, 3.1, 0.38, 0.24], [1.12, 1.2, 0.2, 0.75, 0.25], { maxSpeedKmh: 175, mass: 2000, consumption: 11 }, 380_000_000),
  van: T('van', [4.9, 1.9, 1.95, 3.0, 0.32, 0.18], [0.98, 0.5, 0.05, 0.45, 0.05], { maxSpeedKmh: 150, mass: 1900, suspension: 0.8 }, 300_000_000, 8),
  truck: T('van', [7.4, 2.4, 3.0, 4.2, 0.5, 0.3], [1.35, 0.6, 0.05, 0.4, 0.05], { maxSpeedKmh: 110, accel: 1.8, brake: 6, mass: 7500, grip: 0.85, suspension: 0.85, fuelCapacity: 200, consumption: 25 }, 700_000_000, 2),
  bus: T('van', [11, 2.5, 3.1, 6.0, 0.5, 0.3], [1.3, 0.4, 0.05, 0.35, 0.05], { maxSpeedKmh: 100, accel: 1.5, brake: 5.5, steerAngle: 0.5, mass: 11000, grip: 0.8, suspension: 0.8, fuelCapacity: 250, consumption: 30 }, 1_200_000_000, 40),
  service: T('van', [5.2, 2.0, 2.2, 3.2, 0.34, 0.2], [1.0, 0.55, 0.05, 0.45, 0.05], { maxSpeedKmh: 140, mass: 2300 }, 320_000_000, 3),
  emergency: T('sedan', [4.8, 1.85, 1.5, 2.8, 0.33, 0.15], [0.94, 1.2, 0.95, 0.9, 0.8], { maxSpeedKmh: 210, mass: 1600 }, 450_000_000),
  sports: T('sedan', [4.4, 1.92, 1.25, 2.6, 0.34, 0.11], [0.8, 1.35, 0.7, 0.95, 0.75], { maxSpeedKmh: 290, accel: 7.5, brake: 10, mass: 1450, grip: 1.25, suspension: 0.3 }, 1_500_000_000, 2),
  classic: T('sedan', [4.6, 1.8, 1.42, 2.7, 0.33, 0.17], [0.92, 1.25, 1.0, 0.75, 0.6], { maxSpeedKmh: 160, accel: 3, mass: 1250, grip: 0.9 }, 120_000_000),
};

export interface CatalogEntry {
  id: string;
  name: string;
  category: VehicleCategory;
  model: string;
  price?: number;
  seats?: number;
  weight?: number;
  rotateY?: number;
  dims?: Partial<VehicleSpec['dims']>;
  perf?: Partial<VehicleSpec['perf']>;
  description?: string;
  license: { title: string; author: string; license: string; source: string; downloaded?: string; modifications?: string };
}

/** add vehicles from the catalog (public/assets/vehicles/catalog.json) to the game */
export function registerVehicles(list: CatalogEntry[], base: string) {
  const added: string[] = [];
  for (const e of list) {
    const t = CATEGORY_TEMPLATES[e.category] ?? CATEGORY_TEMPLATES.sedan;
    if (!e.id || !e.model || !e.license?.license) continue;
    const spec: VehicleSpec = {
      id: e.id, name: e.name, niche: CATEGORY_NAMES[e.category] ?? e.category, description: e.description ?? `${e.license.title} — ${e.license.author}`,
      body: t.body, price: e.price ?? t.price, seats: e.seats ?? t.seats, fareFactor: 1 + Math.min(1, (e.price ?? t.price) / 1e9),
      perf: { ...t.perf, ...e.perf }, dims: { ...t.dims, ...e.dims }, shape: t.shape, defaultColor: '#f2f2ef',
      category: e.category, modelUrl: base + e.model, rotateY: e.rotateY ?? 0, weight: e.weight ?? 1, license: e.license,
    };
    const i = VEHICLES.findIndex((v) => v.id === spec.id);
    if (i >= 0) VEHICLES[i] = spec;
    else VEHICLES.push(spec);
    VEHICLE_MAP[spec.id] = spec;
    added.push(spec.id);
  }
  return added;
}

export const PAINT_COLORS = [
  { name: 'Oq', hex: '#f2f2ef' },
  { name: 'Kumush', hex: '#b8bcc2' },
  { name: 'Grafit', hex: '#4a4f57' },
  { name: 'Qora', hex: '#16181c' },
  { name: 'Qizil', hex: '#a3201d' },
  { name: 'Bordo', hex: '#5e1a24' },
  { name: 'Ko‘k', hex: '#1f4e8c' },
  { name: 'Firuza', hex: '#1d9aa3' },
  { name: 'Yashil', hex: '#2f5d3a' },
  { name: 'Qum', hex: '#c9b48a' },
  { name: 'To‘q sariq', hex: '#d9822b' },
  { name: 'Oltin', hex: '#b8954a' },
] as const;

export const WHEEL_STYLES = [
  { name: 'Po‘lat', color: '#3a3d42', metal: 0.4, rough: 0.6, spokes: 0 },
  { name: 'Kumush disk', color: '#c9ccd1', metal: 0.95, rough: 0.25, spokes: 5 },
  { name: 'Qora sport', color: '#1a1b1e', metal: 0.6, rough: 0.35, spokes: 10 },
  { name: 'Oltin disk', color: '#c5a253', metal: 1, rough: 0.2, spokes: 6 },
] as const;

export const TINT_LEVELS = [
  { name: 'Tiniq', opacity: 0.62 },
  { name: 'O‘rta', opacity: 0.78 },
  { name: 'To‘q', opacity: 0.9 },
] as const;

/** Uzbek region codes used on plates */
export const PLATE_REGIONS = ['01', '10', '20', '25', '30', '40', '50', '60', '70', '75', '80', '85', '90', '95'];

const PLATE_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVXYZ';

/** Private: "70 A 123 BC"  ·  Company: "70 123 ABC" */
export function isValidPlate(p: string) {
  return /^\d{2} [A-Z] \d{3} [A-Z]{2}$/.test(p) || /^\d{2} \d{3} [A-Z]{3}$/.test(p);
}

export function normalizePlate(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

export function randomPlate(rng: RNG) {
  const L = () => PLATE_LETTERS[randInt(rng, 0, PLATE_LETTERS.length - 1)];
  const d3 = String(randInt(rng, 1, 999)).padStart(3, '0');
  return `${pick(rng, PLATE_REGIONS)} ${L()} ${d3} ${L()}${L()}`;
}

/** Traffic colour mix — Uzbek roads are famously white */
export const TRAFFIC_COLORS = ['#f2f2ef', '#f2f2ef', '#f2f2ef', '#f2f2ef', '#b8bcc2', '#b8bcc2', '#16181c', '#4a4f57', '#1f4e8c', '#a3201d', '#c9b48a'];
