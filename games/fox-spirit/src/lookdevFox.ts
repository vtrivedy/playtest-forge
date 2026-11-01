/**
 * Hearth-fox for the P0 lookdev ("Pressed Ink → Living Cel").
 *
 * Authored in Blender (tools/blender/scripts/hearth_fox_*.py) → assets/hero/hearth_fox.glb:
 * `fox_coat` (skinned, vertex-coloured coat; TEXCOORD_0.x = ember mask) + `fox_face` (eyes, nose),
 * clips idle / walk / run (in place; the rig's glTF extras carry each clip's ground speed).
 * Here: 3-band toon coat with warm rim, skinned inverted-hull ink, ember tail glow + flame tongues.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type FoxClip = 'idle' | 'walk' | 'run';

export interface HearthFox {
  root: THREE.Group;
  update: (dt: number) => void;
  setHeadYaw: (y: number) => void;
  /** crossfade to a clip; `travel` moves the root along its facing at the clip's authored speed */
  play: (clip: FoxClip, travel?: boolean) => void;
  readonly clip: FoxClip;
  readonly speed: number;
  /** world positions of the four paw contact points (skate metrics) */
  paws: () => Record<string, [number, number, number]>;
}

function toonRamp(stops: number[]): THREE.DataTexture {
  const data = new Uint8Array(stops.length * 4);
  stops.forEach((v, i) => data.set([v, v, v, 255], i * 4));
  const tex = new THREE.DataTexture(data, stops.length, 1, THREE.RGBAFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
/** Fox: deep shadow step + firm mid → crisp cel bands, never airbrushed */
const RAMP_FOX = toonRamp([55, 175, 255]);

/** Vertex-coloured toon coat; warm rim lifts the silhouette; aEmber (uv.x) self-lights the tail tip */
function coatMaterial(emberGain: number): THREE.MeshToonMaterial {
  const m = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: RAMP_FOX });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aEmber;\nvarying float vEmber;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvEmber = aEmber;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vEmber;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * vEmber * ${emberGain.toFixed(2)};`,
      )
      .replace(
        '#include <opaque_fragment>',
        `{
          // living cel: band the total (key + hemi + hearth) light into 3 crisp steps so the hemi fill
          // can't airbrush the coat; the shadow step leans rust-plum (melancholy), never grey
          vec3 lit = outgoingLight - totalEmissiveRadiance;
          float L = dot(lit, vec3(0.2126, 0.7152, 0.0722)) / max(1e-3, dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)));
          float band = mix(0.42, 0.8, smoothstep(0.41, 0.49, L));
          band = mix(band, 1.1, smoothstep(0.9, 1.0, L));
          vec3 tint = mix(vec3(0.82, 0.58, 0.66), vec3(1.0), smoothstep(0.43, 0.97, L));
          outgoingLight = diffuseColor.rgb * band * tint + totalEmissiveRadiance;
          float rim = 1.0 - clamp(dot(normalize(normal), vec3(0.0, 0.0, 1.0)), 0.0, 1.0);
          outgoingLight += vec3(1.0, 0.55, 0.22) * smoothstep(0.6, 0.88, rim) * 0.3 * (1.0 - vEmber);
        }
        #include <opaque_fragment>`,
      );
  };
  m.customProgramCacheKey = () => `lk-hearth-fox-${emberGain}`;
  return m;
}

