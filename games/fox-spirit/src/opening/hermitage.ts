/**
 * The Scribe's Hermitage (DESIGN-hermitage.md): the hanger lane's beeches, the ridge plateau, the tall
 * narrow house where the Album was made, the open-air desk, a broken flower-press, the ink pond and the
 * leaf-stones on the south lip. The drying lines and their pressed leaves live in hermitage.hot.ts.
 */
import * as THREE from 'three';
import { buildMaple, buildRock, hewn, jitter, mapleLeafGeometry, toon, type TreeKind } from '../lookdevKit';
import { buildGrass, buildGround, buildLeaves } from '../lookdevGround';
import type { OpeningCtx } from './scene';
import { pathDist } from './layout';
import { bakeCells, bakeStatic } from './bake';
import { archSlab, box, C, cyl, gable, Kit } from './village';
import { HERMITAGE, NORTH_LANE, northE } from './hermitageLayout';
import { polyDist } from './millbrookLayout';

type Tree = [number, number, number, TreeKind, number];
/** the hanger: tall moss-crowned trees crowding both banks of the climb, one rust beacon at the top */
const HANGER: Tree[] = [
  [-16.6, 106.8, 1.15, 'tall', 4],
  [-8.4, 109.6, 1.05, 'tall', 5],
  [-18.2, 113.0, 1.2, 'tall', 5],
  [-21.0, 116.4, 1.0, 'grove', 4],
  [-16.0, 119.6, 1.1, 'tall', 4],
  [6.2, 119.6, 1.0, 'lean', 5],
  [-13.2, 124.2, 1.05, 'grove', 0],
  [5.6, 127.4, 1.2, 'hero', 2],
  [-15.8, 134.6, 1.1, 'tall', 5],
  [3.4, 137.4, 1.0, 'grove', 4],
  [-10.6, 142.0, 1.15, 'tall', 4],
];

