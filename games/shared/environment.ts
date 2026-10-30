import * as THREE from 'three';

/** Poly Haven studio HDRI (1k). */
export const DEFAULT_HDRI =
  'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr';

const cache = new Map<string, THREE.DataTexture>();

export async function loadHDRIEnvironment(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  url: string = DEFAULT_HDRI,
): Promise<THREE.DataTexture | null> {
  try {
    // Prefer HDRLoader (three r17x+); fall back to RGBELoader.
    let LoaderCtor: new () => { loadAsync: (u: string) => Promise<THREE.DataTexture> };
    try {
      const mod = await import('three/examples/jsm/loaders/HDRLoader.js');
      LoaderCtor = (mod as { HDRLoader: typeof LoaderCtor }).HDRLoader;
    } catch {
      const mod = await import('three/examples/jsm/loaders/RGBELoader.js');
      LoaderCtor = (mod as { RGBELoader: typeof LoaderCtor }).RGBELoader;
    }
    let tex = cache.get(url);
    if (!tex) {
      tex = await new LoaderCtor().loadAsync(url);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      cache.set(url, tex);
    }
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromEquirectangular(tex).texture;
    scene.environment = env;
    scene.background = env;
    scene.backgroundBlurriness = 0.45;
    scene.backgroundIntensity = 0.65;
    pmrem.dispose();
    return tex;
  } catch (err) {
    console.warn('HDRI load failed', err);
    return null;
  }
}

export function applyStylizedIslandLights(scene: THREE.Scene): void {
  const hemi = new THREE.HemisphereLight(0x9ad0ff, 0x3a6040, 0.7);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff0d0, 2.4);
  key.position.set(8, 16, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 60;
  key.shadow.camera.left = -20;
  key.shadow.camera.right = 20;
  key.shadow.camera.top = 20;
  key.shadow.camera.bottom = -20;
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.04;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x88c0ff, 0.55);
  fill.position.set(-10, 6, -8);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffaa88, 0.4);
  rim.position.set(0, 4, -12);
  scene.add(rim);
}
