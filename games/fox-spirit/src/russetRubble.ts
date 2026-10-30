import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Bucket, PAL, trs } from './russetKit';

/** Poly Haven rock_moss_set_01 (CC0): reuse scanned silhouettes, with the realm's quiet palette. */
export async function loadRubbleKit() {
  const gltf = await new GLTFLoader().loadAsync('/assets/library/models/nature/rock_moss_set_01.glb');
  const shapes: THREE.BufferGeometry[] = [];
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const g = object.geometry.clone().applyMatrix4(object.matrixWorld);
    g.computeBoundingBox();
    const box = g.boundingBox!;
    const centre = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    g.translate(-centre.x, -box.min.y, -centre.z);
    g.scale(1 / Math.max(size.x, size.z), 1 / Math.max(size.x, size.z), 1 / Math.max(size.x, size.z));
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    const colors = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const moss = THREE.MathUtils.smoothstep(n.getY(i), 0.2, 0.85);
      const c = PAL.rockGrey.clone().lerp(PAL.lichen, moss * 0.65);
      c.multiplyScalar(0.8 + moss * 0.15);
      c.toArray(colors, i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    shapes.push(g);
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose();
      material.dispose();
    }
  });
  return {
    place(bucket: Bucket, x: number, y: number, z: number, size: number, seed: number, flatten = 1) {
      const shape = shapes[((seed % shapes.length) + shapes.length) % shapes.length]!;
      bucket.add(shape, trs(x, y, z, seed * 2.39996, size, size * flatten, size));
    },
    dispose() { for (const shape of shapes) shape.dispose(); },
  };
}
