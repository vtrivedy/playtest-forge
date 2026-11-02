/**
 * The Scribe's Press (DESIGN-worlds.md, tla/Press.tla): world III, winter ink at x = −700. Pure layout data. Local
 * coordinates (lx, lz) = (x + 700, z − 85); the run goes north (spawn, lz 38) → south (the Wellspring Press, lz −26):
 *   White Margin  [ink ridge, sealed gate]  → Archive floor → [shelf face, membrane draft] → Archive shelf
 *   → [iced membrane: warm it, then break it] → Wellspring ledge (the Press, the Maple Seedwell's light)
 * Heights are absolute (the plateau's ground is pressH ≈ 0.5 ± 1.1); every top is set from the ground it stands on.
 */
import { pressE, pressH } from './worlds';

export const PRESS_ORIGIN = { x: -700, z: 85 } as const;
export const press = (lx: number, lz: number) => ({ x: PRESS_ORIGIN.x + lx, z: PRESS_ORIGIN.z + lz });

/** highest ground under a local rectangle inside the island (sampled 1 m; the rim beyond it rises steeply and is
 *  walled off by the world mask): a slab set on it never floats over the floor or sinks into it */
function groundTop(x0: number, x1: number, z0: number, z1: number): number {
  let top = -Infinity;
  for (let lx = x0; lx <= x1; lx += 1) for (let lz = z0; lz <= z1; lz += 1) {
    const x = PRESS_ORIGIN.x + lx;
    const z = PRESS_ORIGIN.z + lz;
    if (pressE(x, z) < -1) top = Math.max(top, pressH(x, z));
  }
  return top;
}

/** level 1 (teach): an ink ridge across the island; its one gate is sealed with frozen ink */
export const RIDGE = { lz: 16, half: 0.9, xMax: 60, gate: 1.5, rise: 3.6 };
export const RIDGE_BASE = groundTop(-RIDGE.xMax, RIDGE.xMax, RIDGE.lz - 1, RIDGE.lz + 1);
/**
 * braziers: warmth to carry. Each world half has one lit brazier too far from its frozen gate to reach before the
 * warmth fades, and a cold one between that carried warmth lights (relay): the puzzle is to see the chain.
 * (tla/Press.tla abstracts the chain to "warmth reachable on this side"; lit braziers never go out.)
 */
export const BRAZIERS: ReadonlyArray<{ lx: number; lz: number; lit: boolean; shelf: boolean }> = [
  { lx: -22, lz: 28, lit: true, shelf: false },
  { lx: -6, lz: 30, lit: false, shelf: false },
  { lx: 30, lz: -10, lit: true, shelf: true },
  { lx: 16, lz: -24, lit: false, shelf: true },
];
export const BRAZIER_REACH = 2.0;
/** seconds of carried warmth (≈ 19 m at a run): one relay leg (≤ 16 m), never lit brazier → gate (≥ 21 m), and
 *  the relays stand off the straight line, so the chain has to be seen, not walked into */
export const WARM_S = 6;

/** level 2 (develop): the Archive shelf spans the island; a frozen membrane at its foot breaks into a glide draft */
export const SHELF = { z0: -30, z1: -6, xMax: 60, rise: 4.4 };
export const SHELF_TOP = groundTop(-SHELF.xMax, SHELF.xMax, SHELF.z0, SHELF.z1) + SHELF.rise;
export const MEMBRANE_A = { lx: 0, lz: -3.6, r: 1.25 };

/** level 3 (combine): the Wellspring ledge on the shelf; its membrane is iced over until warmth melts it */
export const LEDGE = { x0: -7, x1: 7, z0: -30, z1: -21, rise: 4.6 };
export const LEDGE_TOP = SHELF_TOP + LEDGE.rise;
export const MEMBRANE_B = { lx: 0, lz: -18.6, r: 1.25 };
/** the Press itself, on the ledge */
export const THE_PRESS = { lx: 0, lz: -26 };

/** a draft: the column the cracked membrane breathes (same shape the hearth updrafts use) */
export const DRAFT = { radius: 2.0, height: 7.5 };
/** an air-dash counts over a membrane within this horizontal reach, from at most this far above it */
export const BREAK = { reach: 1.9, above: 3.2 };
