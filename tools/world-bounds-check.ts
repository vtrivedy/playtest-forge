// Every authored place the fox must reach lies inside the world mask the controller enforces
// (games/fox-spirit/src/opening/worldBounds.ts). Fails when a new region is built without adding its shape.
import assert from 'node:assert/strict';
import { anchors, bakeWorldBounds } from '../games/fox-spirit/src/opening/worldBounds';

const { inWorld } = bakeWorldBounds();
const out = anchors().filter(([, x, z]) => !inWorld(x, z));
assert.equal(out.length, 0, `outside the world mask (add the region to worldBounds.ts inside()):\n${out.map(([n, x, z]) => `  ${n} (${x.toFixed(1)}, ${z.toFixed(1)})`).join('\n')}`);
// and the leaks the naive wander found stay shut
for (const [n, x, z] of [['vista valley', -3, 0], ['past the far lip', 12.6, 23.2], ['east hillside', 47.8, 73], ['far east', 120, 106]] as const)
  assert.ok(!inWorld(x, z), `${n} (${x}, ${z}) is walkable again`);
console.log(`world bounds: ${anchors().length} authored anchors inside, 4 known leaks shut`);
