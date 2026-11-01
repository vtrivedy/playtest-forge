/** Continuous opening watercolor wake. DESIGN-opening-paint.md. */
import * as THREE from 'three';
import { ColorField } from '../../../../src/render/colorField';

export type OpeningPaintUniforms = {
  uTrailMap: { value: THREE.Texture | null };
  /** minX, minZ, width, depth */
  uTrailBounds: { value: THREE.Vector4 };
  uTrailOn: { value: number };
};

/** Added to the lookdev kit's shared uniform table before any material compiles. */
export function createTrailUniforms(): OpeningPaintUniforms {
  return {
    uTrailMap: { value: null },
    uTrailBounds: { value: new THREE.Vector4(0, 0, 1, 1) },
    uTrailOn: { value: 0 },
  };
}

/** Fragment declarations consumed by the existing paper/cel shader. */
export const TRAIL_DECLARATIONS = /* glsl */ `
  uniform sampler2D uTrailMap;
  uniform vec4 uTrailBounds;
  uniform float uTrailOn;
`;

/** Insert after the analytic restore loop, before the paper/cel mix. */
export const TRAIL_BLEND = /* glsl */ `
  if (uTrailOn > 0.5) {
    vec2 trailUv = (xz - uTrailBounds.xy) / uTrailBounds.zw;
    float inside = step(0.0, trailUv.x) * step(0.0, trailUv.y)
                 * step(trailUv.x, 1.0) * step(trailUv.y, 1.0);
    // The same ragged mask supplies gameplay and paint. A small tooth displacement breaks
    // the perimeter without turning the wake into isolated spots or a hard ribbon.
    vec2 bleed = vec2(lkNoise(xz * 2.1), lkNoise(xz * 2.1 + 8.7)) - 0.5;
    vec2 uv = clamp(trailUv + bleed * 0.11 / uTrailBounds.zw, 0.0, 1.0);
    float source = texture2D(uTrailMap, uv).r * inside;
    // Trees and walls wake from their feet; crowns require stronger nearby pigment.
    source = max(0.0, source - lift * 0.15);
    float wake = smoothstep(0.04, 0.7, source);
    float rim = exp(-pow((source - 0.25) / 0.11, 2.0)) * inside;
    tide = max(tide, rim * 0.32 * (1.0 - paint));
    bloom = max(bloom, exp(-pow((source - 0.08) / 0.055, 2.0)) * inside * 0.32 * (1.0 - paint));
    paint = max(paint, wake);
  }
`;

export function createOpeningPaint(opts: {
  field: ColorField;
  renderer: THREE.WebGLRenderer;
  uniforms: OpeningPaintUniforms;
  groundH: (x: number, z: number) => number;
}) {
  const { field, renderer, uniforms, groundH } = opts;
  field.groundAt = groundH;
  field.auraRadius = 2.2;
  field.trailRadius = 1.5;
  field.trailLife = 10;
  // <= 128 GPU stamps, with headroom for hearth, aura and dash strokes.
  field.trailMax = 96;
  field.trailDepositInterval = 0.11;
  const target = renderer.getRenderTarget();
  const clear = renderer.getClearColor(new THREE.Color());
  const alpha = renderer.getClearAlpha();
  field.initMask(renderer);
  renderer.setRenderTarget(target);
  renderer.setClearColor(clear, alpha);
  const b = field.bounds;
  uniforms.uTrailBounds.value.set(b.minX, b.minZ, b.maxX - b.minX, b.maxZ - b.minZ);
  uniforms.uTrailMap.value = field.getMaskTexture();
  uniforms.uTrailOn.value = 1;
  let distance = 0;
  let previous: THREE.Vector3 | null = null;
  return {
    /** Owns field.update; call once after fox movement and before hearth probes/render. */
    update(dt: number, position: THREE.Vector3) {
      if (previous) {
        const d = previous.distanceTo(position);
        if (d < 5) distance += d; // teleports are not paint travel
        else field.trail.length = 0;
      }
      (previous ??= new THREE.Vector3()).copy(position);
      field.fox.copy(position);
      field.update(dt);
      // ColorField's auxiliary render changes clear state; keep the opening renderer stable.
      const color = renderer.getClearColor(clear);
      const a = renderer.getClearAlpha();
      field.renderMask(dt);
      renderer.setClearColor(color, a);
    },
    state() {
      return { trailSamples: field.trail.length, supply: field.sample(field.fox), distance, restores: field.restores.length };
    },
    dispose() {
      uniforms.uTrailOn.value = 0;
      uniforms.uTrailMap.value = null;
      field.dispose();
    },
  };
}
