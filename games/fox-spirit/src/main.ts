import * as THREE from 'three';
import { publishGame } from '../../shared/game-state';
import { createForgeRenderer } from '../../shared/renderer';
import { applyStylizedIslandLights } from '../../shared/environment';
import { createPostStack } from '../../shared/postfx';
import { Juice } from '../../shared/juice';
import {
  PRESET_SPRING,
  createFeelPanel,
  JumpFeel,
  emptyFeelMetrics,
  type FeelParams,
} from '../../shared/character-feel';
import {
  createColorMaskState,
  updateColorTrail,
  applyColorMaskToMaterial,
  syncColorMaskUniforms,
} from '../../shared/color-mask';

const feel: FeelParams = { ...PRESET_SPRING };
const jumpFeel = new JumpFeel();
const feelMetrics = emptyFeelMetrics();
const mask = createColorMaskState();
mask.auraRadius = 2.8;

// Sepia fog / parchment sky until shrine
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xc4a882, 0.018);
scene.background = new THREE.Color(0xb89a72);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 200);
const forge = await createForgeRenderer();
const { renderer, backend } = forge;
applyStylizedIslandLights(scene);
const post = createPostStack(renderer, scene, camera);
post.bloom.strength = 0.38;
post.bloom.threshold = 0.72;

const maskedMats: THREE.MeshStandardMaterial[] = [];
function worldMat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.04, ...opts });
  applyColorMaskToMaterial(m, mask);
  maskedMats.push(m);
  return m;
}

// --- Autumn island (rich chroma under mask; reads sepia until awakened) ---
const island = new THREE.Group();
scene.add(island);
const top = new THREE.Mesh(new THREE.CylinderGeometry(11, 12, 1.4, 48), worldMat(0x6b8f3a));
top.receiveShadow = true;
top.castShadow = true;
island.add(top);
const under = new THREE.Mesh(new THREE.ConeGeometry(12, 9, 48), worldMat(0x6a4030));
under.position.y = -5;
under.castShadow = true;
island.add(under);

// Rust rocks + maple trees
for (let i = 0; i < 6; i++) {
  const ang = (i / 6) * Math.PI * 2;
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.75, 0), worldMat(0x8a6a4a));
  rock.position.set(Math.cos(ang) * 7, 0.7, Math.sin(ang) * 7);
  rock.castShadow = true;
  island.add(rock);
}
const leafColors = [0xc45a1a, 0xd4762c, 0xb33a1a, 0xe8a03c, 0x8b2e1a];
for (let i = 0; i < 5; i++) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 1.4, 6), worldMat(0x4a3020));
  trunk.position.y = 1.05;
  trunk.castShadow = true;
  const canopy = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.95, 0),
    worldMat(leafColors[i % leafColors.length]!, { flatShading: true }),
  );
  canopy.position.y = 2.05;
  canopy.castShadow = true;
  g.add(trunk, canopy);
  const ang = (i / 5) * Math.PI * 2 + 0.4;
  g.position.set(Math.cos(ang) * 5.2, 0.7, Math.sin(ang) * 5.2);
  island.add(g);
}
// Leaf carpet patches
for (let i = 0; i < 14; i++) {
  const patch = new THREE.Mesh(
    new THREE.CircleGeometry(0.35 + Math.random() * 0.4, 7),
    worldMat(leafColors[i % leafColors.length]!, { roughness: 0.95 }),
  );
  patch.rotation.x = -Math.PI / 2;
  const a = Math.random() * Math.PI * 2;
  const r = 1.5 + Math.random() * 8;
  patch.position.set(Math.cos(a) * r, 0.72, Math.sin(a) * r);
  island.add(patch);
}
island.position.y = 2;

// --- Stone shrine (ruins tone from keyart) ---
const shrinePos = new THREE.Vector3(0, 2.7, -6.5);
mask.shrines.push({ position: shrinePos.clone(), radius: 14, activated: false });

