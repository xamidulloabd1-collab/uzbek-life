import type { Vec2 } from '@/types';
import { randomCurbPoint } from '@/game/world/cityLayout';

/** price / fare multipliers set by active world events */
export const eventMods = { food: 1, fare: 1, fuel: 1 };

export type EventKind = 'breakdown' | 'wallet' | 'sale' | 'wedding' | 'fuel-up' | 'fuel-down';
export interface WorldEvent { id: number; kind: EventKind; title: string; desc: string; until: number; pos?: Vec2; reward?: number }

const DEFS: Record<EventKind, { title: string; desc: string; minutes: number; reward?: number; place?: boolean }> = {
  breakdown: { title: 'Yo‘lda qolgan haydovchi', desc: 'Mashinasi buzilgan haydovchiga yordam bering (belgilangan joyga boring)', minutes: 180, reward: 120_000, place: true },
  wallet: { title: 'Yo‘qolgan hamyon', desc: 'Ko‘chada qolgan hamyonni topib, egasiga qaytaring', minutes: 240, reward: 80_000, place: true },
  sale: { title: 'Bozorda chegirma kuni', desc: 'Ovqat 30% arzon', minutes: 360 },
  wedding: { title: 'To‘y mavsumi', desc: 'Taksi buyurtmalari 50% qimmatroq to‘lanadi', minutes: 240 },
  'fuel-up': { title: 'Benzin qimmatladi', desc: 'Yoqilg‘i narxi +15%', minutes: 480 },
  'fuel-down': { title: 'Benzin arzonladi', desc: 'Yoqilg‘i narxi −15%', minutes: 480 },
};

/** random things happening in town: some need you to go somewhere, others change prices for a while */
export class WorldEvents {
  active: WorldEvent[] = [];
  private next = -1;
  private seq = 0;

  /** now = absolute game minutes; returns true when the list changed */
  update(now: number, player: Vec2, speedKmh: number, done: (e: WorldEvent) => void): boolean {
    let changed = false;
    if (this.next < 0) this.next = now + 45;
    const before = this.active.length;
    this.active = this.active.filter((e) => now <= e.until);
    if (this.active.length !== before) changed = true;
    for (const e of [...this.active]) {
      if (e.pos && Math.hypot(e.pos.x - player.x, e.pos.z - player.z) < 7 && speedKmh < 10) {
        this.active = this.active.filter((x) => x !== e);
        done(e);
        changed = true;
      }
    }
    if (now >= this.next && this.active.length < 2) {
      const kinds = (Object.keys(DEFS) as EventKind[]).filter((k) => !this.active.some((e) => e.kind === k || (k.startsWith('fuel') && e.kind.startsWith('fuel'))));
      const kind = kinds[Math.floor(Math.random() * kinds.length)];
      if (kind) {
        const d = DEFS[kind];
        const pos = d.place ? randomCurbPoint(Math.random, ['mahalla', 'apartments', 'downtown', 'village'], player, 120) : undefined;
        this.active.push({ id: ++this.seq, kind, title: d.title, desc: d.desc, until: now + d.minutes, pos, reward: d.reward });
        changed = true;
      }
      this.next = now + 120 + Math.random() * 180;
    }
    eventMods.food = this.active.some((e) => e.kind === 'sale') ? 0.7 : 1;
    eventMods.fare = this.active.some((e) => e.kind === 'wedding') ? 1.5 : 1;
    eventMods.fuel = this.active.some((e) => e.kind === 'fuel-up') ? 1.15 : this.active.some((e) => e.kind === 'fuel-down') ? 0.85 : 1;
    return changed;
  }
}
