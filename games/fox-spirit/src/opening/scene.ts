/**
 * Russet Vale — opening slice (default boot `/`): wake in the sepia village of Lanternhollow,
 * carry the paint down the hub path into Arrival Meadow, light the cold hearth H-a and ride its heat
 * onto the rock shelf. Pressed Ink → Living Cel kit (lookdevKit.ts), hearth-fox B, chase camera.
 *
 * One OpeningCtx is shared by the slice modules; each builds meshes + colliders at build time and
 * registers its runtime with ctx.onUpdate. Player-dependent runtime reads ctx.player.
 */
import * as THREE from 'three';
import { createForgeRenderer, createColorField, createPostStack, applyLookdevLights, applyHeightFog, matchFogToSky, type ColorField } from '../../../../src/render';
import { buildSky, inkMaterial, paintU, RESTORE_SLOTS, rng } from '../lookdevKit';
import { buildContactShadow } from '../lookdevGround';
import { loadHearthFox, type HearthFox } from '../lookdevFox';
import { createPlay, PLAY, type Collider, type PlayController } from '../lookdevPlay';
import { ALL_PATHS, FINALE, groundH, KEEPING, pathDist, SPAWN } from './layout';
import { bakeLaneMap } from './lanePaint';
import { buildWorldEdge } from './worldEdge';
import { buildWorlds } from './worldsScene';
import { buildWarden } from './warden';
import { SEEDWELLS, WORLDS } from './worlds';
import { createWorldProgress } from '../worlds/progress';
import { createPageMap } from '../worlds/pageMap';
import { buildSeedwells } from '../worlds/seedwells';
import { bakeWorldBounds } from './worldBounds';
import { buildMeadow } from './meadow';
import { buildVillage } from './village';
import { createOpeningHearth } from './hearth';
import { createOpeningPaint } from './paint';
import { createOpeningOcclusion } from './occlusion';
import { createCrown } from './crown';
import { CARRY, createCarry } from './carry';
import { createKeepingChemistry } from './chemistry';
import { createKeeping } from './keeping';
import { buildUnpressed } from './unpressed';
import { buildGlyphs } from './glyphs';
import { createHearthHum } from './hum';
import { createOpeningAudio, MIX, type OpeningAudio } from './audio';
import { createFoxFoley } from './foley';
import { buildRunawayPage } from './page.hot';
import { buildDiscovery } from './discovery.hot';
import { buildHomecoming } from './homecoming';
import { createLaneWind } from './laneWind.hot';
import { buildLeafPiles } from './leafPiles';
import { buildCanopy } from './canopy';
import { buildPopUpRuin } from './popUpRuin';
import { buildMillbrook } from './millbrook';
import { buildDressing } from './dressing';
import { unfadedBlockers } from './blockers';
import { buildHermitage } from './hermitage';
import { createDryingLines } from './hermitage.hot';
import { createMillrace } from './millrace.hot';
import { buildKiln, buildWeir } from './millWeir';
import { createMillWeir } from './millWeir.hot';
import { MILLBROOK, WEST_PILES } from './millbrookLayout';
import { NORTH_PILES } from './hermitageLayout';
import { buildFinale } from './finale';
import { buildAshwater } from './ashwater';
import { buildPress } from './press';
import { laneBlocks } from './lanes';
import { createCaptions, type Captions } from './captions';
import { createTeach, type Teach } from './teach';

/** Fixed review cameras for art checks (harness: __gameHooks.shot(name, paint)) */
const SHOTS: Record<string, { pos: [number, number, number]; look: [number, number, number]; fov?: number }> = {
  hub: { pos: [-1.5, 4.2, 101], look: [-11, 1.2, 86] },
  cottage: { pos: [-13.2, 1.7, 98.8], look: [-18.4, 2.0, 92] },
  well: { pos: [-4.2, 1.5, 89.2], look: [-8, 1.1, 85] },
  lane: { pos: [-11.5, 1.4, 89.6], look: [-28, 1.8, 85.5] },
  meadow: { pos: [-4.5, 3.2, 91], look: [6, 1, 74] },
  gate: { pos: [-4.9, 1.3, 88.6], look: [-2.9, 1.5, 81] },
  aerial: { pos: [-4, 46, 122], look: [-4, 0, 82], fov: 45 },
  // the first Keeping: the arrested Hearthtree over the ridge, and the gorge it falls across
  hearthtree: { pos: [14, 15, 80], look: [27.5, 13, 70.5] },
  gorge: { pos: [38, 16, 71], look: [26, 11, 70] },
  // the finale: Press Hollow from the far crag's lip, and the Press close up with the Crown behind
  hollow: { pos: [27.5, 9.5, 57.5], look: [19.3, 1.5, 37] },
  press: { pos: [21.6, 3.1, 47.0], look: [19.3, 1.6, 37.0] },
  southlane: { pos: [4.6, 2.6, 71.5], look: [11.5, 0.4, 55] },
};

