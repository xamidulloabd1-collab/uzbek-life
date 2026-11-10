import { SITES } from '@/game/world/cityLayout';

export interface Achievement { id: string; name: string; desc: string; reward: number }

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-job', name: 'Birinchi daromad', desc: 'Istalgan ishni birinchi marta bajaring', reward: 50_000 },
  { id: 'taxi-10', name: 'Tajribali taksichi', desc: '10 ta taksi buyurtmasini bajaring', reward: 200_000 },
  { id: 'deliver-10', name: 'Ishonchli kuryer', desc: '10 ta yetkazib berish yoki kuryer ishini bajaring', reward: 200_000 },
  { id: 'cargo-5', name: 'Yuk tashuvchi', desc: '5 ta yuk tashish ishini bajaring', reward: 250_000 },
  { id: 'rich-10m', name: 'Birinchi 10 million', desc: 'Naqd va bankda jami 10 mln so‘m to‘plang', reward: 300_000 },
  { id: 'second-car', name: 'O‘z mashinam', desc: 'Avtosalondan mashina sotib oling', reward: 250_000 },
  { id: 'home', name: 'O‘z uyim', desc: 'Uy yoki kvartira sotib oling', reward: 500_000 },
  { id: 'business', name: 'Tadbirkor', desc: 'Biznes sotib oling (choyxona, avtoyuvish, supermarket)', reward: 800_000 },
  { id: 'night-driver', name: 'Tungi yo‘l', desc: 'Tunda 70 km/soatdan tez haydang', reward: 60_000 },
  { id: 'rain-driver', name: 'Yomg‘irda ham', desc: 'Yomg‘irli kunda mashina haydang', reward: 60_000 },
  { id: 'event-helper', name: 'Mahalla yordamchisi', desc: '3 ta tasodifiy voqeada yordam bering', reward: 150_000 },
  { id: 'explorer', name: 'G‘uzor sayyohi', desc: 'Barcha diqqatga sazovor joylarga boring', reward: 400_000 },
];

/** verified landmarks the player can discover (positions from the world model) */
export const LANDMARKS = SITES.filter((l) => l.site && ['mosque', 'mirijanda', 'hokimiyat', 'park', 'stadium', 'bazaar'].includes(l.site.kind)).map((l) => ({
  id: `visit-${l.site!.kind}`,
  name: l.site!.name,
  x: l.cx,
  z: l.cz,
}));

export const ALL_ACHIEVEMENTS: Achievement[] = [
  ...ACHIEVEMENTS,
  ...LANDMARKS.map((l) => ({ id: l.id, name: l.name, desc: 'Shu joyga boring', reward: 30_000 })),
];
export const ACH_MAP = Object.fromEntries(ALL_ACHIEVEMENTS.map((a) => [a.id, a]));
