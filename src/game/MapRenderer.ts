import type { Vec2 } from '@/types';
import { POIS } from '@/game/world/cityLayout';
import { NET, BOUNDS, RIVER, RAIL_Z, STATION, ZONES, ZONE_COLORS, MAHALLA_NAMES, frameToWorld } from '@/game/world/guzor/network';

const SIZE = 2048;
const CX = (BOUNDS.x0 + BOUNDS.x1) / 2, CZ = (BOUNDS.z0 + BOUNDS.z1) / 2;
const HALF_M = Math.max(BOUNDS.x1 - BOUNDS.x0, BOUNDS.z1 - BOUNDS.z0) / 2 + 40;
const scale = SIZE / (HALF_M * 2);
const toMapX = (v: number) => (v - (CX - HALF_M)) * scale;
const toMapZ = (v: number) => (v - (CZ - HALF_M)) * scale;
/** keep the minimap at the same metres-per-pixel as before the world grew */
const MINI = ((SIZE / 1024) * (1024 / 950)) / scale;

export interface MapMarker {
  pos: Vec2;
  color: string;
  label?: string;
  big?: boolean;
}

/** 2D map drawn from the same road network, river, lots and sites as the 3D world */
export class MapRenderer {
  readonly base: HTMLCanvasElement;

  constructor() {
    this.base = document.createElement('canvas');
    this.base.width = this.base.height = SIZE;
    const g = this.base.getContext('2d')!;
    g.fillStyle = '#bba981';
    g.fillRect(0, 0, SIZE, SIZE);
    // farmland patchwork
    const a = -0.61;
    for (let u = -2600; u < 3600; u += 66)
      for (let v = -2600; v < 3600; v += 118) {
        const h = Math.abs(Math.sin((Math.floor(u / 66) * 7919 + Math.floor(v / 118) * 104729) * 12.9898) * 43758.5453) % 1;
        g.fillStyle = ['#a9b07a', '#cdbb85', '#9d8a6c', '#c2b28c', '#8a9e6a', '#b3bf88'][Math.floor(h * 6)];
        const pts = [[u, v], [u + 66, v], [u + 66, v + 118], [u, v + 118]].map(([uu, vv]) => ({ x: uu * Math.cos(a) - vv * Math.sin(a), z: uu * Math.sin(a) + vv * Math.cos(a) }));
        g.beginPath();
        pts.forEach((p, i) => (i ? g.lineTo(toMapX(p.x), toMapZ(p.z)) : g.moveTo(toMapX(p.x), toMapZ(p.z))));
        g.fill();
      }
    // neighbourhoods
    for (const z of ZONES) {
      g.fillStyle = ZONE_COLORS[z.zone];
      g.globalAlpha = 0.55;
      g.beginPath();
      z.poly.forEach((p, i) => (i ? g.lineTo(toMapX(p.x), toMapZ(p.z)) : g.moveTo(toMapX(p.x), toMapZ(p.z))));
      g.closePath();
      g.fill();
    }
    g.globalAlpha = 1;
    // river
    g.strokeStyle = '#6fa3c8';
    g.lineWidth = 19 * scale;
    g.lineJoin = g.lineCap = 'round';
    g.beginPath();
    RIVER.forEach((p, i) => (i ? g.lineTo(toMapX(p.x), toMapZ(p.z)) : g.moveTo(toMapX(p.x), toMapZ(p.z))));
    g.stroke();
    // lots and sites
    for (const L of NET.lots) {
      const c = [[0, 0], [L.w, 0], [L.w, L.d], [0, L.d]].map(([x, z]) => frameToWorld(L.ox, L.oz, L.rot, x, z));
      g.fillStyle = L.kind === 'site' ? '#d9cfb8' : L.kind === 'industrial' ? '#8f877a' : L.kind === 'apartment' || L.kind === 'commercial' ? '#c9c4bb' : L.kind === 'orchard' ? '#7f9a5c' : '#d6c8aa';
      g.beginPath();
      c.forEach((p, i) => (i ? g.lineTo(toMapX(p.x), toMapZ(p.z)) : g.moveTo(toMapX(p.x), toMapZ(p.z))));
      g.closePath();
      g.fill();
    }
    // railway
    g.strokeStyle = '#4a4a4a';
    g.lineWidth = 3;
    g.setLineDash([10, 6]);
    g.beginPath();
    g.moveTo(0, toMapZ(RAIL_Z));
    g.lineTo(SIZE, toMapZ(RAIL_Z));
    g.stroke();
    g.setLineDash([]);
    // roads: casing then fill, highways on top
    for (const pass of [0, 1]) {
      for (const cls of ['lane', 'rural', 'street', 'main', 'highway'] as const) {
        for (const e of NET.edges) {
          if (e.cls !== cls) continue;
          g.strokeStyle = pass === 0 ? '#8a7f6c' : cls === 'highway' ? '#f4cf72' : cls === 'main' ? '#fbf6ea' : '#efe8d8';
          g.lineWidth = Math.max(1.6, (e.width + (pass === 0 ? 2.5 : 0)) * scale);
          g.beginPath();
          e.pts.forEach((p, i) => (i ? g.lineTo(toMapX(p.x), toMapZ(p.z)) : g.moveTo(toMapX(p.x), toMapZ(p.z))));
          g.stroke();
        }
      }
    }
    // labels
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '700 15px Manrope, Arial, sans-serif';
    g.fillStyle = '#2e4a63';
    const riverMid = RIVER[Math.floor(RIVER.length * 0.62)];
    g.fillText('G‘uzordaryo', toMapX(riverMid.x), toMapZ(riverMid.z) + 18);
    g.fillStyle = '#3a3a3a';
    g.fillText('G‘uzor vokzali', toMapX(STATION.x), toMapZ(RAIL_Z) - 14);
    const named = new Set<string>();
    g.font = '800 13px Manrope, Arial, sans-serif';
    for (const e of NET.edges) {
      if (!e.major || !e.name || named.has(e.name) || e.len < 120) continue;
      named.add(e.name);
      const m = e.pts[Math.floor(e.pts.length / 2)];
      g.fillStyle = '#5a4a2a';
      g.fillText(e.name, toMapX(m.x), toMapZ(m.z) - 12);
    }
    g.font = '600 12px Manrope, Arial, sans-serif';
    g.fillStyle = '#4a3a22';
    for (let x = BOUNDS.x0; x < BOUNDS.x1; x += 380)
      for (let z = BOUNDS.z0; z < BOUNDS.z1; z += 380) {
        const cx = x + 190, cz = z + 190;
        if (!ZONES.some((zz) => zz.zone === 'mahalla' && NET.lotAt(cx, cz) === null && zz.poly.length) || NET.lots.length === 0) continue;
        const inside = ZONES.find((zz) => zz.zone === 'mahalla' && pointIn(cx, cz, zz.poly));
        if (!inside) continue;
        g.fillText(MAHALLA_NAMES[(Math.floor(cx / 380) * 7 + Math.floor(cz / 380) * 3 + 64) % MAHALLA_NAMES.length], toMapX(cx), toMapZ(cz));
      }
    const jar = ZONES.find((zz) => zz.name === 'Jarariq');
    if (jar) {
      const c = jar.poly.reduce((a, p) => ({ x: a.x + p.x / jar.poly.length, z: a.z + p.z / jar.poly.length }), { x: 0, z: 0 });
      g.font = '800 16px Manrope, Arial, sans-serif';
      g.fillText('Jarariq', toMapX(c.x), toMapZ(c.z));
    }
    // landmark sites
    g.font = '700 12px Manrope, Arial, sans-serif';
    for (const L of NET.lots) {
      if (!L.site || ['bank', 'jobs', 'realty', 'osh', 'dealership', 'service', 'warehouse', 'fuel', 'bazaar', 'farm'].includes(L.site.kind)) continue;
      g.fillStyle = L.site.kind === 'mosque' || L.site.kind === 'mirijanda' ? '#2f6b3f' : '#1d3f6e';
      g.fillText(L.site.name, toMapX(L.cx), toMapZ(L.cz) - 16);
      g.beginPath();
      g.arc(toMapX(L.cx), toMapZ(L.cz), 5, 0, Math.PI * 2);
      g.fill();
    }
    // POI glyphs
    for (const p of POIS) {
      if (p.kind === 'property') continue;
      const x = toMapX(p.pos.x), y = toMapZ(p.pos.z);
      g.fillStyle = '#0e1b2c';
      g.beginPath();
      g.arc(x, y, 11, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#2bb3c0';
      g.font = '800 12px Manrope, Arial, sans-serif';
      g.fillText(p.glyph, x, y + 0.5);
    }
  }

  private drawMarkers(g: CanvasRenderingContext2D, markers: MapMarker[], px: number) {
    for (const m of markers) {
      const x = toMapX(m.pos.x), y = toMapZ(m.pos.z);
      g.fillStyle = m.color;
      g.strokeStyle = '#0e1b2c';
      g.lineWidth = 3 * px;
      g.beginPath();
      g.arc(x, y, (m.big ? 9 : 6) * px, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
  }

  private drawPlayer(g: CanvasRenderingContext2D, pos: Vec2, heading: number, px: number) {
    const x = toMapX(pos.x), y = toMapZ(pos.z);
    g.save();
    g.translate(x, y);
    // heading vector (sin h, cos h) in map space → canvas angle
    g.rotate(Math.atan2(Math.cos(heading), Math.sin(heading)) - Math.PI / 2);
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#0e1b2c';
    g.lineWidth = 2.5 * px;
    g.beginPath();
    g.moveTo(0, 11 * px);
    g.lineTo(7 * px, -7 * px);
    g.lineTo(0, -3 * px);
    g.lineTo(-7 * px, -7 * px);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }

  /** circular minimap rotated so the camera's forward points up */
  drawMinimap(ctx: CanvasRenderingContext2D, size: number, pos: Vec2, heading: number, camYaw: number, markers: MapMarker[], zoom: number) {
    const dpr = ctx.canvas.width / size;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#b3a37d';
    ctx.fillRect(0, 0, size, size);
    const k = (size / SIZE) * zoom * MINI;
    ctx.translate(size / 2, size / 2);
    ctx.rotate(camYaw - Math.PI);
    ctx.scale(k, k);
    ctx.translate(-toMapX(pos.x), -toMapZ(pos.z));
    ctx.drawImage(this.base, 0, 0);
    this.drawMarkers(ctx, markers, 1 / k);
    this.drawPlayer(ctx, pos, heading, 1 / k);
    ctx.restore();
    // north indicator
    const r = size / 2 - 11;
    const a = camYaw - Math.PI;
    const tx = size / 2 + Math.sin(a) * r;
    const ty = size / 2 - Math.cos(a) * r;
    ctx.fillStyle = '#0e1b2c';
    ctx.beginPath();
    ctx.arc(tx, ty, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e9b44c';
    ctx.font = '800 10px Manrope, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', tx, ty + 0.5);
  }

  /** full map, north up */
  drawWorld(ctx: CanvasRenderingContext2D, size: number, pos: Vec2, heading: number, markers: MapMarker[]) {
    const dpr = ctx.canvas.width / size;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const k = size / SIZE;
    ctx.save();
    ctx.scale(k, k);
    ctx.drawImage(this.base, 0, 0);
    this.drawMarkers(ctx, markers, 1.6 / k / 2);
    this.drawPlayer(ctx, pos, heading, 1.6 / k / 2);
    ctx.restore();
  }

  /** canvas pixel (CSS px) → world position */
  static worldFromMap(mx: number, my: number, size: number): Vec2 {
    return { x: (mx / size) * HALF_M * 2 + CX - HALF_M, z: (my / size) * HALF_M * 2 + CZ - HALF_M };
  }
}

function pointIn(x: number, z: number, poly: { x: number; z: number }[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}
