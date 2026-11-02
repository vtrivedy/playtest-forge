/**
 * Where the fox may stand: the bowl, Millbrook, the Hermitage, and the vista gap down to Press Hollow's far lip.
 * Kit's naive wander on 22bfeb4 walked off the world twice — down the hollow's far lip into the vista valley
 * (z −220, y −10.7) and, once that lip was railed, east off the far crag up the open hillside (x 120, y 37): outside
 * the rims the terrain is only a gentle slope. The controller refuses any step out of this mask (lookdevPlay
 * `inWorld`), so no route — scripted, naive or a lost player — can leave the slice. Baked once at 1 m from layout
 * shapes (no rand); the per-step test is one array read.
 */
import { CANOPY, FINALE, HEARTH_A, inVista, KEEPING, LEAF_PILES, PAGE, POP_UP_RUIN, rimK, SHELF, SOUTH_LANE, SPAWN, VISTA, WELL, ALL_PATHS } from './layout';
import { MILLBROOK, westE } from './millbrookLayout';
import { ashwaterE, pressE, WORLD_SPLIT, WORLDS } from './worlds';
import { HERMITAGE, northE } from './hermitageLayout';

/** the rail on Press Hollow's far lip (worldEdge.ts): metres along the fall line past the crag, half-width across */
export const EDGE = { a: FINALE.hollow.lip + 1.5, half: 34, step: 2.6, height: 1.0, reach: 4 } as const;

const B = { minX: -780, minZ: -10, maxX: 780, maxZ: 170, cell: 1 } as const;

/** the shapes, with a little margin so rims and the rail are reached before the stop */
function inside(x: number, z: number): boolean {
  if (x > WORLD_SPLIT) return ashwaterE(x, z) < 1;
  if (x < -WORLD_SPLIT) return pressE(x, z) < 1;
  if (rimK(x, z) < 1.2) return true;
  if (westE(x, z) < 2.5 || northE(x, z) < 2.5) return true;
  const a = (x - VISTA.x) * VISTA.dx + (z - VISTA.z) * VISTA.dz;
  return inVista(x, z, 1.5) && a < EDGE.a + 0.6;
}

export function bakeWorldBounds(): { inWorld: (x: number, z: number) => boolean; cells: number; inside: number } {
  const w = Math.ceil((B.maxX - B.minX) / B.cell);
  const h = Math.ceil((B.maxZ - B.minZ) / B.cell);
  const mask = new Uint8Array(w * h);
  let n = 0;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const v = inside(B.minX + (i + 0.5) * B.cell, B.minZ + (j + 0.5) * B.cell) ? 1 : 0;
      mask[j * w + i] = v;
      n += v;
    }
  return {
    cells: w * h,
    inside: n,
    inWorld(x: number, z: number): boolean {
      const i = Math.floor((x - B.minX) / B.cell);
      const j = Math.floor((z - B.minZ) / B.cell);
      return i >= 0 && j >= 0 && i < w && j < h && mask[j * w + i] === 1;
    },
  };
}

/**
 * Every authored place the fox must be able to stand. A new region whose shape isn't added to `inside()` fails
 * here (tools/world-bounds-check.ts in lint:feel), instead of silently becoming an invisible wall.
 */
export function anchors(): Array<[string, number, number]> {
  const out: Array<[string, number, number]> = [
    ['spawn', SPAWN.x, SPAWN.z], ['well', WELL.x, WELL.z], ['hearth', HEARTH_A.x + 1.4, HEARTH_A.z], ['shelf', SHELF.x, SHELF.z],
    ['keeping hinge', KEEPING.hinge.x, KEEPING.hinge.z], ['keeping crag', KEEPING.crag.x, KEEPING.crag.z],
    ['press', FINALE.press.x, FINALE.press.z], ['cradle', FINALE.cradle.x, FINALE.cradle.z], ['stool', FINALE.stool.x, FINALE.stool.z],
    ['ruin entry', POP_UP_RUIN.entry.x, POP_UP_RUIN.entry.z],
    ['mill', MILLBROOK.mill.x, MILLBROOK.mill.z], ['lookout', MILLBROOK.lookout.x, MILLBROOK.lookout.z], ['weir', MILLBROOK.weir.x, MILLBROOK.weir.z],
    ['hermitage desk', HERMITAGE.desk.x, HERMITAGE.desk.z], ['hermitage house', HERMITAGE.house.x, HERMITAGE.house.z],
  ];
  CANOPY.forEach((c, i) => out.push([`canopy ${i}`, c.x, c.z]));
  LEAF_PILES.forEach((p, i) => out.push([`leaf pile ${i}`, p.x, p.z]));
  SOUTH_LANE.forEach(([x, z], i) => out.push([`south lane ${i}`, x, z]));
  PAGE.stages.forEach((st, i) => st.forEach(([x, , z], j) => out.push([`page ${i}.${j}`, x, z])));
  for (const w of Object.values(WORLDS)) out.push([`${w.id} spawn`, w.spawn.x, w.spawn.z], [`${w.id} origin`, w.origin.x, w.origin.z]);
  ALL_PATHS.forEach(([ax, az, bx, bz], i) => out.push([`lane ${i} a`, ax, az], [`lane ${i} b`, bx, bz]));
  return out;
}
