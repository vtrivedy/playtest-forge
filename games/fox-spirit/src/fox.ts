import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type FoxActor = {
  group: THREE.Group;
  /** Approximate feet offset below group origin */
  feetOffset: number;
  setFacing: (yaw: number) => void;
  squash: (x: number, y: number, z: number) => void;
  relaxScale: (dt: number) => void;
  updateTail: (t: number, gliding: boolean) => void;
};

function proceduralFox(): FoxActor {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xc45a1a,
    emissive: 0x000000,
    emissiveIntensity: 0,
    roughness: 0.55,
  });
  const bellyMat = new THREE.MeshStandardMaterial({ color: 0xf0e2cc, roughness: 0.65 });
  const sockMat = new THREE.MeshStandardMaterial({ color: 0x2a1c14, roughness: 0.7 });
  const emberMat = new THREE.MeshStandardMaterial({
    color: 0xff6a1a,
    emissive: 0xff3a00,
    emissiveIntensity: 1.1,
    roughness: 0.25,
  });
  const flameMat = new THREE.MeshStandardMaterial({
    color: 0xff8a2a,
    emissive: 0xff5500,
    emissiveIntensity: 0.9,
    roughness: 0.3,
    transparent: true,
    opacity: 0.92,
  });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 6, 12), bodyMat);
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), bellyMat);
  belly.position.set(0.02, -0.08, 0.08);
  belly.scale.set(1.1, 0.85, 1.2);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 14), bodyMat);
  head.position.set(0.4, 0.1, 0);
  head.scale.set(1.05, 0.95, 0.9);
  head.castShadow = true;
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 6), bellyMat);
  snout.rotation.z = -Math.PI / 2;
  snout.position.set(0.55, 0.05, 0);
  const earL = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 5), bodyMat);
  earL.position.set(0.38, 0.3, 0.08);
  earL.rotation.x = -0.25;
  const earR = earL.clone();
  earR.position.z = -0.08;
  const emberL = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), emberMat);
  emberL.position.set(0.38, 0.4, 0.08);
  const emberR = emberL.clone();
  emberR.position.z = -0.08;
  const legFL = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.14, 3, 6), sockMat);
  legFL.position.set(0.18, -0.28, 0.1);
  const legFR = legFL.clone();
  legFR.position.z = -0.1;
  const legBL = legFL.clone();
  legBL.position.set(-0.18, -0.28, 0.1);
  const legBR = legFL.clone();
  legBR.position.set(-0.18, -0.28, -0.1);
  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.55, 5, 10), bodyMat);
  tail.position.set(-0.5, 0.12, 0);
  tail.rotation.z = 0.55;
  tail.name = 'tail';
  const tailFlame = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.55, 7), flameMat);
  tailFlame.position.set(-0.85, 0.35, 0);
  tailFlame.rotation.z = 2.4;
  tailFlame.name = 'tailFlame';
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), emberMat);
  tip.position.set(-1.0, 0.48, 0);
  group.add(
    body, belly, head, snout, earL, earR, emberL, emberR,
    legFL, legFR, legBL, legBR, tail, tailFlame, tip,
  );
  const foxLight = new THREE.PointLight(0xff6622, 0.22, 3.2);
  foxLight.position.set(-0.85, 0.45, 0);
  group.add(foxLight);

  return {
    group,
    feetOffset: 0.35,
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
    updateTail(t, gliding) {
      tail.rotation.z = 0.55 + Math.sin(t * 3.2) * 0.12 + (gliding ? 0.2 : 0);
      tailFlame.rotation.z = 2.4 + Math.sin(t * 5.0) * 0.15;
    },
  };
}

export async function createFox(): Promise<FoxActor> {
  const fallback = proceduralFox();
  try {
    const gltf = await new GLTFLoader().loadAsync('/assets/hero/spirit_fox.glb');
    const root = gltf.scene;
    // Orient: many Blender exports face +Y or -Z; normalize to +Z forward, Y up
    root.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
        const mats = (c as THREE.Mesh).material;
        const list = Array.isArray(mats) ? mats : mats ? [mats] : [];
        for (const raw of list) {
          const mat = raw as THREE.MeshStandardMaterial;
          if (!mat || !mat.isMeshStandardMaterial) continue;
          const n = (mat.name || '').toLowerCase();
          // Emission only on ember tips / wisps — body stays lit by scene, not bloom-orb
          if (n.includes('ember') || n.includes('wisp') || n.includes('flame') || n.includes('tip')) {
            mat.emissive = mat.emissive ?? new THREE.Color(0xff3a00);
            mat.emissiveIntensity = 0.55;
            mat.toneMapped = true;
          } else if (n.includes('eye')) {
            mat.emissiveIntensity = Math.min(mat.emissiveIntensity ?? 0.3, 0.35);
          } else {
            // strip accidental body emission so silhouette reads under bloom
            if (mat.emissive) mat.emissive.setHex(0x000000);
            mat.emissiveIntensity = 0;
          }
        }
      }
    });
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    const targetLen = 1.85;
    const s = targetLen / Math.max(size.x, size.y, size.z, 0.001);
    root.scale.setScalar(s);
    box.setFromObject(root);
    const center = new THREE.Vector3();
    box.getCenter(center);
    root.position.sub(center);
    root.position.y -= box.min.y; // feet on origin
    const group = new THREE.Group();
    group.add(root);
    // Soft tip glow only — never wrap the whole body in bloom
    const foxLight = new THREE.PointLight(0xff6622, 0.18, 2.8);
    foxLight.position.set(-0.55, 0.55, 0); // near tail tip
    group.add(foxLight);
    const feetOffset = 0.02;
    return {
      group,
      feetOffset,
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
      updateTail(t, _gliding) {
        root.rotation.z = Math.sin(t * 2.5) * 0.03;
      },
    };
  } catch (err) {
    console.warn('[fox] GLB load failed, using procedural', err);
    return fallback;
  }
}
