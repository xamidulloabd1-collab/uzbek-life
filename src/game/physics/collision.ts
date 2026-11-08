export interface Box {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  h: number;
  /** oriented box (rotated buildings): centre, cos/sin of the frame rotation, half extents */
  obb?: { cx: number; cz: number; c: number; s: number; hw: number; hd: number };
  cells?: number[];
}

export interface Contact {
  nx: number;
  nz: number;
  depth: number;
}

const CELL = 12;

/**
 * Lightweight 2.5D collision: buildings, walls, trunks and poles are
 * axis-aligned boxes in a spatial hash. Rotated buildings are approximated by
 * their bounding box, which suits the grid-aligned city.
 */
export class CollisionWorld {
  boxes: Box[] = [];
  private grid = new Map<number, number[]>();
  private stamp: Uint32Array = new Uint32Array(0);
  private tick = 1;

  private key(cx: number, cz: number) {
    return (cx + 4096) * 8192 + (cz + 4096);
  }

  /** returns the box id (use disable(id) to remove it, e.g. when a parked car drives away) */
  add(minX: number, minZ: number, maxX: number, maxZ: number, h = 3): number {
    const id = this.boxes.length;
    this.boxes.push({ minX: Math.min(minX, maxX), maxX: Math.max(minX, maxX), minZ: Math.min(minZ, maxZ), maxZ: Math.max(minZ, maxZ), h });
    const b = this.boxes[id];
    b.cells = [];
    for (let cx = Math.floor(b.minX / CELL); cx <= Math.floor(b.maxX / CELL); cx++) {
      for (let cz = Math.floor(b.minZ / CELL); cz <= Math.floor(b.maxZ / CELL); cz++) {
        const k = this.key(cx, cz);
        let list = this.grid.get(k);
        if (!list) this.grid.set(k, (list = []));
        list.push(id);
        b.cells.push(k);
      }
    }
    return id;
  }

  /** rotated box: (cx, cz) centre, half sizes along the frame’s local x / z, frame rotation */
  addOBB(cx: number, cz: number, hw: number, hd: number, rot: number, h = 3): number {
    const c = Math.cos(rot), s = Math.sin(rot);
    if (Math.abs(s) < 1e-3 || Math.abs(c) < 1e-3) {
      const sw = Math.abs(s) > 0.5;
      return this.addCentered(cx, cz, (sw ? hd : hw) * 2, (sw ? hw : hd) * 2, h);
    }
    const ex = Math.abs(c) * hw + Math.abs(s) * hd, ez = Math.abs(s) * hw + Math.abs(c) * hd;
    const id = this.add(cx - ex, cz - ez, cx + ex, cz + ez, h);
    this.boxes[id].obb = { cx, cz, c, s, hw, hd };
    return id;
  }

  /** remove a box completely (streamed chunks) */
  remove(id: number) {
    const b = this.boxes[id];
    if (!b) return;
    b.h = -1;
    for (const k of b.cells ?? []) {
      const list = this.grid.get(k);
      if (!list) continue;
      const i = list.indexOf(id);
      if (i >= 0) list.splice(i, 1);
      if (!list.length) this.grid.delete(k);
    }
    b.cells = [];
  }

  disable(id: number) {
    if (this.boxes[id]) this.boxes[id].h = -1;
  }

  /** centre-based helper */
  addCentered(cx: number, cz: number, w: number, d: number, h = 3): number {
    return this.add(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, h);
  }

