/** CPU-only camera math checks. No browser, canvas, WebGL or render. */
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Bucket, hearthBrazier } from '../../games/fox-spirit/src/russetKit';
import { createOcclusionFader } from '../../games/fox-spirit/src/occlusion';
import { createFollowCamera } from '../../games/fox-spirit/src/camera';
import type { CameraFrame } from '../../games/fox-spirit/src/camera';

const frame = (): CameraFrame => ({
  target: new THREE.Vector3(), vel: new THREE.Vector3(), grounded: true,
  gliding: false, dashing: false, facing: Math.PI, airTime: 0, landing: null,
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
assert(contracted < 3, `Decorative post should shorten the boom: ${contracted}`);
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

// A tall gameplay column must pull the camera in instead of lifting it overhead.
const pillarWorld = new THREE.Group();
const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 2.6, 12), new THREE.MeshStandardMaterial());
pillar.position.set(Math.sin(0.34) * 2.1, 1.3, Math.cos(0.34) * 2.1);
pillarWorld.add(pillar);
const pillarCam = createFollowCamera({ scenery: pillarWorld,
  surfaceAt: (x, z) => Math.hypot(x - pillar.position.x, z - pillar.position.z) < 0.45 ? 2.6 : 0,
});
tick(pillarCam, frame());
const columnPitch = Math.atan2(pillarCam.camera.position.y - 0.62, Math.hypot(pillarCam.camera.position.x, pillarCam.camera.position.z));
assert(columnPitch < Math.PI / 5, `Column must avoid steep overhead pitch: ${THREE.MathUtils.radToDeg(columnPitch)}`);

// A column crossing the raw spring endpoint used to kick it upward by1.33m
// in one frame, even though the compressed rendered lens was in clear space.
const movingWorld = new THREE.Group();
const movingPillar = pillar.clone();
movingPillar.position.set(0, 1.3, 3.6);
movingWorld.add(movingPillar);
const crossing = createFollowCamera({ scenery: movingWorld,
  surfaceAt: (x, z) => Math.hypot(x, z - 3.6) < 0.45 ? 2.6 : 0,
});
const crossingFrame = frame();
crossingFrame.target.x = -3;
tick(crossing, crossingFrame, 90);
let maxColumnVerticalStep = 0;
let maxColumnPositionStep = 0;
const previous = crossing.camera.position.clone();
for (let i = 0; i < 180; i++) {
  crossingFrame.vel.x = 4;
  crossingFrame.target.x = -3 + i * crossingFrame.vel.x / 60;
  crossing.update(1 / 60, crossingFrame);
  maxColumnVerticalStep = Math.max(maxColumnVerticalStep, Math.abs(crossing.camera.position.y - previous.y));
  maxColumnPositionStep = Math.max(maxColumnPositionStep, crossing.camera.position.distanceTo(previous));
  previous.copy(crossing.camera.position);
}
assert(maxColumnVerticalStep < 0.08, `Column crossing must not kick the lens upward: ${maxColumnVerticalStep}`);
assert(maxColumnPositionStep < 0.2, `Column crossing must compress gradually: ${maxColumnPositionStep}`);

// Final floor protection can move a compressed lens after the spring was guarded.
const raised = createFollowCamera({
  scenery: world,
  surfaceAt: (x, z) => Math.hypot(x, z) > 1 && Math.hypot(x, z) < 2 ? 4 : 0,
});
post.visible = true;
raised.resize(1920, 1080);
tick(raised, frame());
for (const y of [0, 1.25]) {
  const ndc = new THREE.Vector3(0, y, 0).project(raised.camera);
  assert(Math.abs(ndc.y) < 0.85, `Final raised lens must frame feet and ears: ${ndc.y}`);
}
post.visible = false;

// Reproduce the actual captured H0 bowl. Pure pull-in put ears at NDC y2.40;
// close scenery must use the existing cutout while retaining whole-body framing.
const bowlScene = new THREE.Scene();
const bowlBucket = new Bucket();
const hx = -59.72842326556918, hz = 27.077438179359337;
hearthBrazier(bowlBucket, hx, 6, hz, 301);
bowlScene.add(bowlBucket.toMesh(new THREE.MeshStandardMaterial({ name: 'rv-stone' }))!);
const bowlCam = createFollowCamera({ scenery: bowlScene,
  surfaceAt: (x, z) => Math.hypot(x - hx, z - hz) < 0.82 ? 7 : 6,
});
bowlCam.resize(1280, 720);
bowlCam.snapBehind(0.349 - Math.PI);
const bowlFrame = frame();
bowlFrame.target.set(-59.87092746862208, 6, 25.11017733045462);
tick(bowlCam, bowlFrame);
for (const y of [6, 7.25]) {
  const ndc = new THREE.Vector3(bowlFrame.target.x, y, bowlFrame.target.z).project(bowlCam.camera);
  assert(Math.abs(ndc.y) < 0.85, `Captured bowl must not crop feet or ears: ${ndc.y}`);
}
assert(bowlCam.debug.blocked(), 'Close decorative bowl must activate the cutout');
const fader = createOcclusionFader(bowlScene, { solidAt: () => -Infinity, blocked: bowlCam.debug.blocked });
const dimensionsOnly = { getDrawingBufferSize: (out: THREE.Vector2) => out.set(1280, 720) } as unknown as THREE.WebGLRenderer;
for (let i = 0; i < 60; i++) fader.update(1 / 60, bowlCam.camera, dimensionsOnly, bowlFrame.target, 1.25, Math.PI);
assert(fader.strength > 0.99, 'Geometry blocker must fade even without a gameplay height collider');

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

// Chunked merged geometry must retain exactly the same near-post hit, including
// when its source is transformed and distant triangles share the render bucket.
const densePost = post.geometry.clone().toNonIndexed();
densePost.translate(post.position.x, post.position.y, post.position.z);
const shell = new THREE.SphereGeometry(40, 64, 48).toNonIndexed();
const merged = mergeGeometries([shell, densePost]);
assert(merged);
const chunkWorld = new THREE.Group();
chunkWorld.position.set(12, 3, -8);
chunkWorld.add(new THREE.Mesh(merged, new THREE.MeshStandardMaterial()));
const chunkCam = createFollowCamera({ scenery: chunkWorld });
const chunkFrame = frame();
chunkFrame.target.copy(chunkWorld.position);
tick(chunkCam, chunkFrame);
assert(Math.abs(chunkCam.camera.position.distanceTo(chunkFrame.target) - contracted) < 0.001, 'Chunking must preserve a transformed merged post hit');

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
console.log(JSON.stringify({ passed: true, contractedDistance: contracted, maxJumpNdc: maxNdc, maxColumnVerticalStep, maxColumnPositionStep, frameRateDelta: poses[0]!.distanceTo(poses[2]!) }));
