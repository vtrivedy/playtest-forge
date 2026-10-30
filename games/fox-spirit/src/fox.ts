import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type FoxAnimState =
  | 'idle'
  | 'run'
  | 'jump_up'
  | 'jump_apex'
  | 'jump_fall'
  | 'land'
  | 'glide'
  | 'dash'
  | 'burst';

export type FoxActor = {
  group: THREE.Group;
  /** Approximate feet offset below group origin */
  feetOffset: number;
  /** World-space height of the scaled mesh (for camera / shadows) */
  height: number;
  setFacing: (yaw: number) => void;
  squash: (x: number, y: number, z: number) => void;
  relaxScale: (dt: number) => void;
  /** Advance mixer + secondary motion. Call every frame. */
  update: (dt: number, t: number, gliding: boolean) => void;
  /** Crossfade to a named clip (must exist on the GLB). */
  setAnim: (name: FoxAnimState, fadeS?: number) => void;
  /** Currently playing clip name (best-effort). */
  getAnim: () => string;
  /** True when GLB clips are driving the skeleton. */
  hasClips: boolean;
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

      if (n.includes('embertail') || (n.includes('ember') && n.includes('tail')) || n === 'embertail') {
        // Big bushy ember tip — glow, but not a bloom orb
        mat.color.setHex(0xffffff); // respect authored tail_col map
        mat.emissive = new THREE.Color(0xff6a22);
        mat.emissiveIntensity = 0.55;
        mat.roughness = 0.45;
        mat.transparent = true;
        mat.opacity = 0.95;
        mat.depthWrite = true;
        mat.toneMapped = true;
      } else if (n.includes('emberwisp') || n.includes('wisp') || n.includes('fur tuft') || n === 'furtufts') {
        mat.color.setHex(0xffffff);
        mat.emissive = new THREE.Color(0xff5520);
        mat.emissiveIntensity = 0.35;
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
        // Keep fox_fur_col texture (russet + white belly + black socks). Only gentle warm tint.
        mat.color.setHex(0xffe0c8);
        mat.roughness = 0.62;
        if (mat.emissive) mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
        mat.map && (mat.map.colorSpace = THREE.SRGBColorSpace);
      } else {
        // Unknown: don't nuke albedo maps
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
  const feetOffset = 0.38;
  return {
    group,
    feetOffset,
    height: 0.7,
    hasClips: false,
    setFacing(yaw) {
      group.rotation.y = yaw;
    },
    squash(x, y, z) {
      group.scale.set(x, y, z);
    },
    relaxScale(dt) {
      group.scale.x += (1 - group.scale.x) * Math.min(1, 12 * dt);
      group.scale.y += (1 - group.scale.y) * Math.min(1, 12 * dt);
      group.scale.z += (1 - group.scale.z) * Math.min(1, 12 * dt);
    },
    update(_dt, t, gliding) {
      tail.rotation.z = 0.7 + Math.sin(t * 3.2) * 0.12 + (gliding ? 0.2 : 0);
      const gait = Math.sin(t * 10);
      legFL.rotation.x = gait * 0.55;
      legBR.rotation.x = gait * 0.55;
      legFR.rotation.x = -gait * 0.55;
      legBL.rotation.x = -gait * 0.55;
    },
    setAnim(name) {
      anim = name;
    },
    getAnim() {
      return anim;
    },
  };
}

export async function createFox(): Promise<FoxActor> {
  const fallback = proceduralFox();
  try {
    const gltf = await new GLTFLoader().loadAsync('/assets/hero/spirit_fox.glb');
    const root = gltf.scene;
    tuneMaterials(root);

    // Scale by height so the slender quadruped proportions stay — not max-axis (was puffing width)
    const box0 = new THREE.Box3().setFromObject(root);
    const size0 = new THREE.Vector3();
    box0.getSize(size0);
    const targetHeight = 1.05; // ~keyart fox at gameplay scale
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
      const once = /jump_|land|burst|dash/.test(clip.name);
      act.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
      if (once) act.clampWhenFinished = true;
      actions.set(clip.name, act);
    }

    let current = '';
    const play = (name: string, fade = 0.18) => {
      if (!actions.has(name)) return;
      if (current === name) return;
      const next = actions.get(name)!;
      const prev = current ? actions.get(current) : undefined;
      next.reset().fadeIn(fade).play();
      prev?.fadeOut(fade);
      current = name;
    };

    // Prefer idle bind if present so legs aren't frozen mid-clip before first update
    if (actions.has('idle')) play('idle', 0);
    else if (actions.has('run')) play('run', 0);

    const height = targetHeight;
    return {
      group,
      feetOffset: 0.02,
      height,
      hasClips: actions.size > 0,
      setFacing(yaw) {
        group.rotation.y = yaw;
      },
      squash(x, y, z) {
        // Don't squash the skinned mesh (destroys silhouette) — pulse light instead
        foxLight.intensity = 0.35 * y;
        void x;
        void z;
      },
      relaxScale(dt) {
        foxLight.intensity += (0.35 - foxLight.intensity) * Math.min(1, 8 * dt);
      },
      update(dt, _t, _gliding) {
        mixer.update(dt);
      },
      setAnim(name, fadeS = 0.18) {
        play(name, fadeS);
      },
      getAnim() {
        return current || 'none';
      },
    };
  } catch (err) {
    console.warn('[fox] GLB load failed, using procedural', err);
    return fallback;
  }
}
