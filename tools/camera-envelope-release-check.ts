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

// Keeping: the old lens is behind a narrow trunk. All goal-centred rays
// initially hit it, despite both endpoints being clear. The fox has moved on.
// A safety-only solver can hold this pose forever; require eventual reacquisition.
for (const dt of [1 / 30, 1 / 60, 1 / 120]) {
  const previous = new THREE.Vector3(30.635, 13.087, 82.448);
  const desired = new THREE.Vector3(29.853, 10.807, 77.748);
  const focus = new THREE.Vector3(29.389, 9.787, 75.266);
  const lens = desired.clone();
  const blocked = (x: number, _y: number, z: number, r: number) => Math.hypot(x - 30.2, z - 81.6) < .55 + r;
  const update = createCameraEnvelope({
    params: { minDistance: 1.5, distance: 2.45, clearance: .35, sideBias: .35 },
    previousLens: previous, surfaceAt: () => 0, lensBlocked: blocked,
    yaw: () => 0, sightFraction: () => 1,
  });
  for (let t = 0; t < 4; t += dt) {
    lens.copy(desired);
    update(focus, lens, dt, false);
    assert.ok(lens.distanceTo(previous) <= 16 * dt + 1e-5, 'trunk escape snapped');
    for (let i = 0; i <= 12; i++) {
      const p = previous.clone().lerp(lens, i / 12);
      assert.ok(!blocked(p.x, p.y, p.z, .2), 'trunk escape crossed solid geometry');
    }
    previous.copy(lens);
  }
  assert.ok(lens.distanceTo(desired) < .1, `camera remained parked behind trunk at ${1 / dt}Hz`);
}
console.log('camera envelope: trunk detour reacquires follow pose at 30/60/120Hz');
