import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFollowCamera } from '../../games/fox-spirit/src/camera';
import { createOcclusionFader } from '../../games/fox-spirit/src/occlusion';

// CPU geometry probes only; this never creates a renderer or browser.
const scenery = new THREE.Group();
const material = new THREE.MeshStandardMaterial();
const wall = new THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[]>(new THREE.PlaneGeometry(20, 20), material);
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

// A multi-material mesh only draws geometry groups. Ungrouped triangles must
// not become phantom blockers when the query substitutes double-sided materials.
wall.material = [material];
wall.geometry.clearGroups();
const groupedFollow = createFollowCamera({ scenery });
groupedFollow.update(1 / 60, { target: new THREE.Vector3(), vel: new THREE.Vector3(), grounded: true,
  gliding: false, dashing: false, airTime: 0, landing: null });
assert.match(groupedFollow.debug.internals(), /blocker=$/, 'ungrouped solid triangles are not drawn');
wall.geometry.addGroup(0, wall.geometry.index!.count, 0);
groupedFollow.update(1 / 60, { target: new THREE.Vector3(), vel: new THREE.Vector3(), grounded: true,
  gliding: false, dashing: false, airTime: 0, landing: null });
assert.match(groupedFollow.debug.internals(), /blocker=single-sided-wall/);

const scene = new THREE.Scene();
const parent = new THREE.Group();
const crownMat = new THREE.MeshStandardMaterial();
crownMat.name = 'autumn-leaves';
crownMat.onBeforeCompile = (shader) => {
  shader.fragmentShader = '#define BUILDER_PATCH\n' + shader.fragmentShader;
};
const crown = new THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[]>(new THREE.PlaneGeometry(4, 4), crownMat);
crown.position.set(0, 0.5, 2);
crown.rotation.y = Math.PI; // the camera sees the back of the rendered leaf card
parent.add(crown); scene.add(parent); scene.updateMatrixWorld(true);
const fader = createOcclusionFader(scene, { solidAt: () => -Infinity });
// Material builders (growth, water, color field) finish before the fader wraps
// their hooks. Check composition without compiling or creating a GPU renderer.
fader.patchScene();
const shader = { vertexShader: THREE.ShaderLib.standard.vertexShader,
  fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} } as Parameters<typeof crownMat.onBeforeCompile>[0];
crownMat.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
assert.match(shader.fragmentShader, /#define BUILDER_PATCH/);
assert.equal(shader.fragmentShader.match(/uniform float uOccStrength/g)?.length, 1, 'cutout patch composes once with builder hook');
assert.ok(shader.uniforms.uOccFox, 'built material receives live cutout uniforms');
const camera = new THREE.PerspectiveCamera(54, 16 / 9, 0.1, 100);
camera.position.set(0, 0.6, 4); camera.lookAt(0, 0.3, 0);
const renderer = { getDrawingBufferSize: (out: THREE.Vector2) => out.set(1280, 720) } as THREE.WebGLRenderer;
const step = () => fader.update(1 / 60, camera, renderer, new THREE.Vector3(), 0.55, 0);
step();
assert.equal(fader.detected, true, 'unproxied leaf material must block sight');
assert.equal(crown.material, crownMat, 'canopy query must restore the rendered material');
assert.equal(crownMat.side, THREE.FrontSide, 'canopy query must preserve render sidedness');
assert.ok(fader.strength > 0, 'detected obstruction should begin opening the cutout');
parent.visible = false;
step(); step();
assert.equal(fader.detected, false, 'hidden ancestor must not trigger canopy ray');
for (let i = 0; i < 120; i++) step();
assert.ok(fader.strength < 0.01, 'cutout must restore after obstruction clears');

parent.visible = true;
const crownMaterials = [crownMat];
crown.material = crownMaterials;
crown.geometry.clearGroups();
step(); step();
assert.equal(fader.detected, false, 'ungrouped canopy triangles are not drawn');
assert.equal(crown.material, crownMaterials, 'query restores the exact material array');
crown.geometry.addGroup(0, crown.geometry.index!.count, 0);
step(); step();
assert.equal(fader.detected, true, 'grouped back-facing canopy triangles block sight');
console.log('PASS: back-face boom/crown, render material isolation, live props, material groups, hidden ancestor, fade release');

// Reactive celebration shots must never turn a restored run into a realm-wide
// panorama. Authored restoration paths have their own explicit camera contract.
const celebration = createFollowCamera();
celebration.resize(1280, 720);
const hero = new THREE.Vector3();
const idleFrame = { target: hero, vel: new THREE.Vector3(), grounded: true,
  gliding: false, dashing: false, airTime: 0, landing: null };
celebration.update(1 / 60, idleFrame);
celebration.playShot({ subjects: [hero.clone(), new THREE.Vector3(100, 20, -70)], holdS: 1.7 });
for (let i = 0; i < 60; i++) celebration.update(1 / 60, idleFrame);
assert.match(celebration.debug.internals(), /shot=0\.00/, 'remote seedwell must not take the lens');
assert.ok(celebration.camera.position.distanceTo(hero) < 6, 'remote celebration keeps traversal distance');

celebration.playShot({ subjects: [hero.clone(), new THREE.Vector3(0, 0, -4)], holdS: 1.7 });
for (let i = 0; i < 60; i++) celebration.update(1 / 60, idleFrame);
assert.match(celebration.debug.internals(), /shot=1\.00/, 'stopped local celebrations retain composition');
for (let i = 0; i < 60; i++) {
  hero.z -= 9 / 60;
  celebration.update(1 / 60, { ...idleFrame, vel: new THREE.Vector3(0, 0, -9) });
}
assert.match(celebration.debug.internals(), /shot=0\.00/, 'running yields the local celebration');
assert.ok(celebration.camera.position.distanceTo(hero) < 7, 'running returns to readable chase distance');
console.log('PASS: remote celebration rejected, local idle shot retained, running takes camera back');