export function buildHermitage(ctx: OpeningCtx) {
  const { scene, groundH, rand, colliders } = ctx;
  const H = HERMITAGE;
  const background: THREE.Object3D[] = [];
  const litter = (x: number, z: number) => {
    let k = 0;
    for (const [tx, tz, sc] of HANGER) k = Math.max(k, 1 - THREE.MathUtils.smoothstep(Math.hypot(x - tx, z - tz), 1.6 * sc, 3.8 * sc));
    return k * (0.75 + 0.25 * Math.sin(x * 1.3 + Math.sin(z * 0.9) * 2));
  };
  const groundCtx = { groundH, pathDist, toon, mapleLeafGeometry, litter };
  // the bowl's sheet ends at z 125.5: this one abuts it
  buildGround(scene, groundCtx, { cx: -8, cz: 139.75, w: 60, d: 28.5, seg: 90 });

  for (const [x, z, sc, kind, pal] of HANGER) {
    const y = groundH(x, z);
    const t = buildMaple(rand, sc, kind, pal, y);
    t.position.set(x, y - 0.1, z);
    t.rotation.y = rand() * 6;
    const baked = bakeStatic([t], 'hanger-tree');
    scene.add(baked);
    ctx.occluders.push(baked);
    colliders.push({ kind: 'post', x, z, r: (kind === 'hero' ? 0.42 : kind === 'lean' ? 0.38 : 0.3) * sc * 1.5 });
  }
  // ridge crowns behind, baked
  for (let i = 0; i < 600 && background.length < 26; i++) {
    const x = -34 + rand() * 50;
    const z = 100 + rand() * 50;
    const e = northE(x, z);
    if (e < 2 || e > 12) continue;
    // keep the plateau's view south over the village open
    if (z < HERMITAGE.plateau.z - 3 && z > 108 && Math.abs(x - HERMITAGE.plateau.x) < 18 && Math.abs(x - HERMITAGE.plateau.x) > 0) {
      if (Math.abs(x - HERMITAGE.plateau.x) < 14 || z > 118) continue;
    }
    if (background.some((t) => Math.hypot(t.position.x - x, t.position.z - z) < 6)) continue;
    const y = groundH(x, z);
    const t = buildMaple(rand, 1.3 + rand() * 0.6, rand() < 0.5 ? 'tall' : 'grove', rand() < 0.7 ? 4 + (i & 1) : i & 3, y, 0.5);
    t.position.set(x, y - 0.1, z);
    t.rotation.y = rand() * 6;
    background.push(t);
  }

  const k = new Kit();
  buildHouse(k, ctx);
  buildDesk(k, ctx);
  buildPress(k, ctx);
  buildStones(k, ctx);
  // boulders on the lane's shoulders (≥ 2.9 m off its centre line, so the climb stays clear)
  for (const [x, z, s] of [[-16.2, 110.7, 0.5], [-10.6, 112.1, 0.4], [-15.4, 118.9, 0.55], [-7.3, 120.5, 0.45]] as const) {
    const r = buildRock(rand, s);
    r.position.set(x, groundH(x, z) + s * 0.25, z);
    background.push(r);
    colliders.push({ kind: 'cap', x, z, r: s * 1.1, base: groundH(x, z), h: s * 0.95 });
  }
  const props = k.build();
  props.name = 'hermitage';
  scene.add(props);
  ctx.occluders.push(props);

  // the ink pond: black water, inked reeds
  const P = H.pond;
  let rimY = Infinity;
  for (let a = 0; a < 6.28; a += 0.5) rimY = Math.min(rimY, groundH(P.x + Math.cos(a) * (P.r + 0.7), P.z + Math.sin(a) * (P.r + 0.7)));
  const pond = new THREE.Mesh(new THREE.CircleGeometry(P.r + 0.3, 28).rotateX(-Math.PI / 2), toon(0x1f2226, { hatchWeight: 0.1 }));
  pond.position.set(P.x, rimY - 0.12, P.z);
  pond.receiveShadow = true;
  scene.add(pond);
  const reeds = new Kit();
  for (let i = 0; i < 16; i++) {
    const a = rand() * 6.28;
    const x = P.x + Math.cos(a) * (P.r + 0.1);
    const z = P.z + Math.sin(a) * (P.r + 0.1);
    const h = 0.6 + rand() * 0.7;
    reeds.add(new THREE.ConeGeometry(0.028, h, 3), i % 3 ? C.timberDark : C.leaf, [x, groundH(x, z) + h / 2, z], [(rand() - 0.5) * 0.4, 0, (rand() - 0.5) * 0.4], 0.006);
  }
  background.push(reeds.build());
  for (const g of bakeCells(background, 30, 'hermitage-far', 3)) scene.add(g);

  const clear = (x: number, z: number, r: number) =>
    pathDist(x, z) > r && Math.hypot(x - H.house.x, z - H.house.z) > 4.2 + r && Math.hypot(x - P.x, z - P.z) > P.r + 0.4 + r;
  buildGrass(scene, rand, groundCtx, { cx: -8, cz: 122, w: 40, d: 44, n: 1400, keep: (x, z) => clear(x, z, 0.6) && northE(x, z) < -rand() * 2 });
  buildLeaves(scene, rand, groundCtx, {
    cx: -9, cz: 120, r: 22, n: 1800,
    drifts: HANGER.map(([x, z, sc]) => [x, z, 1.6 + sc * 1.4] as const),
    keep: (x, z) => clear(x, z, 0.2) && northE(x, z) < 0 && polyDist(NORTH_LANE, x, z).d > 0.6,
  });
}

