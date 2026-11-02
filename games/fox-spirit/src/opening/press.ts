/**
 * The Scribe's Press (DESIGN-worlds.md, tla/Press.tla): world III, winter ink at x = −700. Three levels in one
 * north → south run, each a physical gate the fox opens with what it has:
 *   White Margin (teach):      carry a brazier's warmth to the ridge's frozen seal → the gate opens → earns Inkstep
 *   Folded Archive (develop):  jump + air-dash over the frozen membrane → it breathes a glide draft → ride up the shelf
 *   Wellspring Press (combine): warm the shelf's iced membrane, then break it → ride to the Press on its ledge
 * Pale paper, ink and ice with warm brazier light — the vale's sepia paint does not reach here. This file builds
 * (allocations allowed); every per-frame step lives in press.hot.ts.
 */
import * as THREE from 'three';
import { RAMP_WORLD } from '../lookdevKit';
import type { Collider } from '../lookdevPlay';
import type { OpeningCtx } from './scene';
import { pressH } from './worlds';
import { BRAZIER_A, BRAZIER_B, DRAFT, LEDGE, LEDGE_TOP, MEMBRANE_A, MEMBRANE_B, press, RIDGE, RIDGE_BASE, SHELF, SHELF_TOP, THE_PRESS } from './pressLayout';
import { pressLift, updatePress, type PressRig } from './press.hot';

const LEVEL_IDS = ['teach', 'develop', 'combine'] as const;
const winter = (color: THREE.ColorRepresentation, extra: THREE.MeshToonMaterialParameters = {}) =>
  new THREE.MeshToonMaterial({ color, gradientMap: RAMP_WORLD, ...extra });

