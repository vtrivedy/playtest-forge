/**
 * Hearth-fox for the P0 lookdev ("Pressed Ink → Living Cel").
 *
 * Authored in Blender (tools/blender/scripts/hearth_fox_*.py) → assets/hero/hearth_fox.glb:
 * `fox_coat` (skinned, vertex-coloured coat; TEXCOORD_0.x = ember mask) + `fox_face` (eyes, nose),
 * clips idle / walk / trot / run / jumpUp / fall / land (in place; the rig's glTF extras carry each clip's ground speed).
 * Here: 3-band cel coat (hatched shadow step, hard warm rim), skinned inverted-hull ink, banded ember tail glow, cel flame tongues on the burn-out third, drifting ember motes.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type FoxClip = 'idle' | 'walk' | 'trot' | 'run' | 'jumpUp' | 'fall' | 'land';
/** play once and hold the last frame; the rest loop */
const ONE_SHOT: ReadonlySet<string> = new Set(['jumpUp', 'land']);

export interface HearthFox {
  root: THREE.Group;
  /** glTF scene under root; the play animator drives its mixer directly (lookdevPlay.ts) */
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  actions: Map<string, THREE.AnimationAction>;
  /** authored ground speed per clip (m/s, glTF extras) */
  clipSpeed: Record<string, number>;
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
        // ember burns in two flat cel steps (no airbrushed gradient along the tail)
        float emberStep = 0.45 * step(0.2, vEmber) + 0.55 * step(0.62, vEmber);
        totalEmissiveRadiance += diffuseColor.rgb * emberStep * ${emberGain.toFixed(2)};`,
      )
      .replace(
        '#include <opaque_fragment>',
        `{
          // living cel: band the total (key + hemi + hearth) light into 3 crisp steps so the hemi fill
          // can't airbrush the coat; the shadow step leans rust-plum (melancholy), never grey
          vec3 lit = outgoingLight - totalEmissiveRadiance;
          float L = dot(lit, vec3(0.2126, 0.7152, 0.0722)) / max(1e-3, dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)));
          // lit step kept close to mid so band edges read as paint, not a lacquer highlight
          float shade = smoothstep(0.43, 0.47, L);
          float band = mix(0.44, 0.84, shade);
          band = mix(band, 0.96, step(0.92, L));
          vec3 tint = mix(vec3(0.82, 0.58, 0.66), vec3(1.0), shade);
          // pressed-ink hatching in the shadow step: the fox shares the world's printed medium
          float hatch = step(0.66, fract((gl_FragCoord.x + gl_FragCoord.y) * 0.16));
          outgoingLight = diffuseColor.rgb * band * tint * (1.0 - 0.18 * hatch * (1.0 - shade)) + totalEmissiveRadiance;
          // one hard warm rim band (not a soft sheen)
          float rim = 1.0 - clamp(dot(normalize(normal), vec3(0.0, 0.0, 1.0)), 0.0, 1.0);
          outgoingLight += vec3(1.0, 0.55, 0.22) * smoothstep(0.72, 0.76, rim) * 0.22 * (1.0 - vEmber);
        }
        #include <opaque_fragment>`,
      );
  };
  m.customProgramCacheKey = () => `lk-hearth-fox-${emberGain}`;
  return m;
}

/**
 * Living-cel flame tongue: a world-up billboard (vertex shader) anchored on a bone. Hard-edged
 * 3-tone cel flame (rust rim → ember → amber core), licking upward and leaning against motion.
 * Opaque-cut, not a soft glow: it has to read as painted fire at 05 distance.
 */
