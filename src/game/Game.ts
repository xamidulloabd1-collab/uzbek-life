import * as THREE from 'three';
import type { OwnedVehicle, Settings, Vec2, WeatherKind } from '@/types';
import { useGame, getGame, INITIAL_HUD } from '@/stores/gameStore';
import { PRESETS, DESKTOP_LADDER, MOBILE_LADDER, settingsFromPreset } from '@/config/graphics';
import { ECONOMY, TIME } from '@/config/economy';
import { VEHICLE_MAP, randomPlate, registerVehicles } from '@/config/vehicles';
import { fitVehicleModel } from './vehicles/fitModel';
import { Police } from './npc/Police';
import type { TrafficCarInfo } from './traffic/Traffic';
import type { Obstacle } from './vehicles/VehiclePhysics';
import { spend } from '@/systems/economy/economy';
import { PROPERTY_MAP } from '@/config/properties';
import { VEHICLE_MODELS } from '@/assets/manifest';
import { bundledLibrary, type LibraryEntry } from '@/assets/library';
import { UserAssets } from './engine/UserAssets';
import { Showcase } from './world/Showcase';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { World } from './world/World';
import { Environment } from './weather/Environment';
import { Traffic } from './traffic/Traffic';
import { Pedestrians } from './npc/Pedestrians';
import { Player } from './player/Player';
import { Vehicle } from './vehicles/Vehicle';
import { lowGeometry, lowMats, lowPaint } from './vehicles/vehicleModel';
import { CameraRig } from './camera/CameraRig';
import { InputManager, type InputFrame } from './input/InputManager';
import { AudioManager } from './audio/AudioManager';
import { AssetManager } from './engine/AssetManager';
import { PostFX } from './engine/PostFX';
import { MapRenderer, type MapMarker } from './MapRenderer';
import { PLAYER_SPAWN, POIS, STARTER_CAR, HOME_HEADING, districtNameAt, garageSpawnNear } from './world/cityLayout';
import { tuneAvatarMaterials, type AvatarSource } from './player/Player';
import { NPC_AVATARS } from '@/assets/manifest';
import { zoneAt } from './world/guzor/network';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import sunriseUrl from '@/assets/environment/sunrise.exr?url';
import sunsetUrl from '@/assets/environment/sunset.exr?url';
import nightUrl from '@/assets/environment/night.exr?url';
import cloudUrl from '@/assets/environment/cloud.webp?url';
import { Clouds } from './weather/Clouds';
import { Interiors, type InteriorKind } from './world/Interiors';
import { NAV } from './nav/Navigator';
import { Customer } from './npc/Customer';
import { NET as NETW } from './world/guzor/network';
import { applyPhotoMaterials } from './world/photoMaterials';
import { WorldEvents, eventMods } from '@/systems/events/worldEvents';
import { ACH_MAP, LANDMARKS } from '@/systems/progress/achievements';
import { createOwned, vehicleBridge, refuel } from '@/systems/vehicles/vehicleService';
import { updateMission } from '@/systems/jobs/missions';
import { payDailyIncome } from '@/systems/properties/propertyService';
import { readSave, writeSave, SAVE_VERSION, type SaveData } from '@/systems/save/save';
import { clamp, dampAngle, formatSom } from '@/utils/math';

interface Interaction {
  label: string;
  run: () => void;
}

/** opening hours (24 h) of services; fuel stations and homes are always open */
const OPEN_HOURS: Partial<Record<string, [number, number]>> = { bank: [9, 18], jobs: [8, 20], realty: [9, 18], dealership: [9, 20], service: [8, 20], osh: [7, 23], bazaar: [6, 20], warehouse: [7, 21] };

