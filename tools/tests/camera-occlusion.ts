import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFollowCamera } from '../../games/fox-spirit/src/camera';
import { createOcclusionFader } from '../../games/fox-spirit/src/occlusion';
import { CollisionWorld, boxCollider, cylCollider } from '../../games/fox-spirit/src/collision';

// CPU geometry probes only; this never creates a renderer or browser.
const scenery = new THREE.Group();
const lensWorld = new CollisionWorld(() => -20);
const lensBox = lensWorld.add(boxCollider({ x: 0, z: 0, w: 2, d: 4, yaw: .6, top: 3, bottom: 1 }));
assert.equal(lensWorld.cameraOccupied(0, 2, 0), true);
assert.equal(lensWorld.cameraOccupied(0, 3.21, 0), false, 'lens above a slab is clear');
assert.equal(lensWorld.cameraOccupied(0, .79, 0), false, 'lens below a slab is clear');
assert.equal(lensWorld.cameraOccupied(5, 2, 0), false);
lensBox.enabled = false;
assert.equal(lensWorld.cameraOccupied(0, 2, 0), false, 'disabled solid cannot occupy the lens');
lensWorld.add(cylCollider({ x: 10, z: 0, r: 1, top: 5, bottom: 3 }));
assert.equal(lensWorld.cameraOccupied(10, 4, 0), true);
assert.equal(lensWorld.cameraOccupied(11.25, 4, 0), false);
assert.equal(lensWorld.cameraOccupied(10, 2.75, 0), false);
assert.equal(lensWorld.cameraOccupied(0, -20.1, 0), true, 'terrain remains solid below its surface');
const material = new THREE.MeshStandardMaterial();
const wall = new THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[]>(new THREE.PlaneGeometry(20, 20), material);
wall.position.z = 2; // normal +Z: focus sees the back of this single-sided plane
wall.name = 'single-sided-wall';
scenery.add(wall);
const follow = createFollowCamera({ scenery });
follow.resize(1280, 720);
follow.update(1 / 60, { target: new THREE.Vector3(), vel: new THREE.Vector3(), grounded: true,
  gliding: false, dashing: false, facing: Math.PI, airTime: 0, landing: null });
assert.match(follow.debug.internals(), /blocker=single-sided-wall/);
assert.equal(material.side, THREE.FrontSide, 'query must preserve rendered material side');

// Moving a small prop after construction must move the query as well.
wall.position.x = 100;
scenery.updateMatrixWorld(true);
follow.update(1 / 60, { target: new THREE.Vector3(), vel: new THREE.Vector3(), grounded: true,
  gliding: false, dashing: false, facing: Math.PI, airTime: 0, landing: null });
assert.match(follow.debug.internals(), /blocker=$/, 'moved wall must not leave a phantom blocker');
wall.position.x = 0;
scenery.updateMatrixWorld(true);
follow.update(1 / 60, { target: new THREE.Vector3(), vel: new THREE.Vector3(), grounded: true,
  gliding: false, dashing: false, facing: Math.PI, airTime: 0, landing: null });
assert.match(follow.debug.internals(), /blocker=single-sided-wall/);

// A multi-material mesh only draws geometry groups. Ungrouped triangles must
// not become phantom blockers when the query substitutes double-sided materials.
wall.material = [material];
wall.geometry.clearGroups();
const groupedFollow = createFollowCamera({ scenery });
groupedFollow.update(1 / 60, { target: new THREE.Vector3(), vel: new THREE.Vector3(), grounded: true,
  gliding: false, dashing: false, facing: Math.PI, airTime: 0, landing: null });
