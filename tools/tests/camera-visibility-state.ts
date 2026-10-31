/** CPU-only material/state isolation. Stub methods never render or create a GL context. */
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCameraVisibilityProbe } from '../../games/fox-spirit/src/cameraVisibility';

const scene = new THREE.Scene(), fox = new THREE.Group();
const originalShader = { uniforms: { sentinel: { value: 7 } } };
const metadata = { colorFieldShader: originalShader, expensive: { toJSON() { throw Error('Live shader metadata serialized'); } } };
const body = new THREE.MeshStandardMaterial(); body.userData = metadata;
body.onBeforeCompile = shader => {
  body.userData.colorFieldShader = shader;
  body.userData.probeOnly = true;
};
const worldMaterial = new THREE.MeshStandardMaterial({ opacity: .73 });
const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(), body);
const worldMesh = new THREE.Mesh(new THREE.BoxGeometry(), worldMaterial);
fox.add(bodyMesh); scene.add(fox, worldMesh);
scene.background = new THREE.Color(0x765432);
const background = scene.background, viewport = new THREE.Vector4(2, 3, 8, 9), scissor = new THREE.Vector4(1, 2, 5, 6);
const originalViewport = viewport.clone(), originalScissor = scissor.clone();
const clearColor = new THREE.Color(0x102030), originalClear = clearColor.clone();
let clearAlpha = .4, scissorEnabled = true;
let target: THREE.WebGLRenderTarget | null = null, renders = 0, failRender = false;
const draws: THREE.Material[][] = [];
const stub = {
  autoClear: false, shadowMap: { autoUpdate: true, needsUpdate: true },
  getDrawingBufferSize: (out: THREE.Vector2) => out.set(2, 2),
  getRenderTarget: () => target, getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0,
  getViewport: (out: THREE.Vector4) => out.copy(viewport), getScissor: (out: THREE.Vector4) => out.copy(scissor),
  getScissorTest: () => scissorEnabled, getClearColor: (out: THREE.Color) => out.copy(clearColor), getClearAlpha: () => clearAlpha,
  setRenderTarget: (value: THREE.WebGLRenderTarget | null) => { target = value; },
  setClearColor(value: THREE.Color | number, alpha: number) { typeof value === 'number' ? clearColor.setHex(value) : clearColor.copy(value); clearAlpha = alpha; },
  setScissorTest(value: boolean) { scissorEnabled = value; },
  setViewport(value: THREE.Vector4 | number, y?: number, w?: number, h?: number) { typeof value === 'number' ? viewport.set(value, y!, w!, h!) : viewport.copy(value); },
  setScissor(value: THREE.Vector4) { scissor.copy(value); }, clear() {},
  render() {
    renders++;
    const materials = [bodyMesh.material, worldMesh.material]; draws.push(materials);
    for (const material of materials) if (material.visible) {
      assert.equal(material.blending, THREE.NoBlending);
      assert.equal(material.transparent, false);
      const shader = { fragmentShader: 'void main() { gl_FragColor = vec4(0.5); }', vertexShader: '', uniforms: {} };
      material.onBeforeCompile(shader as never, stub as unknown as THREE.WebGLRenderer);
      assert.match(shader.fragmentShader, /gl_FragColor = vec4\(vec3\([01]\.0\), 1\.0\)/);
      if (failRender) throw Error('Deliberate stub render failure');
    }
  },
  readRenderTargetPixels(_target: unknown, _x: number, _y: number, _w: number, _h: number, data: Uint8Array) {
    data.fill(0); data[0] = 255; data[3] = 255;
  },
  getContext: () => ({ getError: () => 0 }),
};
const probe = createCameraVisibilityProbe(scene, stub as unknown as THREE.WebGLRenderer, new THREE.PerspectiveCamera(), fox);
const result = probe.measure();
assert.equal(result.fraction, 1); assert.equal(renders, 2);
assert.equal(body.userData, metadata); assert.equal(body.userData.colorFieldShader, originalShader);
assert.equal('probeOnly' in body.userData, false);
assert.equal(bodyMesh.material, body); assert.equal(worldMesh.material, worldMaterial);
assert.equal(scene.background, background); assert.equal(target, null);
assert.equal(stub.autoClear, false); assert.deepEqual(stub.shadowMap, { autoUpdate: true, needsUpdate: true });
assert.deepEqual(viewport, originalViewport); assert.deepEqual(scissor, originalScissor); assert.equal(scissorEnabled, true);
assert.deepEqual(clearColor, originalClear); assert.equal(clearAlpha, .4);
assert.equal(draws[0]![1]!.visible, false, 'amodal pass excludes the world');
assert.equal(draws[1]![1]!.opacity, .73, 'render properties copy without serializing metadata');
worldMaterial.opacity = .41;
probe.measure();
assert.equal(draws[3]![1]!.opacity, .41, 'cached mask refreshes live material values');
assert.equal(body.userData.colorFieldShader, originalShader);
failRender = true;
assert.throws(() => probe.measure(), /Deliberate stub render failure/);
assert.equal(body.userData, metadata); assert.equal(body.userData.colorFieldShader, originalShader);
assert.equal('probeOnly' in body.userData, false);
assert.equal(bodyMesh.material, body); assert.equal(worldMesh.material, worldMaterial);
assert.equal(target, null); assert.equal(scene.background, background);
assert.deepEqual(viewport, originalViewport); assert.deepEqual(scissor, originalScissor); assert.equal(scissorEnabled, true);
assert.deepEqual(clearColor, originalClear); assert.equal(clearAlpha, .4);
probe.dispose();
console.log('PASS: CPU-only visibility material copies skip live metadata; hooks and renderer state restore');