export class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(58, 1, 0.5, 10000);
  readonly rig: CameraRig;
  readonly input = new InputManager();
  readonly audio = new AudioManager();
  readonly assets: AssetManager;
  readonly map = new MapRenderer();
  readonly post: PostFX;
  world!: World;
  env!: Environment;
  traffic!: Traffic;
  peds!: Pedestrians;
  player!: Player;
  vehicle: Vehicle | null = null;
  inVehicle = false;
  interiorCam = false;
  private interiorYaw = 0;
  private playing = false;
  private raf = 0;
  private last = 0;
  private minutes: number = TIME.startMinutes;
  private hudTimer = 0;
  private pullTimer = 0;
  private saveTimer = 0;
  private weatherTimer = 600;
  private fpsAcc = 0;
  private fpsFrames = 0;
  private fps = 60;
  private dynScale = 1;
  private dynTimer = 0;
  private minimap: HTMLCanvasElement | null = null;
  private missionBeam!: THREE.Group;
  private waypointBeam!: THREE.Group;
  private brokenCar!: THREE.Group;
  private interaction: Interaction | null = null;
  private vehicleAction: Interaction | null = null;
  private unsub: (() => void)[] = [];
  private suppressSync = false;
  private lastPauseAt = 0;
  private builtShadows = false;
  /** one shared headlight that exists from the first frame, so adding cars never forces shader recompiles */
  private headlight = new THREE.SpotLight('#fff3dc', 0, 60, 0.6, 0.55, 1.5);
  readonly maxTraffic: number;
  readonly maxPeds: number;
  ready = false;
  showcase!: Showcase;
  police!: Police;
  /** vehicle the player is currently driving (owned or a temporarily used NPC car) */
  drivingV: Vehicle | null = null;
  get dv() {
    return this.drivingV;
  }
  readonly borrowed: { v: Vehicle; from: 'parked' | 'traffic' }[] = [];
  private minigame: { pk: World['parked'][number]; needle: number; dir: number; zone: [number, number]; tries: number } | null = null;
  private wantedCool = 0;
  private restriction: string | null = null;
  private energy = 100;
  private lastRam = 0;
  /** image-based lighting per time of day (CC0 HDRIs) */
  private envMaps: Record<string, THREE.Texture> = {};
  private envKey = 'day';
  private envTimer = 0;
  private skyClouds: Clouds | null = null;
  private worldEvents = new WorldEvents();
  private progressTimer = 0;
  interiors!: Interiors;
  /** inside a building: which one and where to return on the street */
  interior: { kind: InteriorKind; ret: { x: number; z: number; h: number } } | null = null;
  private rhythmTimer = 0;
  /** visible taxi passenger of the current taxi order */
  customer: Customer | null = null;
  photoMaterials: string[] = [];
  /** ids of vehicles added from public/assets/vehicles/catalog.json */
  catalogIds: string[] = [];
  private loadingModels = new Map<string, Promise<void>>();
  private libraryVehicleIds = new Set<string>();
  private parkedSwaps = new Map<World['parked'][number], THREE.Object3D>();
  private parkedTimer = 0;
  readonly vehicleGLB = new Map<string, { gltf: GLTF; rotate: number }>();
  libraryReport: { slot: string; kind: string; name: string; origin: string; ok: boolean; triangles: number; license: LibraryEntry['license']; error?: string }[] = [];
  readonly perf = { fps: 0, frameMs: 0, calls: 0, triangles: 0 };

  constructor(private canvas: HTMLCanvasElement) {
    const s = getGame().settings;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: s.antialias && !PRESETS[s.preset].bloom, powerPreference: 'high-performance', stencil: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.rig = new CameraRig(this.camera);
    this.assets = new AssetManager(this.renderer);
    this.post = new PostFX(this.renderer, this.scene, this.camera);
    const mobile = getGame().device.mobile;
    this.maxTraffic = mobile ? 14 : 28;
    this.maxPeds = mobile ? 18 : 50;
  }

  /** heavy construction; call after the loading screen has painted */
  async init(onStep: (label: string) => void) {
    const __t0 = performance.now();
    let __last = __t0, __lastName = 'start';
    const __times: Record<string, number> = {};
    (window as unknown as { __initTimes: unknown }).__initTimes = __times;
    const __step = onStep;
    onStep = (m: string) => { const t = performance.now(); __times[__lastName] = Math.round(t - __last); __last = t; __lastName = m; __step(m); };

    const s = getGame().settings;
    const P = PRESETS[s.preset];
    onStep('Mashinalar katalogi…');
    try {
      const base = `${import.meta.env.BASE_URL}assets/vehicles/`;
      if (!/^https?:$/.test(location.protocol)) throw new Error('no http');
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 1200);
      const r = await fetch(`${base}catalog.json`, { cache: 'no-cache', signal: ac.signal });
      clearTimeout(timer);
      if (r.ok) this.catalogIds = registerVehicles(((await r.json()) as { vehicles?: [] }).vehicles ?? [], base);
    } catch {
      /* single-file build or offline: built-in vehicles only */
    }
    onStep('Shahar qurilmoqda…');
    await new Promise((r) => setTimeout(r, 30));
    this.builtShadows = s.shadows > 0;
    this.world = new World(P.textureSize, this.builtShadows, P.treeShadows, P.treeDetail);
    this.scene.add(this.world.group);
    this.interiors = new Interiors(this.scene, this.world.col);
    this.scene.add(NAV.mesh);
    // photographic CC0 materials, when `npm run assets:fetch` has been run (multi-file build only)
    void applyPhotoMaterials(this.world, this.interiors).then((a) => { this.photoMaterials = a; if (a.length) console.info('[materials]', a.join(', ')); });
    onStep('Osmon va yorug‘lik…');
    await new Promise((r) => setTimeout(r, 10));
    this.env = new Environment(this.scene, this.renderer, this.world.tex, P.rainDrops);
    const hdr = await this.assets.loadHDR('env.day');
    if (hdr) {
      const pm = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pm.fromEquirectangular(hdr).texture;
      this.envMaps.day = this.scene.environment;
      hdr.dispose();
      pm.dispose();
    }
    // sunrise / sunset / night lighting and the cloud layer load in the background
    void (async () => {
      const pm = new THREE.PMREMGenerator(this.renderer);
      for (const [k, url] of [['sunrise', sunriseUrl], ['sunset', sunsetUrl], ['night', nightUrl]] as const) {
        try {
          const t = await new EXRLoader().loadAsync(url);
          t.mapping = THREE.EquirectangularReflectionMapping;
          this.envMaps[k] = pm.fromEquirectangular(t).texture;
          t.dispose();
        } catch (err) {
          console.warn('[env]', k, err);
        }
      }
      pm.dispose();
      try {
        const tex = await new THREE.TextureLoader().loadAsync(cloudUrl);
        this.skyClouds = new Clouds(tex);
        this.scene.add(this.skyClouds.group);
      } catch (err) {
        console.warn('[clouds]', err);
      }
    })();
    onStep('Aholi va transport…');
    this.traffic = new Traffic(this.maxTraffic);
    this.peds = new Pedestrians(this.maxPeds);
    this.police = new Police(this.world.tex, this.scene);
    this.traffic.onNeedModel = (id) => void this.ensureModel(id);
    this.player = new Player(this.world.tex);
    this.player.onStep = () => this.audio.footstep();
    this.scene.add(this.traffic.group, this.peds.group, this.player.group);
    onStep('Personaj yuklanmoqda…');
    const char = await this.assets.loadGLTF('char.player');
    if (char) this.player.setAvatar(char);
    // NPC bodies (taxi passengers) load after the menu appears
    void this.loadNPCs().catch((err) => console.warn('[npc]', err));
    this.makeMarkers();
    this.showcase = new Showcase(this.world, this.builtShadows);
    this.scene.add(this.showcase.group);
    onStep('3D modellar kutubxonasi…');
    // GLB library loads after the menu appears; models are applied as soon as they arrive
    void this.loadLibrary().catch((err) => console.warn('[library]', err));
    onStep('end');
    this.scene.add(this.headlight, this.headlight.target);
    this.applySettings(s);
    this.input.attach(this.canvas);
    this.bindStore();
    vehicleBridge.pull = () => this.pull();
    vehicleBridge.callToPlayer = () => this.callVehicle();
    window.addEventListener('resize', this.onResize);
    document.addEventListener('pointerlockchange', this.onLockChange);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.canvas.addEventListener('click', this.onCanvasClick);
    this.canvas.addEventListener('webglcontextlost', this.onContextLost);
    this.onResize();
    this.player.place(9999, 9999, 0);
    (window as unknown as { __store: unknown; __game: unknown }).__store = useGame;
    (window as unknown as { __game: unknown }).__game = this;
    (window as unknown as { __perf: () => unknown }).__perf = () => ({ ...this.perf, assets: this.assets.report, avatar: this.player.hasAvatar, traffic: this.traffic.count });
    this.ready = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  // ------------------------------------------------------------------ store sync
  private bindStore() {
    this.unsub.push(
      useGame.subscribe((st, prev) => {
        if (st.settings !== prev.settings) this.applySettings(st.settings);
        if (st.properties !== prev.properties) this.world.setOwnedProperties(st.properties);
        if ((st.vehicles !== prev.vehicles || st.activeVehicleUid !== prev.activeVehicleUid) && !this.suppressSync) this.syncVehicle();
        if (st.panel !== prev.panel) {
          const open = st.panel !== null;
          this.input.gameplayEnabled = !open;
          if (open) {
            this.input.releaseAll();
            this.input.exitPointerLock();
          }
        }
      }),
    );
  }

  private activeRecord(): OwnedVehicle | null {
    const s = getGame();
    return s.vehicles.find((v) => v.uid === s.activeVehicleUid) ?? null;
  }

  private spawnVehicle(rec: OwnedVehicle, x: number, z: number, heading: number) {
    const wasDriving = !!this.vehicle && this.drivingV === this.vehicle;
    if (this.vehicle && this.player.group.parent === this.vehicle.seatRoot) this.scene.add(this.player.group);
    if (this.vehicle) {
      this.scene.remove(this.vehicle.group);
      this.vehicle.dispose();
    }
    const P = PRESETS[getGame().settings.preset];
    const v = new Vehicle(rec, this.world.tex, P.physicalPaint, false);
    v.place(x, z, heading);
    this.scene.add(v.group);
    this.vehicle = v;
    if (wasDriving) this.drivingV = v;
    const glb = this.vehicleGLB.get(rec.specId);
    if (glb) v.useGLB(glb.gltf, glb.rotate);
    else if (VEHICLE_MAP[rec.specId]?.modelUrl) void this.ensureModel(rec.specId);
  }

  private syncVehicle() {
    const rec = this.activeRecord();
    if (!rec) {
      if (this.inVehicle) this.exitVehicle(true);
      if (this.vehicle) {
        this.scene.remove(this.vehicle.group);
        this.vehicle.dispose();
        this.vehicle = null;
      }
      return;
    }
    if (this.vehicle && this.vehicle.owned.uid === rec.uid) {
      if (this.vehicle.owned !== rec) this.vehicle.applyOwned(rec);
      return;
    }
    if (this.inVehicle) this.exitVehicle(true);
    const p = garageSpawnNear({ x: this.player.x, z: this.player.z });
    this.spawnVehicle(rec, p.x, p.z, p.heading);
  }

  /** write live fuel/health into the store */
  private pull() {
    const v = this.vehicle;
    if (!v) return;
    const s = getGame();
    const rec = s.vehicles.find((x) => x.uid === v.owned.uid);
    if (!rec) return;
    if (Math.abs(rec.fuel - v.physics.fuel) < 0.01 && Math.abs(rec.health - v.physics.health) < 0.01) return;
    useGame.setState({ vehicles: s.vehicles.map((x) => (x.uid === rec.uid ? { ...x, fuel: v.physics.fuel, health: v.physics.health } : x)) });
  }

  private callVehicle() {
    if (this.inVehicle || !this.vehicle) return false;
    const p = garageSpawnNear({ x: this.player.x, z: this.player.z });
    this.vehicle.place(p.x, p.z, p.heading);
    return true;
  }

  // ------------------------------------------------------------------ GLB library (bundled files + Asset Lab uploads)
  async loadLibrary() {
    const entries = new Map<string, LibraryEntry & { buffer?: ArrayBuffer; rotate?: number }>();
    for (const [id, m] of Object.entries(VEHICLE_MODELS)) if (m) entries.set(`vehicle:${id}`, { slot: `vehicle:${id}`, kind: 'vehicle', name: id, url: m.url, license: { author: '', license: m.license, source: '' }, origin: 'bundled' });
    for (const e of bundledLibrary()) entries.set(e.slot, e);
    for (const r of await UserAssets.list()) entries.set(r.slot, { ...UserAssets.toEntry(r), rotate: r.rotate });
    const loaded: { e: LibraryEntry; g: GLTF; rotate: number }[] = [];
    this.libraryReport = [];
    for (const e of entries.values()) {
      try {
        const g = e.buffer ? await this.assets.parseGLB(e.buffer) : await this.assets.loadGLTF(`lib.${e.slot}`, e.url);
        if (!g) throw new Error('yuklanmadi');
        let tris = 0;
        g.scene.traverse((o) => {
          const geo = (o as THREE.Mesh).geometry;
          if ((o as THREE.Mesh).isMesh && geo) tris += (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
        });
        const rotDeg = e.rotate ?? ((e.license as unknown as { rotateY?: number } | null)?.rotateY ?? 0);
        loaded.push({ e, g, rotate: (rotDeg * Math.PI) / 180 });
        this.libraryReport.push({ slot: e.slot, kind: e.kind, name: e.name, origin: e.origin, ok: true, triangles: Math.round(tris), license: e.license });
      } catch (err) {
        this.libraryReport.push({ slot: e.slot, kind: e.kind, name: e.name, origin: e.origin, ok: false, triangles: 0, license: e.license, error: String(err) });
      }
    }
    this.applyLibrary(loaded);
  }

  private applyLibrary(loaded: { e: LibraryEntry; g: GLTF; rotate: number }[]) {
    for (const id of this.libraryVehicleIds) this.vehicleGLB.delete(id);
    this.libraryVehicleIds.clear();
    const traffic = new Map<string, THREE.Object3D>();
    const pick = (k: string) => loaded.filter((x) => x.e.kind === k);
    for (const x of pick('vehicle')) {
      const id = x.e.slot.split(':')[1];
      if (!VEHICLE_MAP[id]) continue;
      this.vehicleGLB.set(id, { gltf: x.g, rotate: x.rotate });
      this.libraryVehicleIds.add(id);
      const clone = x.g.scene.clone(true);
      clone.userData.rotateY = x.rotate;
      traffic.set(id, clone);
    }
    if (traffic.size) this.traffic.applyModels(traffic);
    // building models for the World Environment Editor (kept apart from the player's home)
    this.world.setWorldModels(new Map(pick('building').map((x) => [x.e.slot, { g: x.g, rotate: x.rotate }])));
    const rotate = new Map<GLTF, number>(loaded.map((x) => [x.g, x.rotate]));
    this.showcase.apply({
      houses: pick('house').map((x) => x.g), gates: pick('gate').map((x) => x.g), lamps: pick('lamp').map((x) => x.g),
      benches: pick('bench').map((x) => x.g), trees: pick('tree').map((x) => x.g), bushes: pick('bush').map((x) => x.g),
      vehiclesAvailable: this.vehicleGLB.size > 0, rotate,
    });
    const v = this.vehicle;
    if (v && this.vehicleGLB.has(v.owned.specId) && !v.usesLicensedModel) {
      const rec = this.activeRecord();
      if (rec) this.spawnVehicle(rec, v.physics.x, v.physics.z, v.physics.heading);
    }
    useGame.setState({ assetsVersion: getGame().assetsVersion + 1 });
  }

  // ------------------------------------------------------------------ catalog models: lazy loading + parked-car LOD swap
  /** load a catalog vehicle's GLB once, on first use; shared by player, NPC, traffic and parked cars */
  ensureModel(id: string): Promise<{ gltf: GLTF; rotate: number } | null> {
    const have = this.vehicleGLB.get(id);
    if (have) return Promise.resolve(have);
    const spec = VEHICLE_MAP[id];
    if (!spec?.modelUrl) return Promise.resolve(null);
    let p = this.loadingModels.get(id);
    if (!p) {
      p = this.assets.loadGLTF(`veh.${id}`, spec.modelUrl).then((g) => {
        if (!g) return;
        const e = { gltf: g, rotate: ((spec.rotateY ?? 0) * Math.PI) / 180 };
        this.vehicleGLB.set(id, e);
        const c = g.scene.clone(true);
        c.userData.rotateY = e.rotate;
        this.traffic.setModel(id, c);
        for (const v of [this.vehicle, ...this.borrowed.map((b) => b.v)]) if (v && v.spec.id === id && !v.usesLicensedModel) v.useGLB(g, e.rotate);
        useGame.setState({ assetsVersion: getGame().assetsVersion + 1 });
      });
      this.loadingModels.set(id, p);
    }
    return p.then(() => this.vehicleGLB.get(id) ?? null);
  }

  /** parked catalog cars near the player swap from the instanced stand-in to the real model */
  private updateParkedModels(fx: number, fz: number) {
    for (const p of this.world.parked) {
      const spec = VEHICLE_MAP[p.specId];
      if (!spec?.modelUrl || p.taken) continue;
      const d = Math.hypot(p.x - fx, p.z - fz);
      const sw = this.parkedSwaps.get(p);
      if (d < 70 && !sw) {
        const e = this.vehicleGLB.get(p.specId);
        if (!e) {
          void this.ensureModel(p.specId);
          continue;
        }
        const obj = fitVehicleModel(e.gltf, spec.dims.length, e.rotate);
        obj.position.set(p.x, p.gy, p.z);
        obj.rotation.y = p.rot;
        this.scene.add(obj);
        this.parkedSwaps.set(p, obj);
        this.world.setParkedVisible(p, false);
      } else if (d > 95 && sw) {
        this.scene.remove(sw);
        this.parkedSwaps.delete(p);
        this.world.setParkedVisible(p, true);
      }
    }
  }

  // ------------------------------------------------------------------ settings
  applySettings(s: Settings) {
    const P = PRESETS[s.preset];
    const pr = Math.min(window.devicePixelRatio || 1, P.pixelRatioCap) * s.resolutionScale * this.dynScale;
    this.renderer.setPixelRatio(pr);
    if (this.env) {
      this.env.applyQuality(s.shadows, s.renderDistance, s.preset === 'ultra');
      this.env.exposureScale = P.bloom || P.msaa || P.smaa || P.ao ? 1.12 : 1;
    }
    if (this.world) {
      this.world.renderDistance = s.renderDistance;
      this.world.lodDistance = P.lodDistance * (s.renderDistance / P.renderDistance);
      const shadowsNow = s.shadows > 0;
      if (shadowsNow !== this.builtShadows) {
        this.builtShadows = shadowsNow;
        this.scene.traverse((o) => {
          const m = (o as THREE.Mesh).material;
          if (m) (Array.isArray(m) ? m : [m]).forEach((x) => (x.needsUpdate = true));
        });
      }
    }
    if (this.traffic) this.traffic.target = this.maxTraffic * s.trafficDensity;
    if (this.peds) this.peds.target = this.maxPeds * s.pedestrianDensity;
    this.input.mouseSensitivity = s.mouseSensitivity;
    this.input.invertY = s.invertY;
    this.audio.setVolume(s.volume);
    this.post.configure({ ao: P.ao, bloom: P.bloom, msaa: P.msaa, smaa: P.smaa });
    this.onResize();
  }

  private onResize = () => {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.post.setSize(w, h);
  };

  private onLockChange = () => {
    if (!document.pointerLockElement && this.playing && getGame().panel === null && !getGame().device.touch) {
      this.lastPauseAt = performance.now();
      getGame().setPanel('pause');
    }
  };

  private onCanvasClick = () => {
    if (this.playing && getGame().panel === null && !getGame().device.touch) this.input.requestPointerLock();
  };

  private onVisibility = () => {
    this.audio.suspend(document.hidden);
    if (document.hidden && this.playing) this.saveNow(false);
    this.last = performance.now();
  };

  private onContextLost = (e: Event) => {
    e.preventDefault();
    getGame().notify('Grafika konteksti yo‘qoldi. Sahifani yangilang.', 'bad');
  };

  setMinimap(c: HTMLCanvasElement | null) {
    this.minimap = c;
  }

  // ------------------------------------------------------------------ sessions
  startNew() {
    this.suppressSync = true;
    const starter = createOwned(ECONOMY.starterVehicle, '#f2f2ef', ECONOMY.starterPlate);
    starter.health = 72;
    starter.fuel = 22;
    useGame.setState({
      cash: ECONOMY.startCash,
      bank: ECONOMY.startBank,
      transactions: [],
      vehicles: [starter],
      activeVehicleUid: starter.uid,
      properties: [],
      cargo: [],
      mission: null,
      jobStats: {},
      waypoint: null,
      day: 1,
      minutes: TIME.startMinutes,
      weather: 'clear',
      notifications: [],
      hud: INITIAL_HUD,
      wanted: 0,
      energy: 100,
      businessLevels: {},
      achievements: [],
      events: [],
      wardrobe: [],
      outfit: { hat: 'none', glasses: false },
    });
    this.energy = 100;
    this.resetLaw();
    this.suppressSync = false;
    this.minutes = TIME.startMinutes;
    this.world.prime(PLAYER_SPAWN.x, PLAYER_SPAWN.z);
    this.player.setAccessories({ hat: 'none', glasses: false });
    this.spawnVehicle(starter, STARTER_CAR.x, STARTER_CAR.z, STARTER_CAR.heading);
    this.player.place(PLAYER_SPAWN.x, PLAYER_SPAWN.z, HOME_HEADING);
    this.beginPlay();
    getGame().notify('Xush kelibsiz, G‘uzorga! Otangizdan qolgan «Sarbon S3» ko‘chada turibdi.', 'info');
    window.setTimeout(() => getGame().notify('Pul topish uchun Mehnat birjasiga boring yoki telefonda (Tab) ish tanlang.', 'info'), 4500);
    this.saveNow(false);
  }

  continueGame(): boolean {
    const d = readSave();
    if (!d) return false;
    this.suppressSync = true;
    useGame.setState({
      cash: d.cash, bank: d.bank, transactions: d.transactions, vehicles: d.vehicles, activeVehicleUid: d.activeVehicleUid,
      properties: d.properties, cargo: d.cargo, mission: null, jobStats: d.jobStats, waypoint: null, day: d.day, minutes: d.minutes,
      weather: d.weather, notifications: [], hud: INITIAL_HUD, wanted: 0, energy: d.energy ?? 100, businessLevels: d.businessLevels ?? {}, achievements: d.achievements ?? [], events: [], wardrobe: d.wardrobe ?? [], outfit: d.outfit ?? { hat: 'none', glasses: false },
    });
    this.energy = d.energy ?? 100;
    this.resetLaw();
    this.suppressSync = false;
    this.minutes = d.minutes;
    this.world.setOwnedProperties(d.properties);
    const rec = this.activeRecord();
    if (rec) {
      const w = d.vehicleWorld && d.vehicleWorld.uid === rec.uid ? d.vehicleWorld : { ...garageSpawnNear(d.player), uid: rec.uid };
      this.spawnVehicle(rec, w.x, w.z, w.heading);
    } else if (this.vehicle) {
      this.scene.remove(this.vehicle.group);
      this.vehicle.dispose();
      this.vehicle = null;
    }
    this.world.prime(d.player.x, d.player.z);
    this.player.setAccessories(d.outfit ?? { hat: 'none', glasses: false });
    this.player.place(d.player.x, d.player.z, d.player.heading);
    this.beginPlay();
    getGame().notify('Saqlangan o‘yin yuklandi', 'good');
    return true;
  }

  private beginPlay() {
    this.playing = true;
    this.inVehicle = false;
    this.interiorCam = false;
    this.player.group.visible = true;
    this.rig.setMode('foot');
    this.rig.snap(this.player.x, this.player.y + 1.5, this.player.z, this.player.heading);
    this.rig.pitch = 0.3;
    this.saveTimer = 0;
    useGame.setState({ screen: 'playing', panel: null });
  }

  exitToMenu() {
    this.saveNow(false);
    if (this.inVehicle) this.exitVehicle(true);
    this.resetLaw();
    this.playing = false;
    this.input.exitPointerLock();
    this.player.place(9999, 9999, 0);
    useGame.setState({ screen: 'menu', panel: null, hasSave: true });
  }

  snapshot(): SaveData {
    const s = getGame();
    const v = this.dv;
    const px = this.inVehicle && v ? v.physics.x : this.player.x;
    const pz = this.inVehicle && v ? v.physics.z : this.player.z;
    this.pull();
    const st = getGame();
    return {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      player: { x: px, z: pz, heading: this.player.heading },
      vehicleWorld: v ? { uid: v.owned.uid, x: v.physics.x, z: v.physics.z, heading: v.physics.heading } : null,
      cash: st.cash, bank: st.bank, transactions: st.transactions, vehicles: st.vehicles, activeVehicleUid: st.activeVehicleUid,
      properties: st.properties, cargo: st.cargo.filter((c) => !['yolovchi', 'osh', 'posilka', 'asboblar', 'hosil'].includes(c.id)),
      jobStats: st.jobStats, day: s.day, minutes: this.minutes, weather: s.weather, energy: this.energy, businessLevels: st.businessLevels, achievements: st.achievements, wardrobe: st.wardrobe, outfit: st.outfit,
    };
  }

  saveNow(announce = true) {
    if (!this.playing) return false;
    const ok = writeSave(this.snapshot());
    useGame.setState({ hasSave: ok || getGame().hasSave, lastSaved: ok ? Date.now() : getGame().lastSaved });
    if (announce) getGame().notify(ok ? 'O‘yin saqlandi' : 'Saqlab bo‘lmadi (brauzer xotirasi yopiq)', ok ? 'good' : 'bad');
    return ok;
  }

  // ------------------------------------------------------------------ vehicle enter/exit
  private entering: { v: Vehicle; t: number; dur: number; phase: 'walk' | 'door' | 'in'; fx: number; fz: number; tx: number; tz: number; heading: number } | null = null;
  /** short scripted animation on foot (stand up after leaving a car, opening a building door) */
  private scripted: { t: number; dur: number; done: () => void } | null = null;
  private npcAvatars: THREE.Object3D[] = [];

  /** driver (+1, left-hand drive) or front passenger (-1) seat in the vehicle's local frame */
  private seatOf(v: Vehicle, side: 1 | -1) {
    const d = v.spec.dims;
    const doorZ = d.length / 2 - v.spec.shape.hood - 1.0;
    return new THREE.Vector3(side * d.width * 0.21, Math.max(0.04, (d.height - 1.45) * 0.5 + 0.04), doorZ - 0.38);
  }

  /** walk to the driver door, open it, duck in (Rocketbox door / crouch clips), then drive */
  private beginEnter(v: Vehicle | null = this.vehicle) {
    if (!v || this.entering || this.scripted) return;
    const h = v.physics.heading;
    const lx = Math.cos(h), lz = -Math.sin(h);
    const doorZ = v.spec.dims.length / 2 - v.spec.shape.hood - 1.0;
    const tx = v.physics.x + lx * (v.spec.dims.width / 2 + 0.5) + Math.sin(h) * doorZ;
    const tz = v.physics.z + lz * (v.spec.dims.width / 2 + 0.5) + Math.cos(h) * doorZ;
    const dist = Math.hypot(tx - this.player.x, tz - this.player.z);
    this.entering = { v, t: 0, dur: clamp(dist / 1.6, 0.25, 1.5), phase: 'walk', fx: this.player.x, fz: this.player.z, tx, tz, heading: h - Math.PI / 2 };
  }

  private updateEntering(dt: number) {
    const e = this.entering!;
    const p = this.player;
    e.t += dt;
    const k = Math.min(1, e.t / e.dur);
    if (e.phase === 'walk') {
      const s = k * k * (3 - 2 * k);
      p.x = e.fx + (e.tx - e.fx) * s;
      p.z = e.fz + (e.tz - e.fz) * s;
      const dir = Math.atan2(e.tx - e.fx, e.tz - e.fz);
      p.heading = dampAngle(p.heading, k < 0.65 && Math.hypot(e.tx - e.fx, e.tz - e.fz) > 0.4 ? dir : e.heading, 12, dt);
      p.speed = k < 0.9 ? 1.6 : 0;
      if (k >= 1) {
        p.speed = 0;
        if (!p.hasAvatar) return this.finishEnter();
        e.phase = 'door';
        e.t = 0;
        e.dur = 0.9;
        p.playAction('door_out', { start: 1.0, timeScale: 1.6, fade: 0.15 });
      }
    } else if (e.phase === 'door') {
      p.heading = dampAngle(p.heading, e.heading, 10, dt);
      if (k >= 1) {
        e.v.seatRoot.updateWorldMatrix(true, false);
        const seat = this.seatOf(e.v, 1).applyMatrix4(e.v.seatRoot.matrixWorld);
        e.phase = 'in';
        e.t = 0;
        e.dur = 0.6;
        e.fx = p.x; e.fz = p.z; e.tx = seat.x; e.tz = seat.z;
        p.playAction('crouch_in', { start: 0.9, timeScale: 2.1, fade: 0.12 });
      }
    } else {
      const s = k * k * 0.65;
      p.x = e.fx + (e.tx - e.fx) * s;
      p.z = e.fz + (e.tz - e.fz) * s;
      p.heading = dampAngle(p.heading, e.v.physics.heading, 5, dt);
      if (k >= 1) return this.finishEnter();
    }
    p.animateOnly(dt);
    p.sync();
  }

  private finishEnter() {
    const v = this.entering!.v;
    this.entering = null;
    this.enterVehicle(v);
  }

  private enterVehicle(v: Vehicle | null = this.vehicle) {
    if (!v) return;
    if (v.physics.health <= 0) getGame().notify('Mashina buzilgan — avtoservisga chaqiring yoki ta’mirlang', 'bad');
    this.inVehicle = true;
    this.drivingV = v;
    this.player.speed = 0;
    if (this.player.hasAvatar) this.player.playAction('sit', { loop: true, start: Math.random() * 6, fade: 0.2 });
    else this.player.group.visible = false;
    this.rig.setMode('car');
    this.rig.yaw = v.physics.heading;
  }

  /** Joshqin stays visible in the driver seat (hidden in the cockpit camera) */
  private updateSeated(dt: number) {
    const v = this.dv!, p = this.player;
    if (!p.hasAvatar) return;
    if (p.group.parent !== v.seatRoot) v.seatRoot.add(p.group);
    p.group.position.copy(this.seatOf(v, 1));
    p.group.rotation.set(0, 0, 0);
    p.group.visible = !this.interiorCam;
    p.animateOnly(dt);
  }

  private tickScripted(dt: number) {
    const sc = this.scripted!;
    sc.t += dt;
    this.player.speed = 0;
    this.player.animateOnly(dt);
    this.player.sync();
    if (sc.t >= sc.dur) {
      this.scripted = null;
      sc.done();
    }
  }

  private exitVehicle(force = false) {
    const v = this.vehicle;
    if (!v) return;
    const dv = this.drivingV ?? v;
    if (!force && dv.physics.speedKmh > 8) {
      getGame().notify('Avval to‘xtang', 'bad');
      return;
    }
    const h = dv.physics.heading;
    const lx = Math.cos(h), lz = -Math.sin(h);
    const off = dv.spec.dims.width / 2 + 0.7;
    let px = dv.physics.x + lx * off, pz = dv.physics.z + lz * off;
    if (this.world.col.raycast(dv.physics.x, dv.physics.z, lx, lz, off + 0.3) < off + 0.3) {
      px = dv.physics.x - lx * off;
      pz = dv.physics.z - lz * off;
    }
    this.inVehicle = false;
    this.drivingV = null;
    this.setInterior(false);
    this.scene.add(this.player.group);
    this.player.place(px, pz, h + Math.PI / 2);
    this.player.group.visible = true;
    this.rig.setMode('foot');
    if (!force && this.player.hasAvatar) {
      // stand up out of the seat, then hand control back
      this.player.playAction('crouch_out', { start: 2.3, timeScale: 2.2, fade: 0.08 });
      this.scripted = { t: 0, dur: 0.7, done: () => this.player.clearAction(0.25) };
    } else this.player.clearAction(0.01);
  }

  private async loadNPCs() {
    for (const [i, url] of NPC_AVATARS.entries()) {
      const g = await this.assets.loadGLTF(`char.npc.${i}`, url);
      if (!g) continue;
      const sc = g.scene;
      sc.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(sc);
      sc.position.y = -box.min.y;
      sc.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; tuneAvatarMaterials(m); }
      });
      const root = new THREE.Group();
      root.add(sc);
      this.npcAvatars.push(root);
    }
  }

  /** a random NPC body with the shared Rocketbox clips (falls back to the player model) */
  private npcSource(): AvatarSource | null {
    const src = this.player.avatarSource;
    if (!src) return null;
    if (!this.npcAvatars.length) return src;
    return { scene: this.npcAvatars[Math.floor(Math.random() * this.npcAvatars.length)], clips: src.clips, scale: 1 };
  }

  private setInterior(on: boolean) {
    this.interiorCam = on;
    this.interiorYaw = 0;
    this.camera.near = on ? 0.08 : 0.5;
    this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------------ interactions
  private poiInteraction(): Interaction | null {
    const s = getGame();
    const px = this.player.x, pz = this.player.z;
    if (this.interior) {
      const it = this.interiors.list[this.interior.kind];
      const spot = it.spots.find((sp) => Math.hypot(sp.x - px, sp.z - pz) < 1.7);
      if (!spot) return null;
      const homeGarage = s.properties.map((id) => PROPERTY_MAP[id]).find((p) => p?.hasGarage);
      switch (spot.action) {
        case 'exit': return { label: spot.label, run: () => this.exitInterior() };
        case 'sleep': return { label: spot.label, run: () => { this.energy = Math.max(this.energy, 100); this.saveNow(true); } };
        case 'wardrobe': return { label: spot.label, run: () => s.setPanel('wardrobe', 'home') };
        case 'accessories': return { label: spot.label, run: () => s.setPanel('wardrobe', 'shop') };
        case 'food': { const c = Math.round((ECONOMY.foodBazaar * eventMods.food) / 1000) * 1000; return { label: `${spot.label} — ${formatSom(c)}`, run: () => this.eat(c, 45, 'Do‘kon') }; }
        case 'garage': return homeGarage ? { label: spot.label, run: () => s.setPanel('garage', homeGarage.id) } : null;
        case 'bank': return { label: spot.label, run: () => s.setPanel('bank') };
        case 'jobs': return { label: spot.label, run: () => s.setPanel('jobs') };
        case 'realty': return { label: spot.label, run: () => s.setPanel('properties') };
        case 'service': return { label: spot.label, run: () => s.setPanel('garage', 'service') };
        case 'dealership': return { label: spot.label, run: () => s.setPanel('dealership', 'here') };
        case 'osh': { const c = Math.round((ECONOMY.foodOsh * eventMods.food) / 1000) * 1000; return { label: `${spot.label} — ${formatSom(c)}`, run: () => this.eat(c, 100, 'Osh markazi') }; }
      }
    }
    const v = this.vehicle;
    if (v && Math.hypot(v.physics.x - px, v.physics.z - pz) < v.spec.dims.length / 2 + 1.2) {
      return { label: `${v.spec.name} — o‘tirish (sizniki)`, run: () => this.beginEnter(v) };
    }
    for (const b of this.borrowed) {
      if (Math.hypot(b.v.physics.x - px, b.v.physics.z - pz) < b.v.spec.dims.length / 2 + 1.2) return { label: `${b.v.spec.name} — o‘tirish (begona, vaqtincha)`, run: () => this.beginEnter(b.v) };
    }
    const pk = this.world.nearestParked(px, pz, 3.4);
    if (pk) {
      const spec = VEHICLE_MAP[pk.specId];
      if (pk.display) return { label: `${spec.name} — avtosalon mashinasi`, run: () => s.setPanel('dealership', 'here') };
      if (pk.locked) return { label: `${spec.name} — begona, qulflangan · qulfni ochish`, run: () => this.startLockGame(pk) };
      return { label: `${spec.name} — begona mashina · o‘tirish`, run: () => this.takeParkedCar(pk, false) };
    }
    const tc = this.traffic.nearestCar(px, pz, 4.5);
    if (tc) {
      if (tc.speed > 2.2) this.restriction = 'Mashina harakatda — to‘xtashini kuting';
      else return { label: `${VEHICLE_MAP[tc.specId].name} — haydovchini tushirish`, run: () => this.carjack(tc) };
    }
    for (const poi of POIS) {
      if (Math.hypot(poi.pos.x - px, poi.pos.z - pz) > poi.radius) continue;
      const hours = OPEN_HOURS[poi.kind];
      const hNow = this.minutes / 60;
      if (hours && (hNow < hours[0] || hNow >= hours[1])) return { label: `${poi.name} — yopiq (${hours[0]}:00–${hours[1]}:00)`, run: () => s.notify(`${poi.name} ${hours[0]}:00 da ochiladi`, 'info') };
      switch (poi.kind) {
        case 'bank':
          return { label: 'Bankka kirish', run: () => this.enterInterior('bank') };
        case 'jobs':
          return { label: 'Mehnat birjasiga kirish', run: () => this.enterInterior('office') };
        case 'realty':
          return { label: 'Ko‘chmas mulk agentligiga kirish', run: () => this.enterInterior('office') };
        case 'dealership':
          return { label: 'Avtosalonga kirish', run: () => this.enterInterior('showroom') };
        case 'service':
          return { label: 'Avtoservisga kirish', run: () => this.enterInterior('workshop') };
        case 'fuel':
          return {
            label: 'Yoqilg‘i quyish',
            run: () => {
              if (v && Math.hypot(v.physics.x - px, v.physics.z - pz) < 16) refuel(v.owned.uid);
              else s.notify('Mashinangizni kolonka yoniga olib keling', 'bad');
            },
          };
        case 'home':
          return { label: 'Uyga kirish', run: () => this.enterInterior('home') };
        case 'property': {
          const p = PROPERTY_MAP[poi.propertyId!];
          const owned = s.properties.includes(p.id);
          if (owned && p.hasGarage) return { label: `${p.name} — garaj`, run: () => s.setPanel('garage', p.id) };
          if (owned && p.type !== 'commercial') return { label: `${p.name} — uyga kirish`, run: () => this.enterInterior('home') };
          if (owned) return { label: `${p.name} — sizniki`, run: () => s.setPanel('properties', p.id) };
          return { label: `Sotuvda: ${p.name}`, run: () => s.setPanel('properties', p.id) };
        }
        case 'osh':
          return { label: 'Osh markaziga kirish', run: () => this.enterInterior('restaurant') };
        case 'bazaar':
          return { label: 'Bozor do‘koniga kirish', run: () => this.enterInterior('shop') };
        default:
          return { label: `${poi.name} — ishlar`, run: () => s.setPanel('jobs') };
      }
    }
    return null;
  }

  private vehicleInteraction(): Interaction | null {
    const v = this.dv!;
    if (v.physics.speedKmh > 6) return null;
    for (const poi of POIS) {
      if (Math.hypot(poi.pos.x - v.physics.x, poi.pos.z - v.physics.z) > poi.radius + 4) continue;
      if (poi.kind === 'fuel') return { label: 'Yoqilg‘i quyish', run: () => refuel(v.owned.uid) };
      if (poi.kind === 'service') return { label: 'Avtoservis va garaj', run: () => getGame().setPanel('garage', 'service') };
    }
    return null;
  }

  // ------------------------------------------------------------------ NPC vehicles, lock mini-game, wanted level (fictional)
  private resetLaw() {
    this.police.clear();
    for (const b of [...this.borrowed]) this.removeBorrowed(b.v);
    this.minigame = null;
    this.wantedCool = 0;
  }

  private removeBorrowed(v: Vehicle) {
    if (this.drivingV === v) this.exitVehicle(true);
    this.scene.remove(v.group);
    v.dispose();
    const i = this.borrowed.findIndex((b) => b.v === v);
    if (i >= 0) this.borrowed.splice(i, 1);
  }

  private npcVehicle(specId: string, color: string, x: number, z: number, heading: number) {
    const spec = VEHICLE_MAP[specId];
    const rec: OwnedVehicle = {
      uid: `npc-${Math.random().toString(36).slice(2, 8)}`, specId, color, wheels: 0, tint: 0, plate: randomPlate(Math.random),
      engine: 0, handling: 0, health: 100, fuel: spec.perf.fuelCapacity * (0.25 + Math.random() * 0.5),
    };
    const v = new Vehicle(rec, this.world.tex, PRESETS[getGame().settings.preset].physicalPaint, false);
    v.borrowed = true;
    v.place(x, z, heading);
    const glb = this.vehicleGLB.get(specId);
    if (glb) v.useGLB(glb.gltf, glb.rotate);
    else if (spec.modelUrl) void this.ensureModel(specId);
    this.scene.add(v.group);
    return v;
  }

  addWanted(n: number, reason: string) {
    const s = getGame();
    const w = Math.min(3, s.wanted + n);
    this.wantedCool = 0;
    if (w === s.wanted) return;
    useGame.setState({ wanted: w });
    s.notify(`${reason} · qidiruv: ${'★'.repeat(w)}`, 'bad');
  }

  private witnessed(chance: number) {
    const near = this.peds.positions().some((p) => Math.hypot(p.x - this.player.x, p.z - this.player.z) < 25);
    return near && Math.random() < chance;
  }

  private startLockGame(pk: World['parked'][number]) {
    const a = 0.15 + Math.random() * 0.5;
    this.minigame = { pk, needle: 0, dir: 1, zone: [a, a + 0.18], tries: 3 };
  }

  private updateLockGame(dt: number, inp: InputFrame) {
    const m = this.minigame!;
    m.needle += m.dir * dt * 1.15;
    if (m.needle > 1) { m.needle = 1; m.dir = -1; }
    if (m.needle < 0) { m.needle = 0; m.dir = 1; }
    if (Math.abs(inp.moveX) + Math.abs(inp.moveY) > 0.4) {
      this.minigame = null;
      getGame().setHud({ minigame: null });
      return;
    }
    if (inp.pressed.has('interact')) {
      if (m.needle >= m.zone[0] && m.needle <= m.zone[1]) {
        this.minigame = null;
        getGame().setHud({ minigame: null });
        if (Math.random() < 0.4) {
          this.audio.alarm();
          this.addWanted(1, 'Signalizatsiya chalindi');
        }
        this.takeParkedCar(m.pk, true);
        return;
      }
      m.tries--;
      this.audio.alarm();
      if (m.tries === 2) this.addWanted(1, 'Signalizatsiya chalindi');
      if (m.tries <= 0) {
        this.minigame = null;
        getGame().setHud({ minigame: null });
        getGame().notify('Qulf ochilmadi', 'bad');
        return;
      }
    }
    getGame().setHud({ minigame: { needle: m.needle, zone: m.zone, tries: m.tries } });
  }

  private takeParkedCar(pk: World['parked'][number], forced: boolean) {
    const sw = this.parkedSwaps.get(pk);
    if (sw) {
      this.scene.remove(sw);
      this.parkedSwaps.delete(pk);
    }
    const v = this.npcVehicle(pk.specId, pk.color, pk.x, pk.z, pk.rot);
    this.world.takeParked(pk);
    this.borrowed.push({ v, from: 'parked' });
    if (this.witnessed(forced ? 0.6 : 0.3)) this.addWanted(1, 'Guvoh politsiyaga xabar berdi');
    this.beginEnter(v);
  }

  private carjack(tc: TrafficCarInfo) {
    this.traffic.removeCar(tc.ref);
    const v = this.npcVehicle(tc.specId, tc.color, tc.x, tc.z, tc.heading);
    this.borrowed.push({ v, from: 'traffic' });
    getGame().notify('Haydovchi mashinani tashlab qochdi', 'info');
    this.addWanted(2, 'Mashina majburan olindi');
    this.beginEnter(v);
  }

  private policeObstacles(): Obstacle[] {
    return this.police.obstacles().map((o) => ({
      ...o,
      onHit: (imp: number) => {
        if (imp > 2 && performance.now() - this.lastRam > 3000) {
          this.lastRam = performance.now();
          this.addWanted(1, 'Politsiya mashinasini urdingiz');
        }
      },
    }));
  }

  /** circles for parked owned / borrowed cars so the driven car can hit them */
  private parkedCarObstacles(except: Vehicle): Obstacle[] {
    const out: Obstacle[] = [];
    for (const v of [this.vehicle, ...this.borrowed.map((b) => b.v)]) {
      if (!v || v === except) continue;
      const p = v.physics, off = v.spec.dims.length * 0.28;
      out.push({ x: p.x + Math.sin(p.heading) * off, z: p.z + Math.cos(p.heading) * off, r: 0.9 }, { x: p.x - Math.sin(p.heading) * off, z: p.z - Math.cos(p.heading) * off, r: 0.9 });
    }
    return out;
  }

  private updateLaw(dt: number, fx: number, fz: number) {
    const s = getGame();
    const speed = this.dv ? Math.abs(this.dv.physics.vx) : this.player.speed;
    const obstacles = [...this.traffic.obstacles, ...(this.dv ? this.parkedCarObstacles(this.dv as Vehicle).slice(0, 0) : [])];
    if (this.dv) {
      const p = this.dv.physics, off = this.dv.spec.dims.length * 0.28;
      obstacles.push({ x: p.x + Math.sin(p.heading) * off, z: p.z + Math.cos(p.heading) * off, r: 0.95 }, { x: p.x - Math.sin(p.heading) * off, z: p.z - Math.cos(p.heading) * off, r: 0.95 });
    }
    const res = this.police.update(dt, s.wanted, fx, fz, speed, this.world.col, obstacles, this.env.state.night);
    this.audio.setSiren(res.nearest < 220 ? 1 - res.nearest / 220 : 0);
    if (s.wanted > 0) {
      this.wantedCool = res.nearest > 90 ? this.wantedCool + dt : 0;
      if (this.wantedCool > (s.wanted === 1 ? 15 : 25)) {
        this.wantedCool = 0;
        useGame.setState({ wanted: s.wanted - 1 });
        s.notify(s.wanted - 1 === 0 ? 'Qidiruv to‘xtatildi' : 'Qidiruv susaydi', 'good');
      }
    }
    if (res.caught) this.busted();
  }

  private busted() {
    const s = getGame();
    const total = s.cash + s.bank;
    const fine = Math.round(Math.min(total, 400_000 + total * 0.1) / 1000) * 1000;
    if (fine > 0) spend(fine, 'Politsiya jarimasi', 'cash');
    const d = this.dv;
    if (d?.borrowed) this.removeBorrowed(d);
    useGame.setState({ wanted: 0 });
    this.police.clear();
    s.notify(`Politsiya to‘xtatdi. Jarima: ${formatSom(fine)}. Mashina egasiga qaytarildi.`, 'bad');
  }

  // ------------------------------------------------------------ interiors
  enterInterior(kind: InteriorKind) {
    if (this.scripted || this.interior) return;
    if (!this.player.hasAvatar) return this.enterInteriorNow(kind);
    this.player.speed = 0;
    this.player.playAction('door_in', { start: 1.0, timeScale: 1.7, fade: 0.15 });
    this.scripted = { t: 0, dur: 0.85, done: () => { this.player.clearAction(0.2); this.enterInteriorNow(kind); } };
  }

  private enterInteriorNow(kind: InteriorKind) {
    if (this.inVehicle || this.interior) return;
    const it = this.interiors.list[kind];
    const ret = { x: this.player.x, z: this.player.z, h: this.player.heading + Math.PI };
    useGame.setState({ fade: true });
    setTimeout(() => {
      this.interior = { kind, ret };
      this.interiors.setActive(kind);
      this.player.place(it.spawn.x, it.spawn.z, it.spawn.h);
      this.rig.yaw = it.spawn.h + Math.PI;
      this.rig.pitch = 0.18;
      useGame.setState({ fade: false });
    }, 300);
  }

  exitInterior() {
    if (!this.interior) return;
    const ret = this.interior.ret;
    useGame.setState({ fade: true });
    setTimeout(() => {
      this.interior = null;
      this.interiors.setActive(null);
      this.world.prime(ret.x, ret.z, 200);
      this.player.place(ret.x, ret.z, ret.h);
      useGame.setState({ fade: false });
    }, 300);
  }

  /** city rhythm: busy mornings and evenings, quiet nights */
  private updateRhythm(dt: number) {
    this.rhythmTimer -= dt;
    if (this.rhythmTimer > 0) return;
    this.rhythmTimer = 3;
    const h = this.minutes / 60, g = getGame(), s = g.settings;
    const traffic = h < 5 ? 0.25 : h < 7 ? 0.55 : h < 9.5 ? 1 : h < 16.5 ? 0.9 : h < 19.5 ? 1 : h < 22.5 ? 0.6 : 0.35;
    const walkers = h < 5 ? 0.08 : h < 7 ? 0.4 : h < 9.5 ? 0.85 : h < 20.5 ? 1 : h < 22.5 ? 0.45 : 0.15;
    const rain = g.weather === 'rain' ? 0.55 : 1;
    if (this.traffic) this.traffic.target = Math.round(this.maxTraffic * s.trafficDensity * traffic);
    if (this.peds) this.peds.target = Math.round(this.maxPeds * s.pedestrianDensity * walkers * rain);
  }

  /** achievements, landmark discovery and random world events */
  private updateProgress(dt: number, fx: number, fz: number) {
    this.progressTimer -= dt;
    if (this.progressTimer > 0) return;
    this.progressTimer = 1;
    const s = getGame();
    const speed = this.inVehicle && this.dv ? this.dv.physics.speedKmh : 0;
    const now = s.day * 1440 + this.minutes;
    const changed = this.worldEvents.update(now, { x: fx, z: fz }, speed, (e) => {
      const st = getGame();
      useGame.setState({ cash: st.cash + (e.reward ?? 0), jobStats: { ...st.jobStats, events: (st.jobStats.events ?? 0) + 1 } });
      st.notify(`${e.title}: rahmat! +${formatSom(e.reward ?? 0)}`, 'good');
    });
    if (changed) {
      const ev = this.worldEvents.active;
      const fresh = ev.find((e) => e.pos && !s.events.some((x) => x.title === e.title));
      if (fresh?.pos) {
        useGame.setState({ waypoint: fresh.pos });
        s.notify(`${fresh.title} — joy GPS’da belgilandi`, 'info');
      } else {
        const msg = ev.find((e) => !e.pos && !s.events.some((x) => x.title === e.title));
        if (msg) s.notify(`${msg.title}: ${msg.desc}`, 'info');
      }
    }
    useGame.setState({ events: this.worldEvents.active.map((e) => ({ title: e.title, desc: e.desc, left: Math.max(0, Math.round(e.until - now)), place: !!e.pos })) });
    // achievements
    const got = new Set(s.achievements);
    const add: string[] = [];
    const test = (id: string, ok: boolean) => { if (ok && !got.has(id)) { got.add(id); add.push(id); } };
    const js = s.jobStats;
    const total = Object.entries(js).filter(([k]) => k !== 'events').reduce((a, [, v]) => a + v, 0);
    test('first-job', total >= 1);
    test('taxi-10', (js.taxi ?? 0) >= 10);
    test('deliver-10', (js.delivery ?? 0) + (js.courier ?? 0) >= 10);
    test('cargo-5', (js.cargo ?? 0) >= 5);
    test('rich-10m', s.cash + s.bank >= 10_000_000);
    test('second-car', s.vehicles.length >= 2);
    test('home', s.properties.some((p) => /^(apt|hovli|villa)-/.test(p)));
    test('business', s.properties.some((p) => /^biz-/.test(p)));
    test('night-driver', this.env.state.night > 0.7 && speed > 70);
    test('rain-driver', s.weather === 'rain' && speed > 20);
    test('event-helper', (js.events ?? 0) >= 3);
    for (const l of LANDMARKS) test(l.id, Math.hypot(l.x - fx, l.z - fz) < 62);
    test('explorer', LANDMARKS.every((l) => got.has(l.id)));
    if (add.length) {
      const reward = add.reduce((a, id) => a + (ACH_MAP[id]?.reward ?? 0), 0);
      useGame.setState({ achievements: [...got], cash: getGame().cash + reward });
      for (const id of add) s.notify(`Yutuq: ${ACH_MAP[id]?.name ?? id}${ACH_MAP[id]?.reward ? ` · +${formatSom(ACH_MAP[id].reward)}` : ''}`, 'good');
    }
  }

  private eat(cost: number, amount: number, where: string) {
    if (this.energy > 95) {
      getGame().notify('Qorningiz to‘q', 'info');
      return;
    }
    if (!spend(cost, `Ovqat: ${where}`)) return;
    this.energy = Math.min(100, this.energy + amount);
    getGame().notify('Mazali! Kuch-quvvat tiklandi', 'good');
  }

  /** fictional ownership transfer: register the NPC car you are driving (garage) */
  registerBorrowed(): string | null {
    const v = this.dv?.borrowed ? this.dv : null;
    if (!v) return 'Hozir begona mashinada emassiz';
    if (getGame().wanted > 0) return 'Qidiruvdasiz — avval politsiyadan qutuling';
    const price = Math.round((v.spec.price * ECONOMY.registerRatio) / 1000) * 1000;
    if (!spend(price, `Rasmiylashtirish: ${v.spec.name}`, 'bank')) return 'Mablag‘ yetarli emas';
    const rec = createOwned(v.spec.id, v.owned.color);
    rec.fuel = v.physics.fuel;
    rec.health = v.physics.health;
    const { x, z, heading } = v.physics;
    this.removeBorrowed(v);
    this.suppressSync = true;
    useGame.setState({ vehicles: [...getGame().vehicles, rec], activeVehicleUid: rec.uid });
    this.suppressSync = false;
    this.spawnVehicle(rec, x, z, heading);
    getGame().notify(`${v.spec.name} rasmiylashtirildi — endi sizniki`, 'good');
    return null;
  }

  // ------------------------------------------------------------------ markers
  private makeMarkers() {
    const beam = (color: string) => {
      const g = new THREE.Group();
      const c = document.createElement('canvas');
      c.width = 4;
      c.height = 128;
      const x = c.getContext('2d')!;
      const grd = x.createLinearGradient(0, 0, 0, 128);
      grd.addColorStop(0, 'rgba(255,255,255,0)');
      grd.addColorStop(1, 'rgba(255,255,255,0.85)');
      x.fillStyle = grd;
      x.fillRect(0, 0, 4, 128);
      const tex = new THREE.CanvasTexture(c);
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(1.4, 1.4, 34, 24, 1, true),
        new THREE.MeshBasicMaterial({ color, map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }),
      );
      m.position.y = 17;
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.7, 2.1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
      ring.position.y = 0.2;
      g.add(m, ring);
      g.visible = false;
      this.scene.add(g);
      return g;
    };
    this.missionBeam = beam('#e9b44c');
    this.waypointBeam = beam('#2bb3c0');
    const g = lowGeometry(VEHICLE_MAP.lola);
    this.brokenCar = new THREE.Group();
    const hazard = new THREE.MeshBasicMaterial({ color: '#ff9a1a' });
    this.brokenCar.add(new THREE.Mesh(g.body, lowPaint('#b8bcc2')), new THREE.Mesh(g.glass, lowMats.glass), new THREE.Mesh(g.dark, lowMats.dark), new THREE.Mesh(g.lights, hazard));
    this.brokenCar.visible = false;
    this.scene.add(this.brokenCar);
  }

  // ------------------------------------------------------------------ main loop
  private loop = (t: number) => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, Math.max(0.0001, (t - this.last) / 1000));
    this.last = t;
    this.fpsAcc += dt;
    this.fpsFrames++;
    if (this.fpsAcc >= 0.5) {
      this.fps = this.fpsFrames / this.fpsAcc;
      this.perf.fps = Math.round(this.fps);
      this.perf.frameMs = +((this.fpsAcc / this.fpsFrames) * 1000).toFixed(1);
      this.fpsAcc = 0;
      this.fpsFrames = 0;
      this.dynamicResolution();
      this.autoQuality();
    }
    try {
      this.frame(dt);
    } catch (e) {
      console.error(e);
    }
  };

  private lowFps = 0;
  /** steps the preset down one level after ~8 s below 24 FPS (never upward on its own) */
  private autoQuality() {
    const s = getGame();
    if (!s.settings.autoQuality || !this.playing || s.panel) {
      this.lowFps = 0;
      return;
    }
    this.lowFps = this.fps < 24 ? this.lowFps + 1 : 0;
    if (this.lowFps < 16) return;
    this.lowFps = -20;
    const ladder = s.settings.preset.startsWith('mobile') ? MOBILE_LADDER : DESKTOP_LADDER;
    const i = ladder.indexOf(s.settings.preset);
    if (i < 0 || i >= ladder.length - 1) return;
    const next = ladder[i + 1];
    s.updateSettings(settingsFromPreset(next, s.settings));
    s.notify(`Grafika avtomatik pasaytirildi: ${PRESETS[next].label} (Sozlamalarda o‘chirish mumkin)`, 'info');
  }

  private dynamicResolution() {
    const s = getGame().settings;
    if (!s.dynamicResolution || !this.playing) return;
    const before = this.dynScale;
    if (this.fps < 27) this.dynScale = Math.max(0.55, this.dynScale - 0.08);
    else if (this.fps > 52) this.dynScale = Math.min(1, this.dynScale + 0.04);
    if (before !== this.dynScale && performance.now() - this.dynTimer > 1500) {
      this.dynTimer = performance.now();
      const P = PRESETS[s.preset];
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, P.pixelRatioCap) * s.resolutionScale * this.dynScale);
      this.onResize();
    }
  }

  private frame(dt: number) {
    const s = getGame();
    const inp = this.input.poll();
    const paused = s.panel !== null;

    if (this.playing) this.globalActions(inp, s.panel);

    if (!this.playing) {
      // cinematic menu camera
      this.rig.orbit(dt, 0, -10, 135, 42);
      this.simulateWorld(dt, this.camera.position.x, this.camera.position.z, false);
      this.renderFrame(dt);
      return;
    }

    if (!paused) {
      this.advanceTime(dt);
      if (this.inVehicle && this.dv) { this.updateDriving(dt, inp); if (this.inVehicle && this.dv) this.updateSeated(dt); }
      else if (this.entering) this.updateEntering(dt);
      else this.updateOnFoot(dt, inp);
    }
    const fx = this.inVehicle && this.dv ? this.dv.physics.x : this.player.x;
    const fz = this.inVehicle && this.dv ? this.dv.physics.z : this.player.z;
    if (!paused) {
      this.simulateWorld(dt, fx, fz, true);
      this.updateLaw(dt, fx, fz);
      this.updateProgress(dt, fx, fz);
      this.updateRhythm(dt);
      this.parkedTimer -= dt;
      if (this.parkedTimer <= 0) {
        this.parkedTimer = 0.6;
        this.updateParkedModels(fx, fz);
      }
      for (const b of [...this.borrowed]) {
        if (b.v === this.drivingV) continue;
        b.v.update(dt, null, this.world.col, this.traffic.obstacles);
        if (Math.hypot(b.v.physics.x - fx, b.v.physics.z - fz) > 320) this.removeBorrowed(b.v);
      }
    }
    else this.envOnly(fx, fz);
    this.updateCamera(paused ? 0 : dt, paused ? null : inp);
    this.updateMissionAndHud(paused ? 0 : dt, fx, fz);
    if (!paused) {
      this.saveTimer += dt;
      if (this.saveTimer > TIME.autosaveSeconds) {
        this.saveTimer = 0;
        this.saveNow(false);
      }
    }
    this.renderFrame(dt);
  }

  private globalActions(inp: InputFrame, panel: string | null) {
    const s = getGame();
    const toggle = (p: 'map' | 'phone' | 'inventory') => s.setPanel(panel === p ? null : p);
    if (inp.pressed.has('pause')) {
      if (performance.now() - this.lastPauseAt < 300) return;
      s.setPanel(panel ? null : 'pause');
    }
    if (inp.pressed.has('map')) toggle('map');
    if (inp.pressed.has('phone')) toggle('phone');
    if (inp.pressed.has('inventory')) toggle('inventory');
  }

  private advanceTime(dt: number) {
    const before = this.energy;
    this.energy = Math.max(0, this.energy - (dt * TIME.minutesPerSecond * 4) / 60);
    if (before >= 25 && this.energy < 25) getGame().notify('Qorningiz och — osh markazi yoki bozorda ovqatlaning', 'bad');
    this.minutes += dt * TIME.minutesPerSecond;
    if (this.minutes >= 1440) {
      this.minutes -= 1440;
      useGame.setState({ day: getGame().day + 1 });
      payDailyIncome();
    }
    this.weatherTimer -= dt * TIME.minutesPerSecond;
    if (this.weatherTimer <= 0) {
      const r = Math.random();
      const w: WeatherKind = r < 0.5 ? 'clear' : r < 0.75 ? 'cloudy' : r < 0.88 ? 'rain' : 'fog';
      this.weatherTimer = 360 + Math.random() * 600;
      if (w !== getGame().weather) {
        useGame.setState({ weather: w });
        getGame().notify(w === 'rain' ? 'Yomg‘ir yog‘moqda — yo‘llar sirpanchiq' : w === 'fog' ? 'Tuman tushdi — ehtiyot bo‘lib haydang' : w === 'cloudy' ? 'Havo bulutli' : 'Havo ochildi', 'info');
      }
    }
  }

  private updateOnFoot(dt: number, inp: InputFrame) {
    this.restriction = null;
    if (this.minigame) {
      this.updateLockGame(dt, inp);
      if (this.minigame) return;
    }
    if (this.energy < 15) inp.sprint = false;
    if (this.scripted) this.tickScripted(dt);
    else this.player.update(dt, inp, this.rig.yaw, this.world.col);
    // keep out of traffic cars
    for (const o of this.traffic.obstacles) {
      const dx = this.player.x - o.x, dz = this.player.z - o.z;
      const d = Math.hypot(dx, dz);
      const min = o.r + 0.35;
      if (d < min && d > 1e-4) {
        this.player.x += (dx / d) * (min - d);
        this.player.z += (dz / d) * (min - d);
      }
    }
    if (this.vehicle) {
      this.vehicle.update(dt, null, this.world.col, this.traffic.obstacles);
      const v = this.vehicle.physics;
      const dx = this.player.x - v.x, dz = this.player.z - v.z;
      const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
      const along = dx * fx + dz * fz, lat = -dx * fz + dz * fx;
      const hl = this.vehicle.spec.dims.length / 2 + 0.3, hw = this.vehicle.spec.dims.width / 2 + 0.3;
      if (Math.abs(along) < hl && Math.abs(lat) < hw) {
        const pushLat = (hw - Math.abs(lat)) * Math.sign(lat || 1);
        this.player.x += -fz * pushLat;
        this.player.z += fx * pushLat;
      }
    }
    this.player.sync();
    this.interaction = this.poiInteraction();
    this.vehicleAction = null;
    if (inp.pressed.has('interact') && this.interaction) this.interaction.run();
  }

  private updateDriving(dt: number, inp: InputFrame) {
    const v = this.dv!;
    const before = v.physics.health;
    v.update(dt, { throttle: inp.throttle, brake: inp.brake, steer: inp.steer, handbrake: inp.handbrake }, this.world.col, [...this.traffic.obstacles, ...this.policeObstacles(), ...this.parkedCarObstacles(v)]);
    if (inp.pressed.has('horn')) this.audio.horn();
    if (inp.pressed.has('lights')) v.lightsMode = v.lightsMode === 'auto' ? 'on' : v.lightsMode === 'on' ? 'off' : 'auto';
    if (inp.pressed.has('signalLeft')) v.signal = v.signal === 'left' ? 'none' : 'left';
    if (inp.pressed.has('signalRight')) v.signal = v.signal === 'right' ? 'none' : 'right';
    if (inp.pressed.has('engine')) {
      v.physics.engineOn = !v.physics.engineOn;
      getGame().notify(v.physics.engineOn ? 'Dvigatel yondi' : 'Dvigatel o‘chirildi', 'info');
    }
    if (inp.pressed.has('walk')) this.setInterior(!this.interiorCam);
    if (v.physics.health < before - 2) this.audio.impact(v.physics.lastImpact);
    if (before > 0 && v.physics.health <= 0) getGame().notify('Dvigatel ishdan chiqdi! Avtoservisda ta’mirlang', 'bad');
    if (v.physics.fuel <= 0 && inp.throttle > 0 && Math.random() < 0.01) getGame().notify('Yoqilg‘i tugadi — AYOQSHga boring yoki mashinani chaqiring', 'bad');
    this.player.x = v.physics.x;
    this.player.z = v.physics.z;
    this.vehicleAction = this.vehicleInteraction();
    this.interaction = { label: 'Mashinadan tushish', run: () => this.exitVehicle() };
    if (inp.pressed.has('interact')) this.exitVehicle();
    else if (inp.pressed.has('vehicleAction') && this.vehicleAction) this.vehicleAction.run();
    if (inp.pressed.has('camera')) this.setInterior(!this.interiorCam);
  }

  private simulateWorld(dt: number, fx: number, fz: number, live: boolean) {
    const s = getGame();
    const blockers: { x: number; z: number; r: number }[] = [];
    const threats: { x: number; z: number; speed: number }[] = [];
    if (live) {
      if (this.inVehicle && this.dv) {
        blockers.push({ x: this.dv.physics.x, z: this.dv.physics.z, r: 1.6 });
        threats.push({ x: this.dv.physics.x, z: this.dv.physics.z, speed: Math.abs(this.dv.physics.vx) });
      } else {
        blockers.push({ x: this.player.x, z: this.player.z, r: 0.5 });
        if (this.vehicle) blockers.push({ x: this.vehicle.physics.x, z: this.vehicle.physics.z, r: 1.6 });
      }
    }
    this.traffic.update(dt, fx, fz, blockers, s.settings.renderDistance);
    this.peds.update(dt, fx, fz, threats);
    this.envOnly(fx, fz, dt);
  }

  private envOnly(fx: number, fz: number, dt = 0.016) {
    const s = getGame();
    const minutes = this.playing ? this.minutes : 17 * 60 + 20;
    const st = this.env.update(dt, minutes, this.playing && !this.interior ? s.weather : 'clear', this.camera, new THREE.Vector3(fx, 0, fz));
    this.world.update(dt, this.camera.position, st.night, st.wet, st.horizon, st.daylight);
    this.world.setTrafficLights(this.traffic.phase);
    this.vehicle?.sync(st.night, dt);
    for (const b of this.borrowed) b.v.sync(st.night, dt);
    const v = this.dv ?? this.vehicle;
    if (v && this.playing) {
      const L = v.spec.dims.length;
      v.model.root.updateMatrixWorld();
      this.headlight.position.set(0, v.spec.shape.belt - 0.15, L / 2 + 0.2);
      v.model.root.localToWorld(this.headlight.position);
      this.headlight.target.position.set(0, -1.2, L / 2 + 16);
      v.model.root.localToWorld(this.headlight.target.position);
      this.headlight.target.updateMatrixWorld();
      this.headlight.intensity = v.lightsOn && v.physics.engineOn ? Math.max(0.25, st.night) * 280 : 0;
    } else this.headlight.intensity = 0;
    this.post.setNight(st.night, st.rain);
    // time-of-day environment light and sky clouds
    this.envTimer -= dt;
    if (this.envTimer <= 0) {
      this.envTimer = 1;
      const h = this.minutes / 60;
      const key = h < 5.2 || h > 20.4 ? 'night' : h < 7.3 ? 'sunrise' : h > 18.3 ? 'sunset' : 'day';
      const tex = this.envMaps[key] ?? this.envMaps.day;
      if (tex && key !== this.envKey) {
        this.scene.environment = tex;
        this.envKey = key;
      }
    }
    this.skyClouds?.update(dt, this.camera.position, this.env['cloud'], st.rain, 1 - st.night, st.horizon);
    this.audio.update({
      inVehicle: this.inVehicle && !!this.dv?.physics.engineOn,
      rpm: this.dv?.physics.rpm ?? 0,
      throttle: this.inVehicle ? this.dv?.physics.throttleOut ?? 0 : 0,
      night: st.night,
      rain: st.rain,
      trafficDist: this.traffic.nearest(fx, fz),
      rural: (() => {
        const z = zoneAt(fx, fz);
        return z === 'village' || z === 'fields';
      })(),
    });
  }

  private updateCamera(dt: number, inp: InputFrame | null) {
    const v = this.dv;
    if (this.inVehicle && v) {
      if (this.interiorCam) {
        if (inp) this.interiorYaw = clamp(this.interiorYaw - inp.lookX * 0.003, -1.6, 1.6);
        const sh = v.spec.shape, L = v.spec.dims.length;
        const ws = L / 2 - sh.hood;
        const eye = new THREE.Vector3(0.36, sh.belt + 0.42, ws - 1.05);
        const look = new THREE.Vector3(0.36 + Math.sin(this.interiorYaw) * 10, sh.belt + 0.25, ws - 1.05 + Math.cos(this.interiorYaw) * 10);
        v.model.root.updateMatrixWorld();
        v.model.root.localToWorld(eye);
        v.model.root.localToWorld(look);
        this.camera.position.copy(eye);
        this.camera.lookAt(look);
        return;
      }
      this.rig.update(dt, inp, v.physics.x, v.physics.y + 1.25, v.physics.z, v.physics.heading, Math.abs(v.physics.vx), this.world.col);
    } else {
      this.rig.update(dt, inp, this.player.x, this.player.y + 1.55, this.player.z, null, this.player.speed, this.world.col);
      if (this.interior) {
        // keep the camera inside the room: under the ceiling and close to the player
        const it = this.interiors.list[this.interior.kind];
        const cam = this.camera.position, H = (it.height ?? 3) - 0.35;
        if (cam.y > H) cam.y = H;
        const dx = cam.x - this.player.x, dz = cam.z - this.player.z, d = Math.hypot(dx, dz);
        if (d > 3.2) { cam.x = this.player.x + (dx / d) * 3.2; cam.z = this.player.z + (dz / d) * 3.2; }
      }
    }
  }

  private updateMissionAndHud(dt: number, fx: number, fz: number) {
    const s = getGame();
    // ---- GPS: one navigator for every job and for the player's own waypoint
    const curStep = s.mission ? s.mission.steps[s.mission.stepIndex] : null;
    NAV.setTarget(this.interior ? null : curStep ? curStep.pos : s.waypoint);
    NAV.update(dt, { x: fx, z: fz }, this.inVehicle && this.dv ? this.dv.physics.speedKmh : 5);
    // ---- taxi passenger: stands at the kerb, walks to the car, rides, gets out
    const pickStep = curStep?.giveItem === 'yolovchi', dropStep = curStep?.takeItem === 'yolovchi';
    const npcSrc = pickStep && !this.customer && curStep ? this.npcSource() : null;
    if (npcSrc && curStep) {
      const r = NETW.nearestRoad(curStep.pos.x, curStep.pos.z, 30);
      let p = curStep.pos, face = 0;
      if (r) {
        let nx = curStep.pos.x - r.px, nz = curStep.pos.z - r.pz;
        const l = Math.hypot(nx, nz) || 1;
        nx /= l; nz /= l;
        p = { x: r.px + nx * (r.e.width / 2 + 1.6), z: r.pz + nz * (r.e.width / 2 + 1.6) };
        face = Math.atan2(-nx, -nz);
      }
      this.customer = new Customer(npcSrc, p, face);
      this.scene.add(this.customer.group);
    }
    if (this.customer) {
      const car = this.inVehicle && this.dv ? this.dv.physics : null;
      const door = car ? { x: car.x - Math.cos(car.heading) * 1.5, z: car.z + Math.sin(car.heading) * 1.5 } : { x: fx + 1.5, z: fz };
      if (this.customer.state === 'wait') {
        if (car) this.customer.lookAt(car);
        if (dropStep) this.customer.board(door);
        else if (!pickStep) { this.customer.dispose(); this.customer = null; }
      } else if (this.customer.state === 'ride' && dropStep && this.dv && this.inVehicle) {
        this.customer.seat(this.dv.seatRoot, this.seatOf(this.dv, -1));
      } else if (this.customer.state === 'ride' && !dropStep) {
        this.scene.add(this.customer.group);
        const away = { x: door.x - Math.cos(car?.heading ?? 0) * 6, z: door.z + Math.sin(car?.heading ?? 0) * 6 };
        this.customer.alight(door, away);
      }
      if (this.customer?.state === 'gone') { this.customer.dispose(); this.customer = null; }
      this.customer?.update(dt);
    }
    const v = this.dv ?? this.vehicle;
    const tick = dt > 0 ? updateMission(dt, { pos: { x: fx, z: fz }, inVehicle: this.inVehicle, speedKmh: this.inVehicle && v ? v.physics.speedKmh : 0 }) : null;
    const m = getGame().mission;
    const step = m ? m.steps[m.stepIndex] : null;
    this.missionBeam.visible = !!step;
    if (step) {
      this.missionBeam.position.set(step.pos.x, 0, step.pos.z);
      this.missionBeam.scale.setScalar(step.radius / 2);
      this.missionBeam.children[0].scale.set(1, 1 / (step.radius / 2), 1);
    }
    this.brokenCar.visible = !!step && step.prop === 'brokenCar';
    if (this.brokenCar.visible && step) {
      this.brokenCar.position.set(step.pos.x + 2.5, 0, step.pos.z);
      const blink = Math.floor(performance.now() / 450) % 2 === 0;
      ((this.brokenCar.children[3] as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(blink ? '#ffa020' : '#3a2408');
    }
    const wp = s.waypoint;
    this.waypointBeam.visible = !!wp;
    if (wp) {
      this.waypointBeam.position.set(wp.x, 0, wp.z);
      if (Math.hypot(wp.x - fx, wp.z - fz) < 12) {
        useGame.setState({ waypoint: null });
        s.notify('Manzilga yetdingiz', 'good');
      }
    }

    this.pullTimer += dt;
    if (this.pullTimer > 3) {
      this.pullTimer = 0;
      this.pull();
    }
    this.hudTimer += dt || 0.016;
    if (this.hudTimer < 0.1) return;
    this.hudTimer = 0;
    const target = tick?.target ?? (step ? step.pos : null);
    let arrow: number | null = null;
    if (target) {
      const a = Math.atan2(target.x - fx, target.z - fz);
      arrow = a - this.rig.yaw;
    }
    const p = v?.physics;
    const activity = m ? m.title : this.inVehicle && v ? `Haydayapti: ${v.spec.name}` : 'Piyoda';
    s.setHud({
      inVehicle: this.inVehicle,
      vehicleName: v?.spec.name ?? '',
      speedKmh: this.inVehicle && p ? p.speedKmh : 0,
      gear: p?.gear ?? 'N',
      rpm: p?.rpm ?? 0,
      fuel: p?.fuel ?? 0,
      fuelMax: v?.spec.perf.fuelCapacity ?? 1,
      health: p?.health ?? 100,
      prompt: tick?.blocked ?? this.restriction,
      district: this.interior ? this.interiors.list[this.interior.kind].title : districtNameAt(fx, fz),
      activity,
      fps: Math.round(this.fps),
      missionDistance: tick ? (NAV.route.length > 1 ? NAV.distance : tick.distance) : null,
      navEta: NAV.target && NAV.route.length > 1 ? NAV.eta : null,
      navTurn: NAV.target && NAV.turn ? (NAV.turn.dir === 'to‘g‘ri' ? `To‘g‘ri ${Math.round(NAV.turn.dist)} m` : `${NAV.turn.dir === 'chap' ? 'Chapga' : 'O‘ngga'} buriling · ${Math.round(NAV.turn.dist)} m`) : null,
      missionHold: tick ? tick.holdRatio : 0,
      missionArrow: arrow,
      waypointDistance: wp ? Math.hypot(wp.x - fx, wp.z - fz) : null,
      vehicleOwner: v ? (v.borrowed ? 'Begona · vaqtincha' : 'Sizniki') : '',
      lights: v?.lightsMode ?? 'auto',
      signal: v?.signal ?? 'none',
      engineOn: v?.physics.engineOn ?? true,
      interaction: this.interaction?.label ?? null,
      vehicleAction: this.vehicleAction?.label ?? null,
    });
    if (Math.floor(this.minutes) !== Math.floor(getGame().minutes)) useGame.setState({ minutes: this.minutes });
    if (Math.round(this.energy) !== getGame().energy) useGame.setState({ energy: Math.round(this.energy) });
    this.drawMinimap(fx, fz, target);
  }

  private drawMinimap(fx: number, fz: number, target: Vec2 | null) {
    const c = this.minimap;
    if (!c) return;
    const size = c.clientWidth || 160;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.round(size * dpr)) {
      c.width = c.height = Math.round(size * dpr);
    }
    const markers: MapMarker[] = [];
    if (target) markers.push({ pos: target, color: '#e9b44c', big: true });
    const wp = getGame().waypoint;
    if (wp) markers.push({ pos: wp, color: '#2bb3c0', big: true });
    if (this.vehicle && this.dv !== this.vehicle) markers.push({ pos: { x: this.vehicle.physics.x, z: this.vehicle.physics.z }, color: '#ffffff' });
    const heading = this.inVehicle && this.dv ? this.dv.physics.heading : this.player.heading;
    this.map.drawMinimap(c.getContext('2d')!, size, { x: fx, z: fz }, heading, this.rig.yaw, markers, this.inVehicle ? 2.6 : 4);
  }

  private renderFrame(dt: number) {
    this.post.render(dt);
    const info = this.renderer.info.render;
    this.perf.calls = info.calls;
    this.perf.triangles = info.triangles;
  }

  // ------------------------------------------------------------------ queries for UI
  get playerPos(): Vec2 {
    return this.inVehicle && this.dv ? { x: this.dv.physics.x, z: this.dv.physics.z } : { x: this.player.x, z: this.player.z };
  }
  get playerHeading() {
    return this.inVehicle && this.dv ? this.dv.physics.heading : this.player.heading;
  }
  get usesLicensedVehicle() {
    return !!this.vehicle?.usesLicensedModel;
  }

  /** run the current on-screen action (touch "E" button) */
  pressInteract() {
    this.input.press('interact');
  }

  pressVehicleAction() {
    this.input.press('vehicleAction');
  }

  toggleCamera() {
    this.input.press('camera');
  }

  describeMoney(n: number) {
    return formatSom(n);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.unsub.forEach((u) => u());
    this.input.detach();
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.renderer.dispose();
  }
}

export const gameRef: { current: Game | null } = { current: null };
