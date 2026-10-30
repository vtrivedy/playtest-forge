import * as THREE from 'three';
import type { ColorField } from './colorField';

export type AutumnParticles = {
  leaves: THREE.InstancedMesh;
  embers: THREE.Points;
  /** Burst intensity at restore wavefront (0..1+) */
  setWavefront: (center: THREE.Vector3, radius: number, strength: number) => void;
  /** Kick a few leaves up off the ground (fox running through litter). `size` scales the leaves (restore front release). */
  kick: (origin: THREE.Vector3, strength?: number, size?: number) => void;
  /** Rising leaf vortex around a point (shrine restore money shot). */
  swirl: (center: THREE.Vector3, count?: number, radius?: number) => void;
  /** focus = point ambient leaves drift around (fox / camera target). */
  update: (dt: number, focus?: THREE.Vector3) => void;
  dispose: () => void;
};

export type AutumnParticleOptions = {
  /** Leaves graded sepia → autumn by the ColorField mask at their world position. */
  colorField?: ColorField;
  /** Ground height so leaves settle and fade instead of falling through. */
  groundAt?: (x: number, z: number) => number;
  /** Pooled leaves reserved for kick + swirl bursts. */
  burstPool?: number;
  /** Ambient drift radius around focus. */
  radius?: number;
};

// Restored W1 hues (art-direction §2.2): russet, maple red, amber, golden grass, copper
const LEAF_COLORS = [0xb8321f, 0xa8441f, 0xc45a28, 0xe08a2b, 0xc9a04a, 0xd8813a, 0x8b2a16];
const EMBER_COLORS = [0xff8a30, 0xffc857, 0xff5a1a, 0xffaa44];

const ATLAS = 256;
const CELL = ATLAS / 2;

