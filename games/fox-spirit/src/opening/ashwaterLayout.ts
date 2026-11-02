/**
 * Ashwater Reach (DESIGN-ashwater.md): world II, a rain marsh far east of the vale (origin x = +700). Pure layout data
 * + terrain. `H` is the walkable ground, `E` the signed distance out of the world shape (m outside, < 0 inside).
 * Everything is authored in local coordinates (lx, lz) = (x − 700, z − 80) and runs south (spawn) → north (Seedwell):
 *   Landing → [Low Sluice channel] → Reed Island → [Reed Pond, mats] → Mill Shore → [Mill Pool, steps] → Weir → glide → Seedwell
 * No imports from layout.ts.
 */
import * as THREE from 'three';

const { smoothstep } = THREE.MathUtils;

export const ASH_ORIGIN = { x: 700, z: 80 } as const;
/** world-space point from local marsh coordinates */
export const ash = (lx: number, lz: number) => ({ x: ASH_ORIGIN.x + lx, z: ASH_ORIGIN.z + lz });

/** the marsh is an oval island in the rain: rx × rz (m) */
const RX = 66;
const RZ = 62;

/** water rectangles in local coords [x0, x1, z0, z1]; `full` = surface height when held, `drained` = after the sluice */
export const WATER = {
  /** level 1: the Low Sluice channel spans the whole marsh, landing ↔ Reed Island */
  channel: { x0: -80, x1: 80, z0: -33, z1: -24, full: -0.15, drained: -1.25 },
  /** level 2: Reed Pond spans the marsh, Reed Island ↔ Mill Shore; only the earned reed mats cross it */
  pond: { x0: -80, x1: 80, z0: -8, z1: 14, full: -0.15, drained: -0.15 },
  /** level 3: the Mill Pool below the weir; its steps only stand clear once it is drained */
  pool: { x0: -15, x1: 15, z0: 20, z1: 33.2, full: -0.15, drained: -1.25 },
} as const;
export type WaterId = keyof typeof WATER;
/** fixed iteration order (module-level: no array literal per call on the hot path) */
export const WATER_IDS: ReadonlyArray<WaterId> = ['channel', 'pond', 'pool'];
/** channel / pond / pool bed height (below a full surface, above a drained one) */
export const BED = -1.0;

/** the Low Sluice's reed dam (on the landing bank, west of the path) and the mill race's dam (on an islet in the pond) */
export const DAM_A = { lx: -11, lz: -35.2, reach: 3.2 };
export const ISLET = { lx: 23.6, lz: 1.0, r: 2.6 };
export const DAM_B = { lx: 24.4, lz: 1.0, reach: 3.2 };

/** reed mats over Reed Pond (the main crossing) and the branch out to the dam islet: [lx, lz] centres, 1.8 m square */
export const MATS: ReadonlyArray<readonly [number, number]> = [
  // 3 m apart, 2.3 m across: ~0.7–1 m of open water between — a running jump, mat to mat (a standing one falls short)
  [-0.8, -6.0], [0.8, -3.0], [0, 0], [-0.9, 3.0], [0.6, 6.0], [-0.5, 9.0], [0.4, 12.0],
  // the branch east from the third mat out to the dam islet
  [3.2, 0.5], [6.4, 0.2], [9.6, 0.7], [12.8, 0.4], [16.0, 0.8], [19.2, 0.6],
];
export const MAT_HALF = 1.15;
/** mats float this far above the pond surface */
export const MAT_RISE = 0.14;

/** the weir plateau north of the Mill Pool, and the steps that climb out of the drained pool onto it */
export const WEIR = { z0: 33.6, top: 4.4, xMax: 12 };
export const STEPS: ReadonlyArray<{ lz: number; top: number }> = [-0.4, 0.2, 0.8, 1.4, 2.0, 2.6, 3.2, 3.8, 4.4].map((top, i) => ({ lz: 27.75 + i * 0.68, top }));
export const STEP_HALF = { x: 1.6, z: 0.38 };

/** the Reed Seedwell on its own ledge east of the weir: reached by gliding off the plateau's east lip */
/** the Seedwell ledge stands against the cistern's east wall, higher than the weir and too far to glide to: only the
 * Ferrykeeper's punt, lifted by a flooded cistern, reaches it */
