/** Headless simulation only: GPU capture checks visuals and real controls separately. */
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWater } from '../games/fox-spirit/src/chem/water';
import { CollisionWorld } from '../games/fox-spirit/src/collision';
const water = createWater(new THREE.Scene(), new CollisionWorld(() => -2));
let t = 0;
function step(seconds: number, supply: number) { for (let i = 0; i < Math.round(seconds * 120); i++) { t += 1 / 120; water.update(1 / 120, t, () => supply); } }
step(0.59, 1);
assert.equal(water.state()[0]!.flowing, false, 'No flow before melt finishes');
step(0.02, 1);
assert.equal(water.state()[0]!.flowing, true, 'Flow after 0.6s melt');
step(0.25, 1);
const first = water.state()[0]!;
assert(Math.abs(first.fronts[0]!.head - 2.13) < 0.15, 'Front travels at 8m/s');
step(1, 1);
assert.equal(water.state()[0]!.arriving, true, 'Front reaches channel end');
step(2.99, 0);
assert.equal(water.state()[0]!.flowing, true, 'Holds three seconds');
step(0.05, 0);
assert.equal(water.state()[0]!.flowing, false, 'Refreeze emits no water');
assert(water.state()[0]!.wetMeters > 0, 'Tail remains after source stops');
step(1.1, 0);
assert.equal(water.state()[0]!.wetMeters, 0, 'Tail runs off channel');
step(1.1, 0);
assert.equal(water.state()[0]!.state, 'cold', 'Refreezes over two seconds');
console.log(JSON.stringify({ verdict: 'PASS', at: t, water: water.state() }, null, 2));

// A drain halfway down the flume must not erase the water already beyond it.
const cut = createWater(new THREE.Scene(), new CollisionWorld(() => -2));
let cutTime = 0;
const flume = cut.waters.find(w => w.spot.id === 'reed-falls')!;
function cutStep(seconds: number, drain = false) {
  for (let i = 0; i < Math.round(seconds * 120); i++) {
    cutTime += 1 / 120;
    cut.update(1 / 120, cutTime, () => 1, drain ? p => p.distanceTo(flume.samples[64]!.p) < 0.2 : undefined);
  }
}
cutStep(5);
assert.equal(flume.arriving, true);
cutStep(0.1, true);
assert.equal(flume.arriving, true, 'Downstream tail survives the drain');
cutStep(2.1, true);
assert.equal(flume.arriving, false, 'Drain tail reaches basin after remaining travel time');
cutStep(2.1);
assert.equal(flume.arriving, true, 'Released drain resumes with a travelling front');
console.log('Shade split/tail/recovery: PASS');
