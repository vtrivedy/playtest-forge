import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { publishGame } from '../../shared/game-state';
import { createForgeRenderer } from '../../shared/renderer';
import { applyStylizedIslandLights } from '../../shared/environment';
import { createPostStack } from '../../shared/postfx';
import { Juice } from '../../shared/juice';
import {
  DEFAULT_FEEL,
  createFeelPanel,
  type FeelParams,
  type FeelMetrics,
} from '../../shared/character-feel';

// ---------------------------------------------------------------------------
// Feel: presets (variations) + extras on top of shared FeelParams
// ---------------------------------------------------------------------------
type Extras = { fallGravityMul: number; jumpCut: number; glideSpeedMul: number; camFollow: number };
type Preset = FeelParams & Extras;

const PRESETS: Record<string, Preset> = {
  punchy: {
    moveSpeed: 9, accel: 60, turnRate: 14, jumpVelocity: 11.5, gravity: 30, airControl: 0.7,
    glideGravityScale: 0.22, glideDrag: 2.2, dashSpeed: 22, dashDuration: 0.18, coyoteTime: 0.12,
    jumpBuffer: 0.14, fallGravityMul: 1.35, jumpCut: 0.5, glideSpeedMul: 1.15, camFollow: 1.6,
  },
  bouncy: {
    ...DEFAULT_FEEL, accel: 40, fallGravityMul: 1.0, jumpCut: 0.65, glideSpeedMul: 1.0, camFollow: 1.6,
  },
  floaty: {
    moveSpeed: 8, accel: 35, turnRate: 9, jumpVelocity: 8.5, gravity: 16, airControl: 0.85,
    glideGravityScale: 0.15, glideDrag: 2.6, dashSpeed: 15, dashDuration: 0.3, coyoteTime: 0.15,
    jumpBuffer: 0.15, fallGravityMul: 1.0, jumpCut: 0.7, glideSpeedMul: 1.25, camFollow: 1.2,
  },
};
const presetName = new URLSearchParams(location.search).get('feel') ?? 'punchy';
const feel: Preset = { ...(PRESETS[presetName] ?? PRESETS.punchy!) };
const ui = { preset: PRESETS[presetName] ? presetName : 'punchy' };

const metrics: FeelMetrics & { maxApex: number; glideTime: number; jumps: number; maxSpeed: number } = {
  lastJumpApex: 0, lastTimeToApex: 0, lastAirTime: 0, dashesUsed: 0, gemsCollected: 0,
  maxApex: 0, glideTime: 0, jumps: 0, maxSpeed: 0,
};

// ---------------------------------------------------------------------------
// Renderer / scene / post
// ---------------------------------------------------------------------------
const scene = new THREE.Scene();
const FOG = new THREE.Color(0xe59a8f);
scene.fog = new THREE.FogExp2(FOG, 0.0065);

const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 400);
const forge = await createForgeRenderer();
const { renderer, backend } = forge;
renderer.toneMappingExposure = 0.92;

// Offline PBR reflections (no network needed)
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;
pmrem.dispose();

applyStylizedIslandLights(scene);
// Re-grade the shared rig for a low sunset key
scene.traverse((o) => {
  if (o instanceof THREE.HemisphereLight) {
    o.color.set(0xb7a8ff);
    o.groundColor.set(0x7a4a3a);
    o.intensity = 0.9;
  } else if (o instanceof THREE.DirectionalLight) {
    if (o.castShadow) {
      o.color.set(0xffc28a);
      o.intensity = 3.2;
      o.position.set(-14, 11, 9);
      o.shadow.camera.left = -24;
      o.shadow.camera.right = 24;
      o.shadow.camera.top = 24;
      o.shadow.camera.bottom = -24;
      o.shadow.camera.far = 80;
      o.shadow.radius = 4;
      o.shadow.camera.updateProjectionMatrix();
    } else if (o.position.z < -10) {
      o.color.set(0xff7a9a); // magenta rim from behind
      o.intensity = 1.1;
    } else {
      o.color.set(0x8fa8ff);
      o.intensity = 0.5;
    }
  }
});

const post = createPostStack(renderer, scene, camera);
post.bloom.strength = 0.5;
post.bloom.radius = 0.55;
post.bloom.threshold = 0.9;

