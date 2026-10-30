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
    color: new THREE.Color(params.color ?? 0xdcc0a4),
    density: params.density ?? 0.008,
    height: params.height ?? 2,
    heightFalloff: params.heightFalloff ?? 0.08,
    horizonStrength: params.horizonStrength ?? 0.4,
  };
  // Exp2 fog frames near/mid depth; far depth is the sky mist + distant-land
  // aerial perspective, so keep density low and colour = sky mist.
  scene.fog = new THREE.FogExp2(p.color.getHex(), p.density);
  return p;
}

export function syncFog(scene: THREE.Scene, p: HeightFogParams): void {
  if (scene.fog instanceof THREE.FogExp2) {
    scene.fog.color.copy(p.color);
    scene.fog.density = p.density;
  }
}

/**
 * Point fog at the sky's horizon mist so geometry dissolves into the painted
 * horizon instead of a flat cream wall. Call after createPaintedSky.
 */
export function matchFogToSky(scene: THREE.Scene, p: HeightFogParams, mist: THREE.Color): void {
  p.color.copy(mist);
  syncFog(scene, p);
}
