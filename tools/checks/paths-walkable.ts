/**
 * Every painted lane must be walkable on the base terrain both ways (KNOWLEDGE: a painted lane is not a walkable lane —
 * pathDist flattens the swell, never the rim). Mirrors lookdevPlay moveTo's forward probe: over 0.28 m the ground may
 * rise at most step + 0.15 = 0.37 m. Colliders are not considered (props sit beside lanes, not on them).
 *   npx tsx tools/checks/paths-walkable.ts
 */
import { groundH, PATHS } from '../../games/fox-spirit/src/opening/layout';

const PROBE = 0.28;
const MAX_RISE = 0.22 + 0.15;
const bad: string[] = [];
for (const [ax, az, bx, bz] of PATHS) {
  const len = Math.hypot(bx - ax, bz - az);
  const ux = (bx - ax) / len, uz = (bz - az) / len;
  let worst = 0, at = 0;
  for (let s = 0; s <= len; s += 0.1) {
    const x = ax + ux * s, z = az + uz * s;
    const h = groundH(x, z);
    for (const dir of [1, -1]) {
      const rise = groundH(x + ux * PROBE * dir, z + uz * PROBE * dir) - h;
      if (rise > worst) { worst = rise; at = s; }
    }
  }
  if (worst > MAX_RISE) bad.push(`lane [${ax}, ${az} → ${bx}, ${bz}] rises ${worst.toFixed(2)} m per ${PROBE} m at ${at.toFixed(1)} m (max ${MAX_RISE})`);
}
if (bad.length) {
  console.log(bad.join('\n'));
  process.exit(1);
}
console.log(`paths-walkable: ${PATHS.length} lanes walkable both ways`);
