/** Headless simulation only: GPU capture checks visuals and real controls separately. */
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWater } from '../games/fox-spirit/src/chem/water';
import { CollisionWorld } from '../games/fox-spirit/src/collision';
// Simulation checks do not load or judge the world's image assets.
THREE.TextureLoader.prototype.load = function () { return new THREE.Texture(); };
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

// A restored Reed basin must never colour the distant kiln or maple.
const { ColorField } = await import('../src/render/colorField');
const field = new ColorField(); field.fox.set(0, 1000, 0);
field.restore(new THREE.Vector3(95, 2, 10), 35, 0.2); field.update(0.3);
assert.equal(field.sample(new THREE.Vector3(95, 2, 10)), 1);
assert.equal(field.sample(new THREE.Vector3(-112, 20, -24)), 0);
assert.equal(field.sample(new THREE.Vector3(-10, 17.5, -36)), 0);
console.log('Restored-region locality: PASS');

const { createInlets } = await import('../games/fox-spirit/src/chem/inlet');
function reedTrial(supplySeconds: number) {
  const scene = new THREE.Scene(), w = createWater(scene, new CollisionWorld(() => -2));
  const inlet = createInlets(scene, [{ seedwell: 1, source: 'reed-falls', pos: new THREE.Vector3(95, 2.3, 10), sealAt: new THREE.Vector3(), pillar: new THREE.Vector3(), latchTime: 7 }], new THREE.MeshStandardMaterial());
  let latchAt: number | null = null;
  for (let i = 0; i < 16 * 120; i++) {
    const time = i / 120;
    w.update(1 / 120, time, () => time < supplySeconds ? 1 : 0);
    if (inlet.update(1 / 120, () => w.arriving('reed-falls')).length && latchAt === null) latchAt = time;
  }
  return latchAt;
}
assert.equal(reedTrial(2.5), null, 'Brief pass through falls is a near miss, never a latch');
const dashLatch = reedTrial(6);
assert(dashLatch !== null && dashLatch > 11.4 && dashLatch < 11.8, 'Six-second stroke feeds a seven-second seal after 4s travel');
console.log('Reed near-miss and dash-duration latch: PASS', dashLatch);