export interface OpeningCtx {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  rand: () => number;
  /** base terrain (layout.ts) */
  groundH: (x: number, z: number) => number;
  /** walk / block shapes for the controller */
  colliders: Collider[];
  /** meshes that fade while the follow camera reports a near blocker (piers, cottage corners) */
  cutout: THREE.Object3D[];
  /** big view blockers (cottages, well roof) for camera occlusion */
  occluders: THREE.Object3D[];
  field: ColorField;
  fox: HearthFox;
  /** set once the controller exists (after every build) */
  player: PlayController | null;
  onUpdate: (fn: (dt: number, t: number) => void) => void;
  /** the one sound graph (audio.ts): play samples, place voices in 3D, duck the music */
  audio: OpeningAudio;
  /** Album captions (captions.ts): `ctx.captions.say('≤ 6 words')` for a story beat */
  captions: Captions;
  /** the in-frame control hint (teach.ts): `ctx.teach.offer(text)` each frame a place wants to teach */
  teach: Teach;
}

export async function runOpening(): Promise<void> {
  document.getElementById('hud')?.remove();
  const forge = await createForgeRenderer({ container: document.body, exposure: 1.1, shadows: true, pixelRatio: 1 });
  const { renderer } = forge;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const lights = applyLookdevLights(scene);
  lights.key.intensity = 2.8;
  lights.key.shadow.mapSize.set(1024, 1024);
  lights.key.shadow.bias = -0.0008;
  lights.key.shadow.normalBias = 0.08;
  lights.hemi.intensity = 0.7;
  lights.rim.intensity = 1.3;
  lights.rim.color.set(0xffc690);
  const fog = applyHeightFog(scene, { density: 0.012, height: 1, heightFalloff: 0.06 });
  const sky = buildSky(scene, new THREE.Vector3(0.7, 0.32, 0.25));

  const updates: ((dt: number, t: number) => void)[] = [];
  const fox = await loadHearthFox((w) => inkMaterial(w));
  const ctx: OpeningCtx = {
    scene,
    renderer,
    rand: rng(11),
    groundH,
    colliders: [],
    cutout: [],
    occluders: [],
    field: createColorField({ bounds: { minX: -120, maxX: 50, minZ: 20, maxZ: 150 }, maskSize: 896 }),
    fox,
    player: null,
    onUpdate: (fn) => void updates.push(fn),
    audio: createOpeningAudio(),
    // bound just below: the caption line registers its fade through ctx.onUpdate
    captions: null as unknown as Captions,
    teach: null as unknown as Teach,
  };
  ctx.captions = createCaptions(ctx);
  ctx.teach = createTeach(ctx);
  const { field } = ctx;

  buildMeadow(ctx);
  buildVillage(ctx);
  // Millbrook + dressing draw from their own seed so every older builder keeps its exact layout (and
  // other teams' recorded input tapes keep replaying frame-for-frame)
  const westCtx: OpeningCtx = { ...ctx, rand: rng(4217) };
  // the controller is created after every build: read it through to the shared ctx
  Object.defineProperty(westCtx, 'player', { get: () => ctx.player });
  const millbrook = buildMillbrook(westCtx);
  const millrace = createMillrace(westCtx, millbrook.mill.wheel);
  buildHermitage(westCtx);
  const dryingLines = createDryingLines(westCtx);
  buildDressing(westCtx);
  const wayPiles = buildLeafPiles(westCtx, [...WEST_PILES, ...NORTH_PILES]);
  const kilnParts = buildKiln(westCtx);
  const weirParts = buildWeir(westCtx);
  const canopy = buildCanopy(ctx);
  const keeping = createKeeping(ctx);
  const popUpRuin = buildPopUpRuin(ctx);
  const unpressed = buildUnpressed(ctx);
  const glyphs = buildGlyphs(ctx, { onSolved: () => unpressed.unlock('kit') });
  const crown = createCrown(ctx, sky.mist);
  const runaway = buildRunawayPage(ctx);
  const homecoming = buildHomecoming(ctx, runaway, unpressed);
  const leafPiles = buildLeafPiles(ctx);
  const laneWind = createLaneWind(ctx);

  const contact = buildContactShadow();
  contact.position.set(0, 0.03, -0.15);
  fox.root.add(contact);
  scene.add(fox.root);

  const paint = createOpeningPaint({ field, renderer, uniforms: paintU, groundH });
  // the roads are underpainted and restores run down them (DESIGN-corridors.md)
  bakeLaneMap({ uniforms: paintU, paths: ALL_PATHS, pathDist, groundH });
  const occlusion = createOpeningOcclusion([...ctx.occluders, ...ctx.cutout]);
  {
    const unfaded = unfadedBlockers(ctx.colliders, [...ctx.occluders, ...ctx.cutout], groundH);
    if (unfaded.length) console.error(`unfaded blocker:\n${unfaded.join('\n')}`);
  }
  const hearth = createOpeningHearth({
    scene, groundH, fox: fox.root, teach: ctx.teach, supplyAt: (p) => field.sample(p),
    onIgnite: (at) => field.restore(at, 12, 1.8, { edgeMax: 1.4 }),
    extraSpots: [
      { id: 'steam', ...KEEPING.steam, height: 9, medium: 'steam', bedOffset: 0.03 },
      { id: 'root', ...KEEPING.root, height: 7, bedOffset: 0.03, quietMotes: true },
      { id: 'kiln', x: MILLBROOK.kiln.x, z: MILLBROOK.kiln.z, y: groundH(MILLBROOK.kiln.x, MILLBROOK.kiln.z), height: MILLBROOK.kiln.height, bedOffset: 0.03 },
    ],
  });
  // the controller exists only after every build; its callbacks reach the carry through this binding
  let carry: ReturnType<typeof createCarry> | null = null;
  // every builder has run: nothing that blocks may stand on a painted lane (lanes.ts)
  const blocked = laneBlocks(ctx.colliders, groundH);
  if (blocked.length) console.warn(`lane blocked:\n${blocked.join('\n')}`);
  // the fox may not leave the slice (worldBounds.ts): naive wander walked off the far lip and off the far crag
  const bounds = bakeWorldBounds();
  const player = createPlay({
    fox,
    groundH,
    colliders: ctx.colliders,
    inWorld: bounds.inWorld,
    start: SPAWN,
    onGroundContact: (at, speed, jumpHeld, dt) => canopy.contact(at, speed, jumpHeld, dt) ?? unpressed.contact(at, speed, jumpHeld, dt),
    updrafts: hearth.updrafts,
    onInteract: () => carry?.interact(),
    onDash: (lastGrounded) => {
      carry?.beforeDash(lastGrounded);
      millrace.onDash();
    },
    onFootfall: (at, hind) => foley.footfall(at, hind, (player.state() as { speed: number }).speed),
    onLand: (at, impact) => foley.land(at, impact),
  });
  const foley = createFoxFoley({ audio: ctx.audio, groundH });
  ctx.player = player;
  const discovery = buildDiscovery(ctx, runaway.voice(), canopy.guide, popUpRuin.guide);
  carry = createCarry({
    scene, fox: fox.root, teach: ctx.teach,
    source: new THREE.Vector3(KEEPING.coal.x, player.surfaceAt(KEEPING.coal.x, KEEPING.coal.z), KEEPING.coal.z),
    surfaceAt: player.surfaceAt,
    bowls: [...[KEEPING.steam, KEEPING.root].map(b => new THREE.Vector3(b.x, b.y, b.z)), new THREE.Vector3(FINALE.cradle.x, player.surfaceAt(FINALE.cradle.x, FINALE.cradle.z), FINALE.cradle.z)],
    // Hearthbound (earned with Russetvale's first level): the dash keeps the carried ember (progress is built below;
    // this runs only on a dash, after the scene is built)
    canDashCarry: () => progress.hasAbility('russetvale'),
  });
  const coal = carry;
  const chemistry = createKeepingChemistry({
    updrafts: hearth.updrafts, steamId: 'steam', rootId: 'root',
    coal: () => coal.heatSource(),
    onSteam: (at) => {
      ctx.audio.playOne('steam', 3, { at, gain: 0.25, rate: 0.8 });
      field.restore(at, 7, 1.6, { edgeMax: 1.2 });
      keeping.reconnectSteam();
    },
    onComplete: (at) => {
      field.restore(at, 14, 1.4, { edgeMax: 1.6 });
      keeping.release();
    },
  });
  const millWeir = createMillWeir(westCtx, { ...kilnParts, ...weirParts }, hearth.updrafts.hearths.find((h) => h.spot.id === 'kiln')!, millrace);
  const hum = createHearthHum({ audio: ctx.audio, hearths: hearth.updrafts.hearths, fox: fox.root, coal: () => coal.heatSource().position, page: runaway.voice });
  // the far Crown answers once the near tree has finished falling: attractor ladder resolves near → far
  // near → far: the settle swells the hum; the Crown answers when the fox steps out onto the far crag
  // and faces the vista gap (or after a while, so the response is never missed)
  let settledAt = -1;
  keeping.onSettled(() => {
    settledAt = time;
    hum.swell();
    ctx.captions.say('The tree finished falling, at last.');
  });
  // the Album's story in a few lines (DESIGN-finale.md captions): the runaway page is the first hint whose book it is
  let pageSaid = false;
  ctx.onUpdate(() => {
    if (pageSaid || !runaway.settled()) return;
    pageSaid = true;
    ctx.captions.say("A page escaped the Scribe's Album.");
  });
  // the finale (DESIGN-finale.md): warmth set in the Scribe's Press cradle once the Keeping has settled
  // world progress (Hazel's store, DESIGN-worlds.md) is the one truth for levels, abilities and the hub arches
  const progress = createWorldProgress(window.localStorage, new URLSearchParams(location.search).has('fresh'));
  // world II (Ashwater Reach, x ≈ +700, Cedar): its levels report physical completion to the store
  const ashwater = buildAshwater(ctx, { complete: (level) => progress.complete('ashwater', level), hasReedskim: () => progress.hasAbility('ashwater'), isRestored: (level) => progress.isRestored('ashwater', level) });
  // world III (the Scribe's Press, x ≈ −700, Thistle): its drafts join the updraft read the controller glides on
  const pressWorld = buildPress(ctx, { complete: (level) => progress.complete('press', level), hasInkstep: () => progress.hasAbility('press'), restored: (level) => progress.isRestored('press', level) });
  {
    const hearthLift = hearth.updrafts.liftAt;
    hearth.updrafts.liftAt = (x, feetY, z, out) => {
      const l = hearthLift(x, feetY, z, out);
      pressWorld.liftAt(x, feetY, z, l);
      return l;
    };
  }
  const finale = await buildFinale(ctx, {
    settled: () => settledAt >= 0,
    ember: coal,
    homeReady: homecoming.isPinned,
    canTeachOnward: () => discovery.finished,
    cam: player.cam,
    player,
    crownLetGo: crown.letGo,
  });
  // the hollow's far lip: a rail so the vista valley stays a view, not a walk off the world
  buildWorldEdge(ctx);
  ctx.onUpdate((_dt, t) => {
    if (settledAt < 0) return;
    const f = fox.root.position;
    if (Math.hypot(f.x - KEEPING.crag.x, f.z - KEEPING.crag.z) < 3.2 || t - settledAt > 25) crown.respond();
  });
  const view = player.cam.camera;
  // the other worlds (DESIGN-worlds.md). Progress (Hazel's store) is the one truth: Ashwater's arch opens when
  // Russetvale's first level (the page kept) is restored; the Press's once Ashwater has been entered.
  const worlds = buildWorlds(ctx, {
    hubOpen: (to) => (to === 'ashwater' ? progress.isRestored('russetvale', 'teach') : progress.isVisited('ashwater', 'teach')),
  });
  const pageMap = createPageMap(view, progress);
  worlds.attach(view);
  // the Ash Warden, always one step ahead (DESIGN-worlds.md story)
  const warden = buildWarden(ctx, progress);
  ctx.onUpdate((dt) => warden.update(dt));
  buildSeedwells(scene, progress, SEEDWELLS.map((w) => ({ ...w, y: groundH(w.x, w.z) })));
  // re-entry from a save: a restored first level rebuilds its world state (the page is home, the well lit), so the
  // open Ashwater arch never sits beside a page that is still running away
  if (progress.isRestored('russetvale', 'teach') && !homecoming.isPinned()) homecoming.force();
  // Russetvale's levels from their physical truth: page home → Keeping settled → the Press kindled
  let progressT = 0;
  const archSaid = { ashwater: false, press: false };
  ctx.onUpdate((dt) => {
    pageMap.step();
    progressT += dt;
    if (progressT < 0.5) return;
    progressT = 0;
    if (homecoming.isPinned()) progress.complete('russetvale', 'teach');
    if (settledAt >= 0) progress.complete('russetvale', 'develop');
    if ((finale.state() as { kindles: number }).kindles > 0) progress.complete('russetvale', 'combine');
    // tell the player when a hub arch opens (the arches stand north of the well, behind the wake spot)
    if (!archSaid.ashwater && progress.isRestored('russetvale', 'teach') && worlds.active === 'russetvale') {
      archSaid.ashwater = true;
      ctx.captions.say('An arch north of the well has lit · Ashwater Reach');
    }
    if (!archSaid.press && progress.isVisited('ashwater', 'teach') && worlds.active === 'russetvale') {
      archSaid.press = true;
      ctx.captions.say("The second arch has lit · the Scribe's Press");
    }
  });
  // the lens carries the in-frame lettering (captions, end card), so it joins the scene graph
  scene.add(view);
  ctx.captions.mount(view);
  ctx.teach.mount(view);
  const post = createPostStack(renderer, scene, view, { bloomStrength: 0.35, bloomThreshold: 0.9, vignette: 0.3, grain: 0.012, pixelRatio: 1 });

  let warnedSlots = false;
  function syncPaint(): void {
    // every permanent wash needs a shader slot; one past the budget would silently never show
    if (!warnedSlots && field.restores.length > RESTORE_SLOTS) {
      warnedSlots = true;
      console.error(`paint restore budget exceeded: ${field.restores.length} > RESTORE_SLOTS ${RESTORE_SLOTS}`);
    }
    paintU.uRestoreCount.value = Math.min(RESTORE_SLOTS, field.restores.length);
    field.restores.slice(0, RESTORE_SLOTS).forEach((r, i) => paintU.uRestore.value[i]!.set(r.center.x, r.center.z, r.radius, Math.max(0.3, Math.min(r.edgeMax, r.radius * 0.18))));
    // after a wash settles its colour keeps seeping outward for ~40 s (up to 0.8 of its radius, ≤ 16 m)
    for (let i = 0; i < paintU.uRestoreCount.value; i++) {
      const r = field.restores[i]!;
      paintU.uRestoreBleed.value[i] = Math.min(16, r.targetRadius * 0.8) * THREE.MathUtils.smoothstep(r.age, r.durationS * 0.5, r.durationS + 40);
    }
  }

  let time = 0;
  function frame(dt: number): void {
    time += dt;
    hearth.update(dt, time, player.state() as { dashing?: boolean });
    player.step(dt);
    {
      const fp = fox.root.position;
      const to = worlds.crossing(fp.x, fp.z);
      if (to) {
        const w = WORLDS[to];
        const at = to === 'russetvale' ? worlds.hubArrival(worlds.active) : w.spawn;
        player.teleport(at.x, at.z, at.yaw);
        worlds.resetCrossing();
        ctx.captions.say(w.name);
        progress.enterWorld(to === 'russetvale' ? 'hub' : to);
        if (to !== 'russetvale') progress.visit(to, 'teach');
      }
    }
    coal.update(dt, time, player.state() as { grounded: boolean; dashing?: boolean });
    chemistry.update(dt, time);
    hum.update();
    const ps = player.state() as { grounded: boolean; gliding: boolean; vel: number[]; speed: number; pos: number[] };
    foley.update(ps);
    ctx.audio.update(view, { restored: Math.min(1, field.restores.reduce((a, r) => a + r.radius * r.radius, 0) / 260), height: ps.pos[1]! - groundH(ps.pos[0]!, ps.pos[2]!), x: ps.pos[0]!, z: ps.pos[2]!, gliding: ps.gliding && !ps.grounded });
    // the key's shadow frustum rides with the fox
    const p = fox.root.position;
    lights.key.target.position.set(p.x, 0, p.z);
    lights.key.position.set(p.x + 14, 16, p.z + 6);
    lights.key.target.updateMatrixWorld();
    for (const fn of updates) fn(dt, time);
    paint.update(dt, p);
    scene.updateMatrixWorld(true);
    occlusion.update(dt, view, p);
    // world grade follows how much of the slice the fox has painted
    const k = Math.min(1, field.restores.reduce((a, r) => a + r.radius * r.radius, 0) / 260);
    sky.setPaint(k, new THREE.Vector2(0.8, -0.6));
    matchFogToSky(scene, fog, sky.mist);
    post.params.restore = k;
    lights.key.color.set(0xffe6c4).lerp(new THREE.Color(0xffd6b0), k);
    if (scene.fog instanceof THREE.FogExp2) scene.fog.density = fog.density;
    worlds.update(dt, p.x, view.position, sky, scene.fog instanceof THREE.FogExp2 ? scene.fog : null, lights.key);
    syncPaint();
    sky.update(dt);
  }
  function resize(): void {
    player.cam.resize(innerWidth, innerHeight);
    forge.setSize(innerWidth, innerHeight);
    post.setSize(innerWidth, innerHeight);
  }
  // mouse look: drag to swing the chase camera round the fox (it resumes auto-recentring after a pause)
  let dragging = false;
  addEventListener('pointerdown', (e) => {
    dragging = true;
    (e.target as Element | null)?.setPointerCapture?.(e.pointerId);
  });
  addEventListener('pointerup', () => void (dragging = false));
  addEventListener('pointercancel', () => void (dragging = false));
  addEventListener('pointermove', (e) => {
    if (dragging) player.cam.orbit(-e.movementX * 0.006, e.movementY * 0.003);
  });
  addEventListener('resize', resize);
  resize();

  let manual = new URLSearchParams(location.search).has('manual');
  let ready = false;
  const state = () => ({ ...player.state(), opening: { canopy: canopy.state(), hearth: hearth.state(), captions: ctx.captions.state(), teach: ctx.teach.state(), paint: paint.state(), visibility: occlusion.state(), restores: field.restores.length, carry: coal.state(), chemistry: chemistry.state(), crown: crown.state(), keeping: keeping.state(), unpressed: unpressed.state(), glyphs: glyphs.state(), hum: hum.state(), audio: { ...ctx.audio.state(), foley: foley.state() }, page: runaway.state(), discovery: discovery.state(), popUpRuin: popUpRuin.state(), homecoming: homecoming.state(), leafPiles: leafPiles.state(), laneWind: laneWind.state(), millrace: millrace.state(), millWeir: millWeir.state(), hermitage: dryingLines.state(), wayPiles: wayPiles.state(), finale: finale.state(), ashwater: ashwater.state(), press: pressWorld.state(), worlds: { active: worlds.active, travels: worlds.travels, progress: progress.snapshot(), mapOpen: pageMap.isOpen(), warden: warden.state() } } });
  const pxA = new THREE.Vector3();
  const pxB = new THREE.Vector3();
  // same harness surface as the game (main.ts __gameHooks): world-relative stick, keys, manual clock
  const gameHooks = {
    get ready() {
      return ready;
    },
    state,
    /** post-limiter mix (exactly what the speakers get) for capture tools: MediaRecorder / analyser */
    audioTap: () => ctx.audio.record.stream,
    /** the audio context (capture tools read sampleRate / currentTime / resume it) */
    audioContext: () => ctx.audio.ac,
    /** pre-master stems (music / ambience / sfx) and the mix gains, for capture tools */
    audioBuses: () => ({ ...ctx.audio.buses, master: MIX.master }),
    setStick: player.setStick,
    setKeys: player.setKeys,
    teleport: player.teleport,
    setManual(on: boolean) {
      manual = on;
      last = performance.now();
    },
    advance(frames = 1, dt = 1 / 60, render = true) {
      manual = true;
      for (let i = 0; i < frames; i++) frame(dt);
      if (render) post.render();
      return state();
    },
    shots: Object.keys(SHOTS),
    /** render one review still from a fixed camera; paint 'full' floods the slice for that frame only */
    shot(name: string, paint: 'none' | 'full' = 'none') {
      const s = SHOTS[name];
      if (!s) throw new Error(`unknown shot ${name}`);
      const saved = { pos: view.position.clone(), quat: view.quaternion.clone(), fov: view.fov };
      view.position.set(...s.pos);
      view.lookAt(...s.look);
      view.fov = s.fov ?? 50;
      view.updateProjectionMatrix();
      if (paint === 'full') {
        paintU.uRestoreCount.value = 1;
        paintU.uRestore.value[0]!.set(-4, 84, 200, 2.5);
        post.params.restore = 1;
        sky.setPaint(1, new THREE.Vector2(0.8, -0.6));
        matchFogToSky(scene, fog, sky.mist);
      }
      post.render();
      view.position.copy(saved.pos);
      view.quaternion.copy(saved.quat);
      view.fov = saved.fov;
      view.updateProjectionMatrix();
      frame(0);
    },
    /** dev: play the Crown's Keeping response (the Keeping latch calls this) */
    crownRespond: crown.respond,
    /** dev: play the Hearthtree settle without the root-hearth latch */
    keepingRelease: keeping.release,
    pageStage: runaway.toStage,
    /** dev: pop a pressed creature without the dash (hedgehog | heron | deer) */
    unpress: unpressed.unpress,
    /** dev: the homecoming as if the page were kept (pins it, sends the freed home) */
    homecoming: homecoming.force,
    /**
     * The fox's on-screen height (px, feet → ears 0.6 m) through the rendered lens; 0 when behind the lens.
     * One definition for every route tool's legibility gate (a speck = the camera lost her).
     */
    foxScreenPx() {
      const f = fox.root.position;
      pxA.copy(f).project(view);
      pxB.copy(f).setY(f.y + 0.6).project(view);
      return pxA.z > 1 || pxB.z > 1 ? 0 : (Math.abs(pxB.y - pxA.y) * renderer.domElement.clientHeight) / 2;
    },
    /** dev: stand at a world's arrival (capture tools; players walk through the hub arches) */
    travel(id: 'russetvale' | 'ashwater' | 'press') {
      const w = WORLDS[id];
      player.teleport(w.spawn.x, w.spawn.z, w.spawn.yaw);
      worlds.resetCrossing();
    },
    /** dev: burst Millbrook's leaf dam without the dash */
    millBurst: millrace.burst,
    /** dev: free the Hermitage's drying lines without running under them */
    hermitageFree: dryingLines.freeAll,
    /** dev: stand on Ashwater Reach's landing (world II) */
    ashwater: () => player.teleport(ashwater.spawn.x, ashwater.spawn.z, ashwater.spawn.yaw),
    /** dev: the finale as if the Keeping had settled and the ember sat in the Press cradle */
    finale: finale.force,
    /** dev: open the glyph shrine without solving it */
    glyphSolve: glyphs.solve,
    /** dev: unfold the steam stair without the steam latch */
    keepingSteam: keeping.reconnectSteam,
    canopy: canopy.feel,
    params: PLAY,
    carry: CARRY,
    camera: player.cam.params,
  };
  const w = window as unknown as Record<string, unknown>;
  w.__gameHooks = gameHooks;
  w.__game = { mode: 'opening', hooks: gameHooks, state };
  // read-only handles for art tooling (tools/opening-stills.mjs: free camera, paint the slice)
  w.__opening = { ctx, camera: view };

  let last = performance.now();
  const tick = () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!manual) {
      frame(dt);
      post.render();
    }
    ready = true;
    requestAnimationFrame(tick);
  };
  tick();
}