const shrine = new THREE.Group();
const pedestal = new THREE.Mesh(
  new THREE.CylinderGeometry(0.7, 0.9, 0.5, 8),
  worldMat(0x8a7a68, { metalness: 0.25, roughness: 0.5 }),
);
pedestal.castShadow = true;
const crystal = new THREE.Mesh(
  new THREE.OctahedronGeometry(0.55, 0),
  new THREE.MeshStandardMaterial({
    color: 0xe8c090,
    emissive: 0x6a4020,
    emissiveIntensity: 0.35,
    metalness: 0.55,
    roughness: 0.25,
  }),
);
crystal.position.y = 1.0;
crystal.castShadow = true;
shrine.add(pedestal, crystal);
shrine.position.copy(shrinePos);
scene.add(shrine);

// --- Burnt-orange fox (grounded / mysterious — concept turnaround) ---
const fox = new THREE.Group();
const foxMats = {
  body: new THREE.MeshStandardMaterial({
    color: 0xc45a1a,
    emissive: 0x5a2008,
    emissiveIntensity: 0.18,
    roughness: 0.55,
    metalness: 0.05,
  }),
  belly: new THREE.MeshStandardMaterial({
    color: 0xf0e2cc,
    roughness: 0.65,
  }),
  sock: new THREE.MeshStandardMaterial({
    color: 0x2a1c14,
    roughness: 0.7,
  }),
  ember: new THREE.MeshStandardMaterial({
    color: 0xff6a1a,
    emissive: 0xff3a00,
    emissiveIntensity: 1.1,
    roughness: 0.25,
  }),
  flame: new THREE.MeshStandardMaterial({
    color: 0xff8a2a,
    emissive: 0xff5500,
    emissiveIntensity: 0.9,
    roughness: 0.3,
    transparent: true,
    opacity: 0.92,
  }),
};
// Longer lean body (not chibi)
const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 6, 12), foxMats.body);
body.rotation.z = Math.PI / 2;
body.castShadow = true;
const belly = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), foxMats.belly);
belly.position.set(0.02, -0.08, 0.08);
belly.scale.set(1.1, 0.85, 1.2);
const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 14), foxMats.body);
head.position.set(0.4, 0.1, 0);
head.scale.set(1.05, 0.95, 0.9);
head.castShadow = true;
const snout = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 6), foxMats.belly);
snout.rotation.z = -Math.PI / 2;
snout.position.set(0.55, 0.05, 0);
const earL = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 5), foxMats.body);
earL.position.set(0.38, 0.3, 0.08);
earL.rotation.x = -0.25;
const earR = earL.clone();
earR.position.z = -0.08;
const emberL = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), foxMats.ember);
emberL.position.set(0.38, 0.4, 0.08);
const emberR = emberL.clone();
emberR.position.z = -0.08;
// Charcoal socks
const legFL = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.14, 3, 6), foxMats.sock);
legFL.position.set(0.18, -0.28, 0.1);
const legFR = legFL.clone();
legFR.position.z = -0.1;
const legBL = legFL.clone();
legBL.position.set(-0.18, -0.28, 0.1);
const legBR = legFL.clone();
legBR.position.set(-0.18, -0.28, -0.1);
// Bushy flame tail
const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.55, 5, 10), foxMats.body);
tail.position.set(-0.5, 0.12, 0);
tail.rotation.z = 0.55;
const tailFlame = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.55, 7), foxMats.flame);
tailFlame.position.set(-0.85, 0.35, 0);
tailFlame.rotation.z = 2.4;
const tip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), foxMats.ember);
tip.position.set(-1.0, 0.48, 0);
fox.add(
  body, belly, head, snout, earL, earR, emberL, emberR,
  legFL, legFR, legBL, legBR, tail, tailFlame, tip,
);
const foxLight = new THREE.PointLight(0xff6622, 1.35, 8);
foxLight.position.set(-0.3, 0.35, 0);
fox.add(foxLight);
fox.position.set(0, 3.25, 3.5);
scene.add(fox);