assert.match(groupedFollow.debug.internals(), /blocker=$/, 'ungrouped solid triangles are not drawn');
wall.geometry.addGroup(0, wall.geometry.index!.count, 0);
groupedFollow.update(1 / 60, { target: new THREE.Vector3(), vel: new THREE.Vector3(), grounded: true,
  gliding: false, dashing: false, facing: Math.PI, airTime: 0, landing: null });
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
// The shader's floor protection uses column 1 of the *view* rotation, not
// camera-up or the transposed column. Exercise pitched/rolled camera transforms.
for (const eye of [new THREE.Vector3(4, 2, 3), new THREE.Vector3(-3, 8, 1)]) {
  camera.position.copy(eye); camera.up.set(0.2, 1, 0.1); camera.lookAt(0, 0.6, 0);
  camera.updateMatrixWorld(true);
  const column = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorldInverse, 1);
  for (const world of [new THREE.Vector3(1, -2, 3), new THREE.Vector3(-4, 6, -1)]) {
    const viewPosition = world.clone().applyMatrix4(camera.matrixWorldInverse).negate();
    assert.ok(Math.abs(camera.position.y - column.dot(viewPosition) - world.y) < 1e-9,
      'fragment height reconstruction must preserve floor height under pitch/roll');
  }
  for (const worldNormal of [new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 2, 0).normalize(), new THREE.Vector3(0, 0, 1)]) {
    const viewNormal = worldNormal.clone().transformDirection(camera.matrixWorldInverse);
    assert.ok(Math.abs(column.dot(viewNormal) - worldNormal.y) < 1e-9,
      'floor normal reconstruction must distinguish treads, slopes and walls under pitch/roll');
  }
}
fader.update(1 / 60, camera, renderer, new THREE.Vector3(0, 7.25, 0), 0.55, 0);
assert.equal(shader.uniforms.uOccFox.value.w, 7.25, 'floor protection follows current feet height');
camera.up.set(0, 1, 0); camera.position.set(0, 0.6, 4); camera.lookAt(0, 0.3, 0);
step(); step();
assert.equal(fader.detected, true, 'unproxied leaf material must block sight');
assert.equal(crown.material, crownMat, 'canopy query must restore the rendered material');
assert.equal(crownMat.side, THREE.FrontSide, 'canopy query must preserve render sidedness');
assert.ok(fader.strength > 0, 'detected obstruction should begin opening the cutout');
parent.visible = false;
step(); step();
assert.equal(fader.detected, false, 'hidden ancestor must not trigger canopy ray');
for (let i = 0; i < 120; i++) step();
assert.ok(fader.strength < 0.01, 'cutout must restore after obstruction clears');

// Photo/review cameras do not use the gameplay-boom blocked signal. Signs need
// their own precise sight coverage, including a post whose render material is hidden.
const signScene = new THREE.Scene();
const postMaterial = new THREE.MeshBasicMaterial({ visible: false });
const post = new THREE.Mesh(new THREE.CylinderGeometry(.09, .099, 1.59, 8), postMaterial);
post.position.set(0, .645, 2); post.userData.isOccluder = true; signScene.add(post);
signScene.updateMatrixWorld(true);
const signFader = createOcclusionFader(signScene, { solidAt: () => -Infinity });
const signStep = () => signFader.update(1 / 60, camera, renderer, new THREE.Vector3(), .55, 0);
signStep();
assert.equal(signFader.detected, true, 'query-only post must trigger fade without gameplay-boom signal');
assert.equal(post.material, postMaterial); assert.equal(postMaterial.visible, false, 'sight query must not reveal its proxy');
post.visible = false;
const signFace = new THREE.Mesh(new THREE.PlaneGeometry(2.2, .38), new THREE.MeshStandardMaterial());
signFace.position.set(0, .45, 2); signFace.userData.isOccluder = true; signScene.add(signFace);
// Fader snapshots world builders once; construct the sign-face-only case after its builder.
signScene.updateMatrixWorld(true);
const faceFader = createOcclusionFader(signScene, { solidAt: () => -Infinity });
faceFader.update(1 / 60, camera, renderer, new THREE.Vector3(), .55, 0);
assert.equal(faceFader.detected, true, 'tagged sign face must independently trigger cutout');

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
  gliding: false, dashing: false, facing: Math.PI, airTime: 0, landing: null };
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
// Descending retains a restrained landing-preview lift and its damped transition.
const ascentViews = [];
for (const verticalSpeed of [5, -0.5, -2.5, -4]) {
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
  else if (verticalSpeed <= -4) assert.ok(extraCrane > 0.5 && extraCrane <= 0.85, 'fast descent keeps a restrained landing-preview lift');
  else assert.ok(extraCrane > 0, 'partial descent retains a weighted landing-preview lift');
  ascentViews.push({ verticalSpeed, extraHeight: +extraHeight.toFixed(3), extraCrane: +extraCrane.toFixed(3) });
}
console.log('Landing-preview lift CPU probe:', JSON.stringify(ascentViews));

// Overhead decorative strings must not pump the solid boom; their timber posts
// remain normal scenery. This is geometry-only and never creates a renderer.
const stringScene = new THREE.Group();
const stringMat = new THREE.MeshStandardMaterial();
const stringPlane = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), stringMat);
stringPlane.name = 'decorative-string-test';
stringPlane.position.z = 2;
stringPlane.userData.cameraDecoration = true;
stringScene.add(stringPlane);
const stringCamera = createFollowCamera({ scenery: stringScene });
stringCamera.resize(1280, 720);
stringCamera.update(1 / 60, { target: new THREE.Vector3(), vel: new THREE.Vector3(), grounded: true,
  gliding: false, dashing: false, facing: Math.PI, airTime: 0, landing: null });
