import * as THREE from 'three';
import GUI from 'lil-gui';
import { publishGame } from '../../shared/game-state';
import {
  PRESET_SPRING,
  PRESET_BRISK,
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
  syncFog,
  createDistantLand,
  createFoxWisps,
  createAutumnParticles,
  detectQuality,
} from '../../../src/render';
import { createRussetvale, type Waypoint } from './russetvale';
import { createFox } from './fox';
import { createFollowCamera } from './camera';
import type { FoxAnimState } from './fox';
import { createGameAudio } from './audio';
import { createHud } from './hud';
import { createLeafKick, createEmberTrail } from './fx';
import { createOcclusionFader } from './occlusion';
import { createRestoreCinematic } from './restore';

/**
 * Fox feel presets, tuned on Russetvale's real gaps (marsh stones 5 m, chasm jump+dash, glide line).
 * `fallGravity` gives weight on the way down; `apexHang` floats the top of a held jump.
 */
type FoxFeel = FeelParams & { fallGravity: number; apexHang: number; glideSink: number; glideForward: number; glideDelay: number };
const FEEL_PRESETS: Record<'spring' | 'brisk', FoxFeel> = {
  spring: {
    ...PRESET_SPRING,
    moveSpeed: 8.4,
    jumpVelocity: 9.6,
    gravity: 21,
    fallGravity: 1.35,
    apexHang: 0.62,
    jumpCut: 0.45,
    airControl: 0.6,
    coyoteTime: 0.11,
    jumpBuffer: 0.13,
    glideSink: 2.5,
    glideForward: 7.9,
    glideDelay: 0.1,
  },
  brisk: {
    ...PRESET_BRISK,
    moveSpeed: 9,
    jumpVelocity: 10.2,
    gravity: 27,
    fallGravity: 1.5,
    apexHang: 0.75,
    jumpCut: 0.4,
    airControl: 0.7,
    coyoteTime: 0.1,
    jumpBuffer: 0.12,
    dashSpeed: 20,
    dashDuration: 0.2,
    glideSink: 2.7,
    glideForward: 8.4,
    glideDelay: 0.08,
  },
};
const presetParam = new URLSearchParams(location.search).get('feel');
// brisk won the Russetvale comparison (apex 1.85 m / 0.80 s air vs spring's floaty 1.05 s; route 100 s vs 110 s)
let feelPreset: keyof typeof FEEL_PRESETS = presetParam === 'spring' ? 'spring' : 'brisk';
const feel: FoxFeel = { ...FEEL_PRESETS[feelPreset] };
const jumpFeel = new JumpFeel();
const feelMetrics = emptyFeelMetrics();
const BLOOM = 0.16;
/** Ember pickup freeze — just enough to register the hit; cooldown so ember lines don't stutter */
const HITSTOP_S = 0.03;
const HITSTOP_COOLDOWN_S = 0.35;

