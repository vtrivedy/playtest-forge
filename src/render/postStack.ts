import * as THREE from 'three';
import { prepareSceneWater } from './waterScene';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';

export type PostStackOptions = {
  bloomStrength?: number;
  bloomRadius?: number;
  bloomThreshold?: number;
  vignette?: number;
  /** Screen-space paper grain amount (0..0.2). Masked toward shadows; ~0.01 reads as tooth, not noise. */
  grain?: number;
  enableGTAO?: boolean;
  /** Quality switches (see quality.ts). Off passes are never added to the composer. */
  bloom?: boolean;
  smaa?: boolean;
  /** Painterly (Kuwahara) brush mix 0..1; 0 = pass not added */
  painterly?: number;
  /** Composer pixel ratio; defaults to the renderer's */
  pixelRatio?: number;
};

/** Grade endpoints: `sepia` = faded old photograph, `restored` = rich autumn. `restore` blends 0..1. */
export type GradeParams = {
  saturation: number;
  contrast: number;
  /** Faded-black lift (linear) */
  lift: number;
  shadowTint: THREE.Color;
  highlightTint: THREE.Color;
};

export type PostStack = {
  composer: EffectComposer;
  bloom: UnrealBloomPass | null;
  gtao: GTAOPass | null;
  gradePass: ShaderPass;
  /** @deprecated alias of gradePass (vignette + grain live in the grade pass) */
  vignettePass: ShaderPass;
  params: {
    bloomStrength: number;
    bloomRadius: number;
    bloomThreshold: number;
    vignette: number;
    grain: number;
    enableGTAO: boolean;
    /** Highlight compression: max-channel knee and asymptote (linear, pre-exposure). Keeps emissive cores amber, not white. */
    highlightKnee: number;
    highlightCap: number;
    /** 0 = sepia grade, 1 = restored grade */
    restore: number;
    /** Kuwahara brush mix (only live when the pass was created with painterly > 0) */
    painterly: number;
  };
  grade: { sepia: GradeParams; restored: GradeParams };
  setSize: (w: number, h: number) => void;
  /** Keep grain off the hero: screen uv centre (0..1) and radius as a fraction of screen height. r ≤ 0 disables. */
  setHeroScreen: (u: number, v: number, r: number) => void;
  render: () => void;
  dispose: () => void;
};

const fullscreenVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

/**
 * Hue-preserving highlight compression before bloom. Additive embers and emissive cores
 * stack far above 1.0; ACES then clips every channel to white. Rolling the max channel off
 * toward a cap (and warming near-white cores) keeps glows ember-amber and bloom contained.
 */
const HIGHLIGHT_GLSL = /* glsl */ `
  uniform float uKnee, uCap;
  vec3 compressHighlights(vec3 c) {
    // HDR overflow must not contaminate bloom's blur pyramid. NaN also fails this comparison.
    c = vec3(c.r >= 0.0 ? min(c.r, 64.0) : 0.0,
             c.g >= 0.0 ? min(c.g, 64.0) : 0.0,
             c.b >= 0.0 ? min(c.b, 64.0) : 0.0);
    float m = max(max(c.r, c.g), c.b);
    if (m <= uKnee) return c;
    float x = m - uKnee;
    float r = max(1e-3, uCap - uKnee);
    float mc = uKnee + x / (1.0 + x / r);
    vec3 hue = c / m;
    // near-white overloads (min channel close to max) lean toward ember amber
    float white = smoothstep(0.45, 0.9, min(min(hue.r, hue.g), hue.b));
    float hot = smoothstep(0.0, r * 2.0, x);
    hue = mix(hue, vec3(1.0, 0.66, 0.36), white * hot * 0.7);
    return hue * mc;
  }
`;

