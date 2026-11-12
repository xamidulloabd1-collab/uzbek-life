// Dev-only pose sheet for the Rocketbox-based Joshqin GLB: `npm run dev` → /tools/avatar-test/
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import url from '../../src/assets/characters/joshqin.glb?url';

const params = new URLSearchParams(location.search);
const cells: [string, number][] = (params.get('cells') ?? 'idle:0,walk:0.25,run:0.2,sprint:0.15,sit:1,wave:1.4,door_out:0.8,door_out:1.6,door_out:2.4,crouch_in:1.2,crouch_in:2.4,crouch_in:3.6')
  .split(',').map((s) => { const [n, t] = s.split(':'); return [n, +t]; });
const canvas = document.getElementById('c') as HTMLCanvasElement;
const r = new THREE.WebGLRenderer({ canvas, antialias: true });
r.setScissorTest(true);
r.toneMapping = THREE.ACESFilmicToneMapping;
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const npcUrls = import.meta.glob('../../src/assets/characters/npc/*.glb', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const npc = params.get('npc');
const npcUrl = npc ? Object.entries(npcUrls).find(([k]) => k.includes(npc))?.[1] : undefined;
loader.load(url, (base) => {
  if (!npcUrl) return run(base);
  // NPC body + the player's Rocketbox clips (same Biped skeleton)
  loader.load(npcUrl, (n) => run({ ...n, animations: base.animations } as typeof base));
});
function run(g: import('three/examples/jsm/loaders/GLTFLoader.js').GLTF) {
  const cols = 6, rows = Math.ceil(cells.length / cols), W = 1600 / cols, H = 900 / rows;
  const info: string[] = [];
  cells.forEach(([name, t], i) => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#9fb0c0');
    scene.add(new THREE.HemisphereLight('#ffffff', '#6b5a48', 1.6));
    const sun = new THREE.DirectionalLight('#ffffff', 2.2); sun.position.set(2, 4, 3); scene.add(sun);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshStandardMaterial({ color: '#777' }));
    floor.rotation.x = -Math.PI / 2; scene.add(floor);
    const m = clone(g.scene); scene.add(m);
    const clip = g.animations.find((a) => a.name === name);
    if (clip) { const mx = new THREE.AnimationMixer(m); mx.clipAction(clip).play(); mx.setTime(t); }
    m.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(m, true);
    info.push(`${name}@${t}: y ${box.min.y.toFixed(2)}..${box.max.y.toFixed(2)} x ${box.min.x.toFixed(2)}..${box.max.x.toFixed(2)} z ${box.min.z.toFixed(2)}..${box.max.z.toFixed(2)} dur ${clip?.duration.toFixed(2)}`);
    const cam = new THREE.PerspectiveCamera(35, W / H, 0.1, 50);
    cam.position.set(2.2, 1.3, 3.4); cam.lookAt(0, 0.9, 0);
    const x = (i % cols) * W, y = 900 - (Math.floor(i / cols) + 1) * H;
    r.setViewport(x, y, W, H); r.setScissor(x, y, W, H);
    r.render(scene, cam);
  });
  const names = new Set<string>(); g.scene.traverse((o) => { if ((o as THREE.Bone).isBone) names.add(o.name); });
  (window as unknown as { __info: unknown }).__info = { info, clips: g.animations.map((a) => `${a.name}:${a.duration.toFixed(2)}`), bones: [...names].slice(0, 12) };
}
