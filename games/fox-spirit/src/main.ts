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
import { createRussetvale, type Waypoint } from './russetvale';
import { createFox } from './fox';
import { createFollowCamera } from './camera';
import { createGameAudio } from './audio';
import { createHud } from './hud';
import { createLeafKick, createEmberTrail } from './fx';
import { createRestoreCinematic } from './restore';

const feel: FeelParams = { ...PRESET_SPRING, moveSpeed: PRESET_SPRING.moveSpeed * 1.12 };
/** game-design §3.2: glide 3:1 — capped sink while gliding */
const glide = { sink: 2.5, forward: 7.5 };
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
  const fog = applyHeightFog(scene, { density: 0.0052 });
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
    count: 22,
    minRadius: 230,
    maxRadius: 360,
    minY: -60,
    maxY: 30,
    minScale: 18,
    maxScale: 44,
    mistFloor: -40,
    focusBias: 0.5,
    focusAngle: Math.atan2(-1, 0), // shrine path looks north (-Z)
    sunDir,
    sunColor: sky.params.sunColor,
  });

  const world = await createRussetvale(scene);
  const col = world.collision;
  // Key light shadow frustum follows the fox across the 260 m realm
  const keyOffset = lights.key.position.clone().normalize().multiplyScalar(60);
  lights.key.shadow.camera.left = -34;
  lights.key.shadow.camera.right = 34;
  lights.key.shadow.camera.top = 34;
  lights.key.shadow.camera.bottom = -34;
  lights.key.shadow.camera.far = 140;
  lights.key.shadow.camera.updateProjectionMatrix();
  scene.add(lights.key.target);
  const foxActor = await createFox();
  scene.add(foxActor.group);
  foxActor.group.position.copy(world.spawnPos);
  foxActor.group.position.y += foxActor.feetOffset;
  foxActor.group.rotation.y = Math.PI; // face north: Wellspring Hill on frame 1

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

  const camFloorRef = { y: world.spawnPos.y + 3 };
  const cam = createFollowCamera({
    fov: 48,
    distance: 2.7,
    height: 1.2,
    lookAtHeight: 0.5,
    yAt: (x, z) => col.groundAt(x, z, camFloorRef.y).y,
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

  // Autumn particle field rides with the fox (the kit spawns in a 28 m box)
  const fxOffset = new THREE.Vector3();
  const autumnFollow = {
    ...autumnFX,
    setWavefront: (c: THREE.Vector3, r: number, s: number) => autumnFX.setWavefront(c.clone().sub(fxOffset), r, s),
  };
  const restore = createRestoreCinematic({
    colorField,
    shrinePos: world.wellspringPos,
    radius: 235,
    durationS: 6,
    autumnFX: autumnFollow,
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
  let airDashUsed = false;
  let floodT = -1;
  let prevFeet = world.spawnPos.y;
  let groundBounce = 1;
  let deaths = 0;
  let zone = world.zoneAt(world.spawnPos.x, world.spawnPos.z);
  // autopilot (verification bot): follows world.route through real input + physics
  const auto = {
    active: false,
    idx: 0,
    wish: new THREE.Vector3(),
    space: false,
    dash: false,
    phase: 'run' as 'run' | 'air',
    pressT: 0,
    stuckT: 0,
    bestD: Infinity,
    assists: 0,
    log: [] as string[],
    act: undefined as Waypoint['act'],
  };
  let simClock = 0;
  let photo: { pos: THREE.Vector3; look: THREE.Vector3; fov: number } | null = null;
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
    __gameHooks?: Record<string, unknown>;
  };
  win.__gameHooks = {
    hasClips: foxActor.hasClips,
    teleportToShrine() {
      const p = world.wellspringPos;
      foxActor.group.position.set(p.x, p.y + foxActor.feetOffset + 0.2, p.z + 4.5);
      foxActor.group.rotation.y = Math.PI; // face north toward shrine
      prevFeet = p.y + 0.2;
      vel.set(0, 0, 0);
      foxActor.setAnim('idle');
    },
    forceRestore() {
      if (!shrineOn) triggerFlood();
    },
    getFoxPos() {
      const p = foxActor.group.position;
      return { x: p.x, y: p.y, z: p.z };
    },
    setFxEnabled(on: boolean) {
      fxEnabled = !!on;
      post.bloom.strength = on ? 0.1 : 0;
      wisps.points.visible = on;
      emberTrail.points.visible = on;
    },
    getAnim() {
      return foxActor.getAnim();
    },
    runTurntable(opts?: { anim?: string; fx?: boolean }) {
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
    poseHero(opts?: { anim?: string; fx?: boolean }) {
      // Open meadow path north of the portal — clear of trees for anatomy judgment
      const x = 6;
      const z = 74;
      const gy = world.terrainY(x, z);
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
    teleport(x: number, y: number, z: number, yaw = Math.PI) {
      foxActor.group.position.set(x, y + foxActor.feetOffset + 0.05, z);
      foxActor.group.rotation.y = yaw;
      prevFeet = y + 0.05;
      vel.set(0, 0, 0);
    },
    lightSeedwells() {
      for (const s of world.seedwells) {
        const p = s.pos;
        foxActor.group.position.set(p.x, p.y + foxActor.feetOffset, p.z);
        prevFeet = p.y;
        handleEvents(world.update(0.016, elapsed, foxActor.group.position, p.y, (q) => colorField.sample(q)));
      }
    },
    autopilot(on = true, fromIdx = 0) {
      auto.active = on;
      auto.idx = fromIdx;
      auto.phase = 'run';
      auto.stuckT = 0;
      auto.bestD = Infinity;
    },
    photo(pos: [number, number, number], look: [number, number, number], fov = 50) {
      photo = { pos: new THREE.Vector3(...pos), look: new THREE.Vector3(...look), fov };
    },
    photoOff() {
      photo = null;
      cam.camera.fov = 50;
      cam.camera.updateProjectionMatrix();
    },
    state() {
      return {
        zone,
        embers: embersGot,
        emberTotal: world.emberTotal,
        seedwells: world.seedwells.map((s) => ({ id: s.id, lit: s.lit })),
        bridge: world.bridgeGrown(),
        restored: shrineOn,
        auto: { active: auto.active, idx: auto.idx, of: world.route.length, assists: auto.assists, log: auto.log.slice(-12) },
        deaths,
        t: simClock,
      };
    },
  };

  function triggerFlood() {
    shrineOn = true;
    status = 'won';
    floodT = 0;
    restore.trigger();
    hud.setStatus('AUTUMN RESTORED · Ember Wellspring awake');
  }

  function handleEvents(events: ReturnType<typeof world.update>) {
    for (const e of events) {
      if (e.type === 'ember') {
        embersGot += e.value;
        feelMetrics.gemsCollected = embersGot;
        hud.setEmbers(embersGot);
        audio.play('ember');
      } else if (e.type === 'seedwell') {
        const s = world.seedwells[e.index]!;
        colorField.restore(s.pos, s.radius, 3.2);
        audio.play('shrine');
        audio.swell(2.5);
        hud.flashRestore();
        const lit = world.seedwells.filter((q) => q.lit).length;
        hud.setPrompt(`${s.name} lit · ${lit}/3${lit === 3 ? ' · the root bridge grows' : ''}`);
        hud.hidePromptSoon(5);
        cam.setPullBack(3, 1.6);
      } else if (e.type === 'bridge') {
        audio.swell(3);
      } else if (e.type === 'checkpoint') {
        audio.play('ember');
      } else if (e.type === 'wellspring') {
        if (!shrineOn) triggerFlood();
      } else if (e.type === 'hazard') {
        respawn();
        deaths += 1;
        hud.setPrompt(e.kind === 'ink' ? 'The ink swallows colour — keep to the stones' : 'The cloud sea returns you');
        hud.hidePromptSoon(3);
      }
    }
  }

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
    const p = world.respawnPos();
    foxActor.group.position.set(p.x, p.y + foxActor.feetOffset + 0.1, p.z);
    prevFeet = p.y + 0.1;
    vel.set(0, 0, 0);
    void spawn;
  }

  /** Bot: steer along world.route; jumps/dashes/glides are real key presses through JumpFeel. */
  function autopilotStep(dt: number, pos: THREE.Vector3, onGround: boolean) {
    const route = world.route;
    if (auto.idx >= route.length) {
      auto.active = false;
      auto.wish.set(0, 0, 0);
      auto.space = false;
      return;
    }
    const wp = route[auto.idx]!;
    const dx = wp.x - pos.x;
    const dz = wp.z - pos.z;
    const d = Math.hypot(dx, dz);
    auto.dash = false;
    if (auto.phase === 'air') {
      auto.pressT += dt;
      if (auto.act === 'jump' || auto.act === 'jumpdash') auto.space = vel.y > -0.5 || auto.pressT < 0.12;
      if (auto.act === 'jumpdash' && !airDashUsed && vel.y < 2.2 && auto.pressT > 0.15) auto.dash = true;
      if (auto.act === 'jumpdash' && airDashUsed) auto.space = true; // glide out the dash
      if (auto.act === 'glide') auto.space = auto.pressT < 0.12 || vel.y > 0 || d > 0.9;
      if (onGround && auto.pressT > 0.1) auto.phase = 'run';
    }
    if (d < 0.9 && wp.y - (pos.y - foxActor.feetOffset) < 1.0 && (onGround || auto.phase === 'run')) {
      auto.idx += 1;
      auto.stuckT = 0;
      auto.bestD = Infinity;
      if (wp.act && onGround) {
        auto.act = wp.act;
        auto.phase = 'air';
        auto.pressT = 0;
        auto.space = true;
      }
      return;
    }
    // steer (in air: brake once over the target)
    if (auto.phase === 'air' && d < 0.6) auto.wish.set(0, 0, 0);
    else auto.wish.set(dx / d, 0, dz / d);
    if (auto.phase === 'run') auto.space = false;
    // stuck → count an assist and hop to the waypoint (reported in state)
    if (d < auto.bestD - 0.3) {
      auto.bestD = d;
      auto.stuckT = 0;
    } else auto.stuckT += dt;
    if (auto.stuckT > 7) {
      auto.assists += 1;
      auto.log.push(`assist@${auto.idx}:${wp.label ?? ''}(${wp.x.toFixed(1)},${wp.y.toFixed(1)},${wp.z.toFixed(1)})`);
      foxActor.group.position.set(wp.x, wp.y + foxActor.feetOffset + 0.3, wp.z);
      prevFeet = wp.y + 0.3;
      vel.set(0, 0, 0);
      auto.stuckT = 0;
      auto.bestD = Infinity;
    }
  }

  function tick() {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (status === 'playing') elapsed += dt;
    simClock += dt;
    const fox = foxActor.group;

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

    if (turntableMode) {
      turntableYaw += dt * 0.7;
      // Open meadow north of the portal — clear ground for silhouette judgment
      const tx = 6;
      const tz = 76;
      const ty = world.terrainY(tx, tz);
      fox.position.set(tx, ty + foxActor.feetOffset, tz);
      fox.rotation.y = turntableYaw; // model spins; camera fixed (classic turntable)
      vel.set(0, 0, 0);
      foxActor.setAnim(turntableAnim);
      foxActor.update(dt, elapsed, turntableAnim === 'glide');
      cam.camera.position.set(tx, fox.position.y + 1.25, tz + 3.6);
      cam.camera.lookAt(tx, fox.position.y + 0.4, tz);
      contactShadow.position.set(tx, ty + 0.03, tz);
      contactShadow.scale.set(1, 1, 1);
      (contactShadow.material as THREE.MeshBasicMaterial).opacity = 0.75;
      sky.update(dt);
      post.render();
      requestAnimationFrame(tick);
      return;
    }

    // ground probe (one-way surfaces; previous feet height catches fast falls)
    let feetY = fox.position.y - foxActor.feetOffset;
    const probe = col.groundAt(fox.position.x, fox.position.z, Math.max(feetY, prevFeet));
    const gy = probe.y;

    if (auto.active) autopilotStep(dt, fox.position, grounded);
    let spaceDown = keys.has('Space');
    let dashPressed = keys.has('ShiftLeft') || keys.has('ShiftRight');
    if (auto.active) {
      wish.copy(auto.wish);
      spaceDown = auto.space;
      dashPressed = auto.dash;
    }
    jumpFeel.sampleJumpEdge(spaceDown, dt, feel.jumpBuffer);

    const wasGrounded = grounded;
    grounded = Number.isFinite(gy) && feetY <= gy + 0.1 && vel.y <= 0.15;
    if (grounded) {
      jumpFeel.onGrounded(feel.coyoteTime);
      if (jumpFeel.airTime > 0) {
        feelMetrics.lastAirTime = jumpFeel.airTime;
        feelMetrics.lastJumpApex = jumpFeel.apex;
        feelMetrics.lastTimeToApex = jumpFeel.timeToApex;
      }
      fox.position.y = gy + foxActor.feetOffset;
      feetY = gy;
      if (vel.y < 0) vel.y = 0;
      gliding = false;
      airDashUsed = false;
      groundBounce = probe.collider?.bounce ?? 1;
      if (!wasGrounded) {
        foxActor.squash(1.18, 0.72, 1.18);
        audio.play('footstep');
      }
    } else {
      jumpFeel.tickAir(dt, fox.position.y, vel.y);
    }

    const jv = jumpFeel.tryJump(feel.jumpVelocity * groundBounce, fox.position.y);
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

    // dash: ground dash any time off cooldown; one air-dash per airtime, no height loss (§3.2)
    if (dashPressed && dashT <= -0.2 && wish.lengthSq() > 0.01 && (grounded || !airDashUsed)) {
      dashT = feel.dashDuration;
      vel.x = wish.x * feel.dashSpeed;
      vel.z = wish.z * feel.dashSpeed;
      if (!grounded) {
        airDashUsed = true;
        vel.y = Math.max(vel.y, 0);
      }
      feelMetrics.dashesUsed += 1;
      audio.play('dash');
      keys.delete('ShiftLeft');
      keys.delete('ShiftRight');
    }
    dashT -= dt;
    const dashing = dashT > 0;

    gliding = !grounded && vel.y < 0 && spaceDown && !dashing;
    if (!dashing || grounded) vel.y -= feel.gravity * (gliding ? feel.glideGravityScale : 1) * dt;
    else if (!grounded) vel.y = Math.max(vel.y, 0) * 0.9;
    if (gliding) {
      vel.y = Math.max(vel.y, -glide.sink);
      vel.x *= Math.exp(-feel.glideDrag * dt);
      vel.z *= Math.exp(-feel.glideDrag * dt);
    }

    foxActor.relaxScale(dt);

    if (!dashing) {
      const desired = wish.clone().multiplyScalar(gliding ? Math.max(feel.moveSpeed, glide.forward) : feel.moveSpeed);
      const control = grounded ? 1 : gliding ? 0.9 : feel.airControl;
      const cur = new THREE.Vector3(vel.x, 0, vel.z);
      cur.lerp(desired, 1 - Math.exp(-feel.accel * control * dt));
      vel.x = cur.x;
      vel.z = cur.z;
    }

    // horizontal move with wall blocking (per axis so we slide along walls)
    const nx = fox.position.x + vel.x * dt;
    if (!col.blocked(nx, fox.position.z, feetY)) fox.position.x = nx;
    else vel.x = 0;
    const nz = fox.position.z + vel.z * dt;
    if (!col.blocked(fox.position.x, nz, feetY)) fox.position.z = nz;
    else vel.z = 0;
    prevFeet = feetY;
    fox.position.y += vel.y * dt;
    // landing this frame
    if (vel.y < 0) {
      const land = col.groundAt(fox.position.x, fox.position.z, prevFeet);
      if (Number.isFinite(land.y) && fox.position.y - foxActor.feetOffset < land.y) {
        fox.position.y = land.y + foxActor.feetOffset;
      }
    }

    if (wish.lengthSq() > 0.01) {
      const yaw = Math.atan2(wish.x, wish.z);
      fox.rotation.y = THREE.MathUtils.damp(fox.rotation.y, yaw, feel.turnRate, dt);
    }

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
      leafKick.burst(fox.position.clone().setY(fox.position.y - foxActor.feetOffset + 0.1), 0.85);
      kickCooldown = 0.18;
    }
    leafKick.update(dt);

    // Wisps / autumn (particle field follows the fox)
    fxOffset.set(fox.position.x, fox.position.y - 3, fox.position.z);
    autumnFX.leaves.position.copy(fxOffset);
    autumnFX.embers.position.copy(fxOffset);
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

    // Realm: embers, checkpoints, seedwells, bridge, wellspring, hazards
    handleEvents(world.update(dt, elapsed, fox.position, fox.position.y - foxActor.feetOffset, (q) => colorField.sample(q)));
    if (floodT >= 0) {
      floodT += dt;
      world.setFlood(Math.min(1, floodT / 5));
    }
    restore.update(dt);
    zone = world.zoneAt(fox.position.x, fox.position.z);

    // shadows follow the fox
    lights.key.target.position.copy(fox.position);
    lights.key.position.copy(fox.position).add(keyOffset);

    {
      const gyShadow = col.groundAt(fox.position.x, fox.position.z, fox.position.y - foxActor.feetOffset + 0.05).y;
      contactShadow.visible = Number.isFinite(gyShadow);
      contactShadow.position.set(fox.position.x, gyShadow + 0.03, fox.position.z);
      const air = Math.max(0, fox.position.y - foxActor.feetOffset - gyShadow);
      const k = Math.max(0.15, 1 - air * 0.35);
      contactShadow.scale.set(k, k, 1);
      (contactShadow.material as THREE.MeshBasicMaterial).opacity = 0.85 * k;
    }
    camFloorRef.y = fox.position.y + 2.5;
    cam.update(dt, fox.position, fox.rotation.y, { lookAhead: grounded ? 1.4 : 0.6 });
    if (photo) {
      cam.camera.position.copy(photo.pos);
      cam.camera.lookAt(photo.look);
      if (cam.camera.fov !== photo.fov) {
        cam.camera.fov = photo.fov;
        cam.camera.updateProjectionMatrix();
      }
    }
    audio.update(dt, speed > 1.2, grounded, gliding);

    const lit = world.seedwells.filter((q) => q.lit).length;
    hud.setStatus(
      shrineOn
        ? `AUTUMN RESTORED · embers ${embersGot}/${world.emberTotal} · ${elapsed.toFixed(1)}s`
        : `${zone} · Seedwells ${lit}/3 · embers ${embersGot}/${world.emberTotal} · ${backend}`,
    );

    publishGame({
      title: 'Fox Spirit — Russetvale',
      status,
      score: embersGot * 10 + lit * 250 + (shrineOn ? 1000 : 0),
      lives: 1,
      elapsedSec: Number(elapsed.toFixed(2)),
      deaths,
      backend,
      winCondition: 'Light 3 Seedwells, cross the root bridge, wake the Ember Wellspring',
      notes: [
        `zone=${zone}`,
        `embers=${embersGot}/${world.emberTotal}`,
        `seedwells=${world.seedwells.map((q) => `${q.id}:${q.lit ? 1 : 0}`).join(',')}`,
        `bridge=${world.bridgeGrown().toFixed(2)}`,
        `restored=${shrineOn}`,
        `pos=${fox.position.x.toFixed(1)},${(fox.position.y - foxActor.feetOffset).toFixed(1)},${fox.position.z.toFixed(1)}`,
        `apex=${feelMetrics.lastJumpApex.toFixed(3)}`,
        `air=${feelMetrics.lastAirTime.toFixed(3)}`,
        `jumps=${feelMetrics.jumps}`,
        `dashes=${feelMetrics.dashesUsed}`,
        auto.active ? `auto=${auto.idx}/${world.route.length} assists=${auto.assists}` : 'auto=off',
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
