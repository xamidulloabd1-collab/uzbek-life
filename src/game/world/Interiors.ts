import * as THREE from 'three';
import type { CollisionWorld } from '@/game/physics/collision';
import { INTERIOR_FLOORS } from './guzor/network';

export type InteriorKind = 'home' | 'shop' | 'bank' | 'restaurant' | 'office' | 'workshop' | 'showroom';
export interface InteriorSpot { x: number; z: number; label: string; action: 'exit' | 'sleep' | 'wardrobe' | 'garage' | 'food' | 'accessories' | 'bank' | 'osh' | 'jobs' | 'realty' | 'service' | 'dealership' }
export interface Interior { kind: InteriorKind; title: string; height?: number; group: THREE.Group; spawn: { x: number; z: number; h: number }; spots: InteriorSpot[]; lights: THREE.Light[] }

/** small canvas texture helper */
function tex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat: [number, number] = [1, 1]) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 4;
  return t;
}

const parquet = () => tex(256, 256, (g) => {
  for (let y = 0; y < 256; y += 32)
    for (let x = 0; x < 256; x += 128) {
      const o = (y / 32) % 2 ? 64 : 0;
      const l = 120 + Math.random() * 40;
      g.fillStyle = `rgb(${l},${l * 0.68},${l * 0.42})`;
      g.fillRect(x + o, y, 128, 32);
      g.fillRect(x + o - 256, y, 128, 32);
      g.strokeStyle = 'rgba(40,24,12,0.5)';
      g.strokeRect(x + o + 0.5, y + 0.5, 127, 31);
      for (let k = 0; k < 6; k++) {
        g.strokeStyle = `rgba(60,36,18,${0.08 + Math.random() * 0.1})`;
        g.beginPath();
        g.moveTo(x + o, y + 4 + k * 5);
        g.lineTo(x + o + 128, y + 4 + k * 5 + (Math.random() - 0.5) * 3);
        g.stroke();
      }
    }
}, [3, 3]);

const tiles = () => tex(256, 256, (g) => {
  g.fillStyle = '#d9d6cf';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 64)
    for (let x = 0; x < 256; x += 64) {
      const l = 210 + Math.random() * 18;
      g.fillStyle = `rgb(${l},${l - 3},${l - 8})`;
      g.fillRect(x + 1, y + 1, 62, 62);
    }
}, [4, 4]);

const plaster = (c: string) => tex(128, 128, (g) => {
  g.fillStyle = c;
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.04})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
}, [3, 1]);

/** Uzbek-style carpet (gilam): maroon field, medallions and a border */
const gilam = () => tex(512, 320, (g) => {
  g.fillStyle = '#7a1f22';
  g.fillRect(0, 0, 512, 320);
  g.fillStyle = '#1f2f5a';
  g.fillRect(14, 14, 484, 292);
  g.fillStyle = '#7a1f22';
  g.fillRect(34, 34, 444, 252);
  for (let i = 0; i < 3; i++) {
    const cx = 128 + i * 128, cy = 160;
    g.fillStyle = i % 2 ? '#d8b25a' : '#e8e0c8';
    g.beginPath();
    g.moveTo(cx, cy - 70); g.lineTo(cx + 50, cy); g.lineTo(cx, cy + 70); g.lineTo(cx - 50, cy);
    g.closePath();
    g.fill();
    g.fillStyle = '#1f2f5a';
    g.beginPath();
    g.moveTo(cx, cy - 36); g.lineTo(cx + 26, cy); g.lineTo(cx, cy + 36); g.lineTo(cx - 26, cy);
    g.closePath();
    g.fill();
  }
  g.strokeStyle = '#d8b25a';
  g.lineWidth = 3;
  for (let x = 22; x < 500; x += 16) {
    g.beginPath();
    g.moveTo(x, 18); g.lineTo(x + 8, 28); g.lineTo(x + 16, 18);
    g.stroke();
  }
});

export class Interiors {
  readonly list: Record<InteriorKind, Interior>;

