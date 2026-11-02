import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCameraEnvelope } from '../games/fox-spirit/src/cameraEnvelope.hot';

// The desired lens is free below a ledge, but its straight release segment
// intersects that ledge. Both the free and obstructed exits must remain gradual.
for (const dt of [1 / 30, 1 / 60, 1 / 120]) for (const ledge of [false, true]) {
  const previous = new THREE.Vector3(0, 3, 3);
  const lens = new THREE.Vector3(0, 1, 3);
  const focus = new THREE.Vector3(0, .6, 0);
  const blocked = (x: number, y: number, z: number, r: number) => ledge
    && x + r > -.5 && x - r < .5 && z + r > 2.5 && z - r < 3.5
    && y + r > 1.5 && y - r < 2.6;
  const update = createCameraEnvelope({
    params: { minDistance: 1.5, distance: 2.45, clearance: .2, sideBias: 0 },
    previousLens: previous, surfaceAt: () => 0, lensBlocked: blocked,
    yaw: () => 0, sightFraction: () => 1,
  });
  update(focus, lens, dt, false);
  assert.ok(lens.distanceTo(previous) <= (ledge ? 16 : 12) * dt + 1e-5, `release snapped (ledge=${ledge})`);
  assert.ok(!blocked(lens.x, lens.y, lens.z, .2), 'release entered ledge');
  for (let i=1; i<=12; i++) {
    const p = previous.clone().lerp(lens, i / 12);
    assert.ok(!blocked(p.x, p.y, p.z, .2), 'release segment crossed ledge');
  }
  assert.ok(lens.y >= .16 && Math.hypot(lens.x, lens.z) >= 1.5, 'release lost floor/body room');
}
console.log('camera envelope: free release and obstructed release remain gradual');
