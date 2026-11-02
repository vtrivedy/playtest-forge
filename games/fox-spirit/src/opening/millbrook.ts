/**
 * Millbrook (DESIGN-millbrook.md): the west valley past the sunken leaf lane. Ground sheet, groves and
 * orchard, the brook bed, the mill with its stopped wheel, footbridge, stepping stones, hay field and
 * the lookout hill. Static scenery is baked (bake.ts) so the bigger world keeps its draw calls; trees
 * the chase camera can meet stay their own occluder roots. The race runtime lives in millrace.hot.ts.
 */
import * as THREE from 'three';
import { buildMaple, buildRock, contactInk, hewn, jitter, mapleLeafGeometry, toon, type TreeKind } from '../lookdevKit';
import { buildGrass, buildGround, buildLeaves } from '../lookdevGround';
import type { OpeningCtx } from './scene';
import { pathDist } from './layout';
import { bakeCells, bakeStatic } from './bake';
import { box, C, cyl, fence, gable, Kit, thatchCourse } from './village';
import { BROOK, brookAt, LANE, MILLBROOK, polyDist, waterY, westE, westFloor } from './millbrookLayout';

type Tree = [number, number, number, TreeKind, number];

/** groves that frame the valley floor (camera-near: occluder roots + trunk colliders) */
const GROVES: Tree[] = [
  // the lane: storm-bent maples leaning over from the banks, a gate pair where it opens on the valley
  [-42.5, 94.6, 1.05, 'lean', 4],
  [-50.5, 85.0, 1.0, 'lean', 1],
  [-58.6, 92.6, 1.15, 'hero', 5],
  [-60.5, 82.6, 0.95, 'grove', 2],
  // valley edges
  [-66, 99.5, 1.1, 'grove', 0],
  [-64.2, 79.2, 1.0, 'grove', 4],
  [-86.5, 100.5, 1.25, 'hero', 1],
  [-91, 94, 1.0, 'grove', 5],
  [-73, 66.5, 1.15, 'tall', 3],
  [-90.5, 63.8, 1.05, 'grove', 4],
  [-84.5, 92.0, 0.9, 'grove', 2],
  [-76.5, 72.0, 0.9, 'lean', 5],
];
/** the orchard: old fruit trees in loose rows on the flat between the brook and the lookout's foot */
const ORCHARD: Array<[number, number]> = [];
for (let row = 0; row < 4; row++) {
  for (let i = 0; i < 4; i++) {
    const x = -96.5 + i * 3.3 + (row % 2) * 1.6;
    const z = 84.5 + row * 3.2;
    if (pathDist(x, z) > 1.9) ORCHARD.push([x, z]);
  }
}

/** terrace walls: contour arcs round the lookout (radius, from angle, to angle) — gaps where paths cross */
const TERRACES: Array<[number, number, number]> = [
  [7.2, -1.0, 1.35],
  [10.2, -1.15, 1.5],
];

