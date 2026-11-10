import type { ActiveMission, MissionStep, Vec2 } from '@/types';
import { useGame } from '@/stores/gameStore';
import { ECONOMY } from '@/config/economy';
import { VEHICLE_MAP } from '@/config/vehicles';
import { SITES, poiOf, randomCurbPoint } from '@/game/world/cityLayout';
import { eventMods } from '@/systems/events/worldEvents';
import { frameToWorld } from '@/game/world/guzor/network';
import { earn } from '@/systems/economy/economy';
import { formatSom, pick, rand } from '@/utils/math';

export interface JobDef {
  id: string;
  name: string;
  description: string;
  pay: string;
  requireVehicle: boolean;
  glyph: string;
}

export const JOBS: JobDef[] = [
  { id: 'taxi', name: 'Taksi haydovchisi', description: 'Yo‘lovchini oling va manziliga eltib qo‘ying. Qimmatroq mashina — qimmatroq yo‘l haqi.', pay: 'Masofaga qarab', requireVehicle: true, glyph: 'T' },
  { id: 'delivery', name: 'Ovqat yetkazish', description: 'Osh markazidan issiq oshni olib, mijozga sovutmasdan yetkazing.', pay: 'Masofa + choychaqa', requireVehicle: false, glyph: 'O' },
  { id: 'courier', name: 'Kuryer', description: 'Pochta omboridan uchta posilka olib, shahar bo‘ylab tarqating.', pay: 'Har posilka uchun', requireVehicle: false, glyph: 'P' },
  { id: 'mechanic', name: 'Mexanik', description: 'Avtoservisdan asboblarni olib, yo‘lda qolgan mashinani tuzating.', pay: 'Har buyurtma uchun', requireVehicle: false, glyph: 'M' },
  { id: 'farmer', name: 'Fermer', description: 'Fermer xo‘jaligida hosil yig‘ib, dehqon bozoriga topshiring.', pay: 'Hosil uchun', requireVehicle: false, glyph: 'F' },
  { id: 'cargo', name: 'Yuk tashish', description: 'Pochta omboridan katta yukni qishloq yoki sanoat zonasiga yetkazing. Karvon bilan +40%.', pay: 'Masofaga qarab', requireVehicle: true, glyph: 'Y' },
  { id: 'workshop', name: 'Ustaxona xodimi', description: 'Avtoservisda smena: uchta mashinani ko‘rikdan o‘tkazing.', pay: 'Smena uchun', requireVehicle: false, glyph: 'U' },
  { id: 'business', name: 'Biznes egasi', description: 'Tijorat binosini sotib oling — u har kuni bank hisobingizga daromad keltiradi.', pay: 'Har kuni', requireVehicle: false, glyph: 'B' },
];

const NAMES = ['Dilnoza opa', 'Sherzod aka', 'Malika', 'Jasur', 'Gulnora xola', 'Bobur', 'Nodira', 'Rustam aka', 'Shahnoza', 'Otabek', 'Feruza', 'Sanjar'];
const len = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);

function fieldPoints(count: number): Vec2[] {
  // inside the farm site (local frame: street on the north side, fields towards the back)
  const L = SITES.find((l) => l.site?.kind === 'farm')!;
  const pts: Vec2[] = [];
  for (let n = 0; n < count; n++) pts.push(frameToWorld(L.ox, L.oz, L.rot, rand(Math.random, 8, 68), rand(Math.random, 56, 72)));
  return pts;
}

