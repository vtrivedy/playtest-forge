/** Chase-camera cutout scoped to actual sight blockers. DESIGN-opening-paint.md. */
import * as THREE from 'three';

type OwnedMaterial = { mesh: THREE.Mesh; original: THREE.Material | THREE.Material[]; clones: THREE.Material[] };
type Blocker = { root: THREE.Object3D; meshes: THREE.Mesh[]; owned: OwnedMaterial[]; ink: Array<{ mesh: THREE.Object3D; visible: boolean }>; fade: number };

export function createOpeningOcclusion(roots: THREE.Object3D[]) {
  const seen = new Set<THREE.Mesh>();
  const blockers: Blocker[] = roots.map((root) => {
    const meshes: THREE.Mesh[] = [];
    const ink: Blocker['ink'] = [];
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || seen.has(mesh)) return;
      seen.add(mesh);
      if (mesh.userData.ink) ink.push({ mesh, visible: mesh.visible });
      else meshes.push(mesh);
    });
    return { root, meshes, ink, owned: [], fade: 0 };
  });
  const owner = new Map<THREE.Object3D, Blocker>();
  const meshes = blockers.flatMap((b) => b.meshes);
  for (const b of blockers) for (const mesh of b.meshes) owner.set(mesh, b);
  const ray = new THREE.Raycaster();
  const target = new THREE.Vector3();
  const lens = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const right = new THREE.Vector3();
  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  const hidden = new Set<Blocker>();

  function own(b: Blocker) {
    if (b.owned.length) return;
    for (const mesh of b.meshes) {
      const original = mesh.material;
      const sources = Array.isArray(original) ? original : [original];
      const clones = sources.map((src) => {
        const m = src.clone();
        // Three Material.clone does not retain custom shader callbacks.
        m.onBeforeCompile = src.onBeforeCompile;
        m.customProgramCacheKey = src.customProgramCacheKey;
        m.transparent = true;
        m.depthWrite = false;
        return m;
      });
      mesh.material = Array.isArray(original) ? clones : clones[0]!;
      b.owned.push({ mesh, original, clones });
    }
  }

  return {
    /** Call after player.step has placed the chase camera. Roots must exclude fox and terrain. */
    update(dt: number, camera: THREE.Camera, feet: THREE.Vector3) {
      hidden.clear();
      camera.getWorldPosition(lens);
      target.copy(feet).y += 0.45;
      direction.subVectors(target, lens);
      const distance = direction.length();
      if (distance > 0.5) {
        right.crossVectors(direction, camera.up).normalize().multiplyScalar(0.42);
        // Cover the body and ears, including a wall grazing the outer silhouette.
        for (const height of [0.2, 0.72]) for (const offset of [-1, 0, 1]) {
          from.copy(lens).addScaledVector(right, offset);
          to.copy(target).addScaledVector(right, offset);
          to.y = feet.y + height;
          direction.subVectors(to, from).normalize();
          // Cast both ways so a camera inside a closed cottage still sees its outward-facing wall.
          for (let side = 0; side < 2; side++) {
            ray.set(side ? to : from, side ? direction.clone().negate() : direction);
            ray.near = 0.08;
            ray.far = distance - 0.18;
            for (const hit of ray.intersectObjects(meshes, false)) {
              const b = owner.get(hit.object);
              if (b?.root.visible && hit.object.visible) hidden.add(b);
            }
          }
        }
      }
      for (const b of blockers) {
        b.fade = THREE.MathUtils.damp(b.fade, hidden.has(b) ? 1 : 0, hidden.has(b) ? 14 : 9, dt);
        if (b.fade < 0.002 && !hidden.has(b)) b.fade = 0;
        if (b.fade > 0) own(b);
        for (const { original, clones } of b.owned) {
          const src = Array.isArray(original) ? original : [original];
          clones.forEach((m, i) => {
            m.opacity = src[i]!.opacity * (1 - b.fade * 0.88);
            // Fully recovered props write depth again; no permanent translucent sorting artifacts.
            const transparent = b.fade > 0 || src[i]!.transparent;
            if (m.transparent !== transparent) { m.transparent = transparent; m.needsUpdate = true; }
            m.depthWrite = b.fade > 0 ? false : src[i]!.depthWrite;
          });
        }
        for (const h of b.ink) h.mesh.visible = h.visible && b.fade < 0.2;
      }
    },
    state() {
      return { occluders: blockers.length, faded: blockers.filter((b) => b.fade > 0.05).length };
    },
    dispose() {
      for (const b of blockers) {
        for (const { mesh, original, clones } of b.owned) {
          mesh.material = original;
          clones.forEach((m) => m.dispose());
        }
        for (const h of b.ink) h.mesh.visible = h.visible;
      }
    },
  };
}
