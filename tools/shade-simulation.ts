/** CPU encounter integration check. Loads the real CC0 GLB; never starts a browser or renderer. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createShades } from '../games/fox-spirit/src/encounters/shades';

const originalFetch = globalThis.fetch;
THREE.DefaultLoadingManager.setURLModifier(url => url.startsWith('/assets/') ? `http://shade.test${url}` : url);
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith('http://shade.test/assets/')) return new Response(await readFile(new URL(url).pathname.slice(1))); 
  return originalFetch(input, init);
};
Object.defineProperty(globalThis, 'ProgressEvent', { value: class extends Event {
  constructor(type: string, options: object) { super(type); Object.assign(this, options); }
} });

try {
  const scene = new THREE.Scene();
  const sys = await createShades(scene, [{ id: 'test', patrol: [[0,0,0],[4,0,0],[4,0,4],[0,0,4]] }], () => 0);
  let t = 0;
  const step = (seconds: number, fox: THREE.Vector3, dash = false) => {
    const events = [];
    for (let k = 0; k < Math.round(seconds * 60); k++) { t += 1/60; events.push(...sys.update(1/60, t, fox, dash)); }
    return events;
  };
  const state = () => sys.state()[0]!;
  step(3, new THREE.Vector3(30,0,30));
  assert.equal(state().mode, 'patrol');
  const patrolPos = new THREE.Vector3().fromArray(state().pos);
  const near = patrolPos.clone().add(new THREE.Vector3(2.8,0,0));
  step(1.5, near);
  assert.equal(state().mode, 'chase');
  step(1/60, new THREE.Vector3(30,0,30));
  assert.equal(state().mode, 'return');
  step(8, new THREE.Vector3(30,0,30));
  assert.equal(state().mode, 'patrol', 'must reach fixed return target');
  sys.resetSweep();
  const target = new THREE.Vector3().fromArray(state().pos);
  assert.equal(sys.drains(target), true);
  const events = step(1/60, target, true);
  assert.equal(events.filter(e => e.type === 'freed').length, 1);
  assert.equal(sys.drains(target), false);
  assert.equal(state().mode, 'released');
  step(1.5, new THREE.Vector3(30,0,30));
  assert.equal(state().presence, 0);
  assert.equal(state().smokeParticles, 144, 'motes outlive body');
  step(10, new THREE.Vector3(30,0,30));
  assert.equal(state().smokeParticles, 0);
  assert.equal(state().leaves, 0);
  console.log(JSON.stringify({ result: 'PASS', checks: ['real GLB load', 'patrol', 'delayed chase', 'return completes', 'dash frees once', 'drain ends', 'motes outlive body', 'one-shots end'], final: state() }, null, 2));
} finally { globalThis.fetch = originalFetch; THREE.DefaultLoadingManager.setURLModifier(url => url); }