// --- Embers + falling leaves (bypass color mask) ---
const EMBER_N = 28;
const LEAF_N = 36;
const emberGeo = new THREE.BufferGeometry();
const emberPos = new Float32Array(EMBER_N * 3);
const emberCol = new Float32Array(EMBER_N * 3);
const emberVel: THREE.Vector3[] = [];
for (let i = 0; i < EMBER_N; i++) {
  emberPos[i * 3] = 0;
  emberPos[i * 3 + 1] = 0;
  emberPos[i * 3 + 2] = 0;
  const c = new THREE.Color().setHSL(0.06 + Math.random() * 0.05, 0.95, 0.45 + Math.random() * 0.25);
  emberCol[i * 3] = c.r;
  emberCol[i * 3 + 1] = c.g;
  emberCol[i * 3 + 2] = c.b;
  emberVel.push(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.4 + Math.random() * 0.8, (Math.random() - 0.5) * 0.4));
}
emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
emberGeo.setAttribute('color', new THREE.BufferAttribute(emberCol, 3));
const embers = new THREE.Points(
  emberGeo,
  new THREE.PointsMaterial({
    size: 0.09,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }),
);
scene.add(embers);

const leafGeo = new THREE.BufferGeometry();
const leafPos = new Float32Array(LEAF_N * 3);
const leafCol = new Float32Array(LEAF_N * 3);
const leafPhase: number[] = [];
for (let i = 0; i < LEAF_N; i++) {
  leafPos[i * 3] = (Math.random() - 0.5) * 16;
  leafPos[i * 3 + 1] = 4 + Math.random() * 6;
  leafPos[i * 3 + 2] = (Math.random() - 0.5) * 16;
  const lc = leafColors[i % leafColors.length]!;
  const c = new THREE.Color(lc);
  leafCol[i * 3] = c.r;
  leafCol[i * 3 + 1] = c.g;
  leafCol[i * 3 + 2] = c.b;
  leafPhase.push(Math.random() * Math.PI * 2);
}
leafGeo.setAttribute('position', new THREE.BufferAttribute(leafPos, 3));
leafGeo.setAttribute('color', new THREE.BufferAttribute(leafCol, 3));
const leaves = new THREE.Points(
  leafGeo,
  new THREE.PointsMaterial({
    size: 0.16,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  }),
);
scene.add(leaves);

// Path gems (amber seeds)
const gems: Array<{ mesh: THREE.Mesh; taken: boolean }> = [];
for (let i = 0; i < 3; i++) {
  const mesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.22, 0),
    new THREE.MeshStandardMaterial({
      color: 0xffaa44,
      emissive: 0xff6600,
      emissiveIntensity: 0.85,
      metalness: 0.45,
      roughness: 0.25,
    }),
  );
  mesh.position.set((i - 1) * 2.2, 3.1, 1.5 - i * 2.2);
  scene.add(mesh);
  gems.push({ mesh, taken: false });
}

createFeelPanel(feel);
const juice = new Juice(scene, camera);
const keys = new Set<string>();
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));

const vel = new THREE.Vector3();
let grounded = false;
let dashT = 0;
let gliding = false;
let shrineOn = false;
let gemsGot = 0;
let elapsed = 0;
let status: 'playing' | 'won' = 'playing';
const spawn = fox.position.clone();
const camOffset = new THREE.Vector3(0, 4.2, 7.5);
const camTarget = new THREE.Vector3();
const statusEl = document.getElementById('status')!;

function groundY(x: number, z: number): number | null {
  if (Math.hypot(x, z) <= 11.2) return 2.7;
  return null;
}

