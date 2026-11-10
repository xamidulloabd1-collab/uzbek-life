import * as THREE from 'three';

/** sky cloud layer: billboards of a CC0 cloud photo (pmndrs/assets), drifting with the wind, lit by time of day */
export class Clouds {
  readonly group = new THREE.Group();
  private items: { s: THREE.Sprite; bx: number; by: number; bz: number }[] = [];
  private drift = 0;
  private tint = new THREE.Color();

  constructor(tex: THREE.Texture, count = 44) {
    tex.colorSpace = THREE.SRGBColorSpace;
    const rng = (() => { let a = 1234567; return () => ((a = (a * 16807) % 2147483647) / 2147483647); })();
    for (let i = 0; i < count; i++) {
      const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, opacity: 0.6 });
      const s = new THREE.Sprite(m);
      const a = rng() * Math.PI * 2, r = 700 + rng() * 2700;
      const k = 520 + rng() * 760;
      s.scale.set(k, k * (0.36 + rng() * 0.14), 1);
      s.material.rotation = (rng() - 0.5) * 0.25;
      s.renderOrder = -1;
      this.items.push({ s, bx: Math.cos(a) * r, by: 520 + rng() * 420, bz: Math.sin(a) * r });
      this.group.add(s);
    }
  }

  /** cover 0..1 (clear → overcast), rain 0..1, daylight 0..1, horizon = current sky horizon colour */
  update(dt: number, cam: THREE.Vector3, cover: number, rain: number, daylight: number, horizon: THREE.Color) {
    this.drift += dt * (5 + rain * 6);
    const visible = Math.min(this.items.length, Math.round(this.items.length * (0.35 + cover * 0.65)));
    const bright = 0.18 + daylight * 0.82;
    this.tint.setRGB(bright, bright, bright * 1.04).lerp(horizon, 0.28 * (1 - daylight * 0.5)).multiplyScalar(1 - rain * 0.42 - cover * 0.12);
    this.items.forEach((it, i) => {
      const x = ((((it.bx + this.drift) % 6800) + 6800) % 6800) - 3400;
      it.s.position.set(cam.x + x, it.by, cam.z + it.bz);
      it.s.visible = i < visible;
      const m = it.s.material;
      m.opacity = 0.45 + cover * 0.4;
      m.color.copy(this.tint);
    });
  }
}