export function buildMillbrook(ctx: OpeningCtx) {
  const { scene, groundH, rand, colliders } = ctx;
  const M = MILLBROOK;
  const background: THREE.Object3D[] = [];

  // ground sheet west of the bowl's (which ends at x −64)
  const allTrees: Array<[number, number, number]> = [...GROVES.map(([x, z, s]) => [x, z, s] as [number, number, number]), ...ORCHARD.map(([x, z]) => [x, z, 0.75] as [number, number, number])];
  const litter = (x: number, z: number) => {
    let k = 0;
    for (const [tx, tz, sc] of allTrees) k = Math.max(k, 1 - THREE.MathUtils.smoothstep(Math.hypot(x - tx, z - tz), 1.6 * sc, 3.6 * sc));
    return k * (0.75 + 0.25 * Math.sin(x * 1.3 + Math.sin(z * 0.9) * 2));
  };
  const groundCtx = { groundH, pathDist, toon, mapleLeafGeometry, litter };
  buildGround(scene, groundCtx, { cx: -97, cz: 84, w: 66, d: 88, seg: 140 });

  // trees: near ones are occluders with trunks; the far rim is baked by cell
  const plant = (x: number, z: number, sc: number, kind: TreeKind, pal: number, near: boolean, detail = near ? 1 : 0.5) => {
    const y = groundH(x, z);
    const t = buildMaple(rand, sc, kind, pal, y, detail);
    t.position.set(x, y - 0.1, z);
    t.rotation.y = rand() * 6;
    if (!near) return void background.push(t);
    const baked = bakeStatic([t], 'millbrook-tree');
    scene.add(baked);
    ctx.occluders.push(baked);
    colliders.push({ kind: 'post', x, z, r: (kind === 'hero' ? 0.42 : kind === 'lean' ? 0.38 : 0.3) * sc * 1.5 });
  };
  for (const [x, z, sc, kind, pal] of GROVES) plant(x, z, sc, kind, pal, true);
  ORCHARD.forEach(([x, z], i) => plant(x, z, 0.7 + rand() * 0.15, 'grove', i % 3 === 0 ? 0 : 3 + (i % 3), true, 0.7));
  // the lookout's great maple, set back on the plateau so the view east stays open
  plant(M.lookout.x - 2.4, M.lookout.z - 0.8, 1.55, 'hero', 1, true);
  // rim rows: walk out from the shape's edge and plant on the slope
  for (let i = 0; i < 900 && background.length < 46; i++) {
    const x = -128 + rand() * 92;
    const z = 46 + rand() * 76;
    const e = westE(x, z);
    if (e < 2 || e > 14) continue;
    if (x > -44 && Math.hypot((x + 4) / 40, (z - 83) / 25) < 1.4) continue; // the bowl's own rim
    if (background.some((t) => Math.hypot(t.position.x - x, t.position.z - z) < 6.5)) continue;
    plant(x, z, 1.3 + rand() * 0.6, rand() < 0.35 ? 'tall' : 'grove', rand() < 0.6 ? 4 + (i & 1) : i & 3, false);
  }

  buildBrookBed(ctx, background);
  buildLane(ctx, background);
  const mill = buildMill(ctx);
  buildBridge(ctx);
  buildStones(ctx);
  buildHay(ctx);
  buildLookout(ctx, background);

  for (const g of bakeCells(background, 32, 'millbrook-far', 3)) scene.add(g);

  const clear = (x: number, z: number, r: number) =>
    pathDist(x, z) > r && polyDist(BROOK, x, z).d > 2.3 + r && Math.hypot(x - M.mill.x, z - M.mill.z) > 4.6 + r;
  buildGrass(scene, rand, groundCtx, {
    cx: -80, cz: 84, w: 64, d: 56, n: 2600,
    keep: (x, z) => clear(x, z, 0.6) && westE(x, z) < -rand() * 3 && !inHay(x, z),
  });
  buildLeaves(scene, rand, groundCtx, {
    cx: -80, cz: 84, r: 26, n: 2200,
    drifts: allTrees.map(([x, z, sc]) => [x, z, 1.6 + sc * 1.4] as const),
    keep: (x, z) => clear(x, z, 0.2) && westE(x, z) < 0,
  });
  return { mill };
}

const inHay = (x: number, z: number) => Math.abs(x - MILLBROOK.hay.x) < MILLBROOK.hay.w / 2 && Math.abs(z - MILLBROOK.hay.z) < MILLBROOK.hay.d / 2;

/** pebbles and reeds along the brook's banks (the water itself is millrace.hot.ts) */
function buildBrookBed(ctx: OpeningCtx, background: THREE.Object3D[]): void {
  const { rand, groundH } = ctx;
  const k = new Kit();
  for (let s = 2; s < 64; s += 1.3 + rand() * 1.6) {
    const p = brookAt(s);
    for (const side of [-1, 1]) {
      if (rand() < 0.35) continue;
      const off = 1.7 + rand() * 0.9;
      const x = p.x - p.tz * side * off;
      const z = p.z + p.tx * side * off;
      const r = 0.12 + rand() * 0.22;
      k.add(jitter(new THREE.DodecahedronGeometry(r, 0), 0.2, rand), rand() < 0.5 ? C.stoneField : C.stoneCool, [x, groundH(x, z) + r * 0.3, z], [rand(), rand() * 6, rand()], 0.014, [1.3, 0.6, 1.1]);
      if (rand() < 0.45) {
        // reed clump: a few tall thin blades and a seed head
        for (let j = 0; j < 4; j++) {
          const h = 0.7 + rand() * 0.6;
          k.add(new THREE.ConeGeometry(0.03, h, 3), j % 2 ? C.leaf : C.thatchDark, [x + (rand() - 0.5) * 0.3, groundH(x, z) + h / 2, z + (rand() - 0.5) * 0.3], [(rand() - 0.5) * 0.4, 0, (rand() - 0.5) * 0.4], 0.006);
        }
      }
    }
  }
  background.push(k.build());
}

