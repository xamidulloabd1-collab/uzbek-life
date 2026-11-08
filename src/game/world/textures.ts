import * as THREE from 'three';
import { mulberry32, pick, type RNG } from '@/utils/math';

type G = CanvasRenderingContext2D;

function canvas(w: number, h: number): [HTMLCanvasElement, G] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function toTex(c: HTMLCanvasElement, srgb = true, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

function noise(g: G, w: number, h: number, amount: number, rng: RNG) {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng() - 0.5) * amount;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

function speckle(g: G, w: number, h: number, count: number, colors: string[], size: number, rng: RNG) {
  for (let n = 0; n < count; n++) {
    g.fillStyle = pick(rng, colors);
    const s = size * (0.4 + rng());
    g.fillRect(rng() * w, rng() * h, s, s);
  }
}

export interface FacadeTex {
  map: THREE.Texture;
  emissive: THREE.Texture;
  /** metres covered by one texture tile (width, height) */
  tile: [number, number];
}

export class TextureLib {
  readonly S: number;
  private cache = new Map<string, THREE.Texture>();
  private facades = new Map<string, FacadeTex>();

  constructor(size: number) {
    this.S = size;
  }

  private memo(key: string, make: () => THREE.Texture) {
    let t = this.cache.get(key);
    if (!t) this.cache.set(key, (t = make()));
    return t;
  }

  // ---------------- ground ----------------
  road() {
    return this.memo('road', () => {
      const S = this.S;
      const [c, g] = canvas(S, S);
      const rng = mulberry32(11);
      g.fillStyle = '#3a3c3f';
      g.fillRect(0, 0, S, S);
      noise(g, S, S, 22, rng);
      speckle(g, S, S, S * 2, ['#2f3134', '#4a4c4f', '#454340'], S / 256, rng);
      // tyre wear along the lanes
      g.fillStyle = 'rgba(20,20,22,0.18)';
      for (const u of [0.24, 0.34, 0.66, 0.76]) g.fillRect(u * S - S * 0.03, 0, S * 0.06, S);
      const px = (m: number) => (m / 14) * S;
      g.fillStyle = '#e8e6df';
      g.fillRect(px(0.7), 0, px(0.14), S);
      g.fillRect(S - px(0.84), 0, px(0.14), S);
      g.fillRect(S / 2 - px(0.07), 0, px(0.14), S * 0.35);
      // worn paint
      g.globalCompositeOperation = 'multiply';
      speckle(g, S, S, S, ['#8a8a8a', '#666'], S / 200, rng);
      g.globalCompositeOperation = 'source-over';
      return toTex(c);
    });
  }

  asphalt() {
    return this.memo('asphalt', () => {
      const S = this.S;
      const [c, g] = canvas(S, S);
      const rng = mulberry32(12);
      g.fillStyle = '#3d3f42';
      g.fillRect(0, 0, S, S);
      noise(g, S, S, 24, rng);
      speckle(g, S, S, S * 2, ['#323437', '#4b4d50'], S / 256, rng);
      // patches
      for (let n = 0; n < 4; n++) {
        g.fillStyle = `rgba(30,31,33,${0.25 + rng() * 0.2})`;
        g.fillRect(rng() * S, rng() * S, S * (0.1 + rng() * 0.2), S * (0.08 + rng() * 0.15));
      }
      return toTex(c);
    });
  }

  rural() {
    return this.memo('rural', () => {
      const S = this.S;
      const [c, g] = canvas(S, S);
      const rng = mulberry32(13);
      g.fillStyle = '#5b5852';
      g.fillRect(0, 0, S, S);
      noise(g, S, S, 30, rng);
      // dusty edges
      const grd = g.createLinearGradient(0, 0, S, 0);
      grd.addColorStop(0, 'rgba(150,130,95,0.9)');
      grd.addColorStop(0.1, 'rgba(150,130,95,0)');
      grd.addColorStop(0.9, 'rgba(150,130,95,0)');
      grd.addColorStop(1, 'rgba(150,130,95,0.9)');
      g.fillStyle = grd;
      g.fillRect(0, 0, S, S);
      g.strokeStyle = 'rgba(25,25,25,0.55)';
      g.lineWidth = Math.max(1, S / 256);
      for (let n = 0; n < 7; n++) {
        g.beginPath();
        let x = rng() * S, y = rng() * S;
        g.moveTo(x, y);
        for (let k = 0; k < 6; k++) {
          x += (rng() - 0.5) * S * 0.15;
          y += rng() * S * 0.12;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      return toTex(c);
    });
  }

  zebra() {
    return this.memo('zebra', () => {
      const S = this.S;
      const [c, g] = canvas(S, S / 4);
      g.clearRect(0, 0, S, S / 4);
      g.fillStyle = '#ecebe5';
      for (let n = 0; n < 7; n++) g.fillRect((n / 7) * S + S * 0.02, 0, S * 0.08, S / 4);
      return toTex(c, true, false);
    });
  }

  pavers() {
    return this.memo('pavers', () => {
      const S = this.S;
      const [c, g] = canvas(S, S);
      const rng = mulberry32(14);
      g.fillStyle = '#7f7a72';
      g.fillRect(0, 0, S, S);
      const rows = 16;
      const h = S / rows;
      for (let r = 0; r < rows; r++) {
        const w = h * 2;
        const off = (r % 2) * h;
        for (let x = -off; x < S; x += w) {
          const t = 150 + Math.floor(rng() * 30);
          g.fillStyle = `rgb(${t + 12},${t + 6},${t - 4})`;
          g.fillRect(x + 1, r * h + 1, w - 2, h - 2);
        }
      }
      noise(g, S, S, 16, rng);
      return toTex(c);
    });
  }

  plaza() {
    return this.memo('plaza', () => {
      const S = this.S;
      const [c, g] = canvas(S, S);
      const rng = mulberry32(15);
      g.fillStyle = '#c9bfae';
      g.fillRect(0, 0, S, S);
      g.strokeStyle = '#9d9283';
      g.lineWidth = Math.max(1, S / 200);
      for (let k = 0; k <= 4; k++) {
        g.beginPath(); g.moveTo((k * S) / 4, 0); g.lineTo((k * S) / 4, S); g.stroke();
        g.beginPath(); g.moveTo(0, (k * S) / 4); g.lineTo(S, (k * S) / 4); g.stroke();
      }
      // eight-point star inlay
      g.fillStyle = '#8a6a4a';
      const star = (cx: number, cy: number, r: number) => {
        g.beginPath();
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          const rr = i % 2 ? r * 0.55 : r;
          g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        }
        g.closePath();
        g.fill();
      };
      star(S / 2, S / 2, S * 0.12);
      noise(g, S, S, 14, rng);
      return toTex(c);
    });
  }

  grass() {
    return this.memo('grass', () => {
      const S = this.S;
      const [c, g] = canvas(S, S);
      const rng = mulberry32(16);
      g.fillStyle = '#4f6b34';
      g.fillRect(0, 0, S, S);
      speckle(g, S, S, S * 6, ['#5a7a3a', '#435d2c', '#62823f', '#3d5428'], S / 128, rng);
      noise(g, S, S, 18, rng);
      return toTex(c);
    });
  }

  steppe() {
    return this.memo('steppe', () => {
      const S = this.S;
      const [c, g] = canvas(S, S);
      const rng = mulberry32(17);
      g.fillStyle = '#a99467';
      g.fillRect(0, 0, S, S);
      speckle(g, S, S, S * 5, ['#9b865b', '#b5a074', '#8f7d55', '#a0905f'], S / 96, rng);
      speckle(g, S, S, S / 2, ['#6e7444', '#7c7f4b'], S / 64, rng);
      noise(g, S, S, 16, rng);
      return toTex(c);
    });
  }

  field(kind: 'cotton' | 'wheat') {
    return this.memo('field-' + kind, () => {
      const S = this.S;
      const [c, g] = canvas(S, S);
      const rng = mulberry32(kind === 'cotton' ? 18 : 19);
      g.fillStyle = kind === 'cotton' ? '#6a5236' : '#8b7546';
      g.fillRect(0, 0, S, S);
      noise(g, S, S, 20, rng);
      const rows = 8;
      for (let r = 0; r < rows; r++) {
        const x = (r + 0.5) * (S / rows);
        g.fillStyle = kind === 'cotton' ? '#4a6a2e' : '#c8a64e';
        g.fillRect(x - S / 40, 0, S / 20, S);
      }
      if (kind === 'cotton') {
        for (let r = 0; r < rows; r++) {
          const x = (r + 0.5) * (S / rows);
          for (let n = 0; n < 24; n++) {
            g.fillStyle = '#efede6';
            g.fillRect(x - S / 50 + rng() * (S / 25), rng() * S, S / 110 + 1, S / 110 + 1);
          }
        }
      }
      return toTex(c);
    });
  }

  roof() {
    return this.memo('roof', () => {
      const S = this.S / 2;
      const [c, g] = canvas(S, S);
      const rng = mulberry32(20);
      g.fillStyle = '#5b5a57';
      g.fillRect(0, 0, S, S);
      noise(g, S, S, 30, rng);
      return toTex(c);
    });
  }

  tin(color: string) {
    return this.memo('tin-' + color, () => {
      const S = this.S / 2;
      const [c, g] = canvas(S, S);
      g.fillStyle = color;
      g.fillRect(0, 0, S, S);
      for (let k = 0; k < 8; k++) {
        const x = (k / 8) * S;
        const grd = g.createLinearGradient(x, 0, x + S / 8, 0);
        grd.addColorStop(0, 'rgba(255,255,255,0.18)');
        grd.addColorStop(0.5, 'rgba(0,0,0,0.15)');
        grd.addColorStop(1, 'rgba(255,255,255,0.18)');
        g.fillStyle = grd;
        g.fillRect(x, 0, S / 8, S);
      }
      noise(g, S, S, 10, mulberry32(21));
      return toTex(c);
    });
  }

  corrugated(color: string) {
    return this.memo('corr-' + color, () => {
      const S = this.S;
      const [c, g] = canvas(S, S);
      g.fillStyle = color;
      g.fillRect(0, 0, S, S);
      for (let k = 0; k < 24; k++) {
        const x = (k / 24) * S;
        g.fillStyle = 'rgba(0,0,0,0.16)';
        g.fillRect(x, 0, S / 48, S);
        g.fillStyle = 'rgba(255,255,255,0.08)';
        g.fillRect(x + S / 48, 0, S / 96, S);
      }
      const grd = g.createLinearGradient(0, S * 0.7, 0, S);
      grd.addColorStop(0, 'rgba(90,60,30,0)');
      grd.addColorStop(1, 'rgba(90,60,30,0.35)');
      g.fillStyle = grd;
      g.fillRect(0, 0, S, S);
      noise(g, S, S, 12, mulberry32(22));
      return toTex(c);
    });
  }

  wallPlaster(color = '#d9cdb5') {
    return this.memo('plaster-' + color, () => {
      const S = this.S;
      const [c, g] = canvas(S, S / 2);
      const rng = mulberry32(23);
      g.fillStyle = color;
      g.fillRect(0, 0, S, S / 2);
      noise(g, S, S / 2, 18, rng);
      const grd = g.createLinearGradient(0, S * 0.32, 0, S / 2);
      grd.addColorStop(0, 'rgba(110,90,60,0)');
      grd.addColorStop(1, 'rgba(110,90,60,0.45)');
      g.fillStyle = grd;
      g.fillRect(0, 0, S, S / 2);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(0, 0, S, S / 40);
      g.strokeStyle = 'rgba(80,70,55,0.35)';
      g.lineWidth = 1;
      for (let n = 0; n < 5; n++) {
        g.beginPath();
        let x = rng() * S, y = rng() * S * 0.3;
        g.moveTo(x, y);
        for (let k = 0; k < 4; k++) g.lineTo((x += (rng() - 0.5) * 20), (y += rng() * 14));
        g.stroke();
      }
      return toTex(c);
    });
  }

  gate(color: string) {
    return this.memo('gate-' + color, () => {
      const S = this.S;
      const [c, g] = canvas(S, S / 2);
      g.fillStyle = color;
      g.fillRect(0, 0, S, S / 2);
      const W = S, H = S / 2;
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = Math.max(1, S / 160);
      g.strokeRect(W * 0.03, H * 0.05, W * 0.44, H * 0.9);
      g.strokeRect(W * 0.53, H * 0.05, W * 0.44, H * 0.9);
      // embossed diamonds + gold rosettes
      for (const ox of [0.25, 0.75]) {
        g.fillStyle = 'rgba(255,255,255,0.14)';
        g.beginPath();
        g.moveTo(W * ox, H * 0.15); g.lineTo(W * (ox + 0.15), H * 0.5); g.lineTo(W * ox, H * 0.85); g.lineTo(W * (ox - 0.15), H * 0.5);
        g.closePath();
        g.fill();
        g.stroke();
        g.fillStyle = '#c9a54a';
        g.beginPath();
        g.arc(W * ox, H * 0.5, S * 0.03, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = 'rgba(0,0,0,0.5)';
      g.fillRect(W * 0.495, 0, W * 0.01, H);
      return toTex(c, true, false);
    });
  }

  majolica() {
    return this.memo('majolica', () => {
      const S = this.S;
      const [c, g] = canvas(S, S);
      g.fillStyle = '#1b4f8a';
      g.fillRect(0, 0, S, S);
      const cell = S / 2;
      for (let y = 0; y < 2; y++)
        for (let x = 0; x < 2; x++) {
          const cx = x * cell + cell / 2;
          const cy = y * cell + cell / 2;
          g.fillStyle = '#1aa3b4';
          g.beginPath();
          for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2 + Math.PI / 8;
            const r = i % 2 ? cell * 0.24 : cell * 0.44;
            g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
          }
          g.closePath();
          g.fill();
          g.fillStyle = '#f4f1e6';
          g.beginPath();
          for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2 + Math.PI / 8;
            const r = i % 2 ? cell * 0.12 : cell * 0.22;
            g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
          }
          g.closePath();
          g.fill();
          g.fillStyle = '#d4a33f';
          g.beginPath();
          g.arc(cx, cy, cell * 0.06, 0, Math.PI * 2);
          g.fill();
        }
      g.strokeStyle = 'rgba(10,25,50,0.6)';
      g.lineWidth = Math.max(1, S / 256);
      for (let k = 0; k <= 8; k++) {
        g.beginPath(); g.moveTo((k * S) / 8, 0); g.lineTo((k * S) / 8, S); g.stroke();
        g.beginPath(); g.moveTo(0, (k * S) / 8); g.lineTo(S, (k * S) / 8); g.stroke();
      }
      return toTex(c);
    });
  }

  domeTiles() {
    return this.memo('dome', () => {
      const S = this.S;
      const [c, g] = canvas(S, S);
      g.fillStyle = '#1797a8';
      g.fillRect(0, 0, S, S);
      for (let k = 0; k < 16; k++) {
        g.fillStyle = k % 2 ? 'rgba(10,60,100,0.35)' : 'rgba(255,255,255,0.08)';
        g.fillRect((k / 16) * S, 0, S / 32, S);
      }
      noise(g, S, S, 14, mulberry32(24));
      return toTex(c);
    });
  }

  // ---------------- facades ----------------
  facade(kind: 'glass' | 'office' | 'panel' | 'modern' | 'brick' | 'house' | 'shop' | 'warehouse'): FacadeTex {
    const hit = this.facades.get(kind);
    if (hit) return hit;
    const S = this.S;
    const rng = mulberry32(kind.length * 97 + 7);
    const cols = kind === 'shop' ? 4 : kind === 'brick' || kind === 'house' ? 2 : 4;
    const rows = kind === 'shop' ? 1 : kind === 'brick' || kind === 'house' ? 1 : 4;
    const W = S * (kind === 'shop' ? 2 : 1);
    const H = kind === 'shop' ? S / 2 : kind === 'brick' || kind === 'house' ? S / 2 : S;
    const [c, g] = canvas(W, H);
    const [ec, eg] = canvas(W, H);
    eg.fillStyle = '#000';
    eg.fillRect(0, 0, W, H);
    const bw = W / cols;
    const bh = H / rows;
    const lit = (x: number, y: number, w: number, h: number, p: number, warm = true) => {
      if (rng() < p) {
        eg.fillStyle = warm ? pick(rng, ['#ffd9a0', '#ffe6b8', '#ffcf8a', '#fff1d6']) : '#cfe6ff';
        eg.fillRect(x, y, w, h);
      }
    };

    if (kind === 'glass') {
      const grd = g.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, '#5b7f98');
      grd.addColorStop(1, '#2b4a5f');
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);
      for (let r = 0; r < rows; r++)
        for (let k = 0; k < cols; k++) {
          const t = rng() * 0.25;
          g.fillStyle = `rgba(200,225,240,${t})`;
          g.fillRect(k * bw + 2, r * bh + 2, bw - 4, bh - 4);
          lit(k * bw + 3, r * bh + 3, bw - 6, bh - 6, 0.35, rng() > 0.3);
        }
      g.fillStyle = '#20262c';
      for (let k = 0; k <= cols; k++) g.fillRect(k * bw - 1.5, 0, 3, H);
      for (let r = 0; r <= rows; r++) g.fillRect(0, r * bh - 3, W, 6);
    } else if (kind === 'office') {
      g.fillStyle = '#b9b4aa';
      g.fillRect(0, 0, W, H);
      noise(g, W, H, 14, rng);
      for (let r = 0; r < rows; r++) {
        g.fillStyle = '#28323b';
        g.fillRect(0, r * bh + bh * 0.3, W, bh * 0.5);
        for (let k = 0; k < cols * 2; k++) {
          g.fillStyle = `rgba(150,180,200,${rng() * 0.25})`;
          g.fillRect((k * bw) / 2 + 2, r * bh + bh * 0.3 + 2, bw / 2 - 4, bh * 0.5 - 4);
          lit((k * bw) / 2 + 2, r * bh + bh * 0.3 + 2, bw / 2 - 4, bh * 0.5 - 4, 0.4, rng() > 0.4);
        }
        g.fillStyle = '#8f8a80';
        for (let k = 0; k <= cols * 2; k++) g.fillRect((k * bw) / 2 - 1, r * bh + bh * 0.3, 2, bh * 0.5);
      }
    } else if (kind === 'panel' || kind === 'modern') {
      const base = kind === 'panel' ? '#d6cfbf' : '#e6d7bd';
      g.fillStyle = base;
      g.fillRect(0, 0, W, H);
      noise(g, W, H, kind === 'panel' ? 22 : 10, rng);
      g.strokeStyle = 'rgba(70,60,50,0.35)';
      g.lineWidth = Math.max(1, S / 300);
      for (let r = 0; r <= rows; r++) { g.beginPath(); g.moveTo(0, r * bh); g.lineTo(W, r * bh); g.stroke(); }
      for (let k = 0; k <= cols; k++) { g.beginPath(); g.moveTo(k * bw, 0); g.lineTo(k * bw, H); g.stroke(); }
      for (let r = 0; r < rows; r++)
        for (let k = 0; k < cols; k++) {
          const x = k * bw + bw * 0.22, y = r * bh + bh * 0.22, w = bw * 0.56, h = bh * 0.5;
          const balcony = kind === 'panel' && (k + r) % 3 === 0;
          if (balcony) {
            g.fillStyle = pick(rng, ['#cfc6b2', '#b9c3c7', '#d8d0c0', '#c3b9a0']);
            g.fillRect(k * bw + bw * 0.08, y + h * 0.55, bw * 0.84, bh * 0.4);
            g.fillStyle = 'rgba(0,0,0,0.25)';
            g.fillRect(k * bw + bw * 0.08, y + h * 0.55, bw * 0.84, 3);
          }
          g.fillStyle = '#f2efe8';
          g.fillRect(x - 3, y - 3, w + 6, h + 6);
          g.fillStyle = '#34414c';
          g.fillRect(x, y, w, h);
          if (rng() < 0.5) {
            g.fillStyle = pick(rng, ['#c9a46a', '#a0606a', '#7a95a8', '#d9c9a0']);
            g.fillRect(x, y, w * 0.3, h);
          }
          g.fillStyle = '#f2efe8';
          g.fillRect(x + w / 2 - 1.5, y, 3, h);
          lit(x, y, w, h, 0.38);
        }
      if (kind === 'modern') {
        g.fillStyle = '#b5673d';
        for (let k = 0; k < cols; k += 2) g.fillRect(k * bw, 0, bw * 0.12, H);
      }
    } else if (kind === 'brick' || kind === 'house') {
      g.fillStyle = kind === 'brick' ? '#c49a62' : '#e2d6bf';
      g.fillRect(0, 0, W, H);
      if (kind === 'brick') {
        g.fillStyle = 'rgba(90,60,30,0.35)';
        const bhh = H / 24;
        for (let r = 0; r < 24; r++) {
          g.fillRect(0, r * bhh, W, 1);
          for (let x = (r % 2) * bhh; x < W; x += bhh * 2) g.fillRect(x, r * bhh, 1, bhh);
        }
      }
      noise(g, W, H, 18, rng);
      for (let k = 0; k < cols; k++) {
        const x = k * bw + bw * 0.3, y = H * 0.25, w = bw * 0.4, h = H * 0.5;
        g.fillStyle = kind === 'brick' ? '#efe6d4' : '#2d6aa0';
        g.beginPath();
        g.moveTo(x - 4, y + h + 4);
        g.lineTo(x - 4, y + w / 2);
        g.arc(x + w / 2, y + w / 2, w / 2 + 4, Math.PI, 0);
        g.lineTo(x + w + 4, y + h + 4);
        g.closePath();
        g.fill();
        g.fillStyle = '#2f3a42';
        g.beginPath();
        g.moveTo(x, y + h);
        g.lineTo(x, y + w / 2);
        g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
        g.lineTo(x + w, y + h);
        g.closePath();
        g.fill();
        g.fillStyle = kind === 'brick' ? '#efe6d4' : '#2d6aa0';
        g.fillRect(x + w / 2 - 1.5, y, 3, h);
        g.fillRect(x, y + h * 0.55, w, 3);
        if (rng() < 0.55) {
          eg.fillStyle = '#ffd59a';
          eg.fillRect(x, y + w / 4, w, h - w / 4);
        }
      }
    } else if (kind === 'shop') {
      const names = ['NON', 'DORIXONA', 'KAFE', 'MOBIL ALOQA', 'MEVA', 'SOMSA', 'GO‘SHT', 'KIYIM', 'OPTIKA', 'QURILISH'];
      const colors = ['#1d6b8f', '#a33a2c', '#2f6b3f', '#c27c1a', '#5a3f8c', '#1aa3b4'];
      g.fillStyle = '#d9d2c4';
      g.fillRect(0, 0, W, H);
      for (let k = 0; k < cols; k++) {
        const x = k * bw;
        const col = colors[(k * 3 + 1) % colors.length];
        g.fillStyle = col;
        g.fillRect(x + bw * 0.04, H * 0.04, bw * 0.92, H * 0.24);
        g.fillStyle = '#fff';
        g.font = `800 ${Math.floor(H * 0.13)}px Manrope, Arial, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(names[(k * 7 + 3) % names.length], x + bw / 2, H * 0.165, bw * 0.85);
        eg.fillStyle = '#ffffff';
        eg.globalAlpha = 0.6;
        eg.fillRect(x + bw * 0.04, H * 0.04, bw * 0.92, H * 0.24);
        eg.globalAlpha = 1;
        g.fillStyle = '#2a3238';
        g.fillRect(x + bw * 0.06, H * 0.36, bw * 0.88, H * 0.6);
        g.fillStyle = 'rgba(190,215,230,0.25)';
        g.fillRect(x + bw * 0.08, H * 0.38, bw * 0.5, H * 0.56);
        g.fillStyle = '#c7c0b2';
        g.fillRect(x + bw * 0.6, H * 0.36, 4, H * 0.6);
        eg.fillStyle = '#ffe2b0';
        eg.fillRect(x + bw * 0.08, H * 0.38, bw * 0.84, H * 0.56);
      }
    } else {
      // warehouse
      g.fillStyle = '#9aa2a6';
      g.fillRect(0, 0, W, H);
    }
    const tileW = cols * 3.2;
    const tileH = kind === 'shop' ? 4.2 : rows * 3.2;
    const ft: FacadeTex = { map: toTex(c), emissive: toTex(ec), tile: [tileW, kind === 'brick' || kind === 'house' ? 3.2 : tileH] };
    this.facades.set(kind, ft);
    return ft;
  }

  mosaic(seed: number) {
    return this.memo('mosaic-' + seed, () => {
      const S = this.S;
      const [c, g] = canvas(S, S * 2);
      const rng = mulberry32(seed);
      g.fillStyle = '#e8dcc0';
      g.fillRect(0, 0, S, S * 2);
      const pal = ['#1aa3b4', '#1b4f8a', '#d4a33f', '#a33a2c', '#2f6b3f', '#f4f1e6'];
      // sun
      g.fillStyle = '#d4a33f';
      g.beginPath();
      g.arc(S * 0.5, S * 0.5, S * 0.22, 0, Math.PI * 2);
      g.fill();
      for (let i = 0; i < 12; i++) {
        g.save();
        g.translate(S * 0.5, S * 0.5);
        g.rotate((i / 12) * Math.PI * 2);
        g.fillStyle = i % 2 ? '#a33a2c' : '#d4a33f';
        g.fillRect(S * 0.26, -S * 0.02, S * 0.12, S * 0.04);
        g.restore();
      }
      // cotton bolls + waves
      for (let n = 0; n < 5; n++) {
        const y = S * 1.0 + n * S * 0.18;
        g.fillStyle = pal[n % pal.length];
        g.beginPath();
        g.moveTo(0, y);
        for (let x = 0; x <= S; x += S / 8) g.quadraticCurveTo(x + S / 16, y - S * 0.06, x + S / 8, y);
        g.lineTo(S, y + S * 0.08);
        g.lineTo(0, y + S * 0.08);
        g.fill();
      }
      for (let n = 0; n < 6; n++) {
        g.fillStyle = '#f4f1e6';
        const x = S * (0.15 + rng() * 0.7), y = S * (0.85 + rng() * 0.15);
        for (let k = 0; k < 4; k++) {
          g.beginPath();
          g.arc(x + Math.cos(k * 1.57) * S * 0.025, y + Math.sin(k * 1.57) * S * 0.025, S * 0.03, 0, Math.PI * 2);
          g.fill();
        }
      }
      // tessera grid
      g.strokeStyle = 'rgba(60,50,40,0.25)';
      g.lineWidth = 1;
      const step = S / 48;
      for (let x = 0; x < S; x += step) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, S * 2); g.stroke(); }
      for (let y = 0; y < S * 2; y += step) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); }
      return toTex(c, true, false);
    });
  }

  sign(text: string, bg: string, fg = '#ffffff', sub?: string) {
    return this.memo(`sign-${text}-${bg}-${sub ?? ''}`, () => {
      const W = 512, H = 128;
      const [c, g] = canvas(W, H);
      g.fillStyle = bg;
      g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 4;
      g.strokeRect(6, 6, W - 12, H - 12);
      g.fillStyle = fg;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = `800 ${sub ? 50 : 60}px Unbounded, Manrope, Arial, sans-serif`;
      g.fillText(text, W / 2, sub ? H * 0.4 : H / 2, W - 40);
      if (sub) {
        g.font = `600 26px Manrope, Arial, sans-serif`;
        g.fillText(sub, W / 2, H * 0.78, W - 40);
      }
      return toTex(c, true, false);
    });
  }

  lightPool() {
    return this.memo('pool', () => {
      const S = 128;
      const [c, g] = canvas(S, S);
      const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      grd.addColorStop(0, 'rgba(255,214,150,0.9)');
      grd.addColorStop(0.4, 'rgba(255,200,130,0.35)');
      grd.addColorStop(1, 'rgba(255,190,120,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, S, S);
      return toTex(c, true, false);
    });
  }

  clouds() {
    return this.memo('clouds', () => {
      const S = 512;
      const [c, g] = canvas(S, S);
      const rng = mulberry32(31);
      g.clearRect(0, 0, S, S);
      for (let n = 0; n < 90; n++) {
        const x = rng() * S, y = rng() * S, r = 20 + rng() * 70;
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, `rgba(255,255,255,${0.25 + rng() * 0.3})`);
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd;
        for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) g.fillRect(x - r + ox, y - r + oy, r * 2, r * 2);
      }
      return toTex(c, true, true);
    });
  }

  doppi() {
    return this.memo('doppi', () => {
      const S = 128;
      const [c, g] = canvas(S, S / 2);
      g.fillStyle = '#121212';
      g.fillRect(0, 0, S, S / 2);
      g.fillStyle = '#f2f0ea';
      for (let k = 0; k < 4; k++) {
        const cx = (k + 0.5) * (S / 4);
        g.beginPath();
        g.ellipse(cx, S / 4, S / 16, S / 9, 0.6, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#121212';
        g.beginPath();
        g.ellipse(cx + 2, S / 4 - 2, S / 34, S / 18, 0.6, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#f2f0ea';
      }
      return toTex(c, true, true);
    });
  }

  // ---------------- surface detail (normal maps) & vegetation ----------------
  /** derive a tangent-space normal map from a colour texture's luminance */
  normalOf(src: THREE.Texture, strength = 2): THREE.Texture {
    const key = `n-${src.uuid}-${strength}`;
    return this.memo(key, () => {
      const img = src.image as HTMLCanvasElement;
      const w = img.width, h = img.height;
      const sg = img.getContext('2d')!;
      const d = sg.getImageData(0, 0, w, h).data;
      const lum = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) lum[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255;
      const [c, g] = canvas(w, h);
      const out = g.createImageData(w, h);
      const o = out.data;
      const at = (x: number, y: number) => lum[((y + h) % h) * w + ((x + w) % w)];
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
          const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
          const len = Math.hypot(dx, dy, 1);
          const i = (y * w + x) * 4;
          o[i] = (-dx / len * 0.5 + 0.5) * 255;
          o[i + 1] = (dy / len * 0.5 + 0.5) * 255;
          o[i + 2] = (1 / len * 0.5 + 0.5) * 255;
          o[i + 3] = 255;
        }
      g.putImageData(out, 0, 0);
      const t = toTex(c, false, true);
      t.wrapS = src.wrapS;
      t.wrapT = src.wrapT;
      return t;
    });
  }

  leaves(kind: 'broad' | 'fruit' | 'poplar' | 'pine') {
    return this.memo('leaves-' + kind, () => {
      const S = 256;
      const [c, g] = canvas(S, S);
      const rng = mulberry32(kind.length * 31 + 5);
      g.clearRect(0, 0, S, S);
      const greens =
        kind === 'pine' ? ['#1f3a22', '#284a2b', '#33573a'] : kind === 'poplar' ? ['#4f7232', '#5d8338', '#476a2c', '#6b9141'] : ['#3f6127', '#4d7330', '#5a8236', '#36541f', '#6a8f3e'];
      // twigs
      g.strokeStyle = '#4a3a28';
      g.lineWidth = 2;
      for (let n = 0; n < 6; n++) {
        g.beginPath();
        g.moveTo(S / 2, S);
        g.quadraticCurveTo(S * (0.2 + rng() * 0.6), S * 0.6, S * (0.1 + rng() * 0.8), S * (0.1 + rng() * 0.4));
        g.stroke();
      }
      const count = kind === 'pine' ? 260 : 170;
      for (let n = 0; n < count; n++) {
        const a = rng() * Math.PI * 2;
        const r = Math.sqrt(rng()) * S * 0.46;
        const x = S / 2 + Math.cos(a) * r, y = S / 2 + Math.sin(a) * r;
        g.save();
        g.translate(x, y);
        g.rotate(rng() * Math.PI * 2);
        g.fillStyle = greens[Math.floor(rng() * greens.length)];
        if (kind === 'pine') {
          g.fillRect(-1, -9, 2, 18);
        } else {
          const lw = kind === 'poplar' ? 5 : 7, lh = kind === 'poplar' ? 8 : 11;
          g.beginPath();
          g.ellipse(0, 0, lw, lh, 0, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = 'rgba(255,255,230,0.12)';
          g.beginPath();
          g.ellipse(-1.5, -2, lw * 0.4, lh * 0.5, 0, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = 'rgba(20,35,10,0.5)';
          g.lineWidth = 0.8;
          g.beginPath();
          g.moveTo(0, -lh);
          g.lineTo(0, lh);
          g.stroke();
        }
        g.restore();
      }
      if (kind === 'fruit') {
        for (let n = 0; n < 14; n++) {
          g.fillStyle = rng() < 0.5 ? '#c4372a' : '#e0a531';
          g.beginPath();
          g.arc(S * (0.2 + rng() * 0.6), S * (0.2 + rng() * 0.6), 4, 0, Math.PI * 2);
          g.fill();
        }
      }
      const t = toTex(c, true, false);
      t.premultiplyAlpha = false;
      return t;
    });
  }

  bark() {
    return this.memo('bark', () => {
      const W = 128, H = 256;
      const [c, g] = canvas(W, H);
      const rng = mulberry32(55);
      g.fillStyle = '#5a4634';
      g.fillRect(0, 0, W, H);
      for (let n = 0; n < 90; n++) {
        g.fillStyle = rng() < 0.5 ? 'rgba(35,25,18,0.55)' : 'rgba(140,120,95,0.35)';
        const x = rng() * W;
        g.fillRect(x, 0, 1 + rng() * 3, H);
      }
      for (let n = 0; n < 40; n++) {
        g.fillStyle = 'rgba(30,22,15,0.6)';
        g.fillRect(rng() * W, rng() * H, 2 + rng() * 10, 1 + rng() * 3);
      }
      noise(g, W, H, 26, rng);
      return toTex(c);
    });
  }

  /** wall textures without painted windows — real window geometry is added by the facade kit */
  plainWall(kind: 'house' | 'brick'): FacadeTex {
    const hit = this.facades.get('plain-' + kind);
    if (hit) return hit;
    const S = this.S;
    const rng = mulberry32(kind === 'brick' ? 71 : 72);
    const [c, g] = canvas(S, S / 2);
    const [ec, eg] = canvas(8, 8);
    eg.fillStyle = '#000';
    eg.fillRect(0, 0, 8, 8);
    const W = S, H = S / 2;
    g.fillStyle = kind === 'brick' ? '#c39761' : '#e4d8c1';
    g.fillRect(0, 0, W, H);
    if (kind === 'brick') {
      const rows = 26, bh = H / rows;
      for (let r = 0; r < rows; r++) {
        for (let x = (r % 2) * bh * 1.1; x < W; x += bh * 2.2) {
          const t = rng() * 26 - 13;
          g.fillStyle = `rgb(${196 + t},${150 + t},${96 + t})`;
          g.fillRect(x + 1, r * bh + 1, bh * 2.2 - 2, bh - 2);
        }
      }
      // decorative header course
      g.fillStyle = 'rgba(120,80,40,0.35)';
      for (let x = 0; x < W; x += bh * 1.2) g.fillRect(x, bh * 2, bh * 0.6, bh);
    } else {
      noise(g, W, H, 14, rng);
      const grd = g.createLinearGradient(0, H * 0.82, 0, H);
      grd.addColorStop(0, 'rgba(120,100,70,0)');
      grd.addColorStop(1, 'rgba(120,100,70,0.35)');
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#9b8c74';
      g.fillRect(0, H * 0.9, W, H * 0.1); // plinth
      g.fillStyle = 'rgba(255,255,255,0.4)';
      g.fillRect(0, H * 0.06, W, H * 0.025); // painted band under the eaves
    }
    noise(g, W, H, 10, rng);
    const ft: FacadeTex = { map: toTex(c), emissive: toTex(ec), tile: [4, 3.3] };
    this.facades.set('plain-' + kind, ft);
    return ft;
  }

  /** older mahalla asphalt: no centre line, patches, dusty crumbling edges */
  roadMahalla() {
    return this.memo('road-mahalla', () => {
      const S = this.S;
      const [c, g] = canvas(S, S);
      const rng = mulberry32(91);
      g.fillStyle = '#45464a';
      g.fillRect(0, 0, S, S);
      noise(g, S, S, 26, rng);
      for (let n = 0; n < 9; n++) {
        g.fillStyle = `rgba(${rng() < 0.5 ? '28,29,31' : '70,70,72'},${0.35 + rng() * 0.3})`;
        g.fillRect(S * (0.15 + rng() * 0.6), rng() * S, S * (0.06 + rng() * 0.18), S * (0.05 + rng() * 0.2));
      }
      const grd = g.createLinearGradient(0, 0, S, 0);
      grd.addColorStop(0, 'rgba(160,140,105,0.95)');
      grd.addColorStop(0.16, 'rgba(160,140,105,0)');
      grd.addColorStop(0.84, 'rgba(160,140,105,0)');
      grd.addColorStop(1, 'rgba(160,140,105,0.95)');
      g.fillStyle = grd;
      g.fillRect(0, 0, S, S);
      return toTex(c);
    });
  }

  /** industrial concrete slab road with expansion joints */
  concreteRoad() {
    return this.memo('road-concrete', () => {
      const S = this.S;
      const [c, g] = canvas(S, S);
      const rng = mulberry32(92);
      g.fillStyle = '#8f8c86';
      g.fillRect(0, 0, S, S);
      noise(g, S, S, 22, rng);
      g.fillStyle = 'rgba(40,38,34,0.7)';
      g.fillRect(S / 2 - 1, 0, 2, S);
      for (let y = 0; y < S; y += S / 3) g.fillRect(0, y, S, 2);
      for (let n = 0; n < 6; n++) {
        g.fillStyle = 'rgba(60,55,45,0.25)';
        g.fillRect(rng() * S, rng() * S, S * 0.2, S * 0.08);
      }
      return toTex(c);
    });
  }

  grassBlades() {
    return this.memo('grass-blades', () => {
      const S = 128;
      const [c, g] = canvas(S, S);
      const rng = mulberry32(81);
      g.clearRect(0, 0, S, S);
      for (let n = 0; n < 70; n++) {
        const x = 6 + rng() * (S - 12);
        const h = S * (0.45 + rng() * 0.55);
        const lean = (rng() - 0.5) * 18;
        g.strokeStyle = ['#5b7d34', '#6d8f3c', '#4c6c2b', '#7f9a46', '#8e9d55'][Math.floor(rng() * 5)];
        g.lineWidth = 1.5 + rng() * 2;
        g.beginPath();
        g.moveTo(x, S);
        g.quadraticCurveTo(x + lean * 0.3, S - h * 0.6, x + lean, S - h);
        g.stroke();
      }
      return toTex(c, true, false);
    });
  }

  plate(text: string) {
    const W = 256, H = 56;
    const [c, g] = canvas(W, H);
    g.fillStyle = '#f7f7f4';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#111';
    g.lineWidth = 3;
    g.strokeRect(2, 2, W - 4, H - 4);
    const parts = text.split(' ');
    g.fillStyle = '#111';
    g.textBaseline = 'middle';
    g.font = '700 34px "Arial Narrow", Arial, sans-serif';
    g.textAlign = 'center';
    g.fillText(parts[0] ?? '', 30, H / 2 + 1);
    g.fillRect(56, 6, 2.5, H - 12);
    g.fillText(parts.slice(1).join(' '), 145, H / 2 + 1, 165);
    // flag + UZ
    g.fillStyle = '#1eb4d4';
    g.fillRect(W - 30, 10, 20, 6);
    g.fillStyle = '#fff';
    g.fillRect(W - 30, 16, 20, 5);
    g.fillStyle = '#1eb53a';
    g.fillRect(W - 30, 21, 20, 6);
    g.fillStyle = '#1b4f8a';
    g.font = '700 15px Arial, sans-serif';
    g.fillText('UZ', W - 20, 40);
    return toTex(c, true, false);
  }
}
