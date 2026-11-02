/** Same pickup/dash sequence must fail before learning and retain warmth after learning. */
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCarry } from '../games/fox-spirit/src/opening/carry';
Object.defineProperty(globalThis, 'location', { configurable: true, value: { search: '' } });
function fixture(canDashCarry?: () => boolean) {
  const fox = new THREE.Group();
  const head = new THREE.Group(); head.name = 'head'; head.position.y = .4; fox.add(head);
  const coal = createCarry({ scene: new THREE.Scene(), fox, source: new THREE.Vector3(), surfaceAt: () => 0, teach: { offer() {} }, canDashCarry });
  assert.equal(coal.interact(), true, 'same pickup action succeeds');
  assert.equal(coal.state().carried, true);
  return { fox, coal };
}
const locked = fixture();
locked.coal.beforeDash(new THREE.Vector3(2, 0, 3));
assert.equal(locked.coal.state().carried, false);
assert.equal(locked.coal.state().dashDrops, 1);
assert.deepEqual(locked.coal.state().position, [2, 0, 3], 'locked dash drops at last safe ground');
let learned = false;
const dynamic = fixture(() => learned);
dynamic.coal.beforeDash(new THREE.Vector3());
assert.equal(dynamic.coal.state().carried, false, 'unearned predicate does not retain');
assert.equal(dynamic.coal.interact(), true);
learned = true;
dynamic.coal.beforeDash(new THREE.Vector3());
dynamic.fox.position.set(5, 0, 0);
dynamic.coal.update(1 / 60, 1, { grounded: true, dashing: true });
assert.equal(dynamic.coal.state().carried, true);
assert.equal(dynamic.coal.state().carriedDashes, 1);
assert.equal(dynamic.coal.state().dashDrops, 1, 'learned dash introduces no additional drop');
assert.ok(dynamic.coal.state().position[0]! > 5, 'ember follows animated mouth through movement');
assert.equal(dynamic.coal.interact(), false, 'placement remains blocked during dash');
dynamic.coal.update(1 / 60, 2, { grounded: true, dashing: false });
assert.equal(dynamic.coal.interact(), true, 'setting warmth down still works after dash');
assert.equal(dynamic.coal.state().carried, false);
assert.deepEqual(dynamic.coal.state().position, [5, 0, 0]);
console.log('PASS Hearthbound: locked dash drops at safe ground; earned dash retains animated warmth; placement unchanged');
