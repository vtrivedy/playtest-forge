import * as THREE from 'three';
import type { CollisionWorld } from './collision';

/** Review course is opt-in and shares the actual gameplay collision/controller. */
export function createGaitGym(scene: THREE.Scene, collision: CollisionWorld) {
  const origin = 600;
  const slope = Math.tan(Math.PI / 12);
  const height = (x: number) => {
    const d = x - origin;
    return d < 55 ? 0 : d < 67 ? (d - 55) * slope : d < 73 ? 12 * slope : d < 85 ? (85 - d) * slope : 0;
  };
  const terrain = collision.terrain;
  collision.terrain = (x, z) => Math.abs(z) < 20 && x > origin - 50 && x < origin + 150 ? height(x) : terrain(x, z);
  const geometry = new THREE.PlaneGeometry(200, 40, 200, 1);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(origin + 50, 0, 0);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) positions.setY(i, height(positions.getX(i)));
  geometry.computeVertexNormals();
  const ground = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x8b7961, roughness: 0.96 }));
  ground.receiveShadow = true;
  scene.add(ground);
  const markers = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: 0xc9b794, roughness: 1 });
  for (let d = -40; d <= 145; d += 1) {
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.008, d % 5 === 0 ? 1 : 0.35), material);
    mark.position.set(origin + d, height(origin + d) + 0.008, 1.4);
    markers.add(mark);
  }
  scene.add(markers);
  return { spawn: new THREE.Vector3(origin, 0, 0), height };
}