// Sky dome: violet zenith → peach horizon + sun glow (HDR so the sun blooms)
const sunDir = new THREE.Vector3(-14, 6, 9).normalize();
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(300, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      zenith: { value: new THREE.Color(0x2a2470) },
      mid: { value: new THREE.Color(0xc0709a) },
      horizon: { value: new THREE.Color(0xffb58a) },
      sunDir: { value: sunDir },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 zenith; uniform vec3 mid; uniform vec3 horizon; uniform vec3 sunDir;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 col = mix(horizon, mid, smoothstep(-0.05, 0.25, h));
        col = mix(col, zenith, smoothstep(0.2, 0.75, h));
        col = mix(col, horizon * 0.8, smoothstep(0.0, -0.4, h));
        float s = max(dot(vDir, sunDir), 0.0);
        col += vec3(1.0, 0.7, 0.45) * pow(s, 24.0) * 0.8;
        col += vec3(1.0, 0.85, 0.6) * smoothstep(0.9985, 0.9995, s) * 6.0;
        gl_FragColor = vec4(col, 1.0);
      }`,
  }),
);
sky.renderOrder = -1;
scene.add(sky);

// ---------------------------------------------------------------------------
// World: irregular sandstone mesa + terrace + pillar + floating islet
// ---------------------------------------------------------------------------
const islandR = (phi: number) => 9.2 + 1.3 * Math.sin(3 * phi + 0.6) + 0.6 * Math.sin(5 * phi + 2.1);

const grassMat = new THREE.MeshStandardMaterial({ color: 0x6fae4a, roughness: 0.9 });
const cliffMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true });
const rockMat = new THREE.MeshStandardMaterial({ color: 0xc98a62, roughness: 0.8, flatShading: true });

const bandColors = [0xe3a46e, 0xc06a4a, 0xf0c08a, 0x9a4f45, 0xd98a5c].map((c) => new THREE.Color(c));
function bandAndJitter(geo: THREE.BufferGeometry, amp: number, seed: number) {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n = Math.sin(x * 1.7 + seed) * Math.cos(z * 1.3 - seed) + Math.sin(y * 2.3 + x * 0.5);
    const len = Math.hypot(x, z);
    if (len > 0.01) pos.setXYZ(i, x + (x / len) * n * amp, y, z + (z / len) * n * amp);
    const band = Math.floor(((y * 1.4 + n * 0.25) % 5 + 5) % 5);
    c.copy(bandColors[band]!).multiplyScalar(0.85 + 0.15 * Math.sin(i));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
}

const world = new THREE.Group();
scene.add(world);

// Mesa top (extruded wobbly outline, bevelled rim)
{
  const shape = new THREE.Shape();
  const N = 96;
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI * 2;
    const r = islandR(t);
    const x = Math.cos(t) * r, z = Math.sin(t) * r;
    // rotateX(-PI/2) maps shape y → world -z, so feed -z
    if (i === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  }
  const depth = 1.4, bevel = 0.4;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: 0.35, bevelSegments: 3, curveSegments: 4,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -(depth + bevel), 0);
  const top = new THREE.Mesh(geo, [grassMat, new THREE.MeshStandardMaterial({ color: 0xc98a5c, roughness: 0.9 })]);
  top.receiveShadow = true;
  top.castShadow = true;
  world.add(top);

  // Banded sandstone underside
  const under = new THREE.Mesh(new THREE.ConeGeometry(9.6, 11, 28, 8, true), cliffMat);
  under.geometry.rotateX(Math.PI);
  bandAndJitter(under.geometry, 0.6, 1.3);
  under.position.y = -1.6 - 5.5;
  under.castShadow = true;
  world.add(under);
}

type Disk = { x: number; z: number; r: number; top: number; bottom: number };
const disks: Disk[] = [];

function addMesa(x: number, z: number, r: number, top: number, height: number, floating = false) {
  const g = new THREE.Group();
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.04, 0.5, 28), [cliffMat, grassMat, cliffMat]);
  bandAndJitter(cap.geometry, 0.04, x);
  cap.position.y = top - 0.25;
  cap.castShadow = cap.receiveShadow = true;
  const bodyH = floating ? height : height - 0.5;
  const body = new THREE.Mesh(
    floating
      ? new THREE.ConeGeometry(r * 1.02, bodyH, 18, 5, true).rotateX(Math.PI)
      : new THREE.CylinderGeometry(r * 1.03, r * 1.12, bodyH, 18, 5, true),
    cliffMat,
  );
  bandAndJitter(body.geometry, floating ? 0.25 : 0.12, z);
  body.position.y = top - 0.5 - bodyH / 2;
  body.castShadow = body.receiveShadow = true;
  g.add(cap, body);
  g.position.set(x, 0, z);
  world.add(g);
  disks.push({ x, z, r, top, bottom: floating ? top - height : -2 });
  return g;
}

const terrace = { x: -3.6, z: -2.6, r: 3.1, top: 1.7 };
addMesa(terrace.x, terrace.z, terrace.r, terrace.top, terrace.top + 0.5);
const pillar = { x: 0.9, z: -6.2, r: 1.25, top: 3.3 };
addMesa(pillar.x, pillar.z, pillar.r, pillar.top, pillar.top + 0.5);
const isletPhi = 0.35;
const isletDist = islandR(isletPhi) + 5.4 + 2.3;
const islet = { x: Math.cos(isletPhi) * isletDist, z: Math.sin(isletPhi) * isletDist, r: 2.3, top: 0.5 };
const isletGroup = addMesa(islet.x, islet.z, islet.r, islet.top, 4.5, true);

// Ground query: highest walkable top at (x,z) not above maxY
function groundAt(x: number, z: number, maxY: number): number | null {
  let best: number | null = null;
  const phi = Math.atan2(z, x);
  if (Math.hypot(x, z) < islandR(phi) + 0.15 && 0 <= maxY) best = 0;
  for (const d of disks) {
    if (Math.hypot(x - d.x, z - d.z) < d.r + 0.1 && d.top <= maxY && (best === null || d.top > best)) best = d.top;
  }
  return best;
}

const BODY_R = 0.38;
function pushOutOfWalls(p: THREE.Vector3, v: THREE.Vector3) {
  for (const d of disks) {
    if (p.y >= d.top - 0.35 || p.y + 1 < d.bottom) continue;
    const dx = p.x - d.x, dz = p.z - d.z;
    const dist = Math.hypot(dx, dz);
    const min = d.r + BODY_R;
    if (dist < min && dist > 1e-4) {
      const nx = dx / dist, nz = dz / dist;
      p.x = d.x + nx * min;
      p.z = d.z + nz * min;
      const vn = v.x * nx + v.z * nz;
      if (vn < 0) { v.x -= vn * nx; v.z -= vn * nz; }
    }
  }
}

// Random helper (deterministic so screenshots are comparable)
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function onWalkable(x: number, z: number, margin = 0.8) {
  return Math.hypot(x, z) < islandR(Math.atan2(z, x)) - margin;
}
function blocked(x: number, z: number, pad: number) {
  return disks.some((d) => Math.hypot(x - d.x, z - d.z) < d.r + pad);
}

// Autumn trees
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3426, roughness: 0.9 });
const leafMats = [0xff8a4c, 0xf25f5c, 0xffc15e, 0xe86a92].map(
  (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, flatShading: true }),
);
const treeSpots: Array<[number, number, number]> = [];
for (let tries = 0; treeSpots.length < 7 && tries < 200; tries++) {
  const a = rnd() * Math.PI * 2, r = 4 + rnd() * 5;
  const x = Math.cos(a) * r, z = Math.sin(a) * r;
  if (!onWalkable(x, z, 1.2) || blocked(x, z, 1.5) || Math.hypot(x, z - 5) < 3 || Math.hypot(x - 3.5, z - 1) < 2.5) continue;
  if (treeSpots.some(([tx, , tz]) => Math.hypot(tx - x, tz - z) < 3)) continue;
  treeSpots.push([x, 0, z]);
}
treeSpots.push([terrace.x - 1.3, terrace.top, terrace.z - 1]);
for (const [x, y, z] of treeSpots) {
  const g = new THREE.Group();
  const h = 1.2 + rnd() * 0.8;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, h, 7), trunkMat);
  trunk.position.y = h / 2;
  trunk.rotation.z = (rnd() - 0.5) * 0.2;
  trunk.castShadow = true;
  g.add(trunk);
  const mat = leafMats[Math.floor(rnd() * leafMats.length)]!;
  for (let k = 0; k < 3; k++) {
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7 - k * 0.12 + rnd() * 0.2, 1), mat);
    blob.position.set((rnd() - 0.5) * 0.7, h + 0.3 + k * 0.45, (rnd() - 0.5) * 0.7);
    blob.castShadow = true;
    g.add(blob);
  }
  g.position.set(x, y, z);
  g.rotation.y = rnd() * 6;
  world.add(g);
  disks.push({ x, z, r: 0.25, top: y + h + 0.2, bottom: y - 1 }); // trunk collider
}

// Lanterns (emissive → bloom)
const lanternGlow = new THREE.MeshStandardMaterial({ color: 0xffd08a, emissive: 0xffa040, emissiveIntensity: 3.5 });
const postMat = new THREE.MeshStandardMaterial({ color: 0x3a2a3a, roughness: 0.5, metalness: 0.6 });
const lanterns: THREE.Mesh[] = [];
for (const [x, y, z] of [[2.2, 0, 3.6], [-6.2, 0, 2.5], [-1.4, terrace.top, -1.2], [5.9, 0, -3.2], [islet.x - 0.8, islet.top, islet.z + 0.6]] as const) {
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.3, 6), postMat);
  p.position.set(x, y + 0.65, z);
  p.castShadow = true;
  const l = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), lanternGlow.clone());
  l.position.set(x, y + 1.42, z);
  world.add(p, l);
  lanterns.push(l);
}

// Grass tufts + flowers (instanced)
{
  const bladeGeo = new THREE.ConeGeometry(0.035, 0.22, 3);
  bladeGeo.translate(0, 0.11, 0);
  const blades = new THREE.InstancedMesh(bladeGeo, new THREE.MeshStandardMaterial({ color: 0x86c25a, roughness: 0.8 }), 1400);
  const flowerGeo = new THREE.IcosahedronGeometry(0.05, 0);
  const flowers = new THREE.InstancedMesh(flowerGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, emissive: 0x110805 }), 140);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), e = new THREE.Euler();
  const flowerCols = [0xffe36e, 0xff7eb6, 0xffffff, 0x9be7ff].map((c) => new THREE.Color(c));
  let bi = 0, fi = 0;
  for (let tries = 0; tries < 6000 && bi < blades.count; tries++) {
    const x = (rnd() - 0.5) * 22, z = (rnd() - 0.5) * 22;
    if (!onWalkable(x, z, 0.3)) continue;
    const y = groundAt(x, z, 10) ?? 0;
    if (y === 0 && blocked(x, z, 0.1)) continue;
    e.set((rnd() - 0.5) * 0.5, rnd() * 6, (rnd() - 0.5) * 0.5);
    q.setFromEuler(e);
    const k = 0.6 + rnd() * 0.8;
    s.set(k, k, k);
    m.compose(new THREE.Vector3(x, y, z), q, s);
    blades.setMatrixAt(bi++, m);
    if (fi < flowers.count && rnd() < 0.13) {
      m.compose(new THREE.Vector3(x + 0.1, y + 0.25 * k, z), q, s.set(1, 1, 1));
      flowers.setMatrixAt(fi, m);
      flowers.setColorAt(fi++, flowerCols[fi % flowerCols.length]!);
    }
  }
  blades.count = bi;
  flowers.count = fi;
  blades.receiveShadow = true;
  world.add(blades, flowers);
}

// Clouds: a sea below + a few drifting puffs
const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffe2d6, roughness: 1, emissive: 0x6a3a5a, emissiveIntensity: 0.25 });
const clouds = new THREE.Group();
for (let i = 0; i < 26; i++) {
  const puff = new THREE.Group();
  const n = 3 + Math.floor(rnd() * 3);
  for (let k = 0; k < n; k++) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5 + rnd() * 1.8, 2), cloudMat);
    b.position.set(k * 1.8 - n, rnd() * 0.8, (rnd() - 0.5) * 1.5);
    b.scale.y = 0.55;
    puff.add(b);
  }
  const high = i % 4 === 0;
  const a = rnd() * Math.PI * 2, r = (high ? 45 : 18) + rnd() * 45;
  puff.position.set(Math.cos(a) * r, -14 - rnd() * 10 + (high ? 20 : 0), Math.sin(a) * r);
  puff.rotation.y = rnd() * 6;
  puff.scale.setScalar(1 + rnd() * 1.5);
  clouds.add(puff);
}
scene.add(clouds);

// ---------------------------------------------------------------------------
// Pip — the fox-dragon
// ---------------------------------------------------------------------------
const pip = new THREE.Group(); // feet at origin, faces +Z
const rig = new THREE.Group();
pip.add(rig);
const furMat = new THREE.MeshPhysicalMaterial({ color: 0xff8a3d, roughness: 0.45, sheen: 1, sheenColor: new THREE.Color(0xffd0a0), sheenRoughness: 0.5 });
const bellyMat = new THREE.MeshStandardMaterial({ color: 0xfff0d8, roughness: 0.6 });
const tealMat = new THREE.MeshStandardMaterial({ color: 0x2ad1c0, roughness: 0.35, metalness: 0.1, emissive: 0x0a4a48, emissiveIntensity: 0.6 });
const wingMat = new THREE.MeshStandardMaterial({ color: 0x5ff0dc, roughness: 0.4, transparent: true, opacity: 0.85, side: THREE.DoubleSide, emissive: 0x19a090, emissiveIntensity: 0.8 });
const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1030, roughness: 0.15 });
const emberMat = new THREE.MeshStandardMaterial({ color: 0xffd070, emissive: 0xff6a20, emissiveIntensity: 5 });

const bodyMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.38, 6, 14), furMat);
bodyMesh.rotation.x = Math.PI / 2;
bodyMesh.position.y = 0.5;
const belly = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 10), bellyMat);
belly.scale.set(0.9, 0.8, 1.2);
belly.position.set(0, 0.42, 0.08);
const head = new THREE.Group();
head.position.set(0, 0.88, 0.32);
const skull = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 16), furMat);
const snout = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), bellyMat);
snout.scale.set(1.1, 0.8, 1.1);
snout.position.set(0, -0.08, 0.24);
const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), eyeMat);
nose.position.set(0, -0.03, 0.4);
for (const sx of [-1, 1]) {
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), eyeMat);
  eye.scale.set(0.8, 1.15, 0.6);
  eye.position.set(sx * 0.13, 0.05, 0.24);
  const glint = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  glint.position.set(sx * 0.11, 0.09, 0.3);
  const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.38, 8), tealMat);
  ear.position.set(sx * 0.17, 0.27, -0.08);
  ear.rotation.set(-0.7, 0, -sx * 0.35);
  head.add(eye, glint, ear);
}
head.add(skull, snout, nose);
const wings: THREE.Mesh[] = [];
{
  const ws = new THREE.Shape();
  ws.moveTo(0, 0);
  ws.quadraticCurveTo(0.5, 0.35, 1.0, 0.25);
  ws.lineTo(0.8, 0.05);
  ws.lineTo(0.95, -0.12);
  ws.lineTo(0.6, -0.1);
  ws.lineTo(0.62, -0.28);
  ws.quadraticCurveTo(0.3, -0.18, 0, -0.12);
  const wg = new THREE.ShapeGeometry(ws);
  wg.rotateX(-Math.PI / 2); // lie flat, span along +X
  for (const sx of [-1, 1]) {
    const w = new THREE.Mesh(wg, wingMat);
    w.scale.x = sx;
    w.position.set(sx * 0.18, 0.72, 0.05);
    w.castShadow = true;
    wings.push(w);
    rig.add(w);
  }
}
const tail: THREE.Object3D[] = [];
{
  let parent: THREE.Object3D = rig;
  let off = new THREE.Vector3(0, 0.5, -0.38);
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Group();
    seg.position.copy(off);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.13 - i * 0.025, 10, 8), i === 3 ? emberMat : furMat);
    ball.castShadow = true;
    seg.add(ball);
    parent.add(seg);
    tail.push(seg);
    parent = seg;
    off = new THREE.Vector3(0, 0.05, -0.17);
  }
}
const legs: THREE.Mesh[] = [];
for (const [lx, lz] of [[-0.16, 0.2], [0.16, 0.2], [-0.16, -0.2], [0.16, -0.2]] as const) {
  const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.18, 4, 8), furMat);
  leg.geometry.translate(0, -0.13, 0);
  leg.position.set(lx, 0.3, lz);
  leg.castShadow = true;
  legs.push(leg);
  rig.add(leg);
}
bodyMesh.castShadow = skull.castShadow = true;
rig.add(bodyMesh, belly, head);
scene.add(pip);

// Dash streak
const streak = new THREE.Mesh(
  new THREE.ConeGeometry(0.32, 2.2, 12, 1, true).rotateX(-Math.PI / 2).translate(0, 0.55, -1.1),
  new THREE.MeshBasicMaterial({ color: 0x8ff7ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
);
pip.add(streak);

// Blob shadow under Pip helps depth reading mid-air
const blob = new THREE.Mesh(
  new THREE.CircleGeometry(0.42, 20).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0x2a1030, transparent: true, opacity: 0.35, depthWrite: false }),
);
scene.add(blob);

// ---------------------------------------------------------------------------
// Gems
// ---------------------------------------------------------------------------
type Gem = { mesh: THREE.Mesh; ring: THREE.Mesh; base: THREE.Vector3; color: number; taken: boolean; t: number };
const GEM_COLORS = [0xff3b6b, 0x3bb4ff, 0x46f08a, 0xc46bff, 0xffc93b];
const gemSpots = [
  new THREE.Vector3(0.5, 0.8, 1.2), // ground, ahead of spawn
  new THREE.Vector3(4.2, 2.3, -0.8), // jump height
  new THREE.Vector3(terrace.x + 0.6, terrace.top + 0.8, terrace.z + 0.4), // terrace
  new THREE.Vector3(pillar.x, pillar.top + 0.8, pillar.z), // pillar (from terrace)
  new THREE.Vector3(islet.x, islet.top + 0.8, islet.z), // islet (glide / dash-leap)
];
const gemGeo = new THREE.OctahedronGeometry(0.3, 0);
gemGeo.scale(1, 1.45, 1);
const gems: Gem[] = gemSpots.map((base, i) => {
  const color = GEM_COLORS[i]!;
  const mesh = new THREE.Mesh(
    gemGeo,
    new THREE.MeshPhysicalMaterial({
      color, emissive: color, emissiveIntensity: 0.9, metalness: 0.2, roughness: 0.05,
      clearcoat: 1, flatShading: true,
    }),
  );
  mesh.position.copy(base);
  mesh.castShadow = true;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.35, 0.5, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  ring.position.set(base.x, (groundAt(base.x, base.z, base.y) ?? base.y - 0.8) + 0.03, base.z);
  scene.add(mesh, ring);
  return { mesh, ring, base, color, taken: false, t: 0 };
});
const gemsEl = document.getElementById('gems')!;
gemsEl.innerHTML = GEM_COLORS.map((c) => `<div class="gem" style="background:#${c.toString(16).padStart(6, '0')};color:#${c.toString(16).padStart(6, '0')}"></div>`).join('');

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
const keys = new Set<string>();
let jumpQueued = false;
let dashQueued = false;
addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'Space') jumpQueued = true;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') dashQueued = true;
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

// ---------------------------------------------------------------------------
// GUI
// ---------------------------------------------------------------------------
const gui = createFeelPanel(feel);
const extras = gui.addFolder('Pip extras');
extras.add(feel, 'fallGravityMul', 1, 2.5, 0.05);
extras.add(feel, 'jumpCut', 0.2, 1, 0.05);
extras.add(feel, 'glideSpeedMul', 0.6, 1.8, 0.05);
extras.add(feel, 'camFollow', 0, 5, 0.1);
gui.add(ui, 'preset', Object.keys(PRESETS)).name('variation').onChange((name: string) => {
  Object.assign(feel, PRESETS[name]);
  gui.controllersRecursive().forEach((c) => c.updateDisplay());
});
if (innerWidth < 1400) gui.close();

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------
const SPAWN = new THREE.Vector3(0, 0, 5.5);
const pos = SPAWN.clone();
const vel = new THREE.Vector3();
let heading = Math.PI; // facing -Z (toward terrace)
let grounded = true;
let coyote = 0, jumpBuf = 0, dashT = 0, dashCd = 0;
let airDashAvailable = true;
let canCut = false;
let gliding = false;
let jumpOriginY = 0, jumpTimer = 0, apexPending = false, peakY = 0;
let airTimer = 0;
let squash = 0, squashV = 0;
let runPhase = 0;
let wingOpen = 0;
let status: 'playing' | 'won' = 'playing';
let elapsed = 0, deaths = 0;

const juice = new Juice(scene, camera, 72);
const dust = new Juice(scene, camera, 40);

const camState = { yaw: 0, dist: 7.2, height: 3.2, fov: 58 };
const camTarget = new THREE.Vector3().copy(pos);
camera.position.set(pos.x, pos.y + camState.height, pos.z + camState.dist);

const wish = new THREE.Vector3();
const tmp = new THREE.Vector3();
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

function respawn() {
  pos.copy(SPAWN);
  vel.set(0, 0, 0);
  deaths += 1;
  heading = Math.PI;
  camState.yaw = 0;
  camTarget.set(pos.x, pos.y + 0.9, pos.z);
  camera.position.set(pos.x, pos.y + 0.9 + camState.height, pos.z + camState.dist);
  juice.bump(0.35);
  juice.burst(pos.clone().setY(0.6), 0xff8a3d);
}

function step(dt: number) {
  const space = keys.has('Space');

  // Camera-relative intent
  let ix = 0, iz = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) iz += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) iz -= 1;
  const fx = -Math.sin(camState.yaw), fz = -Math.cos(camState.yaw); // camera → player
  wish.set(fx * iz - fz * ix, 0, fz * iz + fx * ix);
  if (wish.lengthSq() > 1) wish.normalize();

  if (jumpQueued) { jumpBuf = feel.jumpBuffer; jumpQueued = false; } else jumpBuf = Math.max(0, jumpBuf - dt);
  coyote = grounded ? feel.coyoteTime : Math.max(0, coyote - dt);
  dashCd = Math.max(0, dashCd - dt);

  // Jump
  if (jumpBuf > 0 && coyote > 0) {
    vel.y = feel.jumpVelocity;
    jumpBuf = 0; coyote = 0; grounded = false; canCut = true;
    jumpOriginY = pos.y; jumpTimer = 0; apexPending = true; peakY = pos.y;
    metrics.jumps += 1;
    squashV += 9; // stretch
    juice.bump(0.06);
    dust.burst(pos.clone().setY(pos.y + 0.1), 0xf0d0b0);
  }
  // Variable height
  if (canCut && !space && vel.y > 0) { vel.y *= feel.jumpCut; canCut = false; }
  if (vel.y <= 0) canCut = false;

  // Dash (ground anytime off cooldown; one per airtime)
  if (dashQueued) {
    dashQueued = false;
    if (dashCd <= 0 && (grounded || airDashAvailable)) {
      const dir = wish.lengthSq() > 0.01 ? wish.clone().normalize() : new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
      vel.x = dir.x * feel.dashSpeed;
      vel.z = dir.z * feel.dashSpeed;
      if (!grounded) { vel.y = Math.max(vel.y, 2.0); airDashAvailable = false; }
      heading = Math.atan2(dir.x, dir.z);
      dashT = feel.dashDuration;
      dashCd = feel.dashDuration + 0.12;
      metrics.dashesUsed += 1;
      juice.bump(0.18);
      juice.burst(pos.clone().setY(pos.y + 0.5), 0x8ff7ff);
      camState.fov = 70;
    }
  }

  // Gravity / glide
  gliding = !grounded && space && vel.y < 0 && dashT <= 0;
  if (dashT > 0) {
    dashT -= dt;
    vel.y -= feel.gravity * 0.25 * dt; // dash hangs in the air a bit
  } else if (gliding) {
    vel.y -= feel.gravity * feel.glideGravityScale * dt;
    vel.y *= Math.exp(-feel.glideDrag * dt);
    metrics.glideTime += dt;
  } else {
    vel.y -= feel.gravity * (vel.y < 0 ? feel.fallGravityMul : 1) * dt;
  }

  // Horizontal accel (m/s²), momentum carries out of dash
  if (dashT <= 0) {
    const maxSp = feel.moveSpeed * (gliding ? feel.glideSpeedMul : 1);
    const desiredX = wish.x * maxSp, desiredZ = wish.z * maxSp;
    let a = feel.accel * (grounded ? 1 : feel.airControl);
    if (vel.x * desiredX + vel.z * desiredZ < 0) a *= 1.6; // snappy reversals
    if (!grounded && wish.lengthSq() < 0.01) a *= 0.25; // keep air momentum when no input
    const dx = desiredX - vel.x, dz = desiredZ - vel.z;
    const dl = Math.hypot(dx, dz);
    const maxDv = a * dt;
    if (dl <= maxDv) { vel.x = desiredX; vel.z = desiredZ; } else { vel.x += (dx / dl) * maxDv; vel.z += (dz / dl) * maxDv; }
  }

  // Integrate + collide
  const prevY = pos.y;
  pos.addScaledVector(vel, dt);
  pushOutOfWalls(pos, vel);
  const wasGrounded = grounded;
  grounded = false;
  if (vel.y <= 0) {
    const g = groundAt(pos.x, pos.z, prevY + (wasGrounded ? 0.4 : 0.05));
    if (g !== null && pos.y <= g) {
      const impact = -vel.y;
      pos.y = g; vel.y = 0; grounded = true; airDashAvailable = true;
      if (!wasGrounded) {
        metrics.lastAirTime = airTimer;
        if (impact > 6) {
          squashV -= Math.min(impact * 0.9, 12);
          dust.burst(pos.clone().setY(g + 0.05), 0xf0d0b0);
          if (impact > 14) juice.bump(0.12);
        }
      }
    }
  }
  if (grounded) airTimer = 0; else airTimer += dt;

  // Apex tracking
  if (apexPending) {
    jumpTimer += dt;
    peakY = Math.max(peakY, pos.y);
    if (vel.y <= 0 || grounded) {
      metrics.lastJumpApex = peakY - jumpOriginY;
      metrics.lastTimeToApex = jumpTimer;
      metrics.maxApex = Math.max(metrics.maxApex, metrics.lastJumpApex);
      apexPending = false;
    }
  }
  metrics.maxSpeed = Math.max(metrics.maxSpeed, Math.hypot(vel.x, vel.z));

  // Facing
  if (wish.lengthSq() > 0.01 && dashT <= 0) {
    const target = Math.atan2(wish.x, wish.z);
    heading += wrap(target - heading) * (1 - Math.exp(-feel.turnRate * dt));
  }

  // Squash spring
  squashV += (-squash * 180 - squashV * 14) * dt;
  squash += squashV * dt;

  if (pos.y < -14) respawn();
}

// ---------------------------------------------------------------------------
// Frame
// ---------------------------------------------------------------------------
const statusEl = document.getElementById('status')!;
const banner = document.getElementById('banner')!;
const bannerSub = document.getElementById('bannerSub')!;
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  forge.setSize(innerWidth, innerHeight);
  post.setSize(innerWidth, innerHeight);
});

const timer = new THREE.Timer();
let acc = 0;
const H = 1 / 120;
let simTime = 0;

function frame(ts: number) {
  timer.update(ts);
  const dt = Math.min(timer.getDelta(), 0.2); // substepped, so big frames stay stable
  acc += dt;
  while (acc >= H) {
    step(H);
    acc -= H;
    simTime += H;
    if (status === 'playing') elapsed += H;
  }

  // --- Pip visuals ---
  pip.position.copy(pos);
  pip.rotation.y = heading;
  const hSpeed = Math.hypot(vel.x, vel.z);
  const s = THREE.MathUtils.clamp(squash * 0.06, -0.35, 0.35);
  rig.scale.set(1 - s * 0.6, 1 + s, 1 - s * 0.6);
  const lean = grounded ? Math.min(hSpeed / feel.moveSpeed, 1.3) * 0.12 : THREE.MathUtils.clamp(-vel.y * 0.03, -0.25, 0.3);
  rig.rotation.x = THREE.MathUtils.damp(rig.rotation.x, gliding ? 0.18 : lean, 10, dt);
  runPhase += dt * (grounded ? hSpeed * 2.4 : 0);
  legs.forEach((l, i) => {
    const target = grounded ? Math.sin(runPhase + (i % 2 === (i < 2 ? 0 : 1) ? 0 : Math.PI)) * Math.min(hSpeed / 4, 1) * 0.9 : (i < 2 ? -0.6 : 0.7);
    l.rotation.x = THREE.MathUtils.damp(l.rotation.x, target, 18, dt);
  });
  rig.position.y = grounded ? Math.abs(Math.sin(runPhase)) * Math.min(hSpeed / feel.moveSpeed, 1) * 0.07 : 0;
  wingOpen = THREE.MathUtils.damp(wingOpen, gliding ? 1 : !grounded ? 0.35 : 0, gliding ? 14 : 8, dt);
  wings.forEach((w, i) => {
    const sx = i === 0 ? -1 : 1;
    const flap = gliding ? Math.sin(simTime * 9) * 0.08 : 0;
    w.scale.set(sx * (0.3 + wingOpen * 1.0), 1, 0.4 + wingOpen * 0.8);
    w.rotation.z = sx * (0.9 * (1 - wingOpen) + flap - 0.1 * wingOpen);
  });
  tail.forEach((t, i) => {
    t.rotation.y = Math.sin(simTime * 5 - i * 0.7) * (0.25 + (gliding ? 0.15 : 0));
    t.rotation.x = grounded ? 0.15 : -vel.y * 0.02;
  });
  head.rotation.x = gliding ? -0.25 : 0;
  emberMat.emissiveIntensity = 4 + Math.sin(simTime * 8) * 1.2 + (dashT > 0 ? 6 : 0);
  (streak.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.damp(
    (streak.material as THREE.MeshBasicMaterial).opacity, dashT > 0 ? 0.55 : 0, 20, dt,
  );
  streak.scale.z = 0.4 + hSpeed / feel.dashSpeed;

  const gY = groundAt(pos.x, pos.z, pos.y + 0.05);
  blob.visible = gY !== null;
  if (gY !== null) {
    blob.position.set(pos.x, gY + 0.02, pos.z);
    const hgt = pos.y - gY;
    blob.scale.setScalar(Math.max(0.4, 1 - hgt * 0.12));
    (blob.material as THREE.MeshBasicMaterial).opacity = Math.max(0.1, 0.35 - hgt * 0.04);
  }

  // --- Gems ---
  const center = tmp.copy(pos).setY(pos.y + 0.55);
  for (const gem of gems) {
    if (!gem.taken) {
      gem.mesh.rotation.y += dt * 1.8;
      gem.mesh.position.y = gem.base.y + Math.sin(simTime * 2.6 + gem.base.x) * 0.14;
      gem.ring.scale.setScalar(1 + Math.sin(simTime * 3 + gem.base.z) * 0.08);
      if (center.distanceTo(gem.mesh.position) < 1.0) {
        gem.taken = true;
        metrics.gemsCollected += 1;
        juice.burst(gem.mesh.position.clone(), gem.color);
        juice.bump(0.2);
        squashV += 6;
        (gemsEl.children[gems.indexOf(gem)] as HTMLElement).classList.add('got');
        gem.ring.visible = false;
      }
    } else if (gem.t < 1) {
      gem.t = Math.min(1, gem.t + dt * 1.6);
      gem.mesh.position.y += dt * 4;
      gem.mesh.rotation.y += dt * 14;
      gem.mesh.scale.setScalar(Math.max(0.001, 1 - gem.t));
      if (gem.t >= 1) gem.mesh.visible = false;
    }
  }
  if (status === 'playing' && metrics.gemsCollected >= gems.length) {
    status = 'won';
    banner.style.display = 'grid';
    bannerSub.textContent = `${elapsed.toFixed(1)}s · ${metrics.dashesUsed} dashes · ${deaths} falls`;
    juice.burst(pos.clone().setY(pos.y + 1), 0xffd070);
    juice.bump(0.3);
    lanterns.forEach((l) => ((l.material as THREE.MeshStandardMaterial).emissiveIntensity = 7));
  }

  // --- World motion ---
  lanterns.forEach((l, i) => ((l.material as THREE.MeshStandardMaterial).emissive.setHSL(0.08, 1, 0.5 + Math.sin(simTime * 3 + i) * 0.05)));
  isletGroup.position.y = Math.sin(simTime * 0.8) * 0.04;
  clouds.rotation.y += dt * 0.004;

  // --- Camera: Spyro-style trailing yaw + Q/E orbit ---
  if (keys.has('KeyQ')) camState.yaw += dt * 2.2;
  if (keys.has('KeyE')) camState.yaw -= dt * 2.2;
  const behind = heading + Math.PI;
  const moving = hSpeed > 1 && !keys.has('KeyS') && !keys.has('ArrowDown');
  if (moving) camState.yaw += wrap(behind - camState.yaw) * (1 - Math.exp(-feel.camFollow * Math.min(hSpeed / feel.moveSpeed, 1) * dt));
  const look = tmp.set(pos.x + vel.x * 0.12, pos.y + 0.9, pos.z + vel.z * 0.12);
  camTarget.x = THREE.MathUtils.damp(camTarget.x, look.x, 8, dt);
  camTarget.z = THREE.MathUtils.damp(camTarget.z, look.z, 8, dt);
  camTarget.y = THREE.MathUtils.damp(camTarget.y, look.y, grounded ? 6 : 2.5, dt);
  camTarget.y = THREE.MathUtils.clamp(camTarget.y, pos.y - 0.6, pos.y + 1.8);
  const camPos = new THREE.Vector3(
    camTarget.x + Math.sin(camState.yaw) * camState.dist,
    camTarget.y + camState.height,
    camTarget.z + Math.cos(camState.yaw) * camState.dist,
  );
  const camGround = groundAt(camPos.x, camPos.z, camPos.y);
  if (camGround !== null) camPos.y = Math.max(camPos.y, camGround + 0.8);
  camera.position.lerp(camPos, 1 - Math.exp(-10 * dt));
  camera.lookAt(camTarget);
  camState.fov = THREE.MathUtils.damp(camState.fov, gliding ? 62 : 58, 4, dt);
  camera.fov = camState.fov;
  camera.updateProjectionMatrix();
  dust.update(dt);
  juice.update(dt);

  // --- HUD + harness ---
  const mode = gliding ? 'GLIDE' : dashT > 0 ? 'DASH' : grounded ? 'ground' : 'air';
  statusEl.textContent = status === 'won'
    ? `All gems! ${elapsed.toFixed(1)}s`
    : `${metrics.gemsCollected}/5 gems · ${elapsed.toFixed(1)}s · ${mode} · ${ui.preset} · ${backend}`;

  publishGame({
    title: 'Ember Mesa (smoke-opus)',
    status,
    score: metrics.gemsCollected * 100 + (status === 'won' ? Math.max(0, 600 - Math.floor(elapsed * 5)) : 0),
    lives: 1,
    elapsedSec: Number(elapsed.toFixed(2)),
    deaths,
    backend,
    winCondition: 'Collect 5 gems',
    loseCondition: 'None (falls respawn, counted as deaths)',
    notes: [
      `preset=${ui.preset}`,
      `lastJumpApex=${metrics.lastJumpApex.toFixed(2)}`,
      `maxApex=${metrics.maxApex.toFixed(2)}`,
      `lastTimeToApex=${metrics.lastTimeToApex.toFixed(3)}`,
      `lastAirTime=${metrics.lastAirTime.toFixed(2)}`,
      `glideTime=${metrics.glideTime.toFixed(2)}`,
      `dashesUsed=${metrics.dashesUsed}`,
      `jumps=${metrics.jumps}`,
      `maxSpeed=${metrics.maxSpeed.toFixed(1)}`,
      `gemsCollected=${metrics.gemsCollected}`,
      `mode=${mode}`,
      `pos=${pos.x.toFixed(2)},${pos.y.toFixed(2)},${pos.z.toFixed(2)}`,
      `camYaw=${camState.yaw.toFixed(3)}`,
    ],
  });

  post.render();
  requestAnimationFrame(frame);
}

publishGame({ title: 'Ember Mesa (smoke-opus)', status: 'ready', score: 0, lives: 1, elapsedSec: 0, deaths: 0, backend });
requestAnimationFrame(frame);