export const LEDGE = { x0: 15.5, x1: 22, z0: 21, z1: 30, top: 5.0 };
export const SEEDWELL = { lx: 19, lz: 25.5 };
/** the Mill Pool is a walled cistern (slate walls W/S/E; the weir is its north side); its south gate shuts in a flood */
export const CISTERN = { wallTop: 5.0, wall: 0.5, gate: { x0: -2.2, x1: 2.2 } };
/** dashing the weir's reed gate floods the cistern to `level` for `hold` s, then it washes out and the gate re-forms */
export const FLOOD = { level: 4.3, rise: 9, hold: 45, fall: 6 };
export const DAM_C = { lx: 5.5, lz: 37.2, reach: 3.2 };
/** the last ferry, moored by the weir's east end; it floats on whatever the cistern holds */
export const PUNT = { lx: 11.4, lz: 32.2, hx: 1.6, hz: 0.65, rise: 0.22 };

/** spawn (and the return arch) on the landing, facing north */
export const ASH_SPAWN = { lx: 0, lz: -46, yaw: Math.PI };

/** signed distance to an axis-aligned local rectangle (negative inside) */
function sdRect(lx: number, lz: number, x0: number, x1: number, z0: number, z1: number): number {
  const dx = Math.max(x0 - lx, lx - x1);
  const dz = Math.max(z0 - lz, lz - z1);
  return dx > 0 && dz > 0 ? Math.hypot(dx, dz) : Math.max(dx, dz);
}

/** signed metres out of the marsh oval (negative inside) */
export function E(x: number, z: number): number {
  const lx = x - ASH_ORIGIN.x;
  const lz = z - ASH_ORIGIN.z;
  return (Math.hypot(lx / RX, lz / RZ) - 1) * Math.min(RX, RZ);
}

/** which water body (if any) covers this world point, for the hot step's wading test */
export function waterAt(x: number, z: number): WaterId | null {
  const lx = x - ASH_ORIGIN.x;
  const lz = z - ASH_ORIGIN.z;
  for (const id of WATER_IDS) {
    const w = WATER[id];
    if (sdRect(lx, lz, w.x0, w.x1, w.z0, w.z1) < 0.3 && !(id === 'pond' && Math.hypot(lx - ISLET.lx, lz - ISLET.lz) < ISLET.r)) return id;
  }
  return null;
}

/** walkable marsh ground (world coords) */
export function H(x: number, z: number): number {
  const lx = x - ASH_ORIGIN.x;
  const lz = z - ASH_ORIGIN.z;
  // low hummocks of moss and peat
  let h = 0.3 * Math.sin(lx * 0.21 + 0.6) * Math.cos(lz * 0.17) + 0.12 * Math.sin(lx * 0.53 + lz * 0.41);
  // channels and pools: soft banks down to a muddy bed
  for (const id of WATER_IDS) {
    const w = WATER[id];
    let d = sdRect(lx, lz, w.x0, w.x1, w.z0, w.z1);
    if (id === 'pond') d = Math.max(d, ISLET.r - Math.hypot(lx - ISLET.lx, lz - ISLET.lz));
    // a low levee of dug peat along every bank, then the slope down to the bed
    h += 0.32 * smoothstep(d, 0.6, 1.2) * (1 - smoothstep(d, 1.6, 3.2));
    h = THREE.MathUtils.lerp(h, BED, 1 - smoothstep(d, -0.9, 0.7));
  }
  // the weir plateau and the Seedwell ledge (after the water cut, so no bank slope eats the wall): sheer peat walls
  const weir = smoothstep(lz, WEIR.z0 - 0.4, WEIR.z0) * (1 - smoothstep(lx, WEIR.xMax - 0.2, WEIR.xMax + 0.3));
  h = THREE.MathUtils.lerp(h, WEIR.top, weir);
  const ledge = -sdRect(lx, lz, LEDGE.x0, LEDGE.x1, LEDGE.z0, LEDGE.z1);
  if (ledge > -0.4) h = THREE.MathUtils.lerp(h, LEDGE.top, smoothstep(ledge, -0.4, 0.15));
  // the oval's rim rises into reed banks and willow scrub
  const e = E(x, z);
  return h + Math.max(0, e + 5) * 1.6;
}
