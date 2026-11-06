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
  /** level 1: the Low Sluice channel spans the marsh, landing ↔ Reed Island, in two reaches split by a sill: the west
   * reach (its north bank a reed thicket) drains at the bank sluice; the east reach only through the sill's culvert */
  channel: { x0: -80, x1: -0.35, z0: -33, z1: -24, full: -0.15, drained: -1.25 },
  channelE: { x0: 0.35, x1: 80, z0: -33, z1: -24, full: -0.15, drained: -1.25 },
  /** level 2: Reed Pond spans the marsh, Reed Island ↔ Mill Shore; only the earned reed mats cross it */
  pond: { x0: -80, x1: 80, z0: -8, z1: 14, full: -0.15, drained: -0.15 },
  /** level 3: the Mill Pool below the weir; its steps only stand clear once it is drained */
  pool: { x0: -15, x1: 15, z0: 20, z1: 33.2, full: -0.15, drained: -1.25 },
} as const;
export type WaterId = keyof typeof WATER;
/** fixed iteration order (module-level: no array literal per call on the hot path) */
export const WATER_IDS: ReadonlyArray<WaterId> = ['channel', 'channelE', 'pond', 'pool'];
/** channel / pond / pool bed height (below a full surface, above a drained one) */
export const BED = -1.0;

/** the Low Sluice's reed dam (on the landing bank, west of the path) and the mill race's dam (on an islet in the pond) */
export const DAM_A = { lx: -11, lz: -35.2, reach: 3.2 };
/** the sill between the reaches and the reed-choked culvert on its west face (reached from the drained west bed) */
export const SILL = { x0: -0.35, x1: 0.35, top: -0.8 };
export const DAM_A2 = { lx: -1.5, lz: -28.5, reach: 3.2 };
/** where the drained channel goes (water runs downhill, DESIGN-sumiro-play.md §3): a gully from behind the sluice
 *  dam falls south-west to the soak in the marsh's low corner; both beds sit below the channel's (BED) */
export const GULLY = { ax: -11, az: -38.4, bx: -21, bz: -47, bed0: -1.3, bed1: -2.0, half: 0.7 };
export const SOAK = { lx: -22.5, lz: -49.2, r: 3.0, bed: -2.3, low: -2.15, high: -1.6 };
/** the decoy (DESIGN-sumiro-play.md §5): a tarn perched on a mound east of the landing, brimming behind its own reed
 *  dam; its runnel falls north INTO the channel. Bursting it shows the rule (water runs downhill) and changes nothing */
export const TARN = { lx: 13, lz: -40.5, r: 2.4, mound: 4.6, top: 1.35, bed: 0.85, full: 1.15, empty: 0.88 };
export const DAM_T = { lx: 13, lz: -36.3, reach: 3.2 };
export const RUNNEL = { ax: 13, az: -37.8, bz: -33.6, bed0: 0.8, bed1: -0.4, half: 0.35 };
/** the west reach's north bank: a reed thicket the fox cannot climb (box), so the way on is east along the bed */
export const THICKET = { x0: -66, x1: 0.7, z0: -23.9, z1: -23.2, top: 2.4 };
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
export const WEIR = { z0: 33.6, top: 4.4, xMax: 13.4 };
export const STEPS: ReadonlyArray<{ lz: number; top: number }> = [-0.4, 0.2, 0.8, 1.4, 2.0, 2.6, 3.2, 3.8, 4.4].map((top, i) => ({ lz: 27.75 + i * 0.68, top }));
export const STEP_HALF = { x: 1.6, z: 0.38 };

/** the Reed Seedwell on its own ledge east of the weir: reached by gliding off the plateau's east lip */
/** the Seedwell ledge stands against the cistern's east wall, higher than the weir and too far to glide to: only the
 * Ferrykeeper's punt, lifted by a flooded cistern, reaches it */
export const LEDGE = { x0: 15.5, x1: 22, z0: 21, z1: 30, top: 4.7 };
export const SEEDWELL = { lx: 19, lz: 25.5 };
/** the Mill Pool is a walled cistern (slate walls W/S/E; the weir is its north side); its south gate shuts in a flood */
export const CISTERN = { wallTop: 4.7, wall: 0.5, gate: { x0: -2.2, x1: 2.2 } };
/** dashing the weir's reed gate floods the cistern to `level` for `hold` s, then it washes out and the gate re-forms */
export const FLOOD = { level: 4.3, rise: 9, hold: 45, fall: 6 };
export const DAM_C = { lx: 5.5, lz: 37.2, reach: 3.2 };
/** the last ferry, moored by the weir's east end; it floats on whatever the cistern holds */
export const PUNT = { lx: 12.75, lz: 31.6, hx: 0.65, hz: 2.0, rise: 0.22 };
/** a slate shelf inside the cistern's east wall at wall height: the risen punt's flank touches it */
export const SHELF = { x0: 13.4, x1: 15, z0: 24, z1: 30.5 };

/** side places off the run line that tell the marsh's story once each (DESIGN-worlds: the flood that took a home) */
export const SECRETS = {
  /** a cottage roof drowned in the channel's west reach, dry only once the sluice runs */
  roof: { lx: -46, lz: -28.5, r: 4.5 },
  /** the Ferrykeeper's mooring post and lantern on the dam islet */
  mooring: { lx: 23.6, lz: 1.0, r: 2.8 },
} as const;

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
  // the sluice gully and the soak it drains into (soft banks: a fox that wanders in walks out)
  {
    const gx = GULLY.bx - GULLY.ax, gz = GULLY.bz - GULLY.az;
    const t = Math.max(0, Math.min(1, ((lx - GULLY.ax) * gx + (lz - GULLY.az) * gz) / (gx * gx + gz * gz)));
    const d = Math.hypot(lx - GULLY.ax - gx * t, lz - GULLY.az - gz * t) - GULLY.half;
    h = THREE.MathUtils.lerp(h, GULLY.bed0 + (GULLY.bed1 - GULLY.bed0) * t, 1 - smoothstep(d, 0, 2.4));
    const ds = Math.hypot(lx - SOAK.lx, lz - SOAK.lz) - SOAK.r;
    h = THREE.MathUtils.lerp(h, SOAK.bed, 1 - smoothstep(ds, 0, 3.6));
  }
  // the tarn's mound, its hollow, and the runnel notched through its north rim down the channel bank
  {
    const dm = Math.hypot(lx - TARN.lx, lz - TARN.lz);
    h = THREE.MathUtils.lerp(h, TARN.top, 1 - smoothstep(dm - TARN.mound, 0, 3));
    h = THREE.MathUtils.lerp(h, TARN.bed, 1 - smoothstep(dm - TARN.r, -0.3, 0.8));
    if (lz > RUNNEL.az - 0.5 && lz < RUNNEL.bz + 0.5) {
      const t = Math.max(0, Math.min(1, (lz - RUNNEL.az) / (RUNNEL.bz - RUNNEL.az)));
      const bed = RUNNEL.bed0 + (RUNNEL.bed1 - RUNNEL.bed0) * t;
      h = Math.min(h, THREE.MathUtils.lerp(h, bed, 1 - smoothstep(Math.abs(lx - RUNNEL.ax) - RUNNEL.half, 0, 1.2)));
    }
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