/** the sunken lane: dry-stone walls along both bank crests, a fallen trunk, a waymark stone at the mouth */
function buildLane(ctx: OpeningCtx, background: THREE.Object3D[]): void {
  const { rand, groundH } = ctx;
  const k = new Kit();
  for (let i = 0; i + 1 < LANE.length; i++) {
    const [ax, az] = LANE[i]!;
    const [bx, bz] = LANE[i + 1]!;
    const len = Math.hypot(bx - ax, bz - az);
    const tx = (bx - ax) / len;
    const tz = (bz - az) / len;
    const yaw = Math.atan2(tx, tz);
    for (const side of [-1, 1]) {
      // the first run leaves the village: walls start once the banks rise
      for (let t = i === 0 ? 5 : 0.3; t < len; t += 0.55) {
        if (rand() < 0.06) { t += 1.2; continue; } // tumbled gaps
        const off = 3.4 + Math.sin(t * 0.4 + i) * 0.25;
        const x = ax + tx * t - tz * side * off;
        const z = az + tz * t + tx * side * off;
        const y = groundH(x, z);
        k.add(hewn(box(0.5, 0.24, 0.46), rand, 0.06), rand() < 0.5 ? C.stoneField : C.stoneDark, [x, y + 0.06, z], [0, yaw + (rand() - 0.5) * 0.15, 0], 0.016);
        k.add(hewn(box(0.44, 0.2, 0.42), rand, 0.06), rand() < 0.5 ? C.stoneDark : C.stoneCool, [x, y + 0.27, z], [0, yaw + (rand() - 0.5) * 0.3, 0], 0.016);
        if (rand() < 0.7) k.add(hewn(box(0.52, 0.09, 0.5), rand, 0.04), C.stoneCool, [x, y + 0.42, z], [0, yaw, (rand() - 0.5) * 0.1], 0.014);
      }
    }
  }
  // a fallen birch along the south bank of the middle run: something to hop on
  const [fx, fz] = [-51.6, 86.9];
  const fy = groundH(fx, fz);
  k.add(jitter(cyl(0.32, 0.38, 5.2, 9, 'x'), 0.05, rand), C.timber, [fx, fy + 0.3, fz], [0, -0.22, 0.03], 0.022);
  for (const [dx, a] of [[-1.4, 0.8], [0.9, -0.6], [2.2, 1.1]] as const) k.add(cyl(0.06, 0.1, 0.9, 6), C.timberDark, [fx + dx, fy + 0.65, fz + 0.1], [a, 0, 0.4], 0.012);
  ctx.colliders.push({ kind: 'box', x: fx, z: fz, yaw: Math.PI / 2 - 0.22, hx: 0.36, hz: 2.6, top: fy + 0.66 });
  // waymark at the lane mouth: a standing stone with the mill wheel scratched on it
  const [wx, wz] = [-62.0, 90.2];
  const wy = groundH(wx, wz);
  k.add(hewn(box(0.55, 1.5, 0.32), rand, 0.06), C.stoneField, [wx, wy + 0.65, wz], [0.05, -0.5, 0.04], 0.022);
  k.add(cyl(0.2, 0.2, 0.05, 10, 'z'), C.stoneDark, [wx - 0.07, wy + 1.0, wz + 0.15], [0, -0.5, 0]);
  ctx.colliders.push({ kind: 'post', x: wx, z: wz, r: 0.4 });
  background.push(k.build());
}

