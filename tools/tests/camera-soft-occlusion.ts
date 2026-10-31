/** CPU-only uniform registration/projection; no renderer or GL context. */
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { heroSoftUniforms, HERO_SOFT_VERTEX, HERO_SOFT_FRAGMENT } from '../../games/fox-spirit/src/cameraSoftOcclusion';
import { createOcclusionFader } from '../../games/fox-spirit/src/occlusion';
const scene = new THREE.Scene(), hero = new THREE.Group();
const make = (tag: boolean) => {
  const material = new THREE.ShaderMaterial({ uniforms: heroSoftUniforms(), vertexShader: `${HERO_SOFT_VERTEX}\nvoid main() { vec4 mv=modelViewMatrix*vec4(position,1.0); vCameraOccluderDepth=-mv.z; gl_Position=projectionMatrix*mv; }`, fragmentShader: `${HERO_SOFT_FRAGMENT}\nvoid main() { gl_FragColor=vec4(vec3(0.1),cameraHeroAlpha()); }` });
  material.userData.heroSoftOccluder = tag; return material;
};
const core = make(true), shell = core.clone(), smoke = core.clone(), untouched = make(false), excluded = make(true);
const geo = new THREE.PlaneGeometry();
const coreMesh = new THREE.Mesh(geo, core), shellMesh = new THREE.Mesh(geo, shell), smokePoints = new THREE.Points(geo, smoke);
coreMesh.userData.forgeSkipAO = true; // shell intentionally omitted: diagnostic must expose the missing exclusion.
let smokeCallbacks = 0; smokePoints.onBeforeRender = () => { smokeCallbacks++; };
scene.add(coreMesh, shellMesh, smokePoints, new THREE.Mesh(geo, untouched));
hero.add(new THREE.Mesh(geo, excluded)); scene.add(hero);
const fader = createOcclusionFader(scene, { solidAt: () => -Infinity, exclude: hero });
for (const material of [shell, smoke]) {
  assert.equal(material.uniforms.uCameraHero, core.uniforms.uCameraHero, 'all tagged shells/points share final-camera focus');
  assert.equal(material.uniforms.uCameraHeroRadius, core.uniforms.uCameraHeroRadius);
  assert.equal(material.uniforms.uCameraHeroHead, core.uniforms.uCameraHeroHead);
}
assert.notEqual(untouched.uniforms.uCameraHero, core.uniforms.uCameraHero, 'untagged volume remains untouched');
assert.notEqual(excluded.uniforms.uCameraHero, core.uniforms.uCameraHero, 'hero subtree remains excluded');
const camera = new THREE.PerspectiveCamera(54, 1280 / 720, .1, 100);
camera.position.set(0, 1.55, 3.8); camera.lookAt(0, .95, 0);
let target: { width: number; height: number } | null = null;
const viewport = new THREE.Vector4(0, 0, 1280, 720);
const canvasSize = { width: 1280, height: 720 };
const dimensions = { getDrawingBufferSize: (out: THREE.Vector2) => out.set(canvasSize.width, canvasSize.height),
  domElement: canvasSize, getRenderTarget: () => target,
  getCurrentViewport: (out: THREE.Vector4) => out.copy(viewport) } as unknown as THREE.WebGLRenderer;
fader.update(1 / 60, camera, dimensions, new THREE.Vector3(), 1.25, Math.PI, new THREE.Vector3(0, 1, -.75));
const focus = core.uniforms.uCameraHero!.value as THREE.Vector4, radius = core.uniforms.uCameraHeroRadius!.value as THREE.Vector2;
assert.ok(focus.x > 0 && focus.x < 1280 && focus.y > 0 && focus.y < 720 && focus.z > 0);
assert.ok(radius.x > 0 && radius.y > 0);
const previous = focus.clone();
camera.position.set(6, 1.3, 0); camera.lookAt(0, .8, 0);
fader.update(1 / 60, camera, dimensions, new THREE.Vector3(), 1.25, Math.PI, new THREE.Vector3(0, 1, -.75));
assert.ok(focus.clone().sub(previous).length() > .1, 'soft uniforms track the final photo camera');
assert.equal(fader.strength, 0, 'custom volume transparency does not activate world dither');
const drawCore = (view: THREE.Camera) => coreMesh.onBeforeRender(dimensions, scene, view, geo, core, null as never);
drawCore(camera); assert.equal(core.uniforms.uCameraHeroEnabled!.value, 1, 'primary native view enables alpha window');
drawCore(new THREE.PerspectiveCamera()); assert.equal(core.uniforms.uCameraHeroEnabled!.value, 0, 'reflection camera preserves original volume alpha');
target = { width: 640, height: 360 }; drawCore(camera);
assert.equal(core.uniforms.uCameraHeroEnabled!.value, 0, 'reduced-size target excludes main-view mask');
target = null; viewport.set(10, 0, 1280, 720); drawCore(camera);
assert.equal(core.uniforms.uCameraHeroEnabled!.value, 0, 'offset viewport excludes main-view mask');
viewport.set(0, 0, 1280, 720); drawCore(camera);
assert.equal(core.uniforms.uCameraHeroEnabled!.value, 1);
smokePoints.onBeforeRender(dimensions, scene, camera, geo, smoke, null as never);
assert.equal(smokeCallbacks, 1, 'original smoke callback is chained');
fader.patchScene();
smokePoints.onBeforeRender(dimensions, scene, camera, geo, smoke, null as never);
assert.equal(smokeCallbacks, 2, 'repatch does not wrap callbacks twice');
assert.equal(fader.softBindings().registered, 3); assert.equal(fader.softBindings().bound, 3);
assert.equal(fader.softBindings().cameraReady, true);
assert.equal(fader.softBindings().meshes, 2); assert.equal(fader.softBindings().aoExcluded, 1, 'runtime count exposes a missing AO exclusion');
canvasSize.width = 1707; canvasSize.height = 960;
target = { width: 1707.5, height: 960 }; viewport.set(0, 0, 1707.5, 960);
fader.update(1 / 60, camera, dimensions, new THREE.Vector3(), 1.25, Math.PI, new THREE.Vector3(0, 1, -.75));
drawCore(camera);
assert.equal(core.uniforms.uCameraHeroEnabled!.value, 1, 'fractional composer size matches floored native pixels');
target.width = 1706.5; drawCore(camera);
assert.equal(core.uniforms.uCameraHeroEnabled!.value, 0, 'different physical target size stays excluded');
console.log('PASS: tagged core/shell/smoke share final-camera hero projection; other volumes and hero stay excluded (CPU only)');
