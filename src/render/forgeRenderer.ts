import * as THREE from 'three';

export type ForgeRenderer = {
  renderer: THREE.WebGLRenderer;
  backend: 'webgpu' | 'webgl2';
  setSize: (w: number, h: number) => void;
  render: (scene: THREE.Scene, camera: THREE.Camera) => void;
  dispose: () => void;
  domElement: HTMLCanvasElement;
};

export type RendererOptions = {
  preferWebGPU?: boolean;
  container?: HTMLElement;
  exposure?: number;
  shadows?: boolean;
  shadowMapSize?: number;
  /** Backbuffer pixel-ratio cap (quality tier); default 2 */
  pixelRatio?: number;
};

/**
 * WebGL2 by default (SwiftShader / Playwright safe).
 * preferWebGPU:true only on real GPUs — never reuse a canvas across APIs.
 */
export async function createForgeRenderer(opts: RendererOptions = {}): Promise<ForgeRenderer> {
  const container = opts.container ?? document.body;
  let backend: 'webgpu' | 'webgl2' = 'webgl2';
  let renderer: THREE.WebGLRenderer | undefined;

  if (opts.preferWebGPU) {
    try {
      const nav = navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } };
      if (nav.gpu) {
        const mod = await import('three/webgpu');
        const adapter = await nav.gpu.requestAdapter();
        const W = (mod as unknown as { WebGPURenderer?: new (o: object) => THREE.WebGLRenderer & { init: () => Promise<void> } }).WebGPURenderer;
        if (adapter && W) {
          const gpuRenderer = new W({ antialias: true, alpha: false });
          await gpuRenderer.init();
          renderer = gpuRenderer;
          backend = 'webgpu';
        }
      }
    } catch (err) {
      console.warn('[forgeRenderer] WebGPU unavailable → WebGL2', err);
      renderer = undefined;
    }
  }

  if (!renderer) {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    backend = 'webgl2';
  }

  renderer.setPixelRatio(Math.min(devicePixelRatio, opts.pixelRatio ?? 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = opts.exposure ?? 1.05;
  renderer.shadowMap.enabled = opts.shadows !== false;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);

  return {
    renderer,
    backend,
    domElement: renderer.domElement,
    setSize(w, h) {
      renderer!.setSize(w, h);
    },
    render(scene, camera) {
      renderer!.render(scene, camera);
    },
    dispose() {
      renderer!.dispose();
      renderer!.domElement.remove();
    },
  };
}
