import * as THREE from 'three';
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
  /** Screen-space paper grain amount (0..0.2). Masked toward shadows; ~0.015 reads as tooth, not noise. */
  grain?: number;
  enableGTAO?: boolean;
};

export type PostStack = {
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  gtao: GTAOPass | null;
  vignettePass: ShaderPass;
  params: {
    bloomStrength: number;
    bloomRadius: number;
    bloomThreshold: number;
    vignette: number;
    grain: number;
    enableGTAO: boolean;
  };
  setSize: (w: number, h: number) => void;
  /** Keep grain off the hero: screen uv centre (0..1) and radius as a fraction of screen height. r ≤ 0 disables. */
  setHeroScreen: (u: number, v: number, r: number) => void;
  render: () => void;
  dispose: () => void;
};

/**
 * Vignette + warm paper grain (old-photograph tooth).
 * Grain lives in the shadows only: it fades out through the mid-tones so bright
 * distant haze stays clean, and a soft ellipse keeps it off the hero.
 */
const VignetteGrainShader = {
  name: 'VignetteGrainShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uVignette: { value: 0.35 },
    uGrain: { value: 0.08 },
    uTime: { value: 0 },
    uHero: { value: new THREE.Vector3(0.5, 0.5, 0) },
    uAspect: { value: 16 / 9 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVignette, uGrain, uTime, uAspect;
    uniform vec3 uHero;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float d = distance(vUv, vec2(0.5));
      float v = smoothstep(0.35, 0.95, d);
      c.rgb *= 1.0 - v * uVignette;
      // fine paper grain + slow foxing drift (stable enough for stills)
      float n = hash(vUv * vec2(1280.0, 720.0) + floor(uTime * 8.0));
      float n2 = hash(vUv * 90.0 + 2.7);
      float grain = (n - 0.5) * uGrain + (n2 - 0.5) * uGrain * 0.35;
      float luma = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      float shadowMask = 1.0 - smoothstep(0.12, 0.6, luma);
      vec2 hd = (vUv - uHero.xy) * vec2(uAspect, 1.0);
      float heroMask = uHero.z > 0.0 ? smoothstep(uHero.z * 0.55, uHero.z, length(hd)) : 1.0;
      // warm grain, shadows only
      c.rgb += grain * shadowMask * heroMask * vec3(1.0, 0.92, 0.78);
      gl_FragColor = c;
    }`,
};

/** Bloom + optional GTAO + SMAA + vignette/grain + output (ACES already on renderer). */
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
    grain: opts.grain ?? 0.015,
    enableGTAO: opts.enableGTAO ?? false,
  };

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  let gtao: GTAOPass | null = null;
  if (params.enableGTAO) {
    gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
    gtao.output = GTAOPass.OUTPUT.Default;
    composer.addPass(gtao);
  }

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(innerWidth, innerHeight),
    params.bloomStrength,
    params.bloomRadius,
    params.bloomThreshold,
  );
  composer.addPass(bloom);

  const vignettePass = new ShaderPass(VignetteGrainShader);
  vignettePass.uniforms.uVignette!.value = params.vignette;
  vignettePass.uniforms.uGrain!.value = params.grain;
  vignettePass.uniforms.uAspect!.value = innerWidth / Math.max(1, innerHeight);
  composer.addPass(vignettePass);

  composer.addPass(new SMAAPass());
  composer.addPass(new OutputPass());

  return {
    composer,
    bloom,
    gtao,
    vignettePass,
    params,
    setSize(w, h) {
      composer.setSize(w, h);
      bloom.setSize(w, h);
      gtao?.setSize(w, h);
      if (w > 0 && h > 0) vignettePass.uniforms.uAspect!.value = w / h;
    },
    setHeroScreen(u, v, r) {
      (vignettePass.uniforms.uHero!.value as THREE.Vector3).set(u, v, r);
    },
    render() {
      bloom.strength = params.bloomStrength;
      bloom.radius = params.bloomRadius;
      bloom.threshold = params.bloomThreshold;
      vignettePass.uniforms.uVignette!.value = params.vignette;
      vignettePass.uniforms.uGrain!.value = params.grain;
      vignettePass.uniforms.uTime!.value = performance.now() * 0.001;
      composer.render();
    },
    dispose() {
      composer.dispose();
    },
  };
}
