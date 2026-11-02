/**
 * The finale (DESIGN-finale.md, tla/Finale.tla): Press Hollow below the far crag, and the Scribe's Press near its far
 * lip with the Still Crown behind. Set the one ember in the Press cradle once the first Keeping has settled: the
 * screw unbinds, the Album opens, its pages fly up the valley to the Crown as leaves, the first snow falls, three
 * pressed kits drift down and curl round the ember, and when the fox rests by them the end card fades in.
 *
 * This file builds (allocations allowed); every per-frame step lives in finale.hot.ts.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import foxRestUrl from '../../../../assets/hero/hearth_fox_rest.glb?url';
import { buildMaple, buildRock, roundStone, CANOPY, CANOPY_MOSS, canopyPad, RAMP_CANOPY, contactInk, hewn, hullGeometry, inked, inkMaterial, jitter, mapleLeafGeometry, paintU, RAMP_WORLD, rng, toon } from '../lookdevKit';
import { buildGrass, buildGround, buildLeaves } from '../lookdevGround';
import { loadHearthFox, type HearthFox } from '../lookdevFox';
import type { OpeningCtx } from './scene';
import type { FollowCamera } from '../camera';
import { CROWN, FINALE, HEARTH_A, KEEPING, pathDist, VISTA, WELL } from './layout';
import { createLetterPlane } from './lettering';
import { FINALE_TIMING, KIT_PHASES, PHASES, updateFinale, type FinaleRig } from './finale.hot';

/** album paper, ink-frost, iron and the warm colours the hollow wakes into */
const PAPER = 0xe9dcc0;
const COVER = 0x6f5a48;
const FROST = 0x2c2622;
const IRON = 0x2a2420;
const PAGES = 72;
const SNOW = 2600;

/** maples ringing the hollow [a, c, scale, kind, palette] in the vista frame (a along the fall line, c across) */
const TREES: Array<[number, number, number, 'hero' | 'grove' | 'lean' | 'tall', number]> = [
  [12, 14, 1.3, 'grove', 4], [18, 17, 1.45, 'tall', 0], [25, 18, 1.2, 'grove', 5], [31, 15, 1.1, 'lean', 2],
  [11, -13, 1.2, 'grove', 5], [17, -16, 1.5, 'hero', 1], [24, -17, 1.25, 'grove', 4], [30.5, -13.5, 1.05, 'tall', 3],
  [20.5, 9.5, 0.95, 'grove', 2], [21.5, -9, 1.0, 'lean', 0],
];
/** pressed-flat page-stones standing in a loose ring round the Press [a, c, height, yaw offset] */
const STONES: Array<[number, number, number, number]> = [
  [23, 6.2, 1.5, 0.4], [27.5, 7.2, 1.2, -0.3], [31.5, 4.6, 1.7, 0.2], [31.6, -4.4, 1.35, -0.5], [27, -7.0, 1.6, 0.3], [22.4, -6.4, 1.15, -0.2],
];

function paperTexture(rand: () => number, sketch: number): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 96;
  cv.height = 128;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#efe3c8';
  g.fillRect(0, 0, 96, 128);
  g.fillStyle = 'rgba(160,120,80,0.18)';
  g.fillRect(0, 0, 96, 6);
  g.strokeStyle = 'rgba(58,40,28,0.75)';
  g.lineWidth = 2;
  g.lineCap = 'round';
  // a quick ink sketch per page: hills, a tree, a sun or a little fox curl
  g.beginPath();
  g.moveTo(8, 96);
  for (let x = 8; x <= 88; x += 8) g.lineTo(x, 92 - Math.sin(x * 0.08 + sketch) * 10 - rand() * 4);
  g.stroke();
  g.beginPath();
  if (sketch % 3 === 0) {
    g.moveTo(48, 92); g.lineTo(48, 52);
    g.arc(48, 44, 16, 0, Math.PI * 2);
  } else if (sketch % 3 === 1) {
    g.arc(30 + rand() * 30, 34, 10, 0, Math.PI * 2);
  } else {
    g.arc(48, 66, 18, Math.PI * 0.9, Math.PI * 2.4);
    g.moveTo(62, 58); g.lineTo(70, 48); g.lineTo(66, 62);
  }
  g.stroke();
  g.fillStyle = 'rgba(200,110,50,0.55)';
  g.beginPath();
  g.arc(20 + rand() * 56, 108, 4, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** distance from (px, pz) to the segment (ax, az)–(bx, bz) on the ground plane */
function segDist(ax: number, az: number, bx: number, bz: number, px: number, pz: number): number {
  const vx = bx - ax, vz = bz - az;
  const u = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / Math.max(1e-6, vx * vx + vz * vz)));
  return Math.hypot(ax + vx * u - px, az + vz * u - pz);
}

