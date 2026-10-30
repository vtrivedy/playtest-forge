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
mask.auraRadius = 2.6;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x6a6a6a, 0.016);
scene.background = new THREE.Color(0x6e6e6e);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 200);
const forge = await createForgeRenderer();
const { renderer, backend } = forge;
applyStylizedIslandLights(scene);
const post = createPostStack(renderer, scene, camera);
post.bloom.strength = 0.45;
post.bloom.threshold = 0.7;

const maskedMats: THREE.MeshStandardMaterial[] = [];
function worldMat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05, ...opts });
  applyColorMaskToMaterial(m, mask);
  maskedMats.push(m);
  return m;
}

// --- Island ---
const island = new THREE.Group();
scene.add(island);
const top = new THREE.Mesh(new THREE.CylinderGeometry(11, 12, 1.4, 48), worldMat(0x4a9a58));
top.receiveShadow = true;
top.castShadow = true;
island.add(top);
const under = new THREE.Mesh(new THREE.ConeGeometry(12, 9, 48), worldMat(0x6b4a32));
under.position.y = -5;
under.castShadow = true;
island.add(under);
for (let i = 0; i < 6; i++) {
  const ang = (i / 6) * Math.PI * 2;
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8, 0), worldMat(0x7a7a82));
  rock.position.set(Math.cos(ang) * 7, 0.7, Math.sin(ang) * 7);
  rock.castShadow = true;
  island.add(rock);
}
for (let i = 0; i < 4; i++) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.1, 6), worldMat(0x5a3a22));
  trunk.position.y = 0.9;
  trunk.castShadow = true;
  const leaf = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.85, 0),
    worldMat(0x2f7a45, { flatShading: true }),
  );
  leaf.position.y = 1.85;
  leaf.castShadow = true;
  g.add(trunk, leaf);
  const ang = (i / 4) * Math.PI * 2 + 0.5;
  g.position.set(Math.cos(ang) * 5, 0.7, Math.sin(ang) * 5);
  island.add(g);
}
island.position.y = 2;

// --- Shrine (payoff) ---
const shrinePos = new THREE.Vector3(0, 2.7, -6.5);
mask.shrines.push({ position: shrinePos.clone(), radius: 14, activated: false });

const shrine = new THREE.Group();
const pedestal = new THREE.Mesh(
  new THREE.CylinderGeometry(0.7, 0.9, 0.5, 8),
  worldMat(0x9a9aa8, { metalness: 0.4, roughness: 0.35 }),
);
pedestal.castShadow = true;
const crystal = new THREE.Mesh(
  new THREE.OctahedronGeometry(0.55, 0),
  new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x666666,
    emissiveIntensity: 0.4,
    metalness: 0.7,
    roughness: 0.2,
  }),
);
crystal.position.y = 1.0;
crystal.castShadow = true;
shrine.add(pedestal, crystal);
shrine.position.copy(shrinePos);
scene.add(shrine);

// --- Wispy multicolored fox (fully saturated — no color mask) ---
const fox = new THREE.Group();
const foxMats = {
  body: new THREE.MeshStandardMaterial({
    color: 0xff7a3c,
    emissive: 0xff2a6a,
    emissiveIntensity: 0.35,
    roughness: 0.4,
    metalness: 0.1,
  }),
  belly: new THREE.MeshStandardMaterial({
    color: 0xffe9a8,
    emissive: 0xffaa44,
    emissiveIntensity: 0.2,
    roughness: 0.45,
  }),
  accent: new THREE.MeshStandardMaterial({
    color: 0x6a5cff,
    emissive: 0x3a2aff,
    emissiveIntensity: 0.55,
    roughness: 0.3,
  }),
  tip: new THREE.MeshStandardMaterial({
    color: 0x5dffd0,
    emissive: 0x1affc0,
    emissiveIntensity: 0.8,
    roughness: 0.25,
  }),
};
const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.35, 6, 12), foxMats.body);
body.rotation.z = Math.PI / 2;
body.castShadow = true;
const belly = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), foxMats.belly);
belly.position.set(0, -0.05, 0.06);
const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 14), foxMats.body);
head.position.set(0.32, 0.12, 0);
head.castShadow = true;
const earL = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 5), foxMats.accent);
earL.position.set(0.28, 0.34, 0.08);
earL.rotation.x = -0.3;
const earR = earL.clone();
earR.position.z = -0.08;
const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.45, 4, 8), foxMats.accent);
tail.position.set(-0.45, 0.1, 0);
tail.rotation.z = 0.6;
const tip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), foxMats.tip);
tip.position.set(-0.7, 0.28, 0);
fox.add(body, belly, head, earL, earR, tail, tip);
const foxLight = new THREE.PointLight(0xff66aa, 1.6, 7);
foxLight.position.set(0, 0.3, 0);
fox.add(foxLight);
fox.position.set(0, 3.25, 3.5);
scene.add(fox);