assert.match(stringCamera.debug.internals(), /blocker=$/, 'decorations must not compress the solid boom');
stringPlane.userData.cameraDecoration = false;
const solidPostCamera = createFollowCamera({ scenery: stringScene });
solidPostCamera.resize(1280, 720);
solidPostCamera.update(1 / 60, { target: new THREE.Vector3(), vel: new THREE.Vector3(), grounded: true,
  gliding: false, dashing: false, facing: Math.PI, airTime: 0, landing: null });
assert.match(solidPostCamera.debug.internals(), /blocker=decorative-string-test/, 'solid scenery must still block');
console.log('Decorative string / solid post camera distinction PASS');
// Ground-only elevation must not leak into sustained flight. Compare two live
// rigs with deliberately different ground tuning, not a copied height formula.
for (const gliding of [false, true]) {
  const groundLow = createFollowCamera({ params: { groundLift: 0 } });
  const groundHigh = createFollowCamera({ params: { groundLift: 0.6 } });
  const flight = { ...idleFrame, target: new THREE.Vector3(0, 10, 0), grounded: false,
    gliding, airTime: 2, vel: new THREE.Vector3(0, -2.7, -8), landing: new THREE.Vector3(0, 0, -8) };
  for (let i = 0; i < 180; i++) { groundLow.update(1 / 60, flight); groundHigh.update(1 / 60, flight); }
  assert.ok(groundLow.camera.position.distanceTo(groundHigh.camera.position) < 1e-8,
    'sustained air/glide camera must ignore ground-only elevation');
  assert.ok(groundLow.camera.quaternion.angleTo(groundHigh.camera.quaternion) < 1e-7);
}
const rideViews = [];
for (const [label, height, glideDistance] of [['previous ride proportions', 1.65, 5.5], ['restrained ride proportions', 1.4, 4.8]] as const) {
  const follow = createFollowCamera({ params: { height, glideDistance } });
  const frame = { ...idleFrame, target: new THREE.Vector3(0, 10, 0), grounded: false,
    gliding: true, airTime: 2, vel: new THREE.Vector3(0, -2.7, -8), landing: new THREE.Vector3(0, 0, -8) };
  for (let i = 0; i < 180; i++) follow.update(1 / 60, frame);
  const direction = follow.camera.getWorldDirection(new THREE.Vector3());
  rideViews.push({ label, viewPitchDeg: THREE.MathUtils.radToDeg(Math.asin(-direction.y)), range: follow.camera.position.distanceTo(frame.target) });
}
assert.ok(rideViews[1]!.viewPitchDeg <= rideViews[0]!.viewPitchDeg, 'closer ride must not also steepen the view');
console.log('Flight tuning CPU poses (not image proof):', JSON.stringify(rideViews));

// Geometry proxies for the image-driven composition pass. The .95m running
// silhouette is an estimate, not an image measurement or substitute for GPU review.
const composition = [];
for (const runDistance of [3.0, 3.3]) for (const speed of [0, 3.8, 9]) {
  const follow = createFollowCamera({ params: { runDistance } });
  follow.resize(1280, 720);
  const target = new THREE.Vector3();
  for (let i = 0; i < 180; i++) {
    target.z = -speed * i / 60;
    follow.update(1 / 60, { ...idleFrame, target, vel: new THREE.Vector3(0, 0, -speed) });
  }
  const foot = target.clone().project(follow.camera);
  const head = target.clone().add(new THREE.Vector3(0, speed ? 0.95 : 1.25, 0)).project(follow.camera);
  const centre = target.clone().add(new THREE.Vector3(0, 0.6, 0)).project(follow.camera);
  const angle = THREE.MathUtils.radToDeg(Math.atan2(Math.abs(follow.camera.position.x - target.x), Math.abs(follow.camera.position.z - target.z)));
  assert.ok(centre.y <= -0.3 && centre.y > -0.55, 'grounded chest sits in lower-third band');
  assert.ok(foot.y > -0.95 && head.y < 0.85, 'proxy ears and feet remain inside frame');
  assert.ok(angle > 20, 'quartering lens preserves a side component at run speed');
  composition.push({ runDistance, speed, chestNdcY: +centre.y.toFixed(3), proxyHeightPx: +((head.y-foot.y)*360).toFixed(1), rearAngleDeg: +angle.toFixed(1) });
}
console.log('Chase composition CPU proxies:', JSON.stringify(composition));