async function boot() {
  const hud = createHud();
  hud.setStatus('Loading Russetvale…');
  const audio = createGameAudio();

  // Quality tier: ?q=low|med|high, else auto (software GL → low)
  const quality = detectQuality();
  console.info(`[quality] ${quality.tier} (${quality.reason}) gpu="${quality.gpu}"`);
  const forge = await createForgeRenderer({
    container: document.body,
    exposure: 1.18,
    shadows: quality.shadows,
    pixelRatio: quality.pixelRatio,
    softShadows: quality.softShadows,
  });
  const { renderer, backend } = forge;

  const scene = new THREE.Scene();
  const lights = applyLookdevLights(scene);
  // Low warm sun ahead-left of the shrine path (back-lights the north view, like key art)
  const sunDir = new THREE.Vector3(-0.3, 0.17, -0.94).normalize();
  lights.rim.position.copy(sunDir).multiplyScalar(20);
  lights.rim.intensity = 1.55;
  const fog = applyHeightFog(scene, { density: 0.0042 });
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
  lights.key.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
  lights.key.castShadow = quality.shadows;
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

  const cam = createFollowCamera({
    surfaceAt: (x, z, refY) => col.groundAt(x, z, refY).y,
  });
  cam.snapBehind(Math.PI);
  cam.camera.far = quality.far;
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
    bloomStrength: BLOOM,
    bloomThreshold: 0.9,
    bloomRadius: 0.6,
    vignette: 0.34,
    grain: 0.01,
    enableGTAO: quality.gtao,
    bloom: quality.bloom,
    smaa: quality.smaa,
    pixelRatio: renderer.getPixelRatio(),
  });

  const wisps = createFoxWisps(scene, 28); // spirit-fire aura
  const emberTrail = createEmberTrail(scene, 36);
  const autumnFX = createAutumnParticles(scene, Math.round(180 * quality.particleScale), Math.round(110 * quality.particleScale));
  const leafKick = createLeafKick(scene);
  const occlusion = createOcclusionFader(scene, {
    solidAt: (x, z) => col.highestAt(x, z),
    exclude: foxActor.group,
  });

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
  const usePreset = (name: keyof typeof FEEL_PRESETS) => {
    feelPreset = name;
    Object.assign(feel, FEEL_PRESETS[name]);
  };
  gui.add({ spring: () => usePreset('spring') }, 'spring');
  gui.add({ brisk: () => usePreset('brisk') }, 'brisk');
  const fFeel = gui.addFolder('Fox');
  fFeel.add(feel, 'moveSpeed', 4, 14, 0.1).listen();
  fFeel.add(feel, 'jumpVelocity', 6, 16, 0.1).listen();
  fFeel.add(feel, 'gravity', 10, 40, 0.5).listen();
  fFeel.add(feel, 'fallGravity', 1, 2.2, 0.05).listen();
  fFeel.add(feel, 'apexHang', 0.3, 1, 0.01).listen();
  fFeel.add(feel, 'jumpCut', 0.1, 1, 0.01).listen();
  fFeel.add(feel, 'airControl', 0, 1, 0.01).listen();
  fFeel.add(feel, 'coyoteTime', 0, 0.25, 0.01).listen();
  fFeel.add(feel, 'jumpBuffer', 0, 0.25, 0.01).listen();
  fFeel.add(feel, 'glideSink', 1, 5, 0.1).listen();
  fFeel.add(feel, 'glideForward', 4, 12, 0.1).listen();
  fFeel.add(feel, 'dashSpeed', 10, 30, 0.5).listen();
  fFeel.add(feel, 'dashDuration', 0.08, 0.4, 0.01).listen();
  const fCam = gui.addFolder('Camera');
  fCam.add(cam.params, 'distance', 2.5, 9, 0.1);
  fCam.add(cam.params, 'height', 0.5, 4, 0.05);
  fCam.add(cam.params, 'airDistance', 3, 10, 0.1);
  fCam.add(cam.params, 'glideDistance', 3, 12, 0.1);
  fCam.add(cam.params, 'fov', 35, 80, 0.5);
  fCam.add(cam.params, 'lag', 0.04, 0.5, 0.01);
  fCam.add(cam.params, 'lookAhead', 0, 4, 0.05);
  fCam.add(cam.params, 'recenterRate', 0, 4, 0.05);
  fCam.add(cam.params, 'sideBias', -0.6, 0.6, 0.01);
  fCam.add(cam.params, 'jumpTrack', 0, 1, 0.01);
  fCam.add(cam.params, 'landingBias', 0, 1, 0.01);
  fCam.add(cam.params, 'shake', 0, 2, 0.05);
  fCam.close();
  const fLook = gui.addFolder('Look');
  fLook.add(renderer, 'toneMappingExposure', 0.6, 1.8, 0.01).name('exposure');
  fLook.add(post.params, 'restore', 0, 1, 0.01).listen();
  fLook.add(post.params, 'bloomStrength', 0, 1, 0.01);
  fLook.add(post.params, 'bloomThreshold', 0, 2, 0.01);
  fLook.add(post.params, 'highlightKnee', 0.5, 4, 0.05);
  fLook.add(post.params, 'highlightCap', 1, 6, 0.05);
  fLook.add(post.params, 'vignette', 0, 1, 0.01);
  fLook.add(post.params, 'grain', 0, 0.05, 0.001);
  fLook.add(fog, 'density', 0, 0.012, 0.0001).name('fog').onChange(() => syncFog(scene, fog));
  for (const k of ['sepia', 'restored'] as const) {
    const f = fLook.addFolder(`grade ${k}`);
    f.add(post.grade[k], 'saturation', 0, 2, 0.01);
    f.add(post.grade[k], 'contrast', 0.6, 1.5, 0.01);
    f.add(post.grade[k], 'lift', 0, 0.05, 0.001);
    f.addColor(post.grade[k], 'shadowTint');
    f.addColor(post.grade[k], 'highlightTint');
    f.close();
  }
  fLook.close();

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
  // drag to orbit (auto-recentre resumes after cam.params.recenterDelay)
  addEventListener('pointermove', (e) => {
    if (!(e.buttons & 1) || (e.target as HTMLElement)?.closest?.('.lil-gui')) return;
    cam.orbit(-e.movementX * 0.006, e.movementY * 0.003);
  });

  const vel = new THREE.Vector3();
  let grounded = false;
  let dashT = 0;
  let gliding = false;
  let glideHoldT = 0;
  let airT = 0;
  let jumpedThisAir = false;
  let landT = 0;
  let hitstop = 0;
  let lastHitstop = -1;
  let shrineOn = false;
  let fxEnabled = true;
  let turntableMode = false;
  let turntableYaw = 0;
  let turntableAnim: FoxAnimState = 'idle';
  let embersGot = 0;
  let airDashUsed = false;
  let floodT = -1;
  let prevFeet = world.spawnPos.y;
  let groundBounce = 1;
  let deaths = 0;
  let zone = world.zoneAt(world.spawnPos.x, world.spawnPos.z);
  const takeoff = new THREE.Vector3();
  const landing = new THREE.Vector3();
  let landingValid = false;
  const jumpStats = { lastDist: 0, lastImpact: 0, lastDashDist: 0, glideDist: 0, glideDrop: 0, glideRatio: 0 };
  const dashFrom = new THREE.Vector3();
  const glideFrom = new THREE.Vector3();
  let wasGliding = false;
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
    /** false = honest run: a stall stops the bot instead of teleporting it */
    allowAssist: true,
    stalled: '' as string,
    log: [] as string[],
    act: undefined as Waypoint['act'],
  };
  let simClock = 0;
  let photo: { pos: THREE.Vector3; look: THREE.Vector3; fov: number } | null = null;
  let elapsed = 0;
  let status: 'playing' | 'won' = 'playing';
  let kickCooldown = 0;
  /** Manual clock: the harness advances sim time explicitly (deterministic captures on slow GPUs) */
  let manual = false;
  let visualDt = 0;

  const setFx = (on: boolean) => {
    fxEnabled = !!on;
    // the post stack re-applies params every frame, so write params (not the pass)
    post.params.bloomStrength = on ? BLOOM : 0;
    wisps.points.visible = fxEnabled;
    emberTrail.points.visible = fxEnabled;
  };

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
    /** Debug handles for lookdev probes (read-only use from the harness) */
    debug: { scene, renderer, post, colorField },
    teleportToShrine() {
      const p = world.wellspringPos;
      foxActor.group.position.set(p.x, p.y + foxActor.feetOffset + 0.2, p.z + 4.5);
      foxActor.group.rotation.y = Math.PI; // face north toward shrine
      prevFeet = p.y + 0.2;
      vel.set(0, 0, 0);
      photo = null;
      cam.snapBehind(Math.PI);
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
      setFx(on);
    },
    getAnim() {
      return foxActor.getAnim();
    },
    setFeelPreset(name: 'spring' | 'brisk') {
      usePreset(name === 'brisk' ? 'brisk' : 'spring');
      return feelPreset;
    },
    runTurntable(opts?: { anim?: string; fx?: boolean }) {
      turntableMode = true;
      turntableYaw = 0;
      turntableAnim = (opts?.anim as FoxAnimState) || 'idle';
      if (opts?.fx === false) setFx(false);
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
      const anim = (opts?.anim as FoxAnimState) || 'run';
      foxActor.setAnim(anim);
      // Advance a few mixer frames so run pose isn't T-pose
      for (let i = 0; i < 8; i++) foxActor.update(1 / 30, i / 30, false);
      if (opts?.fx === false) setFx(false);
      // Staged still: photo framing, not the traversal camera
      const fx = foxActor.group.position;
      photo = {
        pos: new THREE.Vector3(fx.x + 1.6, fx.y + 1.15, fx.z + 2.6),
        look: new THREE.Vector3(fx.x, fx.y + 0.45, fx.z),
        fov: 50,
      };
    },
    teleport(x: number, y: number, z: number, yaw = Math.PI) {
      foxActor.group.position.set(x, y + foxActor.feetOffset + 0.05, z);
      foxActor.group.rotation.y = yaw;
      prevFeet = y + 0.05;
      vel.set(0, 0, 0);
      photo = null;
      cam.snapBehind(yaw);
    },
    lightSeedwells() {
      for (const s of world.seedwells) {
        const p = s.pos;
        foxActor.group.position.set(p.x, p.y + foxActor.feetOffset, p.z);
        prevFeet = p.y;
        handleEvents(world.update(0.016, elapsed, foxActor.group.position, p.y, (q) => colorField.sample(q)));
      }
    },
    autopilot(on = true, fromIdx = 0, opts?: { assist?: boolean }) {
      auto.active = on;
      auto.idx = fromIdx;
      auto.phase = 'run';
      auto.stuckT = 0;
      auto.bestD = Infinity;
      auto.allowAssist = opts?.assist ?? true;
      auto.stalled = '';
    },
    /** Manual clock: pause the rAF sim; the harness calls advance() */
    setManual(on: boolean) {
      manual = !!on;
      clock.getDelta();
    },
    /** Step the sim `frames` × dt (fixed), then render once. Returns state. */
    advance(frames = 1, dt = 1 / 60, render = true) {
      for (let i = 0; i < frames; i++) step(dt);
      if (render) draw();
      return win.__gameHooks!.state && (win.__gameHooks!.state as () => unknown)();
    },
    /** Drag-orbit equivalent (radians) for keyboard steering tests */
    orbit(dYaw: number) {
      cam.orbit(dYaw);
    },
    /** Press keys for the next advance() calls (harness input in manual mode) */
    setKeys(codes: string[]) {
      keys.clear();
      for (const c of codes) keys.add(c);
    },
    photo(pos: [number, number, number], look: [number, number, number], fov = 50) {
      photo = { pos: new THREE.Vector3(...pos), look: new THREE.Vector3(...look), fov };
    },
    photoOff() {
      photo = null;
    },
    /** Render `frames` full frames (sim paused) and report per-frame cost + renderer counters across all passes. */
    perf(frames = 6) {
      draw();
      renderer.info.autoReset = false;
      renderer.info.reset();
      // readPixels forces a GPU sync (finish() is a no-op hint on SwiftShader/ANGLE)
      const gl = renderer.getContext();
      const px = new Uint8Array(4);
      const sync = () => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      };
      sync();
      const t0 = performance.now();
      for (let i = 0; i < frames; i++) {
        draw();
        sync();
      }
      const ms = (performance.now() - t0) / frames;
      const r = renderer.info.render;
      const out = {
        msPerFrame: Number(ms.toFixed(1)),
        fps: Number((1000 / ms).toFixed(2)),
        drawCalls: Math.round(r.calls / frames),
        triangles: Math.round(r.triangles / frames),
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        programs: renderer.info.programs?.length ?? 0,
        pixelRatio: renderer.getPixelRatio(),
        drawingBuffer: [renderer.domElement.width, renderer.domElement.height],
        shadowMap: renderer.shadowMap.enabled ? lights.key.shadow.mapSize.x : 0,
        passes: post.composer.passes.filter((p) => p.enabled).length,
        quality: quality.tier,
      };
      renderer.info.autoReset = true;
      return out;
    },
    state() {
      const p = foxActor.group.position;
      return {
        zone,
        embers: embersGot,
        emberTotal: world.emberTotal,
        seedwells: world.seedwells.map((s) => ({ id: s.id, lit: s.lit })),
        bridge: world.bridgeGrown(),
        restored: shrineOn,
        auto: {
          active: auto.active,
          idx: auto.idx,
          of: world.route.length,
          assists: auto.assists,
          allowAssist: auto.allowAssist,
          stalled: auto.stalled,
          log: auto.log.slice(-12),
        },
        deaths,
        t: simClock,
        pos: [p.x, p.y - foxActor.feetOffset, p.z],
        vel: [vel.x, vel.y, vel.z],
        foxYaw: foxActor.group.rotation.y,
        airT,
        anim: foxActor.getAnim(),
        grounded,
        gliding,
        preset: feelPreset,
        feel: { ...jumpStats, apex: feelMetrics.lastJumpApex, air: feelMetrics.lastAirTime },
        camera: {
          pos: cam.camera.position.toArray(),
          fov: cam.camera.fov,
          yaw: cam.getYaw(),
          occlusion: occlusion.strength,
          photo: !!photo,
          foxNdc: cam.debug.fox,
          landingNdc: cam.debug.landing,
          internals: cam.debug.internals(),
        },
        fx: { enabled: fxEnabled, quality: quality.tier, bloom: post.bloom?.enabled ? post.bloom.strength : 0, bloomParam: post.params.bloomStrength, grain: post.params.grain },
      };
    },
  };

  function triggerFlood() {
    shrineOn = true;
    status = 'won';
    floodT = 0;
    restore.trigger();
    cam.playShot({ subjects: [foxActor.group.position.clone(), world.wellspringPos.clone()], holdS: 3.2, blendS: 0.9, rise: 14 });
    cam.shake(0.45);
    hud.setStatus('AUTUMN RESTORED · Ember Wellspring awake');
  }

  function handleEvents(events: ReturnType<typeof world.update>) {
    for (const e of events) {
      if (e.type === 'ember') {
        embersGot += e.value;
        feelMetrics.gemsCollected = embersGot;
        hud.setEmbers(embersGot);
        audio.play('ember');
        if (simClock - lastHitstop > HITSTOP_COOLDOWN_S) {
          hitstop = HITSTOP_S;
          lastHitstop = simClock;
        }
        foxActor.pulse(2.2);
      } else if (e.type === 'seedwell') {
        const s = world.seedwells[e.index]!;
        colorField.restore(s.pos, s.radius, 3.2);
        audio.play('shrine');
        audio.swell(2.5);
        hud.flashRestore();
        const lit = world.seedwells.filter((q) => q.lit).length;
        hud.setPrompt(`${s.name} lit · ${lit}/3${lit === 3 ? ' · the root bridge grows' : ''}`);
        hud.hidePromptSoon(5);
        cam.playShot({ subjects: [foxActor.group.position.clone(), s.pos.clone()], holdS: 1.7, blendS: 0.6 });
        cam.shake(0.3);
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
  hud.setPrompt('WASD · Space jump / hold glide · Shift dash · drag to look · Reach the shrine');
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
  }

  /**
   * Landing preview for the camera: integrates the same rules as step() with the current input held —
   * wish acceleration + air control, fall gravity, apex hang, glide activation (held jump while falling),
   * eased glide sink, wall blocking. A short-horizon estimate, not a promise.
   */
  function predictLanding(pos: THREE.Vector3, v: THREE.Vector3, held: boolean, wishDir: THREE.Vector3, glideT: number): boolean {
    let x = pos.x;
    let y = pos.y - foxActor.feetOffset;
    let z = pos.z;
    let vx = v.x;
    let vy = v.y;
    let vz = v.z;
    let gT = glideT;
    const h = 1 / 30;
    for (let i = 0; i < 100; i++) {
      gT = held && vy < 0 ? gT + h : 0;
      const gl = gT > feel.glideDelay;
      if (gl) {
        if (vy > -feel.glideSink) vy = Math.max(vy - feel.gravity * feel.glideGravityScale * h, -feel.glideSink);
        else vy += (-feel.glideSink - vy) * (1 - Math.exp(-7 * h));
        vx *= Math.exp(-feel.glideDrag * h);
        vz *= Math.exp(-feel.glideDrag * h);
      } else {
        const hang = held && Math.abs(vy) < 1.4 ? feel.apexHang : 1;
        vy -= feel.gravity * (vy < 0 ? feel.fallGravity : 1) * hang * h;
      }
      const target = gl ? feel.glideForward : feel.moveSpeed;
      const k = 1 - Math.exp(-feel.accel * (gl ? 0.9 : feel.airControl) * h);
      vx += (wishDir.x * target - vx) * k;
      vz += (wishDir.z * target - vz) * k;
      const py = y;
      if (!col.blocked(x + vx * h, z, py)) x += vx * h;
      else vx = 0;
      if (!col.blocked(x, z + vz * h, py)) z += vz * h;
      else vz = 0;
      y += vy * h;
      if (vy < 0) {
        const gy = col.groundAt(x, z, py).y;
        if (Number.isFinite(gy) && y <= gy) {
          landing.set(x, gy, z);
          return true;
        }
      }
      if (y < pos.y - 40) return false;
    }
    return false;
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
    // steer (in air: brake once over the target; wait at the bridge head until the roots finish growing)
    const waitBridge = route[auto.idx - 1]?.label === 'bridge-head' && world.bridgeGrown() < 1;
    if ((auto.phase === 'air' && d < 0.6) || waitBridge) auto.wish.set(0, 0, 0);
    else auto.wish.set(dx / d, 0, dz / d);
    if (auto.phase === 'run') auto.space = false;
    // stuck → count an assist and hop to the waypoint (reported in state), or stop on honest runs
    if (d < auto.bestD - 0.3 || waitBridge) {
      auto.bestD = d;
      auto.stuckT = 0;
    } else auto.stuckT += dt;
    if (auto.stuckT > 7) {
      const tag = `${auto.idx}:${wp.label ?? ''}(${wp.x.toFixed(1)},${wp.y.toFixed(1)},${wp.z.toFixed(1)})`;
      if (!auto.allowAssist) {
        auto.stalled = tag;
        auto.active = false;
        auto.wish.set(0, 0, 0);
        auto.space = false;
        return;
      }
      auto.assists += 1;
      auto.log.push(`assist@${tag}`);
      foxActor.group.position.set(wp.x, wp.y + foxActor.feetOffset + 0.3, wp.z);
      prevFeet = wp.y + 0.3;
      vel.set(0, 0, 0);
      auto.stuckT = 0;
      auto.bestD = Infinity;
    }
  }

  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const wish = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  /** Fixed-input simulation step: input → physics → animation state → realm events → camera. */
  function step(rawDt: number) {
    // hit-stop freezes the fox and the world, never the camera shake / FOV
    let dt = rawDt;
    if (hitstop > 0) {
      hitstop -= rawDt;
      dt = 0;
    }
    if (status === 'playing') elapsed += dt;
    simClock += rawDt;
    visualDt += dt;
    const fox = foxActor.group;

    let ix = 0;
    let iz = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) iz -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) iz += 1;

    // camera-relative input from the traversal yaw (not the rendered pose — shots/shake don't steer)
    const cy = cam.getYaw();
    forward.set(-Math.sin(cy), 0, -Math.cos(cy));
    right.crossVectors(forward, UP).normalize();
    wish.set(0, 0, 0);
    if (ix || iz) wish.addScaledVector(right, ix).addScaledVector(forward, -iz).normalize();

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
    if (dt > 0) jumpFeel.sampleJumpEdge(spaceDown, dt, feel.jumpBuffer);

    const wasGrounded = grounded;
    const impactVy = vel.y;
    // stick to gentle downslopes/steps while running instead of popping airborne
    const snap = wasGrounded && !jumpedThisAir && vel.y <= 0 && feetY - gy < 0.35;
    grounded = Number.isFinite(gy) && (feetY <= gy + 0.1 || snap) && vel.y <= 0.15;
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
        // landing: weight goes into the camera (dip + FOV kick) and a short land clip
        const impact = THREE.MathUtils.clamp((-impactVy - 3) / 11, 0, 1);
        jumpStats.lastImpact = Number(impact.toFixed(2));
        if (jumpedThisAir) jumpStats.lastDist = Number(Math.hypot(fox.position.x - takeoff.x, fox.position.z - takeoff.z).toFixed(2));
        if (airT > 0.12) {
          cam.land(impact);
          landT = 0.1 + 0.28 * impact;
          if (impact > 0.75) cam.shake(0.18 * impact);
          audio.play('footstep');
        }
        jumpedThisAir = false;
      }
      airT = 0;
    } else {
      if (dt > 0) jumpFeel.tickAir(dt, fox.position.y, vel.y);
      airT += dt;
    }

    const jv = jumpFeel.tryJump(feel.jumpVelocity * groundBounce, fox.position.y);
    if (jv !== null) {
      vel.y = jv;
      grounded = false;
      jumpedThisAir = true;
      takeoff.copy(fox.position);
      feelMetrics.jumps += 1;
      foxActor.pulse(1.6);
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
      dashFrom.copy(fox.position);
      feelMetrics.dashesUsed += 1;
      cam.punch(5);
      cam.shake(0.22);
      foxActor.pulse(1.8);
      audio.play('dash');
      keys.delete('ShiftLeft');
      keys.delete('ShiftRight');
    }
    const wasDashing = dashT > 0;
    dashT -= dt;
    const dashing = dashT > 0;
    if (wasDashing && !dashing) jumpStats.lastDashDist = Number(Math.hypot(fox.position.x - dashFrom.x, fox.position.z - dashFrom.z).toFixed(2));

    // glide: hold jump while falling, after a short hold so a held full jump doesn't snap into it
    glideHoldT = !grounded && spaceDown && vel.y < 0 && !dashing ? glideHoldT + dt : 0;
    gliding = glideHoldT > feel.glideDelay;
    if (dashing && !grounded) vel.y = Math.max(vel.y, 0) * 0.9;
    else if (gliding) {
      // ease into the glide sink from a fast fall (no jolt), then hold it exactly
      if (vel.y > -feel.glideSink) vel.y = Math.max(vel.y - feel.gravity * feel.glideGravityScale * dt, -feel.glideSink);
      else vel.y = THREE.MathUtils.damp(vel.y, -feel.glideSink, 7, dt);
      vel.x *= Math.exp(-feel.glideDrag * dt);
      vel.z *= Math.exp(-feel.glideDrag * dt);
    } else if (!grounded) {
      // heavier fall, floaty apex while jump is held
      const hang = spaceDown && Math.abs(vel.y) < 1.4 ? feel.apexHang : 1;
      const fall = vel.y < 0 ? feel.fallGravity : 1;
      vel.y -= feel.gravity * fall * hang * dt;
    }
    if (gliding && !wasGliding) glideFrom.copy(fox.position);
    if (!gliding && wasGliding) {
      const gd = Math.hypot(fox.position.x - glideFrom.x, fox.position.z - glideFrom.z);
      const drop = glideFrom.y - fox.position.y;
      jumpStats.glideDist = Number(gd.toFixed(2));
      jumpStats.glideDrop = Number(drop.toFixed(2));
      jumpStats.glideRatio = drop > 0.2 ? Number((gd / drop).toFixed(2)) : 0;
    }
    wasGliding = gliding;

    if (!dashing) {
      const desired = wish.clone().multiplyScalar(gliding ? feel.glideForward : feel.moveSpeed);
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

    if (wish.lengthSq() > 0.01 && dt > 0) {
      const yaw = Math.atan2(wish.x, wish.z);
      // shortest-arc turn (damping raw angles spins the long way round across ±π)
      const d = Math.atan2(Math.sin(yaw - fox.rotation.y), Math.cos(yaw - fox.rotation.y));
      fox.rotation.y += d * (1 - Math.exp(-feel.turnRate * (grounded ? 1 : 0.6) * dt));
    }

    // Animation state: airborne dash wins, then glide/jump arc; land plays briefly on contact
    const speed = Math.hypot(vel.x, vel.z);
    landT -= dt;
    {
      let anim: FoxAnimState = 'idle';
      let fade = 0.16;
      let rate = 1;
      const offLedge = !grounded && !jumpedThisAir && airT < 0.14; // coyote window: keep stride
      if (dashing) {
        anim = 'dash';
        fade = 0.05;
      } else if (!grounded && !offLedge) {
        fade = 0.1;
        if (gliding) anim = 'glide';
        else if (vel.y > 2.2) anim = 'jump_up';
        else if (vel.y > -1.6) anim = 'jump_apex';
        else anim = 'jump_fall';
      } else if (landT > 0 && (speed < 3.5 || landT > 0.16)) {
        anim = 'land';
        fade = 0.05;
      } else if (speed > 1.2) {
        anim = 'run';
        // stride follows ground speed (clip authored near full run speed)
        rate = THREE.MathUtils.clamp(speed / 8.4, 0.55, 1.45);
      }
      foxActor.setAnim(anim, fade);
      foxActor.setTimeScale(rate);
      foxActor.update(dt, elapsed, gliding);
    }

    colorField.setFox(fox.position.clone().setY(fox.position.y + 0.25));
    colorField.update(dt);

    // Leaf kick while running
    kickCooldown -= dt;
    if (grounded && speed > 3.5 && kickCooldown <= 0) {
      leafKick.burst(fox.position.clone().setY(fox.position.y - foxActor.feetOffset + 0.1), 0.85);
      kickCooldown = 0.18;
    }

    // Realm: embers, checkpoints, seedwells, bridge, wellspring, hazards
    if (dt > 0) handleEvents(world.update(dt, elapsed, fox.position, fox.position.y - foxActor.feetOffset, (q) => colorField.sample(q)));
    if (floodT >= 0) {
      floodT += dt;
      world.setFlood(Math.min(1, floodT / 5));
    }
    restore.update(dt);
    zone = world.zoneAt(fox.position.x, fox.position.z);

    // through a dash, keep the last estimate (the dash is short and gravity-free)
    if (grounded) landingValid = false;
    else if (!dashing) landingValid = predictLanding(fox.position, vel, spaceDown, wish, glideHoldT);
    cam.update(rawDt, {
      target: feetPos.set(fox.position.x, fox.position.y - foxActor.feetOffset, fox.position.z),
      vel,
      grounded,
      gliding,
      dashing,
      airTime: airT,
      landing: landingValid ? landing : null,
    });
    occlusion.update(rawDt, cam.camera, renderer, feetPos, foxActor.height, fox.rotation.y);
    audio.update(dt, speed > 1.2, grounded, gliding);
  }
  const feetPos = new THREE.Vector3();
  const heroNdc = new THREE.Vector3();

  /** Visual-only work: particles, colour mask, shadows, photo override, post. */
  function draw() {
    const dt = Math.min(visualDt, 0.1);
    visualDt = 0;
    const fox = foxActor.group;
    colorField.renderMask(dt);
    for (const m of world.materials) colorField.syncMaterial(m);
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

    if (photo) {
      // staged framing (establishing shots / hero stills) — never used by traversal
      cam.camera.position.copy(photo.pos);
      cam.camera.lookAt(photo.look);
      if (cam.camera.fov !== photo.fov) {
        cam.camera.fov = photo.fov;
        cam.camera.updateProjectionMatrix();
      }
    }
    // grade follows the flood: faded sepia → rich autumn over the 6 s wave
    post.params.restore = floodT >= 0 ? THREE.MathUtils.smootherstep(floodT, 0.4, 6) : 0;

    // keep film grain off the hero
    heroNdc.set(fox.position.x, fox.position.y - foxActor.feetOffset + foxActor.height * 0.45, fox.position.z).project(cam.camera);
    const heroR = THREE.MathUtils.clamp(0.9 / Math.max(0.5, cam.camera.position.distanceTo(fox.position)), 0.05, 0.4);
    post.setHeroScreen(heroNdc.x * 0.5 + 0.5, heroNdc.y * 0.5 + 0.5, heroNdc.z < 1 ? heroR : 0);

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
        `preset=${feelPreset}`,
        `quality=${quality.tier}`,
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
        extra: {
          preset: feelPreset,
          anim: foxActor.getAnim(),
          lastJumpDist: jumpStats.lastDist,
          lastLandImpact: jumpStats.lastImpact,
          lastDashDist: jumpStats.lastDashDist,
          glideRatio: jumpStats.glideRatio,
        },
      },
    });

    post.render();
  }

  function tick() {
    const rawDt = Math.min(clock.getDelta(), 0.05);
    if (manual) {
      requestAnimationFrame(tick);
      return;
    }
    const fox = foxActor.group;
    if (turntableMode) {
      turntableYaw += rawDt * 0.7;
      // Open meadow north of the portal — clear ground for silhouette judgment
      const tx = 6;
      const tz = 76;
      const ty = world.terrainY(tx, tz);
      fox.position.set(tx, ty + foxActor.feetOffset, tz);
      fox.rotation.y = turntableYaw; // model spins; camera fixed (classic turntable)
      vel.set(0, 0, 0);
      foxActor.setAnim(turntableAnim);
      foxActor.update(rawDt, elapsed, turntableAnim === 'glide');
      cam.camera.position.set(tx, fox.position.y + 1.25, tz + 3.6);
      cam.camera.lookAt(tx, fox.position.y + 0.4, tz);
      contactShadow.position.set(tx, ty + 0.03, tz);
      contactShadow.scale.set(1, 1, 1);
      (contactShadow.material as THREE.MeshBasicMaterial).opacity = 0.75;
      sky.update(rawDt);
      post.render();
      requestAnimationFrame(tick);
      return;
    }
    step(rawDt);
    draw();
    requestAnimationFrame(tick);
  }

  tick();
}

boot().catch((err) => {
  console.error(err);
  const s = document.getElementById('status');
  if (s) s.textContent = `Boot failed: ${String(err)}`;
});