/** the mill: stone storey, timber-and-plaster loft, thatch, a stopped wheel standing in the brook */
function buildMill(ctx: OpeningCtx) {
  const { rand, groundH, scene } = ctx;
  const M = MILLBROOK.mill;
  const W = MILLBROOK.wheel;
  const corners = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => groundH(M.x + sx * 3.2, M.z + sz * 2.5)));
  const y0 = Math.min(...corners);
  const { w, d } = M;
  const stoneH = 1.9;
  const eave = 4.1;
  const rise = 2.3;
  const k = new Kit();
  k.at(M.x, y0, M.z, M.yaw, () => {
    k.add(hewn(box(w + 0.5, 1.4, d + 0.5), rand, 0.03), C.stoneDark, [0, -0.3, 0], [0, 0, 0], 0.022);
    // rubble-stone ground storey, coursed
    for (let c = 0; c < 6; c++) {
      const yy = 0.55 + c * 0.32;
      for (const sz of [-1, 1]) for (let t = -w / 2 + 0.3; t < w / 2; t += 0.7) k.add(hewn(box(0.66, 0.3, 0.16), rand, 0.07), rand() < 0.5 ? C.stone : C.stoneDark, [t + (c % 2) * 0.2, yy, sz * (d / 2 + 0.05)], [0, 0, 0], 0.014);
      for (const sx of [-1, 1]) for (let t = -d / 2 + 0.3; t < d / 2; t += 0.7) k.add(hewn(box(0.16, 0.3, 0.66), rand, 0.07), rand() < 0.5 ? C.stone : C.stoneDark, [sx * (w / 2 + 0.05), yy, t + (c % 2) * 0.2], [0, 0, 0], 0.014);
    }
    k.add(box(w, stoneH, d), C.stoneDark, [0, 0.4 + stoneH / 2, 0]);
    // timber-and-plaster loft
    k.add(jitter(new THREE.BoxGeometry(w + 0.2, eave - stoneH, d + 0.2, 4, 2, 3), 0.01, rand), C.plasterWarm, [0, 0.4 + stoneH + (eave - stoneH) / 2, 0], [0, 0, 0], 0.016);
    const wallTop = 0.4 + eave;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.add(box(0.24, eave - stoneH + 0.2, 0.24), C.timber, [sx * (w / 2 + 0.1), 0.4 + stoneH + (eave - stoneH) / 2, sz * (d / 2 + 0.1)]);
    for (const sz of [-1, 1]) {
      k.add(box(w + 0.4, 0.22, 0.2), C.timber, [0, wallTop - 0.1, sz * (d / 2 + 0.14)]);
      k.add(box(w + 0.4, 0.2, 0.2), C.timber, [0, 0.4 + stoneH + 0.1, sz * (d / 2 + 0.14)]);
      for (const t of [-w / 4, w / 4]) k.add(box(0.14, eave - stoneH, 0.14), C.timber, [t, 0.4 + stoneH + (eave - stoneH) / 2, sz * (d / 2 + 0.16)]);
    }
    for (const sx of [-1, 1]) {
      k.at(sx * (w / 2 + 0.05), wallTop, 0, 0, () => {
        k.add(gable(d + 0.3, rise, 0.16), C.plasterWarm, [0, 0, 0]);
        k.add(box(0.16, rise * 0.85, 0.16), C.timber, [sx * 0.06, rise * 0.42, 0]);
      });
    }
    // loft door + hoist beam on the south gable (−x)
    k.add(box(0.1, 1.3, 1.1), C.door, [-w / 2 - 0.12, wallTop + 0.1, 0]);
    k.add(box(2.0, 0.22, 0.22), C.timberDark, [-w / 2 - 0.8, wallTop + 1.35, 0]);
    k.add(cyl(0.012, 0.012, 1.6, 4), C.rope, [-w / 2 - 1.6, wallTop + 0.55, 0]);
    k.add(cyl(0.24, 0.2, 0.55, 8), C.cloth[0]!, [-w / 2 - 1.6, wallTop - 0.45, 0], [0, 0, 0], 0.014);
    // ground door on the south gable, steps, sacks
    k.add(box(0.14, 1.9, 1.3), C.timberDark, [-w / 2 - 0.1, 1.35, 0.6]);
    k.add(box(0.1, 1.72, 1.1), C.door, [-w / 2 - 0.16, 1.3, 0.6]);
    k.add(hewn(box(0.8, 0.3, 1.6), rand, 0.05), C.stoneField, [-w / 2 - 0.55, 0.2, 0.6], [0, 0, 0], 0.02);
    for (let i = 0; i < 4; i++) k.add(jitter(new THREE.IcosahedronGeometry(0.32, 1), 0.15, rand), C.cloth[i % 2]!, [-w / 2 - 0.7 - (i % 2) * 0.5, 0.45 + Math.floor(i / 2) * 0.45, -1.2 - (i % 3) * 0.3], [0, rand() * 6, 0], 0.014, [1, 0.8, 1.35]);
    // small windows on the long walls
    for (const sz of [-1, 1]) for (const t of [-1.6, 1.4]) {
      k.add(box(0.7, 0.62, 0.06), C.amber, [t, 0.4 + stoneH + 1.0, sz * (d / 2 + 0.2)]);
      k.add(box(0.86, 0.12, 0.16), C.timber, [t, 0.4 + stoneH + 0.64, sz * (d / 2 + 0.24)]);
    }
    // thatch: courses each side of the ridge
    const over = 0.7;
    const half = d / 2 + over;
    const slope = Math.atan2(rise, d / 2);
    const run = half / Math.cos(slope);
    const ySurf = (t: number) => wallTop + rise - Math.tan(slope) * half * t;
    for (const sz of [-1, 1]) {
      const bands = [[0, 0.42], [0.34, 0.72], [0.64, 1]] as const;
      bands.forEach(([t0, t1], c) => {
        const tm = (t0 + t1) / 2;
        k.add(thatchCourse(w + over * 2 - (2 - c) * 0.06, 0.32, run * (t1 - t0), sz, rand), c % 2 ? C.thatchDark : C.thatch, [0, ySurf(tm) + 0.16 + c * 0.07, sz * half * tm], [sz * slope, 0, 0], c === 2 ? 0.022 : 0.016);
      });
    }
    k.add(jitter(cyl(0.38, 0.38, w + over * 2 + 0.15, 10, 'x'), 0.05, rand), C.thatchDark, [0, ySurf(0) + 0.4, 0], [0, 0, 0], 0.024);
    // wheel-side: axle bearing block on the brook wall
    k.add(hewn(box(0.9, 0.9, 0.5), rand, 0.04), C.stone, [0, 0, d / 2 + 0.3], [0, 0, 0], 0.02);
  });
  const house = k.build();
  house.name = 'mill';
  scene.add(house);
  ctx.occluders.push(house);
  ctx.colliders.push({ kind: 'box', x: M.x, z: M.z, yaw: M.yaw, hx: w / 2 + 0.3, hz: d / 2 + 0.3, top: y0 + 0.4 + eave + rise });

  // the wheel: its own group (millrace.hot.ts turns it about local x = across the flow)
  const wheel = new THREE.Group();
  wheel.name = 'mill-wheel';
  const hubY = waterY(W.z) + 1.35;
  wheel.position.set(W.x, hubY, W.z);
  wheel.rotation.y = Math.atan2(W.across.x, W.across.z) - Math.PI / 2;
  const wk = new Kit();
  const R = W.r;
  for (const side of [-0.42, 0.42]) {
    wk.add(new THREE.TorusGeometry(R, 0.08, 6, 28).rotateY(Math.PI / 2), C.timberDark, [side, 0, 0], [0, 0, 0], 0.014);
    for (let i = 0; i < 6; i++) wk.add(box(0.1, R * 2, 0.12), C.timber, [side, 0, 0], [(i / 6) * Math.PI, 0, 0], 0.012);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    wk.add(box(1.0, 0.5, 0.07), C.door, [0, Math.cos(a) * (R - 0.15), Math.sin(a) * (R - 0.15)], [a, 0, 0], 0.012);
  }
  wk.add(cyl(0.2, 0.2, 1.1, 10, 'x'), C.timberDark, [0, 0, 0], [0, 0, 0], 0.014);
  const axleLen = Math.hypot(M.x - W.x, M.z - W.z) - M.d / 2 - 0.2;
  wk.add(cyl(0.1, 0.1, axleLen, 8, 'x'), C.timberDark, [axleLen / 2, 0, 0], [0, 0, 0], 0.012);
  const wheelMesh = wk.build();
  wheel.add(wheelMesh);
  scene.add(wheel);
  ctx.occluders.push(wheel);
  ctx.colliders.push({ kind: 'post', x: W.x, z: W.z, r: 0.75 });
  return { wheel, hubY, top: y0 + 0.4 + eave };
}

