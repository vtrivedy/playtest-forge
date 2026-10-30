import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';

export type PostStack = {
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  setSize: (w: number, h: number) => void;
  render: () => void;
  dispose: () => void;
};

/** Tasteful bloom + SMAA + output tone mapping. SSAO optional (heavier). */
export function createPostStack(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
): PostStack {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.35, 0.6, 0.85);
  composer.addPass(bloom);
  composer.addPass(new SMAAPass());
  composer.addPass(new OutputPass());

  return {
    composer,
    bloom,
    setSize(w, h) {
      composer.setSize(w, h);
      bloom.setSize(w, h);
    },
    render() {
      composer.render();
    },
    dispose() {
      composer.dispose();
    },
  };
}