/** the Scribe's house: tall and narrow, stone footing, plaster under a steep slate roof, a round study window */
function buildHouse(k: Kit, ctx: OpeningCtx): void {
  const { rand, groundH, colliders } = ctx;
  const h = HERMITAGE.house;
  const corners = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => groundH(h.x + (sx * h.w) / 2, h.z + (sz * h.d) / 2)));
  const y0 = Math.min(...corners);
  const { w, d } = h;
  const eave = 4.2;
  const rise = 3.2;
  const wallTop = 0.5 + eave;
  k.at(h.x, y0, h.z, h.yaw, () => {
    k.add(hewn(box(w + 0.5, 1.2, d + 0.5), rand, 0.03), C.stoneDark, [0, -0.1, 0], [0, 0, 0], 0.022);
    k.add(jitter(new THREE.BoxGeometry(w, eave, d, 3, 4, 3), 0.012, rand), C.plaster, [0, 0.5 + eave / 2, 0], [0, 0, 0], 0.016);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.add(box(0.22, eave + 0.1, 0.22), C.timberDark, [(sx * w) / 2, 0.5 + eave / 2, (sz * d) / 2]);
    for (const sz of [-1, 1]) for (const yy of [0.62, 0.5 + eave * 0.5, wallTop - 0.1]) k.add(box(w + 0.12, 0.16, 0.16), C.timberDark, [0, yy, (sz * d) / 2 + 0.03]);
    for (const sx of [-1, 1]) k.at((sx * (w - 0.06)) / 2, wallTop, 0, 0, () => k.add(gable(d + 0.1, rise, 0.14), C.plaster, [0, 0, 0]));
    // steep slate roof, deep eaves
    const over = 0.5;
    const half = d / 2 + over;
    const slope = Math.atan2(rise, d / 2);
    const run = half / Math.cos(slope);
    const ySurf = (t: number) => wallTop + rise - Math.tan(slope) * half * t;
    for (const sz of [-1, 1]) {
      k.add(hewn(new THREE.BoxGeometry(w + over * 2, 0.22, run, 4, 1, 5), rand, 0.012), C.slate, [0, ySurf(0.5) + 0.11, sz * half * 0.5], [sz * slope, 0, 0], 0.024);
      for (const t of [0.2, 0.4, 0.6, 0.8]) k.add(box(w + over * 2 + 0.02, 0.05, 0.1), C.slateDark, [0, ySurf(t) + 0.23, sz * half * t], [sz * slope, 0, 0], 0.01);
    }
    k.add(cyl(0.14, 0.14, w + over * 2 + 0.1, 8, 'x'), C.slateDark, [0, ySurf(0) + 0.24, 0], [0, 0, 0], 0.02);
    // front (+z, south): arched door, the round study window above it, a lantern bracket
    const front = d / 2;
    k.add(archSlab(1.05, 1.95, 0.12), C.timberDark, [0, 0.48, front + 0.05]);
    k.add(archSlab(0.82, 1.78, 0.12), C.door, [0, 0.5, front + 0.1]);
    k.add(cyl(0.62, 0.62, 0.12, 18, 'z'), C.timberDark, [0, 0.5 + eave * 0.72, front + 0.05]);
    k.add(cyl(0.5, 0.5, 0.1, 18, 'z'), C.amber, [0, 0.5 + eave * 0.72, front + 0.08]);
    for (const a of [0, Math.PI / 2]) k.add(box(1.0, 0.06, 0.06), C.timberDark, [0, 0.5 + eave * 0.72, front + 0.15], [0, 0, a]);
    k.add(box(0.5, 0.06, 0.06), C.timberDark, [0.75, 0.5 + 2.3, front + 0.25]);
    k.add(box(0.2, 0.26, 0.2), C.amber, [1.0, 0.5 + 2.08, front + 0.25]);
    // a tall chimney up the east gable and paper stacked in the window boxes
    let yy = 0.3;
    while (yy < wallTop + rise + 0.8) {
      k.add(hewn(box(0.8, 0.45, 0.8), rand, 0.06), rand() < 0.5 ? C.stone : C.stoneDark, [w / 2 + 0.3, yy + 0.22, -d * 0.2], [0, (rand() - 0.5) * 0.2, 0], 0.02);
      yy += 0.42;
    }
    for (const sx of [-1, 1]) {
      k.add(box(0.7, 0.62, 0.06), C.amber, [sx * 1.15, 0.5 + 1.5, front + 0.03]);
      k.add(box(0.86, 0.16, 0.22), C.timberDark, [sx * 1.15, 0.5 + 1.12, front + 0.1]);
      k.add(box(0.6, 0.12, 0.16), C.plaster, [sx * 1.15, 0.5 + 1.26, front + 0.1], [0, 0, 0.05]);
    }
  });
  colliders.push({ kind: 'box', x: h.x, z: h.z, yaw: h.yaw, hx: w / 2 + 0.35, hz: d / 2 + 0.35, top: y0 + wallTop + rise });
}

