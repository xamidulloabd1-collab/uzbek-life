import type { OwnedVehicle } from '@/types';
import { useGame } from '@/stores/gameStore';
import { VEHICLE_MAP, isValidPlate, normalizePlate, randomPlate } from '@/config/vehicles';
import { ECONOMY } from '@/config/economy';
import { earn, spend } from '@/systems/economy/economy';
import { formatSom, uid } from '@/utils/math';

/** The game registers `pull` so services always work with live fuel/health values */
export const vehicleBridge: { pull: () => void; callToPlayer: () => boolean } = {
  pull: () => {},
  callToPlayer: () => false,
};

const get = (vuid: string) => useGame.getState().vehicles.find((v) => v.uid === vuid);

function patch(vuid: string, p: Partial<OwnedVehicle>) {
  useGame.setState({ vehicles: useGame.getState().vehicles.map((v) => (v.uid === vuid ? { ...v, ...p } : v)) });
}

export function createOwned(specId: string, color?: string, plate?: string): OwnedVehicle {
  const spec = VEHICLE_MAP[specId];
  return {
    uid: uid(),
    specId,
    color: color ?? spec.defaultColor,
    wheels: 0,
    tint: 0,
    plate: plate ?? randomPlate(Math.random),
    engine: 0,
    handling: 0,
    health: 100,
    fuel: spec.perf.fuelCapacity * 0.6,
  };
}

export function buyVehicle(specId: string, color: string): OwnedVehicle | null {
  const spec = VEHICLE_MAP[specId];
  if (!spec) return null;
  if (!spend(spec.price, `Avtosalon: ${spec.name}`, 'bank')) return null;
  vehicleBridge.pull();
  const v = createOwned(specId, color);
  useGame.setState({ vehicles: [...useGame.getState().vehicles, v], activeVehicleUid: v.uid });
  useGame.getState().notify(`${spec.name} sizniki! Avtosalon oldida turibdi.`, 'good');
  return v;
}

export function sellPrice(v: OwnedVehicle) {
  const spec = VEHICLE_MAP[v.specId];
  const upgrades = ECONOMY.engineUpgrade[v.engine] + ECONOMY.handlingUpgrade[v.handling];
  return Math.round((spec.price + upgrades * 0.5) * ECONOMY.sellRatio * (0.55 + 0.45 * (v.health / 100)));
}

export function sellVehicle(vuid: string): boolean {
  vehicleBridge.pull();
  const v = get(vuid);
  if (!v) return false;
  const price = sellPrice(v);
  const s = useGame.getState();
  const rest = s.vehicles.filter((x) => x.uid !== vuid);
  useGame.setState({ vehicles: rest, activeVehicleUid: s.activeVehicleUid === vuid ? rest[0]?.uid ?? null : s.activeVehicleUid });
  earn(price, `Sotildi: ${VEHICLE_MAP[v.specId].name}`, 'bank');
  s.notify(`${VEHICLE_MAP[v.specId].name} ${formatSom(price)} ga sotildi`, 'good');
  return true;
}

export function setActiveVehicle(vuid: string) {
  vehicleBridge.pull();
  if (get(vuid)) useGame.setState({ activeVehicleUid: vuid });
}

function paid(vuid: string, cost: number, label: string, p: Partial<OwnedVehicle>) {
  vehicleBridge.pull();
  if (!get(vuid)) return false;
  if (cost > 0 && !spend(cost, label)) return false;
  patch(vuid, p);
  return true;
}

export const paintVehicle = (vuid: string, color: string) => paid(vuid, ECONOMY.paint, 'Garaj: bo‘yash', { color });
export const setWheels = (vuid: string, wheels: number) => paid(vuid, ECONOMY.wheels[wheels] ?? 0, 'Garaj: g‘ildiraklar', { wheels });
export const setTint = (vuid: string, tint: number) => paid(vuid, tint === 0 ? 0 : ECONOMY.tint, 'Garaj: tonirovka', { tint });

export function setPlate(vuid: string, raw: string): string | null {
  const plate = normalizePlate(raw);
  if (!isValidPlate(plate)) return 'Format: 70 A 123 BC yoki 70 123 ABC';
  if (useGame.getState().vehicles.some((v) => v.plate === plate && v.uid !== vuid)) return 'Bu raqam allaqachon band';
  return paid(vuid, ECONOMY.customPlate, 'YHXB: davlat raqami', { plate }) ? null : 'Mablag‘ yetarli emas';
}

export function upgradeCost(v: OwnedVehicle, kind: 'engine' | 'handling') {
  const table = kind === 'engine' ? ECONOMY.engineUpgrade : ECONOMY.handlingUpgrade;
  const next = v[kind] + 1;
  return next < table.length ? table[next] : null;
}

export function upgrade(vuid: string, kind: 'engine' | 'handling') {
  const v = get(vuid);
  if (!v) return false;
  const cost = upgradeCost(v, kind);
  if (cost === null) return false;
  return paid(vuid, cost, kind === 'engine' ? 'Tuning: dvigatel' : 'Tuning: boshqaruv', { [kind]: v[kind] + 1 });
}

export function repairCost(v: OwnedVehicle) {
  return Math.round((100 - v.health) * ECONOMY.repairPerPoint);
}

export function repair(vuid: string) {
  vehicleBridge.pull();
  const v = get(vuid);
  if (!v || v.health >= 99.5) return false;
  return paid(vuid, repairCost(v), 'Avtoservis: ta’mir', { health: 100 });
}

export function refuel(vuid: string): boolean {
  vehicleBridge.pull();
  const v = get(vuid);
  if (!v) return false;
  const spec = VEHICLE_MAP[v.specId];
  const s = useGame.getState();
  const need = spec.perf.fuelCapacity - v.fuel;
  if (need < 0.5) {
    s.notify('Bak to‘la', 'info');
    return false;
  }
  const affordable = Math.min(need, (s.cash + s.bank) / ECONOMY.fuelPricePerLiter);
  if (affordable < 0.5) {
    s.notify('Yoqilg‘i uchun pul yetarli emas', 'bad');
    return false;
  }
  const cost = Math.round(affordable * ECONOMY.fuelPricePerLiter);
  if (!spend(cost, `AYOQSH: ${affordable.toFixed(1)} l`)) return false;
  patch(vuid, { fuel: v.fuel + affordable });
  s.notify(`${affordable.toFixed(1)} litr quyildi · ${formatSom(cost)}`, 'good');
  return true;
}

export function callVehicle(): boolean {
  const s = useGame.getState();
  if (!s.activeVehicleUid) {
    s.notify('Sizda mashina yo‘q', 'bad');
    return false;
  }
  if (!spend(ECONOMY.vehicleDelivery, 'Mashinani yetkazish xizmati')) return false;
  if (!vehicleBridge.callToPlayer()) {
    earn(ECONOMY.vehicleDelivery, 'Yetkazish bekor qilindi');
    s.notify('Hozir mashinani keltirib bo‘lmaydi (avval mashinadan tushing)', 'bad');
    return false;
  }
  s.notify('Mashinangiz yoningizga keltirildi', 'good');
  return true;
}
