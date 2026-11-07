import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { ASSETS, type AssetEntry } from '@/assets/manifest';

/**
 * Central asset pipeline.
 * - Every external file is declared in src/assets/manifest.ts with its licence and status.
 * - Files are read as ArrayBuffers (works for bundled data: URIs and normal URLs)
 *   and handed to loader.parse(), so no loader ever needs network access to other hosts.
 * - GLB support includes Meshopt-compressed geometry and KTX2 textures (when a transcoder is configured).
 * - Results are cached; failures resolve to null so the game can fall back to procedural assets.
 */
export class AssetManager {
  private gltf = new GLTFLoader();
  private rgbe = new RGBELoader();
  private cache = new Map<string, Promise<unknown>>();
  readonly report: { id: string; ok: boolean; ms: number; status: AssetEntry['status'] }[] = [];

  constructor(renderer?: THREE.WebGLRenderer) {
    // Meshopt uses WebAssembly; if a host forbids WASM the promise rejects quietly and
    // only meshopt-compressed GLBs are affected.
    (MeshoptDecoder.ready as Promise<void>).catch(() => undefined);
    this.gltf.setMeshoptDecoder(MeshoptDecoder);
    // Draco-compressed GLBs (common on Sketchfab/optimised exports). Decoder files live in public/draco/;
    // they are not inlined into the single-file build, so there Draco files report a clear error instead.
    const draco = new DRACOLoader().setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
    this.gltf.setDRACOLoader(draco);
    if (renderer) {
      // KTX2 needs the Basis transcoder files hosted next to the game (public/basis/).
      // It is only enabled when those files exist, see ASSETS.md.
      const ktx2Path = (import.meta.env.VITE_BASIS_PATH as string | undefined) ?? '';
      if (ktx2Path) {
        const ktx2 = new KTX2Loader().setTranscoderPath(ktx2Path).detectSupport(renderer);
        this.gltf.setKTX2Loader(ktx2);
      }
    }
  }

  static async buffer(url: string): Promise<ArrayBuffer> {
    if (url.startsWith('data:')) {
      const b64 = url.slice(url.indexOf(',') + 1);
      const bin = atob(b64);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out.buffer;
    }
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
    return r.arrayBuffer();
  }

  private timed<T>(id: string, work: () => Promise<T>): Promise<T | null> {
    const hit = this.cache.get(id) as Promise<T | null> | undefined;
    if (hit) return hit;
    const entry = ASSETS[id];
    const t0 = performance.now();
    const p = work()
      .then((v) => {
        this.report.push({ id, ok: true, ms: Math.round(performance.now() - t0), status: entry?.status ?? 'final' });
        return v;
      })
      .catch((e: unknown) => {
        console.warn(`[assets] ${id} failed`, e);
        this.report.push({ id, ok: false, ms: Math.round(performance.now() - t0), status: entry?.status ?? 'final' });
        return null;
      });
    this.cache.set(id, p);
    return p;
  }

  loadGLTF(id: string, url = ASSETS[id]?.url): Promise<GLTF | null> {
    if (!url) return Promise.resolve(null);
    return this.timed(id, async () => {
      const buf = await AssetManager.buffer(url);
      return new Promise<GLTF>((res, rej) => this.gltf.parse(buf, '', res, rej));
    });
  }

  parseGLB(buf: ArrayBuffer): Promise<GLTF> {
    const head = new TextDecoder().decode(new Uint8Array(buf, 0, Math.min(buf.byteLength, 4000)));
    const draco = head.includes('KHR_draco_mesh_compression');
    return new Promise<GLTF>((res, rej) =>
      this.gltf.parse(buf.slice(0), '', res, (e) => rej(new Error(draco ? `Draco siqilgan GLB: dekoder topilmadi (${String(e).slice(0, 80)}). Siqilmagan GLB eksport qiling.` : String(e)))),
    );
  }

  loadHDR(id: string): Promise<THREE.DataTexture | null> {
    const url = ASSETS[id]?.url;
    if (!url) return Promise.resolve(null);
    return this.timed(id, async () => {
      const buf = await AssetManager.buffer(url);
      const d = this.rgbe.parse(buf);
      const tex = new THREE.DataTexture(d.data as unknown as Uint16Array, d.width, d.height, THREE.RGBAFormat, d.type);
      tex.colorSpace = THREE.LinearSRGBColorSpace;
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      tex.flipY = true;
      tex.needsUpdate = true;
      return tex;
    });
  }
}
