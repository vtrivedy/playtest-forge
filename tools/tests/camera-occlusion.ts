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

// A tall stair behind the lens used to force a fixed .30 fraction (~1m),
// filling the image with the fox's torso. Compare minimum-distance variations
// on identical CPU geometry; these metrics are not visual acceptance.
const terrainVariations = [];
for (const minDistance of [0, 2.2, 2.6, 3.0]) {
  const stair = createFollowCamera({ params: { minDistance }, surfaceAt: (_x, z) => z > 0.5 ? 2 : 0 });
  stair.resize(1280, 720);
  for (let i = 0; i < 120; i++) stair.update(1 / 60, { ...idleFrame, target: new THREE.Vector3() });
  const pos = stair.camera.position;
  const horizontal = Math.hypot(pos.x, pos.z);
  assert.ok(horizontal > minDistance * 0.8, 'terrain fallback preserves horizontal body room');
  assert.ok(pos.y >= 2, 'readability floor retains the final ground clearance');
  if (minDistance > 0) assert.equal(stair.debug.blocked(), true, 'unresolved terrain requests a cutout');
  assert.ok(stair.camera.projectionMatrix.elements.every(Number.isFinite));
  const feetNdc = new THREE.Vector3().project(stair.camera).y;
  const earsNdc = new THREE.Vector3(0, 1.25, 0).project(stair.camera).y;
  const direction = stair.camera.getWorldDirection(new THREE.Vector3());
  const pitch = THREE.MathUtils.radToDeg(Math.atan2(-direction.y, Math.hypot(direction.x, direction.z)));
  if (minDistance >= 2.6) {
    assert.ok(pitch < 40, 'selected terrain fallback avoids a steep overhead view');
    assert.ok(Math.abs(feetNdc) < 0.92 && Math.abs(earsNdc) < 0.92, 'ears and feet remain inside the safe vertical frame');
  }
  terrainVariations.push({ minDistance, horizontal: +horizontal.toFixed(3), height: +pos.y.toFixed(3), pitch: +pitch.toFixed(2),
    feetNdc: +feetNdc.toFixed(3), earsNdc: +earsNdc.toFixed(3), cutout: stair.debug.blocked() });
}
console.log('Terrain boom CPU variations:', JSON.stringify(terrainVariations));

// Predicting a lower landing should not crane above a fox that is still rising.
// Descending keeps the same landing-preview lift and its damped transition.
const ascentViews = [];
for (const verticalSpeed of [5, -4]) {
  const noLanding = createFollowCamera();
  const lowLanding = createFollowCamera();
  for (const camera of [noLanding, lowLanding]) camera.resize(1280, 720);
  for (let i = 0; i < 120; i++) {
    const frame = { ...idleFrame, target: new THREE.Vector3(0, 10, 0), vel: new THREE.Vector3(0, verticalSpeed, 0),
      grounded: false, gliding: true, airTime: 1 };
    noLanding.update(1 / 60, frame);
    lowLanding.update(1 / 60, { ...frame, landing: new THREE.Vector3(0, 0, 0) });
  }
  const extraHeight = lowLanding.camera.position.y - noLanding.camera.position.y;
  // The landing view also widens the boom; its normal pitch scales with that
  // distance. Subtract that expected rise to isolate the separate crane lift.
  const rangeDifference = Math.hypot(lowLanding.camera.position.x, lowLanding.camera.position.z)
    - Math.hypot(noLanding.camera.position.x, noLanding.camera.position.z);
  const extraCrane = extraHeight - rangeDifference * lowLanding.params.height / lowLanding.params.distance;
  if (verticalSpeed > 0) assert.ok(Math.abs(extraCrane) < 0.05, 'rising fox gets no descent-only crane lift');
  else assert.ok(extraCrane > 2, 'descending fox retains the landing-preview lift');
  ascentViews.push({ verticalSpeed, extraHeight: +extraHeight.toFixed(3), extraCrane: +extraCrane.toFixed(3) });
}
console.log('Landing-preview lift CPU probe:', JSON.stringify(ascentViews));