/** the open-air desk: a slanted writing board on trestles under a little shingle lean-to, ink, quill, paper */
function buildDesk(k: Kit, ctx: OpeningCtx): void {
  const { rand, groundH, colliders } = ctx;
  const D = HERMITAGE.desk;
  const y = groundH(D.x, D.z);
  k.at(D.x, y, D.z, D.yaw, () => {
    for (const sx of [-0.65, 0.65]) for (const sz of [-0.3, 0.3]) k.add(box(0.08, 0.78, 0.08), C.timber, [sx, 0.39, sz]);
    k.add(hewn(box(1.6, 0.06, 0.8), rand, 0.01), C.door, [0, 0.82, 0], [0.12, 0, 0], 0.014);
    // paper stack, an open book, the inkpot and its quill
    for (let i = 0; i < 4; i++) k.add(box(0.42, 0.012, 0.3), C.plaster, [-0.4 + (rand() - 0.5) * 0.04, 0.87 + i * 0.014, -0.02 + (rand() - 0.5) * 0.04], [0.12, (rand() - 0.5) * 0.2, 0], 0.004);
    for (const s of [-1, 1]) k.add(box(0.3, 0.02, 0.36), C.plaster, [0.2 + s * 0.16, 0.88, 0.02], [0.12, 0, s * 0.12], 0.004);
    k.add(cyl(0.06, 0.07, 0.1, 8), C.timberDark, [0.6, 0.9, -0.2]);
    k.add(new THREE.ConeGeometry(0.02, 0.42, 4), C.plaster, [0.63, 1.08, -0.2], [0.3, 0, -0.35], 0.004);
    // lean-to: two posts and a shingle roof sloping off the house
    for (const sx of [-1, 1]) k.add(cyl(0.07, 0.08, 2.4, 6), C.timberDark, [sx * 1.1, 1.2, 0.75]);
    k.add(hewn(new THREE.BoxGeometry(2.8, 0.1, 2.0, 3, 1, 2), rand, 0.01), C.slate, [0, 2.5, 0], [-0.32, 0, 0], 0.018);
    // a stool, pushed back
    k.add(cyl(0.2, 0.2, 0.06, 10), C.timber, [0.1, 0.46, -0.75], [0, 0, 0], 0.01);
    for (let i = 0; i < 3; i++) k.add(cyl(0.025, 0.03, 0.46, 5), C.timberDark, [0.1 + Math.cos(i * 2.1) * 0.14, 0.22, -0.75 + Math.sin(i * 2.1) * 0.14]);
  });
  colliders.push({ kind: 'box', x: D.x, z: D.z, yaw: D.yaw, hx: 0.85, hz: 0.45, top: y + 0.9 });
}

/** a broken flower-press by the door: two boards, the iron screw and its T-handle (the Press's small cousin) */
function buildPress(k: Kit, ctx: OpeningCtx): void {
  const { rand, groundH } = ctx;
  const h = HERMITAGE.house;
  const x = h.x + 2.8;
  const z = h.z - 3.1;
  const y = groundH(x, z);
  k.at(x, y, z, 0.6, () => {
    k.add(hewn(box(0.9, 0.08, 0.9), rand, 0.02), C.timberDark, [0, 0.05, 0], [0, 0, 0], 0.012);
    k.add(hewn(box(0.9, 0.08, 0.9), rand, 0.02), C.timber, [0.25, 0.32, 0.1], [0.5, 0.3, 0.2], 0.012);
    for (let i = 0; i < 3; i++) k.add(box(0.7, 0.01, 0.7), C.plaster, [0, 0.1 + i * 0.012, 0], [0, i * 0.2, 0], 0.003);
    k.add(cyl(0.05, 0.05, 0.8, 8), C.slateDark, [-0.5, 0.12, 0.4], [0, 0, Math.PI / 2 - 0.2], 0.01);
    k.add(cyl(0.035, 0.035, 0.5, 6, 'z'), C.slateDark, [-0.88, 0.18, 0.4], [0, 0, 0], 0.008);
  });
}

/** standing leaf-stones on the plateau's south lip, each with a pressed leaf inked on its face */
function buildStones(k: Kit, ctx: OpeningCtx): void {
  const { rand, groundH, colliders } = ctx;
  const P = HERMITAGE.plateau;
  for (const [x, z] of HERMITAGE.stones) {
    const y = groundH(x, z);
    const yaw = Math.atan2(x - P.x, z - P.z);
    const hgt = 1.3 + rand() * 0.5;
    k.at(x, y, z, yaw, () => {
      k.add(hewn(box(0.7, hgt, 0.26), rand, 0.07), C.stoneField, [0, hgt / 2 - 0.1, 0], [0.04, 0, (rand() - 0.5) * 0.1], 0.022);
      k.add(mapleLeafGeometry(0.11).rotateX(Math.PI / 2), C.timberDark, [0, hgt * 0.6, 0.15], [0, 0, 0], 0.004);
    });
    colliders.push({ kind: 'post', x, z, r: 0.4 });
  }
}
