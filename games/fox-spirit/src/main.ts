import * as THREE from 'three';
import GUI from 'lil-gui';
import { publishGame } from '../../shared/game-state';
import {
  PRESET_SPRING,
  JumpFeel,
  emptyFeelMetrics,
  type FeelParams,
} from '../../shared/character-feel';
import {
  createForgeRenderer,
  createColorField,
  createPostStack,
  createPaintedSky,
  applyLookdevLights,
  applyHeightFog,
  createFoxWisps,
  createAutumnParticles,
} from '../../../src/render';
import { createWorld } from './world';
import { createFox } from './fox';
import { createFollowCamera } from './camera';
import { createGameAudio } from './audio';
import { createHud } from './hud';
import { createLeafKick, createEmberTrail } from './fx';
import { createRestoreCinematic } from './restore';

const feel: FeelParams = { ...PRESET_SPRING, moveSpeed: PRESET_SPRING.moveSpeed * 1.12 };
const jumpFeel = new JumpFeel();
const feelMetrics = emptyFeelMetrics();

async function boot() {
  const hud = createHud();
  hud.setStatus('Loading Russetvale…');
  const audio = createGameAudio();

  const forge = await createForgeRenderer({
    container: document.body,
    exposure: 1.05,
    shadows: true,
    shadowMapSize: 1024,
  });
  const { renderer, backend } = forge;

  const scene = new THREE.Scene();
  applyLookdevLights(scene);
  applyHeightFog(scene, { density: 0.012, color: new THREE.Color(0xd4c0a0) });
  const sky = createPaintedSky(scene, {
    zenith: new THREE.Color(0xb89268),
    horizon: new THREE.Color(0xe8d4b0),
    nadir: new THREE.Color(0x6a5040),
    sunColor: new THREE.Color(0xffd9a0),
    cloudAmount: 0.72,
    sunBloom: 0.3,
  });

  const world = await createWorld(scene);
  const foxActor = await createFox();
  scene.add(foxActor.group);
  foxActor.group.position.copy(world.spawnPos);
  foxActor.group.position.y += foxActor.feetOffset;

  const cam = createFollowCamera({
    fov: 50,
    distance: 6.4,
    height: 2.8,
    lookAtHeight: 0.85,
    yAt: world.yAt,
  });
  cam.resize(innerWidth, innerHeight);

  const colorField = createColorField({
    auraRadius: 3.4,
    trailLife: 3.0,
    trailRadius: 2.6,
    trailDepositInterval: 0.035,
    bounds: world.bounds,
    maskSize: 512,
  });
  colorField.initMask(renderer);
  for (const m of world.materials) colorField.patchMaterial(m);

  const post = createPostStack(renderer, scene, cam.camera, {
    bloomStrength: 0.22,
    bloomThreshold: 0.9,
    vignette: 0.34,
    grain: 0.06,
    enableGTAO: false,
  });

  const wisps = createFoxWisps(scene, 24); // sparse orbital
  const emberTrail = createEmberTrail(scene, 52);
  const autumnFX = createAutumnParticles(scene, 180, 110);
  const leafKick = createLeafKick(scene);

  const restore = createRestoreCinematic({
    colorField,
    shrinePos: world.shrinePos,
    radius: 28,
    durationS: 3.8,
    autumnFX,
    camera: cam,
    audio,
    hud,
  });

  // Debug feel panel — hidden until body.debug-on
  const gui = new GUI({ title: 'Feel' });
  gui.domElement.style.display = 'none';
  const syncGuiVis = () => {
    gui.domElement.style.display = document.body.classList.contains('debug-on') ? '' : 'none';
  };
  addEventListener('keydown', (e) => {
    if (e.code === 'Backquote' || e.key === 'F1') setTimeout(syncGuiVis, 0);
  });
  gui.add(feel, 'moveSpeed', 4, 14, 0.1);
  gui.add(feel, 'jumpVelocity', 6, 16, 0.1);
  gui.add(feel, 'gravity', 10, 40, 0.5);
  gui.add(feel, 'dashSpeed', 10, 30, 0.5);

  // Ember motes along path
  type Ember = { mesh: THREE.Mesh; taken: boolean };
  const embers: Ember[] = [];
  const emberMat = new THREE.MeshStandardMaterial({
    color: 0xffaa44,
    emissive: 0xff6600,
    emissiveIntensity: 0.95,
    metalness: 0.4,
    roughness: 0.25,
  });
  for (let i = 0; i < 8; i++) {
    const z = 10 - i * 2.5;
    const x = Math.sin(i * 1.3) * 0.8;
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), emberMat);
    mesh.position.set(x, world.yAt(x, z) + 0.55, z);
    scene.add(mesh);
    embers.push({ mesh, taken: false });
  }

  const keys = new Set<string>();
  addEventListener('keydown', (e) => {
    keys.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    void audio.resume();
    audio.setAmbient(true);
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('pointerdown', () => {
    void audio.resume();
    audio.setAmbient(true);
  });

  const vel = new THREE.Vector3();
  let grounded = false;
  let dashT = 0;
  let gliding = false;
  let shrineOn = false;
  let embersGot = 0;
  let elapsed = 0;
  let status: 'playing' | 'won' = 'playing';
  let kickCooldown = 0;
  const spawn = foxActor.group.position.clone();

  addEventListener('resize', () => {
    cam.resize(innerWidth, innerHeight);
    forge.setSize(innerWidth, innerHeight);
    post.setSize(innerWidth, innerHeight);
  });


  const win = window as unknown as {
    __gameHooks?: {
      teleportToShrine: () => void;
      forceRestore: () => void;
      getFoxPos: () => { x: number; y: number; z: number };
    };
  };
  win.__gameHooks = {
    teleportToShrine() {
      foxActor.group.position.set(world.shrinePos.x, world.shrinePos.y + foxActor.feetOffset + 0.2, world.shrinePos.z + 1.5);
      vel.set(0, 0, 0);
    },
    forceRestore() {
      if (!shrineOn) {
        shrineOn = true;
        status = 'won';
        restore.trigger();
        hud.setStatus('AUTUMN RESTORED · Ember Wellspring awake');
      }
    },
    getFoxPos() {
      const p = foxActor.group.position;
      return { x: p.x, y: p.y, z: p.z };
    },
  };

  hud.setStatus(`Sepia Russetvale · ${backend}`);
  hud.setPrompt('WASD · Space jump / hold glide · Shift dash · Reach the shrine');
  hud.hidePromptSoon(8);
  hud.setEmbers(0);

  publishGame({
    title: 'Fox Spirit',
    status: 'playing',
    score: 0,
    lives: 1,
    elapsedSec: 0,
    deaths: 0,
    backend,
  });

  const clock = new THREE.Clock();

  function respawn() {
    foxActor.group.position.copy(spawn);
    vel.set(0, 0, 0);
  }

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
    cam.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const wish = new THREE.Vector3();
    if (ix || iz) {
      wish.addScaledVector(right, ix).addScaledVector(forward, -iz).normalize();
    }

    const spaceDown = keys.has('Space');
    jumpFeel.sampleJumpEdge(spaceDown, dt, feel.jumpBuffer);

    const fox = foxActor.group;
    const gy = world.yAt(fox.position.x, fox.position.z);
    const onIsland = gy > -0.5;
    const feetY = fox.position.y - foxActor.feetOffset;
    const wasGrounded = grounded;
    grounded = onIsland && feetY <= gy + 0.1 && vel.y <= 0.15;
    if (grounded) {
      jumpFeel.onGrounded(feel.coyoteTime);
      if (jumpFeel.airTime > 0) {
        feelMetrics.lastAirTime = jumpFeel.airTime;
        feelMetrics.lastJumpApex = jumpFeel.apex;
        feelMetrics.lastTimeToApex = jumpFeel.timeToApex;
      }
      fox.position.y = gy + foxActor.feetOffset;
      if (vel.y < 0) vel.y = 0;
      gliding = false;
      if (!wasGrounded) {
        foxActor.squash(1.18, 0.72, 1.18);
        audio.play('footstep');
      }
    } else {
      jumpFeel.tickAir(dt, fox.position.y, vel.y);
    }

    const jv = jumpFeel.tryJump(feel.jumpVelocity, fox.position.y);
    if (jv !== null) {
      vel.y = jv;
      grounded = false;
      feelMetrics.jumps += 1;
      foxActor.squash(0.82, 1.22, 0.82);
      audio.play('jump');
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
      audio.play('dash');
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

    foxActor.relaxScale(dt);

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
      const yaw = Math.atan2(wish.x, wish.z);
      fox.rotation.y = THREE.MathUtils.damp(fox.rotation.y, yaw, feel.turnRate, dt);
    }
    if (fox.position.y < -8) respawn();

    foxActor.updateTail(elapsed, gliding);

    // Color field
    colorField.setFox(fox.position.clone().setY(fox.position.y + 0.25));
    colorField.update(dt);
    colorField.renderMask(dt);
    for (const m of world.materials) colorField.syncMaterial(m);

    // Leaf kick while running
    kickCooldown -= dt;
    const speed = Math.hypot(vel.x, vel.z);
    if (grounded && speed > 3.5 && kickCooldown <= 0) {
      leafKick.burst(fox.position.clone().setY(world.yAt(fox.position.x, fox.position.z) + 0.1), 0.85);
      kickCooldown = 0.18;
    }
    leafKick.update(dt);

    // Wisps / autumn
    wisps.update(dt, fox.position, shrineOn ? 1 : 0.15);
    emberTrail.update(dt, fox.position, gliding ? 0.95 : shrineOn ? 0.8 : 0.45);
    autumnFX.update(dt);
    sky.update(dt);
    world.setGrassSat(shrineOn ? 1 : colorField.sample(fox.position));

    // Embers pickup
    for (const e of embers) {
      if (e.taken) continue;
      e.mesh.rotation.y += dt * 2.4;
      e.mesh.position.y = world.yAt(e.mesh.position.x, e.mesh.position.z) + 0.55 + Math.sin(elapsed * 3 + e.mesh.position.z) * 0.08;
      if (fox.position.distanceTo(e.mesh.position) < 0.9) {
        e.taken = true;
        e.mesh.visible = false;
        embersGot += 1;
        feelMetrics.gemsCollected = embersGot;
        hud.setEmbers(embersGot);
        audio.play('ember');
      }
    }

    // Shrine restore
    if (!shrineOn && fox.position.distanceTo(world.shrinePos) < 3.6) {
      shrineOn = true;
      status = 'won';
      restore.trigger();
      hud.setStatus('AUTUMN RESTORED · Ember Wellspring awake');
    }
    restore.update(dt);
    world.update(dt, elapsed, fox.position);

    cam.update(dt, fox.position, fox.rotation.y, { lookAhead: grounded ? 1.4 : 0.6 });
    audio.update(dt, speed > 1.2, grounded, gliding);

    hud.setStatus(
      shrineOn
        ? `AUTUMN RESTORED · embers ${embersGot}/8 · ${elapsed.toFixed(1)}s`
        : `Sepia Russetvale · trail wakes color · shrine north · ${backend}`,
    );

    publishGame({
      title: 'Fox Spirit',
      status,
      score: embersGot * 100 + (shrineOn ? 1000 : 0),
      lives: 1,
      elapsedSec: Number(elapsed.toFixed(2)),
      deaths: 0,
      backend,
      winCondition: 'Activate autumn shrine',
      notes: [
        `shrine=${shrineOn}`,
        `embers=${embersGot}`,
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

  tick();
}

boot().catch((err) => {
  console.error(err);
  const s = document.getElementById('status');
  if (s) s.textContent = `Boot failed: ${String(err)}`;
});
