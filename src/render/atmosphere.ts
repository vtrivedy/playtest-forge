import * as THREE from 'three';

export type HeightFogParams = {
  color: THREE.Color;
  density: number;
  height: number;
  heightFalloff: number;
  /** Extra horizon haze */
  horizonStrength: number;
};

/**
 * Three.js fog is exponential/linear only — for lookdev we use scene.fog
 * plus a cheap screen-space height hint via material patch optional later.
 * This helper sets readable atmospheric fog matching art direction.
 */
export function applyHeightFog(scene: THREE.Scene, params: Partial<HeightFogParams> = {}): HeightFogParams {
  const p: HeightFogParams = {
    color: new THREE.Color(params.color ?? 0xc4a882),
    density: params.density ?? 0.02,
    height: params.height ?? 2,
    heightFalloff: params.heightFalloff ?? 0.08,
    horizonStrength: params.horizonStrength ?? 0.4,
  };
  // Exp2 fog reads well with floating islands; color matches cool horizon.
  scene.fog = new THREE.FogExp2(p.color.getHex(), p.density);
  return p;
}

export function syncFog(scene: THREE.Scene, p: HeightFogParams): void {
  if (scene.fog instanceof THREE.FogExp2) {
    scene.fog.color.copy(p.color);
    scene.fog.density = p.density;
  }
}
