import * as THREE from 'three';
import { applyFoxLook, createSpiritFx } from './foxLook';
import { AuthoredLocomotion, type MotionInput } from './locomotion';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type FoxAnimState =
  | 'idle'
  | 'run'
  | 'walk'
  | 'trot'
  | 'turn_left'
  | 'turn_right'
  | 'skid'
  | 'jump_up'
  | 'jump_apex'
  | 'jump_fall'
  | 'land'
  | 'glide'
  | 'dash'
  | 'burst';

export type FoxActor = {
  group: THREE.Group;
  locomotion?: AuthoredLocomotion;
  setMotion?: (input: MotionInput) => void;
  /** Approximate feet offset below group origin */
  feetOffset: number;
  /** World-space height of the scaled mesh (for camera / shadows) */
  height: number;
  setFacing: (yaw: number) => void;
  /** Ember-light pulse (1 = rest). Squash/stretch lives in the camera, never on the mesh. */
  pulse: (k: number) => void;
  /** Advance mixer + secondary motion. Call every frame. */
  update: (dt: number, t: number, gliding: boolean) => void;
  /** Crossfade to a named clip (must exist on the GLB). Same clip = no restart. */
  setAnim: (name: FoxAnimState, fadeS?: number) => void;
  /** Playback rate of the current clip (run cadence follows ground speed). */
  setTimeScale: (s: number) => void;
  /** Clip length in seconds (0 when missing). */
  clipDuration: (name: FoxAnimState) => number;
  /** Currently playing clip name (best-effort). */
  getAnim: () => string;
  /** True when GLB clips are driving the skeleton. */
  hasClips: boolean;
  /** Toggle authored spirit FX meshes (wisps / flame / glow cards). Particles stay in main.ts. */
  setSpiritFxVisible: (on: boolean) => void;
};

export async function createFox(): Promise<FoxActor> {
  try {
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

    // Soft key — low intensity so silhouette still reads with FX off
    const foxLight = new THREE.PointLight(0xff8844, 0.35, 4.5);
    foxLight.position.set(0.2, 0.55, 0.4);
    group.add(foxLight);

    const mixer = new THREE.AnimationMixer(root);
    const actions = new Map<string, THREE.AnimationAction>();
    for (const clip of gltf.animations) {
      const act = mixer.clipAction(clip);
      act.enabled = true;
      // Loop continuous states; one-shots clamp
      const once = /^(jump_up|land|burst|skid)$/.test(clip.name);
      act.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
      if (once) act.clampWhenFinished = true;
      actions.set(clip.name, act);
    }

    const locomotion = new AuthoredLocomotion(root, group, actions);
    let current = '';
    const play = (name: string, fade = 0.18) => {
      if (!actions.has(name)) return;
      if (current === name) return;
      const next = actions.get(name)!;
      const prev = current ? actions.get(current) : undefined;
      next.reset().setEffectiveTimeScale(1).play();
      locomotion.fadeSeconds = fade;
      current = name;
    };

    // Prefer idle bind if present so legs aren't frozen mid-clip before first update
    if (actions.has('idle')) play('idle', 0);
    else if (actions.has('run')) play('run', 0);

    const height = targetHeight;
    return {
      group,
      locomotion,
      setMotion(input) { locomotion.input = input; },
      feetOffset: 0.02,
      height,
      hasClips: actions.size > 0,
      setFacing(yaw) {
        group.rotation.y = yaw;
      },
      pulse(k) {
        foxLight.intensity = 0.35 * k;
      },
      update(dt, t, gliding) {
        foxLight.intensity += (0.35 - foxLight.intensity) * Math.min(1, 8 * dt);
        locomotion.beforeMixer();
        locomotion.blend(dt, current);
        mixer.update(dt);
        locomotion.afterMixer(dt, current);
        spiritFx.update(dt, t, gliding);
      },
      setAnim(name, fadeS = 0.18) {
        play(name, fadeS);
      },
      setTimeScale(k) {
        const act = actions.get(current);
        if (act && current !== 'run') act.setEffectiveTimeScale(Number.isFinite(k) ? Math.max(0, k) : 1);
      },
      clipDuration(name) {
        return actions.get(name)?.getClip().duration ?? 0;
      },
      getAnim() {
        return current || 'none';
      },
      setSpiritFxVisible(on: boolean) {
        for (const m of spiritFxMeshes) m.visible = on;
        spiritFx.setVisible(on);
      },
    };
  } catch (err) {
    throw new Error('[fox] Authored hero failed to load', { cause: err });
  }
}
