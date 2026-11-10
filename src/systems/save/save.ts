import type { CargoItem, OwnedVehicle, Settings, Transaction, WeatherKind } from '@/types';
import { VEHICLE_MAP, isValidPlate } from '@/config/vehicles';
import { PROPERTY_MAP } from '@/config/properties';
import { PRESETS } from '@/config/graphics';
import { clamp } from '@/utils/math';

const SAVE_KEY = 'uzbek-life:save';
const SETTINGS_KEY = 'uzbek-life:settings';
export const SAVE_VERSION = 1;

export interface SaveData {
  version: number;
  savedAt: number;
  player: { x: number; z: number; heading: number };
  vehicleWorld: { uid: string; x: number; z: number; heading: number } | null;
  cash: number;
  bank: number;
  transactions: Transaction[];
  vehicles: OwnedVehicle[];
  activeVehicleUid: string | null;
  properties: string[];
  cargo: CargoItem[];
  jobStats: Record<string, number>;
  day: number;
  minutes: number;
  weather: WeatherKind;
  energy?: number;
  businessLevels?: Record<string, number>;
  achievements?: string[];
  wardrobe?: string[];
  outfit?: { hat: string; glasses: boolean };
}

const num = (v: unknown, fallback: number, min = -Infinity, max = Infinity) =>
  typeof v === 'number' && Number.isFinite(v) ? clamp(v, min, max) : fallback;
const str = (v: unknown, fallback: string) => (typeof v === 'string' ? v.slice(0, 120) : fallback);
const LIMIT = 1e9 * 1000;

function validVehicle(v: unknown): OwnedVehicle | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const specId = str(o.specId, '');
  const spec = VEHICLE_MAP[specId];
  if (!spec) return null;
  const plate = str(o.plate, '70 A 000 AA');
  return {
    uid: str(o.uid, Math.random().toString(36).slice(2)),
    specId,
    color: /^#[0-9a-f]{6}$/i.test(str(o.color, '')) ? (o.color as string) : spec.defaultColor,
    wheels: Math.round(num(o.wheels, 0, 0, 3)),
    tint: Math.round(num(o.tint, 0, 0, 2)),
    plate: isValidPlate(plate) ? plate : '70 A 000 AA',
    engine: Math.round(num(o.engine, 0, 0, 3)),
    handling: Math.round(num(o.handling, 0, 0, 3)),
    health: num(o.health, 100, 0, 100),
    fuel: num(o.fuel, spec.perf.fuelCapacity, 0, spec.perf.fuelCapacity),
  };
}

export function validateSave(raw: unknown): SaveData | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const version = num(o.version, 0);
  if (version < 1 || version > SAVE_VERSION) return null; // future: migrations go here
  const p = (o.player ?? {}) as Record<string, unknown>;
  const vehicles = (Array.isArray(o.vehicles) ? o.vehicles : []).map(validVehicle).filter((v): v is OwnedVehicle => !!v);
  const vw = o.vehicleWorld as Record<string, unknown> | null;
  const activeUid = typeof o.activeVehicleUid === 'string' && vehicles.some((v) => v.uid === o.activeVehicleUid) ? o.activeVehicleUid : vehicles[0]?.uid ?? null;
  return {
    version: SAVE_VERSION,
    savedAt: num(o.savedAt, Date.now()),
    player: { x: num(p.x, 0, -4000, 4000), z: num(p.z, 0, -4000, 4000), heading: num(p.heading, 0) },
    vehicleWorld:
      vw && typeof vw === 'object' && typeof vw.uid === 'string'
        ? { uid: vw.uid, x: num(vw.x, 0, -4000, 4000), z: num(vw.z, 0, -4000, 4000), heading: num(vw.heading, 0) }
        : null,
    cash: num(o.cash, 0, 0, LIMIT),
    bank: num(o.bank, 0, 0, LIMIT),
    transactions: (Array.isArray(o.transactions) ? o.transactions : [])
      .slice(0, 60)
      .filter((t): t is Transaction => !!t && typeof (t as Transaction).amount === 'number')
      .map((t) => ({ id: str(t.id, '0'), day: num(t.day, 1), minutes: num(t.minutes, 0), amount: num(t.amount, 0, -LIMIT, LIMIT), label: str(t.label, '') })),
    vehicles,
    activeVehicleUid: activeUid,
    properties: (Array.isArray(o.properties) ? o.properties : []).filter((id): id is string => typeof id === 'string' && !!PROPERTY_MAP[id]),
    cargo: (Array.isArray(o.cargo) ? o.cargo : [])
      .filter((c): c is CargoItem => !!c && typeof (c as CargoItem).id === 'string')
      .map((c) => ({ id: str(c.id, ''), name: str(c.name, ''), qty: Math.round(num(c.qty, 1, 0, 99)) })),
    jobStats: Object.fromEntries(
      Object.entries((o.jobStats as Record<string, unknown>) ?? {}).map(([k, v]) => [k.slice(0, 20), Math.round(num(v, 0, 0, 1e6))]),
    ),
    day: Math.round(num(o.day, 1, 1, 1e5)),
    minutes: num(o.minutes, 510, 0, 1439),
    weather: o.weather === 'rain' || o.weather === 'cloudy' || o.weather === 'fog' ? o.weather : 'clear',
    energy: num(o.energy, 100, 0, 100),
    wardrobe: (Array.isArray(o.wardrobe) ? o.wardrobe : []).filter((x): x is string => typeof x === 'string').slice(0, 50),
    outfit: { hat: typeof (o.outfit as Record<string, unknown>)?.hat === 'string' ? String((o.outfit as Record<string, unknown>).hat) : 'none', glasses: !!(o.outfit as Record<string, unknown>)?.glasses },
    achievements: (Array.isArray(o.achievements) ? o.achievements : []).filter((x): x is string => typeof x === 'string').slice(0, 100),
    businessLevels: Object.fromEntries(Object.entries((o.businessLevels as Record<string, unknown>) ?? {}).filter(([k]) => !!PROPERTY_MAP[k]).map(([k, v]) => [k, Math.round(num(v, 0, 0, 3))])),
  };
}

export function writeSave(data: SaveData): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function readSave(): SaveData | null {
  try {
    const s = localStorage.getItem(SAVE_KEY);
    return s ? validateSave(JSON.parse(s)) : null;
  } catch {
    return null;
  }
}

export function hasSave() {
  return readSave() !== null;
}

export function deleteSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function readSettings(): Settings | null {
  try {
    const s = localStorage.getItem(SETTINGS_KEY);
    if (!s) return null;
    const o = JSON.parse(s) as Partial<Settings>;
    if (!o.preset || !PRESETS[o.preset]) return null;
    return {
      preset: o.preset,
      resolutionScale: num(o.resolutionScale, 1, 0.4, 1),
      shadows: Math.round(num(o.shadows, 1, 0, 3)),
      renderDistance: num(o.renderDistance, 400, 150, 900),
      antialias: o.antialias === true,
      showFps: o.showFps === true,
      trafficDensity: num(o.trafficDensity, 0.6, 0, 1),
      pedestrianDensity: num(o.pedestrianDensity, 0.6, 0, 1),
      mouseSensitivity: num(o.mouseSensitivity, 1, 0.2, 3),
      invertY: o.invertY === true,
      volume: num(o.volume, 0.7, 0, 1),
      dynamicResolution: o.dynamicResolution === true,
      touchButtonScale: num(o.touchButtonScale, 1, 0.7, 1.4),
      autoQuality: o.autoQuality !== false,
    };
  } catch {
    return null;
  }
}

export function writeSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable */
  }
}