/** plank footbridge where the lane crosses the brook: a gentle arch, rails on posts */
function buildBridge(ctx: OpeningCtx): void {
  const { rand, groundH, scene } = ctx;
  const B = MILLBROOK.bridge;
  const yaw = Math.atan2(-B.tz, B.tx); // local z across the brook
  const len = 5.4;
  const y0 = Math.max(groundH(B.x - B.tz * 2.7, B.z + B.tx * 2.7), groundH(B.x + B.tz * 2.7, B.z - B.tx * 2.7));
  const deck = Math.max(y0 + 0.25, waterY(B.z) + 0.6);
  const k = new Kit();
  k.at(B.x, 0, B.z, yaw, () => {
    for (let i = 0; i < 11; i++) {
      const t = (i + 0.5) / 11 - 0.5;
      const yy = deck + (1 - 4 * t * t) * 0.18;
      k.add(hewn(box(1.5, 0.1, len / 11 - 0.04), rand, 0.02), i % 2 ? C.timber : C.door, [0, yy, t * len], [Math.atan(-8 * t * 0.18 / len), (rand() - 0.5) * 0.04, 0], 0.012);
    }
    for (const s of [-1, 1]) {
      k.add(box(0.12, 0.2, len + 0.4), C.timberDark, [s * 0.7, deck - 0.12, 0]);
      for (const t of [-0.5, -0.17, 0.17, 0.5]) k.add(cyl(0.06, 0.07, 1.0, 6), C.timber, [s * 0.78, deck + 0.4 + (1 - 4 * t * t) * 0.18, t * len], [0, 0, 0], 0.012);
      k.add(jitter(new THREE.BoxGeometry(0.08, 0.08, len, 1, 1, 4), 0.02, rand), C.timberDark, [s * 0.78, deck + 0.85, 0], [0, 0, 0], 0.012);
    }
  });
  const g = k.build();
  g.name = 'footbridge';
  scene.add(g);
  ctx.occluders.push(g);
  ctx.colliders.push({ kind: 'box', x: B.x, z: B.z, yaw, hx: 0.75, hz: len / 2, top: deck + 0.12 });
  for (const s of [-1, 1]) ctx.colliders.push({ kind: 'box', x: B.x + Math.cos(yaw) * s * 0.82, z: B.z - Math.sin(yaw) * s * 0.82, yaw, hx: 0.06, hz: len / 2, top: deck + 1.0 });
}

