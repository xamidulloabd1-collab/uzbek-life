import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { VehicleCustom } from '@/types';
import { VEHICLE_MAP } from '@/config/vehicles';
import { buildVehicleModel, type VehicleModel } from '@/game/vehicles/vehicleModel';
import { TextureLib } from '@/game/world/textures';
import { gameRef } from '@/game/Game';
import { fitVehicleModel, paintMaterials } from '@/game/vehicles/fitModel';

let fallbackTex: TextureLib | null = null;

/** Small showroom renderer: drag to rotate, auto-spins when idle */
export default function VehiclePreview({ specId, custom }: { specId: string; custom: VehicleCustom }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const state = useRef<{ renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; model: VehicleModel | null; glb: THREE.Object3D | null; yaw: number; drag: number | null; raf: number } | null>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    const scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.03).texture;
    pm.dispose();
    const key = new THREE.DirectionalLight('#ffffff', 2.2);
    key.position.set(4, 7, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key, new THREE.HemisphereLight('#cfe3ff', '#2a2420', 0.6));
    const floor = new THREE.Mesh(new THREE.CircleGeometry(4.5, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#1b2c40', roughness: 0.35, metalness: 0.2 }));
    floor.receiveShadow = true;
    scene.add(floor);
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    const s = { renderer, scene, camera, model: null as VehicleModel | null, glb: null as THREE.Object3D | null, yaw: 0.7, drag: null as number | null, raf: 0 };
    state.current = s;
    const resize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const loop = () => {
      s.raf = requestAnimationFrame(loop);
      if (s.drag === null) s.yaw += 0.004;
      if (s.model) s.model.root.rotation.y = s.yaw;
      if (s.glb) s.glb.rotation.y = s.yaw;
      renderer.render(scene, camera);
    };
    loop();
    const down = (e: PointerEvent) => {
      s.drag = e.clientX;
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (s.drag === null) return;
      s.yaw += (e.clientX - s.drag) * 0.01;
      s.drag = e.clientX;
    };
    const up = () => (s.drag = null);
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    return () => {
      cancelAnimationFrame(s.raf);
      ro.disconnect();
      s.model?.dispose();
      renderer.dispose();
      state.current = null;
    };
  }, []);

  useEffect(() => {
    const s = state.current;
    if (!s) return;
    const spec = VEHICLE_MAP[specId];
    if (s.model) {
      s.scene.remove(s.model.root);
      s.model.dispose();
    }
    if (s.glb) {
      s.scene.remove(s.glb);
      s.glb = null;
    }
    if (spec.modelUrl && gameRef.current) {
      void gameRef.current.ensureModel(specId).then((e) => {
        if (!e || !state.current || state.current.model !== m) return;
        const obj = fitVehicleModel(e.gltf, spec.dims.length, e.rotate, true);
        paintMaterials(obj).forEach((p) => p.color.set(custom.color));
        state.current.scene.remove(m.root);
        state.current.scene.add(obj);
        state.current.glb = obj;
      });
    }
    const tex = gameRef.current?.world?.tex ?? (fallbackTex ??= new TextureLib(256));
    const m = buildVehicleModel(spec, custom, tex, true, false);
    m.root.traverse((o) => ((o as THREE.Mesh).castShadow = true));
    s.scene.add(m.root);
    s.model = m;
    const L = spec.dims.length;
    s.camera.position.set(0, L * 0.42, L * 1.55);
    s.camera.lookAt(0, spec.dims.height * 0.42, 0);
  }, [specId, custom.color, custom.wheels, custom.tint, custom.plate]);

  return <canvas ref={ref} />;
}