// A downhill fox moving toward the lens extends beyond its root-line guard.
// This proxy is deliberately below the root to reserve the pitched snout.
const descentCamera = createFollowCamera();
descentCamera.resize(1280, 720);
const descentTarget = new THREE.Vector3(0, 20, 0);
let lowestNose = 1, highestEars = -1, steepestView = 0;
for (let i = 0; i < 240; i++) {
  descentTarget.z = i * 4.5 / 60;
  descentTarget.y = 20 - descentTarget.z * .5;
  descentCamera.update(1 / 60, { ...idleFrame, target: descentTarget, facing: 0, vel: new THREE.Vector3(0, 0, 4.5) });
  const nose = descentTarget.clone().add(new THREE.Vector3(0, -.1, .85)).project(descentCamera.camera);
  const ears = descentTarget.clone().add(new THREE.Vector3(0, 1.25, 0)).project(descentCamera.camera);
  const view = descentCamera.camera.getWorldDirection(new THREE.Vector3());
  lowestNose = Math.min(lowestNose, nose.y); highestEars = Math.max(highestEars, ears.y);
  steepestView = Math.max(steepestView, THREE.MathUtils.radToDeg(Math.asin(-view.y)));
}
assert.ok(lowestNose > -.9, `descending front silhouette stays above viewport edge: ${lowestNose}`);
assert.ok(highestEars < .9, 'nose protection retains the ears');
assert.ok(steepestView < 40, `nose protection avoids top-down framing: ${steepestView}`);
console.log('Downhill front proxy:', JSON.stringify({ lowestNose, highestEars, steepestView }));

for (const velocity of [new THREE.Vector3(0, 0, 9), new THREE.Vector3(4.5, 0, -7.8)]) {
  const follow = createFollowCamera();
  const reference = createFollowCamera({ params: { minDistance: 0 } });
  follow.resize(1280, 720);
  reference.resize(1280, 720);
  const target = new THREE.Vector3();
  let minimumRange = Infinity;
  let referenceRange = Infinity;
  for (let i = 0; i < 180; i++) {
    target.addScaledVector(velocity, 1 / 60);
    follow.update(1 / 60, { ...idleFrame, target, vel: velocity });
    reference.update(1 / 60, { ...idleFrame, target, vel: velocity });
    minimumRange = Math.min(minimumRange, follow.camera.position.distanceTo(target.clone().setY(target.y + follow.params.lookHeight)));
    referenceRange = Math.min(referenceRange, reference.camera.position.distanceTo(target.clone().setY(target.y + reference.params.lookHeight)));
  }
  assert.ok(minimumRange >= follow.params.minDistance - 1e-6, 'toward-lens and off-axis motion retain actual body room');
  if (velocity.z > 0) assert.ok(referenceRange < follow.params.minDistance, 'backpedal probe must actually need the body-room correction');
}

// Solid compression has final authority after the open-ground lag correction.
// The minimum must not push a wall-compressed lens through the wall again.
const wallScene = new THREE.Group();
const closeWall = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial());
closeWall.position.z = 2.1; wallScene.add(closeWall);
const wallCamera = createFollowCamera({ scenery: wallScene });
wallCamera.resize(1280, 720);
for (let i = 0; i < 120; i++) wallCamera.update(1 / 60, { ...idleFrame, target: new THREE.Vector3() });
assert.ok(wallCamera.camera.position.z < 2, 'compressed lens stays on the hero side of the wall');
assert.ok(wallCamera.camera.position.distanceTo(new THREE.Vector3(0, wallCamera.params.lookHeight, 0)) < wallCamera.params.minDistance,
  'safe wall compression may take precedence over the open-ground minimum');

const nearCliff = new THREE.Group();
const overhang = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial());
overhang.position.z = .16; overhang.name = 'close visual rock overhang'; nearCliff.add(overhang);
const closeCliffCamera = createFollowCamera({ scenery: nearCliff });
closeCliffCamera.resize(1280, 720);
closeCliffCamera.update(1 / 60, { ...idleFrame, target: new THREE.Vector3() });
assert.equal(closeCliffCamera.debug.blocked(), true, 'a 16cm visual overhang must not be skipped as footing');
assert.match(closeCliffCamera.debug.internals(), /blocker=close visual rock overhang/);
