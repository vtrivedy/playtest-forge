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
    enableGTAO: boolean;
  };
  setSize: (w: number, h: number) => void;
  render: () => void;
  dispose: () => void;
};

const VignetteShader = {
  name: 'VignetteShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uVignette: { value: 0.35 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float d = distance(vUv, vec2(0.5));
      float v = smoothstep(0.35, 0.95, d);
      c.rgb *= 1.0 - v * uVignette;
      gl_FragColor = c;
    }`,
};

/** Bloom + optional GTAO + SMAA + vignette + output (ACES already on renderer). */
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

  const vignettePass = new ShaderPass(VignetteShader);
  vignettePass.uniforms.uVignette!.value = params.vignette;
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
    },
    render() {
      bloom.strength = params.bloomStrength;
      bloom.radius = params.bloomRadius;
      bloom.threshold = params.bloomThreshold;
      vignettePass.uniforms.uVignette!.value = params.vignette;
      composer.render();
    },
    dispose() {
      composer.dispose();
    },
  };
}
