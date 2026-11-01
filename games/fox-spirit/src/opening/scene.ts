/**
 * The Keeping — opening slice (default boot `/`): wake in the sepia village of Lanternhollow,
 * carry the paint down the hub path into Arrival Meadow, light the cold hearth H-a and ride its heat
 * onto the rock shelf. Pressed Ink → Living Cel kit (lookdevKit.ts), hearth-fox B, chase camera.
 *
 * One OpeningCtx is shared by the slice modules; each builds meshes + colliders at build time and
 * registers its runtime with ctx.onUpdate. Player-dependent runtime reads ctx.player.
 */
import * as THREE from 'three';
import { createForgeRenderer, createColorField, createPostStack, applyLookdevLights, applyHeightFog, matchFogToSky, type ColorField } from '../../../../src/render';
import { buildSky, inkMaterial, paintU, rng } from '../lookdevKit';
import { buildContactShadow } from '../lookdevGround';
import { loadHearthFox, type HearthFox } from '../lookdevFox';
import { createPlay, PLAY, type Collider, type PlayController } from '../lookdevPlay';
import { groundH, KEEPING, SPAWN } from './layout';
import { buildMeadow } from './meadow';
import { buildVillage } from './village';
import { createOpeningHearth } from './hearth';
import { createOpeningPaint } from './paint';
import { createOpeningOcclusion } from './occlusion';
import { createCrown } from './crown';
import { CARRY, createCarry } from './carry';
import { createKeepingChemistry } from './chemistry';
import { createKeeping } from './keeping';
import { createHearthHum } from './hum';

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
    field: createColorField({ bounds: { minX: -60, maxX: 50, minZ: 40, maxZ: 125 } }),
    fox,
    player: null,
    onUpdate: (fn) => void updates.push(fn),
  };
  const { field } = ctx;

  buildMeadow(ctx);
  buildVillage(ctx);
  const keeping = createKeeping(ctx);
  const crown = createCrown(ctx, sky.mist);

  const contact = buildContactShadow();
  contact.position.set(0, 0.03, -0.15);
  fox.root.add(contact);
  scene.add(fox.root);

  const paint = createOpeningPaint({ field, renderer, uniforms: paintU, groundH });
  const occlusion = createOpeningOcclusion([...ctx.occluders, ...ctx.cutout]);
  const hearth = createOpeningHearth({
    scene, groundH, fox: fox.root, supplyAt: (p) => field.sample(p),
    onIgnite: (at) => field.restore(at, 12, 1.8, { edgeMax: 1.4 }),
    extraSpots: [
      { id: 'steam', ...KEEPING.steam, height: 9, medium: 'steam', bedOffset: 0.03 },
      { id: 'root', ...KEEPING.root, height: 7, bedOffset: 0.03, quietMotes: true },
    ],
  });
  // the controller exists only after every build; its callbacks reach the carry through this binding
  let carry: ReturnType<typeof createCarry> | null = null;
  const player = createPlay({
    fox,
    groundH,
    colliders: ctx.colliders,
    start: SPAWN,
    updrafts: hearth.updrafts,
    onInteract: () => carry?.interact(),
    onDash: (lastGrounded) => carry?.beforeDash(lastGrounded),
  });
  ctx.player = player;
  carry = createCarry({
    scene, fox: fox.root,
    source: new THREE.Vector3(KEEPING.coal.x, player.surfaceAt(KEEPING.coal.x, KEEPING.coal.z), KEEPING.coal.z),
    surfaceAt: player.surfaceAt,
    bowls: [KEEPING.steam, KEEPING.root].map(b => new THREE.Vector3(b.x, b.y, b.z)),
  });
  const coal = carry;
  const chemistry = createKeepingChemistry({
    updrafts: hearth.updrafts, steamId: 'steam', rootId: 'root',
    coal: () => coal.heatSource(),
    onSteam: (at) => {
      field.restore(at, 7, 1.6, { edgeMax: 1.2 });
      keeping.reconnectSteam();
    },
    onComplete: (at) => {
      field.restore(at, 14, 1.4, { edgeMax: 1.6 });
      keeping.release();
    },
  });
  const hum = createHearthHum({ hearths: hearth.updrafts.hearths, fox: fox.root, coal: () => coal.heatSource().position });
  // the far Crown answers once the near tree has finished falling: attractor ladder resolves near → far
  // near → far: the settle swells the hum; the Crown answers when the fox steps out onto the far crag
  // and faces the vista gap (or after a while, so the response is never missed)
  let settledAt = -1;
  keeping.onSettled(() => {
    settledAt = time;
    hum.swell();
  });
  ctx.onUpdate((_dt, t) => {
    if (settledAt < 0) return;
    const f = fox.root.position;
    if (Math.hypot(f.x - KEEPING.crag.x, f.z - KEEPING.crag.z) < 3.2 || t - settledAt > 25) crown.respond();
  });
  const view = player.cam.camera;
  const post = createPostStack(renderer, scene, view, { bloomStrength: 0.35, bloomThreshold: 0.9, vignette: 0.3, grain: 0.012, pixelRatio: 1 });

  function syncPaint(): void {
    paintU.uRestoreCount.value = Math.min(4, field.restores.length);
    field.restores.slice(0, 4).forEach((r, i) => paintU.uRestore.value[i]!.set(r.center.x, r.center.z, r.radius, Math.max(0.3, Math.min(r.edgeMax, r.radius * 0.18))));
  }

  let time = 0;
  function frame(dt: number): void {
    time += dt;
    hearth.update(dt, time, player.state() as { dashing?: boolean });
    player.step(dt);
    coal.update(dt, time, player.state() as { grounded: boolean; dashing?: boolean });
    chemistry.update(dt, time);
    hum.update();
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
    syncPaint();
    sky.update(dt);
  }
  function resize(): void {
    player.cam.resize(innerWidth, innerHeight);
    forge.setSize(innerWidth, innerHeight);
    post.setSize(innerWidth, innerHeight);
  }
  addEventListener('resize', resize);
  resize();

  let manual = false;
  let ready = false;
  const state = () => ({ ...player.state(), opening: { hearth: hearth.state(), paint: paint.state(), visibility: occlusion.state(), restores: field.restores.length, carry: coal.state(), chemistry: chemistry.state(), crown: crown.state(), keeping: keeping.state(), hum: hum.state() } });
  // same harness surface as the game (main.ts __gameHooks): world-relative stick, keys, manual clock
  const gameHooks = {
    get ready() {
      return ready;
    },
    state,
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
    /** dev: unfold the steam stair without the steam latch */
    keepingSteam: keeping.reconnectSteam,
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
