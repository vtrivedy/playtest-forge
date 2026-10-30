import * as THREE from 'three';
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

const feel: FeelParams = { ...DEFAULT_FEEL };
const metrics: FeelMetrics = {
  lastJumpApex: 0,
  lastTimeToApex: 0,
  lastAirTime: 0,
  dashesUsed: 0,
  gemsCollected: 0,
};

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x7ec8ff, 0.018);
scene.background = new THREE.Color(0x7ec8ff);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 200);
const forge = await createForgeRenderer();
const { renderer, backend } = forge;
applyStylizedIslandLights(scene);
const post = createPostStack(renderer, scene, camera);
post.bloom.strength = 0.28;
post.bloom.threshold = 0.8;

// --- Island ---
const islandGroup = new THREE.Group();
scene.add(islandGroup);

const topMat = new THREE.MeshStandardMaterial({ color: 0x5dbf6a, roughness: 0.85, metalness: 0.05 });
const dirtMat = new THREE.MeshStandardMaterial({ color: 0x8b5a3c, roughness: 0.95, metalness: 0.0 });
const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a9099, roughness: 0.7, metalness: 0.15 });

const top = new THREE.Mesh(new THREE.CylinderGeometry(10, 11, 1.2, 48), topMat);
top.position.y = 0;
top.receiveShadow = true;
top.castShadow = true;
islandGroup.add(top);

const underside = new THREE.Mesh(new THREE.ConeGeometry(11, 8, 48), dirtMat);
underside.position.y = -4.5;
underside.castShadow = true;
islandGroup.add(underside);

for (let i = 0; i < 7; i++) {
  const ang = (i / 7) * Math.PI * 2;
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7 + Math.random() * 0.5, 0), rockMat);
  rock.position.set(Math.cos(ang) * (6 + Math.random() * 3), 0.6, Math.sin(ang) * (6 + Math.random() * 3));
  rock.rotation.set(Math.random(), Math.random(), Math.random());
  rock.castShadow = true;
  islandGroup.add(rock);
}

// Trees (simple stylized)
for (let i = 0; i < 5; i++) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.22, 1.2, 6),
    new THREE.MeshStandardMaterial({ color: 0x6b3f22, roughness: 0.9 }),
  );
  trunk.position.y = 0.9;
  trunk.castShadow = true;
  const foliage = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.9, 0),
    new THREE.MeshStandardMaterial({ color: 0x2f8f4e, roughness: 0.75, flatShading: true }),
  );
  foliage.position.y = 1.9;
  foliage.castShadow = true;
  g.add(trunk, foliage);
  const ang = (i / 5) * Math.PI * 2 + 0.4;
  g.position.set(Math.cos(ang) * 5.5, 0.6, Math.sin(ang) * 5.5);
  islandGroup.add(g);
}

islandGroup.position.y = 2;

// --- Creature (simple cute dragon-ish capsule + horns) ---
const creature = new THREE.Group();
const body = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.35, 0.45, 6, 12),
  new THREE.MeshStandardMaterial({ color: 0x4b7cff, roughness: 0.35, metalness: 0.2, emissive: 0x102050, emissiveIntensity: 0.25 }),
);
body.castShadow = true;
const head = new THREE.Mesh(
  new THREE.SphereGeometry(0.28, 16, 16),
  new THREE.MeshStandardMaterial({ color: 0x6a9bff, roughness: 0.4, metalness: 0.15 }),
);
head.position.set(0, 0.35, 0.28);
head.castShadow = true;
const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.25, 6), new THREE.MeshStandardMaterial({ color: 0xffe08a, roughness: 0.3 }));
hornL.position.set(-0.12, 0.55, 0.2);
hornL.rotation.x = -0.4;
const hornR = hornL.clone();
hornR.position.x = 0.12;
creature.add(body, head, hornL, hornR);
creature.position.set(0, 3.3, 0);
scene.add(creature);

const juice = new Juice(scene, camera);

