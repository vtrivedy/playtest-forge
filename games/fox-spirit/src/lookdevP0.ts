/**
 * Redesign Phase 0 lookdev — "Pressed Ink → Living Cel".
 *
 * Self-contained Russetvale slice booted by `?lookdev=p0` (main.ts never boots the game then).
 * Unpainted world = warm sepia paper + ink; painted = soft 3-band cel autumn. The boundary is the
 * ColorField restore wavefront (same restore() / update() clock the game uses), drawn here with a
 * ragged watercolour edge + tide-line on MeshToonMaterial. The fox is the authored hearth-fox GLB
 * (lookdevFox.ts) and is never graded (it carries the colour). Ink = inverted hulls.
 *
 * window.__lookdevHooks: setPaint('none'|'half'|'full'), setCamera(Shot), setFoxClip(clip, travel), advance(frames, dt), ready.
 * `&play=1`: the fox is playable under a chase camera (lookdevPlay.ts); window.__gameHooks drives it.
 */
import * as THREE from 'three';
import { buildGround, buildGrass, buildLeaves, buildContactShadow } from './lookdevGround';
import {
  INK,
  rng,
  paintU,
  toon,
  inkMaterial,
  buildMaple,
  buildRock,
  buildArch,
  buildRuinStub,
  mapleLeafGeometry,
  buildDistance,
  buildSky,
  type TreeKind,
} from './lookdevKit';
import {
  createForgeRenderer,
  createColorField,
  createPostStack,
  applyLookdevLights,
  applyHeightFog,
  matchFogToSky,
} from '../../../src/render';
import { loadHearthFox, type FoxClip } from './lookdevFox';
import { createPlay, PLAY, type Collider } from './lookdevPlay';

type PaintMode = 'none' | 'half' | 'full';
type Shot = 'wide' | 'fox' | 'hero' | 'foxProfile' | 'foxQuarter' | 'foxWalk';

const FOX_HOME = new THREE.Vector3(0.6, 0, 3.2);


// ---------------------------------------------------------------------------------------------
// Scenery
// ---------------------------------------------------------------------------------------------

const PATH = new THREE.CatmullRomCurve3([
  new THREE.Vector3(3, 0, 30),
  new THREE.Vector3(1.5, 0, 14),
  new THREE.Vector3(0.4, 0, 4),
  new THREE.Vector3(-0.6, 0, -4),
  new THREE.Vector3(0, 0, -9),
]);
const PATH_PTS = PATH.getSpacedPoints(80);
function pathDist(x: number, z: number): number {
  let best = 1e9;
  for (const p of PATH_PTS) best = Math.min(best, Math.hypot(x - p.x, z - p.z));
  return best;
}
function groundH(x: number, z: number): number {
  const r = Math.hypot(x, z + 4);
  const hills = Math.sin(x * 0.11) * Math.cos(z * 0.09) * 0.9 + Math.sin(x * 0.31 + z * 0.17) * 0.25;
  const bowl = THREE.MathUtils.smoothstep(r, 16, 60) * 7;
  const flat = THREE.MathUtils.smoothstep(pathDist(x, z), 1.5, 6);
  return (hills * flat + bowl) * (z < -12 ? 1 + (-12 - z) * 0.03 : 1);
}


// ---------------------------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------------------------

/** Camera pose + fox yaw / head turn per shot (fox stands at FOX_HOME + foxAt) */
const SHOTS: Record<Shot, { pos: [number, number, number]; look: [number, number, number]; fov: number; foxYaw: number; headYaw: number; foxAt?: [number, number] }> = {
  wide: { pos: [9.5, 5.2, 17], look: [-1.2, 1.6, -4], fov: 50, foxYaw: Math.PI - 0.35, headYaw: 0.2 },
  fox: { pos: [2.75, 0.62, 3.75], look: [0.5, 0.52, 2.95], fov: 40, foxYaw: 0.25, headYaw: 0.45 },
  hero: { pos: [-1.6, 0.8, 7.2], look: [0.6, 1.7, -6], fov: 46, foxYaw: 0.55, headYaw: 0.3 },
  // hearth-fox review shots: true profile, 3/4 front, static profile the walk crosses
  foxProfile: { pos: [0.3, 0.5, 5.35], look: [0.28, 0.42, 3.2], fov: 40, foxYaw: Math.PI / 2, headYaw: 0 },
  foxQuarter: { pos: [1.95, 0.72, 4.55], look: [0.5, 0.45, 3.05], fov: 38, foxYaw: 0.95, headYaw: 0.25 },
  foxWalk: { pos: [0.6, 0.6, 6.3], look: [0.6, 0.4, 3.2], fov: 44, foxYaw: Math.PI / 2, headYaw: 0, foxAt: [-1.2, 0] },
};