/** stepping stones across the brook south of the bridge (a hop line; slip and you wade out) */
function buildStones(ctx: OpeningCtx): void {
  const { rand, scene } = ctx;
  const S = MILLBROOK.stones;
  const nx = -S.tz;
  const nz = S.tx;
  const top = waterY(S.z) + 0.22;
  for (const [o, r] of [[-1.55, 0.55], [-0.35, 0.5], [0.85, 0.52]] as const) {
    const x = S.x + nx * o + S.tx * (rand() - 0.5) * 0.3;
    const z = S.z + nz * o + S.tz * (rand() - 0.5) * 0.3;
    const rock = buildRock(rand, r, true);
    rock.scale.set(1, 0.75, 1);
    rock.position.set(x, top - r * 0.5, z);
    scene.add(rock);
    scene.add(contactInk(rock, () => waterY(z)));
    ctx.colliders.push({ kind: 'cap', x, z, r: r * 1.05, base: top - 0.35, h: 0.35 });
  }
}

/** the hay field: stooks in rows inside a split-rail fence, a wain with its shafts down */
function buildHay(ctx: OpeningCtx): void {
  const { rand, groundH, scene } = ctx;
  const H = MILLBROOK.hay;
  const k = new Kit();
  const stook = (x: number, z: number) => {
    const y = groundH(x, z);
    const s = 0.85 + rand() * 0.3;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + rand() * 0.3;
      k.add(cyl(0.1 * s, 0.2 * s, 1.15 * s, 6), i % 2 ? C.thatch : C.thatchDark, [x + Math.cos(a) * 0.2 * s, y + 0.5 * s, z + Math.sin(a) * 0.2 * s], [Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25], 0.012);
    }
    k.add(new THREE.ConeGeometry(0.38 * s, 0.55 * s, 7), C.thatch, [x, y + 1.2 * s, z], [0, rand(), 0], 0.014);
    k.add(cyl(0.3 * s, 0.3 * s, 0.08, 8), C.rope, [x, y + 0.8 * s, z]);
    ctx.colliders.push({ kind: 'cap', x, z, r: 0.42 * s, base: y, h: 1.3 * s });
  };
  for (let row = 0; row < 3; row++) for (let i = 0; i < 4; i++) {
    const x = H.x - H.w / 2 + 1.8 + i * 2.6 + (row % 2) * 1.1 + (rand() - 0.5) * 0.5;
    const z = H.z - H.d / 2 + 2 + row * 3 + (rand() - 0.5) * 0.5;
    if (pathDist(x, z) > 1.6) stook(x, z);
  }
  // stubble rows: low tan stripes across the field
  for (let row = 0; row < 9; row++) {
    const z = H.z - H.d / 2 + 0.6 + row * 1.1;
    for (let x = H.x - H.w / 2 + 0.4; x < H.x + H.w / 2 - 0.4; x += 0.55) {
      if (pathDist(x, z) < 1.3) continue;
      k.add(new THREE.ConeGeometry(0.06, 0.16, 3), C.thatchDark, [x + (rand() - 0.5) * 0.2, groundH(x, z) + 0.06, z], [0, rand() * 3, 0], 0.004, [1, 1, 3]);
    }
  }
  // split-rail fence on the east and south sides (west is the brook, north the path)
  const fences: Array<[number, number, number, number]> = [
    [H.x + H.w / 2, H.z - H.d / 2, H.x + H.w / 2, H.z + H.d / 2 - 1],
    [H.x - H.w / 2 + 1, H.z - H.d / 2, H.x + H.w / 2, H.z - H.d / 2],
  ];
  for (const [ax, az, bx, bz] of fences) ctx.colliders.push({ kind: 'box', ...fence(k, ctx, ax, az, bx, bz) });
  // the hay wain, tipped onto its shafts by the field gate, half loaded
  const [cx, cz] = [H.x + H.w / 2 + 2.2, H.z + H.d / 2 - 0.4];
  k.at(cx, groundH(cx, cz), cz, 0.4, () => {
    k.add(hewn(box(1.6, 0.14, 2.6), rand, 0.02), C.timber, [0, 0.82, 0], [0.1, 0, 0], 0.016);
    for (const s of [-1, 1]) {
      k.add(box(0.08, 0.5, 2.6), C.timberDark, [s * 0.8, 1.08, 0], [0.1, 0, 0]);
      for (const zz of [-0.8, 0.8]) {
        k.add(cyl(0.55, 0.55, 0.12, 14, 'x'), C.timber, [s * 0.9, 0.55, zz], [0, 0, 0], 0.016);
        k.add(cyl(0.13, 0.13, 0.16, 8, 'x'), C.timberDark, [s * 0.92, 0.55, zz]);
      }
      k.add(box(0.08, 0.08, 1.8), C.timber, [s * 0.45, 0.35, -1.9], [-0.35, 0, 0]);
    }
    k.add(jitter(new THREE.IcosahedronGeometry(0.9, 1), 0.18, rand), C.thatch, [0, 1.35, 0.25], [0, 0, 0], 0.018, [0.85, 0.55, 1.25]);
  });
  ctx.colliders.push({ kind: 'box', x: cx, z: cz, yaw: 0.4, hx: 1.0, hz: 1.5, top: groundH(cx, cz) + 1.6 });
  const g = k.build();
  g.name = 'hay-field';
  scene.add(g);
  ctx.occluders.push(g);
}