  constructor(private scene: THREE.Scene, private col: CollisionWorld) {
    this.list = {
      home: this.buildHome(-3300, -2300), shop: this.buildShop(-3300, -2380), bank: this.buildBank(-3300, -2460), restaurant: this.buildRestaurant(-3300, -2540),
      office: this.buildOffice(-3300, -2620), workshop: this.buildWorkshop(-3300, -2700), showroom: this.buildShowroom(-3300, -2780),
    };
    for (const it of Object.values(this.list)) {
      it.group.visible = false;
      scene.add(it.group);
    }
  }

  private floors: Record<'wood' | 'tiles', THREE.MeshStandardMaterial[]> = { wood: [], tiles: [] };
  /** photographic floor textures (ambientCG) when available */
  applyFloor(kind: 'wood' | 'tiles', color: THREE.Texture, normal: THREE.Texture | null, rough: THREE.Texture | null) {
    for (const m of this.floors[kind]) {
      m.map = color;
      m.normalMap = normal;
      if (rough) { m.roughnessMap = rough; m.roughness = 1; }
      m.color.set('#ffffff');
      m.needsUpdate = true;
    }
  }

  setActive(kind: InteriorKind | null) {
    for (const it of Object.values(this.list)) {
      const on = it.kind === kind;
      it.group.visible = on;
      it.lights.forEach((l) => (l.visible = on));
    }
  }

  private floor(kind: 'wood' | 'tiles') {
    const m = new THREE.MeshStandardMaterial({ map: kind === 'wood' ? parquet() : tiles(), roughness: kind === 'wood' ? 0.55 : 0.35 });
    this.floors[kind].push(m);
    return m;
  }

  private simple(kind: InteriorKind, title: string, ox: number, oz: number, W: number, D: number, H: number, floor: 'wood' | 'tiles', wall: string, furnish: (g: THREE.Group, lights: THREE.Light[]) => InteriorSpot[]): Interior {
    const doorX = ox;
    const g = this.room(ox, oz, W, D, H, this.floor(floor), new THREE.MeshStandardMaterial({ map: plaster(wall), roughness: 0.9 }), doorX);
    const lights: THREE.Light[] = [];
    const spots = furnish(g, lights);
    this.window(g, ox - W / 4, oz + D / 2 - 0.12, Math.PI);
    this.window(g, ox + W / 4, oz + D / 2 - 0.12, Math.PI);
    return { kind, title, height: H, group: g, lights, spawn: { x: doorX, z: oz + D / 2 - 1.2, h: Math.PI }, spots: [{ x: doorX, z: oz + D / 2 - 0.6, label: 'Ko‘chaga chiqish', action: 'exit' }, ...spots] };
  }

