import * as THREE from 'three';
import type GUI from 'lil-gui';
import { createColorField } from '../../../src/render';
import type { Realm } from './russetvale';
import { boxCollider, cylCollider } from './collision';
import { loadNatureKit } from './russetNature';
import { Bucket, PAL, rockSlab, stairFlight, ruinArch, hearthBrazier, kilnBowl, stoneBlock, trs, hangingRoot, rng } from './russetKit';
import { createInlets, heatFeeds } from './chem/inlet';
import type { createUpdrafts } from './chem/updraft';
import type { WindSystem } from './chem/wind';

/** A compact heat/wind round trip beyond the Wellspring. No changes to Russetvale's progression. */
export async function createListeningCrown(scene: THREE.Scene, world: Realm) {
  const group = new THREE.Group();
  group.name = 'listening-crown';
  scene.add(group);
  const stone = new Bucket(), rock = new Bucket(), roots = new Bucket();
  const col = world.collision;
  // This ruin is beyond the valley's flood. It owns a region field with the same
  // temporary fox sources, so returning after World 1 still leaves a real puzzle.
  const field = createColorField({ auraRadius: 3.4, trailLife: 3, trailRadius: 2.6, bounds: { minX: -65, maxX: -20, minZ: -135, maxZ: -100 }, maskSize: 128 });
  const materials: THREE.MeshStandardMaterial[] = [];
  const tun = { latchTime: 2, restoreRadius: 25 };
  const bowl = new THREE.Vector3(-45, 35, -112);
  const saveKey = 'fox-spirit:listening-crown:latched';
  let restored = false;
  try {
    if (new URLSearchParams(location.search).has('fresh')) localStorage.removeItem(saveKey);
    restored = localStorage.getItem(saveKey) === '1';
  } catch { /* play without persistence */ }

  // Broad, permanent shelves. No collision disappears when heat runs out.
  function shelf(x: number, z: number, y: number, w: number, d: number, seed: number) {
    rockSlab(rock, { x, z, top: y, bottom: y - 5.5, w, d, seed, rough: 0.4, topColor: PAL.stone, overhang: 0.7 });
    col.add(boxCollider({ x, z, w: w - 0.6, d: d - 0.6, top: y, bottom: y - 5.5, tag: 'crown-shelf' }));
  }
  shelf(-33, -96, 24, 18, 17, 810);
  shelf(-43, -108, 29, 14, 14, 811);
  shelf(-49, -119, 34, 13, 12, 812);
  // A catch under the upper flight, no more than 5 m below its departure.
  shelf(-38, -113, 24, 12, 12, 813);
  // Continuous 3.4 m stair descent, then side stairs as the safe return route.
  function stair(a: [number, number, number], b: [number, number, number], seed: number) {
    const [ax, ay, az] = a, [bx, by, bz] = b;
    const len = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bx - ax, bz - az);
    stairFlight(stone, { x: ax, y: ay, z: az }, { x: bx, y: by, z: bz }, 3.4, seed, { open: [true, true] });
    col.add(boxCollider({ x: (ax + bx) / 2, z: (az + bz) / 2, w: 3.4, d: len + 0.4, yaw, top: ay, top1: by, bottom: Math.min(ay, by) - 1, tag: 'crown-stair' }));
  }
  // The first landing clears every nested hill collider before descending.
  shelf(-19, -88, 38, 7, 5, 822);
  stair([-11, 38, -88], [-19, 38, -88], 820);
  stair([-22, 38, -88], [-39, 24, -96], 821);
  stair([-41, 24, -99], [-49, 29, -101.5], 823);
  stair([-49, 29, -109], [-57, 34, -113], 824);
  stair([-57, 34, -113], [-53, 34, -116], 825);
  // Split crown: open silhouette, bowl held over the upper hearth's rising leaves.
  ruinArch(stone, -48, 34, -121, 0.12, { span: 5.2, pillarH: 3.2, broken: 0.35, seed: 830 });
  ruinArch(stone, -51, 34, -117, 1.4, { span: 3.8, pillarH: 2.3, broken: 0.6, seed: 831 });
  kilnBowl(stone, -49, 29, -112, bowl.x, bowl.y, bowl.z, 832);
  // Non-blocking masonry sill points toward home.
  for (let i = 0; i < 5; i++) stoneBlock(stone, trs(-50 + i, 34.08, -123.4, i * 0.15), 0.8, 0.15, 0.7, 840 + i, 0.08);
  const rr = rng(850);
  for (let i = 0; i < 9; i++) hangingRoot(roots, rr, -54 + rr() * 11, 33.8, -124 + rr() * 1.5, 3 + rr() * 4, new THREE.Vector2(0.2, 1));

  const hearths = [
    { id: 'crown-low', x: -37, y: 24, z: -101, height: 10 },
    { id: 'crown-high', x: -45, y: 29, z: -112, height: 15 },
  ];
  for (const h of hearths) hearthBrazier(stone, h.x, h.y, h.z, 860 + hearths.indexOf(h));
  world.hearthSpots.push(...hearths);
  world.windSpots.push({ id: 'crown-home', source: [-49, 34.7, -119], radius: 3.4,
    path: [[-46, 41, -114], [-33, 41, -107], [-23, 40.5, -97], [-19, 40, -88]] });
  world.shadeSpots.push({ id: 'crown-shade', speed: 1.5,
    patrol: [[-47, 29, -107], [-42, 29, -107], [-42, 29, -111], [-47, 29, -111]] });
  // Reuse the realm's textured PBR materials and mask patching.
  for (const [bucket, name] of [[rock, 'rv-rock'], [stone, 'rv-stone'], [roots, 'rv-bark']] as const) {
    const material = world.materials.find(m => m.name === name)!.clone();
    material.userData.cfRestoredChroma = name === 'rv-stone' ? 0.5 : 0.75;
    field.patchMaterial(material);
    materials.push(material);
    const mesh = bucket.toMesh(material, { cast: true, receive: true, boxUV: name === 'rv-rock' ? 4 : 1.6 });
    if (mesh) group.add(mesh);
  }
  // A lone bent maple gives the crown a recognizable silhouette from the summit.
  const nature = await loadNatureKit();
  nature.place('twisted_2', -53, 34, -121, { scale: 0.34, yaw: 1.9, gaps: 0.38, hue: PAL.russet, hue2: PAL.gold,
    avoid: [{ x: -49, y: 36, z: -118, r: 2.6 }] });
  col.add(cylCollider({ x: -53, z: -121, r: 0.45, top: 39, bottom: 33.5, tag: 'crown-maple' }));
  for (const m of nature.build(group)) { field.patchMaterial(m); materials.push(m); }
  // Quiet seat on the back shoulder: a place to find, with the return flight visible below.
  const seat = new Bucket();
  stoneBlock(seat, trs(-50, 34.5, -122.8, 0.15), 2.5, 0.25, 0.8, 870, 0.08);
  stoneBlock(seat, trs(-50.8, 34.2, -122.8), 0.3, 0.5, 0.55, 871, 0.06);
  stoneBlock(seat, trs(-49.2, 34.2, -122.8), 0.3, 0.5, 0.55, 872, 0.06);
  const seatMesh = seat.toMesh(materials[1]!, { cast: true, receive: true, boxUV: 1.6 });
  if (seatMesh) group.add(seatMesh);
  world.bounds.minZ = -135;
  let inlet: ReturnType<typeof createInlets> | null = null;
  let updrafts: ReturnType<typeof createUpdrafts>;
  let wind: WindSystem;
  function applyRestore(duration = 3.2) {
    for (const h of updrafts.hearths) if (h.spot.id.startsWith('crown-')) h.reactor.restored = true;
    for (const c of wind.currents) if (c.spot.id === 'crown-home') c.reactor.restored = true;
    if (inlet) { inlet.inlets[0]!.latched = true; inlet.inlets[0]!.seal = 1; }
    if (!field.restores.length) field.restore(bowl, 30, duration);
  }
  return {
    bowl,
    contains(p: THREE.Vector3) { return p.x < -25 && p.z < -99; },
    supplyAt(p: THREE.Vector3) { return field.sample(p); },
    init(renderer: THREE.WebGLRenderer) { field.initMask(renderer); },
    sync(dt: number, source: ReturnType<typeof createColorField>) {
      // Only this region's permanent wavefront ages here; source lifetimes stay owned by the main field.
      field.trail = []; field.strokes = []; field.update(dt);
      field.setFox(source.fox);
      field.trail = source.trail.map(t => ({ ...t }));
      field.strokes = source.strokes.map(t => ({ ...t }));
      field.renderMask(dt);
      for (const m of materials) field.syncMaterial(m);
    },
    attach(u: typeof updrafts, w: WindSystem, gui: GUI) {
      updrafts = u; wind = w;
      inlet = createInlets(scene, [{ seedwell: 0, source: 'crown-high', pos: bowl,
        sealAt: bowl.clone().add(new THREE.Vector3(0, 0.1, 0)), pillar: new THREE.Vector3(-49, 29, -112), latchTime: tun.latchTime }], u.hearths[0]!.ash);
      const folder = gui.addFolder('Listening Crown');
      folder.add(tun, 'latchTime', 0.5, 5, 0.1).onChange((v: number) => { inlet!.inlets[0]!.latchTime = v; });
      folder.close();
      if (restored) applyRestore(0.05);
    },
    update(dt: number, onRestore: (center: THREE.Vector3, radius: number) => void) {
      if (!inlet) return;
      const latched = inlet.update(dt, q => {
        const h = updrafts.hearths.find(h => h.spot.id === q.source);
        return !!h && heatFeeds(h, q.pos, updrafts.tun.radius);
      });
      if (!restored && latched.length) {
        restored = true; applyRestore(); onRestore(bowl, tun.restoreRadius);
        try { localStorage.setItem(saveKey, '1'); } catch { /* play without persistence */ }
      }
    },
    state() {
      const q = inlet?.inlets[0];
      return { restored, seal: q?.seal ?? 0, fed: q?.fed ?? false, bowl: bowl.toArray(), hearths: hearths.map(h => h.id), returnWind: 'crown-home' };
    },
  };
}
