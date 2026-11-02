// Controller-permitted footprint, not collision-free reachable area or authored session duration.
// npx tsx tools/world-area-audit.ts > /captures/.../world-area.json
import { execFileSync } from 'node:child_process';
import { bakeWorldBounds } from '../games/fox-spirit/src/opening/worldBounds';
import { worldAt } from '../games/fox-spirit/src/opening/worlds';
const bounds = bakeWorldBounds();
const stats = Object.fromEntries(['russetvale', 'ashwater', 'press'].map((id) => [id, {
  permittedAreaM2: 0, minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity,
}]));
// Full bounds of the baked movement mask; sample the same cell centres as bakeWorldBounds.
for (let z = -10; z < 170; z++) for (let x = -780; x < 780; x++) {
  if (!bounds.inWorld(x + .5, z + .5)) continue;
  const s = stats[worldAt(x + .5)];
  s.permittedAreaM2++;
  s.minX = Math.min(s.minX, x); s.maxX = Math.max(s.maxX, x + 1);
  s.minZ = Math.min(s.minZ, z); s.maxZ = Math.max(s.maxZ, z + 1);
}
console.log(JSON.stringify({
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  method: 'One metre cell centres from controller movement mask. Includes water, colliders and potentially disconnected cells; not reachable-area proof.',
  worlds: stats,
}, null, 2));
