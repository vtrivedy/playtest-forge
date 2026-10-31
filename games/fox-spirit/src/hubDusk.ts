import * as THREE from 'three';
import type { PaintedSky, applyLookdevLights } from '../../../src/render/sky';
import type { HeightFogParams } from '../../../src/render/atmosphere';

export const HUB_DUSK = { kOverride: -1, key: 1.05, hemi: .38, rim: .8, skyScale: .56, sunScale: .3, sunSize: .0003, sunBloom: .025, godRays: .08, horizonGlow: .18, cloudAmount: .38 };

/** Spatial mood only: no time lag after teleports, hard region seam or exposure override. */
export function hubDuskWeight(x: number, z: number): number {
  if (HUB_DUSK.kOverride >= 0) return THREE.MathUtils.clamp(HUB_DUSK.kOverride, 0, 1);
  return THREE.MathUtils.smoothstep(z, 68, 88) * (1 - THREE.MathUtils.smoothstep(Math.abs(x), 45, 55));
}

export function createHubDusk(scene: THREE.Scene, lights: ReturnType<typeof applyLookdevLights>, sky: PaintedSky, fog: HeightFogParams) {
  const base = { key: lights.key.intensity, hemi: lights.hemi.intensity, rim: lights.rim.intensity,
    sunColor: sky.params.sunColor.clone(), sunSize: sky.params.sunSize,
    sunBloom: sky.params.sunBloom, godRays: sky.params.godRays, horizonGlow: sky.params.horizonGlow, cloudAmount: sky.params.cloudAmount };
  const colors = (['zenith', 'mid', 'horizon', 'nadir', 'mist'] as const).map(key => [key, sky.params[key].clone()] as const);
  let weight = 0;
  return {
    update(x: number, z: number) {
      weight = hubDuskWeight(x, z);
      for (const key of ['key', 'hemi', 'rim'] as const) lights[key].intensity = THREE.MathUtils.lerp(base[key], HUB_DUSK[key], weight);
      for (const [key, color] of colors) sky.params[key].copy(color).multiplyScalar(THREE.MathUtils.lerp(1, HUB_DUSK.skyScale, weight));
      sky.params.sunColor.copy(base.sunColor).multiplyScalar(THREE.MathUtils.lerp(1, HUB_DUSK.sunScale, weight));
      sky.params.sunSize = THREE.MathUtils.lerp(base.sunSize, HUB_DUSK.sunSize, weight);
      sky.params.sunBloom = THREE.MathUtils.lerp(base.sunBloom, HUB_DUSK.sunBloom, weight);
      sky.params.godRays = THREE.MathUtils.lerp(base.godRays, HUB_DUSK.godRays, weight);
      for (const key of ['horizonGlow', 'cloudAmount'] as const) sky.params[key] = THREE.MathUtils.lerp(base[key], HUB_DUSK[key], weight);
      fog.color.copy(sky.params.mist);
      if (scene.fog) scene.fog.color.copy(fog.color);
    },
    state: () => ({ k: Number(weight.toFixed(3)), key: lights.key.intensity, hemi: lights.hemi.intensity,
      rim: lights.rim.intensity, sunSize: sky.params.sunSize, sunColor: sky.params.sunColor.toArray() }),
  };
}