/** Maple, oak, ovate elm and three-lobed maple silhouettes in a 2×2 alpha atlas. White albedo with veins; tinted per instance. */
function makeLeafAtlas(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = ATLAS;
  c.height = ATLAS;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, ATLAS, ATLAS);

  const outline = (cell: number, pts: Array<[number, number]>) => {
    // pts in -1..1 leaf space (y up), centered in cell
    const ox = (cell % 2) * CELL + CELL / 2;
    const oy = Math.floor(cell / 2) * CELL + CELL / 2;
    const s = CELL * 0.46;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(ox + x * s, oy - y * s) : ctx.moveTo(ox + x * s, oy - y * s)));
    ctx.closePath();
    return { ox, oy, s };
  };
  const shade = (cell: number, pts: Array<[number, number]>, veins: Array<[number, number]>, stemY: number) => {
    const { ox, oy, s } = outline(cell, pts);
    const g = ctx.createLinearGradient(ox, oy - s, ox, oy + s);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#d8d2c8');
    ctx.fillStyle = g;
    ctx.fill();
    // darker rim reads as a curled edge at small sizes
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(150,140,130,0.9)';
    ctx.stroke();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(165,155,140,0.95)';
    ctx.lineWidth = 2.2;
    for (const [vx, vy] of veins) {
      ctx.beginPath();
      ctx.moveTo(ox, oy - stemY * s);
      ctx.lineTo(ox + vx * s * 0.86, oy - vy * s * 0.86);
      ctx.stroke();
    }
    // stem
    ctx.strokeStyle = 'rgba(140,128,112,1)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ox, oy - stemY * s);
    ctx.lineTo(ox + 0.04 * s, oy + 0.98 * s);
    ctx.stroke();
  };

  // 0: five-lobed maple — |cos(2.5θ)| lobes, serrated tips, smaller basal lobes
  const maple = (lobes: number, sharp: number): Array<[number, number]> => {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < 200; i++) {
      const th = (i / 200) * Math.PI * 2; // 0 = up
      const lobe = Math.pow(Math.abs(Math.cos((lobes / 2) * th)), sharp);
      const teeth = 0.07 * Math.pow(Math.abs(Math.cos(lobes * 2.5 * th)), 8);
      const basal = 0.8 + 0.2 * Math.cos(th);
      const r = (0.3 + 0.62 * lobe + teeth) * basal;
      pts.push([Math.sin(th) * r, Math.cos(th) * r - 0.08]);
    }
    return pts;
  };
  const lobeDirs = (n: number): Array<[number, number]> =>
    Array.from({ length: n }, (_, i) => {
      const th = (i / n) * Math.PI * 2;
      return [Math.sin(th) * (0.8 + 0.2 * Math.cos(th)), Math.cos(th) * (0.8 + 0.2 * Math.cos(th)) - 0.08] as [number, number];
    }).filter(([, y]) => y > -0.7);
  shade(0, maple(5, 1.6), lobeDirs(5), -0.08);

  // 1: oak — elongated, rounded alternating lobes
  {
    const right: Array<[number, number]> = [];
    for (let i = 0; i <= 80; i++) {
      const t = i / 80; // 0 tip → 1 base
      const y = 0.95 - t * 1.75;
      const env = Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 0.7) * 0.42;
      const lobe = 0.6 + 0.4 * Math.pow(Math.abs(Math.sin(t * Math.PI * 4.5)), 0.6);
      right.push([env * lobe, y]);
    }
    const pts = [...right, ...right.slice().reverse().map(([x, y]) => [-x * 0.94, y] as [number, number])];
    shade(1, pts, [[0.5, 0.45], [-0.5, 0.25], [0.45, -0.05], [-0.42, -0.35], [0, 0.95]], -0.8);
  }

  // 2: ovate elm/birch — pointed tip, fine serration
  {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < 160; i++) {
      const th = (i / 160) * Math.PI * 2;
      const tipPull = Math.pow(Math.max(0, Math.cos(th)), 6) * 0.35;
      const r = 0.55 + tipPull + 0.025 * Math.abs(Math.sin(th * 22));
      pts.push([Math.sin(th) * r * 0.72, Math.cos(th) * r - 0.05]);
    }
    shade(2, pts, [[0.45, 0.5], [-0.45, 0.3], [0.45, 0.0], [-0.45, -0.2], [0, 0.85]], -0.55);
  }

  // 3: three-lobed maple (younger / sycamore read)
  shade(3, maple(3, 1.3), lobeDirs(3), -0.08);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeEmberTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,200,120,0.85)');
  g.addColorStop(1, 'rgba(255,80,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

/** Lambert leaf material: atlas cell per instance, ColorField sepia grade, shrink near camera. */
function makeLeafMaterial(atlas: THREE.Texture) {
  const uniforms = {
    uMask: { value: null as THREE.Texture | null },
    uUseMask: { value: 0 },
    uBounds: { value: new THREE.Vector4(-24, 24, -24, 24) },
    uGlobalColor: { value: 0 },
  };
  const mat = new THREE.MeshLambertMaterial({
    map: atlas,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
  });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec2 aCell;
        varying vec3 vLeafWorld;`,
      )
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
        vMapUv = vMapUv * 0.5 + aCell * 0.5;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec3 leafCenter = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vLeafWorld = leafCenter;
        // keep leaves from filling the lens: shrink inside ~1.6 m of the camera
        transformed *= smoothstep(0.5, 1.6, distance(leafCenter, cameraPosition));`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D uMask;
        uniform float uUseMask;
        uniform vec4 uBounds;
        uniform float uGlobalColor;
        varying vec3 vLeafWorld;
        float leafRestored = 0.0;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float m = uGlobalColor;
          if (uUseMask > 0.5) {
            vec2 muv = vec2((vLeafWorld.x - uBounds.x) / (uBounds.y - uBounds.x),
                            (vLeafWorld.z - uBounds.z) / (uBounds.w - uBounds.z));
            if (all(greaterThanEqual(muv, vec2(0.0))) && all(lessThanEqual(muv, vec2(1.0)))) {
              m = max(m, texture2D(uMask, muv).r);
            }
          }
          m = clamp(m, 0.0, 1.0);
          float luma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
          // pressed-leaf sepia (matches ColorField inkWash), lifted so it reads against umber ground
          vec3 sepia = vec3(luma * 1.08, luma * 0.9, luma * 0.62) * 1.25 + vec3(0.05, 0.04, 0.025);
          leafRestored = smoothstep(0.05, 0.75, m);
          diffuseColor.rgb = mix(sepia, diffuseColor.rgb, leafRestored);
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        // backlit translucency: restored leaves glow from within against a low sun; pressed sepia ones stay dull
        totalEmissiveRadiance += diffuseColor.rgb * mix(0.22, 1.15, leafRestored);`,
      );
  };
  return { mat, uniforms };
}

type Leaf = {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  yaw: number; yawRate: number;
  pitch: number; pitchRate: number;
  phase: number; freq: number; amp: number;
  fall: number; scale: number;
  /** 0 = airborne, >0 seconds rested on ground */
  rest: number;
  life: number; maxLife: number;
  alive: boolean;
  mode: 0 | 1 | 2; // ambient, kick, swirl
  cx: number; cy: number; cz: number;
  /** cached ground under the leaf (groundAt can be a collider sweep) */
  gy: number; gyT: number;
};

/**
 * Drifting autumn leaves (alpha-cutout atlas, pendulum flutter) + soft warm embers.
 * One instanced draw for all leaves (ambient + kick + swirl pool), one points draw for embers.
 */
export function createAutumnParticles(
  scene: THREE.Scene,
  leafCount = 160,
  emberCount = 90,
  opts: AutumnParticleOptions = {},
): AutumnParticles {
  const pool = opts.burstPool ?? 200;
  const total = leafCount + pool;
  const R = opts.radius ?? 14;
  const groundAt = opts.groundAt;
  const atlas = makeLeafAtlas();
  // ~9–12 cm maple leaf at scale 1 (fox is 0.55 m to the ears)
  const leafGeo = new THREE.PlaneGeometry(0.11, 0.11);
  leafGeo.rotateX(-Math.PI / 2);
  const { mat: leafMat, uniforms } = makeLeafMaterial(atlas);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, total);
  leaves.frustumCulled = false;
  leaves.castShadow = false;
  leaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const cells = new Float32Array(total * 2);
  const leafCols = new Float32Array(total * 3);
  const c = new THREE.Color();
  // maple-heavy mix: 0 maple ×3, 1 oak, 2 elm, 3 three-lobe
  const cellPick = [0, 0, 0, 1, 2, 3, 0, 3];
  for (let i = 0; i < total; i++) {
    const cell = cellPick[Math.floor(Math.random() * cellPick.length)]!;
    cells[i * 2] = cell % 2;
    cells[i * 2 + 1] = 1 - Math.floor(cell / 2); // canvas row 0 is uv top
    c.setHex(LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)]!);
    c.offsetHSL((Math.random() - 0.5) * 0.03, 0, (Math.random() - 0.5) * 0.08);
    leafCols[i * 3] = c.r;
    leafCols[i * 3 + 1] = c.g;
    leafCols[i * 3 + 2] = c.b;
  }
  leafGeo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 2));
  leaves.instanceColor = new THREE.InstancedBufferAttribute(leafCols, 3);

  const focus = new THREE.Vector3();
  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  const states: Leaf[] = [];
  const spawnAmbient = (s: Leaf, anyHeight: boolean) => {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * R;
    s.x = focus.x + Math.cos(a) * r;
    s.z = focus.z + Math.sin(a) * r;
    s.y = focus.y + (anyHeight ? rand(0, 7) : rand(4, 8));
    s.vx = s.vy = s.vz = 0;
    s.rest = 0;
    s.alive = true;
    s.mode = 0;
    s.gyT = 0;
  };
  for (let i = 0; i < total; i++) {
    const s: Leaf = {
      x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0,
      yaw: Math.random() * Math.PI * 2,
      yawRate: rand(-0.8, 0.8),
      // ~1/3 of leaves tumble end-over-end, the rest rock like a pendulum
      pitch: Math.random() * Math.PI,
      pitchRate: Math.random() < 0.35 ? rand(3, 7) * (Math.random() < 0.5 ? -1 : 1) : 0,
      phase: Math.random() * Math.PI * 2,
      freq: rand(1.6, 3.0),
      amp: rand(0.15, 0.4),
      fall: rand(0.35, 0.7),
      scale: rand(0.65, 1.45),
      rest: 0, life: 0, maxLife: 1,
      alive: i < leafCount,
      mode: 0, cx: 0, cy: 0, cz: 0,
      gy: -Infinity, gyT: Math.random() * 0.4,
    };
    if (i < leafCount) spawnAmbient(s, true);
    states.push(s);
  }
  scene.add(leaves);

  // embers
  const emberTex = makeEmberTexture();
  const eGeo = new THREE.BufferGeometry();
  const ePos = new Float32Array(emberCount * 3);
  const eCol = new Float32Array(emberCount * 3);
  const eVel = new Float32Array(emberCount * 3);
  for (let i = 0; i < emberCount; i++) {
    ePos[i * 3] = (Math.random() - 0.5) * 28;
    ePos[i * 3 + 1] = Math.random() * 10 + 1;
    ePos[i * 3 + 2] = (Math.random() - 0.5) * 28;
    eVel[i * 3] = (Math.random() - 0.5) * 0.3;
    eVel[i * 3 + 1] = 0.15 + Math.random() * 0.45;
    eVel[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
    c.setHex(EMBER_COLORS[i % EMBER_COLORS.length]!);
    eCol[i * 3] = c.r;
    eCol[i * 3 + 1] = c.g;
    eCol[i * 3 + 2] = c.b;
  }
  eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
  eGeo.setAttribute('color', new THREE.BufferAttribute(eCol, 3));
  const eMat = new THREE.PointsMaterial({
    size: 0.08,
    map: emberTex,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const embers = new THREE.Points(eGeo, eMat);
  embers.frustumCulled = false;
  scene.add(embers);

  let wave = { x: 0, y: 0, z: 0, r: 0, s: 0 };
  let t = 0;
  let poolCursor = leafCount;
  const takePooled = (): Leaf => {
    // round-robin over the pool; oldest burst leaf is recycled first
    const s = states[poolCursor]!;
    poolCursor = poolCursor + 1 >= total ? leafCount : poolCursor + 1;
    return s;
  };
  const dummy = new THREE.Object3D();
  const wind = { x: 0.22, z: -0.08 };

  return {
    leaves,
    embers,
    setWavefront(center, radius, strength) {
      wave = { x: center.x, y: center.y, z: center.z, r: radius, s: strength };
    },
    kick(origin, strength = 1, size = 1) {
      const n = Math.round(3 + strength * 3);
      for (let k = 0; k < n; k++) {
        const s = takePooled();
        s.alive = true;
        s.mode = 1;
        s.gyT = 0;
        s.rest = 0;
        s.x = origin.x + rand(-0.2, 0.2);
        s.y = origin.y + 0.03;
        s.z = origin.z + rand(-0.2, 0.2);
        const a = Math.random() * Math.PI * 2;
        const sp = rand(0.4, 1.3) * strength;
        s.vx = Math.cos(a) * sp;
        s.vz = Math.sin(a) * sp;
        s.vy = rand(1.2, 2.4) * strength;
        s.scale = rand(0.65, 1.3) * size;
        s.pitchRate = rand(5, 10) * (Math.random() < 0.5 ? -1 : 1);
        s.maxLife = s.life = rand(2.5, 4);
      }
    },
    swirl(center, count = 90, radius = 2.2) {
      for (let k = 0; k < count; k++) {
        const s = takePooled();
        const a = Math.random() * Math.PI * 2;
        const r = rand(0.7, 1.35) * radius;
        s.alive = true;
        s.mode = 2;
        s.gyT = 0;
        s.rest = 0;
        s.cx = center.x;
        s.cy = center.y;
        s.cz = center.z;
        s.x = center.x + Math.cos(a) * r;
        s.z = center.z + Math.sin(a) * r;
        s.y = center.y + rand(0.2, 0.9);
        // hero moment: a little larger than the ambient drift so the vortex reads at shrine distance
        s.scale = rand(1.6, 2.6);
        s.vx = s.vy = s.vz = 0;
        s.pitchRate = rand(2, 6) * (Math.random() < 0.5 ? -1 : 1);
        s.maxLife = s.life = rand(5, 8);
      }
    },
    update(dt, focusPos) {
      t += dt;
      if (focusPos) focus.copy(focusPos);
      const cf = opts.colorField;
      if (cf) {
        const tex = cf.getMaskTexture();
        uniforms.uMask.value = tex;
        uniforms.uUseMask.value = tex ? 1 : 0;
        uniforms.uBounds.value.set(cf.bounds.minX, cf.bounds.maxX, cf.bounds.minZ, cf.bounds.maxZ);
        uniforms.uGlobalColor.value = cf.globalColor;
      } else {
        uniforms.uGlobalColor.value = 1;
      }

      for (let i = 0; i < total; i++) {
        const s = states[i]!;
        if (!s.alive) {
          dummy.scale.setScalar(0);
          dummy.position.set(0, -999, 0);
          dummy.updateMatrix();
          leaves.setMatrixAt(i, dummy.matrix);
          continue;
        }
        s.gyT -= dt;
        if (s.gyT <= 0) {
          s.gyT = 0.35;
          s.gy = groundAt ? groundAt(s.x, s.z) + 0.015 : focus.y - 1.5;
        }
        const gy = s.gy;
        let roll = 0;
        let fade = 1;
        const vortex = s.mode === 2 && s.life > s.maxLife - 3.2;

        if (s.rest > 0) {
          // settled on the ground: lie flat, then shrink away
          s.rest += dt;
          fade = 1 - THREE.MathUtils.smoothstep(s.rest, 1.4, 2.2);
          if (s.rest > 2.2) {
            if (s.mode === 0) spawnAmbient(s, false);
            else s.alive = false;
          }
        } else if (vortex) {
          // restore vortex: lift and spiral out from the shrine, easing off over ~3 s
          const age = s.maxLife - s.life;
          const k = 1 - age / 3.2;
          const dx = s.x - s.cx;
          const dz = s.z - s.cz;
          const d = Math.hypot(dx, dz) + 0.001;
          const tan = (2.2 + 1.5 / d) * k;
          const tx = (-dz / d) * tan + (dx / d) * 1.1;
          const tz = (dx / d) * tan + (dz / d) * 1.1;
          // stay around shrine-body height so the vortex sweeps through a follow-cam frame
          const ty = 1.1 * k * k - 0.15;
          const blend = 1 - Math.exp(-3 * dt);
          s.vx += (tx - s.vx) * blend;
          s.vy += (ty - s.vy) * blend;
          s.vz += (tz - s.vz) * blend;
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          s.z += s.vz * dt;
          roll = Math.sin(t * s.freq * 2 + s.phase) * 0.8;
          s.life -= dt;
        } else {
          // falling-leaf pendulum: swing side to side, sink fastest mid-swing, tilt at the ends
          const w = t * s.freq + s.phase;
          const swing = Math.cos(w);
          const sinkMul = 0.45 + 0.9 * Math.abs(swing);
          const sx = Math.cos(s.yaw);
          const sz = Math.sin(s.yaw);
          // ballistic part (kick / tail of swirl) decays into the drift
          const drag = Math.exp(-2.4 * dt);
          s.vx *= drag;
          s.vz *= drag;
          // upward kick decays under gravity, then the pendulum sink takes over
          s.vy = Math.max(0, s.vy - 3.2 * dt) * drag;
          const flutter = s.mode === 1 && s.vy > 0 ? 0.3 : 1;
          s.x += (s.vx + wind.x + sx * s.amp * s.freq * swing * flutter) * dt;
          s.z += (s.vz + wind.z + sz * s.amp * s.freq * swing * flutter) * dt;
          s.y += (s.vy - s.fall * sinkMul * flutter) * dt;
          roll = Math.sin(w) * 0.75;
          if (s.mode !== 0) {
            s.life -= dt;
            if (s.life <= 0) s.alive = false;
          }
        }

        s.yaw += s.yawRate * dt;
        if (s.rest === 0) s.pitch += s.pitchRate * dt;

        // restore ring pushes ambient leaves tangentially
        if (wave.s > 0.01) {
          const dx = s.x - wave.x;
          const dz = s.z - wave.z;
          const d = Math.hypot(dx, dz);
          if (Math.abs(d - wave.r) < 2.8) {
            const force = wave.s * (1 - Math.abs(d - wave.r) / 2.8);
            s.x += (-dz / (d + 0.1)) * force * dt * 2.2;
            s.z += (dx / (d + 0.1)) * force * dt * 2.2;
            s.y += force * 0.7 * dt;
          }
        }

        if (s.rest === 0 && !vortex && s.y <= gy) {
          s.y = gy;
          s.rest = 1e-3;
          s.vx = s.vy = s.vz = 0;
          s.pitch = 0;
        }
        // drifted away, or fell past the island edge into the cloud sea
        const lost = Math.hypot(s.x - focus.x, s.z - focus.z) > R * 1.15 || s.y < focus.y - 10;
        if (lost && s.mode === 0) spawnAmbient(s, false);
        else if (lost && s.rest === 0 && !vortex && s.y < focus.y - 10) s.alive = false;

        dummy.position.set(s.x, s.y, s.z);
        if (s.rest > 0) dummy.rotation.set(0, s.yaw, 0, 'YXZ');
        else dummy.rotation.set(s.pitch % (Math.PI * 2), s.yaw, roll, 'YXZ');
        dummy.scale.setScalar(s.scale * fade);
        dummy.updateMatrix();
        leaves.setMatrixAt(i, dummy.matrix);
      }
      leaves.instanceMatrix.needsUpdate = true;

      const pos = embers.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < emberCount; i++) {
        let x = pos.getX(i) + eVel[i * 3]! * dt + Math.sin(t * 1.3 + i) * 0.08 * dt;
        let y = pos.getY(i) + eVel[i * 3 + 1]! * dt;
        let z = pos.getZ(i) + eVel[i * 3 + 2]! * dt;
        const dx = x - wave.x;
        const dz = z - wave.z;
        const d = Math.hypot(dx, dz);
        if (wave.s > 0.01 && Math.abs(d - wave.r) < 2.5) {
          const force = wave.s * (1 - Math.abs(d - wave.r) / 2.5);
          x += (-dz / (d + 0.1)) * force * dt * 2.2;
          z += (dx / (d + 0.1)) * force * dt * 2.2;
          y += force * 1.6 * dt;
        }
        if (y > focus.y + 9 || Math.hypot(x - focus.x, z - focus.z) > R * 1.4) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * R;
          x = focus.x + Math.cos(a) * r;
          z = focus.z + Math.sin(a) * r;
          y = focus.y - 0.5 + Math.random() * 2;
        }
        pos.setXYZ(i, x, y, z);
      }
      pos.needsUpdate = true;
      wave.s *= Math.pow(0.4, dt);
    },
    dispose() {
      leafGeo.dispose();
      leafMat.dispose();
      atlas.dispose();
      scene.remove(leaves);
      eGeo.dispose();
      eMat.dispose();
      emberTex.dispose();
      scene.remove(embers);
    },
  };
}