export function startJob(jobId: string, ctx: { pos: Vec2; inVehicle: boolean; vehicleSpecId: string | null }): boolean {
  const s = useGame.getState();
  const job = JOBS.find((j) => j.id === jobId);
  if (!job || jobId === 'business') return false;
  if (s.mission) {
    s.notify('Avval joriy ishni yakunlang yoki bekor qiling', 'bad');
    return false;
  }
  if (job.requireVehicle && !ctx.vehicleSpecId) {
    s.notify('Bu ish uchun mashina kerak', 'bad');
    return false;
  }
  const rng = Math.random;
  const J = ECONOMY.jobs;
  let steps: MissionStep[] = [];
  let reward = 0;
  let title = job.name;

  if (jobId === 'taxi') {
    const name = pick(rng, NAMES);
    const a = randomCurbPoint(rng, undefined, ctx.pos, 120);
    const b = randomCurbPoint(rng, undefined, a, 320);
    const factor = VEHICLE_MAP[ctx.vehicleSpecId ?? 'lola']?.fareFactor ?? 1;
    reward = Math.round(((J.taxiBase + J.taxiPerMeter * len(a, b)) * factor * eventMods.fare) / 1000) * 1000;
    title = `Taksi: ${name}`;
    steps = [
      { label: `${name}ni olib keting`, pos: a, radius: 6, kind: 'pickup', hold: 2, requireVehicle: true, giveItem: 'yolovchi' },
      { label: `${name}ni manziliga eltib qo‘ying`, pos: b, radius: 6, kind: 'dropoff', hold: 1.5, requireVehicle: true, takeItem: 'yolovchi' },
    ];
  } else if (jobId === 'delivery') {
    const shop = poiOf('osh').pos;
    const b = randomCurbPoint(rng, ['mahalla', 'apartments', 'downtown'], shop, 250);
    reward = Math.round((J.deliveryBase + J.deliveryPerMeter * len(shop, b)) / 1000) * 1000;
    title = `Yetkazish: ${pick(rng, NAMES)}ga osh`;
    steps = [
      { label: 'Osh markazidan buyurtmani oling', pos: shop, radius: 5, kind: 'pickup', hold: 2, giveItem: 'osh' },
      { label: 'Oshni mijozga yetkazing', pos: b, radius: 6, kind: 'dropoff', hold: 1.5, takeItem: 'osh' },
    ];
  } else if (jobId === 'courier') {
    const wh = poiOf('warehouse').pos;
    const drops = [randomCurbPoint(rng, undefined, wh, 200)];
    drops.push(randomCurbPoint(rng, undefined, drops[0], 200));
    drops.push(randomCurbPoint(rng, undefined, drops[1], 200));
    reward = J.courierPerDrop * 3 + Math.round((len(wh, drops[0]) + len(drops[0], drops[1]) + len(drops[1], drops[2])) * 25 / 1000) * 1000;
    title = 'Kuryer: 3 ta posilka';
    steps = [
      { label: 'Ombordan posilkalarni oling', pos: wh, radius: 5, kind: 'pickup', hold: 2.5, giveItem: 'posilka' },
      ...drops.map((p, n) => ({ label: `${n + 1}-posilkani topshiring`, pos: p, radius: 6, kind: 'dropoff' as const, hold: 1.2, takeItem: 'posilka' })),
    ];
  } else if (jobId === 'mechanic') {
    const shop = poiOf('service').pos;
    const p = randomCurbPoint(rng, undefined, shop, 220);
    reward = J.mechanicFix;
    title = 'Mexanik: yo‘lda qolgan mashina';
    steps = [
      { label: 'Avtoservisdan asboblarni oling', pos: shop, radius: 7, kind: 'pickup', hold: 2, giveItem: 'asboblar' },
      { label: 'Mashinani tuzating (piyoda turing)', pos: p, radius: 4, kind: 'work', hold: 6, requireOnFoot: true, takeItem: 'asboblar', prop: 'brokenCar' },
    ];
  } else if (jobId === 'cargo') {
    const wh = poiOf('warehouse').pos;
    const b = randomCurbPoint(rng, ['village', 'industrial'], wh, 350);
    const factor = ctx.vehicleSpecId === 'karvon' ? 1.4 : 1;
    reward = Math.round(((J.cargoPerMeter * len(wh, b)) * factor) / 1000) * 1000 + 60_000;
    title = 'Yuk tashish: ombor → mijoz';
    steps = [
      { label: 'Ombordan yukni oling', pos: wh, radius: 7, kind: 'pickup', hold: 3, requireVehicle: true, giveItem: 'yuk' },
      { label: 'Yukni manzilga yetkazing', pos: b, radius: 7, kind: 'dropoff', hold: 3, requireVehicle: true, takeItem: 'yuk' },
    ];
  } else if (jobId === 'workshop') {
    const shop = poiOf('service').pos;
    reward = J.workshopShift;
    title = 'Ustaxona: smena';
    steps = [
      { label: 'Avtoservisga keling', pos: shop, radius: 7, kind: 'pickup', hold: 1.5 },
      ...[-6, 0, 6].map((dx, n) => ({ label: `${n + 1}-mashinani ko‘rikdan o‘tkazing`, pos: { x: shop.x + dx, z: shop.z - 12 }, radius: 3, kind: 'work' as const, hold: 4, requireOnFoot: true })),
    ];
  } else if (jobId === 'farmer') {
    const farm = poiOf('farm').pos;
    const bazaar = poiOf('bazaar').pos;
    reward = J.farmerHarvest;
    title = 'Fermer: hosil yig‘ish';
    steps = [
      { label: 'Fermer xo‘jaligiga boring', pos: farm, radius: 5, kind: 'pickup', hold: 1.5 },
      ...fieldPoints(4).map((p, n) => ({ label: `Hosil yig‘ing (${n + 1}/4)`, pos: p, radius: 3, kind: 'work' as const, hold: 2.5, requireOnFoot: true, giveItem: 'hosil' })),
      { label: 'Hosilni dehqon bozoriga topshiring', pos: bazaar, radius: 6, kind: 'dropoff', hold: 2, takeItem: 'hosil' },
    ];
  }

  const mission: ActiveMission = { jobId, title, steps, stepIndex: 0, reward, startedAt: performance.now(), progress: 0 };
  useGame.setState({ mission, panel: null });
  s.notify(`Yangi ish: ${title} · ${formatSom(reward)}`, 'info');
  return true;
}

