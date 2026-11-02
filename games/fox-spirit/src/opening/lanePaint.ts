/** Painted corridors: lanes underpainted from the start, restores running along them. DESIGN-corridors.md. */
import * as THREE from 'three';

export type LanePaintUniforms = {
  /** R = metres to the nearest lane, G = terrain height (half float) */
  uLaneMap: { value: THREE.Texture | null };
  /** minX, minZ, width, depth */
  uLaneBounds: { value: THREE.Vector4 };
  uLaneOn: { value: number };
  /** half-width of the painted band (m) */
  uLaneWidth: { value: number };
  /** underpainting strength before any restore (0 sepia … 1 full cel) */
  uLaneUnder: { value: number };
  /** how much further a restore reaches along a lane, × its bleed (m per m) */
  uLaneReach: { value: number };
  /** the whole sketch keeps this much of its authored hue at paper value (a coloured-pencil underdrawing) */
  uSketchTint: { value: number };
};

/** Added to the lookdev kit's shared uniform table before any material compiles (off until a lane map exists). */
export function createLaneUniforms(): LanePaintUniforms {
  return {
    uLaneMap: { value: null },
    uLaneBounds: { value: new THREE.Vector4(0, 0, 1, 1) },
    uLaneOn: { value: 0 },
    uLaneWidth: { value: 2.6 },
    uLaneUnder: { value: 0.85 },
    uLaneReach: { value: 3.2 },
    uSketchTint: { value: 0.3 },
  };
}

export const LANE_DECLARATIONS = /* glsl */ `
  uniform sampler2D uLaneMap;
  uniform vec4 uLaneBounds;
  uniform float uLaneOn;
  uniform float uLaneWidth;
  uniform float uLaneUnder;
  uniform float uLaneReach;
  uniform float uSketchTint;
`;

/**
 * Before the restore loop: `lane` = 1 on the ragged corridor band at ground level, 0 off it; `laneEdge` its verge;
 * `laneCore` the trodden middle; * `laneRun` a wider taper the restore loop uses to run colour down the road.
 * Needs `xz`, `rag` and `vLkWorld`.
 */
export const LANE_BAND = /* glsl */ `
  float lane = 0.0, laneEdge = 0.0, laneRun = 0.0, laneCore = 0.0;
  if (uLaneOn > 0.5) {
    vec2 laneUv = (xz - uLaneBounds.xy) / uLaneBounds.zw;
    if (laneUv.x > 0.0 && laneUv.y > 0.0 && laneUv.x < 1.0 && laneUv.y < 1.0) {
      vec2 lt = texture2D(uLaneMap, laneUv).rg;
      // the verge's edge bites in and out like a loaded brush dragged along the road
      float ld = lt.r - uLaneWidth + rag * 0.32 + (lkNoise(xz * 0.9 + 5.3) - 0.5) * 0.7;
      float above = vLkWorld.y - lt.g;
      // ground, kerbs and steps take the wash up to ~2 m; walls only a splash at their foot
      float laneUp = abs(normalize(cross(dFdx(vLkWorld), dFdy(vLkWorld))).y);
      float top = mix(0.35, 1.8, smoothstep(0.4, 0.8, laneUp));
      float low = 1.0 - smoothstep(top, top + 0.6, above + (lkNoise(xz * 1.7) - 0.5) * 0.5);
      lane = (1.0 - smoothstep(-0.25, 0.25, ld)) * low;
      laneEdge = exp(-pow((ld + 0.3) / 0.22, 2.0)) * low;
      // restores run along the lane: a stream wide where it leaves the restore, the band's width at its far end
      laneRun = (1.0 - smoothstep(-0.3, 4.0, ld)) * low;
      // the trodden middle of the road (≈1 m either side of the line) vs its grassy verges
      laneCore = (1.0 - smoothstep(-2.0, -1.0, ld)) * low;
    }
  }
`;

/** Bake the lane distance/height map over the lanes' bounds. Pure function of layout (no rand). */
export function bakeLaneMap(opts: {
  uniforms: LanePaintUniforms;
  paths: ReadonlyArray<readonly [number, number, number, number]>;
  pathDist: (x: number, z: number) => number;
  groundH: (x: number, z: number) => number;
  cell?: number;
  margin?: number;
}): { texels: number; bounds: [number, number, number, number] } {
  const { uniforms, paths, pathDist, groundH } = opts;
  const cell = opts.cell ?? 0.5;
  const margin = opts.margin ?? 10;
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const [ax, az, bx, bz] of paths) {
    minX = Math.min(minX, ax, bx); maxX = Math.max(maxX, ax, bx);
    minZ = Math.min(minZ, az, bz); maxZ = Math.max(maxZ, az, bz);
  }
  minX -= margin; minZ -= margin; maxX += margin; maxZ += margin;
  const w = Math.ceil((maxX - minX) / cell);
  const h = Math.ceil((maxZ - minZ) / cell);
  const data = new Uint16Array(w * h * 4);
  const toHalf = THREE.DataUtils.toHalfFloat;
  for (let j = 0; j < h; j++) {
    const z = minZ + (j + 0.5) * cell;
    for (let i = 0; i < w; i++) {
      const x = minX + (i + 0.5) * cell;
      const o = (j * w + i) * 4;
      data[o] = toHalf(Math.min(30, pathDist(x, z)));
      data[o + 1] = toHalf(groundH(x, z));
      data[o + 3] = toHalf(1);
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  uniforms.uLaneMap.value = tex;
  uniforms.uLaneBounds.value.set(minX, minZ, w * cell, h * cell);
  uniforms.uLaneOn.value = 1;
  return { texels: w * h, bounds: [minX, minZ, maxX, maxZ] };
}
