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
  pool: { x0: -15, x1: 15, z0: 20, z1: 34, full: -0.15, drained: -1.25 },
} as const;
export type WaterId = keyof typeof WATER;
/** fixed iteration order (module-level: no array literal per call on the hot path) */
export const WATER_IDS: ReadonlyArray<WaterId> = ['channel', 'pond', 'pool'];
/** channel / pond / pool bed height (below a full surface, above a drained one) */
export const BED = -1.0;

/** the Low Sluice's reed dam (on the landing bank, west of the path) and the mill race's dam (on an islet in the pond) */
export const DAM_A = { lx: -11, lz: -35.2, reach: 2.4 };
export const ISLET = { lx: 24, lz: 3.4, r: 2.6 };
export const DAM_B = { lx: 24, lz: 3.4, reach: 2.6 };

/** reed mats over Reed Pond (the main crossing) and the branch out to the dam islet: [lx, lz] centres, 1.8 m square */
export const MATS: ReadonlyArray<readonly [number, number]> = [
  // ~4.6 m apart centre to centre: a jump held into a glide carries one gap (~2.8 m edge to edge)
  [-1.2, -5.6], [1.2, -1.6], [-1.2, 2.4], [1.2, 6.6], [-1.0, 10.9],
  // the branch east from the third mat out to the dam islet
  [3.4, 2.8], [8.0, 3.2], [12.6, 3.4], [17.2, 3.3],
];
export const MAT_HALF = 0.9;
/** mats float this far above the pond surface */
export const MAT_RISE = 0.14;

/** the weir plateau north of the Mill Pool, and the steps that climb out of the drained pool onto it */
export const WEIR = { z0: 34, top: 3.6, xMax: 18 };
export const STEPS: ReadonlyArray<{ lz: number; top: number }> = [-0.4, 0.2, 0.8, 1.4, 2.0, 2.6, 3.2].map((top, i) => ({ lz: 28.3 + i * 0.86, top }));
export const STEP_HALF = { x: 1.6, z: 0.45 };

/** the Reed Seedwell on its own ledge east of the weir: reached by gliding off the plateau's east lip */
export const LEDGE = { x0: 23, x1: 31, z0: 36, z1: 46, top: 2.6 };
export const SEEDWELL = { lx: 27.5, lz: 41 };

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
    if (sdRect(lx, lz, w.x0, w.x1, w.z0, w.z1) < -0.35 && !(id === 'pond' && Math.hypot(lx - ISLET.lx, lz - ISLET.lz) < ISLET.r)) return id;
  }
  return null;
}

/** walkable marsh ground (world coords) */
export function H(x: number, z: number): number {
  const lx = x - ASH_ORIGIN.x;
  const lz = z - ASH_ORIGIN.z;
  // low hummocks of moss and peat
  let h = 0.22 * Math.sin(lx * 0.21 + 0.6) * Math.cos(lz * 0.17) + 0.12 * Math.sin(lx * 0.53 + lz * 0.41);
  // the weir plateau and the Seedwell ledge: sheer peat walls the fox cannot step up
  const weir = smoothstep(lz, WEIR.z0 - 0.15, WEIR.z0 + 0.35) * smoothstep(WEIR.xMax + 0.3, WEIR.xMax - 0.2, lx);
  h = THREE.MathUtils.lerp(h, WEIR.top, weir);
  const ledge = -sdRect(lx, lz, LEDGE.x0, LEDGE.x1, LEDGE.z0, LEDGE.z1);
  if (ledge > -0.4) h = THREE.MathUtils.lerp(h, LEDGE.top, smoothstep(ledge, -0.4, 0.15));
  // channels and pools: soft banks down to a muddy bed
  for (const id of WATER_IDS) {
    const w = WATER[id];
    let d = sdRect(lx, lz, w.x0, w.x1, w.z0, w.z1);
    if (id === 'pond') d = Math.max(d, ISLET.r - Math.hypot(lx - ISLET.lx, lz - ISLET.lz));
    h = THREE.MathUtils.lerp(h, BED, smoothstep(d, 0.7, -0.9));
  }
  // the oval's rim rises into reed banks and willow scrub
  const e = E(x, z);
  return h + Math.max(0, e + 5) * 1.6;
}