export function buildPress(ctx: OpeningCtx, opts: { complete: (level: (typeof LEVEL_IDS)[number]) => boolean; hasInkstep: () => boolean }) {
  const { scene, colliders } = ctx;
  const root = new THREE.Group();
  root.name = 'press-levels';
  scene.add(root);
  // solids the chase camera may fade through (no decals under here: Moss's occluder rule)
  const solids = new THREE.Group();
  solids.name = 'press-solids';
  root.add(solids);
  ctx.occluders.push(solids);

  const inkMat = winter(0x23252d);
  const ribMat = winter(0xc9c0ac);
  const paperMat = winter(0xcfc6b2);
  const paperEdge = winter(0x9c927c);
  const timber = winter(0x3b2f2a);
  const stone = winter(0x6d6f78);
  const box = (lx0: number, lx1: number, lz0: number, lz1: number, y0: number, y1: number, mat: THREE.Material, parent: THREE.Object3D = solids) => {
    const c = press((lx0 + lx1) / 2, (lz0 + lz1) / 2);
    const m = new THREE.Mesh(new THREE.BoxGeometry(lx1 - lx0, y1 - y0, lz1 - lz0), mat);
    m.position.set(c.x, (y0 + y1) / 2, c.z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const solid = (lx0: number, lx1: number, lz0: number, lz1: number, top: number): Extract<Collider, { kind: 'box' }> => {
    const c = press((lx0 + lx1) / 2, (lz0 + lz1) / 2);
    const col: Extract<Collider, { kind: 'box' }> = { kind: 'box', x: c.x, z: c.z, yaw: 0, hx: (lx1 - lx0) / 2, hz: (lz1 - lz0) / 2, top };
    colliders.push(col);
    return col;
  };

  // ---- level 1: the ink ridge, ribbed like a book's spine, with one sealed gate
  const ridgeTop = RIDGE_BASE + RIDGE.rise;
  for (const side of [-1, 1] as const) {
    const a = side * RIDGE.gate;
    const b = side * RIDGE.xMax;
    const [x0, x1] = side < 0 ? [b, a] : [a, b];
    box(x0, x1, RIDGE.lz - RIDGE.half, RIDGE.lz + RIDGE.half, RIDGE_BASE - 2, ridgeTop, inkMat);
    solid(x0, x1, RIDGE.lz - RIDGE.half, RIDGE.lz + RIDGE.half, ridgeTop);
    // pale page ribs down both faces
    for (let x = Math.min(x0, x1) + 1; x < Math.max(x0, x1); x += 2.2) {
      for (const face of [-1, 1]) box(x - 0.12, x + 0.12, RIDGE.lz + face * (RIDGE.half + 0.02) - 0.04, RIDGE.lz + face * (RIDGE.half + 0.02) + 0.04, RIDGE_BASE - 0.5, ridgeTop - 0.25, ribMat);
    }
  }
  // gateposts and a lintel of folded pages
  for (const side of [-1, 1]) box(side * RIDGE.gate - 0.35, side * RIDGE.gate + 0.35, RIDGE.lz - RIDGE.half - 0.2, RIDGE.lz + RIDGE.half + 0.2, RIDGE_BASE - 0.5, ridgeTop + 0.6, paperEdge);
  box(-RIDGE.gate - 0.5, RIDGE.gate + 0.5, RIDGE.lz - RIDGE.half - 0.25, RIDGE.lz + RIDGE.half + 0.25, ridgeTop + 0.2, ridgeTop + 0.75, paperMat);
  // the seal: frozen ink, glassy blue-black, lit from inside
  const sealMat = new THREE.MeshStandardMaterial({ color: 0x3a4f78, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.82, emissive: 0x1b2c55, emissiveIntensity: 0.8 });
  const sealAt = press(0, RIDGE.lz);
  const seal = new THREE.Mesh(new THREE.BoxGeometry(RIDGE.gate * 2, ridgeTop - RIDGE_BASE, RIDGE.half * 1.2).translate(0, (ridgeTop - RIDGE_BASE) / 2, 0), sealMat);
  seal.position.set(sealAt.x, RIDGE_BASE, sealAt.z);
  seal.userData.base = RIDGE_BASE - 1;
  seal.userData.top = ridgeTop;
  root.add(seal);
  const sealCol = solid(-RIDGE.gate, RIDGE.gate, RIDGE.lz - RIDGE.half * 0.6, RIDGE.lz + RIDGE.half * 0.6, ridgeTop);

  // ---- braziers: iron bowls of embers on stone, the only warm light in the white
  const braziers: THREE.PointLight[] = [];
  const emberMat = new THREE.MeshBasicMaterial({ color: 0xffa040 });
  const brazier = (lx: number, lz: number, y: number) => {
    const at = press(lx, lz);
    const g = new THREE.Group();
    g.position.set(at.x, y, at.z);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.55, 7), stone);
    plinth.position.y = 0.27;
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.3, 0.32, 9, 1, true), timber);
    bowl.position.y = 0.7;
    const coals = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 0), emberMat);
    coals.scale.y = 0.45;
    coals.position.y = 0.8;
    const light = new THREE.PointLight(0xff8a3a, 1.6, 7, 1.8);
    light.position.y = 1.4;
    g.add(plinth, bowl, coals, light);
    root.add(g);
    braziers.push(light);
    colliders.push({ kind: 'post', x: at.x, z: at.z, r: 0.45 });
  };
  const ba = press(BRAZIER_A.lx, BRAZIER_A.lz);
  brazier(BRAZIER_A.lx, BRAZIER_A.lz, pressH(ba.x, ba.z));
  brazier(BRAZIER_B.lx, BRAZIER_B.lz, SHELF_TOP);

  // ---- level 2: the Archive shelf, a sheaf of pages the height of a house
  const shelfBase = RIDGE_BASE - 3;
  const layers = 7;
  for (let i = 0; i < layers; i++) {
    const y0 = shelfBase + ((SHELF_TOP - shelfBase) * i) / layers;
    const y1 = shelfBase + ((SHELF_TOP - shelfBase) * (i + 1)) / layers;
    const lip = (i % 2) * 0.35;
    box(-SHELF.xMax, SHELF.xMax, SHELF.z0, SHELF.z1 + lip, y0, y1 - 0.04, i % 2 ? paperEdge : paperMat);
  }
  solid(-SHELF.xMax, SHELF.xMax, SHELF.z0, SHELF.z1, SHELF_TOP);
  // ---- level 3: the Wellspring ledge on the shelf, and the Press on it
  for (let i = 0; i < 4; i++) {
    const y0 = SHELF_TOP + (LEDGE.rise * i) / 4;
    const y1 = SHELF_TOP + (LEDGE.rise * (i + 1)) / 4;
    box(LEDGE.x0 - i * 0.1, LEDGE.x1 + i * 0.1, LEDGE.z0, LEDGE.z1 + 0.3 * (i % 2), y0, y1 - 0.03, i % 2 ? paperMat : paperEdge);
  }
  solid(LEDGE.x0, LEDGE.x1, LEDGE.z0, LEDGE.z1, LEDGE_TOP);
  const pa = press(THE_PRESS.lx, THE_PRESS.lz);
  const thePress = new THREE.Group();
  thePress.position.set(pa.x, LEDGE_TOP, pa.z);
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.2, 0.4), timber);
    post.position.set(s * 1.4, 1.6, 0);
    thePress.add(post);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.45, 0.5), timber);
  beam.position.y = 3.2;
  const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.4, 8), stone);
  screw.position.y = 2.3;
  const platen = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.3, 1.2), stone);
  platen.position.y = 1.5;
  const bed = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 1.6), paperEdge);
  bed.position.y = 0.25;
  const pressLight = new THREE.PointLight(0xffc27a, 0, 14, 1.4);
  pressLight.position.y = 2;
  thePress.add(beam, screw, platen, bed, pressLight);
  root.add(thePress);
  colliders.push({ kind: 'box', x: pa.x, z: pa.z, yaw: 0, hx: 1.6, hz: 0.8, top: LEDGE_TOP + 0.5 });

  // ---- membranes: pools of frozen ink; the shelf's is iced over
  const memMat = new THREE.MeshStandardMaterial({ color: 0x14161f, roughness: 0.05, metalness: 0.3, emissive: 0x2a2a66, emissiveIntensity: 0.6 });
  const rimMat = new THREE.MeshBasicMaterial({ color: 0xa6a9e6, transparent: true, opacity: 0.55 });
  const membrane = (lx: number, lz: number, y: number, r: number) => {
    const at = press(lx, lz);
    const g = new THREE.Group();
    g.position.set(at.x, y + 0.03, at.z);
    g.add(new THREE.Mesh(new THREE.CircleGeometry(r, 24).rotateX(-Math.PI / 2), memMat));
    const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.12, 32).rotateX(-Math.PI / 2), rimMat);
    ring.position.y = 0.01;
    g.add(ring);
    root.add(g);
    return g;
  };
  const ma = press(MEMBRANE_A.lx, MEMBRANE_A.lz);
  const membranes = [membrane(MEMBRANE_A.lx, MEMBRANE_A.lz, pressH(ma.x, ma.z), MEMBRANE_A.r), membrane(MEMBRANE_B.lx, MEMBRANE_B.lz, SHELF_TOP, MEMBRANE_B.r)];
  const iceMat = new THREE.MeshStandardMaterial({ color: 0xdfe9f5, roughness: 0.2, transparent: true, opacity: 0.85, emissive: 0x8aa0c8, emissiveIntensity: 0.25 });
  const ice = new THREE.Mesh(new THREE.IcosahedronGeometry(MEMBRANE_B.r * 1.05, 1), iceMat);
  ice.scale.y = 0.28;
  ice.position.copy(membranes[1]!.position);
  root.add(ice);

  // ---- drafts: a breathing column of pale violet light over each cracked membrane
  // ink-violet over the snow (additive light vanishes against white)
  const draftMat = new THREE.MeshBasicMaterial({ color: 0x6a6cc0, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide });
  const draftCore = new THREE.MeshBasicMaterial({ color: 0x8f92e0, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });
  const drafts = membranes.map((mem) => {
    const g = new THREE.Group();
    g.position.copy(mem.position);
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(DRAFT.radius * 0.9, DRAFT.radius * 0.7, DRAFT.height, 20, 1, true).translate(0, DRAFT.height / 2, 0), draftMat);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(DRAFT.radius * 0.35, DRAFT.radius * 0.45, DRAFT.height * 0.9, 12, 1, true).translate(0, DRAFT.height * 0.45, 0), draftCore);
    g.add(outer, inner);
    // loose page leaves lifted in the column
    const leafGeo = new THREE.PlaneGeometry(0.22, 0.3);
    for (let i = 0; i < 14; i++) {
      const leaf = new THREE.Mesh(leafGeo, ribMat);
      const a = i * 2.39;
      leaf.position.set(Math.cos(a) * DRAFT.radius * 0.55, 0.6 + (i / 14) * (DRAFT.height - 1), Math.sin(a) * DRAFT.radius * 0.55);
      leaf.rotation.set(a, a * 0.7, 0.4);
      g.add(leaf);
    }
    g.visible = false;
    root.add(g);
    return g;
  });

  // ---- carried warmth: an ember glow at the fox's chest
  const warmGlow = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.85 }));
  warmGlow.position.set(0, 0.42, 0.12);
  warmGlow.visible = false;
  const warmLight = new THREE.PointLight(0xff9a48, 0, 3, 1.8);
  warmLight.position.set(0, 0.6, 0);
  ctx.fox.root.add(warmGlow, warmLight);

  const say = (t: string) => ctx.captions.say(t);
  const rig: PressRig = {
    fox: ctx.fox.root,
    motion: () => ctx.player?.motion ?? null,
    hasInkstep: opts.hasInkstep,
    teach: ctx.teach.offer,
    events: {
      warmed: () => ctx.audio.play('soft-paper', { at: ctx.fox.root.position.clone(), gain: 0.08, rate: 0.5 }),
      thawSeal: () => {
        ctx.audio.cue('millrace-burst');
        say('The frozen ink lets go.');
      },
      crack: () => {
        ctx.audio.cue('millrace-burst');
        say('The ink breathes.');
      },
      meltIce: () => say('The ice runs off the ink.'),
      complete: (level) => {
        opts.complete(LEVEL_IDS[level]);
        if (level === 0) say('Inkstep · the frozen ink will break under you now.');
        if (level === 1) say('The Folded Archive opens.');
        if (level === 2) {
          pressLight.intensity = 2.2;
          ctx.audio.cue('finale-kindle');
          say('The Press wakes. The Maple Seedwell fills.');
        }
      },
    },
    seal,
    sealCol,
    warmGlow,
    warmLight,
    braziers,
    membranes,
    ice,
    drafts,
    s: { warm: 0, sealK: 0, thawed: 0, crackA: -1, crackB: -1, iceK: 0, iced: 1, done: 0, dashWasAir: 0, time: 0, hint: 0 },
  };
  ctx.onUpdate((dt) => updatePress(rig, dt));

  return {
    /** fold the drafts into a lift sample (the controller's updraft read) */
    liftAt: (x: number, feetY: number, z: number, out: { k: number; radialK: number; ax: number; az: number }) => pressLift(rig, x, feetY, z, out),
    state: () => ({
      warm: +rig.s.warm.toFixed(2), sealOpen: rig.s.sealK >= 1, draftA: rig.s.crackA >= 0, iced: rig.s.iced === 1, draftB: rig.s.crackB >= 0,
      done: LEVEL_IDS.filter((_, i) => (rig.s.done & (1 << i)) !== 0),
    }),
  };
}

export type Press = ReturnType<typeof buildPress>;