export async function buildFinale(ctx: OpeningCtx, opts: {
  settled: () => boolean;
  ember: { restsAt: (x: number, y: number, z: number, r: number) => boolean; where: (out: THREE.Vector3) => boolean };
  /** the page is pinned at home: from then on a stream of motes leads from the well to the ember */
  homeReady: () => boolean;
  cam: FollowCamera;
  player: { setMoveScale: (k: number) => void; intent: () => number };
  crownLetGo: () => void;
  onCard?: () => void;
}) {
  let forced = false;

  const { scene, groundH, colliders } = ctx;
  // own seeded stream: building the finale never shifts the shared ctx.rand sequence other places (and replays) rely on
  const rand = rng(0x5c41be);
  const F = FINALE;
  const yaw = F.press.yaw;
  /** Press-local → world (local +z faces the crag, local +x across) */
  const local = (lx: number, lz: number) => ({
    x: F.press.x + lx * Math.cos(yaw) + lz * Math.sin(yaw),
    z: F.press.z - lx * Math.sin(yaw) + lz * Math.cos(yaw),
  });

  // ---- ground: the hollow and the drop past its lip continue the meadow ground south of its mesh edge
  const groundCtx = { groundH, pathDist, toon, mapleLeafGeometry };
  // abuts the bowl sheet (meadow.ts: x −64..56 in 170 segments, z from 40.5) on its exact vertex columns: no overlap, no cracks
  const step = 120 / 170;
  buildGround(scene, groundCtx, { cx: -64 + (81 + 37) * step, cz: 40.5 - 13.5, w: 74 * step, d: 27, seg: 74 });
  const inHollow = (x: number, z: number) => {
    const V = FINALE;
    const p = { x: x - V.press.x, z: z - V.press.z };
    return Math.hypot(p.x, p.z) < 19 && groundH(x, z) > F.hollow.y - 1.2 && groundH(x, z) < F.hollow.y + 1.6;
  };
  buildGrass(scene, rand, groundCtx, { cx: F.press.x, cz: F.press.z + 6, w: 36, d: 34, n: 900, keep: (x, z) => inHollow(x, z) && Math.hypot(x - F.cradle.x, z - F.cradle.z) > 2.4 });
  buildLeaves(scene, rand, groundCtx, {
    cx: F.press.x, cz: F.press.z + 5, r: 17, n: 1100,
    drifts: TREES.map(([a, c, sc]) => { const p = F.at(a, c); return [p.x, p.z, 1.8 + sc * 1.4] as const; }),
    keep: (x, z) => inHollow(x, z) && Math.hypot(x - F.cradle.x, z - F.cradle.z) > 1.4,
  });
  for (const [a, c, sc, kind, pal] of TREES) {
    const p = F.at(a, c);
    const y = groundH(p.x, p.z);
    const t = buildMaple(rand, sc, kind, pal, y);
    t.position.set(p.x, y - 0.1, p.z);
    t.rotation.y = rand() * 6;
    scene.add(t);
    ctx.occluders.push(t);
    colliders.push({ kind: 'post', x: p.x, z: p.z, r: (kind === 'hero' ? 0.42 : kind === 'lean' ? 0.38 : 0.3) * sc * 1.5 });
  }
  for (const [a, c, s] of [[14, 6, 0.7], [15, 7.4, 0.4], [33, -1, 0.9], [19, -11, 0.6], [29, 11, 0.55]] as const) {
    const p = F.at(a, c);
    const r = buildRock(rand, s);
    r.position.set(p.x, groundH(p.x, p.z) + s * 0.25, p.z);
    scene.add(r);
    scene.add(contactInk(r, groundH));
    colliders.push({ kind: 'cap', x: p.x, z: p.z, r: s * 1.1, base: groundH(p.x, p.z), h: s * 0.95 });
  }
  const stoneMat = toon(0x8a7a66, { contour: 0.6 });
  for (const [a, c, h, dy] of STONES) {
    const p = F.at(a, c);
    const y = groundH(p.x, p.z);
    const slab = inked(hewn(new THREE.BoxGeometry(0.9, h, 0.22, 2, 3, 1), rand, 0.06), stoneMat, 0.02);
    slab.position.set(p.x, y + h / 2 - 0.08, p.z);
    slab.rotation.set((rand() - 0.5) * 0.12, Math.atan2(F.press.x - p.x, F.press.z - p.z) + dy, (rand() - 0.5) * 0.1);
    scene.add(slab);
    colliders.push({ kind: 'box', x: p.x, z: p.z, yaw: slab.rotation.y, hx: 0.5, hz: 0.16, top: y + h });
  }

  // ---- hollow dressing: low bramble/bracken clumps and aster patches round its slopes, never on the lane, the Press
  // or the cradle's apron (same language as dressing.ts, which keeps out of the vista)
  {
    const bushMat = toon(0xffffff, { vertexColors: true, contour: 0.9, ramp: RAMP_CANOPY });
    const clear = (x: number, z: number) => pathDist(x, z) > 2.2 && Math.hypot(x - F.press.x, z - F.press.z) > 6.5 && inHollow(x, z);
    let placed = 0;
    for (let i = 0; i < 600 && placed < 26; i++) {
      const a = 6 + rand() * 26;
      const c = (rand() - 0.5) * 34;
      const p = F.at(a, c);
      if (!clear(p.x, p.z)) continue;
      placed++;
      const tones = rand() < 0.65 ? CANOPY_MOSS[Math.floor(rand() * CANOPY_MOSS.length)]! : CANOPY[Math.floor(rand() * CANOPY.length)]!;
      const scale = 0.8 + rand() * 0.6;
      for (let k = 0, n = 2 + Math.floor(rand() * 3); k < n; k++) {
        const r = (0.42 + rand() * 0.3) * scale;
        const m = new THREE.Mesh(canopyPad(rand, r, r * 0.72, tones, 0.42), bushMat);
        const t = rand() * 6.28;
        m.position.set(p.x + Math.cos(t) * r * 0.8 * (k ? 1 : 0), groundH(p.x, p.z) - 0.05 + r * 0.38, p.z + Math.sin(t) * r * 0.8 * (k ? 1 : 0));
        m.rotation.y = rand() * 6.28;
        m.castShadow = m.receiveShadow = true;
        scene.add(m);
      }
    }
    // aster heads: one instanced batch of small ink-flecked blooms in patches
    const heads = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.035, 0), new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: RAMP_WORLD }), 420);
    const mm = new THREE.Matrix4();
    const col = new THREE.Color();
    const BLOOM = [0x9a4f3c, 0xa8834a, 0x7d5a6a, 0xe6a65a];
    let n = 0;
    for (let i = 0; i < 400 && n < 420 - 20; i++) {
      const p = F.at(5 + rand() * 28, (rand() - 0.5) * 30);
      if (!clear(p.x, p.z)) continue;
      const tone = BLOOM[Math.floor(rand() * BLOOM.length)]!;
      for (let k = 0; k < 18 && n < 420; k++) {
        const t = rand() * 6.28;
        const r = Math.sqrt(rand()) * 0.7;
        const x = p.x + Math.cos(t) * r;
        const z = p.z + Math.sin(t) * r;
        mm.makeTranslation(x, groundH(x, z) + 0.1 + rand() * 0.14, z);
        heads.setMatrixAt(n, mm);
        heads.setColorAt(n++, col.setHex(tone));
      }
      if (n > 380) break;
    }
    heads.count = n;
    scene.add(heads);
  }

  // ---- the far lip: a standing row of the Album's stone leaves, closing the hollow above the drop into the deep valley
  // (one continuous collider line, taller than a jump, so the fox can't wander off down the endless vista floor)
  {
    const LIP = { a: 35.2, c0: -23, c1: 22.5 };
    const n = Math.ceil((LIP.c1 - LIP.c0) / 0.7);
    const slabGeo = hewn(new THREE.BoxGeometry(0.95, 1, 0.26, 2, 3, 1), rand, 0.05);
    const slabs = new THREE.InstancedMesh(slabGeo, toon(0x7a6a58, { contour: 0.6 }), n);
    const hull = new THREE.InstancedMesh(hullGeometry(slabGeo), inkMaterial(0.02), n);
    const mm = new THREE.Matrix4();
    const across = Math.atan2(VISTA.dx, VISTA.dz);
    for (let i = 0; i < n; i++) {
      const c = LIP.c0 + (i + 0.5) * ((LIP.c1 - LIP.c0) / n);
      const p = F.at(LIP.a + Math.sin(c * 0.7) * 0.25, c);
      const y = groundH(p.x, p.z);
      // weathered and uneven, leaning every which way: a row of old standing leaves, not a built wall
      const h = 1.05 + rand() * 1.0 + (rand() < 0.25 ? 0.7 : 0);
      const w = 0.65 + rand() * 0.45;
      mm.compose(
        new THREE.Vector3(p.x, y + h / 2 - 0.2, p.z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler((rand() - 0.5) * 0.3, across + (rand() - 0.5) * 0.6, (rand() - 0.5) * 0.3)),
        new THREE.Vector3(w, h, 0.8 + rand() * 0.5),
      );
      slabs.setMatrixAt(i, mm);
      hull.setMatrixAt(i, mm);
    }
    slabs.castShadow = slabs.receiveShadow = true;
    scene.add(slabs, hull);
    // collider segments along the row, each top above the highest ground it spans + 2.2 m
    for (let c = LIP.c0; c < LIP.c1; c += 3) {
      const m = F.at(LIP.a, c + 1.5);
      const top = Math.max(groundH(F.at(LIP.a, c).x, F.at(LIP.a, c).z), groundH(m.x, m.z), groundH(F.at(LIP.a, c + 3).x, F.at(LIP.a, c + 3).z)) + 2.3;
      colliders.push({ kind: 'box', x: m.x, z: m.z, yaw: across, hx: 1.6, hz: 0.35, top });
    }
  }

  // ---- the Scribe's Press: the Album lies shut on a stone plinth under a timber book-press, its iron screw
  // driving a platen down on the cover. Spine along local z (toward the crag), so the cover opens right → left.
  const base = groundH(F.press.x, F.press.z);
  const press = new THREE.Group();
  press.position.set(F.press.x, base, F.press.z);
  press.rotation.y = yaw;
  scene.add(press);
  const plinth = inked(hewn(new THREE.BoxGeometry(3.0, 0.7, 3.8, 3, 1, 3), rand, 0.05), toon(0x6c5c4c, { contour: 0.5 }), 0.022);
  plinth.position.y = 0.25;
  press.add(plinth);
  const coverMat = new THREE.MeshToonMaterial({ color: FROST, gradientMap: RAMP_WORLD });
  const ironMat = new THREE.MeshToonMaterial({ color: IRON, emissive: 0x000000, gradientMap: RAMP_WORLD });
  const BOOK = { y: 0.6, w: 2.5, d: 3.3, cover: 0.16, block: 0.42 };
  const back = inked(hewn(new THREE.BoxGeometry(BOOK.w, BOOK.cover, BOOK.d, 3, 1, 4), rand, 0.02), coverMat, 0.02);
  back.position.set(0, BOOK.y + BOOK.cover / 2, 0);
  press.add(back);
  // the book block: page edges, a few pressed leaves sticking out between the pages
  const paperMat = new THREE.MeshToonMaterial({ color: 0x9c8e78, gradientMap: RAMP_WORLD });
  const blockY = BOOK.y + BOOK.cover + BOOK.block / 2;
  const block = inked(new THREE.BoxGeometry(BOOK.w - 0.12, BOOK.block, BOOK.d - 0.12), paperMat, 0.014);
  block.position.set(0.04, blockY, 0);
  press.add(block);
  const stuck = new THREE.MeshToonMaterial({ color: 0x8a5a3a, gradientMap: RAMP_WORLD, side: THREE.DoubleSide });
  for (let i = 0; i < 8; i++) {
    const leaf = new THREE.Mesh(mapleLeafGeometry(0.24 + rand() * 0.1).rotateX(-Math.PI / 2), stuck);
    const side = i % 3;
    const along = (rand() - 0.5) * (BOOK.d - 0.6);
    leaf.position.set(side === 0 ? BOOK.w / 2 + 0.05 : side === 1 ? (rand() - 0.5) * 1.8 : BOOK.w / 2 - 0.1, blockY + (rand() - 0.5) * 0.2, side === 1 ? BOOK.d / 2 + 0.06 : along);
    leaf.rotation.set((rand() - 0.5) * 0.4, rand() * 6, (rand() - 0.5) * 0.4);
    press.add(leaf);
  }
  // the front cover hinges on the spine (local −x edge) and turns over to the left
  const hinge = new THREE.Group();
  const coverY = BOOK.y + BOOK.cover + BOOK.block;
  hinge.position.set(-BOOK.w / 2, coverY, 0);
  press.add(hinge);
  const front = inked(hewn(new THREE.BoxGeometry(BOOK.w, BOOK.cover, BOOK.d, 3, 1, 4), rand, 0.02), coverMat, 0.02);
  front.position.set(BOOK.w / 2, BOOK.cover / 2, 0);
  hinge.add(front);
  // a pressed-leaf emblem inlaid on the cover: the first thing to warm
  const emblemMat = new THREE.MeshBasicMaterial({ color: 0x4a3a30, side: THREE.DoubleSide });
  const emblem = new THREE.Mesh(mapleLeafGeometry(0.9).rotateX(-Math.PI / 2), emblemMat);
  emblem.position.set(0.15, BOOK.cover / 2 + 0.012, 0.35);
  front.add(emblem);
  // iron corner caps on both covers and a rounded spine: it reads as a book, not a crate
  const capGeo = new THREE.BoxGeometry(0.34, BOOK.cover + 0.04, 0.34);
  for (const [cx, cz] of [[1, 1], [1, -1]] as const) {
    for (const host of [front, back]) {
      const cap = new THREE.Mesh(capGeo, ironMat);
      cap.position.set(host === front ? cx * (BOOK.w / 2 - 0.15) : BOOK.w / 2 - 0.15, 0, cz * (BOOK.d / 2 - 0.15));
      host.add(cap);
    }
  }
  const spine = inked(new THREE.CylinderGeometry(0.42, 0.42, BOOK.d + 0.02, 12, 1, false, Math.PI, Math.PI).rotateX(Math.PI / 2), coverMat, 0.018);
  spine.scale.set(0.42, 1, 1);
  spine.position.set(-BOOK.w / 2, BOOK.y + BOOK.cover + BOOK.block / 2, 0);
  press.add(spine);
  // where the open cover comes to rest: a low stone off the spine side
  const rest = buildRock(rand, 0.42, false);
  rest.position.set(-BOOK.w - 0.9, 0.18, 0);
  press.add(rest);
  // the timber frame: posts at the book's head and foot, a beam over the spine line, a screw down through it
  const timber = toon(0x4a3426, { contour: 0.7 });
  const frame = new THREE.Group();
  press.add(frame);
  const FRAME = { x: 0.3, z: BOOK.d / 2 + 0.32, top: 4.4 };
  for (const sz of [-FRAME.z, FRAME.z]) {
    const post = inked(hewn(new THREE.BoxGeometry(0.3, FRAME.top, 0.3, 1, 4, 1), rand, 0.04), timber, 0.02);
    post.position.set(FRAME.x, FRAME.top / 2, sz);
    frame.add(post);
    const p = local(FRAME.x, sz);
    colliders.push({ kind: 'post', x: p.x, z: p.z, r: 0.24 });
  }
  const beam = inked(hewn(new THREE.BoxGeometry(0.46, 0.5, FRAME.z * 2 + 0.6, 1, 1, 4), rand, 0.04), timber, 0.02);
  beam.position.set(FRAME.x, FRAME.top, 0);
  frame.add(beam);
  // a press, not a gate: squat stone feet, knee braces into the beam, iron straps where the timber is worked
  const footMat = toon(0x6a5a4a, { contour: 0.5 });
  const strap = toon(0x2a2420);
  for (const sz of [-FRAME.z, FRAME.z]) {
    const foot = inked(hewn(new THREE.BoxGeometry(0.7, 0.5, 0.7, 1, 1, 1), rand, 0.06), footMat, 0.018);
    foot.position.set(FRAME.x, 0.22, sz);
    frame.add(foot);
    const brace = inked(hewn(new THREE.BoxGeometry(0.16, 1.15, 0.16, 1, 2, 1), rand, 0.04), timber, 0.014);
    brace.position.set(FRAME.x, FRAME.top - 0.62, sz * 0.8);
    brace.rotation.x = Math.sign(sz) * 0.75;
    frame.add(brace);
    for (const y of [FRAME.top - 0.05, 1.0]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.36), strap);
      band.position.set(FRAME.x, y + (y > 2 ? 0 : 0), sz);
      frame.add(band);
    }
  }
  for (const y of [-0.18, 0.18]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.56, 0.08), strap);
    band.position.set(FRAME.x, FRAME.top, y);
    frame.add(band);
  }
  // the screw assembly (thread + platen) slides up when the Press unbinds; the wheel turns on top of the beam
  const screw = new THREE.Group();
  screw.position.set(FRAME.x, 0, 0);
  frame.add(screw);
  const thread = inked(new THREE.CylinderGeometry(0.1, 0.1, FRAME.top - coverY + 0.3, 10, 8), ironMat, 0.012);
  thread.position.y = (FRAME.top + coverY + 0.3) / 2;
  screw.add(thread);
  const platen = inked(hewn(new THREE.BoxGeometry(1.3, 0.14, 2.3, 2, 1, 2), rand, 0.02), ironMat, 0.014);
  platen.position.y = coverY + BOOK.cover + 0.07;
  screw.add(platen);
  const wheel = new THREE.Group();
  wheel.position.y = FRAME.top + 0.34;
  screw.add(wheel);
  wheel.add(inked(new THREE.TorusGeometry(0.5, 0.05, 6, 20).rotateX(Math.PI / 2), ironMat, 0.012));
  for (let i = 0; i < 4; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 5).rotateZ(Math.PI / 2), ironMat);
    spoke.rotation.y = (i * Math.PI) / 4;
    wheel.add(spoke);
  }
  colliders.push({ kind: 'box', x: F.press.x, z: F.press.z, yaw, hx: 1.5, hz: 1.9, top: base + coverY + 0.3 });

  // the Scribe's empty stool and cold lamp beside the Press: whoever kept the year is long gone
  const stool = new THREE.Group();
  const sy = groundH(F.stool.x, F.stool.z);
  stool.position.set(F.stool.x, sy, F.stool.z);
  stool.rotation.y = yaw + 0.5;
  scene.add(stool);
  const seat = inked(new THREE.CylinderGeometry(0.34, 0.32, 0.08, 10), timber, 0.014);
  seat.position.y = 0.5;
  stool.add(seat);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = inked(new THREE.CylinderGeometry(0.035, 0.045, 0.52, 5), timber, 0.01);
    leg.position.set(Math.cos(a) * 0.22, 0.25, Math.sin(a) * 0.22);
    leg.rotation.set(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12);
    stool.add(leg);
  }
  const lampPaper = new THREE.MeshToonMaterial({ color: 0x6a5c4c, emissive: 0x000000, gradientMap: RAMP_WORLD });
  const lamp = inked(new THREE.CylinderGeometry(0.1, 0.12, 0.22, 8), lampPaper, 0.01);
  lamp.position.set(0.05, 0.66, 0.02);
  stool.add(lamp);
  colliders.push({ kind: 'post', x: F.stool.x, z: F.stool.z, r: 0.36 });

  // ---- the cradle: a ring of fire-blackened stones round an ash bed at the Press's foot
  const cy = groundH(F.cradle.x, F.cradle.z);
  const cradle = new THREE.Group();
  cradle.position.set(F.cradle.x, cy, F.cradle.z);
  scene.add(cradle);
  const sootMat = toon(0x4a3c34, { contour: 0.5 });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const s = inked(roundStone(jitter(new THREE.DodecahedronGeometry(0.17, 0), 0.12, rand)), sootMat, 0.012);
    s.position.set(Math.cos(a) * 0.5, 0.06, Math.sin(a) * 0.5);
    s.scale.set(1.2, 0.7, 1);
    cradle.add(s);
  }
  const ash = new THREE.Mesh(new THREE.CircleGeometry(0.42, 18).rotateX(-Math.PI / 2), new THREE.MeshToonMaterial({ color: 0x5c524a, gradientMap: RAMP_WORLD }));
  ash.position.y = 0.02;
  cradle.add(ash);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xff8a34, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const glow = new THREE.Mesh(new THREE.CircleGeometry(1.15, 24).rotateX(-Math.PI / 2), glowMat);
  glow.position.y = 0.05;
  cradle.add(glow);
  const light = new THREE.PointLight(0xffa050, 0, 11, 1.4);
  light.position.set(0, 1.1, 0);
  cradle.add(light);

  // ---- the Album's pages: they lift off the open book, spiral up and fly down the valley toward the Crown,
  // turning into leaves on the way (each particle draws as a page, then as a leaf)
  const pageGeo = new THREE.PlaneGeometry(0.34, 0.46);
  const pageMats = [0, 1, 2].map((i) => new THREE.MeshBasicMaterial({ map: paperTexture(rand, i), side: THREE.DoubleSide, transparent: true, depthWrite: false }));
  const pageMeshes = pageMats.map((m) => {
    const mesh = new THREE.InstancedMesh(pageGeo, m, PAGES);
    mesh.frustumCulled = false;
    mesh.count = 0;
    scene.add(mesh);
    return mesh;
  });
  const leafMesh = new THREE.InstancedMesh(mapleLeafGeometry(0.28), new THREE.MeshBasicMaterial({ color: 0xf2954a, side: THREE.DoubleSide, toneMapped: false }), PAGES);
  leafMesh.frustumCulled = false;
  leafMesh.count = 0;
  scene.add(leafMesh);
  const pageSeed = new Float32Array(PAGES * 4);
  for (let i = 0; i < PAGES; i++) pageSeed.set([rand(), rand(), rand(), rand()], i * 4);

  // loose album pages caught in the grass round the Press: the Scribe's work, blown about and left
  const scrapGeo = new THREE.PlaneGeometry(0.3, 0.4).rotateX(-Math.PI / 2);
  for (const m of pageMats) {
    const scraps = new THREE.InstancedMesh(scrapGeo, new THREE.MeshToonMaterial({ color: 0x8c7c68, map: m.map, gradientMap: RAMP_WORLD, side: THREE.DoubleSide }), 6);
    const mm = new THREE.Matrix4();
    for (let i = 0; i < 6; i++) {
      const a = rand() * Math.PI * 2;
      const r = 3 + rand() * 9;
      const x = F.press.x + Math.cos(a) * r;
      const z = F.press.z + 4 + Math.sin(a) * r;
      mm.compose(
        new THREE.Vector3(x, groundH(x, z) + 0.03, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler((rand() - 0.5) * 0.3, rand() * 6.28, (rand() - 0.5) * 0.3)),
        new THREE.Vector3(1, 1, 1).multiplyScalar(0.8 + rand() * 0.5),
      );
      scraps.setMatrixAt(i, mm);
    }
    scraps.receiveShadow = true;
    scene.add(scraps);
  }

  // ---- snow: a camera-centred box of flakes that falls in the shader (no per-frame CPU work)
  const snowGeo = new THREE.BufferGeometry();
  const sp = new Float32Array(SNOW * 3);
  for (let i = 0; i < SNOW; i++) sp.set([rand(), rand(), rand()], i * 3);
  snowGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const snowMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uAmount: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(44, 22, 44) }, uSize: { value: 1 }, uHalfH: { value: 270 } },
    vertexShader: /* glsl */ `
      uniform float uTime; uniform float uAmount; uniform vec3 uCenter; uniform vec3 uBox; uniform float uSize; uniform float uHalfH;
      varying float vA;
      void main() {
        vec3 s = position;
        vec3 p = s * uBox;
        p.y -= uTime * (0.55 + s.z * 0.35);
        p.x += sin(uTime * 0.5 + s.y * 31.0) * 0.6 + uTime * 0.18;
        p.z += cos(uTime * 0.37 + s.x * 23.0) * 0.5;
        p = mod(p - uCenter + uBox * 0.5, uBox) + uCenter - uBox * 0.5;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        vA = step(s.y, uAmount) * smoothstep(0.0, 3.0, -mv.z);
        // ~4–9 cm flakes at true perspective size, clamped so the nearest never balloon into discs
        gl_PointSize = clamp(uSize * (0.06 + s.x * 0.08) * projectionMatrix[1][1] * uHalfH / -mv.z, 1.6, 7.0);
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.15, d) * vA * 0.85;
        if (a < 0.01) discard;
        gl_FragColor = vec4(1.0, 0.975, 0.95, a);
      }`,
  });
  const snow = new THREE.Points(snowGeo, snowMat);
  snow.frustumCulled = false;
  snow.visible = false;
  scene.add(snow);

  // ---- three pressed kits: small hearth-foxes that drift down as pages and pop into kits by the ember
  const kitFoxes: HearthFox[] = await Promise.all(F.kits.map(() => loadHearthFox(inkMaterial, 0.012)));
  const kitPages = kitFoxes.map((k, i) => {
    k.root.visible = false;
    k.root.scale.setScalar(0.001);
    scene.add(k.root);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.66), new THREE.MeshBasicMaterial({ map: pageMats[i % 3]!.map, side: THREE.DoubleSide, transparent: true }));
    p.visible = false;
    scene.add(p);
    return p;
  });

  // ---- rest clips (tools/blender/scripts/hearth_fox_rest.py, same rig and bone names as the shipped fox): `lieDown`
  // settles into a curled sphinx-down with the tail round the paws, `rest` breathes there. Kits play them through
  // their own clip switch; the hero blends them over its controller (finale.hot.ts) only while it rests by the ember.
  const restClips = (await new GLTFLoader().loadAsync(foxRestUrl)).animations;
  const lieClip = restClips.find((c) => c.name === 'lieDown');
  const restClip = restClips.find((c) => c.name === 'rest');
  if (!lieClip || !restClip) throw new Error('hearth_fox_rest.glb is missing lieDown / rest');
  const bindRest = (fox: HearthFox) => {
    const lie = fox.mixer.clipAction(lieClip);
    lie.setLoop(THREE.LoopOnce, 1);
    lie.clampWhenFinished = true;
    const rest = fox.mixer.clipAction(restClip);
    fox.actions.set('lieDown', lie);
    fox.actions.set('rest', rest);
    return { lie, rest };
  };
  for (const k of kitFoxes) bindRest(k);
  const hero = bindRest(ctx.fox);
  hero.lie.setEffectiveWeight(0);
  hero.rest.setEffectiveWeight(0);

  // ---- the way: once the Keeping has settled, a thin stream of warm motes runs from the root-hearth (where the
  // ember rests) across the bridge, off the crag's lip and down into the hollow to the cradle, until it is kindled
  const wayCurve = new THREE.CatmullRomCurve3([
    [KEEPING.root.x, KEEPING.root.y + 0.7, KEEPING.root.z], [KEEPING.hinge.x, KEEPING.terrace.top + 1.0, KEEPING.hinge.z],
    [KEEPING.crag.x, KEEPING.crag.top + 1.0, KEEPING.crag.z], [25.3, KEEPING.crag.top + 0.9, 62.4],
    [23.6, 6.2, 55.5], [21.9, 2.4, 48], [21.3, cy + 0.9, 42.2], [F.cradle.x, cy + 0.5, F.cradle.z],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const WAY_N = 160;
  const wayLut = new Float32Array(WAY_N * 3);
  for (let i = 0; i < WAY_N; i++) wayCurve.getPointAt(i / (WAY_N - 1)).toArray(wayLut, i * 3);
  const wayMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffa548, toneMapped: false }), 34);
  wayMesh.frustumCulled = false;
  wayMesh.count = 0;
  scene.add(wayMesh);

  // ---- onward: when the page is pinned, a second stream leaves the well and leads to wherever the ember
  // rests (the shelf before the Keeping, the root-hearth after), so the homecoming hands over instead of ending.
  // Rebuilt (cold) only when the ember has moved; the hot step just walks the LUT.
  // a little larger than the bridge stream: it has to read across the plaza and meadow from the well
  const onwardMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.15, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffbe5a, toneMapped: false }), 48);
  onwardMesh.frustumCulled = false;
  onwardMesh.count = 0;
  scene.add(onwardMesh);
  const onwardLut = new Float32Array(WAY_N * 3);
  const onwardAt = new THREE.Vector3(Infinity, 0, 0);
  const onwardFrom = new THREE.Vector3(Infinity, 0, 0);
  const rebuildOnward = (to: THREE.Vector3): number => {
    onwardAt.copy(to);
    // the stream starts at the fox's feet (Kit: the ending has to find the player, not wait at the well), then out
    // through the gate if it is still in the village
    const f = ctx.fox.root.position;
    onwardFrom.copy(f);
    const pts = [[f.x, f.y + 0.9, f.z]];
    if (f.z > 82) pts.push([-3, groundH(-3, 81) + 1.1, 81], [0.5, groundH(0.5, 80) + 1.1, 80]);
    // up the shelf: the motes ride the hearth's warm column, as the fox will
    if (to.y > 2.5) pts.push([HEARTH_A.x - 0.6, groundH(HEARTH_A.x, HEARTH_A.z) + 1.6, HEARTH_A.z + 0.8], [HEARTH_A.x + 0.4, to.y + 2.2, HEARTH_A.z - 0.3]);
    pts.push([to.x, to.y + 0.7, to.z]);
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    for (let i = 0; i < WAY_N; i++) curve.getPointAt(i / (WAY_N - 1)).toArray(onwardLut, i * 3);
    return curve.getLength();
  };

  // ---- the end card: drawn in the frame (lettering.ts) so every recording carries it; big, in the upper third
  const card = createLetterPlane(2048, 720, 0.42, 0.5);
  card.draw([
    { text: 'Russet Vale', px: 300, italic: true, spacing: 0.02 },
    { text: 'and the year turned', px: 84, spacing: 0.14, alpha: 0.9 },
  ]);
  opts.cam.camera.add(card.mesh);
  const say = (text: string) => ctx.captions.say(text);

  const F2 = F.kits;
  /** review: the rest shot's candidate angles [k, front, inFront, postClear, blocked] */
  const restShot = { tried: [] as number[][] };
  const toCrown = new THREE.Vector3(CROWN.x - F.press.x, 0, CROWN.z - F.press.z).normalize();
  /** the finale's view direction: between the book's face (local −z) and the Crown */
  const view = () => new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)).lerp(toCrown, 0.6).normalize();
  const rig: FinaleRig = {
    settled: () => forced || opts.settled(),
    emberInCradle: () => forced || opts.ember.restsAt(F.cradle.x, cy, F.cradle.z, 0.7),
    fox: ctx.fox.root,
    camera: opts.cam.camera,
    canvas: ctx.renderer.domElement,
    snowCover: paintU.uSnow,
    groundH,
    events: {
      kindle: () => {
        ctx.audio.cue('finale-kindle');
        ctx.field.restore(new THREE.Vector3(F.cradle.x, cy, F.cradle.z), 6, 1.4, { edgeMax: 1.2 });
        // the sequence plays wide: rise out behind the ember to frame the Press, the open Album and the Crown the
        // pages fly to; any move/jump/dash after the lock hands the lens straight back
        const cam = opts.cam.camera;
        const look0 = cam.getWorldDirection(new THREE.Vector3()).multiplyScalar(6).add(cam.position);
        const d = view();
        const wide = rig.cradle.clone().addScaledVector(d, -10.5).add(new THREE.Vector3(0, 4.2, 0));
        const aim = rig.cradle.clone().addScaledVector(d, 7).add(new THREE.Vector3(0, 3.2, 0));
        const T = FINALE_TIMING;
        const until = T.warming + T.unbinding + T.open + T.released * 0.7;
        opts.cam.playPath({
          keys: [
            { t: 0, pos: cam.position.clone(), look: look0 },
            { t: 3.2, pos: wide, look: aim },
            { t: until, pos: wide.clone().addScaledVector(d, 1.8).add(new THREE.Vector3(0, 0.5, 0)), look: aim.clone().add(new THREE.Vector3(0, 1.6, 0)) },
          ],
          blendInS: 0.8, blendOutS: 2.5, lockS: 5,
        });
      },
      unbind: () => {
        say('The Scribe pressed the autumn shut');
        // a low wooden give as the screw lets go
        ctx.audio.play('soft-pin', { at: rig.bookTop.clone().setY(base + 4.4), gain: 0.12, rate: 0.6 });
      },
      open: () => {
        ctx.audio.cue('finale-open');
        ctx.audio.play('soft-unfold', { at: rig.bookTop, gain: 0.25, rate: 0.75 });
      },
      release: () => {
        // the year the Album held lets go: the hollow floods with colour and the Crown sheds everything
        ctx.field.restore(new THREE.Vector3(F.press.x, base, F.press.z), 34, 2.2, { edgeMax: 3 });
        opts.crownLetGo();
        for (let i = 0; i < 3; i++) ctx.audio.play('soft-paper', { at: rig.bookTop, gain: 0.12, rate: 0.85 + i * 0.07, delay: i * 0.35 });
        say('so it would never end.');
      },
      onward: (to: THREE.Vector3) => {
        rig.s.onwardLen = rebuildOnward(to);
      },
      homeCaption: () => {
        // a slow look along the way the stream leaves (well → gate → hearth), so the hand-over is seen, not missed;
        // any move after 1.5 s takes the lens back. Wait for a pause in the plaza so catching the page
        // at the ruin cannot spend this reveal before the fox actually comes home.
        const fox = ctx.fox.root.position;
        if (Math.hypot(fox.x - WELL.x, fox.z - WELL.z) > 9 || opts.player.intent() > 0.05) return false;
        say('One page still holds the autumn.');
        ctx.audio.cue('homecoming-onward');
        const cam = opts.cam.camera;
        const look0 = cam.getWorldDirection(new THREE.Vector3()).multiplyScalar(6).add(cam.position);
        const well = new THREE.Vector3(WELL.x, groundH(WELL.x, WELL.z), WELL.z);
        const toward = new THREE.Vector3(HEARTH_A.x, groundH(HEARTH_A.x, HEARTH_A.z) + 1.5, HEARTH_A.z);
        const d = toward.clone().sub(well).setY(0).normalize();
        const pos = well.clone().addScaledVector(d, -5.5).add(new THREE.Vector3(-d.z * 2.5, 3.8, d.x * 2.5));
        opts.cam.playPath({
          keys: [
            { t: 0, pos: cam.position.clone(), look: look0 },
            { t: 2.2, pos, look: well.clone().addScaledVector(d, 7).setY(well.y + 1.2) },
            { t: 5.5, pos: pos.clone().addScaledVector(d, 1.5), look: toward },
          ],
          blendInS: 0.8, blendOutS: 2, lockS: 1.5,
        });
        return true;
      },
      snow: () => {
        ctx.audio.cue('finale-snow');
        say('Let the year turn.');
      },
      card: () => {
        ctx.audio.cue('finale-rest');
        // ease in to a held composition on the family: fox, kits and ember big in front, the open Album and the
        // bare Crown in snow behind, the title over them. It holds (a slow push) until the player moves.
        const cam = opts.cam.camera;
        const look0 = cam.getWorldDirection(new THREE.Vector3()).multiplyScalar(6).add(cam.position);
        const f = ctx.fox.root.position;
        const group = rig.cradle.clone().lerp(new THREE.Vector3(f.x, cy, f.z), 0.45);
        // pick the angle: the fox seen 3/4 from the front (never its back as it lies facing the Press), the Crown
        // behind if possible, and a clear line of sight to the fox
        const fy = ctx.fox.root.rotation.y;
        const post = F.local(0.3, 2.05);
        const aimAt = new THREE.Vector3(f.x, f.y + 0.35, f.z);
        const d = new THREE.Vector3();
        const pos = new THREE.Vector3();
        let bestScore = -Infinity;
        const end = new THREE.Vector3();
        restShot.tried.length = 0;
        for (let k = 0; k < 24; k++) {
          const a = (k / 24) * Math.PI * 2;
          d.set(Math.sin(a), 0, Math.cos(a));
          const front = -(d.x * Math.sin(fy) + d.z * Math.cos(fy));
          pos.copy(group).addScaledVector(d, -3.5).add(new THREE.Vector3(0, 1.3, 0));
          // stay on the approach side of the book's foot (the lens must not pass through the Press) and keep the
          // frame's near post off the line to the fox
          const px = pos.x - F.press.x, pz = pos.z - F.press.z;
          const inFront = Math.sin(F.press.yaw) * px + Math.cos(F.press.yaw) * pz > 2.4;
          const postClear = segDist(pos.x, pos.z, f.x, f.z, post.x, post.z) > 0.75 && Math.hypot(pos.x - post.x, pos.z - post.z) > 2.2;
          const ok = inFront && postClear && !opts.cam.sightBlocked(pos, aimAt, f.y);
          const score = 1.5 * (1 - Math.abs(front - 0.65)) + 0.6 * d.dot(toCrown) - (ok ? 0 : 10);
          restShot.tried.push([k, +front.toFixed(2), inFront ? 1 : 0, postClear ? 1 : 0, opts.cam.sightBlocked(pos, aimAt, f.y) ? 1 : 0]);
          if (score > bestScore) {
            bestScore = score;
            end.copy(pos);
          }
        }
        d.subVectors(group, end).setY(0).normalize();
        const look = group.clone().addScaledVector(d, 2.4).add(new THREE.Vector3(0, 0.7, 0));
        const hold = FINALE_TIMING.cardIn + FINALE_TIMING.cardHold;
        opts.cam.playPath({
          keys: [
            { t: 0, pos: cam.position.clone(), look: look0 },
            { t: 4.5, pos: end, look },
            { t: 90, pos: end.clone().addScaledVector(d, 0.6).add(new THREE.Vector3(0, 0.25, 0)), look: look.clone().add(new THREE.Vector3(0, 0.25, 0)) },
          ],
          blendInS: 0.6, blendOutS: 2.5, lockS: hold,
        });
        opts.onCard?.();
      },
    },
    hinge, screw, wheel, coverMat, paperMat, ironMat, lampPaper, emblemMat, glowMat, light,
    wayMesh, wayLut, wayLen: wayCurve.getLength(),
    onwardMesh, onwardLut, emberAt: new THREE.Vector3(), onwardAt, onwardFrom,
    homeReady: opts.homeReady,
    emberWhere: (out: THREE.Vector3) => opts.ember.where(out),
    pageMeshes, leafMesh, pageSeed, snow, snowMat, kitFoxes, kitPages, card,
    cradle: new THREE.Vector3(F.cradle.x, cy, F.cradle.z),
    bookTop: new THREE.Vector3(local(0.1, 0).x, base + coverY, local(0.1, 0).z),
    toCrown,
    kitLand: new Float32Array(F2.flatMap((k) => [k.land.x, k.land.z])),
    kitCurl: new Float32Array(F2.length * 2),
    kitSlots: new Float32Array(F.slots.flatMap((p) => [p.x, p.z])),
    cover0: new THREE.Color(FROST), cover1: new THREE.Color(COVER), paper0: new THREE.Color(0x9c8e78), paper1: new THREE.Color(PAPER),
    ember: new THREE.Color(0xf08a3a), emblem0: new THREE.Color(0x4a3a30),
    s: { phase: 0, t: 0, clock: 0, snowT: 0, still: 0, settledT: 0, onwardT: 0, onwardLen: 1, homeSaid: 0, restK: 0, lieT: 0, getUpT: -1, card: 0, cardT: 0, kitNear: 99, foxX: 0, foxZ: 0, kindles: 0, cardShows: 0, wheel: 0, leavesOut: 0 },
    player: opts.player, heroLie: hero.lie, heroRest: hero.rest, lieDur: lieClip.duration,
    kitPhase: new Int8Array(F2.length),
    kitT: new Float32Array(F2.length),
    kitX: new Float32Array(F2.length),
    kitZ: new Float32Array(F2.length),
    kitYaw: new Float32Array(F2.length),
  };
  ctx.onUpdate((dt) => updateFinale(rig, dt));

  return {
    /** world points for review lenses */
    cradle: rig.cradle,
    press: new THREE.Vector3(F.press.x, base, F.press.z),
    /** dev: as if the Keeping had settled and the ember were set in the cradle */
    force(): void {
      forced = true;
    },
    state: () => ({
      phase: PHASES[rig.s.phase], t: +rig.s.t.toFixed(2), kindles: rig.s.kindles, cradle: [+rig.cradle.x.toFixed(2), +rig.cradle.z.toFixed(2)],
      kits: Array.from(rig.kitPhase, (k) => KIT_PHASES[k]), card: ['hidden', 'showing', 'done'][rig.s.card], cardShows: rig.s.cardShows,
      kitNear: +rig.s.kitNear.toFixed(2), restShot: restShot.tried, snow: +rig.s.snowT.toFixed(2), leaves: rig.s.leavesOut, onward: rig.onwardMesh.count, still: +rig.s.still.toFixed(2),
    }),
  };
}

export type Finale = Awaited<ReturnType<typeof buildFinale>>;