function flameMaterial(size: [number, number], seed: number, uLean: { value: THREE.Vector3 }, uTime: { value: number }): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime, uLean, uSize: { value: new THREE.Vector2(...size) }, uSeed: { value: seed } },
    vertexShader: /* glsl */ `
      uniform vec2 uSize; uniform vec3 uLean;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 c = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        float y = uv.y;
        // tongue bends with the lean (motion trail) more toward its tip
        vec3 p = c + right * (uv.x - 0.5) * uSize.x + vec3(0.0, 1.0, 0.0) * y * uSize.y + uLean * y * y * uSize.y;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uSeed;
      varying vec2 vUv;
      void main() {
        float y = vUv.y;
        float t = uTime * 1.0 + uSeed * 7.0;
        // licking sway, stronger toward the tip; two tongues split near the top
        float x = vUv.x - 0.5 + sin(y * 6.0 - t * 5.0) * 0.09 * y + sin(y * 13.0 - t * 9.0 + uSeed) * 0.03 * y;
        float w = 0.5 * pow(max(0.0, 1.0 - y), 0.75) * smoothstep(0.0, 0.18, y + 0.04);
        // flicker the height
        float h = 0.82 + 0.18 * sin(t * 3.1 + uSeed * 3.0) * sin(t * 1.7);
        w *= step(y, h) * (1.0 - smoothstep(h - 0.3, h, y) * 0.6);
        float split = smoothstep(0.55, 0.9, y) * 0.22 * (0.5 + 0.5 * sin(t * 2.3));
        float d = min(abs(x - split * 0.5), abs(x + split * 0.5) + 0.04 * step(0.6, y));
        float f = d / max(w, 1e-3);
        if (f > 1.0) discard;
        vec3 rust = vec3(0.42, 0.09, 0.03);
        vec3 ember = vec3(0.92, 0.3, 0.06);
        vec3 core = vec3(1.0, 0.56, 0.16);
        vec3 col = f > 0.78 ? rust : (f > 0.45 || y > h * 0.65 ? ember : core);
        gl_FragColor = vec4(col * 1.1, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.DoubleSide,
  });
}

export async function loadHearthFox(inkMaterial: (width: number) => THREE.Material, inkWidth = 0.024): Promise<HearthFox> {
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

  // ember motes: drift up off the tail tip (and a few off the ear tips), fading orange → ash.
  // World-space Points (identity matrixWorld) so the trail stays behind a walking fox.
  const earTips = ['earL', 'earR'].map((n) => model.getObjectByName(n) as THREE.Bone | undefined);
  const MOTES = 48;
  const motePos = new Float32Array(MOTES * 3);
  const moteCol = new Float32Array(MOTES * 3);
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  moteGeo.setAttribute('color', new THREE.BufferAttribute(moteCol, 3));
  const moteTex = (() => {
    const n = 16;
    const d = new Uint8Array(n * n * 4);
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const r = Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) / (n / 2);
        d.set([255, 255, 255, Math.round(255 * Math.max(0, 1 - r) ** 1.5)], (y * n + x) * 4);
      }
    const t = new THREE.DataTexture(d, n, n, THREE.RGBAFormat);
    t.needsUpdate = true;
    return t;
  })();
  const motes = new THREE.Points(
    moteGeo,
    new THREE.PointsMaterial({ size: 0.04, map: moteTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  motes.frustumCulled = false;
  motes.matrixAutoUpdate = false;
  motes.matrixWorldAutoUpdate = false;
  root.add(motes);
  const moteSeed = Array.from({ length: MOTES }, (_, i) => [((i * 0.618034) % 1) * 1.6, ((i * 0.414214) % 1) * 2 - 1, ((i * 0.732051) % 1) * 2 - 1] as const);
  const spawn = new THREE.Vector3();
  const tipOff = new THREE.Vector3(0, 0.07, 0);
  const earOff = new THREE.Vector3(0, 0.15, 0);
  const tailLight = new THREE.PointLight(0xff7a30, 1.4, 2.6, 2);
  (tailTip ?? root).add(tailLight);
  tailLight.position.set(0, 0.08, 0);

  // spirit signal: cel flame tongues along the tail's burn-out third (the brush becomes fire), tallest at the point
  const uTime = { value: 0 };
  const uLean = { value: new THREE.Vector3() };
  const flameGeo = new THREE.PlaneGeometry(1, 1);
  const tail5 = model.getObjectByName('tail5') as THREE.Bone | undefined;
  const tongues: [THREE.Bone | undefined, [number, number, number], [number, number], number][] = [
    [tailTip, [0, 0.06, 0], [0.13, 0.27], 0.1],
    [tailTip, [0.03, 0.0, 0.02], [0.09, 0.18], 0.55],
    [tailTip, [-0.035, -0.03, -0.01], [0.08, 0.15], 0.85],
    [tail5, [0.02, 0.03, 0.03], [0.07, 0.12], 0.35],
    [tail5, [-0.03, -0.02, 0.02], [0.06, 0.09], 0.7],
  ];
  for (const [bone, off, size, seed] of tongues) {
    if (!bone) continue;
    const m = new THREE.Mesh(flameGeo, flameMaterial(size, seed, uLean, uTime));
    m.position.set(...off);
    m.frustumCulled = false;
    m.renderOrder = 2;
    bone.add(m);
  }
  const tipNow = new THREE.Vector3();
  const tipPrev = new THREE.Vector3();
  let tipInit = false;

  const mixer = new THREE.AnimationMixer(model);
  const actions = new Map<string, THREE.AnimationAction>();
  for (const clip of gltf.animations) {
    const action = mixer.clipAction(clip);
    if (ONE_SHOT.has(clip.name)) {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    }
    actions.set(clip.name, action);
  }
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
    model,
    mixer,
    actions,
    clipSpeed: speeds,
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
      // motes: fixed 1.6 s life, staggered; respawn position = tail tip (or ear tip for every 6th)
      for (let i = 0; i < MOTES; i++) {
        const [phase, sx, sz] = moteSeed[i]!;
        const age = (time + phase) % 1.6;
        const src = i % 6 === 0 ? earTips[(i / 6) % 2]! : tailTip;
        if (!src) continue;
        spawn.copy(src === tailTip ? tipOff : earOff);
        src.localToWorld(spawn);
        const k = age / 1.6;
        motePos[i * 3] = spawn.x + sx * 0.05 * k + Math.sin(time * 2 + i) * 0.02 * k;
        motePos[i * 3 + 1] = spawn.y + 0.32 * k + 0.1 * k * k;
        motePos[i * 3 + 2] = spawn.z + sz * 0.05 * k;
        const fade = Math.sin(Math.PI * Math.min(1, k * 1.4)) * (1 - k);
        moteCol[i * 3] = 2.2 * fade;
        moteCol[i * 3 + 1] = (0.75 - 0.4 * k) * fade;
        moteCol[i * 3 + 2] = 0.12 * fade;
      }
      moteGeo.attributes.position!.needsUpdate = true;
      moteGeo.attributes.color!.needsUpdate = true;
      tailLight.intensity = 1.3 + Math.sin(time * 9) * 0.2;
      // flames lean away from the tip's motion (eased), so a running fox trails fire
      uTime.value = time;
      if (tailTip) {
        tailTip.getWorldPosition(tipNow);
        if (tipInit && dt > 0) {
          spawn.subVectors(tipPrev, tipNow).divideScalar(dt).multiplyScalar(0.25).clampLength(0, 1.2);
          spawn.y = 0;
          uLean.value.lerp(spawn, Math.min(1, dt * 8));
        }
        tipPrev.copy(tipNow);
        tipInit = true;
      }
    },
  };
  return fox;
}
