import * as THREE from 'three';
import type { PaintedSky, applyLookdevLights } from '../../../src/render/sky';
import type { HeightFogParams } from '../../../src/render/atmosphere';

/** Cross the aqueduct into cooler open water without a chapter cut or exposure change. */
export function reachMoodWeight(x: number, z: number): number {
  // World coordinates: source local174 maps to104; arrival local150 maps to80.
  return THREE.MathUtils.smoothstep(x, 66, 80) * (1 - THREE.MathUtils.smoothstep(z, -94, -78));
}

/** Runs after hubDusk, which restores the authored sky each frame. No accumulated colour drift. */
export function createReachMood(scene: THREE.Scene, lights: ReturnType<typeof applyLookdevLights>, sky: PaintedSky, fog: HeightFogParams) {
  const target = { zenith: 0x647586, mid: 0x8eaaa9, horizon: 0xb7c8be, nadir: 0x536b6c, mist: 0xb1c3bd };
  const colors = Object.entries(target).map(([key, hex]) => [key as keyof typeof target, new THREE.Color(hex)] as const);
  const keyColor = lights.key.color.clone(), hemiColor = lights.hemi.color.clone(), groundColor = lights.hemi.groundColor.clone();
  const keyTarget = new THREE.Color(0xf5ddb4), hemiTarget = new THREE.Color(0xc4d6cd), groundTarget = new THREE.Color(0x60756f);
  const sunColor = sky.params.sunColor.clone(), sunTarget = new THREE.Color(0xe3ece9);
  let weight = 0;
  return {
    update(x: number, z: number) {
      weight = reachMoodWeight(x, z);
      for (const [key, color] of colors) sky.params[key].lerp(color, weight);
      // Mist and cloud lighting also consume sunColor, beyond the sky gradient.
      sky.params.sunColor.copy(sunColor).lerp(sunTarget, weight);
      lights.key.color.copy(keyColor).lerp(keyTarget, weight);
      lights.hemi.color.copy(hemiColor).lerp(hemiTarget, weight);
      lights.hemi.groundColor.copy(groundColor).lerp(groundTarget, weight);
      fog.color.copy(sky.params.mist);
      if (scene.fog) scene.fog.color.copy(fog.color);
      // Use the authored density, never last frame's result: otherwise the
      // spatial blend compounds into clear air over successive updates.
      if (weight > 0 && scene.fog instanceof THREE.FogExp2) {
        scene.fog.density = fog.density * THREE.MathUtils.lerp(1, .4, weight);
      }
    },
    state: () => ({ k: Number(weight.toFixed(3)), mist: `#${fog.color.getHexString()}`, horizon: `#${sky.params.horizon.getHexString()}`,
      sun: `#${sky.params.sunColor.getHexString()}`,
      density: scene.fog instanceof THREE.FogExp2 ? scene.fog.density : null }),
  };
}
