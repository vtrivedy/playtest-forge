/**
 * The Scribe's Press (DESIGN-worlds.md, tla/Press.tla): world III, winter ink at x = −700. Pure layout data. Local
 * coordinates (lx, lz) = (x + 700, z − 85); the run goes north (spawn, lz 38) → south (the Wellspring Press, lz −26):
 *   White Margin  [ink ridge, sealed gate]  → Archive floor → [shelf face, membrane draft] → Archive shelf
 *   → [iced membrane: warm it, break it, ride its short draft WITH warmth onto the pillar: the high brazier lights,
 *      the seam thaws and the pressed stair unpresses] → Wellspring ledge (the Press, the Maple Seedwell's light)
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
export const BRAZIERS: ReadonlyArray<{ lx: number; lz: number; lit: boolean; shelf: boolean; high?: boolean }> = [
  { lx: -22, lz: 28, lit: true, shelf: false },
  { lx: -6, lz: 30, lit: false, shelf: false },
  { lx: 30, lz: -10, lit: true, shelf: true },
  // the shelf's relay: off the straight line from the lit one to the near brazier (≥ 23 m apart)
  { lx: 14, lz: -21, lit: false, shelf: true },
  // the near brazier, a few steps from the iced membrane: warmth from here rides the draft
  { lx: 7, lz: -10.5, lit: false, shelf: true },
  // on the pillar's far (ledge-side) corner: only warmth carried up the draft reaches it; lit, it thaws the seam. Off
  // centre so a fox landing from the draft stands in front of it, not inside the bowl (the lens stays on the fox)
  { lx: 4.55, lz: -17.55, lit: false, shelf: true, high: true },
];
/** index of the pillar's brazier in BRAZIERS */
export const HIGH_BRAZIER = 5;
export const BRAZIER_REACH = 2.0;
/** seconds of carried warmth (≈ 19 m at a run): one relay leg (≤ 16 m), never lit brazier → gate (≥ 21 m), and
 *  the relays stand off the straight line, so the chain has to be seen, not walked into */
export const WARM_S = 6;

/** level 2 (develop): the Archive shelf spans the island; a frozen membrane at its foot breaks into a glide draft */
export const SHELF = { z0: -30, z1: -6, xMax: 60, rise: 4.4 };
export const SHELF_TOP = groundTop(-SHELF.xMax, SHELF.xMax, SHELF.z0, SHELF.z1) + SHELF.rise;
export const MEMBRANE_A = { lx: 0, lz: -3.6, r: 1.25 };
/** the Folded Archive's second membrane hangs across an alcove cut into the shelf's face (DESIGN-sumiro-play.md §2):
 *  its sill is above any jump from the floor, and the floor membrane's draft crests just above the sill — so the only
 *  way through is an Inkstep in the air ("in the air, the Ink Step carries you on"). Behind it a chimney breathes. */
export const ALCOVE = { x0: -1.3, x1: 1.3, z0: -8.6, sillBelowTop: 2.2 };
export const SILL_TOP = SHELF_TOP - ALCOVE.sillBelowTop;
/** the face membrane: a vertical sheet of frozen ink across the alcove's mouth (a wall until it tears) */
export const MEMBRANE_C = { lx: 0, lz: SHELF.z1, half: 0.2 };
/** the chimney draft inside the alcove: crests over the shelf top */
export const CHIMNEY = { lx: 0, lz: -7.3, height: ALCOVE.sillBelowTop + 1.3 };

/** level 3 (combine): the Wellspring ledge on the shelf; its membrane is iced over until warmth melts it */
export const LEDGE = { x0: -7, x1: 7, z0: -30, z1: -21, rise: 4.6 };
export const LEDGE_TOP = SHELF_TOP + LEDGE.rise;
export const MEMBRANE_B = { lx: 4, lz: -13.2, r: 1.25 };
/** the pillar of pressed pages beside the iced membrane: its top is above any jump, below the short draft's crest */
export const PILLAR = { lx: 4, lz: -17, half: 1.2, rise: 3.0 };
export const PILLAR_TOP = SHELF_TOP + PILLAR.rise;
/** the Unpressed Stair: page stacks pressed flat under ink, north of the ledge's west half; once the seam thaws they
 *  stand from the foot (north) up to the ledge (south), each `LEDGE.rise / STAIR.n` above the last (≤ 0.6: a jump) */
export const STAIR = { x0: -6.2, x1: -2.8, zFoot: -11.2, depth: 1.225, n: 8, pressed: 0.14 };
export const stairStep = (i: number) => ({ z0: STAIR.zFoot - (i + 1) * STAIR.depth, z1: STAIR.zFoot - i * STAIR.depth, top: SHELF_TOP + ((i + 1) * LEDGE.rise) / STAIR.n });
/** the ink seam from the pillar's foot to the stair's first stack (local polyline) */
export const SEAM: ReadonlyArray<readonly [number, number]> = [[PILLAR.lx - PILLAR.half, PILLAR.lz + 0.6], [-1.2, -15.5], [-1.2, -11.8], [STAIR.x1, -11.8]];
/** seconds for the heat to run the seam, then each stack's stagger and rise */
export const SEAM_S = 2.2;
export const STACK = { stagger: 0.32, rise: 0.9 };
/** the Press itself, on the ledge */
export const THE_PRESS = { lx: 0, lz: -26 };

/** a draft: the column the cracked membrane breathes (same shape the hearth updrafts use) */
export const DRAFT = { radius: 2.0, height: 7.5 };
/** the iced membrane breathes a short draft: high enough for the pillar, too low to glide onto the ledge */
export const DRAFT_B_HEIGHT = 3.9;
/** an air-dash counts over a membrane within this horizontal reach, from at most this far above it */
export const BREAK = { reach: 1.9, above: 3.2 };