/** the lookout: terrace walls on the climb, a cairn and a stone seat facing back east over the world */
function buildLookout(ctx: OpeningCtx, background: THREE.Object3D[]): void {
  const { rand, groundH } = ctx;
  const L = MILLBROOK.lookout;
  const k = new Kit();
  for (const [r, a0, a1] of TERRACES) {
    const n = Math.round(((a1 - a0) * r) / 0.55);
    let run: Array<[number, number]> = [];
    const flush = () => {
      if (run.length > 2) {
        const [ax, az] = run[0]!;
        const [bx, bz] = run[run.length - 1]!;
        const len = Math.hypot(bx - ax, bz - az);
        const mx = (ax + bx) / 2;
        const mz = (az + bz) / 2;
        ctx.colliders.push({ kind: 'box', x: mx, z: mz, yaw: Math.atan2(bx - ax, bz - az), hx: 0.3, hz: len / 2, top: groundH(mx, mz) + 0.48 });
      }
      run = [];
    };
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      const x = L.x + Math.cos(a) * r;
      const z = L.z + Math.sin(a) * r;
      if (pathDist(x, z) < 1.4) { flush(); continue; }
      const y = groundH(x, z);
      const yaw = -a;
      k.add(hewn(box(0.48, 0.26, 0.5), rand, 0.06), rand() < 0.5 ? C.stoneField : C.stoneDark, [x, y + 0.08, z], [0, yaw, 0], 0.016);
      k.add(hewn(box(0.44, 0.22, 0.46), rand, 0.06), rand() < 0.5 ? C.stoneCool : C.stone, [x, y + 0.32, z], [0, yaw + 0.3, 0], 0.016);
      run.push([x, z]);
      if (run.length >= 6) { flush(); run.push([x, z]); }
    }
    flush();
  }
  // plateau: cairn, the seat (a long slab on two stones), a few asters
  const top = westFloor(L.z) + L.rise;
  const seat = { x: L.x + 1.6, z: L.z + 1.2 };
  const sy = groundH(seat.x, seat.z);
  const yaw = Math.atan2(1, 0.15); // faces east
  k.at(seat.x, sy, seat.z, yaw, () => {
    for (const s of [-1, 1]) k.add(hewn(box(0.4, 0.42, 0.4), rand, 0.06), C.stoneDark, [s * 0.7, 0.2, 0], [0, rand(), 0], 0.018);
    k.add(hewn(box(2.0, 0.16, 0.6), rand, 0.03), C.stone, [0, 0.48, 0], [0, 0, 0], 0.02);
  });
  ctx.colliders.push({ kind: 'box', x: seat.x, z: seat.z, yaw: yaw + Math.PI / 2, hx: 0.32, hz: 1.0, top: sy + 0.56 });
  let cy = groundH(L.x - 0.6, L.z + 2.6);
  let sz = 0.5;
  for (let i = 0; i < 5; i++) {
    k.add(jitter(new THREE.DodecahedronGeometry(sz, 0), 0.15, rand), i % 2 ? C.stoneField : C.stoneCool, [L.x - 0.6, cy + sz * 0.45, L.z + 2.6], [rand(), rand() * 6, rand()], 0.016, [1.2, 0.6, 1.1]);
    cy += sz * 0.8;
    sz *= 0.75;
  }
  ctx.colliders.push({ kind: 'cap', x: L.x - 0.6, z: L.z + 2.6, r: 0.6, base: top - 0.5, h: cy - top + 0.5 });
  for (let i = 0; i < 26; i++) {
    const a = rand() * 6.28;
    const r = 1 + rand() * L.r;
    const x = L.x + Math.cos(a) * r;
    const z = L.z + Math.sin(a) * r;
    const y = groundH(x, z);
    k.add(cyl(0.012, 0.012, 0.32, 3), C.leaf, [x, y + 0.16, z]);
    k.add(new THREE.IcosahedronGeometry(0.055, 0), i % 3 ? C.bloom[2]! : C.bloom[1]!, [x, y + 0.34, z], [0, 0, 0], 0.004);
  }
  background.push(k.build());
}
