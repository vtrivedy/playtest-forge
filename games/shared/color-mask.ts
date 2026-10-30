import * as THREE from 'three';

/** World-space color awakening: temp aura/trail + permanent shrine floods. */
export type TrailSample = { x: number; y: number; z: number; life: number };

export type ColorMaskState = {
  fox: THREE.Vector3;
  auraRadius: number;
  trail: TrailSample[];
  trailMax: number;
  trailDepositInterval: number;
  trailLife: number;
  _accum: number;
  shrines: Array<{ position: THREE.Vector3; radius: number; activated: boolean }>;
  /** 0 = full mono world (except fox), 1 = ignored when shrines drive permanence */
  globalColor: number;
};

export function createColorMaskState(): ColorMaskState {
  return {
    fox: new THREE.Vector3(),
    auraRadius: 2.4,
    trail: [],
    trailMax: 48,
    trailDepositInterval: 0.05,
    trailLife: 2.8,
    _accum: 0,
    shrines: [],
    globalColor: 0,
  };
}

export function updateColorTrail(state: ColorMaskState, dt: number, foxPos: THREE.Vector3): void {
  state.fox.copy(foxPos);
  state._accum += dt;
  for (const t of state.trail) t.life -= dt;
  state.trail = state.trail.filter((t) => t.life > 0);
  if (state._accum >= state.trailDepositInterval) {
    state._accum = 0;
    state.trail.push({ x: foxPos.x, y: foxPos.y, z: foxPos.z, life: state.trailLife });
    if (state.trail.length > state.trailMax) state.trail.shift();
  }
}

/** Saturation factor 0..1 at a world point (CPU helper for gameplay probes). */
export function sampleColorMask(state: ColorMaskState, p: THREE.Vector3): number {
  let s = state.globalColor;
  for (const sh of state.shrines) {
    if (sh.activated && p.distanceTo(sh.position) <= sh.radius) s = Math.max(s, 1);
  }
  const aura = 1 - Math.min(1, p.distanceTo(state.fox) / state.auraRadius);
  s = Math.max(s, Math.pow(Math.max(0, aura), 1.2));
  for (const t of state.trail) {
    const d = p.distanceTo(new THREE.Vector3(t.x, t.y, t.z));
    const fall = 1 - Math.min(1, d / (state.auraRadius * 0.75));
    s = Math.max(s, fall * (t.life / state.trailLife));
  }
  return THREE.MathUtils.clamp(s, 0, 1);
}

/**
 * Patch a MeshStandardMaterial to lerp toward grayscale unless the color mask says otherwise.
 * Fox should NOT use this — stay fully saturated.
 */
export function applyColorMaskToMaterial(mat: THREE.MeshStandardMaterial, state: ColorMaskState): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uFox = { value: state.fox };
    shader.uniforms.uAura = { value: state.auraRadius };
    shader.uniforms.uGlobalColor = { value: state.globalColor };
    shader.uniforms.uShrinePos = { value: new THREE.Vector3() };
    shader.uniforms.uShrineRad = { value: 0 };
    shader.uniforms.uShrineOn = { value: 0 };
    // Pack up to 16 trail samples
    shader.uniforms.uTrail = { value: new Float32Array(16 * 4) };
    shader.uniforms.uTrailCount = { value: 0 };
    shader.uniforms.uTrailLife = { value: state.trailLife };

    (mat as THREE.MeshStandardMaterial & { userData: { colorMaskShader: typeof shader } }).userData.colorMaskShader =
      shader;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWorldPos;`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWorldPos;
        uniform vec3 uFox;
        uniform float uAura;
        uniform float uGlobalColor;
        uniform vec3 uShrinePos;
        uniform float uShrineRad;
        uniform float uShrineOn;
        uniform float uTrail[64];
        uniform int uTrailCount;
        uniform float uTrailLife;

        float colorMaskAt(vec3 p) {
          float s = uGlobalColor;
          if (uShrineOn > 0.5) {
            float sd = distance(p, uShrinePos);
            if (sd <= uShrineRad) s = max(s, 1.0);
          }
          float ad = distance(p, uFox);
          s = max(s, pow(1.0 - clamp(ad / uAura, 0.0, 1.0), 1.2));
          for (int i = 0; i < 16; i++) {
            if (i >= uTrailCount) break;
            vec3 tp = vec3(uTrail[i*4], uTrail[i*4+1], uTrail[i*4+2]);
            float life = uTrail[i*4+3];
            float td = distance(p, tp);
            float fall = 1.0 - clamp(td / (uAura * 0.75), 0.0, 1.0);
            s = max(s, fall * (life / uTrailLife));
          }
          return clamp(s, 0.0, 1.0);
        }
        `,
      )
      .replace(
        '#include <opaque_fragment>',
        `
        float cm = colorMaskAt(vWorldPos);
        float luma = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
        vec3 mono = vec3(luma);
        outgoingLight = mix(mono, outgoingLight, cm);
        #include <opaque_fragment>
        `,
      );
  };
  mat.needsUpdate = true;
}

export function syncColorMaskUniforms(mat: THREE.MeshStandardMaterial, state: ColorMaskState): void {
  const shader = (mat.userData as { colorMaskShader?: { uniforms: Record<string, { value: unknown }> } })
    .colorMaskShader;
  if (!shader) return;
  const u = shader.uniforms;
  (u.uFox!.value as THREE.Vector3).copy(state.fox);
  u.uAura!.value = state.auraRadius;
  u.uGlobalColor!.value = state.globalColor;
  u.uTrailLife!.value = state.trailLife;
  const sh = state.shrines[0];
  if (sh) {
    (u.uShrinePos!.value as THREE.Vector3).copy(sh.position);
    u.uShrineRad!.value = sh.radius;
    u.uShrineOn!.value = sh.activated ? 1 : 0;
  }
  const arr = u.uTrail!.value as Float32Array;
  const n = Math.min(16, state.trail.length);
  u.uTrailCount!.value = n;
  // newest last
  const start = Math.max(0, state.trail.length - n);
  for (let i = 0; i < n; i++) {
    const t = state.trail[start + i]!;
    arr[i * 4] = t.x;
    arr[i * 4 + 1] = t.y;
    arr[i * 4 + 2] = t.z;
    arr[i * 4 + 3] = t.life;
  }
}
