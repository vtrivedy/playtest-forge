import * as THREE from 'three';

/**
 * Keeps the fox readable behind ruins, arches, rock and maple crowns.
 *
 * Russetvale merges geometry per material, so fading a material would fade every
 * arch in the realm. Instead every world material gets a screen-space dithered
 * cutout: fragments that sit in front of the fox, inside a fox-sized circle on
 * screen, are stippled away. The cutout only opens when the camera→fox sight
 * line is actually blocked (collision march + canopy raycast).
 */
export function createOcclusionFader(
  scene: THREE.Scene,
  opts: {
    /** Highest solid surface at (x,z) — terrain + ruins + rocks */
    solidAt: (x: number, z: number) => number;
    /** Subtree that must never be cut (the fox) */
    exclude?: THREE.Object3D;
  },
) {
  // x,y = centre of the fox's projected bounds (framebuffer px), z = fox view depth (m); radii in px
  const uOccFox = { value: new THREE.Vector4(0, 0, 0, 1) };
  const uOccRad = { value: new THREE.Vector2(1, 1) };
  const uOccStrength = { value: 0 };
  const patched = new WeakSet<THREE.Material>();

  function patch(mat: THREE.MeshStandardMaterial) {
    if (patched.has(mat)) return;
    patched.add(mat);
    const prev = mat.onBeforeCompile;
    const prevKey = mat.customProgramCacheKey();
    mat.onBeforeCompile = (shader, renderer) => {
      prev.call(mat, shader, renderer);
      shader.uniforms.uOccFox = uOccFox;
      shader.uniforms.uOccStrength = uOccStrength;
      shader.uniforms.uOccRad = uOccRad;
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform vec4 uOccFox;
          uniform vec2 uOccRad;
          uniform float uOccStrength;`,
        )
        .replace(
          '#include <clipping_planes_fragment>',
          `#include <clipping_planes_fragment>
          if (uOccStrength > 0.001) {
            float occR = length((gl_FragCoord.xy - uOccFox.xy) / uOccRad);
            float occNear = uOccFox.z - vViewPosition.z; // vViewPosition = -mvPosition → +depth
            // soft-edged ellipse fitted to the fox; nearby geometry counts from 0.45 m in front
            float occCut = uOccStrength * (1.0 - smoothstep(0.45, 1.0, occR)) * smoothstep(0.45, 1.2, occNear);
            // 4x4 Bayer stipple — no sorting, no blending, keeps a ghost of the occluder
            vec2 occP = mod(floor(gl_FragCoord.xy), 4.0);
            vec2 occLo = mod(occP, 2.0);
            vec2 occHi = floor(occP * 0.5);
            float occB = (4.0 * mod(2.0 * occLo.x + 3.0 * occLo.y, 4.0) + mod(2.0 * occHi.x + 3.0 * occHi.y, 4.0) + 0.5) / 16.0;
            if (occB < occCut * 0.72) discard; // keep ~28 % of the occluder as a ghost
          }`,
        );
    };
    mat.customProgramCacheKey = () => `${prevKey}|occ-cutout`;
    mat.needsUpdate = true;
  }

  function patchScene() {
    const skip = new Set<THREE.Object3D>();
    opts.exclude?.traverse((o) => skip.add(o));
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || skip.has(o)) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) if ((m as THREE.MeshStandardMaterial)?.isMeshStandardMaterial) patch(m as THREE.MeshStandardMaterial);
    });
  }
  patchScene();

  const canopies: THREE.Object3D[] = [];
  scene.traverse((o) => {
    if (o.userData?.isOccluder && (o as THREE.Mesh).isMesh) canopies.push(o);
  });

  const ray = new THREE.Raycaster();
  const chest = new THREE.Vector3();
  const head = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const pt = new THREE.Vector3();
  const ndc = new THREE.Vector3();
  const size = new THREE.Vector2();
  let blockedHold = 0;
  let frame = 0;
  let lastBlocked = false;

  function sightBlocked(cam: THREE.Vector3, target: THREE.Vector3): boolean {
    dir.copy(target).sub(cam);
    const dist = dir.length();
    if (dist < 0.3) return false;
    // solid geometry (terrain lip, ruin walls, arches, boulders): march the sight line
    const steps = Math.ceil(dist / 0.35);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (dist * (1 - t) < 0.7) break; // ignore the fox's own footing
      pt.lerpVectors(cam, target, t);
      if (opts.solidAt(pt.x, pt.z) > pt.y + 0.05) return true;
    }
    // maple crowns: raycast (throttled by the caller)
    dir.multiplyScalar(1 / dist);
    ray.set(cam, dir);
    ray.far = dist - 0.6;
    return ray.intersectObjects(canopies, false).length > 0;
  }

  return {
    patchScene,
    /** Current cutout strength 0..1 (debug / metrics) */
    get strength() {
      return uOccStrength.value;
    },
    update(
      dt: number,
      camera: THREE.PerspectiveCamera,
      renderer: THREE.WebGLRenderer,
      foxPos: THREE.Vector3,
      foxHeight: number,
      foxYaw: number,
    ) {
      camera.updateMatrixWorld();
      chest.copy(foxPos).y += foxHeight * 0.45;
      head.copy(foxPos).y += foxHeight * 1.05;
      // sight test every other frame (canopy raycast is the expensive part)
      if ((frame++ & 1) === 0) lastBlocked = sightBlocked(camera.position, chest) || sightBlocked(camera.position, head);
      if (lastBlocked) blockedHold = 0.35;
      else blockedHold -= dt;
      const goal = blockedHold > 0 ? 1 : 0;
      uOccStrength.value = THREE.MathUtils.damp(uOccStrength.value, goal, goal > uOccStrength.value ? 10 : 4, dt);

      // screen bounds of the fox: feet, ears, snout and tail tip
      renderer.getDrawingBufferSize(size);
      const fx = Math.sin(foxYaw);
      const fz = Math.cos(foxYaw);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const [along, up] of [[0, 0], [0, 1.05], [0.75, 0.6], [-1.1, 0.5], [0.4, 0], [-0.5, 0]] as const) {
        ndc.set(foxPos.x + fx * along, foxPos.y + foxHeight * up, foxPos.z + fz * along).project(camera);
        const px = (ndc.x * 0.5 + 0.5) * size.x;
        const py = (ndc.y * 0.5 + 0.5) * size.y;
        x0 = Math.min(x0, px); x1 = Math.max(x1, px);
        y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      }
      const pad = size.y * 0.03;
      uOccRad.value.set(Math.max(size.y * 0.05, (x1 - x0) * 0.62 + pad), Math.max(size.y * 0.05, (y1 - y0) * 0.62 + pad));
      const depth = chest.applyMatrix4(camera.matrixWorldInverse).z * -1;
      uOccFox.value.set((x0 + x1) * 0.5, (y0 + y1) * 0.5, depth, 1);
    },
  };
}
