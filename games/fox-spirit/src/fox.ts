import * as THREE from 'three';
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

function tuneMaterials(root: THREE.Object3D) {
  root.traverse((c) => {
    if (!(c as THREE.Mesh).isMesh) return;
    const mesh = c as THREE.Mesh;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const mats = mesh.material;
    const list = Array.isArray(mats) ? mats : mats ? [mats] : [];
    for (const raw of list) {
      const mat = raw as THREE.MeshStandardMaterial;
      if (!mat?.isMeshStandardMaterial) continue;
      const n = (mat.name || mesh.name || '').toLowerCase();

      if (n.includes('spiritwisp') || n.includes('spirit_wisp') || n.includes('emberwisp')) {
        // Authored amber maps — white emissive so ACES doesn't turn FX crimson
        mat.color.setHex(0xffffff);
        mat.emissive = new THREE.Color(0xffffff);
        const isGlow = n.includes('glow');
        mat.emissiveIntensity = isGlow ? 0.35 : Math.min(mat.emissiveIntensity || 0.7, 0.7);
        mat.transparent = true;
        mat.depthWrite = false;
        mat.toneMapped = true;
        // Flame / glow cards are light, not matter: the shadow pass ignores blend alpha, so they would
        // stamp full dark quads over the tail and body
        mesh.castShadow = false;
        if (mat.emissiveMap) mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
        if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
        if (isGlow) {
          mat.opacity = Math.min(mat.opacity ?? 1, 0.55);
          mat.side = THREE.FrontSide; // stop back-face flank hotspot
        }
      } else if (n.includes('embertail') || (n.includes('ember') && n.includes('tail')) || n === 'embertail') {
        mat.color.setHex(0xffffff);
        mat.emissive = new THREE.Color(0xffffff);
        mat.emissiveIntensity = Math.min(mat.emissiveIntensity || 0.55, 0.6);
        mat.transparent = true;
        mat.opacity = 0.95;
        mat.depthWrite = true;
        mat.toneMapped = true;
        if (mat.emissiveMap) mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
        if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
      } else if (n.includes('fur tuft') || n === 'furtufts') {
        mat.color.setHex(0xffffff);
        mat.emissive = new THREE.Color(0xffffff);
        mat.emissiveIntensity = 0.25;
        mat.transparent = true;
        mat.opacity = 0.9;
        mat.toneMapped = true;
      } else if (n.includes('eye')) {
        mat.color.setHex(0xffffff);
        mat.emissive = new THREE.Color(0xffe08a);
        mat.emissiveIntensity = Math.min(mat.emissiveIntensity || 0.5, 0.65);
      } else if (n.includes('nose')) {
        mat.color.setHex(0xffffff);
        if (mat.emissive) mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      } else if (n.includes('foxfur') || n.includes('fur') || n === 'cube') {
        // Keep fox_fur_col 1:1 so cream bib + umber socks survive.
        mat.color.setHex(0xffffff);
        mat.roughness = 0.62;
        if (mat.emissive) mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
        mat.map && (mat.map.colorSpace = THREE.SRGBColorSpace);
      } else {
        if (mat.map) {
          mat.color.setHex(0xffffff);
          mat.map.colorSpace = THREE.SRGBColorSpace;
        }
        if (mat.emissive && mat.emissiveIntensity > 0.8) {
          mat.emissiveIntensity = 0.4;
        }
      }
    }
  });
}

function proceduralFox(): FoxActor {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xc45a1a, roughness: 0.55 });
  const bellyMat = new THREE.MeshStandardMaterial({ color: 0xf0e2cc, roughness: 0.65 });
  const sockMat = new THREE.MeshStandardMaterial({ color: 0x2a1c14, roughness: 0.7 });
  const emberMat = new THREE.MeshStandardMaterial({
    color: 0xff6a1a,
    emissive: 0xff3a00,
    emissiveIntensity: 0.7,
    roughness: 0.25,
  });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.55, 6, 12), bodyMat);
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), bellyMat);
  belly.position.set(0.02, -0.08, 0.06);
  belly.scale.set(1.15, 0.8, 1.25);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 14), bodyMat);
  head.position.set(0.42, 0.12, 0);
  head.scale.set(1.0, 0.9, 0.85);
  head.castShadow = true;
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.2, 6), bellyMat);
  snout.rotation.z = -Math.PI / 2;
  snout.position.set(0.58, 0.08, 0);
  const earL = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 5), bodyMat);
  earL.position.set(0.38, 0.32, 0.07);
  const earR = earL.clone();
  earR.position.z = -0.07;
  const legFL = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.22, 3, 6), sockMat);
  legFL.position.set(0.2, -0.32, 0.09);
  const legFR = legFL.clone();
  legFR.position.z = -0.09;
  const legBL = legFL.clone();
  legBL.position.set(-0.2, -0.32, 0.09);
  const legBR = legFL.clone();
  legBR.position.set(-0.2, -0.32, -0.09);
  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.7, 5, 10), bodyMat);
  tail.position.set(-0.55, 0.15, 0);
  tail.rotation.z = 0.7;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), emberMat);
  tip.position.set(-1.05, 0.55, 0);
  group.add(body, belly, head, snout, earL, earR, legFL, legFR, legBL, legBR, tail, tip);

  let anim = 'idle';
  let gaitT = 0;
  let rate = 10;
  const feetOffset = 0.38;
  return {
    group,
    feetOffset,
    height: 0.7,
    hasClips: false,
    setFacing(yaw) {
      group.rotation.y = yaw;
    },
    pulse() {},
    update(dt, _t, gliding) {
      gaitT += dt * rate;
      tail.rotation.z = 0.7 + Math.sin(gaitT * 0.32) * 0.12 + (gliding ? 0.2 : 0);
      const gait = anim === 'run' ? Math.sin(gaitT) : 0;
      legFL.rotation.x = gait * 0.55;
      legBR.rotation.x = gait * 0.55;
      legFR.rotation.x = -gait * 0.55;
      legBL.rotation.x = -gait * 0.55;
    },
    setAnim(name) {
      anim = name;
    },
    setTimeScale(k) {
      rate = 10 * k;
    },
    clipDuration: () => 0,
    getAnim() {
      return anim;
    },
    setSpiritFxVisible() {},
  };
}

export async function createFox(): Promise<FoxActor> {
  const fallback = proceduralFox();
  try {
    const gltf = await new GLTFLoader().loadAsync('/assets/hero/spirit_fox.glb');
    const root = gltf.scene;
    tuneMaterials(root);

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
      if (prev) prev.crossFadeTo(next, fade, false);
      else next.fadeIn(fade);
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
      update(dt, _t, _gliding) {
        foxLight.intensity += (0.35 - foxLight.intensity) * Math.min(1, 8 * dt);
        locomotion.beforeMixer();
        locomotion.blend(dt, current);
        mixer.update(dt);
        locomotion.afterMixer(dt, current);
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
      },
    };
  } catch (err) {
    console.warn('[fox] GLB load failed, using procedural', err);
    return fallback;
  }
}
