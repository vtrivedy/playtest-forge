import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFollowCamera } from '../../games/fox-spirit/src/camera';
import { createOcclusionFader } from '../../games/fox-spirit/src/occlusion';

// CPU geometry probes only; this never creates a renderer or browser.
const scenery = new THREE.Group();
const material = new THREE.MeshStandardMaterial();
const wall = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), material);
wall.position.z = 2; // normal +Z: focus sees the back of this single-sided plane
wall.name = 'single-sided-wall';
scenery.add(wall);
const follow = createFollowCamera({ scenery });
follow.resize(1280, 720);
follow.update(1 / 60, { target: new THREE.Vector3(), vel: new THREE.Vector3(), grounded: true,
  gliding: false, dashing: false, airTime: 0, landing: null });
assert.match(follow.debug.internals(), /blocker=single-sided-wall/);
assert.equal(material.side, THREE.FrontSide, 'query must preserve rendered material side');

// Moving a small prop after construction must move the query as well.
wall.position.x = 100;
scenery.updateMatrixWorld(true);
follow.update(1 / 60, { target: new THREE.Vector3(), vel: new THREE.Vector3(), grounded: true,
  gliding: false, dashing: false, airTime: 0, landing: null });
assert.match(follow.debug.internals(), /blocker=$/, 'moved wall must not leave a phantom blocker');
wall.position.x = 0;
scenery.updateMatrixWorld(true);
follow.update(1 / 60, { target: new THREE.Vector3(), vel: new THREE.Vector3(), grounded: true,
  gliding: false, dashing: false, airTime: 0, landing: null });
assert.match(follow.debug.internals(), /blocker=single-sided-wall/);

const scene = new THREE.Scene();
const parent = new THREE.Group();
const crownMat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });
crownMat.name = 'autumn-leaves';
const crown = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), crownMat);
crown.position.set(0, 0.5, 2);
parent.add(crown); scene.add(parent); scene.updateMatrixWorld(true);
const fader = createOcclusionFader(scene, { solidAt: () => -Infinity });
const camera = new THREE.PerspectiveCamera(54, 16 / 9, 0.1, 100);
camera.position.set(0, 0.6, 4); camera.lookAt(0, 0.3, 0);
const renderer = { getDrawingBufferSize: (out: THREE.Vector2) => out.set(1280, 720) } as THREE.WebGLRenderer;
const step = () => fader.update(1 / 60, camera, renderer, new THREE.Vector3(), 0.55, 0);
step();
assert.equal(fader.detected, true, 'unproxied leaf material must block sight');
assert.ok(fader.strength > 0, 'detected obstruction should begin opening the cutout');
parent.visible = false;
step(); step();
assert.equal(fader.detected, false, 'hidden ancestor must not trigger canopy ray');
for (let i = 0; i < 120; i++) step();
assert.ok(fader.strength < 0.01, 'cutout must restore after obstruction clears');
console.log('PASS: back-face boom, render material isolation, unproxied crown, hidden ancestor, fade release');
