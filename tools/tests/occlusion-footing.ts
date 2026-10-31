import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createOcclusionFader } from '../../games/fox-spirit/src/occlusion';

// CPU projection and material-hook regression; no renderer/browser is created.
const scene = new THREE.Scene();
const material = new THREE.MeshStandardMaterial();
material.onBeforeCompile = shader => { shader.fragmentShader = '#define BUILDER_PATCH\n' + shader.fragmentShader; };
scene.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
const fader = createOcclusionFader(scene, { solidAt: () => -Infinity });
const shader = { vertexShader: THREE.ShaderLib.standard.vertexShader,
  fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} } as Parameters<typeof material.onBeforeCompile>[0];
material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
assert.match(shader.fragmentShader, /#define BUILDER_PATCH/);
assert.equal(shader.fragmentShader.match(/uniform float uOccFootFade/g)?.length, 1);
assert.match(shader.fragmentShader, /occCut \*= smoothstep\(uOccFox.w, uOccFox.w \+ uOccFootFade, gl_FragCoord.y\)/);
assert.equal(shader.vertexShader, THREE.ShaderLib.standard.vertexShader, 'footing trim must not rewrite mesh transforms');

const feet = new THREE.Vector3(-3, 6, 2);
const height = 1.1, yaw = .7;
let tested = 0;
for (const screenHeight of [360, 720, 1440]) {
  const renderer = { getDrawingBufferSize: (out: THREE.Vector2) => out.set(screenHeight * 16 / 9, screenHeight) } as THREE.WebGLRenderer;
  for (const [dx, dy, dz, roll] of [[3, 2, 4, 0], [-4, 6, 2, .2], [3, -2, 4, -.25], [0, .1, 5, .4]]) {
    const camera = new THREE.PerspectiveCamera(54, 16 / 9, .1, 100);
    camera.position.copy(feet).add(new THREE.Vector3(dx, dy, dz));
    camera.lookAt(feet.clone().add(new THREE.Vector3(0, height * .45, 0)));
    camera.rotateZ(roll);
    camera.updateMatrixWorld();
    fader.update(1 / 60, camera, renderer, feet, height, yaw);
    const fox = shader.uniforms.uOccFox.value as THREE.Vector4;
    const fade = shader.uniforms.uOccFootFade.value as number;
    assert.ok(fade >= 1 && Number.isFinite(fox.w));
    // The shader's lower trim must fully clear the projected paws, tail, muzzle
    // and ears even with the camera below a terrace or rolled during flight.
    for (const [along, up] of [[0, 0], [0, 1.05], [.75, .6], [-1.1, .5], [.4, 0], [-.5, 0]]) {
      const p = new THREE.Vector3(feet.x + Math.sin(yaw) * along, feet.y + height * up, feet.z + Math.cos(yaw) * along).project(camera);
      const py = (p.y * .5 + .5) * screenHeight;
      assert.ok(py >= fox.w + fade, 'silhouette samples retain full cutout clearance');
    }
    assert.equal(THREE.MathUtils.smoothstep(fox.w - 1, fox.w, fox.w + fade), 0, 'pixels below guard keep their original surface');
    tested++;
  }
}
console.log(`PASS: ${tested} pitched/rolled/low-camera and resolution cases preserve projected feet/tail, floor guard, and builder shader hook`);