  private chair(g: THREE.Group, mat: THREE.Material, x: number, z: number, rot: number) {
    const c = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.05, 0.45), mat);
    seat.position.y = 0.45;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.05), mat);
    back.position.set(0, 0.7, -0.2);
    c.add(seat, back);
    for (const [lx, lz] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.45, 0.04), mat);
      leg.position.set(lx, 0.225, lz);
      c.add(leg);
    }
    c.position.set(x, 0, z);
    c.rotation.y = rot;
    c.traverse((o) => ((o as THREE.Mesh).castShadow = true));
    g.add(c);
  }

  // ------------------------------------------------------------ bank, restaurant, office, workshop, showroom
  private buildBank(ox: number, oz: number) {
    return this.simple('bank', 'Bank', ox, oz, 14, 10, 3.6, 'tiles', '#ece8e0', (g, lights) => {
      const wood = new THREE.MeshStandardMaterial({ color: '#5d3d26', roughness: 0.45 });
      const glass = new THREE.MeshStandardMaterial({ color: '#d8ecf5', transparent: true, opacity: 0.35, roughness: 0.05 });
      this.box(g, wood, ox, 0, oz - 2.2, 10, 1.1, 0.8);
      for (const x of [-3.3, 0, 3.3]) {
        this.box(g, glass, ox + x, 1.1, oz - 2.2, 3.1, 0.9, 0.04, false, false);
        this.box(g, new THREE.MeshStandardMaterial({ color: '#141414', emissive: '#1d3550', emissiveIntensity: 0.6 }), ox + x, 1.1, oz - 2.5, 0.5, 0.35, 0.04, false);
      }
      for (let k = 0; k < 6; k++) this.chair(g, wood, ox - 5 + k * 0.6, oz + 2.6, Math.PI);
      this.box(g, new THREE.MeshStandardMaterial({ color: '#2f6b3f', roughness: 0.4 }), ox + 5.6, 0, oz + 2.8, 0.8, 1.8, 0.6);
      this.box(g, new THREE.MeshStandardMaterial({ color: '#111', emissive: '#3c8f5a', emissiveIntensity: 0.8 }), ox + 5.6, 1.1, oz + 2.48, 0.5, 0.4, 0.02, false);
      for (const x of [-4, 0, 4]) this.lamp(g, ox + x, 3.6, oz, 10, lights);
      return [{ x: ox, z: oz - 1.4, label: 'Kassir: hisob, omonat, kredit', action: 'bank' }, { x: ox + 5.6, z: oz + 2.0, label: 'Bankomat', action: 'bank' }];
    });
  }

  private buildRestaurant(ox: number, oz: number) {
    return this.simple('restaurant', 'Osh markazi', ox, oz, 15, 11, 3.4, 'wood', '#efe2cc', (g, lights) => {
      const wood = new THREE.MeshStandardMaterial({ color: '#7a4e2c', roughness: 0.5 });
      const cloth = new THREE.MeshStandardMaterial({ color: '#f2efe6', roughness: 0.8 });
      for (const [tx, tz] of [[-4.5, -1.5], [-1.5, -1.5], [1.5, -1.5], [-4.5, 1.6], [-1.5, 1.6]]) {
        this.box(g, cloth, ox + tx, 0, oz + tz, 1.4, 0.76, 0.9);
        for (const s of [-1, 1]) for (const k of [-0.35, 0.35]) this.chair(g, wood, ox + tx + k, oz + tz + s * 0.75, s > 0 ? Math.PI : 0);
      }
      // tapchan (raised seating platform) with a carpet and low table
      this.box(g, wood, ox + 4.6, 0, oz + 1.8, 3, 0.45, 2.4);
      const carpet = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.2).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: gilam(), roughness: 0.95 }));
      carpet.position.set(ox + 4.6, 0.46, oz + 1.8);
      g.add(carpet);
      this.box(g, wood, ox + 4.6, 0.45, oz + 1.8, 1.2, 0.3, 0.8, false);
      // kitchen: big kazan on a stove
      this.box(g, new THREE.MeshStandardMaterial({ color: '#3a3a3a', roughness: 0.6 }), ox + 5, 0, oz - 3.6, 3, 0.8, 1.6);
      const kazan = new THREE.Mesh(new THREE.SphereGeometry(0.6, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#1c1c1c', metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide }));
      kazan.position.set(ox + 5, 1.38, oz - 3.6);
      g.add(kazan);
      const osh = new THREE.Mesh(new THREE.CircleGeometry(0.56, 24).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#c98a3c', roughness: 0.9 }));
      osh.position.set(ox + 5, 1.3, oz - 3.6);
      g.add(osh);
      const wallRug = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.9), new THREE.MeshStandardMaterial({ map: gilam(), roughness: 0.95 }));
      wallRug.position.set(ox - 3, 1.8, oz - 5.38);
      g.add(wallRug);
      for (const x of [-4, 0, 4]) this.lamp(g, ox + x, 3.4, oz, 9, lights);
      return [{ x: ox + 3.4, z: oz - 2.4, label: 'Osh buyurtma qilish', action: 'osh' }];
    });
  }

  private buildOffice(ox: number, oz: number) {
    return this.simple('office', 'Idora', ox, oz, 14, 10, 3.2, 'tiles', '#e6e9ec', (g, lights) => {
      const desk = new THREE.MeshStandardMaterial({ color: '#d9d4c8', roughness: 0.5 });
      const dark = new THREE.MeshStandardMaterial({ color: '#2b2f36', roughness: 0.6 });
      const screen = new THREE.MeshStandardMaterial({ color: '#111', emissive: '#4a78b8', emissiveIntensity: 0.7 });
      for (const [x, z] of [[-4, -2.4], [0, -2.4], [4, -2.4], [-4, 1], [4, 1]]) {
        this.box(g, desk, ox + x, 0, oz + z, 1.8, 0.75, 0.8);
        this.box(g, screen, ox + x, 0.75, oz + z - 0.2, 0.6, 0.38, 0.04, false);
        this.chair(g, dark, ox + x, oz + z + 0.7, Math.PI);
      }
      this.box(g, dark, ox - 6.2, 0, oz - 3, 0.6, 2, 3);
      for (const x of [-4, 0, 4]) this.lamp(g, ox + x, 3.2, oz, 9, lights);
      return [
        { x: ox - 4, z: oz - 1.4, label: 'Mehnat birjasi: ishlar', action: 'jobs' },
        { x: ox + 4, z: oz - 1.4, label: 'Ko‘chmas mulk agentligi', action: 'realty' },
      ];
    });
  }

  private buildWorkshop(ox: number, oz: number) {
    return this.simple('workshop', 'Avtoservis', ox, oz, 16, 12, 5, 'tiles', '#cfcfcb', (g, lights) => {
      const red = new THREE.MeshStandardMaterial({ color: '#b3302a', roughness: 0.5, metalness: 0.3 });
      const steel = new THREE.MeshStandardMaterial({ color: '#8a8f96', metalness: 0.7, roughness: 0.35 });
      const rubber = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.9 });
      // two-post car lift
      for (const x of [-2.2, 2.2]) this.box(g, steel, ox + x, 0, oz - 1, 0.35, 3.2, 0.35);
      this.box(g, steel, ox, 1.6, oz - 1, 4.2, 0.12, 4.4, false);
      for (let k = 0; k < 5; k++) this.box(g, red, ox - 7 + k * 0.8, 0, oz - 5.3, 0.75, 1.1, 0.6);
      this.box(g, steel, ox + 5.5, 0, oz - 5.2, 3, 0.9, 0.8);
      for (let k = 0; k < 5; k++) {
        const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.12, 10, 20).rotateX(Math.PI / 2), rubber);
        tyre.position.set(ox + 6.8, 0.12 + k * 0.24, oz + 3.8);
        tyre.castShadow = true;
        g.add(tyre);
      }
      for (const x of [-4, 0, 4]) this.lamp(g, ox + x, 5, oz, 14, lights);
      return [{ x: ox + 5.5, z: oz - 4.2, label: 'Usta: ta’mir, tyuning, garaj', action: 'service' }];
    });
  }

  private buildShowroom(ox: number, oz: number) {
    return this.simple('showroom', 'Avtosalon', ox, oz, 18, 13, 4.2, 'tiles', '#f2f2f0', (g, lights) => {
      const plinth = new THREE.MeshStandardMaterial({ color: '#d5d7da', metalness: 0.2, roughness: 0.25 });
      for (const x of [-4.5, 4.5]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.18, 40), plinth);
        p.position.set(ox + x, 0.09, oz - 1.5);
        p.receiveShadow = true;
        g.add(p);
        this.col.addCentered(ox + x, oz - 1.5, 5.2, 5.2, 1.5);
      }
      const wood = new THREE.MeshStandardMaterial({ color: '#2f2f33', roughness: 0.4 });
      this.box(g, wood, ox, 0, oz + 3.6, 3, 0.95, 0.9);
      this.chair(g, wood, ox - 0.6, oz + 4.6, Math.PI);
      this.chair(g, wood, ox + 0.6, oz + 4.6, Math.PI);
      for (const x of [-6, 0, 6]) this.lamp(g, ox + x, 4.2, oz, 14, lights);
      return [{ x: ox, z: oz + 2.8, label: 'Sotuvchi: mashinalar katalogi', action: 'dealership' }];
    });
  }

  // ------------------------------------------------------------ helpers
  private box(g: THREE.Group, mat: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, collide = true, cast = true) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = cast;
    m.receiveShadow = true;
    g.add(m);
    if (collide) this.col.addCentered(x, z, w, d, h);
    return m;
  }

  private room(ox: number, oz: number, W: number, D: number, H: number, floorMat: THREE.Material, wallMat: THREE.Material, doorX: number) {
    const g = new THREE.Group();
    const ceil = new THREE.MeshStandardMaterial({ color: '#f1efe9', roughness: 0.95 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), floorMat);
    floor.position.set(ox, 0, oz);
    floor.receiveShadow = true;
    g.add(floor);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(Math.PI / 2), ceil);
    top.position.set(ox, H, oz);
    g.add(top);
    const T = 0.2;
    // back, left, right walls
    this.box(g, wallMat, ox, 0, oz - D / 2, W, H, T, true, false);
    this.box(g, wallMat, ox - W / 2, 0, oz, T, H, D, true, false);
    this.box(g, wallMat, ox + W / 2, 0, oz, T, H, D, true, false);
    // front wall with a door opening
    const dl = doorX - 0.6 - (ox - W / 2), dr = ox + W / 2 - (doorX + 0.6);
    this.box(g, wallMat, ox - W / 2 + dl / 2, 0, oz + D / 2, dl, H, T, true, false);
    this.box(g, wallMat, ox + W / 2 - dr / 2, 0, oz + D / 2, dr, H, T, true, false);
    this.box(g, wallMat, doorX, 2.2, oz + D / 2, 1.2, H - 2.2, T, false, false);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.15, 0.06), new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.6 }));
    door.position.set(doorX, 1.08, oz + D / 2 + 0.06);
    g.add(door);
    this.col.addCentered(doorX, oz + D / 2 + 0.2, 1.2, 0.3, H);
    // skirting
    const skirt = new THREE.MeshStandardMaterial({ color: '#4a3424', roughness: 0.7 });
    this.box(g, skirt, ox, 0, oz - D / 2 + 0.11, W, 0.1, 0.02, false, false);
    INTERIOR_FLOORS.push({ x0: ox - W / 2 - 0.5, z0: oz - D / 2 - 0.5, x1: ox + W / 2 + 0.5, z1: oz + D / 2 + 1.5, y: 0 });
    return g;
  }

  private window(g: THREE.Group, x: number, z: number, rotY: number) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.3, 0.08), new THREE.MeshStandardMaterial({ color: '#f4f4f0', roughness: 0.4 }));
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 1.15), new THREE.MeshStandardMaterial({ color: '#bcd6ea', emissive: '#9cc4e4', emissiveIntensity: 0.9, roughness: 0.1 }));
    frame.position.set(x, 1.6, z);
    frame.rotation.y = rotY;
    glass.position.set(0, 0, 0.05);
    frame.add(glass);
    g.add(frame);
  }

  private lamp(g: THREE.Group, x: number, y: number, z: number, intensity: number, lights: THREE.Light[]) {
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 0.12, 20), new THREE.MeshStandardMaterial({ color: '#fff8e8', emissive: '#ffe9c2', emissiveIntensity: 1.4 }));
    shade.position.set(x, y - 0.08, z);
    g.add(shade);
    const l = new THREE.PointLight('#ffe7c4', intensity, 14, 1.6);
    l.position.set(x, y - 0.3, z);
    l.visible = false;
    g.add(l);
    lights.push(l);
  }

  // ------------------------------------------------------------ home: living room + bedroom corner + kitchen
  private buildHome(ox: number, oz: number): Interior {
    const W = 11, D = 8.5, H = 3, doorX = ox + 3.4;
    const g = this.room(ox, oz, W, D, H, this.floor('wood'), new THREE.MeshStandardMaterial({ map: plaster('#e9e1d2'), roughness: 0.92 }), doorX);
    const lights: THREE.Light[] = [];
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.8).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: gilam(), roughness: 0.95 }));
    carpet.position.set(ox - 1.6, 0.01, oz + 0.3);
    carpet.receiveShadow = true;
    g.add(carpet);
    const fabric = new THREE.MeshStandardMaterial({ color: '#5b6b7a', roughness: 0.9 });
    const wood = new THREE.MeshStandardMaterial({ color: '#6b4428', roughness: 0.55 });
    const white = new THREE.MeshStandardMaterial({ color: '#ecebe6', roughness: 0.45 });
    // sofa + low table (xontaxta) with bread and tea
    this.box(g, fabric, ox - 1.6, 0, oz - 2.2, 2.6, 0.45, 0.9);
    this.box(g, fabric, ox - 1.6, 0.45, oz - 2.55, 2.6, 0.5, 0.2, false);
    this.box(g, wood, ox - 1.6, 0, oz + 0.3, 1.6, 0.42, 0.9);
    const bread = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 24), new THREE.MeshStandardMaterial({ color: '#c58b4a', roughness: 0.8 }));
    bread.position.set(ox - 1.9, 0.45, oz + 0.3);
    g.add(bread);
    const pot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), new THREE.MeshStandardMaterial({ color: '#2f5fa8', roughness: 0.3 }));
    pot.position.set(ox - 1.2, 0.52, oz + 0.35);
    g.add(pot);
    // TV unit
    this.box(g, wood, ox - 1.6, 0, oz + 3.9, 2.2, 0.5, 0.45);
    const tv = this.box(g, new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.2, emissive: '#1d3550', emissiveIntensity: 0.5 }), ox - 1.6, 0.5, oz + 3.95, 1.5, 0.85, 0.06, false);
    tv.castShadow = false;
    // bed with blanket (bedroom corner)
    this.box(g, wood, ox + 3.6, 0, oz - 2.6, 2.0, 0.45, 2.3);
    this.box(g, new THREE.MeshStandardMaterial({ color: '#8b2f3a', roughness: 0.9 }), ox + 3.6, 0.45, oz - 2.4, 1.9, 0.12, 1.8, false);
    this.box(g, white, ox + 3.6, 0.45, oz - 3.5, 1.7, 0.16, 0.45, false);
    // wardrobe
    this.box(g, wood, ox + 1.4, 0, oz - 3.85, 1.8, 2.2, 0.6);
    // kitchen counter + fridge
    this.box(g, white, ox - 4.2, 0, oz - 2.6, 1.6, 0.9, 2.6);
    this.box(g, new THREE.MeshStandardMaterial({ color: '#2b2b2b', roughness: 0.3 }), ox - 4.2, 0.9, oz - 2.6, 1.62, 0.04, 2.62, false);
    this.box(g, white, ox - 4.5, 0, oz - 0.6, 0.8, 1.9, 0.75);
    this.window(g, ox - 1.6, oz - D / 2 + 0.12, 0);
    this.window(g, ox - W / 2 + 0.12, oz + 1.2, Math.PI / 2);
    this.window(g, ox + W / 2 - 0.12, oz + 1.5, -Math.PI / 2);
    this.lamp(g, ox - 1.6, H, oz + 0.3, 14, lights);
    this.lamp(g, ox + 3.2, H, oz - 2, 9, lights);
    this.lamp(g, ox - 3.8, H, oz - 2, 7, lights);
    return {
      kind: 'home', title: 'Uyingiz', height: H, group: g, lights,
      spawn: { x: doorX, z: oz + D / 2 - 1.2, h: Math.PI },
      spots: [
        { x: doorX, z: oz + D / 2 - 0.6, label: 'Ko‘chaga chiqish', action: 'exit' },
        { x: ox + 3.6, z: oz - 1.2, label: 'Uxlash va saqlash', action: 'sleep' },
        { x: ox + 1.4, z: oz - 3.0, label: 'Kiyim javoni', action: 'wardrobe' },
        { x: ox - 3.0, z: oz - 0.6, label: 'Garaj', action: 'garage' },
      ],
    };
  }

  // ------------------------------------------------------------ shop: shelves, fridge, till
  private buildShop(ox: number, oz: number): Interior {
    const W = 14, D = 10, H = 3.4, doorX = ox;
    const g = this.room(ox, oz, W, D, H, this.floor('tiles'), new THREE.MeshStandardMaterial({ map: plaster('#f0ede6'), roughness: 0.9 }), doorX);
    const lights: THREE.Light[] = [];
    const metal = new THREE.MeshStandardMaterial({ color: '#c9ccd0', metalness: 0.6, roughness: 0.35 });
    const colors = ['#c8423b', '#2f6db0', '#e0b13a', '#3f8a4a', '#f0f0e8', '#7a3fa0', '#e07a2a', '#2a9aa8'];
    const prodGeo = new THREE.BoxGeometry(0.22, 0.3, 0.18);
    const prodMat = new THREE.MeshStandardMaterial({ roughness: 0.5 });
    let count = 0;
    const shelves: [number, number][] = [[-3.6, -1.5], [0, -1.5], [3.6, -1.5], [-3.6, 1.6], [3.6, 1.6]];
    const items = new THREE.InstancedMesh(prodGeo, prodMat, shelves.length * 3 * 2 * 12);
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    for (const [sx, sz] of shelves) {
      this.box(g, metal, ox + sx, 0, oz + sz, 2.6, 1.8, 0.6);
      for (let level = 0; level < 3; level++)
        for (const side of [-1, 1])
          for (let k = 0; k < 12; k++) {
            m4.makeTranslation(ox + sx - 1.2 + k * 0.215, 0.3 + level * 0.55 + 0.15, oz + sz + side * 0.32);
            items.setMatrixAt(count, m4);
            items.setColorAt(count, col.set(colors[(k + level * 3 + (sx > 0 ? 2 : 0)) % colors.length]));
            count++;
          }
    }
    items.castShadow = true;
    g.add(items);
    // fridge wall
    const glass = new THREE.MeshStandardMaterial({ color: '#cfe6f2', emissive: '#bfe3ff', emissiveIntensity: 0.6, roughness: 0.08, transparent: true, opacity: 0.8 });
    this.box(g, metal, ox - 5.8, 0, oz - 2, 1.2, 2.1, 4.8);
    this.box(g, glass, ox - 5.18, 0.1, oz - 2, 0.04, 1.9, 4.6, false, false);
    // till / counter
    const wood = new THREE.MeshStandardMaterial({ color: '#7a5434', roughness: 0.5 });
    this.box(g, wood, ox + 4.8, 0, oz + 3.2, 2.6, 1.0, 0.8);
    this.box(g, new THREE.MeshStandardMaterial({ color: '#222', roughness: 0.3 }), ox + 4.6, 1.0, oz + 3.2, 0.4, 0.3, 0.3, false);
    // clothes rail (do‘ppi, caps, glasses)
    this.box(g, metal, ox - 4.4, 0, oz + 3.6, 2.4, 1.6, 0.4);
    for (let k = 0; k < 6; k++) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.09, 4), new THREE.MeshStandardMaterial({ color: k % 2 ? '#111' : '#2a5a8a', roughness: 0.8 }));
      cap.position.set(ox - 5.3 + k * 0.36, 1.66, oz + 3.6);
      cap.rotation.y = Math.PI / 4;
      g.add(cap);
    }
    this.window(g, ox - 3.6, oz + D / 2 - 0.12, Math.PI);
    this.window(g, ox + 3.6, oz + D / 2 - 0.12, Math.PI);
    for (const x of [-4, 0, 4]) this.lamp(g, ox + x, H, oz, 10, lights);
    return {
      kind: 'shop', title: 'Bozor do‘koni', height: H, group: g, lights,
      spawn: { x: doorX, z: oz + D / 2 - 1.2, h: Math.PI },
      spots: [
        { x: doorX, z: oz + D / 2 - 0.6, label: 'Ko‘chaga chiqish', action: 'exit' },
        { x: ox + 4.8, z: oz + 2.4, label: 'Oziq-ovqat xarid qilish', action: 'food' },
        { x: ox - 4.4, z: oz + 2.9, label: 'Kiyim va aksessuarlar', action: 'accessories' },
      ],
    };
  }
}
