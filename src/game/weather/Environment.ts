import * as THREE from 'three';
import type { WeatherKind } from '@/types';
import { SHADOW_MAP_SIZE, SHADOW_RANGE } from '@/config/graphics';
import { clamp, damp, smoothstep } from '@/utils/math';
import type { TextureLib } from '@/game/world/textures';

const SKY = {
  dayTop: new THREE.Color('#3f7fcc'),
  dayHorizon: new THREE.Color('#c4d8e8'),
  duskTop: new THREE.Color('#2b3b6a'),
  duskHorizon: new THREE.Color('#f0a46a'),
  nightTop: new THREE.Color('#03060d'),
  nightHorizon: new THREE.Color('#0e1626'),
  greyTop: new THREE.Color('#7d8792'),
  greyHorizon: new THREE.Color('#a9b0b7'),
};

export interface EnvState {
  night: number;
  daylight: number;
  wet: number;
  horizon: THREE.Color;
  rain: number;
}

export class Environment {
  readonly sun = new THREE.DirectionalLight('#fff4e5', 3);
  readonly hemi = new THREE.HemisphereLight('#bcd6f0', '#6b5b45', 1);
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private stars: THREE.Points;
  private clouds: THREE.Mesh;
  private rain: THREE.LineSegments;
  private rainPos: Float32Array;
  private rainCount: number;
  private cloud = 0;
  private rainAmt = 0;
  private fogAmt = 0;
  private wet = 0;
  private shadowRange = 55;
  private fogFar = 450;
  exposureScale = 1;
  readonly state: EnvState = { night: 0, daylight: 1, wet: 0, horizon: new THREE.Color(), rain: 0 };

  constructor(private scene: THREE.Scene, private renderer: THREE.WebGLRenderer, tex: TextureLib, rainDrops: number) {
    scene.fog = new THREE.Fog('#c4d8e8', 150, 450);
    this.sun.target.position.set(0, 0, 0);
    scene.add(this.sun, this.sun.target, this.hemi);

    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color() },
        horizon: { value: new THREE.Color() },
        ground: { value: new THREE.Color('#8a7a5e') },
        sunDir: { value: new THREE.Vector3(0, 1, 0) },
        sunColor: { value: new THREE.Color('#fff2d8') },
        sunAmt: { value: 1 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vDir = wp.xyz - cameraPosition;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 top; uniform vec3 horizon; uniform vec3 ground; uniform vec3 sunDir; uniform vec3 sunColor; uniform float sunAmt;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = h > 0.0 ? mix(horizon, top, pow(clamp(h, 0.0, 1.0), 0.55)) : mix(horizon, ground, clamp(-h * 6.0, 0.0, 1.0));
          float s = max(dot(d, normalize(sunDir)), 0.0);
          col += sunColor * (pow(s, 900.0) * 6.0 + pow(s, 12.0) * 0.35) * sunAmt;
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 32, 16), this.skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    scene.add(this.sky);

