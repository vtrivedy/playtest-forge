import * as THREE from 'three';

export function applyStylizedIslandLights(scene: THREE.Scene): void {
  const hemi = new THREE.HemisphereLight(0x9ad0ff, 0x3a6040, 0.7);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff0d0, 2.4);
  key.position.set(8, 16, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 60;
  key.shadow.camera.left = -20;
  key.shadow.camera.right = 20;
  key.shadow.camera.top = 20;
  key.shadow.camera.bottom = -20;
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.04;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x88c0ff, 0.55);
  fill.position.set(-10, 6, -8);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffaa88, 0.4);
  rim.position.set(0, 4, -12);
  scene.add(rim);
}
