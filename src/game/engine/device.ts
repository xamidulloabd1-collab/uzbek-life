import type { DeviceInfo } from '@/types';

export function hasWebGL2() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

function readGpu(): string {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') as WebGL2RenderingContext | null;
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  } catch {
    return '';
  }
}

export function detectDevice(): DeviceInfo {
  const nav = navigator as Navigator & { deviceMemory?: number; userAgentData?: { mobile?: boolean } };
  const ua = navigator.userAgent;
  const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches;
  // iPadOS reports itself as Mac, so also use touch + coarse pointer
  const mobileUA = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(ua) || nav.userAgentData?.mobile === true;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const mobile = mobileUA || (touch && coarse && Math.min(screen.width, screen.height) < 1100);
  const gpu = readGpu();
  const mem = nav.deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;

  let tier: DeviceInfo['tier'] = 'mid';
  const g = gpu.toLowerCase();
  if (mobile) {
    const strongMobile = /apple gpu|adreno \(tm\) (7[3-9]\d|8\d\d)|mali-g7[1-9]|mali-g[6-9]\d\d|immortalis|xclipse/.test(g);
    const weakMobile = /adreno \(tm\) [2-5]\d\d|mali-[4t]|mali-g5[1-2]|powervr|sgx/.test(g);
    if (weakMobile || mem <= 3 || cores <= 4) tier = 'low';
    else if (strongMobile && mem >= 6) tier = 'high';
  } else {
    const discrete = /nvidia|geforce|rtx|gtx|radeon rx|radeon pro|apple m[1-9] (pro|max|ultra)|apple m[2-9]/.test(g);
    const weak = /intel\(r\) (hd|uhd) graphics [2-6]\d\d|swiftshader|llvmpipe|mesa offscreen/.test(g);
    const laptopMid = /geforce mx ?\d{3}|mx\d{3}|iris\(r\) xe|iris xe/.test(g);
    if (weak || mem <= 4) tier = 'low';
    else if (laptopMid) tier = 'mid';
    else if (discrete && cores >= 6) tier = 'high';
  }
  return { touch, mobile, tier, gpu };
}
