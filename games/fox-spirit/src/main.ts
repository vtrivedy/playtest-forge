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
  matchFogToSky,
  createDistantLand,
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
    exposure: 1.18,
    shadows: true,
    shadowMapSize: 1024,
  });
  const { renderer, backend } = forge;

  const scene = new THREE.Scene();
  const lights = applyLookdevLights(scene);
  // Low warm sun ahead-left of the shrine path (back-lights the north view, like key art)
  const sunDir = new THREE.Vector3(-0.3, 0.17, -0.94).normalize();
  lights.rim.position.copy(sunDir).multiplyScalar(20);
  lights.rim.intensity = 1.55;
  const fog = applyHeightFog(scene, { density: 0.0075 });
  const sky = createPaintedSky(scene, {
    zenith: new THREE.Color(0x7f7aa6),
    mid: new THREE.Color(0xe2a060),
    horizon: new THREE.Color(0xf6c894),
    nadir: new THREE.Color(0xb49a8a),
    mist: new THREE.Color(0xe6bf98),
    sunDir,
    sunColor: new THREE.Color(0xffc985),
    sunSize: 0.005,
    sunBloom: 0.22,
    horizonGlow: 0.5,
    godRays: 0.4,
    mistHeight: 0.07,
    cloudAmount: 0.6,
  });
  matchFogToSky(scene, fog, sky.params.mist);
  const distant = createDistantLand(scene, {
    silhouette: new THREE.Color(0x4a3a3c),
    haze: sky.params.mist,
    count: 18,
    minRadius: 125,
    maxScale: 24,
    focusBias: 0.5,
    focusAngle: Math.atan2(-1, 0), // shrine path looks north (-Z)
    sunDir,
    sunColor: sky.params.sunColor,
  });

  const world = await createWorld(scene);
  const foxActor = await createFox();
  scene.add(foxActor.group);
  foxActor.group.position.copy(world.spawnPos);
  foxActor.group.position.y += foxActor.feetOffset;

  // Soft contact shadow — grounds the hero without relying on shadow maps alone
  const contactShadow = (() => {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
    g.addColorStop(0, 'rgba(40,20,10,0.55)');
    g.addColorStop(0.45, 'rgba(40,20,10,0.22)');
    g.addColorStop(1, 'rgba(40,20,10,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      opacity: 0.85,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 1;
    scene.add(mesh);
    return mesh;
  })();

  const cam = createFollowCamera({
    fov: 48,
    distance: 2.7,
    height: 1.2,
    lookAtHeight: 0.5,
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
    bloomStrength: 0.1,
    bloomThreshold: 0.96,
    vignette: 0.34,
    grain: 0.06,
    enableGTAO: false,
  });

  const wisps = createFoxWisps(scene, 28); // spirit-fire aura
  const emberTrail = createEmberTrail(scene, 36);
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
  let fxEnabled = true;
  let turntableMode = false;
  let turntableYaw = 0;
  let turntableAnim: import('./fox').FoxAnimState = 'idle';

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
      setFxEnabled: (on: boolean) => void;
      getFoxPos: () => { x: number; y: number; z: number };
      getAnim: () => string;
      hasClips: boolean;
      runTurntable: (opts?: { anim?: string; fx?: boolean }) => void;
      stopTurntable: () => void;
      poseHero: (opts?: { anim?: string; fx?: boolean }) => void;
    };
  };
  win.__gameHooks = {
    teleportToShrine() {
      foxActor.group.position.set(world.shrinePos.x, world.shrinePos.y + foxActor.feetOffset + 0.2, world.shrinePos.z + 1.5);
      vel.set(0, 0, 0);
    },
    setFxEnabled(on: boolean) {
      fxEnabled = !!on;
      post.bloom.strength = on ? 0.1 : 0;
      wisps.points.visible = on;
      emberTrail.points.visible = on;
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
    getAnim() {
      return foxActor.getAnim();
    },
    hasClips: foxActor.hasClips,
    runTurntable(opts) {
      turntableMode = true;
      turntableYaw = 0;
      turntableAnim = (opts?.anim as import('./fox').FoxAnimState) || 'idle';
      if (opts?.fx === false) {
        fxEnabled = false;
        post.bloom.strength = 0;
        wisps.points.visible = false;
        emberTrail.points.visible = false;
      }
      foxActor.setAnim(turntableAnim);
    },
    stopTurntable() {
      turntableMode = false;
    },
    poseHero(opts) {
      // Open path south of shrine — clear of trees for anatomy judgment
      const x = 1.2;
      const z = 8;
      const gy = world.yAt(x, z);
      foxActor.group.position.set(x, gy + foxActor.feetOffset, z);
      foxActor.group.rotation.y = Math.PI * 0.72; // 3/4 toward south-east cam
      vel.set(0, 0, 0);
      const anim = (opts?.anim as import('./fox').FoxAnimState) || 'run';
      foxActor.setAnim(anim);
      // Advance a few mixer frames so run pose isn't T-pose
      for (let i = 0; i < 8; i++) foxActor.update(1 / 30, i / 30, false);
      if (opts?.fx === false) {
        fxEnabled = false;
        post.bloom.strength = 0;
        wisps.points.visible = false;
        emberTrail.points.visible = false;
      }
      // Hard-snap cam to readable 3/4 (bypass spring)
      const fx = foxActor.group.position;
      cam.camera.position.set(fx.x + 1.6, fx.y + 1.15, fx.z + 2.6);
      cam.camera.lookAt(fx.x, fx.y + 0.45, fx.z);
      contactShadow.position.set(fx.x, gy + 0.03, fx.z);
      (contactShadow.material as THREE.MeshBasicMaterial).opacity = 0.78;
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
    if (turntableMode) {
      turntableYaw += dt * 0.7;
      // Open meadow south of shrine — clear of grass carpet for silhouette judgment
      const tx = 0;
      const tz = 10;
      fox.position.set(tx, world.yAt(tx, tz) + foxActor.feetOffset, tz);
      fox.rotation.y = turntableYaw; // model spins; camera fixed (classic turntable)
      vel.set(0, 0, 0);
      foxActor.setAnim(turntableAnim);
      foxActor.update(dt, elapsed, turntableAnim === 'glide');
      const orbitR = 3.6;
      const orbitH = 1.25;
      // Camera south of fox, looking north — same gameplay angle as concept profile
      cam.camera.position.set(tx, fox.position.y + orbitH, tz + orbitR);
      cam.camera.lookAt(tx, fox.position.y + 0.4, tz);
      {
        const gyShadow = world.yAt(tx, tz);
        contactShadow.position.set(tx, gyShadow + 0.03, tz);
        contactShadow.scale.set(1, 1, 1);
        (contactShadow.material as THREE.MeshBasicMaterial).opacity = 0.75;
      }
      world.setGrassSat(0.15);
      sky.update(dt);
      post.render();
      requestAnimationFrame(tick);
      return;
    }

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

    // Animation state from locomotion
    {
      const speed = Math.hypot(vel.x, vel.z);
      let anim: import('./fox').FoxAnimState = 'idle';
      if (!grounded) {
        if (gliding) anim = 'glide';
        else if (vel.y > 0.6) anim = 'jump_up';
        else if (vel.y > -0.4) anim = 'jump_apex';
        else anim = 'jump_fall';
      } else if (dashT > 0) {
        anim = 'dash';
      } else if (speed > 1.2) {
        anim = 'run';
      } else {
        anim = 'idle';
      }
      foxActor.setAnim(anim);
      foxActor.update(dt, elapsed, gliding);
    }

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
    if (fxEnabled) {
      wisps.update(dt, fox.position, shrineOn ? 0.85 : 0.45);
      emberTrail.update(dt, fox.position, gliding ? 0.9 : shrineOn ? 0.7 : 0.5);
    } else {
      // Silhouette pass: park FX far offscreen
      wisps.update(dt, new THREE.Vector3(0, -50, 0), 0);
      emberTrail.update(dt, new THREE.Vector3(0, -50, 0), 0);
    }
    autumnFX.update(dt);
    sky.update(dt);
    distant.update(dt);
    // Grass stays sepia until restore; fox aura must NOT paint every blade yellow
    world.setGrassSat(shrineOn ? 1 : Math.min(0.22, colorField.sample(fox.position) * 0.25));

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

    {
      const gyShadow = world.yAt(fox.position.x, fox.position.z);
      contactShadow.position.set(fox.position.x, gyShadow + 0.03, fox.position.z);
      const air = Math.max(0, fox.position.y - foxActor.feetOffset - gyShadow);
      const k = Math.max(0.15, 1 - air * 0.35);
      contactShadow.scale.set(k, k, 1);
      (contactShadow.material as THREE.MeshBasicMaterial).opacity = 0.85 * k;
    }
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
