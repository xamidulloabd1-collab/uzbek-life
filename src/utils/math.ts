export type RNG = () => number;

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const damp = (a: number, b: number, lambda: number, dt: number) =>
  lerp(a, b, 1 - Math.exp(-lambda * dt));
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

export function angleDiff(a: number, b: number) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export const dampAngle = (a: number, b: number, lambda: number, dt: number) =>
  a + angleDiff(a, b) * (1 - Math.exp(-lambda * dt));

export function mulberry32(seed: number): RNG {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = <T>(rng: RNG, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length) % arr.length];
export const rand = (rng: RNG, a: number, b: number) => a + (b - a) * rng();
export const randInt = (rng: RNG, a: number, b: number) => Math.floor(rand(rng, a, b + 1));

export const uid = () => Math.random().toString(36).slice(2, 10);

export const dist2 = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz);

const group = (n: number) => Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** 12 500 000 so'm */
export function formatSom(n: number) {
  return `${n < 0 ? '−' : ''}${group(n)} so‘m`;
}

/** 12,5 mln */
export function formatSomShort(n: number) {
  const a = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (a >= 1e9) return `${sign}${(a / 1e9).toFixed(a >= 1e10 ? 1 : 2).replace('.', ',')} mlrd`;
  if (a >= 1e6) return `${sign}${(a / 1e6).toFixed(a >= 1e8 ? 0 : 1).replace('.', ',')} mln`;
  if (a >= 1e3) return `${sign}${Math.round(a / 1e3)} ming`;
  return `${sign}${Math.round(a)}`;
}

export function formatTime(minutes: number) {
  const m = Math.floor(minutes) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function formatDistance(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(m)} m`;
}