export function cancelMission() {
  const s = useGame.getState();
  if (!s.mission) return;
  const keep = s.cargo.filter((c) => !['yolovchi', 'osh', 'posilka', 'asboblar', 'hosil', 'yuk'].includes(c.id));
  useGame.setState({ mission: null, cargo: keep });
  s.notify('Ish bekor qilindi', 'bad');
}

const ITEM_NAMES: Record<string, string> = {
  yolovchi: 'Yo‘lovchi',
  osh: 'Issiq osh',
  posilka: 'Posilka',
  asboblar: 'Mexanik asboblari',
  hosil: 'Hosil qopi',
  yuk: 'Katta yuk',
};

function addItem(id: string, qty: number) {
  const cargo = [...useGame.getState().cargo];
  const it = cargo.find((c) => c.id === id);
  if (it) it.qty += qty;
  else cargo.push({ id, name: ITEM_NAMES[id] ?? id, qty });
  useGame.setState({ cargo });
}

function takeItem(id: string, all: boolean) {
  const cargo = useGame
    .getState()
    .cargo.map((c) => (c.id === id ? { ...c, qty: all ? 0 : c.qty - 1 } : c))
    .filter((c) => c.qty > 0);
  useGame.setState({ cargo });
}

export interface MissionTick {
  distance: number;
  target: Vec2;
  holdRatio: number;
  blocked: string | null;
}

/** advance the active mission; returns HUD info */
export function updateMission(dt: number, ctx: { pos: Vec2; inVehicle: boolean; speedKmh: number }): MissionTick | null {
  const s = useGame.getState();
  const m = s.mission;
  if (!m) return null;
  const step = m.steps[m.stepIndex];
  const distance = len(ctx.pos, step.pos);
  let blocked: string | null = null;
  if (distance <= step.radius) {
    if (step.requireVehicle && !ctx.inVehicle) blocked = 'Mashinada bo‘lishingiz kerak';
    else if (step.requireOnFoot && ctx.inVehicle) blocked = 'Mashinadan tushing';
    else if (ctx.inVehicle && ctx.speedKmh > 6) blocked = 'To‘xtang';
  }
  const inside = distance <= step.radius && !blocked;
  let progress = inside ? m.progress + dt : Math.max(0, m.progress - dt * 2);

  if (progress >= step.hold) {
    if (step.giveItem) addItem(step.giveItem, step.giveItem === 'posilka' ? 3 : 1);
    if (step.takeItem) takeItem(step.takeItem, step.takeItem === 'hosil');
    const next = m.stepIndex + 1;
    if (next >= m.steps.length) {
      const minutes = (performance.now() - m.startedAt) / 60000;
      const quick = minutes < 2 + m.steps.length * 0.8;
      const bonus = quick ? Math.round((m.reward * ECONOMY.jobs.speedBonus) / 1000) * 1000 : 0;
      earn(m.reward + bonus, m.title);
      useGame.setState({ mission: null, jobStats: { ...s.jobStats, [m.jobId]: (s.jobStats[m.jobId] ?? 0) + 1 } });
      s.notify(`Ish bajarildi: +${formatSom(m.reward + bonus)}${bonus ? ' (tezlik uchun bonus)' : ''}`, 'good');
      return null;
    }
    s.notify(m.steps[next].label, 'info');
    useGame.setState({ mission: { ...m, stepIndex: next, progress: 0 } });
    return { distance: len(ctx.pos, m.steps[next].pos), target: m.steps[next].pos, holdRatio: 0, blocked: null };
  }
  if (progress !== m.progress) {
    progress = Math.max(0, progress);
    useGame.setState({ mission: { ...m, progress } });
  }
  return { distance, target: step.pos, holdRatio: progress / step.hold, blocked };
}

if (typeof window !== 'undefined') (window as unknown as { __startJob: typeof startJob }).__startJob = startJob;
