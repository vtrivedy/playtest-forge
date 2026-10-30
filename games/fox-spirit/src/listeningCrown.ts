import * as THREE from 'three';
import type GUI from 'lil-gui';
import type { Realm } from './russetvale';
import { boxCollider } from './collision';
import { Bucket, PAL, rockSlab, stairFlight, ruinArch, hearthBrazier, kilnBowl, stoneBlock, trs, hangingRoot, rng } from './russetKit';
import { createInlets, heatFeeds } from './chem/inlet';
import type { createUpdrafts } from './chem/updraft';
import type { WindSystem } from './chem/wind';

/** A compact heat/wind round trip beyond the Wellspring. No changes to Russetvale's progression. */
export function createListeningCrown(scene: THREE.Scene, world: Realm) {
  const group = new THREE.Group();
  group.name = 'listening-crown';
  scene.add(group);
  const stone = new Bucket(), rock = new Bucket(), roots = new Bucket();
  const col = world.collision;
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
  stair([-10, 38, -87], [-21, 31, -90], 820);
  stair([-21, 31, -90], [-32, 24, -94], 821);
  shelf(-21, -90, 31, 5, 5, 822);
  stair([-39, 24, -99], [-49, 29, -104], 823);
  stair([-49, 29, -110], [-54, 34, -118], 824);
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
    path: [[-46, 41, -114], [-33, 41, -107], [-19, 40.5, -97], [-8, 40, -88]] });
  world.shadeSpots.push({ id: 'crown-shade', speed: 1.5,
    patrol: [[-47, 29, -107], [-42, 29, -107], [-42, 29, -111], [-47, 29, -111]] });
  // Reuse the realm's textured PBR materials and mask patching.
  for (const [bucket, name] of [[rock, 'rv-rock'], [stone, 'rv-stone'], [roots, 'rv-bark']] as const) {
    const material = world.materials.find(m => m.name === name)!;
    const mesh = bucket.toMesh(material, { cast: true, receive: true, boxUV: name === 'rv-rock' ? 4 : 1.6 });
    if (mesh) group.add(mesh);
  }
  world.bounds.minZ = -135;
  let inlet: ReturnType<typeof createInlets> | null = null;
  let updrafts: ReturnType<typeof createUpdrafts>;
  let wind: WindSystem;
  function applyRestore() {
    for (const h of updrafts.hearths) if (h.spot.id.startsWith('crown-')) h.reactor.restored = true;
    for (const c of wind.currents) if (c.spot.id === 'crown-home') c.reactor.restored = true;
    if (inlet) inlet.inlets[0]!.latched = true;
  }
  return {
    bowl,
    attach(u: typeof updrafts, w: WindSystem, gui: GUI) {
      updrafts = u; wind = w;
      inlet = createInlets(scene, [{ seedwell: 0, source: 'crown-high', pos: bowl,
        sealAt: bowl.clone().add(new THREE.Vector3(0, 0.1, 0)), pillar: new THREE.Vector3(-49, 29, -112), latchTime: tun.latchTime }], u.hearths[0]!.ash);
      const folder = gui.addFolder('Listening Crown');
      folder.add(tun, 'latchTime', 0.5, 5, 0.1).onChange((v: number) => { inlet!.inlets[0]!.latchTime = v; });
      folder.close();
      if (restored) applyRestore();
    },
    update(dt: number, onRestore: (center: THREE.Vector3, radius: number) => void) {
      if (!inlet || restored) return;
      const latched = inlet.update(dt, q => {
        const h = updrafts.hearths.find(h => h.spot.id === q.source);
        return !!h && heatFeeds(h, q.pos, updrafts.tun.radius);
      });
      if (latched.length) {
        restored = true; applyRestore(); onRestore(bowl, tun.restoreRadius);
        try { localStorage.setItem(saveKey, '1'); } catch { /* play without persistence */ }
      }
    },
    restoreSaved(onRestore: (center: THREE.Vector3, radius: number) => void) {
      if (restored) onRestore(bowl, tun.restoreRadius);
    },
    state() {
      const q = inlet?.inlets[0];
      return { restored, seal: q?.seal ?? 0, fed: q?.fed ?? false, bowl: bowl.toArray(), hearths: hearths.map(h => h.id), returnWind: 'crown-home' };
    },
  };
}