    // stars
    const sp: number[] = [];
    for (let n = 0; n < 900; n++) {
      const a = Math.random() * Math.PI * 2;
      const y = Math.random() * 0.95 + 0.05;
      const r = Math.sqrt(1 - y * y);
      sp.push(Math.cos(a) * r * 3500, y * 3500, Math.sin(a) * r * 3500);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    // cloud layer
    const ct = tex.clouds();
    ct.repeat.set(4, 4);
    this.clouds = new THREE.Mesh(
      new THREE.PlaneGeometry(7000, 7000).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: ct, transparent: true, opacity: 0.3, fog: false, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.clouds.position.y = 650;
    this.clouds.frustumCulled = false;
    scene.add(this.clouds);

    // rain streaks around the camera
    this.rainCount = rainDrops;
    this.rainPos = new Float32Array(rainDrops * 6);
    for (let n = 0; n < rainDrops; n++) this.resetDrop(n, Math.random() * 30);
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: '#b6c3cf', transparent: true, opacity: 0, depthWrite: false }));
    this.rain.frustumCulled = false;
    scene.add(this.rain);

    // reflections for car paint / glass
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const eg = new THREE.SphereGeometry(10, 32, 16);
    const cols: number[] = [];
    const p = eg.attributes.position;
    const a = new THREE.Color('#5d8fc7'), b = new THREE.Color('#dde7ef'), c = new THREE.Color('#7a6a52');
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / 10;
      const col = y > 0 ? b.clone().lerp(a, Math.pow(y, 0.6)) : b.clone().lerp(c, Math.min(1, -y * 4));
      cols.push(col.r, col.g, col.b);
    }
    eg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    envScene.add(new THREE.Mesh(eg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    scene.environment = pmrem.fromScene(envScene, 0.02).texture;
    pmrem.dispose();
  }

  private resetDrop(n: number, y: number) {
    const x = (Math.random() - 0.5) * 60, z = (Math.random() - 0.5) * 60;
    const i = n * 6;
    this.rainPos[i] = x; this.rainPos[i + 1] = y; this.rainPos[i + 2] = z;
    this.rainPos[i + 3] = x + 0.08; this.rainPos[i + 4] = y - 0.7; this.rainPos[i + 5] = z;
  }

  applyQuality(shadowLevel: number, renderDistance: number, ultra = false) {
    if (ultra && shadowLevel >= 3) shadowLevel = 4;
    const on = shadowLevel > 0;
    this.renderer.shadowMap.enabled = on;
    this.renderer.shadowMap.type = shadowLevel >= 3 ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.sun.castShadow = on;
    if (on) {
      const size = SHADOW_MAP_SIZE[shadowLevel];
      if (this.sun.shadow.mapSize.x !== size) {
        this.sun.shadow.mapSize.set(size, size);
        this.sun.shadow.map?.dispose();
        this.sun.shadow.map = null;
      }
      this.shadowRange = SHADOW_RANGE[shadowLevel];
      const cam = this.sun.shadow.camera;
      cam.left = cam.bottom = -this.shadowRange;
      cam.right = cam.top = this.shadowRange;
      cam.near = 1;
      cam.far = 500;
      cam.updateProjectionMatrix();
      this.sun.shadow.bias = -0.0004;
      this.sun.shadow.normalBias = 0.03;
    }
    this.fogFar = renderDistance;
  }

  update(dt: number, minutes: number, weather: WeatherKind, camera: THREE.Camera, focus: THREE.Vector3) {
    // weather blending
    const targetCloud = weather === 'clear' ? 0.05 : weather === 'cloudy' ? 0.7 : weather === 'fog' ? 0.55 : 1;
    this.fogAmt = damp(this.fogAmt, weather === 'fog' ? 1 : 0, 0.3, dt);
    const targetRain = weather === 'rain' ? 1 : 0;
    this.cloud = damp(this.cloud, targetCloud, 0.25, dt);
    this.rainAmt = damp(this.rainAmt, targetRain, 0.35, dt);
    this.wet = clamp(this.wet + (this.rainAmt > 0.3 ? dt * 0.05 : -dt * 0.012), 0, 1);

    // sun path: rises in the east (+x), culminates in the south (+z)
    // Qashqadaryo-like long day: sunrise ≈ 05:40, sunset ≈ 19:20, a slower twilight
    const hh = minutes / 60, DAWN = 5.67, DUSK = 19.33;
    const ang = hh >= DAWN && hh <= DUSK ? ((hh - DAWN) / (DUSK - DAWN)) * Math.PI : Math.PI + ((((hh - DUSK) % 24) + 24) % 24 / (24 - (DUSK - DAWN))) * Math.PI;
    const sunDir = new THREE.Vector3(Math.cos(ang), Math.sin(ang) * 0.92, 0.38).normalize();
    const e = sunDir.y;
    const day = smoothstep(-0.08, 0.25, e);
    const dusk = smoothstep(0.35, 0.02, e) * smoothstep(-0.18, 0.02, e);
    const night = 1 - smoothstep(-0.26, 0.05, e);
    const grey = this.cloud * 0.85;

    const top = SKY.nightTop.clone().lerp(SKY.dayTop, day).lerp(SKY.duskTop, dusk * 0.6).lerp(SKY.greyTop.clone().multiplyScalar(0.15 + 0.85 * day), grey);
    const hor = SKY.nightHorizon.clone().lerp(SKY.dayHorizon, day).lerp(SKY.duskHorizon, dusk * 0.85).lerp(SKY.greyHorizon.clone().multiplyScalar(0.15 + 0.85 * day), grey * 0.9);
    const u = this.skyMat.uniforms;
    (u.top.value as THREE.Color).copy(top);
    (u.horizon.value as THREE.Color).copy(hor);
    (u.sunDir.value as THREE.Vector3).copy(sunDir);
    u.sunAmt.value = (1 - this.cloud * 0.9) * smoothstep(-0.05, 0.05, e);
    (u.ground.value as THREE.Color).set('#7d6e55').multiplyScalar(0.1 + 0.9 * day);
    this.sky.position.copy(camera.position);
    this.stars.position.copy(camera.position);
    (this.stars.material as THREE.PointsMaterial).opacity = night * (1 - this.cloud);

    const fog = this.scene.fog as THREE.Fog;
    fog.color.copy(hor).multiplyScalar(0.92);
    // rain pulls the haze in
    // low sun → a little more atmospheric haze (morning / evening)
    fog.far = Math.max(70, this.fogFar * (1 - this.rainAmt * 0.5) * (1 - this.fogAmt * 0.75) * (0.78 + 0.22 * smoothstep(0.05, 0.45, e)));
    fog.near = Math.max(2, fog.far * (0.3 - this.rainAmt * 0.22 - this.fogAmt * 0.25));
    fog.color.lerp(SKY.greyHorizon.clone().multiplyScalar(0.25 + 0.75 * day), this.fogAmt * 0.7);

    // lights
    const sunUp = e > -0.02;
    const lightDir = sunUp ? sunDir : sunDir.clone().negate().setY(Math.abs(sunDir.y) + 0.35).normalize();
    const sunCol = new THREE.Color('#ffd2a0').lerp(new THREE.Color('#fff5e8'), smoothstep(0.05, 0.4, e));
    this.sun.color.copy(sunUp ? sunCol : new THREE.Color('#8fa6d6'));
    this.sun.intensity = sunUp ? 3.1 * smoothstep(-0.02, 0.18, e) * (1 - 0.65 * this.cloud) : 0.6 * night * (1 - this.cloud * 0.7);
    this.hemi.color.copy(hor).lerp(top, 0.5);
    this.hemi.groundColor.set('#6b5b45').multiplyScalar(0.2 + 0.8 * day);
    this.hemi.intensity = 0.22 + day * (1.05 - this.cloud * 0.2) + night * 0.3;
    this.scene.environmentIntensity = 0.12 + 0.8 * day;
    this.renderer.toneMappingExposure = (0.92 - night * 0.12 - this.rainAmt * 0.08) * this.exposureScale;

    // shadow camera follows the focus point, snapped to texels to avoid shimmer
    const step = (this.shadowRange * 2) / Math.max(1, this.sun.shadow.mapSize.x);
    const fx = Math.round(focus.x / step) * step;
    const fz = Math.round(focus.z / step) * step;
    this.sun.target.position.set(fx, 0, fz);
    this.sun.position.set(fx + lightDir.x * 200, lightDir.y * 200, fz + lightDir.z * 200);
    this.sun.target.updateMatrixWorld();

    // clouds
    const cm = this.clouds.material as THREE.MeshBasicMaterial;
    cm.opacity = 0.18 + this.cloud * 0.62;
    cm.color.setScalar(0.25 + 0.75 * day).lerp(new THREE.Color('#7f8892'), this.rainAmt * 0.6);
    cm.map!.offset.x += dt * 0.0012;
    this.clouds.position.x = camera.position.x;
    this.clouds.position.z = camera.position.z;

    // rain
    const rm = this.rain.material as THREE.LineBasicMaterial;
    rm.opacity = this.rainAmt * 0.5;
    this.rain.visible = this.rainAmt > 0.02;
    if (this.rain.visible) {
      const fall = dt * 22;
      for (let n = 0; n < this.rainCount; n++) {
        const i = n * 6;
        this.rainPos[i + 1] -= fall;
        this.rainPos[i + 4] -= fall;
        if (this.rainPos[i + 4] < -2) this.resetDrop(n, 26 + Math.random() * 4);
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
      this.rain.position.set(camera.position.x, camera.position.y - 10, camera.position.z);
    }

    this.state.night = night;
    this.state.daylight = day;
    this.state.wet = Math.max(this.wet, this.rainAmt * 0.6);
    this.state.horizon.copy(hor);
    this.state.rain = this.rainAmt;
    return this.state;
  }
}