export async function loadHearthFox(inkMaterial: (width: number) => THREE.Material, inkWidth = 0.016): Promise<HearthFox> {
  const gltf = await new GLTFLoader().loadAsync('/assets/hero/hearth_fox.glb');
  const root = new THREE.Group();
  const model = gltf.scene;
  root.add(model);

  let tailTip: THREE.Bone | undefined;
  let neck: THREE.Bone | undefined;
  let head: THREE.Bone | undefined;
  let speeds: Record<string, number> = {};
  const skinned: THREE.SkinnedMesh[] = [];
  const pawBones: THREE.Bone[] = [];
  model.traverse((o) => {
    // GLTFLoader sanitizes bone names (fpaw.L → fpawL)
    if (/^[fh]paw\.?[LR]$/.test(o.name)) pawBones.push(o as THREE.Bone);
    if ((o as THREE.Bone).isBone) {
      if (o.name === 'tail6') tailTip = o as THREE.Bone;
      if (o.name === 'neck') neck = o as THREE.Bone;
      if (o.name === 'head') head = o as THREE.Bone;
    }
    if (o.userData.clipSpeed) speeds = o.userData.clipSpeed as Record<string, number>;
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned.push(o as THREE.SkinnedMesh);
  });

  for (const mesh of skinned) {
    const geo = mesh.geometry;
    const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
    const ember = new Float32Array(uv.count);
    for (let i = 0; i < uv.count; i++) ember[i] = uv.getX(i);
    geo.setAttribute('aEmber', new THREE.BufferAttribute(ember, 1));
    const isCoat = mesh.name.startsWith('fox_coat');
    mesh.material = coatMaterial(isCoat ? 1.7 : 0.9);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    if (isCoat) {
      // inverted-hull ink that follows the skin (same geometry + skeleton, back faces pushed out)
      const hull = new THREE.SkinnedMesh(geo, inkMaterial(inkWidth));
      hull.bind(mesh.skeleton, mesh.bindMatrix);
      hull.userData.ink = true;
      hull.frustumCulled = false;
      mesh.parent!.add(hull);
    }
  }

  // ember wisps streaming off the pointed tail tip (along the tail bone's +Y) + a warm hearth light
  const tongues: THREE.Mesh[] = [];
  if (tailTip) {
    const tipLen = 0.095; // tail6 bone length (leaf bone: glTF keeps no tail position)
    const wispMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 0.42, 0.07), transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending });
    for (let i = 0; i < 3; i++) {
      const g = new THREE.ConeGeometry(0.014 - i * 0.003, 0.13 - i * 0.03, 6);
      g.translate(0, 0.06 - i * 0.012, 0);
      const t = new THREE.Mesh(g, wispMat);
      t.position.set((i - 1) * 0.008, tipLen * 0.85, 0);
      t.rotation.set(-0.25 + i * 0.12, 0, (i - 1) * 0.45);
      tailTip.add(t);
      tongues.push(t);
    }
  }
  const tailLight = new THREE.PointLight(0xff7a30, 1.4, 2.6, 2);
  (tailTip ?? root).add(tailLight);
  tailLight.position.set(0, 0.08, 0);

  const mixer = new THREE.AnimationMixer(model);
  const actions = new Map<string, THREE.AnimationAction>();
  for (const clip of gltf.animations) actions.set(clip.name, mixer.clipAction(clip));
  let current: FoxClip = 'idle';
  let travel = false;
  actions.get('idle')?.play();

  let headYaw = 0;
  let time = 0;
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion();
  const pq = new THREE.Quaternion();
  const axis = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  /** world-up yaw on a bone, applied on top of the clip */
  const addYaw = (b: THREE.Bone | undefined, a: number) => {
    if (!b?.parent) return;
    b.parent.getWorldQuaternion(pq);
    axis.copy(up).applyQuaternion(pq.invert());
    b.quaternion.premultiply(q.setFromAxisAngle(axis, a));
  };

  const fox: HearthFox = {
    root,
    get clip() {
      return current;
    },
    get speed() {
      return travel ? (speeds[current] ?? 0) : 0;
    },
    paws() {
      const v = new THREE.Vector3();
      return Object.fromEntries(pawBones.map((b) => [b.name, b.getWorldPosition(v).toArray()])) as Record<string, [number, number, number]>;
    },
    setHeadYaw(y) {
      headYaw = y;
    },
    play(clip, move = false) {
      travel = move;
      if (clip === current) return;
      const next = actions.get(clip);
      const prev = actions.get(current);
      if (!next) return;
      next.reset().play();
      if (prev) next.crossFadeFrom(prev, 0.25, true);
      current = clip;
    },
    update(dt) {
      time += dt;
      mixer.update(dt);
      model.updateMatrixWorld(true);
      // look offset rides on the clip; walking/running keeps the head on the path
      const look = current === 'idle' ? headYaw : 0;
      addYaw(neck, look * 0.45);
      addYaw(head, look * 0.55);
      if (travel) root.position.addScaledVector(fwd.set(0, 0, 1).applyQuaternion(root.quaternion), (speeds[current] ?? 0) * dt);
      tongues.forEach((t, i) => (t.scale.y = 0.75 + 0.4 * Math.abs(Math.sin(time * 7 + i * 2.1))));
      tailLight.intensity = 1.3 + Math.sin(time * 9) * 0.2;
    },
  };
  return fox;
}
