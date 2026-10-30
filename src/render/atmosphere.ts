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
 * Exponential height fog: density falls off with altitude, d(h) = density · e^(−falloff·(h − height)),
 * integrated along each view ray. Valleys and the void under the islands fill with mist; summits and
 * high landmarks stay clear. Patches the global fog chunks, so every built-in material (and any
 * ShaderMaterial with `fog: true`) shares it. `density` stays live on scene.fog; height/falloff are
 * baked into the shader when this is called (before the first compile).
 */
export function applyHeightFog(scene: THREE.Scene, params: Partial<HeightFogParams> = {}): HeightFogParams {
  const p: HeightFogParams = {
    color: new THREE.Color(params.color ?? 0xdcc0a4),
    density: params.density ?? 0.008,
    height: params.height ?? 2,
    heightFalloff: params.heightFalloff ?? 0.08,
    horizonStrength: params.horizonStrength ?? 0.4,
  };
  const f = (x: number) => x.toFixed(5);
  THREE.ShaderChunk.fog_pars_vertex = `#ifdef USE_FOG
    varying float vFogDepth;
    varying vec3 vFogWorld;
  #endif`;
  THREE.ShaderChunk.fog_vertex = `#ifdef USE_FOG
    vFogDepth = - mvPosition.z;
    vFogWorld = transpose(mat3(viewMatrix)) * (mvPosition.xyz - viewMatrix[3].xyz);
  #endif`;
  THREE.ShaderChunk.fog_pars_fragment = `#ifdef USE_FOG
    uniform vec3 fogColor;
    varying float vFogDepth;
    varying vec3 vFogWorld;
    #ifdef FOG_EXP2
      uniform float fogDensity;
    #else
      uniform float fogNear;
      uniform float fogFar;
    #endif
  #endif`;
  THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
    #ifdef FOG_EXP2
      float hfK = ${f(p.heightFalloff)};
      float hfCam = clamp(cameraPosition.y - ${f(p.height)}, -60.0, 400.0);
      float hfDy = clamp(vFogWorld.y - cameraPosition.y, -400.0, 400.0);
      float hfDist = length(vFogWorld - cameraPosition);
      // ∫ e^(−k(h0 + t·dy)) dt over the ray, t ∈ [0,1]
      float hfLine = abs(hfDy) > 0.01 ? (1.0 - exp(-hfK * hfDy)) / (hfK * hfDy) : 1.0;
      float hfOptical = fogDensity * exp(-hfK * hfCam) * hfLine * hfDist;
      float fogFactor = 1.0 - exp(-hfOptical * hfOptical * 0.5 - hfOptical * 0.5);
    #else
      float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    #endif
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, clamp(fogFactor, 0.0, 1.0));
  #endif`;
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