// Wisp particles (saturated)
const wispCount = 40;
const wispGeo = new THREE.BufferGeometry();
const wispPos = new Float32Array(wispCount * 3);
wispGeo.setAttribute('position', new THREE.BufferAttribute(wispPos, 3));
const wispColors = new Float32Array(wispCount * 3);
for (let i = 0; i < wispCount; i++) {
  const c = new THREE.Color().setHSL((i / wispCount) * 0.9, 0.9, 0.6);
  wispColors[i * 3] = c.r;
  wispColors[i * 3 + 1] = c.g;
  wispColors[i * 3 + 2] = c.b;
}
wispGeo.setAttribute('color', new THREE.BufferAttribute(wispColors, 3));
const wisps = new THREE.Points(
  wispGeo,
  new THREE.PointsMaterial({
    size: 0.12,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }),
);
scene.add(wisps);

// Path gems (optional juice)
const gems: Array<{ mesh: THREE.Mesh; taken: boolean }> = [];
for (let i = 0; i < 3; i++) {
  const mesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.22, 0),
    new THREE.MeshStandardMaterial({
      color: 0xff66cc,
      emissive: 0xff2288,
      emissiveIntensity: 0.9,
      metalness: 0.5,
      roughness: 0.2,
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
  grounded = gy !== null && feetY <= gy + 0.1 && vel.y <= 0.15;
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
    // Landing squash
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
    fox.scale.set(0.85, 1.2, 0.85); // stretch on takeoff
    juice.bump(0.1);
  }

  // Variable jump height
  vel.y = jumpFeel.applyCut(spaceDown, vel.y, feel.jumpCut);

  if ((keys.has('ShiftLeft') || keys.has('ShiftRight')) && dashT <= 0 && wish.lengthSq() > 0.01) {
    dashT = feel.dashDuration;
    vel.x = wish.x * feel.dashSpeed;
    vel.z = wish.z * feel.dashSpeed;
    feelMetrics.dashesUsed += 1;
    juice.burst(fox.position.clone(), 0xff66aa);
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

  // Ease squash/stretch back
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

  // Color trail
  updateColorTrail(mask, dt, fox.position);
  for (const m of maskedMats) syncColorMaskUniforms(m, mask);

  // Wisps orbit fox
  const wp = wisps.geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < wispCount; i++) {
    const a = elapsed * 1.8 + i * 0.4;
    const r = 0.35 + (i % 5) * 0.08;
    wp.setXYZ(
      i,
      fox.position.x + Math.cos(a) * r,
      fox.position.y + 0.2 + Math.sin(a * 1.3) * 0.25,
      fox.position.z + Math.sin(a) * r,
    );
  }
  wp.needsUpdate = true;

  // Gems
  for (const g of gems) {
    if (g.taken) continue;
    g.mesh.rotation.y += dt * 2.5;
    if (fox.position.distanceTo(g.mesh.position) < 0.85) {
      g.taken = true;
      g.mesh.visible = false;
      gemsGot += 1;
      feelMetrics.gemsCollected = gemsGot;
      juice.burst(g.mesh.position.clone(), 0xff66cc);
    }
  }

  // Shrine activation
  crystal.rotation.y += dt * (shrineOn ? 2.5 : 0.8);
  crystal.position.y = 1.0 + Math.sin(elapsed * 2) * 0.08;
  if (!shrineOn && fox.position.distanceTo(shrinePos) < 1.6) {
    shrineOn = true;
    mask.shrines[0]!.activated = true;
    status = 'won';
    scene.background = new THREE.Color(0x7ec8ff);
    scene.fog = new THREE.FogExp2(0x7ec8ff, 0.014);
    crystal.material = new THREE.MeshStandardMaterial({
      color: 0xffe08a,
      emissive: 0xffaa33,
      emissiveIntensity: 1.4,
      metalness: 0.6,
      roughness: 0.15,
    });
    juice.bump(0.45);
    juice.burst(shrinePos.clone(), 0xffcc66);
    juice.burst(shrinePos.clone().add(new THREE.Vector3(0, 1, 0)), 0x66ffcc);
  }

  // Camera
  camera.position.lerp(fox.position.clone().add(camOffset), 1 - Math.exp(-4 * dt));
  camTarget.lerp(fox.position.clone().add(new THREE.Vector3(0, 0.6, 0)), 1 - Math.exp(-6 * dt));
  camera.lookAt(camTarget);
  juice.update(dt);

  statusEl.textContent = shrineOn
    ? `COLOR RESTORED · shrine awake · gems ${gemsGot}/3 · ${elapsed.toFixed(1)}s`
    : `Ink world · splash color as you run · shrine ahead · gems ${gemsGot}/3 · ${backend}`;

  publishGame({
    title: 'Fox Spirit',
    status,
    score: gemsGot * 100 + (shrineOn ? 1000 : 0),
    lives: 1,
    elapsedSec: Number(elapsed.toFixed(2)),
    deaths: 0,
    backend,
    winCondition: 'Activate color shrine',
    notes: [
      `shrine=${shrineOn}`,
      `trail=${mask.trail.length}`,
      `gems=${gemsGot}`,
      `apex=${feelMetrics.lastJumpApex.toFixed(3)}`,
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