export async function runLookdevP0(): Promise<void> {
  document.getElementById('hud')?.remove();
  const forge = await createForgeRenderer({ container: document.body, exposure: 1.1, shadows: true, pixelRatio: 1 });
  const { renderer } = forge;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 400);
  const lights = applyLookdevLights(scene);
  lights.key.position.set(14, 16, 6);
  lights.key.intensity = 2.8;
  lights.key.shadow.mapSize.set(1024, 1024);
  // chunky low-poly clumps acne under the default bias
  lights.key.shadow.bias = -0.0008;
  lights.key.shadow.normalBias = 0.08;
  // less flat fill → firmer cel bands; stronger warm back-rim separates every silhouette (fox included) from the ground
  lights.hemi.intensity = 0.7;
  lights.rim.intensity = 1.3;
  lights.rim.color.set(0xffc690);
  const fog = applyHeightFog(scene, { density: 0.012, height: 1, heightFalloff: 0.06 });
  const sky = buildSky(scene, new THREE.Vector3(0.7, 0.32, 0.25));

  const rand = rng(7);
  const groundContext = { groundH, pathDist, toon, mapleLeafGeometry };
  const ground = buildGround(scene, groundContext);
  ground.updateMatrixWorld(true);
  const contactRay = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
  const surfaceHeight = (x: number, z: number): number => {
    contactRay.ray.origin.set(x, 100, z);
    return contactRay.intersectObject(ground, false)[0]!.point.y;
  };
  buildDistance(scene, rand);
  buildGrass(scene, rand, groundContext);
  buildLeaves(scene, rand, groundContext);

  const ARCH = new THREE.Vector3(-0.3, 0, -8);
  const arch = buildArch(rand, groundH(ARCH.x, ARCH.z));
  arch.position.set(ARCH.x, groundH(ARCH.x, ARCH.z) - 0.15, ARCH.z);
  arch.rotation.y = 0.12;
  scene.add(arch);
  const stub = buildRuinStub(rand);
  stub.position.set(-4.4, groundH(-4.4, -6.2) - 0.1, -6.2);
  stub.rotation.y = 0.5;
  scene.add(stub);

  // irregular grove: a hero maple framing the arch, a leaning pair, loners and low shrubs — no grid
  const trees: Array<[number, number, number, TreeKind, number]> = [
    [-2.5, -6.5, 1.1, 'lean', 2],
    [7.2, -6.6, 1.3, 'hero', 0],
    [-4.9, -10.2, 1.15, 'grove', 2],
    [-6.9, -7.4, 0.9, 'grove', 1],
    [-6.2, -1.2, 1.05, 'grove', 3],
    [8.2, 0.8, 0.95, 'grove', 2],
    [2.2, -16.5, 1.4, 'grove', 1],
    [-9.5, -15, 1.3, 'grove', 0],
    [11.5, -10.5, 1.2, 'hero', 3],
    [-13.5, -3.5, 1.35, 'grove', 2],
    [-8.2, 6.4, 0.85, 'grove', 1],
  ];
  for (const [x, z, sc, kind, pal] of trees) {
    const y = groundH(x, z);
    const t = buildMaple(rand, sc, kind, pal, y);
    t.position.set(x, y - 0.1, z);
    const spin = rand() * 6;
    // the bent maple grows from the arch's left foot and leans out over the fallen pier, framing (not hiding) the arch
    t.rotation.y = kind === 'lean' ? -2.95 : spin;
    scene.add(t);
  }
  const play = new URLSearchParams(location.search).has('play');
  const colliders: Collider[] = [];
  const archBase = groundH(ARCH.x, ARCH.z) - 0.15;
  const archBox = (lx: number, hx: number, hz: number, top: number) => {
    const c = Math.cos(0.12);
    const s = Math.sin(0.12);
    colliders.push({ kind: 'box', x: ARCH.x + lx * c, z: ARCH.z - lx * s, yaw: 0.12, hx, hz, top: archBase + top });
  };
  archBox(0, 2.9, 1.3, 0.25);
  archBox(0, 2.45, 1.0, 0.55);
  // piers: half-extents cover the cap (1.25 × 1.1) plus course jitter
  for (const sx of [-1, 1]) archBox(sx * 1.75, 0.72, 0.66, 4);
  const stubBase = groundH(-4.4, -6.2) - 0.1;
  colliders.push({ kind: 'box', x: -4.4, z: -6.2, yaw: 0.5, hx: 0.5, hz: 0.48, top: stubBase + 1.14 });
  colliders.push({ kind: 'box', x: -4.4 + 0.9 * Math.cos(0.5) + 0.6 * Math.sin(0.5), z: -6.2 - 0.9 * Math.sin(0.5) + 0.6 * Math.cos(0.5), yaw: 1.1, hx: 0.5, hz: 0.45, top: stubBase + 0.5 });
  for (const [x, z, sc, kind] of trees) colliders.push({ kind: 'post', x, z, r: (kind === 'hero' ? 0.42 : kind === 'lean' ? 0.38 : 0.3) * sc * 1.5 });
  const rocks: Array<[number, number, number]> = [
    [-2.2, 1.2, 0.55],
    [2.6, -2.5, 0.9],
    [-1.8, -7.2, 0.55],
    [1.9, -7.6, 0.45],
    [3.6, 6.5, 0.5],
    [-4.2, 9, 1.1],
    [6.5, -2, 0.6],
  ];
  for (const [x, z, s] of rocks) {
    const r = buildRock(rand, s);
    r.position.set(x, groundH(x, z) + s * 0.25, z);
    scene.add(r);
    colliders.push({ kind: 'cap', x, z, r: s * 1.1, base: groundH(x, z), h: s * 0.95 });
    r.updateMatrixWorld(true);
    const vertices = r.geometry.getAttribute('position');
    const indices = r.geometry.index;
    const contacts: THREE.Vector3[] = [];
    for (let i = 0; i < (indices?.count ?? vertices.count); i += 3) {
      const triangle = [0, 1, 2].map((j) => new THREE.Vector3()
        .fromBufferAttribute(vertices, indices ? indices.getX(i + j) : i + j).applyMatrix4(r.matrixWorld));
      const heights = triangle.map((v) => v.y - surfaceHeight(v.x, v.z));
      const crossings: THREE.Vector3[] = [];
      for (let j = 0; j < 3; j++) {
        const k = (j + 1) % 3;
        if (heights[j]! * heights[k]! >= 0) continue;
        let lo = 0;
        let hi = 1;
        const point = new THREE.Vector3();
        for (let step = 0; step < 12; step++) {
          const t = (lo + hi) / 2;
          point.copy(triangle[j]!).lerp(triangle[k]!, t);
          if ((point.y - surfaceHeight(point.x, point.z)) * heights[j]! > 0) lo = t;
          else hi = t;
        }
        point.y = surfaceHeight(point.x, point.z) + 0.025;
        crossings.push(point);
      }
      if (crossings.length === 2) contacts.push(...crossings);
    }
    scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(contacts), new THREE.LineBasicMaterial({ color: INK })));
  }

  const fox = await loadHearthFox((w) => inkMaterial(w));
  fox.root.position.set(FOX_HOME.x, groundH(FOX_HOME.x, FOX_HOME.z), FOX_HOME.z);
  const contact = buildContactShadow();
  contact.position.set(0, 0.03, -0.15);
  fox.root.add(contact);
  fox.root.rotation.y = 0.55;
  scene.add(fox.root);
  // play: the fox carries the paint — each jump's landing blooms a ragged restore wavefront (4 shader slots)
  const player = play
    ? createPlay({
        fox,
        groundH,
        colliders,
        start: { x: FOX_HOME.x, z: FOX_HOME.z + 4, yaw: Math.PI },
        // pier courses, caps and bands (local x ≈ ±SPAN, below the springing line)
        cutout: arch.children.filter((c) => Math.abs(Math.abs(c.position.x) - 1.75) < 0.5 && c.position.y > 0.5 && c.position.y < 4.2),
        onLand(at, impact) {
          if (field.restores.length >= 4) return;
          field.restore(at, 4.5 + 3 * impact + 2 * field.restores.length, 1.8, { edgeMax: 1.4 });
        },
      })
    : null;
  const view = player?.cam.camera ?? camera;

  // restore wavefronts come from the game's ColorField clock
  const field = createColorField({ bounds: { minX: -90, maxX: 90, minZ: -90, maxZ: 90 } });
  let paintMode: PaintMode = 'none';
  const post = createPostStack(renderer, scene, view, { bloomStrength: 0.35, bloomThreshold: 0.9, vignette: 0.3, grain: 0.012, pixelRatio: 1 });

  function setPaint(mode: PaintMode): void {
    paintMode = mode;
    field.restores.length = 0;
    if (mode === 'half') {
      // front sweeps diagonally through the middle of the wide shot; fox stands on the painted side
      field.restore(new THREE.Vector3(14, 0, 8), 14.5, 0.01, { edgeMax: 1.1 });
    } else if (mode === 'full') {
      field.restore(new THREE.Vector3(0, 0, -2), 70, 0.01, { edgeMax: 2.5 });
    }
    field.update(1);
    const k = mode === 'none' ? 0 : mode === 'half' ? 0.45 : 1;
    // half: the sky paints from the side the restore is sweeping in from (frame right)
    sky.setPaint(k, new THREE.Vector2(0.8, -0.6));
    matchFogToSky(scene, fog, sky.mist);
    post.params.restore = k;
    lights.key.color.set(0xffe6c4).lerp(new THREE.Color(0xffd6b0), k);
  }
  function syncPaint(): void {
    paintU.uRestoreCount.value = Math.min(4, field.restores.length);
    field.restores.slice(0, 4).forEach((r, i) => paintU.uRestore.value[i]!.set(r.center.x, r.center.z, r.radius, Math.max(0.3, Math.min(r.edgeMax, r.radius * 0.18))));
  }
  function setCamera(shot: Shot): void {
    const s = SHOTS[shot];
    camera.position.set(...s.pos);
    camera.lookAt(...s.look);
    camera.fov = s.fov;
    camera.updateProjectionMatrix();
    const [ax, az] = s.foxAt ?? [0, 0];
    fox.root.position.set(FOX_HOME.x + ax, groundH(FOX_HOME.x + ax, FOX_HOME.z + az), FOX_HOME.z + az);
    fox.root.rotation.y = s.foxYaw;
    fox.setHeadYaw(s.headYaw);
    lights.key.target.position.set(s.look[0], 0, s.look[2]);
    lights.key.position.set(s.look[0] + 14, 16, s.look[2] + 6);
    lights.key.target.updateMatrixWorld();
  }

  let time = 0;
  function frame(dt: number): void {
    time += dt;
    if (player) {
      player.step(dt);
      // the key's shadow frustum rides with the fox
      const p = fox.root.position;
      lights.key.target.position.set(p.x, 0, p.z);
      lights.key.position.set(p.x + 14, 16, p.z + 6);
      lights.key.target.updateMatrixWorld();
    } else {
      fox.update(dt);
      if (fox.speed > 0) fox.root.position.y = groundH(fox.root.position.x, fox.root.position.z);
    }
    field.update(dt);
    if (player && paintMode === 'none') {
      // world grade follows how much of the clearing the fox has painted
      const k = Math.min(1, field.restores.reduce((a, r) => a + r.radius * r.radius, 0) / 260);
      sky.setPaint(k, new THREE.Vector2(0.8, -0.6));
      matchFogToSky(scene, fog, sky.mist);
      post.params.restore = k;
      lights.key.color.set(0xffe6c4).lerp(new THREE.Color(0xffd6b0), k);
    }
    syncPaint();
    sky.update(dt);
  }
  function resize(): void {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    player?.cam.resize(innerWidth, innerHeight);
    forge.setSize(innerWidth, innerHeight);
    post.setSize(innerWidth, innerHeight);
  }
  addEventListener('resize', resize);

  setPaint(player ? 'none' : 'half');
  if (!player) setCamera('wide');
  resize();
  let manual = false;
  const hooks = {
    ready: false,
    get paint() {
      return paintMode;
    },
    setPaint,
    setCamera,
    setFoxClip(clip: FoxClip, travel = false) {
      fox.play(clip, travel);
    },
    get fox() {
      return { clip: fox.clip, speed: fox.speed, x: fox.root.position.x, z: fox.root.position.z, paws: fox.paws() };
    },
    advance(frames = 1, dt = 1 / 60) {
      manual = true;
      for (let i = 0; i < frames; i++) frame(dt);
      post.render();
      return time;
    },
  };
  (window as unknown as { __lookdevHooks: typeof hooks }).__lookdevHooks = hooks;
  if (player) {
    // same harness surface as the game (main.ts __gameHooks): world-relative stick, keys, manual clock
    const gameHooks = {
      get ready() {
        return hooks.ready;
      },
      state: player.state,
      setStick: player.setStick,
      setKeys: player.setKeys,
      teleport: player.teleport,
      setPaint,
      setManual(on: boolean) {
        manual = on;
        last = performance.now();
      },
      advance(frames = 1, dt = 1 / 60, render = true) {
        manual = true;
        for (let i = 0; i < frames; i++) frame(dt);
        if (render) post.render();
        return player.state();
      },
      params: PLAY,
      camera: player.cam.params,
    };
    (window as unknown as { __gameHooks: typeof gameHooks }).__gameHooks = gameHooks;
  }
  // for tooling that waits on the game handle
  (window as unknown as { __game: object }).__game = { mode: player ? 'lookdev-play' : 'lookdev-p0', hooks };

  let last = performance.now();
  const tick = () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!manual) {
      frame(dt);
      post.render();
    }
    hooks.ready = true;
    requestAnimationFrame(tick);
  };
  tick();
}
