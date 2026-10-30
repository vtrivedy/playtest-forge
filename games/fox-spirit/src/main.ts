import { createWind, type WindForce } from './chem/wind';
import { createShades } from './encounters/shades';
import { ShadeContact } from './encounters/contact';
import { createWater } from './chem/water';
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
  createEmberMotes,
} from '../../../src/render';
import { createRussetvale, type Waypoint } from './russetvale';
import { createListeningCrown } from './listeningCrown';
import { createAshwaterReach } from './ashwaterReach';
import { createFox } from './fox';
import { createFollowCamera } from './camera';
import type { FoxAnimState } from './fox';
import { createGameAudio, surfaceOf } from './audio';
import { createHud } from './hud';
import { FOX_LOOK } from './foxLook';
import { createOcclusionFader } from './occlusion';
import { createGaitGym } from './gaitGym';
import { createRestoreCinematic } from './restore';
import { createUpdrafts, type Hearth, type Lift } from './chem/updraft';
import { createInlets, heatFeeds } from './chem/inlet';
import { createGrowth, type Root } from './chem/growth';
import { SUMMIT_REPAIR } from './regionSummit';
import type { ColorStroke } from '../../../src/render/colorField';

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
/** Dash stroke (world-1.md §1.1): life s, strength (>1 punches through Shade drain), capsule radius m */
const DASH_STROKE = { life: 6, strength: 1.5, radius: 1.6 };
const HITSTOP_S = 0.03;
const HITSTOP_COOLDOWN_S = 0.35;

