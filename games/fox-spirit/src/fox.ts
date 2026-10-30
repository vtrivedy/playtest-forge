import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { applyFoxLook, createSpiritFx } from './foxLook';
import { createLocomotion, type Locomotion, type LocoInput } from './locomotion/locomotion';

export type FoxActor = {
  group: THREE.Group;
  /** Approximate feet offset below group origin */
  feetOffset: number;
  /** World-space height of the scaled mesh (for camera / shadows) */
  height: number;
  setFacing: (yaw: number) => void;
  /** Ember-light pulse (1 = rest). */
  pulse: (k: number) => void;
  /** Runtime quadruped locomotion (gait, foot IK, body, tail). Tunables in `loco.params`. */
  loco: Locomotion;
  /** Pose the skeleton for this frame. Call every frame after the group has its final position + heading. */
  update: (dt: number, input: LocoInput) => void;
  /** Toggle authored spirit FX meshes (wisps / flame / glow cards). Particles stay in main.ts. */
  setSpiritFxVisible: (on: boolean) => void;
};

export async function createFox(groundAt: (x: number, z: number, refY: number) => number): Promise<FoxActor> {
  const gltf = await new GLTFLoader().loadAsync('/assets/hero/spirit_fox.glb');
  const root = gltf.scene;
  applyFoxLook(root);

  const spiritFxMeshes: THREE.Object3D[] = [];
  root.traverse((c) => {
    if (!(c as THREE.Mesh).isMesh) return;
    const nm = (c.name || '').toLowerCase();
    const mats = (c as THREE.Mesh).material;
    const list = Array.isArray(mats) ? mats : mats ? [mats] : [];
    const matNames = list.map((m) => ((m as THREE.Material).name || '').toLowerCase()).join(' ');
    if (
      nm.includes('spiritfx') ||
      nm.includes('wisps') ||
      matNames.includes('spiritwisp') ||
      matNames.includes('emberwisp')
    ) {
      spiritFxMeshes.push(c);
    }
  });

  // Proportions (plume tail, snout, ears, fur shells) are authored in the GLB
  // by the Opus Blender pass — do not re-inflate meshes/bones here.

  // Scale by height so the slender quadruped proportions stay — not max-axis (was puffing width)
  const box0 = new THREE.Box3().setFromObject(root);
  const size0 = new THREE.Vector3();
  box0.getSize(size0);
  const targetHeight = 1.25; // ~keyart fox at gameplay scale
  const s = targetHeight / Math.max(size0.y, 0.001);
  root.scale.setScalar(s);

  const box = new THREE.Box3().setFromObject(root);
  const center = new THREE.Vector3();
  box.getCenter(center);
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= box.min.y;

  const group = new THREE.Group();
  group.add(root);
  const spiritFx = createSpiritFx(root, group);
  let clock = 0;

  // Soft key — low intensity so silhouette still reads with FX off
  const foxLight = new THREE.PointLight(0xff8844, 0.35, 4.5);
  foxLight.position.set(0.2, 0.55, 0.4);
  group.add(foxLight);

  // The GLB's authored clips are not used: every pose is built at runtime by the locomotion system.
  const loco = createLocomotion(group, groundAt, 0.02);

  return {
    group,
    feetOffset: 0.02,
    height: targetHeight,
    loco,
    setFacing(yaw) {
      group.rotation.y = yaw;
    },
    pulse(k) {
      foxLight.intensity = 0.35 * k;
    },
    update(dt, input) {
      foxLight.intensity += (0.35 - foxLight.intensity) * Math.min(1, 8 * dt);
      loco.update(dt, input);
      clock += dt;
      spiritFx.update(dt, clock, input.gliding);
    },
    setSpiritFxVisible(on: boolean) {
      for (const m of spiritFxMeshes) m.visible = on;
      spiritFx.setVisible(on);
    },
  };
}