// Gems
type Gem = { mesh: THREE.Mesh; taken: boolean };
const gems: Gem[] = [];
const gemMat = new THREE.MeshStandardMaterial({
  color: 0x7dffd0,
  emissive: 0x2a8866,
  emissiveIntensity: 0.9,
  metalness: 0.6,
  roughness: 0.15,
});
for (let i = 0; i < 5; i++) {
  const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), gemMat.clone());
  const ang = (i / 5) * Math.PI * 2;
  mesh.position.set(Math.cos(ang) * 4.2, 3.2, Math.sin(ang) * 4.2);
  mesh.castShadow = true;
  scene.add(mesh);
  gems.push({ mesh, taken: false });
}

// Input: move + jump + dash; hold jump in air = glide
const keys = new Set<string>();
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));

const vel = new THREE.Vector3();
let grounded = false;
let coyote = 0;
let jumpBuf = 0;
let dashT = 0;
let gliding = false;
let jumpOriginY = 0;
let jumpTime = 0;
let inAir = false;
let airStart = 0;
let status: 'playing' | 'won' | 'lost' = 'playing';
let elapsed = 0;
const spawn = new THREE.Vector3(0, 3.3, 0);

createFeelPanel(feel);

const camOffset = new THREE.Vector3(0, 4.5, 8);
const camTarget = new THREE.Vector3();
const statusEl = document.getElementById('status')!;

function groundY(x: number, z: number): number | null {
  // Flat disk island top at y=2.6 (group y=2 + half height 0.6)
  const lx = x - islandGroup.position.x;
  const lz = z - islandGroup.position.z;
  if (Math.hypot(lx, lz) <= 10.2) return 2.6;
  return null;
}

