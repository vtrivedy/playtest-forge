import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

export async function tryLoadGlb(url: string): Promise<THREE.Group | null> {
  try {
    const gltf = await loader.loadAsync(url);
    const root = gltf.scene;
    root.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });
    return root;
  } catch {
    return null;
  }
}

export function collectStandardMats(root: THREE.Object3D, out: THREE.MeshStandardMaterial[]): void {
  root.traverse((c) => {
    if (!(c as THREE.Mesh).isMesh) return;
    const m = (c as THREE.Mesh).material;
    const list = Array.isArray(m) ? m : [m];
    for (const mat of list) {
      if (mat && (mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
        const sm = mat as THREE.MeshStandardMaterial;
        if (!out.includes(sm)) out.push(sm);
      }
    }
  });
}

/** Place a GLB with feet on yAt, scaled so height ≈ targetH. */
export function placeGlb(
  src: THREE.Object3D,
  x: number,
  z: number,
  yAt: (x: number, z: number) => number,
  targetH: number,
  yaw = 0,
): THREE.Group {
  const tree = src.clone(true);
  const box = new THREE.Box3().setFromObject(tree);
  const size = new THREE.Vector3();
  box.getSize(size);
  const s = targetH / Math.max(size.y, 0.001);
  tree.scale.setScalar(s);
  box.setFromObject(tree);
  const y = yAt(x, z);
  tree.position.set(x, y - box.min.y, z);
  tree.rotation.y = yaw;
  const g = new THREE.Group();
  g.add(tree);
  return g;
}
