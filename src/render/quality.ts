/**
 * Render quality tiers. Real GPUs get the full stack; software rasterisers (SwiftShader,
 * llvmpipe) are fill-rate bound, so `low` trades resolution and full-screen passes for fps.
 *
 *   ?q=low|med|high   force a tier (otherwise auto-detected from the GL renderer string)
 */
export type QualityTier = 'low' | 'med' | 'high';

export type QualitySettings = {
  tier: QualityTier;
  /** Why this tier was picked (URL / detected GPU) — surfaced in __game notes */
  reason: string;
  gpu: string;
  /** Backbuffer pixel ratio cap (composer follows it) */
  pixelRatio: number;
  shadows: boolean;
  shadowMapSize: number;
  bloom: boolean;
  smaa: boolean;
  gtao: boolean;
  /** Multiplier for ambient particle counts */
  particleScale: number;
  /** Camera far plane (fog hides the cut on lower tiers) */
  far: number;
  /** Re-render the shadow map every N frames (1 = every frame) */
  shadowEvery: number;
  /** Adaptive resolution floor as a fraction of pixelRatio (1 = never drop) */
  minScale: number;
};

const TIERS: Record<QualityTier, Omit<QualitySettings, 'tier' | 'reason' | 'gpu'>> = {
  high: { pixelRatio: 2, shadows: true, shadowMapSize: 2048, bloom: true, smaa: true, gtao: true, particleScale: 1, far: 900, shadowEvery: 1, minScale: 0.5 },
  med: { pixelRatio: 1, shadows: true, shadowMapSize: 1024, bloom: true, smaa: true, gtao: false, particleScale: 0.75, far: 700, shadowEvery: 1, minScale: 0.6 },
  low: { pixelRatio: 0.5, shadows: true, shadowMapSize: 1024, bloom: false, smaa: false, gtao: false, particleScale: 0.5, far: 520, shadowEvery: 2, minScale: 1 },
};

const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/i;
const MODEST = /intel|mali|adreno|powervr|apple gpu|videocore/i;

/** Unmasked GL renderer string from a throwaway context (never reuse the canvas). */
export function probeGpu(): string {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return 'none';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const s = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return s;
  } catch {
    return 'unknown';
  }
}

export function detectQuality(search = location.search): QualitySettings {
  const gpu = probeGpu();
  const q = new URLSearchParams(search).get('q');
  let tier: QualityTier;
  let reason: string;
  if (q === 'low' || q === 'med' || q === 'high') {
    tier = q;
    reason = 'url';
  } else if (gpu === 'none' || SOFTWARE.test(gpu)) {
    tier = 'low';
    reason = 'software-gl';
  } else if (MODEST.test(gpu) || (navigator.hardwareConcurrency ?? 8) <= 4) {
    tier = 'med';
    reason = 'modest-gpu';
  } else {
    tier = 'high';
    reason = 'discrete-gpu';
  }
  return { tier, reason, gpu, ...TIERS[tier] };
}
