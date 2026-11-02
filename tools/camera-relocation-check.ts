import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFollowCamera, type CameraFrame } from '../games/fox-spirit/src/camera';

// A world-space cinematic must not keep the lens at the old island after teleport.
for (const kind of ['path', 'shot'] as const) {
  const cam = createFollowCamera({ surfaceAt: () => 0 });
  const frame: CameraFrame = { target: new THREE.Vector3(), vel: new THREE.Vector3(), facing: 0, grounded: true, gliding: false, dashing: false, airTime: 0, landing: null };
  cam.update(1 / 60, frame);
  if (kind === 'path') cam.playPath({ keys: [
    { t: 0, pos: new THREE.Vector3(0, 3, 5), look: new THREE.Vector3() },
    { t: 8, pos: new THREE.Vector3(1, 3, 5), look: new THREE.Vector3() },
  ], lockS: 8 });
  else cam.playShot({ subjects: [new THREE.Vector3(), new THREE.Vector3(2, 0, 0)], holdS: 8 });
  for (let i = 0; i < 60; i++) cam.update(1 / 60, frame);
  frame.target.set(700, 0, 34);
  cam.cancelShots();
  cam.snapBehind(0);
  for (let i = 0; i < 180; i++) {
    cam.update(1 / 60, frame);
    assert.ok(cam.camera.position.distanceTo(frame.target) < 12, `${kind} kept the lens at the old island`);
  }
  assert.equal(cam.pathState(), null);
}
console.log('PASS camera hard relocation: active path and reactive shot discarded; destination stays framed');