const HighlightShader = {
  name: 'HighlightCompressShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uKnee: { value: 1.4 },
    uCap: { value: 2.4 },
  },
  vertexShader: fullscreenVert,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    ${HIGHLIGHT_GLSL}
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      gl_FragColor = vec4(compressHighlights(c.rgb), c.a);
    }`,
};

/**
 * Grade + warm vignette + paper grain, in linear HDR before tone mapping.
 * Grain lives in the shadows only (fades out through the mid-tones so haze stays clean)
 * and a soft ellipse keeps it off the hero. COMPRESS folds highlight compression in when
 * bloom is off (one full-screen pass instead of two on the low tier).
 */
const GradeShader = {
  name: 'GradeShader',
  defines: { COMPRESS: 0 },
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uVignette: { value: 0.35 },
    uGrain: { value: 0.01 },
    uTime: { value: 0 },
    uHero: { value: new THREE.Vector3(0.5, 0.5, 0) },
    uAspect: { value: 16 / 9 },
    uKnee: { value: 1.4 },
    uCap: { value: 2.4 },
    uSat: { value: 1 },
    uContrast: { value: 1 },
    uLift: { value: 0 },
    uShadowTint: { value: new THREE.Color(1, 1, 1) },
    uHighTint: { value: new THREE.Color(1, 1, 1) },
  },
  vertexShader: fullscreenVert,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVignette, uGrain, uTime, uAspect, uSat, uContrast, uLift;
    uniform vec3 uHero, uShadowTint, uHighTint;
    varying vec2 vUv;
    ${HIGHLIGHT_GLSL}
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
    void main() {
      vec4 tex = texture2D(tDiffuse, vUv);
      vec3 c = tex.rgb;
    #if COMPRESS
      c = compressHighlights(c);
    #endif
      // contrast around mid-grey in log space (exposure neutral)
      c = 0.18 * exp2(log2(max(c, vec3(1e-5)) / 0.18) * uContrast);
      float l = luma(c);
      c = max(mix(vec3(l), c, uSat), 0.0);
      // split tone: cool-ish fill in the shadows, warm key in the lights
      c *= mix(uShadowTint, uHighTint, smoothstep(0.015, 0.45, l));
      // faded blacks (old photograph) — warm paper lift
      c += uLift * vec3(1.0, 0.84, 0.62) * (1.0 - smoothstep(0.0, 0.3, l));
      // warm burnt-edge vignette
      float d = distance(vUv, vec2(0.5));
      float v = smoothstep(0.35, 0.95, d) * uVignette;
      c *= mix(vec3(1.0), vec3(0.72, 0.6, 0.5), v);
      // fine paper grain, shadows only, never on the hero or bright haze
      float n = hash(vUv * vec2(1280.0, 720.0) + floor(uTime * 8.0)) - 0.5;
      float lum = luma(c);
      float shadowMask = 1.0 - smoothstep(0.03, 0.3, lum);
      vec2 hd = (vUv - uHero.xy) * vec2(uAspect, 1.0);
      float heroMask = uHero.z > 0.0 ? smoothstep(uHero.z * 0.55, uHero.z, length(hd)) : 1.0;
      // multiplicative so grain never lifts true blacks into stipple
      c *= 1.0 + n * uGrain * 4.0 * shadowMask * heroMask;
      gl_FragColor = vec4(c, tex.a);
    }`,
};

/**
 * Painterly brush pass: 4-quadrant Kuwahara (radius 3 px). Each pixel takes the mean of its
 * flattest neighbouring quadrant, so texture noise and leaf-card speckle fold into soft brush
 * dabs while silhouettes stay crisp. `uPaint` mixes it over the source.
 */
const PainterlyShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTexel: { value: new THREE.Vector2(1 / 1920, 1 / 1080) },
    uPaint: { value: 0.6 },
  },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 uTexel;
    uniform float uPaint;
    varying vec2 vUv;
    void main() {
      vec4 src = texture2D(tDiffuse, vUv);
      vec3 m[4]; vec3 v[4];
      for (int k = 0; k < 4; k++) { m[k] = vec3(0.0); v[k] = vec3(0.0); }
      for (int j = 0; j <= 3; j++) {
        for (int i = 0; i <= 3; i++) {
          vec3 a = texture2D(tDiffuse, vUv + vec2(-i, -j) * uTexel).rgb;
          vec3 b = texture2D(tDiffuse, vUv + vec2( i, -j) * uTexel).rgb;
          vec3 c = texture2D(tDiffuse, vUv + vec2(-i,  j) * uTexel).rgb;
          vec3 d = texture2D(tDiffuse, vUv + vec2( i,  j) * uTexel).rgb;
          m[0] += a; v[0] += a * a;
          m[1] += b; v[1] += b * b;
          m[2] += c; v[2] += c * c;
          m[3] += d; v[3] += d * d;
        }
      }
      vec3 best = src.rgb;
      float bestS = 1e9;
      for (int k = 0; k < 4; k++) {
        vec3 mu = m[k] / 16.0;
        vec3 var = abs(v[k] / 16.0 - mu * mu);
        float sg = var.r + var.g + var.b;
        if (sg < bestS) { bestS = sg; best = mu; }
      }
      gl_FragColor = vec4(mix(src.rgb, best, uPaint), src.a);
    }`,
};

/** Highlight compression → bloom → grade/vignette/grain → painterly → SMAA → output (ACES on renderer). */
export function createPostStack(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  opts: PostStackOptions = {},
): PostStack {
  const params = {
    bloomStrength: opts.bloomStrength ?? 0.42,
    bloomRadius: opts.bloomRadius ?? 0.55,
    bloomThreshold: opts.bloomThreshold ?? 0.82,
    vignette: opts.vignette ?? 0.32,
    grain: opts.grain ?? 0.01,
    enableGTAO: opts.enableGTAO ?? false,
    highlightKnee: 1.4,
    highlightCap: 2.4,
    restore: 0,
    painterly: opts.painterly ?? 0,
  };
  const grade = {
    sepia: {
      saturation: 0.9,
      contrast: 0.93,
      lift: 0.012,
      shadowTint: new THREE.Color(0.97, 0.95, 0.98),
      highlightTint: new THREE.Color(1.03, 1.0, 0.93),
    },
    restored: {
      saturation: 0.97,
      contrast: 1.12,
      lift: 0.003,
      // plum-umber fill under a gold key (key art: crimson shadows, golden light)
      shadowTint: new THREE.Color(0.92, 0.86, 0.97),
      highlightTint: new THREE.Color(1.03, 1.0, 0.93),
    },
  };
  const useBloom = opts.bloom ?? true;

  const composer = new EffectComposer(renderer);
  if (opts.pixelRatio !== undefined) composer.setPixelRatio(opts.pixelRatio);
  composer.addPass(new RenderPass(scene, camera));

  let gtao: GTAOPass | null = null;
  if (params.enableGTAO) {
    gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
    gtao.output = GTAOPass.OUTPUT.Default;
    // soft, wide contact AO — grounds stones and roots without a dirty halo
    gtao.blendIntensity = 0.45;
    gtao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.5, thickness: 1.2, scale: 1, samples: 12 });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    composer.addPass(gtao);
  }

  let highlightPass: ShaderPass | null = null;
  let bloom: UnrealBloomPass | null = null;
  if (useBloom) {
    highlightPass = new ShaderPass(HighlightShader);
    composer.addPass(highlightPass);
    bloom = new UnrealBloomPass(
      new THREE.Vector2(innerWidth, innerHeight),
      params.bloomStrength,
      params.bloomRadius,
      params.bloomThreshold,
    );
    composer.addPass(bloom);
  }

  const gradePass = new ShaderPass(GradeShader);
  gradePass.material.defines.COMPRESS = useBloom ? 0 : 1;
  gradePass.uniforms.uAspect!.value = innerWidth / Math.max(1, innerHeight);
  composer.addPass(gradePass);

  let paintPass: ShaderPass | null = null;
  if (params.painterly > 0) {
    paintPass = new ShaderPass(PainterlyShader);
    const pr0 = opts.pixelRatio ?? renderer.getPixelRatio();
    (paintPass.uniforms.uTexel!.value as THREE.Vector2).set(1 / (innerWidth * pr0), 1 / (innerHeight * pr0));
    composer.addPass(paintPass);
  }

  if (opts.smaa ?? true) composer.addPass(new SMAAPass());
  composer.addPass(new OutputPass());

  const U = gradePass.uniforms;
  const tmpS = new THREE.Color();
  const tmpH = new THREE.Color();

  return {
    composer,
    bloom,
    gtao,
    gradePass,
    vignettePass: gradePass,
    params,
    grade,
    setSize(w, h) {
      composer.setSize(w, h);
      gtao?.setSize(w, h);
      if (w > 0 && h > 0) U.uAspect!.value = w / h;
      const pr = opts.pixelRatio ?? renderer.getPixelRatio();
      if (paintPass && w > 0 && h > 0) (paintPass.uniforms.uTexel!.value as THREE.Vector2).set(1 / (w * pr), 1 / (h * pr));
    },
    setHeroScreen(u, v, r) {
      (U.uHero!.value as THREE.Vector3).set(u, v, r);
    },
    render() {
      if (bloom) {
        bloom.strength = params.bloomStrength;
        bloom.radius = params.bloomRadius;
        bloom.threshold = params.bloomThreshold;
        bloom.enabled = params.bloomStrength > 0;
      }
      for (const p of [highlightPass, gradePass]) {
        if (!p) continue;
        p.uniforms.uKnee!.value = params.highlightKnee;
        p.uniforms.uCap!.value = params.highlightCap;
      }
      const t = THREE.MathUtils.clamp(params.restore, 0, 1);
      const a = grade.sepia;
      const b = grade.restored;
      U.uSat!.value = THREE.MathUtils.lerp(a.saturation, b.saturation, t);
      U.uContrast!.value = THREE.MathUtils.lerp(a.contrast, b.contrast, t);
      U.uLift!.value = THREE.MathUtils.lerp(a.lift, b.lift, t);
      (U.uShadowTint!.value as THREE.Color).copy(tmpS.copy(a.shadowTint).lerp(b.shadowTint, t));
      (U.uHighTint!.value as THREE.Color).copy(tmpH.copy(a.highlightTint).lerp(b.highlightTint, t));
      U.uVignette!.value = params.vignette;
      U.uGrain!.value = params.grain;
      U.uTime!.value = performance.now() * 0.001;
      if (paintPass) paintPass.uniforms.uPaint!.value = params.painterly;
      prepareSceneWater(renderer, scene, camera);
      composer.render();
    },
    dispose() {
      composer.dispose();
    },
  };
}