async function boot() {
  const hud = createHud();
  const realmTitle=document.getElementById('title-card');
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
  // late-afternoon key: low (≈27°) and amber, so trunks, ruins and the fox throw long soft shadows
  lights.key.position.set(14, 9, 11);
  lights.key.color.set(0xffc58a);
  // mist pools in the valleys and the void below the realm; summits and landmarks stay legible
  const fog = applyHeightFog(scene, { density: 0.0042, height: 0, heightFalloff: 0.045 });
  const reedLook = { fogScale: 0.65 };
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
    count: 14,
    minRadius: 300,
    maxRadius: 600,
    minY: -90,
    maxY: 15,
    minScale: 10,
    maxScale: 30,
    mistFloor: -40,
    focusBias: 0.5,
    focusAngle: Math.atan2(-1, 0), // shrine path looks north (-Z)
    sunDir,
    sunColor: sky.params.sunColor,
  });

  const world = await createRussetvale(scene);
  const crown = await createListeningCrown(scene, world);
  const reach = await createAshwaterReach(scene, world);
  const col = world.collision;
  const gaitGym = new URLSearchParams(location.search).get('gym') === 'gait' ? createGaitGym(scene, col) : null;
  let harnessStick: THREE.Vector3 | null = null;
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
  foxActor.group.position.copy(gaitGym?.spawn ?? world.spawnPos);
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
    scenery: world.group,
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
  crown.init(renderer);
  reach.init(renderer);
  colorField.groundAt = (x, z) => col.highestAt(x, z);
  // restored stone stays stone: masonry and cliff rock keep a muted warm grey, foliage/earth carry the colour
  const RESTORED_CHROMA: Record<string, number> = { 'rv-stone': 0.5, 'rv-rock': 0.75, 'rv-terrain': 0.62, 'rv-ground': 0.62 };
  for (const m of world.materials) {
    m.userData.cfRestoredChroma = RESTORED_CHROMA[m.name] ?? 1;
    colorField.patchMaterial(m);
  }

  const post = createPostStack(renderer, scene, cam.camera, {
    bloomStrength: BLOOM,
    bloomThreshold: 0.9,
    bloomRadius: 0.6,
    vignette: 0.34,
    grain: 0.01,
    enableGTAO: quality.gtao,
    bloom: quality.bloom,
    smaa: quality.smaa,
    // soft brush-dab finish toward the key art's painted look (GPU tiers only)
    painterly: quality.bloom ? 0.55 : 0,
    pixelRatio: renderer.getPixelRatio(),
  });


  const autumnFX = createAutumnParticles(scene, Math.round(180 * quality.particleScale), Math.round(60 * quality.particleScale), {
    colorField,
    groundAt: (x, z) => col.highestAt(x, z),
    // restore vortex + front leaf release share this pool with running kicks
    burstPool: 360,
  });
  // spark bursts only (Seedwell, Wellspring, hearth flares) — no pickups
  const emberMotes = createEmberMotes(scene, { maxMotes: 0 });
  const occlusion = createOcclusionFader(scene, {
    solidAt: (x, z) => col.highestAt(x, z),
    exclude: foxActor.group,
  });

  const restore = createRestoreCinematic({
    colorField,
    shrinePos: world.wellspringPos,
    radius: 235,
    autumnFX,
    motes: emberMotes,
    // ember basin on the wellspring's inner altar; open pavilion, so sparks clear the columns
    burstAt: world.wellspringPos.clone().add(new THREE.Vector3(0, 2.9, 0)),
    swirlAt: world.wellspringPos.clone().add(new THREE.Vector3(0, 1.6, 0)),
    groundAt: (x, z) => col.highestAt(x, z),
    setFlood: (k, pulse) => world.setFlood(k, pulse),
    onIgnite: () => {
      shrineOn = true;
      status = 'won';
      hud.setStatus('AUTUMN RESTORED · Ember Wellspring awake');
    },
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
  if (foxActor.locomotion) {
    const params = foxActor.locomotion.params;
    const folder = gui.addFolder('Authored locomotion');
    folder.add(params,'headLead',0,.5,.01);
    folder.add(params,'headFrequency',1,6,.1);
    folder.add(params,'headDamping',.4,1.5,.05);
    folder.add(params,'headStabilize',0,1,.05);
    folder.add(params,'tailLoad',0,.4,.01);
    folder.add(params,'brakeSquat',0,.08,.002);
    folder.add(params,'brakePitch',0,.2,.005);
    folder.add(params,'landSquash',0,.2,.005);
    folder.add(params,'landFrequency',2,6,.1);
    folder.add(params, 'trotSpeed', 2, 6, .1);
    folder.add(params, 'gallopSpeed', 4, 10, .1);
    folder.add(params, 'plantStrength', 0, 1, .01);
    folder.add(params, 'maxCorrection', 0, .3, .01);
    folder.add(params, 'turnLean', 0, .1, .001);
    folder.add(params, 'tailLag', 0, .3, .01);
    folder.add(params, 'springFrequency', 1, 6, .1);
    folder.add(params, 'springDamping', .4, 1.5, .05);
    folder.add(params, 'debug');
  }
  const fFoxLook=gui.addFolder('Fox look');
  fFoxLook.add(FOX_LOOK,'emberRate',0,60,1);
  fFoxLook.add(FOX_LOOK,'lickScale',0,3,.01);
  fFoxLook.add(FOX_LOOK,'lickIntensity',0,3,.01);
  const actionFeel = { jumpWindup: .05 };
  fFeel.add(actionFeel,'jumpWindup',0,.066,.001);
  const fAudio = gui.addFolder('Audio');
  fAudio.add(audio.settings, 'volume', 0, 1, 0.01).name('Master volume').onChange(audio.syncSettings);
  fAudio.add(audio.settings, 'muted').name('Mute (M)').listen().onChange(audio.syncSettings);
  fAudio.close();
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
  // colour chemistry (world-1.md §1, §5): hearths → ember updrafts
  const updrafts = createUpdrafts(scene, world.hearthSpots, {
    gui,
    onIgnite: (h) => {
      // struck by a dash: a harder flare than a hearth caught by the passing wake
      const byDash = h.reactor.probes.some((q) => colorField.strokeAt(q) > 0.9);
      if (byDash) dashStruck.add(h);
      h.flare = byDash ? 1.6 : 1;
      emberMotes.burst(h.base.clone().setY(h.base.y + 0.3), { count: byDash ? 60 : 26, speed: byDash ? [2, 5] : [1.2, 3.2], lift: 0.9, buoyancy: 0.8, life: [0.8, 1.8], flash: byDash ? 1.4 : 0.8, size: [0.04, 0.1], heat: 0.7 });
      audio.play('checkpoint');
      // the breath lets go: ground leaves round the hearth lift into the column
      autumnFX.swirl(h.base.clone().setY(h.base.y + 0.2), byDash ? 44 : 30, 1.7);
      if (byDash) cam.shake(0.15);
    },
  });
  const lift: Lift = { k: 0, radialK: 0, ax: 0, az: 0, hearth: null };
  const summitHearth = updrafts.hearths.find((h) => h.spot.id === SUMMIT_REPAIR.hearthId);
  let summitSeal = 0;
  const shades = await createShades(scene, world.shadeSpots, (x, z, y) => col.groundAt(x, z, y).y, gui);
  // growth (world-1.md §1.3): root knots → bridges/ramps that grow while lit
  let frontFxT = 0;
  const growth = createGrowth(scene, world.rootSpots, world.padSpots, world.collision, {
    gui,
    onIgnite: (r) => {
      const byDash = r.reactor.probes.some((q) => colorField.strokeAt(q) > 0.9);
      if (byDash) rootStruck.add(r);
      r.flare = byDash ? 1.6 : 1;
      const k = r.spot.knot;
      emberMotes.burst(k.clone().setY(k.y + 0.6), { count: byDash ? 40 : 20, speed: [0.8, 2.4], lift: 0.6, buoyancy: 0.5, life: [0.8, 1.6], flash: byDash ? 1.2 : 0.7, size: [0.03, 0.08], heat: 0.6 });
      autumnFX.swirl(k.clone().setY(k.y + 0.2), byDash ? 30 : 18, 1.4);
      audio.play('checkpoint');
      if (byDash) cam.shake(0.12);
    },
    onFront: (_r, p, dt) => {
      frontFxT -= dt;
      if (frontFxT > 0) return;
      frontFxT = 0.12;
      emberMotes.burst(p.clone().setY(p.y + 0.1), { count: 4, speed: [0.3, 1.1], lift: 0.5, buoyancy: 0.4, life: [0.6, 1.2], flash: 0.5, size: [0.025, 0.06], heat: 0.55 });
    },
    onWither: (_r, p) => autumnFX.swirl(p.clone().setY(p.y - 0.2), 6, 0.6),
  });
  const rootStruck = new Set<Root>();
  /**
   * Colour drains (world-1.md §1.2): encounters register predicates here (Shades: within 3 m). Inside a drain
   * reactors read aura/trail and spent strokes (≤ 1) as 0, and an unsupplied reactor skips its hold.
   */
  const colorDrains: Array<(p: THREE.Vector3) => boolean> = [];
  const drainedAt = (q: THREE.Vector3) => colorDrains.some((f) => f(q));
  colorDrains.push(shades.drains);
  const supplyAt = (q: THREE.Vector3) => {
    if (!drainedAt(q)) return reach.contains(q) ? reach.supplyAt(q) : crown.contains(q) ? crown.supplyAt(q) : colorField.sample(q);
    return colorField.strokeAt(q) > 1 ? 1 : 0;
  };
  const shadeContact = new ShadeContact();
  let shadeKnockbackFloor: number | null = null;
  const wind = createWind(scene, world.windSpots, { gui });
  const windF: WindForce = { k: 0, tx: 0, ty: 0, tz: 0, px: 0, py: 0, pz: 0 };
  crown.attach(updrafts, wind, gui);

  const water = createWater(scene, world.collision, gui);
  reach.attach(water, gui);
  for (const m of water.materials) { m.userData.cfRestoredChroma = 0.5; colorField.patchMaterial(m); world.materials.push(m); }
  world.waterWashedAt = water.washedAt;
  world.waterInkAt = water.inkAt;
  const inlets = createInlets(scene, world.inletSpots, updrafts.hearths[0]!.ash);
  /** Seedwell latched from its element: light it, and every reactor in its radius is restored for good */
  function latchSeedwell(i: number, quiet = false) {
    const sw = world.seedwells[i]!;
    shades.activateAfterLatch(sw.id);
    for (const h of updrafts.hearths) if (Math.hypot(h.base.x - sw.pos.x, h.base.z - sw.pos.z) <= sw.radius) h.reactor.restored = true;
    wind.restoreNear(sw.pos, sw.radius);
    water.restoreWithin(sw.pos, sw.radius);
    growth.restore(sw.id);
    const inlet = inlets.inlets.find((q) => q.seedwell === i);
    if (inlet) inlet.latched = true;
    const ev = world.latchSeedwell(i);
    if (quiet) colorField.restore(sw.pos, sw.radius, 0.05);
    else handleEvents(ev);
    saveLatches();
  }
  /** Latches are saved (world-1.md §1.4): restored on load without the ceremony. `?fresh` starts sepia. */
  const SAVE_KEY = 'fox-spirit:russetvale:latched';
  function saveLatches() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(world.seedwells.filter((s) => s.lit).map((s) => s.id)));
    } catch {
      /* storage unavailable: play on unsaved */
    }
  }
  {
    let saved: string[] = [];
    try {
      if (new URLSearchParams(location.search).has('fresh')) localStorage.removeItem(SAVE_KEY);
      saved = JSON.parse(localStorage.getItem(SAVE_KEY) ?? '[]') as string[];
    } catch {
      saved = [];
    }
    world.seedwells.forEach((s, i) => {
      if (saved.includes(s.id)) latchSeedwell(i, true);
    });
  }
  const fStroke = gui.addFolder('Chem › Dash stroke');
  fStroke.add(DASH_STROKE, 'life', 2, 10, 0.1);
  fStroke.add(DASH_STROKE, 'strength', 1, 2, 0.05);
  fStroke.add(DASH_STROKE, 'radius', 0.6, 3, 0.05);
  fStroke.close();
  let inColumn = false;
  const baseCam = { jumpTrack: cam.params.jumpTrack, height: cam.params.height, glideDistance: cam.params.glideDistance };
  let hearthLeafT = 0;
  let dashStroke: ColorStroke | null = null;
  const dashStruck = new Set<Hearth>();
  /** Dash through an already-lit hearth: the strong flare without touching its heat (the stroke supplies it) */
  function hearthStruck(h: Hearth) {
    h.flare = 1.6;
    emberMotes.burst(h.base.clone().setY(h.base.y + 0.3), { count: 50, speed: [2, 5], lift: 0.9, buoyancy: 0.8, life: [0.8, 1.8], flash: 1.3, size: [0.04, 0.1], heat: 0.7 });
    autumnFX.swirl(h.base.clone().setY(h.base.y + 0.2), 24, 1.7);
    audio.play('checkpoint');
    cam.shake(0.12);
  }
  const fLook = gui.addFolder('Look');
  const fFox = fLook.addFolder('fox');
  fFox.add(FOX_LOOK.furTint, '0', 0.5, 1.5, 0.01).name('fur tint r');
  fFox.add(FOX_LOOK.furTint, '1', 0.5, 1.5, 0.01).name('fur tint g');
  fFox.add(FOX_LOOK.furTint, '2', 0.5, 1.5, 0.01).name('fur tint b');
  fFox.add(FOX_LOOK, 'furSaturation', 0, 1.5, 0.01);
  fFox.add(FOX_LOOK, 'furValue', 0.5, 1.5, 0.01);
  fFox.add(FOX_LOOK, 'strokeStrength', 0, 0.5, 0.01);
  fFox.add(FOX_LOOK, 'strokeScale', 0.25, 4, 0.01);
  fFox.add(FOX_LOOK, 'rimStrength', 0, 2, 0.01);
  fFox.add(FOX_LOOK, 'rimPower', 1, 8, 0.1);
  fFox.add(FOX_LOOK, 'eyeGlow', 0, 3, 0.01);
  fFox.add(FOX_LOOK, 'lickScale', 0, 3, 0.01);
  fFox.add(FOX_LOOK, 'lickIntensity', 0, 3, 0.01);
  fFox.add(FOX_LOOK, 'lickStream', 0, 1, 0.01);
  fFox.add(FOX_LOOK, 'emberRate', 0, 60, 1);
  fFox.add(FOX_LOOK, 'emberSize', 0.005, 0.08, 0.001);
  fFox.close();
  fLook.add(renderer, 'toneMappingExposure', 0.6, 1.8, 0.01).name('exposure');
  fLook.add(post.params, 'restore', 0, 1, 0.01).listen();
  fLook.add(post.params, 'bloomStrength', 0, 1, 0.01);
  fLook.add(post.params, 'bloomThreshold', 0, 2, 0.01);
  fLook.add(post.params, 'highlightKnee', 0.5, 4, 0.05);
  fLook.add(post.params, 'highlightCap', 1, 6, 0.05);
  fLook.add(post.params, 'vignette', 0, 1, 0.01);
  fLook.add(post.params, 'grain', 0, 0.05, 0.001);
  fLook.add(post.params, 'painterly', 0, 1, 0.01);
  fLook.add(reedLook, 'fogScale', 0.4, 1, 0.01).name('Reed haze');
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
  let windupT = -1;
  let skidT = 0;
  let previousSpeed = 0;
  let hitstop = 0;
  let lastHitstop = -1;
  let shrineOn = false;
  let fxEnabled = true;
  let turntableMode = false;
  let turntableYaw = 0;
  let turntableAnim: FoxAnimState = 'idle';
  let airDashUsed = false;
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
    /** route act 'dash': press dash toward the next waypoint on the next step */
    dashQueued: false,
    phase: 'run' as 'run' | 'air',
    liftReady: false,
    pressT: 0,
    stuckT: 0,
    /** seconds spent holding still for an element (lift, seal, root, wash); a hang is a stall, not a wait */
    waitT: 0,
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
  /** When set, step() keeps this clip instead of picking from locomotion (run-strip captures). */
  let harnessAnimLock: FoxAnimState | null = null;
  let visualDt = 0;

  const setFx = (on: boolean) => {
    fxEnabled = !!on;
    // the post stack re-applies params every frame, so write params (not the pass)
    post.params.bloomStrength = on ? BLOOM : 0;

    foxActor.setSpiritFxVisible(fxEnabled);
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
    shadesProbe() {
      const p = new THREE.Vector3(...shades.state()[0]!.pos as [number, number, number]);
      const weak = supplyAt(p);
      const draining = shades.drains(p);
      return { p: p.toArray(), draining, weak, raw: colorField.sample(p), stroke: colorField.strokeAt(p) };
    },
    shades: { state: () => ({ ...shadeContact.state(), actors: shades.state() }), tun: shades.tun, drains: (x: number, y: number, z: number) => shades.drains(new THREE.Vector3(x, y, z)) },
    hasClips: foxActor.hasClips,
    foxLook: FOX_LOOK,
    gym: gaitGym ? { slopeDegrees: 15, origin: gaitGym.spawn.toArray() } : null,
    setStick(x: number | null, z = 0) {
      if (x === null) { harnessStick = null; return; }
      harnessStick = new THREE.Vector3(x, 0, z);
      if (harnessStick.length() > 1) harnessStick.normalize();
    },
    locomotion: foxActor.locomotion,
    /** Debug handles for lookdev probes (read-only use from the harness) */
    debug: { scene, renderer, post, colorField, camera: cam.camera, fox: foxActor.group, world },
    /** Colour-chemistry hooks for other modules (encounters push drain predicates; see world-1.md §1.2) */
    chem: { water, updrafts, inlets, growth, colorDrains, supplyAt },
    fx: { autumnFX, emberMotes },
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
    /** Staged: start the restore sequence from wherever the fox stands (real play uses the trigger). */
    forceRestore() {
      if (!shrineOn) triggerFlood();
    },
    /** Undo the Wellspring restore (clean sepia replay of the real event) */
    resetRestore() {
      restore.reset();
      world.resetWellspring();
      summitSeal = 0;
      shrineOn = false;
      status = 'playing';
      hud.setStatus(`Sepia Russetvale · ${backend}`);
      return { restored: shrineOn, phase: restore.phase };
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
      harnessAnimLock = turntableAnim;
      setFx(opts?.fx !== false);
      foxActor.setAnim(turntableAnim);
    },
    stopTurntable() {
      turntableMode = false;
      harnessAnimLock = null;
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
      harnessAnimLock = anim;
      foxActor.setAnim(anim);
      // Advance a few mixer frames so run pose isn't T-pose
      for (let i = 0; i < 8; i++) foxActor.update(1 / 30, i / 30, false);
      setFx(opts?.fx !== false);
      // Staged still: photo framing, not the traversal camera
      const fx = foxActor.group.position;
      photo = {
        pos: new THREE.Vector3(fx.x + 1.6, fx.y + 1.15, fx.z + 2.6),
        look: new THREE.Vector3(fx.x, fx.y + 0.45, fx.z),
        fov: 50,
      };
    },
    teleport(x: number, y: number, z: number, yaw = Math.PI) {
      shades.resetSweep();
      foxActor.group.position.set(x, y + foxActor.feetOffset + 0.05, z);
      foxActor.group.rotation.y = yaw;
      windupT=-1;
      foxActor.locomotion?.reset();
      prevFeet = y + 0.05;
      vel.set(0, 0, 0);
      photo = null;
      cam.snapBehind(yaw);
    },
    route() {
      return world.route;
    },
    lightSeedwells() {
      for (let i = 0; i < world.seedwells.length; i++) latchSeedwell(i);
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
    /** Read-only review-camera clearance, including scenery without gameplay colliders. */
    photoBlocker(pos: [number, number, number], look: [number, number, number]) {
      const origin = new THREE.Vector3(...look), delta = new THREE.Vector3(...pos).sub(origin);
      const ray = new THREE.Raycaster(origin, delta.clone().normalize(), 0.15, delta.length() + 0.25);
      world.group.updateWorldMatrix(true, true);
      let hit = ray.intersectObject(world.group, true).find((h) => h.object.visible);
      if (!hit) {
        ray.set(new THREE.Vector3(...pos), delta.clone().normalize().negate());
        hit = ray.intersectObject(world.group, true).find((h) => h.object.visible);
      }
      return hit ? { distance: hit.distance, name: hit.object.name, point: hit.point.toArray() } : null;
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
        seedwells: world.seedwells.map((s) => ({ id: s.id, lit: s.lit })),
        chem: { water: water.state(), ...updrafts.state(), wind: wind.state(), growth: growth.state(), inlets: inlets.inlets.map((q) => ({ seedwell: world.seedwells[q.seedwell]!.id, seal: Number(q.seal.toFixed(3)), fed: q.fed, latched: q.latched })) },
        crown: crown.state(),
        reach: reach.state(),
        albumPages: world.reedRegion.pageFound ? ['reed-ruin'] : [],
        bridge: world.bridgeGrown(),
        restored: shrineOn,
        shades: { ...shadeContact.state(), tun: { ...shades.tun }, actors: shades.state() },
        audio: audio.debug(),
        restore: { phase: restore.phase, age: restore.age, floodAge: restore.floodAge, frontRadius: restore.frontRadius, inputLocked: restore.inputLocked, path: cam.pathState() },
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
        locomotion: foxActor.locomotion?.metrics,
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
        look: { quality: quality.tier, gpu: quality.gpu, floodT: restore.floodAge, grade: post.params.restore, resScale: res.scale, pixelRatio: renderer.getPixelRatio() },
        fx: { enabled: fxEnabled, quality: quality.tier, bloom: post.bloom?.enabled ? post.bloom.strength : 0, bloomParam: post.params.bloomStrength, grain: post.params.grain },
      };
    },
  };

  /** The basin was fed (root-lifted lintel + summit hearth): the restore sequence takes the lens and ignites at IGNITE_S (restore.ts). */
  function triggerFlood() {
    restore.begin(foxActor.group.position.clone().setY(foxActor.group.position.y - foxActor.feetOffset));
  }

  function handleEvents(events: ReturnType<typeof world.update>) {
    for (const e of events) {
      if (e.type === 'seedwell') {
        shadeContact.wisps = 3;
        const s = world.seedwells[e.index]!;
        colorField.restore(s.pos, s.radius, 3.2);
        autumnFX.swirl(s.pos, 40, 1.6);
        emberMotes.burst(s.pos.clone().setY(s.pos.y + 1), { count: 36, speed: [1.2, 3], lift: 0.5, flash: 1.2, size: [0.04, 0.08] });
        audio.play('shrine');
        audio.swell(2.5);
        hud.flashRestore();
        const lit = world.seedwells.filter((q) => q.lit).length;
        hud.setPrompt(`${s.name} lit · ${lit}/3${lit === 3 ? ' · the root bridge grows' : ''}`);
        hud.hidePromptSoon(5);
        cam.playShot({ subjects: [foxActor.group.position.clone(), s.pos.clone()], holdS: 1.7, blendS: 0.6 });
        cam.shake(0.3);
      } else if (e.type === 'page') {
        audio.play('checkpoint');
        hud.setPrompt('A pressed page returns to the Album.');
        hud.hidePromptSoon(4);
      } else if (e.type === 'bridge') {
        audio.play('bridge');
      } else if (e.type === 'checkpoint') {
        shadeContact.wisps = 3;
        audio.play('checkpoint');
      } else if (e.type === 'hazard') {
        audio.play('hazard');
        respawn();
        audio.play('respawn');
        deaths += 1;
        hud.setPrompt(e.kind === 'ink' ? 'The ink swallows colour — keep to the stones' : 'The cloud sea returns you');
        hud.hidePromptSoon(3);
      }
    }
  }

  hud.setStatus(`Sepia Russetvale · ${backend}`);
  hud.setPrompt('WASD · Space jump / hold glide · Shift dash · drag to look · Reach the shrine');
  hud.hidePromptSoon(8);

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
    shades.resetSweep();
    shadeContact.respawn();
    const p = world.respawnPos();
    foxActor.group.position.set(p.x, p.y + foxActor.feetOffset + 0.1, p.z);
    prevFeet = p.y + 0.1;
    vel.set(0, 0, 0);
    if (auto.active) {
      // Retry the route from its checkpoint approach; a far-side target after a
      // death cuts across the marsh ink instead of re-entering the boardwalk.
      let retry = 0, nearest = Infinity;
      for (let i = 0; i < Math.min(auto.idx + 1, world.route.length); i++) {
        const w = world.route[i]!;
        if (!w.label?.startsWith('cp-') && !w.label?.startsWith('SW')) continue;
        const d = Math.hypot(w.x - p.x, w.z - p.z);
        if (d < nearest) { nearest = d; retry = i; }
      }
      auto.idx = retry;
      auto.phase = 'run'; auto.act = undefined; auto.space = false;
      auto.dash = auto.dashQueued = false;
      auto.wish.set(0, 0, 0); auto.stuckT = 0; auto.bestD = Infinity;
      auto.log.push(`retry@${retry}`);
    }
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
    const reach = wp.label === 'channel' || wp.label?.startsWith('wash:') || wp.label?.startsWith('lift:') || wp.label?.startsWith('wind-ready:') ? 0.28 : 0.9;
    // drop/lift waypoints are consumed only standing at their own height (never from above, mid-fall)
    const level = wp.label?.startsWith('drop:') || wp.label?.startsWith('lift:') ? Math.abs(wp.y - (pos.y - foxActor.feetOffset)) < 1.0 && onGround : true;
    if (d < reach && wp.y - (pos.y - foxActor.feetOffset) < 1.0 && level && (onGround || auto.phase === 'run')) {
      auto.idx += 1;
      auto.stuckT = 0;
      auto.bestD = Infinity;
      if (wp.act === 'dash' && onGround) {
        auto.dashQueued = true;
        return;
      }
      if (wp.act && onGround) {
        auto.liftReady = false;
        auto.act = wp.act;
        auto.phase = 'air';
        auto.pressT = 0;
        auto.space = true;
      }
      return;
    }
    // steer (in air: brake once over the target; wait at the bridge head until the roots finish growing)
    const prevLabel = route[auto.idx - 1]?.label;
    // wait at the bridge head for the roots, and at SW2/SW3 until the hearth has fed the seal (the marsh ink drains on latch)
    const waitSeedwell = ((prevLabel === 'SW2' || prevLabel === 'SW3') && !world.seedwells.find((s) => s.id === prevLabel)!.lit) || (prevLabel === 'SW1-feed' && !world.seedwells[0]!.lit) || (prevLabel === 'SW3-feed' && !world.seedwells[2]!.lit);
    // Let the visible front cross the six-metre bed before stepping off the dry boardwalk.
    const waitWash = !!prevLabel?.startsWith('wash:') && !water.arriving(prevLabel.slice(5));
    const liftWp = route[auto.idx - 1];
    // ride until half a metre above the next stand (or an explicit rise above the lift itself)
    const liftTop = liftWp?.rise !== undefined ? liftWp.y + liftWp.rise : wp.y + 0.5;
    if (prevLabel?.startsWith('lift:') && pos.y - foxActor.feetOffset >= liftTop) auto.liftReady = true;
    const waitLift = !!prevLabel?.startsWith('lift:') && !auto.liftReady;
    const waitFinale = prevLabel === 'wellspring' && !shrineOn;
    const waitWind = !!prevLabel?.startsWith('wind-ready:') && (wind.state().find(w => w.id === prevLabel.slice(11))?.heat ?? 0) < 0.98;
    const waitBridge = waitWind || waitLift || waitWash || waitFinale || (prevLabel === 'bridge-head' && world.bridgeGrown() < 1) || waitSeedwell || (!!prevLabel?.startsWith('grow:') && growth.grown(prevLabel.slice(5)) < 1);
    if ((auto.phase === 'air' && d < 0.6) || waitBridge) auto.wish.set(0, 0, 0);
    else auto.wish.set(dx / d, 0, dz / d);
    if (auto.phase === 'run') auto.space = false;
    if (auto.dashQueued) {
      auto.dash = true;
      auto.dashQueued = false;
    }
    // stuck → count an assist and hop to the waypoint (reported in state), or stop on honest runs
    auto.waitT = waitBridge ? auto.waitT + dt : 0;
    if (auto.waitT > 25 && !auto.allowAssist) {
      auto.stalled = `${auto.idx}:wait-after-${prevLabel ?? ''}`;
      auto.active = false;
      auto.wish.set(0, 0, 0);
      auto.space = false;
      return;
    }
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

    if (harnessStick) wish.copy(harnessStick);

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
    if (restore.inputLocked) {
      // the restore sequence owns the fox: a slow step up to the basin, no jump/dash
      restore.walkWish(fox.position, wish);
      spaceDown = false;
      dashPressed = false;
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
          landT = Math.hypot(vel.x,vel.z)>1.5 ? .083 : .30;
          if (impact > 0.75) cam.shake(0.18 * impact);
          audio.play('land', { strength: impact, surface: surfaceOf(probe.collider?.tag) });
        }
        jumpedThisAir = false;
      }
      airT = 0;
    } else {
      if (dt > 0) jumpFeel.tickAir(dt, fox.position.y, vel.y);
      airT += dt;
    }

    // Three 60Hz frames of visible load; coyote jumps keep immediate launch.
    let jv: number | null = null;
    if (windupT >= 0) {
      windupT += dt;
      if (windupT >= actionFeel.jumpWindup || !grounded) {
        windupT=-1;
        jv=jumpFeel.tryJump(feel.jumpVelocity * groundBounce,fox.position.y);
      }
    } else if (grounded && jumpFeel.buffer>0 && actionFeel.jumpWindup>0) windupT=0;
    else jv=jumpFeel.tryJump(feel.jumpVelocity * groundBounce,fox.position.y);
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
      // the dash is the brush: a 6 s strong colour stroke along its path (world-1.md §1.1)
      dashStroke = colorField.stroke(fox.position.clone().setY(fox.position.y + 0.25), fox.position.clone().setY(fox.position.y + 0.25), { life: DASH_STROKE.life, strength: DASH_STROKE.strength, radius: DASH_STROKE.radius });
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

    // ember updraft at the feet (chem/updraft.ts): lift factor k, axis for steering/centering
    updrafts.liftAt(fox.position.x, fox.position.y - foxActor.feetOffset, fox.position.z, lift);
    wind.forceAt(fox.position, windF);
    const enteredColumn = lift.k > 0.02 && !inColumn && !grounded;
    inColumn = lift.k > 0.02 && !grounded;
    if (enteredColumn) cam.punch(3);
    // ride framing: the lens follows the full rise in a column (normal jumps keep the partial track)
    const riding = inColumn || (gliding && lift.k > 0);
    cam.params.jumpTrack = THREE.MathUtils.damp(cam.params.jumpTrack, riding ? 1 : baseCam.jumpTrack, 3, dt);
    // and rides above the fox, pulled in, looking down the column (the source stays in frame, the sun leaves it)
    cam.params.height = THREE.MathUtils.damp(cam.params.height, riding ? baseCam.height + 2.4 : baseCam.height, 2.2, dt);
    cam.params.glideDistance = THREE.MathUtils.damp(cam.params.glideDistance, riding ? baseCam.glideDistance - 0.9 : baseCam.glideDistance, 2.2, dt);
    // glide: hold jump while falling, after a short hold so a held full jump doesn't snap into it.
    // In a burning column glide starts at once and persists through the rise while jump is held.
    glideHoldT = !grounded && spaceDown && !dashing && (vel.y < 0 || gliding || inColumn) ? glideHoldT + dt : 0;
    gliding = glideHoldT > feel.glideDelay || (inColumn && glideHoldT > 0);
    if (dashing && !grounded) vel.y = Math.max(vel.y, 0) * 0.9;
    else if (gliding && lift.k > 0) {
      // ride the column: vy eases toward the lift target (no snap at the column edge)
      const vTarget = THREE.MathUtils.lerp(-feel.glideSink, updrafts.tun.maxRise, lift.k);
      vel.y = THREE.MathUtils.damp(vel.y, vTarget, updrafts.tun.liftResponse, dt);
      vel.x *= Math.exp(-feel.glideDrag * dt);
      vel.z *= Math.exp(-feel.glideDrag * dt);
    } else if (gliding && windF.k > 0) {
      // ride the wind: sink mostly held, plus the current's own climb/descent
      const vTarget = -feel.glideSink * (1 - wind.tun.hold * windF.k) + windF.ty * wind.tun.push * windF.k;
      vel.y = THREE.MathUtils.damp(vel.y, vTarget, 3, dt);
      vel.x *= Math.exp(-feel.glideDrag * dt);
      vel.z *= Math.exp(-feel.glideDrag * dt);
    } else if (gliding) {
      // ease into the glide sink from a fast fall (no jolt), then hold it exactly
      if (vel.y > -feel.glideSink) vel.y = Math.max(vel.y - feel.gravity * feel.glideGravityScale * dt, -feel.glideSink);
      else vel.y = THREE.MathUtils.damp(vel.y, -feel.glideSink, 7, dt);
      vel.x *= Math.exp(-feel.glideDrag * dt);
      vel.z *= Math.exp(-feel.glideDrag * dt);
    } else if (!grounded) {
      // heavier fall, floaty apex while jump is held; a column softens a plain fall
      const hang = spaceDown && Math.abs(vel.y) < 1.4 ? feel.apexHang : 1;
      const fall = vel.y < 0 ? feel.fallGravity * (1 - updrafts.tun.fallLift * lift.k) : 1;
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

    const speedBeforeControl=Math.hypot(vel.x,vel.z);
    const opposition=speedBeforeControl>.01 && wish.lengthSq()>.001 ? (vel.x*wish.x+vel.z*wish.z)/(speedBeforeControl*wish.length()) : -1;
    const brakeIntent=grounded && !dashing && speedBeforeControl>1 && opposition<-.5 ? THREE.MathUtils.clamp((.35-opposition)/1.35,0,1) : 0;
    if (!dashing) {
      const desired = wish.clone().multiplyScalar(gliding ? feel.glideForward * (1 - updrafts.tun.columnSteer * lift.radialK * (lift.k > 0 ? 1 : 0)) : feel.moveSpeed);
      if (gliding && lift.k > 0) {
        // centre pull: the column holds a glider instead of letting it sail through
        const dx = lift.ax - fox.position.x;
        const dz = lift.az - fox.position.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.05) desired.add(new THREE.Vector3(dx / d, 0, dz / d).multiplyScalar(updrafts.tun.centerPull * lift.radialK));
      }
      if (gliding && windF.k > 0) {
        // the current carries the glider along it and gently back toward its core
        desired.x += windF.tx * wind.tun.push * windF.k;
        desired.z += windF.tz * wind.tun.push * windF.k;
        const pd = Math.hypot(windF.px, windF.pz);
        if (pd > 0.3) desired.add(new THREE.Vector3(windF.px / pd, 0, windF.pz / pd).multiplyScalar(wind.tun.centerPull * windF.k * Math.min(1, pd / 2)));
      }
      const control = grounded ? 1 : gliding ? 0.9 : feel.airControl;
      const cur = new THREE.Vector3(vel.x, 0, vel.z);
      if(grounded && wish.lengthSq()>.001) {
        const targetYaw=Math.atan2(wish.x,wish.z);
        const error=Math.atan2(Math.sin(targetYaw-fox.rotation.y),Math.cos(targetYaw-fox.rotation.y));
        fox.rotation.y+=THREE.MathUtils.clamp(error,-4.5*dt,4.5*dt);
        // Brake through a reversal; forward drive returns as the body points into the input.
        const drive=Math.max(0,Math.cos(error));
        desired.set(Math.sin(fox.rotation.y),0,Math.cos(fox.rotation.y)).multiplyScalar(feel.moveSpeed*wish.length()*drive);
      }
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

    const faceShrine = restore.inputLocked && wish.lengthSq() <= 0.01;
    if ((!grounded || faceShrine) && (wish.lengthSq() > 0.01 || faceShrine) && dt > 0) {
      const yaw = faceShrine ? restore.faceYaw : Math.hypot(vel.x, vel.z) > .6 ? Math.atan2(vel.x, vel.z) : Math.atan2(wish.x, wish.z);
      // shortest-arc turn (damping raw angles spins the long way round across ±π)
      const d = Math.atan2(Math.sin(yaw - fox.rotation.y), Math.cos(yaw - fox.rotation.y));
      const turnStep=d * (1 - Math.exp(-feel.turnRate * (grounded ? 1 : 0.6) * dt));
      fox.rotation.y += THREE.MathUtils.clamp(turnStep,-4.5*dt,4.5*dt);
    }

    shadeContact.update(dt, (dx, dz) => {
      const beforeX = fox.position.x, beforeZ = fox.position.z;
      const fy = fox.position.y - foxActor.feetOffset;
      const safe = (x: number, z: number) => {
        if (col.blocked(x, z, fy)) return false;
        // A hit on safe ground must not add an unavoidable >6 m drop to its wisp cost.
        if (shadeKnockbackFloor !== null && col.groundAt(x, z, fy + 0.2).y < shadeKnockbackFloor) return false;
        return true;
      };
      if (safe(fox.position.x + dx, fox.position.z)) fox.position.x += dx;
      if (safe(fox.position.x, fox.position.z + dz)) fox.position.z += dz;
      return Math.hypot(fox.position.x - beforeX, fox.position.z - beforeZ);
    });
    for (const e of shades.update(dt, simClock, fox.position.clone().setY(fox.position.y - foxActor.feetOffset), dashing)) {
      if (e.type === 'freed') {
        shadeContact.frees++;
        hitstop = 0.08;
        cam.shake(0.12);
        audio.play('bridge');
        hud.setPrompt('The Keeping loosens. A memory returns.');
        hud.hidePromptSoon(3);
      } else if (shadeContact.hit(fox.position, e.pos, shades.tun.knockback, shades.tun.invulnerability)) {
        shadeKnockbackFloor = grounded ? fox.position.y - foxActor.feetOffset - 6 : null;
        vel.y = Math.max(vel.y, 4.2);
        grounded = false;
        cam.shake(0.2);
        foxActor.pulse(0.4);
        audio.play('hazard');
        hud.setPrompt(`${shadeContact.wisps} ember wisps · Dash through the ink to free it`);
        hud.hidePromptSoon(3);
        if (shadeContact.wisps === 0) { respawn(); deaths++; }
      }
    }


    // Animation state: airborne dash wins, then glide/jump arc; land plays briefly on contact
    const speed = Math.hypot(vel.x, vel.z);
    landT -= dt;
    skidT -= dt;
    if (grounded && wish.lengthSq() < .01 && previousSpeed > 4 && speed < previousSpeed) skidT = Math.max(skidT, .3);
    previousSpeed = speed;
    {
      let anim: FoxAnimState = 'idle';
      let fade = 0.16;
      let rate = 1;
      if (harnessAnimLock) {
        anim = harnessAnimLock;
        fade = 0.05;
        rate = harnessAnimLock === 'run' ? 1 : 1;
      } else {
        const offLedge = !grounded && !jumpedThisAir && airT < 0.14; // coyote window: keep stride
        if (windupT >= 0) {
          anim='jump_up'; fade=.04;
        } else if (dashing) {
          anim = 'dash';
          fade = 0.05;
        } else if (!grounded && !offLedge) {
          fade = 0.1;
          if (gliding) anim = 'glide';
          else if (vel.y > 2.2) anim = 'jump_up';
          else if (vel.y > -1.6) anim = 'jump_apex';
          else anim = 'jump_fall';
        } else if (landT > 0 && (speed < 1.5 || landT > .033)) {
          anim = 'land';
          fade = 0.05;
        } else if (skidT > 0 && wish.lengthSq() < .01) {
          anim = 'skid'; fade = .06;
        } else if (speed < .6 && Math.abs(foxActor.locomotion?.metrics.turnRate ?? 0) > .8) {
          anim = (foxActor.locomotion?.metrics.turnRate ?? 0) > 0 ? 'turn_left' : 'turn_right';
        } else if (speed > 0.08) {
          anim = 'run';
          // Authored locomotion computes cadence from stance sweep and blended stride length.
        }
      }
      foxActor.setMotion?.({ speed: harnessAnimLock==='run' ? 9 : harnessAnimLock==='walk' ? 1.4 : harnessAnimLock==='trot' ? 3.8 : speed, grounded, yaw: fox.rotation.y, verticalSpeed: vel.y, brake: brakeIntent, lookYaw: wish.lengthSq()>.001 ? Math.atan2(wish.x,wish.z) : fox.rotation.y,
        groundAt: (x, z, ceiling) => col.groundAt(x, z, ceiling).y });
      foxActor.setAnim(anim, fade);
      foxActor.setTimeScale(rate);
      foxActor.update(dt, elapsed, gliding || harnessAnimLock === 'glide');
    }

    colorField.setFox(fox.position.clone().setY(fox.position.y + 0.25));
    if (dashStroke) {
      dashStroke.b.copy(colorField.fox);
      // a dash through a hearth always flares it, whether cold, holding or guttering (once per stroke)
      for (const h of updrafts.hearths) {
        if (dashStruck.has(h) || !h.reactor.probes.some((q) => colorField.strokeAt(q) > 1)) continue;
        dashStruck.add(h);
        if (h.reactor.state !== 'cold') hearthStruck(h);
      }
      // a dash along a lit knot re-flares it (the stroke supplies the heat)
      for (const r of growth.roots) {
        if (rootStruck.has(r) || !r.reactor.probes.some((q) => colorField.strokeAt(q) > 1)) continue;
        rootStruck.add(r);
        if (r.reactor.state !== 'cold') r.flare = 1.6;
      }
      if (!dashing) {
        dashStroke = null;
        dashStruck.clear();
        rootStruck.clear();
      }
    }
    colorField.update(dt);
    if (colorField.globalColor >= 0.99) water.restoreAll();
    crown.sync(dt, colorField);
    reach.sync(dt, colorField);
    water.update(dt, simClock, supplyAt, drainedAt);
    updrafts.update(dt, simClock, supplyAt, document.body.classList.contains('debug-on'), drainedAt);
    wind.update(dt, simClock, supplyAt, document.body.classList.contains('debug-on'), drainedAt);
    growth.update(dt, simClock, supplyAt, document.body.classList.contains('debug-on'), grounded ? (probe.collider?.tag ?? 'terrain') : null, drainedAt);
    // a burning hearth warms the ground round it (visual only: reactors never read glows, so no feedback)
    colorField.glows.length = 0;
    hearthLeafT += dt;
    const leafPulse = hearthLeafT > 1.6;
    if (leafPulse) hearthLeafT = 0;
    for (const h of updrafts.hearths) if (h.reactor.heat > 0) {
      colorField.glows.push({ x: h.base.x, z: h.base.z, radius: 4.2, strength: h.reactor.heat * 0.8 });
      // keep leaves riding a burning column, near the fox only (shared leaf pool)
      if (leafPulse && h.reactor.heat > 0.6 && h.base.distanceTo(fox.position) < 30) autumnFX.swirl(h.base.clone().setY(h.base.y + 0.2), 8, 1.5);
    }
    for (const i of inlets.update(dt, (q) => { if (q.source === 'reed-falls') return water.arriving(q.source); if (q.source === 'sw3-root') { const r = growth.roots.find((x) => x.spot.id === q.source); return !!r && r.grown >= 0.999 && r.reactor.heat >= 0.5 && r.wither <= 0; } return updrafts.hearths.some((h) => heatFeeds(h, q.pos, updrafts.tun.radius)); })) latchSeedwell(i);
    for (const q of inlets.inlets) world.seedwells[q.seedwell]!.seal = q.seal;
    // summit finale: the root holds the lintel up, the hearth's column (clipped by the stone) reaches the basin
    world.summit.update(dt, growth.roots, shrineOn);
    world.summit.fitColumn(summitHearth, updrafts.tun);
    summitSeal = world.summit.feeds(summitHearth, updrafts.tun.radius) ? summitSeal + dt : Math.max(0, summitSeal - dt);
    if (summitSeal >= SUMMIT_REPAIR.latchTime && !shrineOn && restore.phase === 'idle') {
      world.lightWellspring();
      triggerFlood();
    }
    updrafts.trackRide(dt, fox.position.y - foxActor.feetOffset, vel.y, grounded, lift, grounded ? (probe.collider?.tag ?? 'terrain') : null);

    reach.update(dt, fox.position, fox.position.y - foxActor.feetOffset, grounded, shrineOn, dashing, shades.drains(new THREE.Vector3(117,30,-118)));
    crown.update(dt, (p, r) => {
      autumnFX.swirl(p, 40, 1.6);
      audio.play('shrine');
      hud.setPrompt('The crown breathes · follow the leaves home');
      hud.hidePromptSoon(4);
    });

    // Quiet leaf contacts belong to planted paws, not a periodic emitter behind the body.
    if (grounded && speed > 2) {
      for (const paw of foxActor.locomotion?.footfalls ?? []) autumnFX.kick(paw, .18);
    }

    if (dt > 0) handleEvents(world.update(dt, elapsed, fox.position, fox.position.y - foxActor.feetOffset, (q) => colorField.sample(q)));
    if (reach.submergedAt(fox.position, fox.position.y - foxActor.feetOffset)) handleEvents([{type:'hazard',kind:'ink'}]);
    restore.update(dt);
    zone = reach.contains(fox.position) ? `Ashwater Reach · ${reach.state().level.toUpperCase()}` : world.zoneAt(fox.position.x, fox.position.z);
    if(realmTitle)realmTitle.textContent=reach.contains(fox.position)?'ASHWATER REACH · THE DROWNED ORCHARD':'RUSSETVALE · EMBER WELLSPRING';
    if (scene.fog instanceof THREE.FogExp2) scene.fog.density = THREE.MathUtils.damp(scene.fog.density, fog.density * (zone.includes('Reedmarsh') ? reedLook.fogScale : 1), 2, dt);

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
    // Permanent wavefronts only: the fox's own saturated aura must not keep ambience warm.
    let audioRestore = colorField.globalColor;
    for (const region of colorField.restores) {
      const distance = Math.hypot(fox.position.x - region.center.x, fox.position.z - region.center.z);
      audioRestore = Math.max(audioRestore, THREE.MathUtils.smoothstep(region.radius - distance, -3, 3));
    }
    audio.update(dt, speed > 1.2, grounded, gliding, audioRestore, surfaceOf(probe.collider?.tag), speed, dashing);
  }
  const feetPos = new THREE.Vector3();
  const heroNdc = new THREE.Vector3();
  let drawFrame = 0;
  if (quality.shadowEvery > 1) renderer.shadowMap.autoUpdate = false;

  /** Adaptive resolution: weak GPUs drop pixel ratio (down to quality.minScale) instead of frames. */
  const res = { scale: 1, ema: 16, t: 0, last: performance.now() };
  function adaptResolution() {
    const now = performance.now();
    const ms = now - res.last;
    res.last = now;
    if (quality.minScale >= 1 || ms > 1000) return; // tab was hidden
    res.ema += (ms - res.ema) * 0.05;
    res.t += ms / 1000;
    if (res.t < 2.5) return;
    let next = res.scale;
    // 30 fps policy: drop below ~28 fps, recover above ~45
    if (res.ema > 36) next = Math.max(quality.minScale, res.scale - 0.1);
    else if (res.ema < 22) next = Math.min(1, res.scale + 0.1);
    if (Math.abs(next - res.scale) < 1e-3) return;
    console.info(`[quality] resolution scale ${res.scale.toFixed(2)} → ${next.toFixed(2)} (frame ${res.ema.toFixed(1)} ms)`);
    res.scale = next;
    res.t = 0;
    const pr = Math.min(devicePixelRatio, quality.pixelRatio) * res.scale;
    renderer.setPixelRatio(pr);
    forge.setSize(innerWidth, innerHeight);
    post.composer.setPixelRatio(pr);
    post.setSize(innerWidth, innerHeight);
  }

  /** Visual-only work: particles, colour mask, shadows, photo override, post. */
  function draw() {
    const dt = Math.min(visualDt, 0.1);
    visualDt = 0;
    const fox = foxActor.group;
    if (quality.shadowEvery > 1) renderer.shadowMap.needsUpdate = drawFrame % quality.shadowEvery === 0;
    drawFrame++;
    colorField.renderMask(dt);
    for (const m of world.materials) colorField.syncMaterial(m);

    // Wisps / autumn
    autumnFX.update(dt, fox.position);
    emberMotes.update(dt, fox.position.clone().setY(fox.position.y + 0.3));
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
    // exposure stays put; the grade only follows once the front has left the summit
    post.params.restore = restore.floodAge >= 0 ? THREE.MathUtils.smootherstep(restore.floodAge, 1.2, 6) : 0;

    // keep film grain off the hero
    heroNdc.set(fox.position.x, fox.position.y - foxActor.feetOffset + foxActor.height * 0.45, fox.position.z).project(cam.camera);
    const heroR = THREE.MathUtils.clamp(0.9 / Math.max(0.5, cam.camera.position.distanceTo(fox.position)), 0.05, 0.4);
    post.setHeroScreen(heroNdc.x * 0.5 + 0.5, heroNdc.y * 0.5 + 0.5, heroNdc.z < 1 ? heroR : 0);

    const lit = world.seedwells.filter((q) => q.lit).length;
    hud.setStatus(
      shrineOn
        ? (reach.contains(fox.position) ? `ASHWATER REACH · ${reach.state().level.toUpperCase()}` : `AUTUMN RESTORED · ${elapsed.toFixed(1)}s`)
        : `${zone} · Seedwells ${lit}/3 · ${backend}`,
    );

    publishGame({
      title: 'Fox Spirit — Russetvale',
      status,
      score: lit * 250 + (shrineOn ? 1000 : 0),
      lives: shadeContact.wisps,
      shades: { ...shadeContact.state(), tun: { ...shades.tun }, actors: shades.state() },
      elapsedSec: Number(elapsed.toFixed(2)),
      deaths,
      backend,
      crown: crown.state(),
      reach: reach.state(),
      winCondition: 'Wake the valley: feed the Seedwells from its elements, then the Ember Wellspring',
      chem: { water: water.state(), growth: growth.state().roots, updraft: updrafts.state(), inlets: inlets.inlets.map((q) => ({ seedwell: world.seedwells[q.seedwell]!.id, seal: Number(q.seal.toFixed(3)), latched: q.latched })) },
      notes: [
        `zone=${zone}`,
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
          gait: foxActor.locomotion?.metrics.gait ?? 'none',
          plantError: foxActor.locomotion?.metrics.maxPlantError ?? 0,
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
      foxActor.setMotion?.({speed: turntableAnim==='run' ? 9 : turntableAnim==='walk' ? 1.4 : turntableAnim==='trot' ? 3.8 : 0,
        grounded: ['idle','run','walk','trot','skid','land'].includes(turntableAnim), yaw: turntableYaw, verticalSpeed: 0,
        groundAt: () => ty});
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
    adaptResolution();
    requestAnimationFrame(tick);
  }

  tick();
}

boot().catch((err) => {
  console.error(err);
  const s = document.getElementById('status');
  if (s) s.textContent = `Boot failed: ${String(err)}`;
});
