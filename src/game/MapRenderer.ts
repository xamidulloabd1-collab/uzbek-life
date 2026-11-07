import type { Vec2 } from '@/types';
import { BLOCK, DISTRICT_COLORS, HALF, N, POIS, ROAD, WORLD_HALF, blockRect, districtOf, roadLine, RIVER, RIVER_ROW, RAIL_Z, STATION_X, blockName } from '@/game/world/cityLayout';

const SIZE = 1024;
const toMap = (v: number) => ((v + WORLD_HALF) / (WORLD_HALF * 2)) * SIZE;
const scale = SIZE / (WORLD_HALF * 2);

export interface MapMarker {
  pos: Vec2;
  color: string;
  label?: string;
  big?: boolean;
}

export class MapRenderer {
  readonly base: HTMLCanvasElement;

  constructor() {
    this.base = document.createElement('canvas');
    this.base.width = this.base.height = SIZE;
    const g = this.base.getContext('2d')!;
    g.fillStyle = '#b3a37d';
    g.fillRect(0, 0, SIZE, SIZE);
    // roads
    g.fillStyle = '#e9e4d8';
    for (let k = 0; k <= N; k++) {
      const c = toMap(roadLine(k));
      const w = ROAD * scale * (k === 0 || k === N ? 1.9 : 1);
      g.fillRect(c - w / 2, toMap(-HALF - 14), w, (HALF * 2 + 28) * scale);
      g.fillRect(toMap(-HALF - 14), c - w / 2, (HALF * 2 + 28) * scale, w);
    }
    g.fillRect(toMap(HALF), toMap(0) - 6, SIZE, 12);
    g.fillRect(toMap(0) - 6, toMap(HALF), 12, SIZE);
    // blocks
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++) {
        const r = blockRect(i, j);
        g.fillStyle = DISTRICT_COLORS[districtOf(i, j)];
        g.fillRect(toMap(r.x0), toMap(r.z0), BLOCK * scale, BLOCK * scale);
      }
    // G‘uzordaryo, railway, station and mahalla names
    g.fillStyle = '#4f86a6';
    g.fillRect(0, toMap(RIVER.z0), SIZE, (RIVER.z1 - RIVER.z0) * scale);
    for (let i = 0; i < N; i++) {
      const r = blockRect(i, RIVER_ROW);
      g.fillStyle = '#7f9a5c';
      g.fillRect(toMap(r.x0), toMap(r.z0), BLOCK * scale, (RIVER.z0 - r.z0) * scale);
      g.fillRect(toMap(r.x0), toMap(RIVER.z1), BLOCK * scale, (r.z1 - RIVER.z1) * scale);
    }
    g.strokeStyle = '#3d3a36';
    g.lineWidth = 3;
    g.setLineDash([10, 6]);
    g.beginPath();
    g.moveTo(0, toMap(RAIL_Z));
    g.lineTo(SIZE, toMap(RAIL_Z));
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = '#8a5a3c';
    g.fillRect(toMap(STATION_X - 22), toMap(RAIL_Z + 11), 44 * scale, 12 * scale);
    g.font = '700 13px Manrope, Arial, sans-serif';
    g.textAlign = 'center';
    g.fillStyle = '#1d3b5c';
    g.fillText('G‘uzordaryo', toMap(-HALF - 40), toMap(RIVER.zc) + 4);
    g.fillText('G‘uzor vokzali', toMap(STATION_X), toMap(RAIL_Z) - 8);
    g.font = '600 10px Manrope, Arial, sans-serif';
    g.fillStyle = 'rgba(14,27,44,0.75)';
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++) {
        if (j === RIVER_ROW || districtOf(i, j) !== 'mahalla') continue;
        const r = blockRect(i, j);
        g.fillText(blockName(i, j).replace(' mahallasi', ''), toMap(r.cx), toMap(r.cz) + 18);
      }
    // POI glyphs
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const p of POIS) {
      if (p.kind === 'property') continue;
      const x = toMap(p.pos.x), y = toMap(p.pos.z);
      g.fillStyle = '#0e1b2c';
      g.beginPath();
      g.arc(x, y, 11, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#2bb3c0';
      g.font = '800 12px Manrope, Arial, sans-serif';
      g.fillText(p.glyph, x, y + 0.5);
    }
    // landmark dome
    const lx = toMap(0), ly = toMap(-10);
    g.fillStyle = '#1aa3b4';
    g.beginPath();
    g.arc(lx, ly, 9, 0, Math.PI * 2);
    g.fill();
  }

  private drawMarkers(g: CanvasRenderingContext2D, markers: MapMarker[], px: number) {
    for (const m of markers) {
      const x = toMap(m.pos.x), y = toMap(m.pos.z);
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
    const x = toMap(pos.x), y = toMap(pos.z);
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
    const k = (size / SIZE) * zoom;
    ctx.translate(size / 2, size / 2);
    ctx.rotate(camYaw - Math.PI);
    ctx.scale(k, k);
    ctx.translate(-toMap(pos.x), -toMap(pos.z));
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
    return { x: (mx / size) * WORLD_HALF * 2 - WORLD_HALF, z: (my / size) * WORLD_HALF * 2 - WORLD_HALF };
  }
}
