/** CPU-only camera math checks. No browser, canvas, WebGL or render. */
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFollowCamera } from '../../games/fox-spirit/src/camera';
import type { CameraFrame } from '../../games/fox-spirit/src/camera';

const frame = (): CameraFrame => ({
  target: new THREE.Vector3(), vel: new THREE.Vector3(), grounded: true,
  gliding: false, dashing: false, airTime: 0, landing: null,
});
const tick = (cam: ReturnType<typeof createFollowCamera>, f: CameraFrame, count = 120, hz = 60) => {
  for (let i = 0; i < count; i++) cam.update(1 / hz, f);
};
const world = new THREE.Group();
const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 0.3), new THREE.MeshStandardMaterial());
post.name = 'decorative-post';
post.position.set(Math.sin(0.34) * 2.1, 1.2, Math.cos(0.34) * 2.1);
world.add(post);
const cam = createFollowCamera({ scenery: world });
cam.resize(1920, 1080);
const f = frame();
tick(cam, f);
const contracted = cam.camera.position.distanceTo(f.target);
assert(contracted < 2, `Decorative post should shorten the boom: ${contracted}`);
assert(cam.debug.internals().includes('decorative-post'));
assert(Math.abs(cam.debug.fox[1]) < 0.8, 'Compressed boom must keep the fox in frame');
post.visible = false;
const beforeRelease = cam.camera.position.clone();
cam.update(1 / 60, f);
assert(cam.camera.position.distanceTo(beforeRelease) < 0.18, 'Obstacle release must not pop');
tick(cam, f, 180);
assert(cam.camera.position.distanceTo(f.target) > 3.8, 'Clear space should restore the boom');

const jump = createFollowCamera();
jump.resize(1920, 1080);
const j = frame();
tick(jump, j);
let maxNdc = 0;
for (let i = 0; i < 100; i++) {
  const t = i / 60;
  j.target.y = Math.max(0, 8 * t - 6 * t * t);
  j.vel.y = 8 - 12 * t;
  j.grounded = j.target.y === 0;
  j.airTime = t;
  j.landing = new THREE.Vector3(0, 0, -2);
  jump.update(1 / 60, j);
  maxNdc = Math.max(maxNdc, Math.abs(jump.debug.fox[1]));
}
assert(maxNdc < 0.8, `Jump framing should remain inside safe frame: ${maxNdc}`);

// A steady diagonal must not cause camera-relative steering to spiral.
const diagonal = createFollowCamera();
const d = frame();
const initialYaw = diagonal.getYaw();
for (let i = 0; i < 300; i++) {
  const yaw = diagonal.getYaw();
  d.vel.set(Math.sin(yaw + Math.PI - Math.PI / 4) * 7, 0, Math.cos(yaw + Math.PI - Math.PI / 4) * 7);
  d.target.addScaledVector(d.vel, 1 / 60);
  diagonal.update(1 / 60, d);
}
assert(Math.abs(diagonal.getYaw() - initialYaw) < 0.01, 'Diagonal steering must stay stable');

// Existing foliage fade owns leaf/reed cards: they must not pump the solid boom.
const foliageWorld = new THREE.Group();
const foliage = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 0.1), new THREE.MeshStandardMaterial({ name: 'rv-reed', side: THREE.DoubleSide }));
foliage.position.set(0.4, 1, 2);
foliageWorld.add(foliage);
const leaves = createFollowCamera({ scenery: foliageWorld });
tick(leaves, frame());
assert(leaves.camera.position.length() > 3.8, 'Reeds should use existing fade instead of collision');

// Hidden scene subtrees must not block the camera even when a child is visible.
const hiddenWorld = new THREE.Group();
const hidden = new THREE.Group();
hidden.visible = false;
const hiddenPost = post.clone();
hiddenPost.visible = true;
hidden.add(hiddenPost);
hiddenWorld.add(hidden);
const hiddenCam = createFollowCamera({ scenery: hiddenWorld });
tick(hiddenCam, frame());
assert(hiddenCam.camera.position.length() > 3.8, 'Hidden parent must suppress child collision');

// Same stationary convergence at common frame rates.
const poses = [30, 60, 120].map(hz => {
  const c = createFollowCamera();
  const f = frame();
  c.update(1 / hz, f);
  f.target.set(2, 1, -3);
  tick(c, f, hz * 3, hz);
  return c.camera.position;
});
assert(poses[0]!.distanceTo(poses[2]!) < 0.02);
console.log(JSON.stringify({ passed: true, contractedDistance: contracted, maxJumpNdc: maxNdc, frameRateDelta: poses[0]!.distanceTo(poses[2]!) }));
