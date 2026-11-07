import type { DeviceInfo, QualityPreset, Settings } from '@/types';

export interface QualityProfile {
  label: string;
  pixelRatioCap: number;
  resolutionScale: number;
  shadows: number;
  renderDistance: number;
  antialias: boolean;
  traffic: number;
  pedestrians: number;
  /** texture canvas size */
  textureSize: number;
  /** distance at which small details (balconies, AC units, stalls) appear */
  lodDistance: number;
  physicalPaint: boolean;
  rainDrops: number;
  treeShadows: boolean;
  /** leaf cards per tree (1 = full) */
  treeDetail: number;
  ao: boolean;
  bloom: boolean;
  msaa: number;
  smaa: boolean;
}

export const PRESETS: Record<QualityPreset, QualityProfile> = {
  'mobile-low': { label: 'Mobil · past', pixelRatioCap: 1, resolutionScale: 0.7, shadows: 0, renderDistance: 230, antialias: false, traffic: 0.35, pedestrians: 0.3, textureSize: 128, lodDistance: 70, physicalPaint: false, rainDrops: 500, treeShadows: false, treeDetail: 0.45, ao: false, bloom: false, msaa: 0, smaa: false },
  'mobile-medium': { label: 'Mobil · o‘rta', pixelRatioCap: 1.5, resolutionScale: 0.8, shadows: 1, renderDistance: 300, antialias: false, traffic: 0.55, pedestrians: 0.5, textureSize: 256, lodDistance: 100, physicalPaint: false, rainDrops: 900, treeShadows: false, treeDetail: 0.6, ao: false, bloom: false, msaa: 0, smaa: false },
  'mobile-high': { label: 'Mobil · yuqori', pixelRatioCap: 2, resolutionScale: 0.9, shadows: 2, renderDistance: 380, antialias: false, traffic: 0.75, pedestrians: 0.7, textureSize: 256, lodDistance: 130, physicalPaint: true, rainDrops: 1400, treeShadows: false, treeDetail: 0.75, ao: false, bloom: false, msaa: 0, smaa: false },
  low: { label: 'Past', pixelRatioCap: 1, resolutionScale: 0.85, shadows: 0, renderDistance: 320, antialias: false, traffic: 0.5, pedestrians: 0.5, textureSize: 256, lodDistance: 110, physicalPaint: false, rainDrops: 1200, treeShadows: false, treeDetail: 0.6, ao: false, bloom: false, msaa: 0, smaa: false },
  medium: { label: 'O‘rta', pixelRatioCap: 1.5, resolutionScale: 1, shadows: 2, renderDistance: 450, antialias: true, traffic: 0.8, pedestrians: 0.8, textureSize: 512, lodDistance: 170, physicalPaint: true, rainDrops: 2500, treeShadows: false, treeDetail: 0.8, ao: false, bloom: true, msaa: 0, smaa: true },
  high: { label: 'Yuqori', pixelRatioCap: 2, resolutionScale: 1, shadows: 3, renderDistance: 650, antialias: true, traffic: 1, pedestrians: 1, textureSize: 512, lodDistance: 240, physicalPaint: true, rainDrops: 4000, treeShadows: true, treeDetail: 1, ao: false, bloom: true, msaa: 4, smaa: false },
  ultra: { label: 'Ultra', pixelRatioCap: 2, resolutionScale: 1, shadows: 3, renderDistance: 820, antialias: true, traffic: 1, pedestrians: 1, textureSize: 512, lodDistance: 320, physicalPaint: true, rainDrops: 5000, treeShadows: true, treeDetail: 1, ao: true, bloom: true, msaa: 4, smaa: false },
};

export const MOBILE_PRESETS: QualityPreset[] = ['mobile-low', 'mobile-medium', 'mobile-high'];
export const DESKTOP_PRESETS: QualityPreset[] = ['low', 'medium', 'high', 'ultra'];

export const SHADOW_MAP_SIZE = [0, 512, 1024, 2048, 4096];
export const SHADOW_RANGE = [0, 35, 55, 85, 115];

/** order used by automatic quality adaptation (highest first) */
export const DESKTOP_LADDER: QualityPreset[] = ['ultra', 'high', 'medium', 'low'];
export const MOBILE_LADDER: QualityPreset[] = ['mobile-high', 'mobile-medium', 'mobile-low'];

export function recommendedPreset(d: DeviceInfo): QualityPreset {
  if (d.mobile) return d.tier === 'high' ? 'mobile-high' : d.tier === 'mid' ? 'mobile-medium' : 'mobile-low';
  return d.tier === 'high' ? 'high' : d.tier === 'mid' ? 'medium' : 'low';
}

export function settingsFromPreset(preset: QualityPreset, base?: Partial<Settings>): Settings {
  const p = PRESETS[preset];
  return {
    mouseSensitivity: 1,
    invertY: false,
    volume: 0.7,
    showFps: false,
    touchButtonScale: 1,
    ...base,
    preset,
    resolutionScale: p.resolutionScale,
    shadows: p.shadows,
    renderDistance: p.renderDistance,
    antialias: p.antialias,
    trafficDensity: p.traffic,
    pedestrianDensity: p.pedestrians,
    dynamicResolution: preset.startsWith('mobile') || base?.dynamicResolution === true,
    autoQuality: base?.autoQuality ?? true,
  };
}
