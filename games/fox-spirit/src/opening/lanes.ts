/**
 * Lane clearance (KNOWLEDGE: a painted lane is not a walkable lane). Terrain is checked statically by lint:feel
 * (tools/checks/paths-walkable.ts); props are only known once every builder has run, so this checks the built
 * colliders at boot: nothing that blocks may stand on a lane's centre line (Sorrel caught a rock on the Hermitage lane).
 */
import { colliderTop, PLAY, type Collider } from '../lookdevPlay';
import { PATHS } from './layout';

export function laneBlocks(colliders: Collider[], groundH: (x: number, z: number) => number): string[] {
  const out: string[] = [];
  for (const [ax, az, bx, bz] of PATHS) {
    const len = Math.hypot(bx - ax, bz - az);
    for (const c of colliders) {
      if (c.kind === 'box' && c.oneWay) continue;
      for (let s = 0; s <= len; s += 0.2) {
        const x = ax + ((bx - ax) * s) / len;
        const z = az + ((bz - az) * s) / len;
        if (colliderTop(c, x, z) > groundH(x, z) + PLAY.step + 0.15) {
          out.push(`${c.kind} at (${c.x.toFixed(1)}, ${c.z.toFixed(1)}) blocks lane [${ax}, ${az} → ${bx}, ${bz}] at (${x.toFixed(1)}, ${z.toFixed(1)})`);
          break;
        }
      }
    }
  }
  return out;
}