function respawn() {
  creature.position.copy(spawn);
  vel.set(0, 0, 0);
  juice.bump(0.3);
  juice.burst(creature.position.clone(), 0x4b7cff);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  forge.setSize(innerWidth, innerHeight);
  post.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
// Avoid deprecated Clock warning path if Timer exists — Clock still works; keep for compat.

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (status === 'playing') elapsed += dt;

  // Movement intent
  let ix = 0;
  let iz = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) iz -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) iz += 1;

  // Camera-relative move
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  const wish = new THREE.Vector3();
  if (ix || iz) {
    wish.addScaledVector(right, ix);
    wish.addScaledVector(forward, -iz); // W = -iz in our key mapping... wait
    // W sets iz=-1, we want move along forward: wish += forward * (-iz) when iz=-1 => +forward. Good.
    // Actually: iz=-1 for W, wish.addScaledVector(forward, -iz) => forward * 1. Correct.
    wish.normalize();
  }

  if (keys.has('Space')) jumpBuf = feel.jumpBuffer;
  else jumpBuf = Math.max(0, jumpBuf - dt);

  const gy = groundY(creature.position.x, creature.position.z);
  const feetY = creature.position.y - 0.55;
  grounded = gy !== null && feetY <= gy + 0.08 && vel.y <= 0.1;
  if (grounded) {
    coyote = feel.coyoteTime;
    creature.position.y = gy! + 0.55;
    if (vel.y < 0) vel.y = 0;
    if (inAir) {
      metrics.lastAirTime = performance.now() / 1000 - airStart;
      inAir = false;
    }
    gliding = false;
  } else {
    coyote = Math.max(0, coyote - dt);
    if (!inAir) {
      inAir = true;
      airStart = performance.now() / 1000;
    }
  }

  // Jump
  if (jumpBuf > 0 && coyote > 0) {
    vel.y = feel.jumpVelocity;
    jumpBuf = 0;
    coyote = 0;
    grounded = false;
    jumpOriginY = creature.position.y;
    jumpTime = 0;
    metrics.lastJumpApex = 0;
    juice.bump(0.12);
  }

  // Dash
  if ((keys.has('ShiftLeft') || keys.has('ShiftRight')) && dashT <= 0 && wish.lengthSq() > 0.01) {
    dashT = feel.dashDuration;
    vel.x = wish.x * feel.dashSpeed;
    vel.z = wish.z * feel.dashSpeed;
    metrics.dashesUsed += 1;
    juice.bump(0.2);
    juice.burst(creature.position.clone(), 0x9ad0ff);
    keys.delete('ShiftLeft');
    keys.delete('ShiftRight');
  }
  if (dashT > 0) dashT -= dt;

  // Glide: hold space while falling
  gliding = !grounded && vel.y < 0 && keys.has('Space');
  const gScale = gliding ? feel.glideGravityScale : 1;
  vel.y -= feel.gravity * gScale * dt;
  if (gliding) {
    vel.x *= Math.exp(-feel.glideDrag * dt);
    vel.z *= Math.exp(-feel.glideDrag * dt);
  }

  // Horizontal accel
  const control = grounded ? 1 : feel.airControl;
  const targetSpeed = feel.moveSpeed;
  if (dashT <= 0) {
    const cur = new THREE.Vector3(vel.x, 0, vel.z);
    const desired = wish.clone().multiplyScalar(targetSpeed);
    const accel = feel.accel * control;
    cur.x = THREE.MathUtils.damp(cur.x, desired.x, accel * 0.15, dt);
    cur.z = THREE.MathUtils.damp(cur.z, desired.z, accel * 0.15, dt);
    // simpler lerp toward desired
    cur.lerp(desired, 1 - Math.exp(-accel * control * dt));
    vel.x = cur.x;
    vel.z = cur.z;
  }

  creature.position.x += vel.x * dt;
  creature.position.y += vel.y * dt;
  creature.position.z += vel.z * dt;

  if (wish.lengthSq() > 0.01) {
    const facing = Math.atan2(wish.x, wish.z);
    creature.rotation.y = THREE.MathUtils.damp(creature.rotation.y, facing, feel.turnRate, dt);
  }

  // Apex tracking
  if (inAir && vel.y > 0) jumpTime += dt;
  if (inAir && vel.y <= 0 && metrics.lastJumpApex === 0 && jumpOriginY > 0) {
    metrics.lastJumpApex = creature.position.y - jumpOriginY;
    metrics.lastTimeToApex = jumpTime;
  }

  // Gems
  for (const gem of gems) {
    if (gem.taken) continue;
    gem.mesh.rotation.y += dt * 2;
    gem.mesh.position.y = 3.2 + Math.sin(elapsed * 3 + gem.mesh.position.x) * 0.15;
    if (creature.position.distanceTo(gem.mesh.position) < 0.9) {
      gem.taken = true;
      gem.mesh.visible = false;
      metrics.gemsCollected += 1;
      juice.burst(gem.mesh.position.clone(), 0x7dffd0);
      juice.bump(0.15);
    }
  }
  if (metrics.gemsCollected >= 5) status = 'won';

  // Fall
  if (creature.position.y < -6) respawn();

  // Camera follow
  const desiredCam = creature.position.clone().add(camOffset);
  camera.position.lerp(desiredCam, 1 - Math.exp(-4 * dt));
  camTarget.lerp(creature.position.clone().add(new THREE.Vector3(0, 0.8, 0)), 1 - Math.exp(-6 * dt));
  camera.lookAt(camTarget);
  juice.update(dt);

  // Float island subtly
  islandGroup.rotation.y = Math.sin(elapsed * 0.15) * 0.02;

  statusEl.textContent =
    status === 'playing'
      ? `Creature Island · gems ${metrics.gemsCollected}/5 · ${gliding ? 'GLIDING' : grounded ? 'ground' : 'air'} · ${backend}`
      : status === 'won'
        ? `YOU WIN · gems 5/5 · dashes ${metrics.dashesUsed} · ${elapsed.toFixed(1)}s`
        : `Done`;

  publishGame({
    title: 'Creature Island',
    status,
    score: metrics.gemsCollected * 100 + Math.floor(elapsed),
    lives: 1,
    elapsedSec: Number(elapsed.toFixed(2)),
    deaths: 0,
    backend,
    winCondition: 'Collect 5 gems',
    loseCondition: 'Fall (respawn)',
    notes: [
      `apex=${metrics.lastJumpApex.toFixed(2)}`,
      `tta=${metrics.lastTimeToApex.toFixed(2)}`,
      `air=${metrics.lastAirTime.toFixed(2)}`,
      `dash=${metrics.dashesUsed}`,
      gliding ? 'glide' : grounded ? 'ground' : 'air',
    ],
  });

  post.render();
  requestAnimationFrame(tick);
}

publishGame({
  title: 'Creature Island',
  status: 'playing',
  score: 0,
  lives: 1,
  elapsedSec: 0,
  deaths: 0,
  backend,
});
tick();
