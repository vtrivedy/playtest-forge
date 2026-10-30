import * as THREE from 'three';

/**
 * Fade maple/occluder meshes that sit between the camera and the fox
 * so the hero never disappears behind foliage.
 */
export function createOcclusionFader(scene: THREE.Scene) {
  const ray = new THREE.Raycaster();
  const dir = new THREE.Vector3();
  const faded = new Map<THREE.Material, { opacity: number; transparent: boolean; depthWrite: boolean }>();
  const hitSet = new Set<THREE.Material>();

  function collectOccluders(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if (o.userData?.isOccluder && (o as THREE.Mesh).isMesh) out.push(o);
    });
    return out;
  }

  let cache: THREE.Object3D[] = [];
  let cacheAge = 0;

  return {
    update(dt: number, camera: THREE.Camera, foxPos: THREE.Vector3) {
      cacheAge -= dt;
      if (cacheAge <= 0) {
        cache = collectOccluders();
        cacheAge = 1.2;
      }
      dir.copy(foxPos).add(new THREE.Vector3(0, 0.45, 0)).sub(camera.position);
      const dist = dir.length();
      if (dist < 0.05) return;
      dir.multiplyScalar(1 / dist);
      ray.set(camera.position, dir);
      ray.far = dist - 0.35;

      hitSet.clear();
      const hits = ray.intersectObjects(cache, false);
      for (const h of hits) {
        const mesh = h.object as THREE.Mesh;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          if (!m) continue;
          hitSet.add(m);
          if (!faded.has(m)) {
            faded.set(m, {
              opacity: (m as THREE.MeshStandardMaterial).opacity ?? 1,
              transparent: m.transparent,
              depthWrite: m.depthWrite,
            });
          }
          m.transparent = true;
          m.depthWrite = false;
          const cur = (m as THREE.MeshStandardMaterial).opacity ?? 1;
          (m as THREE.MeshStandardMaterial).opacity = THREE.MathUtils.lerp(cur, 0.18, Math.min(1, 10 * dt));
        }
      }

      // Restore materials no longer occluding
      for (const [m, orig] of [...faded.entries()]) {
        if (hitSet.has(m)) continue;
        const cur = (m as THREE.MeshStandardMaterial).opacity ?? 1;
        const next = THREE.MathUtils.lerp(cur, orig.opacity, Math.min(1, 6 * dt));
        (m as THREE.MeshStandardMaterial).opacity = next;
        if (Math.abs(next - orig.opacity) < 0.02) {
          m.transparent = orig.transparent;
          m.depthWrite = orig.depthWrite;
          (m as THREE.MeshStandardMaterial).opacity = orig.opacity;
          faded.delete(m);
        }
      }
    },
  };
}
