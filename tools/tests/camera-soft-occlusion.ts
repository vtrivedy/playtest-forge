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
scene.add(new THREE.Mesh(geo, core), new THREE.Mesh(geo, shell), new THREE.Points(geo, smoke), new THREE.Mesh(geo, untouched));
hero.add(new THREE.Mesh(geo, excluded)); scene.add(hero);
const fader = createOcclusionFader(scene, { solidAt: () => -Infinity, exclude: hero });
for (const material of [shell, smoke]) {
  assert.equal(material.uniforms.uCameraHero, core.uniforms.uCameraHero, 'all tagged shells/points share final-camera focus');
  assert.equal(material.uniforms.uCameraHeroRadius, core.uniforms.uCameraHeroRadius);
}
assert.notEqual(untouched.uniforms.uCameraHero, core.uniforms.uCameraHero, 'untagged volume remains untouched');
assert.notEqual(excluded.uniforms.uCameraHero, core.uniforms.uCameraHero, 'hero subtree remains excluded');
const camera = new THREE.PerspectiveCamera(54, 1280 / 720, .1, 100);
camera.position.set(0, 1.55, 3.8); camera.lookAt(0, .95, 0);
const dimensions = { getDrawingBufferSize: (out: THREE.Vector2) => out.set(1280, 720) } as THREE.WebGLRenderer;
fader.update(1 / 60, camera, dimensions, new THREE.Vector3(), 1.25, Math.PI);
const focus = core.uniforms.uCameraHero!.value as THREE.Vector4, radius = core.uniforms.uCameraHeroRadius!.value as THREE.Vector2;
assert.ok(focus.x > 0 && focus.x < 1280 && focus.y > 0 && focus.y < 720 && focus.z > 0);
assert.ok(radius.x > 0 && radius.y > 0);
const previous = focus.clone();
camera.position.set(6, 1.3, 0); camera.lookAt(0, .8, 0);
fader.update(1 / 60, camera, dimensions, new THREE.Vector3(), 1.25, Math.PI);
assert.ok(focus.clone().sub(previous).length() > .1, 'soft uniforms track the final photo camera');
assert.equal(fader.strength, 0, 'custom volume transparency does not activate world dither');
console.log('PASS: tagged core/shell/smoke share final-camera hero projection; other volumes and hero stay excluded (CPU only)');