function respawn() {
  fox.position.copy(spawn);
  vel.set(0, 0, 0);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  forge.setSize(innerWidth, innerHeight);
  post.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (status === 'playing') elapsed += dt;

  let ix = 0;
  let iz = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) iz -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) iz += 1;

  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  const wish = new THREE.Vector3();
  if (ix || iz) {
    wish.addScaledVector(right, ix).addScaledVector(forward, -iz).normalize();
  }

  const spaceDown = keys.has('Space');
  jumpFeel.sampleJumpEdge(spaceDown, dt, feel.jumpBuffer);

  const gy = groundY(fox.position.x, fox.position.z);
  const feetY = fox.position.y - 0.35;
  const wasGrounded = grounded;
  grounded = gy !== null && feetY <= gy + 0.08 && vel.y <= 0;
  if (grounded) {
    jumpFeel.onGrounded(feel.coyoteTime);
    if (jumpFeel.airTime > 0) {
      feelMetrics.lastAirTime = jumpFeel.airTime;
      feelMetrics.lastJumpApex = jumpFeel.apex;
      feelMetrics.lastTimeToApex = jumpFeel.timeToApex;
    }
    fox.position.y = gy! + 0.35;
    if (vel.y < 0) vel.y = 0;
    gliding = false;
    if (!wasGrounded) {
      fox.scale.set(1.15, 0.75, 1.15);
      juice.bump(0.06);
    }
  } else {
    jumpFeel.tickAir(dt, fox.position.y, vel.y);
  }

  const jv = jumpFeel.tryJump(feel.jumpVelocity, fox.position.y);
  if (jv !== null) {
    vel.y = jv;
    grounded = false;
    feelMetrics.jumps += 1;
    fox.scale.set(0.85, 1.2, 0.85);
    juice.bump(0.1);
  }

  if (!grounded && jumpFeel.apex > feelMetrics.lastJumpApex) {
    feelMetrics.lastJumpApex = jumpFeel.apex;
    feelMetrics.lastTimeToApex = jumpFeel.timeToApex;
  }

  vel.y = jumpFeel.applyCut(spaceDown, vel.y, feel.jumpCut);

  if ((keys.has('ShiftLeft') || keys.has('ShiftRight')) && dashT <= 0 && wish.lengthSq() > 0.01) {
    dashT = feel.dashDuration;
    vel.x = wish.x * feel.dashSpeed;
    vel.z = wish.z * feel.dashSpeed;
    feelMetrics.dashesUsed += 1;
    juice.burst(fox.position.clone(), 0xff6622);
    keys.delete('ShiftLeft');
    keys.delete('ShiftRight');
  }
  if (dashT > 0) dashT -= dt;

  gliding = !grounded && vel.y < 0 && spaceDown;
  vel.y -= feel.gravity * (gliding ? feel.glideGravityScale : 1) * dt;
  if (gliding) {
    vel.x *= Math.exp(-feel.glideDrag * dt);
    vel.z *= Math.exp(-feel.glideDrag * dt);
  }

  fox.scale.x += (1 - fox.scale.x) * Math.min(1, 12 * dt);
  fox.scale.y += (1 - fox.scale.y) * Math.min(1, 12 * dt);
  fox.scale.z += (1 - fox.scale.z) * Math.min(1, 12 * dt);

  if (dashT <= 0) {
    const desired = wish.clone().multiplyScalar(feel.moveSpeed);
    const control = grounded ? 1 : feel.airControl;
    const cur = new THREE.Vector3(vel.x, 0, vel.z);
    cur.lerp(desired, 1 - Math.exp(-feel.accel * control * dt));
    vel.x = cur.x;
    vel.z = cur.z;
  }

  fox.position.x += vel.x * dt;
  fox.position.y += vel.y * dt;
  fox.position.z += vel.z * dt;
  if (wish.lengthSq() > 0.01) {
    fox.rotation.y = THREE.MathUtils.damp(fox.rotation.y, Math.atan2(wish.x, wish.z), feel.turnRate, dt);
  }
  if (fox.position.y < -6) respawn();

  // Subtle tail sway
  tail.rotation.z = 0.55 + Math.sin(elapsed * 3.2) * 0.12;
  tailFlame.rotation.z = 2.4 + Math.sin(elapsed * 5.0) * 0.15;

  updateColorTrail(mask, dt, fox.position);
  for (const m of maskedMats) syncColorMaskUniforms(m, mask);

  // Embers rise from tail
  const ep = embers.geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < EMBER_N; i++) {
    let x = ep.getX(i) + emberVel[i]!.x * dt;
    let y = ep.getY(i) + emberVel[i]!.y * dt;
    let z = ep.getZ(i) + emberVel[i]!.z * dt;
    if (y > fox.position.y + 2.2 || Math.hypot(x - fox.position.x, z - fox.position.z) > 3) {
      x = fox.position.x - 0.7 + (Math.random() - 0.5) * 0.3;
      y = fox.position.y + 0.3 + Math.random() * 0.2;
      z = fox.position.z + (Math.random() - 0.5) * 0.3;
      emberVel[i]!.set((Math.random() - 0.5) * 0.5, 0.5 + Math.random() * 0.9, (Math.random() - 0.5) * 0.5);
    }
    ep.setXYZ(i, x, y, z);
  }
  ep.needsUpdate = true;

  // Falling maple leaves
  const lp = leaves.geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < LEAF_N; i++) {
    const ph = leafPhase[i]!;
    let x = lp.getX(i) + Math.sin(elapsed * 0.8 + ph) * 0.4 * dt;
    let y = lp.getY(i) - (0.35 + (i % 5) * 0.05) * dt;
    let z = lp.getZ(i) + Math.cos(elapsed * 0.6 + ph) * 0.3 * dt;
    if (y < 2.5) {
      y = 8 + Math.random() * 4;
      x = fox.position.x + (Math.random() - 0.5) * 14;
      z = fox.position.z + (Math.random() - 0.5) * 14;
    }
    lp.setXYZ(i, x, y, z);
  }
  lp.needsUpdate = true;

  for (const g of gems) {
    if (g.taken) continue;
    g.mesh.rotation.y += dt * 2.5;
    if (fox.position.distanceTo(g.mesh.position) < 0.85) {
      g.taken = true;
      g.mesh.visible = false;
      gemsGot += 1;
      feelMetrics.gemsCollected = gemsGot;
      juice.burst(g.mesh.position.clone(), 0xffaa44);
    }
  }

  crystal.rotation.y += dt * (shrineOn ? 2.5 : 0.8);
  crystal.position.y = 1.0 + Math.sin(elapsed * 2) * 0.08;
  if (!shrineOn && fox.position.distanceTo(shrinePos) < 1.6) {
    shrineOn = true;
    mask.shrines[0]!.activated = true;
    status = 'won';
    scene.background = new THREE.Color(0xd4a86a);
    scene.fog = new THREE.FogExp2(0xd4a86a, 0.014);
    crystal.material = new THREE.MeshStandardMaterial({
      color: 0xffcc66,
      emissive: 0xff7700,
      emissiveIntensity: 1.35,
      metalness: 0.55,
      roughness: 0.15,
    });
    juice.bump(0.45);
    juice.burst(shrinePos.clone(), 0xff8822);
    juice.burst(shrinePos.clone().add(new THREE.Vector3(0, 1, 0)), 0xffcc44);
  }

  camera.position.lerp(fox.position.clone().add(camOffset), 1 - Math.exp(-4 * dt));
  camTarget.lerp(fox.position.clone().add(new THREE.Vector3(0, 0.6, 0)), 1 - Math.exp(-6 * dt));
  camera.lookAt(camTarget);
  juice.update(dt);

  statusEl.textContent = shrineOn
    ? `AUTUMN RESTORED · shrine awake · gems ${gemsGot}/3 · ${elapsed.toFixed(1)}s`
    : `Sepia world · trail autumn as you run · shrine ahead · gems ${gemsGot}/3 · ${backend}`;

  publishGame({
    title: 'Fox Spirit',
    status,
    score: gemsGot * 100 + (shrineOn ? 1000 : 0),
    lives: 1,
    elapsedSec: Number(elapsed.toFixed(2)),
    deaths: 0,
    backend,
    winCondition: 'Activate autumn shrine',
    notes: [
      `shrine=${shrineOn}`,
      `trail=${mask.trail.length}`,
      `gems=${gemsGot}`,
      `apex=${feelMetrics.lastJumpApex.toFixed(3)}`,
      `cut=${jumpFeel.cutThisJump}`,
      `air=${feelMetrics.lastAirTime.toFixed(3)}`,
      `jumps=${feelMetrics.jumps}`,
      `dashes=${feelMetrics.dashesUsed}`,
      gliding ? 'glide' : grounded ? 'ground' : 'air',
    ],
    feel: {
      lastJumpApex: Number(feelMetrics.lastJumpApex.toFixed(3)),
      lastTimeToApex: Number(feelMetrics.lastTimeToApex.toFixed(3)),
      lastAirTime: Number(feelMetrics.lastAirTime.toFixed(3)),
      dashesUsed: feelMetrics.dashesUsed,
      jumps: feelMetrics.jumps,
      grounded,
      gliding,
    },
  });

  post.render();
  requestAnimationFrame(tick);
}

publishGame({
  title: 'Fox Spirit',
  status: 'playing',
  score: 0,
  lives: 1,
  elapsedSec: 0,
  deaths: 0,
  backend,
});
tick();
