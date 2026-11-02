/**
 * Where the fox may stand: the bowl, Millbrook, the Hermitage, and the vista gap down to Press Hollow's far lip.
 * Kit's naive wander on 22bfeb4 walked off the world twice — down the hollow's far lip into the vista valley
 * (z −220, y −10.7) and, once that lip was railed, east off the far crag up the open hillside (x 120, y 37): outside
 * the rims the terrain is only a gentle slope. The controller refuses any step out of this mask (lookdevPlay
 * `inWorld`), so no route — scripted, naive or a lost player — can leave the slice. Baked once at 1 m from layout
 * shapes (no rand); the per-step test is one array read.
 */
import { inVista, rimK, VISTA } from './layout';
import { westE } from './millbrookLayout';
import { northE } from './hermitageLayout';
import { EDGE } from './worldEdge';

const B = { minX: -140, minZ: -10, maxX: 90, maxZ: 170, cell: 1 } as const;

/** the shapes, with a little margin so rims and the rail are reached before the stop */
function inside(x: number, z: number): boolean {
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