  query(minX: number, minZ: number, maxX: number, maxZ: number, out: Box[] = []): Box[] {
    out.length = 0;
    if (this.stamp.length < this.boxes.length) this.stamp = new Uint32Array(this.boxes.length + 256);
    this.tick++;
    for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++) {
      for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz++) {
        const list = this.grid.get(this.key(cx, cz));
        if (!list) continue;
        for (const id of list) {
          if (this.stamp[id] === this.tick) continue;
          this.stamp[id] = this.tick;
          const b = this.boxes[id];
          if (b.maxX < minX || b.minX > maxX || b.maxZ < minZ || b.minZ > maxZ) continue;
          out.push(b);
        }
      }
    }
    return out;
  }

  private tmp: Box[] = [];

  /** push a circle out of all boxes; returns the deepest contact (or null) */
  resolveCircle(p: { x: number; z: number }, r: number, maxHeight = Infinity): Contact | null {
    let deepest: Contact | null = null;
    for (let iter = 0; iter < 2; iter++) {
      const list = this.query(p.x - r, p.z - r, p.x + r, p.z + r, this.tmp);
      for (const b of list) {
        if (b.h < 0.05 || b.h > maxHeight + 100) continue;
        if (b.obb) {
          const o = b.obb;
          const dx0 = p.x - o.cx, dz0 = p.z - o.cz;
          const lx = dx0 * o.c - dz0 * o.s, lz = dx0 * o.s + dz0 * o.c;
          const qx = Math.max(-o.hw, Math.min(lx, o.hw)), qz = Math.max(-o.hd, Math.min(lz, o.hd));
          let ux = lx - qx, uz = lz - qz;
          let dd = Math.hypot(ux, uz);
          let depth: number;
          if (dd < 1e-6) {
            const ax = o.hw - Math.abs(lx), az = o.hd - Math.abs(lz);
            if (ax < az) { ux = Math.sign(lx) || 1; uz = 0; depth = ax + r; } else { ux = 0; uz = Math.sign(lz) || 1; depth = az + r; }
          } else {
            if (dd >= r) continue;
            depth = r - dd;
            ux /= dd;
            uz /= dd;
          }
          const wx = ux * o.c + uz * o.s, wz = -ux * o.s + uz * o.c;
          p.x += wx * depth;
          p.z += wz * depth;
          if (!deepest || depth > deepest.depth) deepest = { nx: wx, nz: wz, depth };
          continue;
        }
        const qx = Math.max(b.minX, Math.min(p.x, b.maxX));
        const qz = Math.max(b.minZ, Math.min(p.z, b.maxZ));
        let dx = p.x - qx;
        let dz = p.z - qz;
        let d = Math.hypot(dx, dz);
        let depth: number;
        if (d < 1e-6) {
          // centre inside the box: push along the shallowest axis
          const l = p.x - b.minX, rr = b.maxX - p.x, t = p.z - b.minZ, bb = b.maxZ - p.z;
          const m = Math.min(l, rr, t, bb);
          if (m === l) { dx = -1; dz = 0; } else if (m === rr) { dx = 1; dz = 0; } else if (m === t) { dx = 0; dz = -1; } else { dx = 0; dz = 1; }
          depth = m + r;
          d = 1;
        } else {
          if (d >= r) continue;
          depth = r - d;
          dx /= d;
          dz /= d;
          d = 1;
        }
        p.x += dx * depth;
        p.z += dz * depth;
        if (!deepest || depth > deepest.depth) deepest = { nx: dx, nz: dz, depth };
      }
    }
    return deepest;
  }

  /** distance along the ray to the first box (2D), or maxDist */
  raycast(ox: number, oz: number, dx: number, dz: number, maxDist: number, minHeight = 0): number {
    const ex = ox + dx * maxDist;
    const ez = oz + dz * maxDist;
    const list = this.query(Math.min(ox, ex), Math.min(oz, ez), Math.max(ox, ex), Math.max(oz, ez), this.tmp);
    let best = maxDist;
    for (const b of list) {
      if (b.h < minHeight) continue;
      if (b.obb) {
        const o = b.obb;
        const lox = (ox - o.cx) * o.c - (oz - o.cz) * o.s, loz = (ox - o.cx) * o.s + (oz - o.cz) * o.c;
        const ldx = dx * o.c - dz * o.s, ldz = dx * o.s + dz * o.c;
        let a0 = 0, a1 = best, hit = true;
        for (const [p0, dd, e] of [[lox, ldx, o.hw], [loz, ldz, o.hd]] as const) {
          if (Math.abs(dd) < 1e-9) { if (p0 < -e || p0 > e) hit = false; continue; }
          let a = (-e - p0) / dd, c2 = (e - p0) / dd;
          if (a > c2) [a, c2] = [c2, a];
          a0 = Math.max(a0, a);
          a1 = Math.min(a1, c2);
        }
        if (hit && a0 <= a1 && a0 < best && a0 > 0) best = a0;
        continue;
      }
      let t0 = 0;
      let t1 = best;
      if (Math.abs(dx) < 1e-9) {
        if (ox < b.minX || ox > b.maxX) continue;
      } else {
        let a = (b.minX - ox) / dx, c = (b.maxX - ox) / dx;
        if (a > c) [a, c] = [c, a];
        t0 = Math.max(t0, a);
        t1 = Math.min(t1, c);
      }
      if (Math.abs(dz) < 1e-9) {
        if (oz < b.minZ || oz > b.maxZ) continue;
      } else {
        let a = (b.minZ - oz) / dz, c = (b.maxZ - oz) / dz;
        if (a > c) [a, c] = [c, a];
        t0 = Math.max(t0, a);
        t1 = Math.min(t1, c);
      }
      if (t0 <= t1 && t0 < best && t0 > 0) best = t0;
    }
    return best;
  }
}
