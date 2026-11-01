/**
 * Arrival Meadow (DESIGN-opening-meadow.md): the slice ground, the H-a rock shelf at the foot of a
 * stratified cliff ridge, framing groves, boulders with ink contact lines, grass and leaf litter.
 * The village (village.ts) sits on this ground; everything here is kit toon + paint patch + ink hull.
 */
import * as THREE from 'three';
import { buildDistance, buildMaple, buildRock, contactInk, hewn, inked, mapleLeafGeometry, toon, type TreeKind } from '../lookdevKit';
import { buildGrass, buildGround, buildLeaves } from '../lookdevGround';
import type { OpeningCtx } from './scene';
import { BOUNDS, HEARTH_A, HOUSES, inVista, JOGS, pathDist, rimK, SHELF, WELL } from './layout';

/** Stone strata, base → cap: warm grey-ochre bands so the shelf reads as layered rock, not a crate */
const STRATA = [0x6e5c4c, 0x8a7560, 0x7a6754, 0x93806a];
const MOSS = 0x5e5c3a;

/** Groves [x, z, scale, kind, palette]; palette ≥ 4 = moss/olive (kit CANOPY_MOSS), kept behind the fox's read line */
const TREES: Array<[number, number, number, TreeKind, number]> = [
  // west grove framing the route out of the plaza
  [-12.5, 72.5, 1.25, 'hero', 4],
  [-16, 77, 1.0, 'grove', 2],
  [-10.5, 66.5, 1.05, 'grove', 5],
  [-18, 68.5, 1.15, 'lean', 0],
  [-19.2, 70.6, 1.1, 'grove', 3], // stands back from the pop-up ruin's entry so the chase cam there isn't inside its crown
  // south, past the hearth: the backdrop as the fox runs down the meadow
  [4.5, 63.5, 1.2, 'tall', 4],
  [-7.5, 61.5, 1.1, 'grove', 1],
  [10, 62.5, 1.0, 'grove', 5],
  [0.5, 59, 1.3, 'grove', 3],
  // east: rust crowns off-axis, beyond the shelf
  [33, 85, 1.3, 'hero', 0],
  [24.5, 87.5, 1.05, 'grove', 2],
  [18.5, 90.5, 0.95, 'grove', 5],
  // between the village and the meadow
  [8, 81.5, 0.9, 'grove', 4],
  [-23, 92, 1.0, 'grove', 1],
  [-31, 79, 1.2, 'tall', 5],
  [3, 101.5, 1.1, 'grove', 3],
  [-15, 101, 1.0, 'lean', 4],
  [-33, 93, 1.05, 'grove', 0],
];

/** Boulders [x, z, size]: pairs/trios at grove feet, one marker by the hearth apron */
const ROCKS: Array<[number, number, number]> = [
  [-11, 74.5, 0.65],
  [-14.3, 70.2, 0.95],
  [-9.2, 68.8, 0.45],
  [2.4, 70.5, 0.75],
  [3.6, 69.3, 0.45],
  [8.2, 71, 0.55],
  [19.5, 69.5, 1.1],
  [6.2, 84.5, 0.5],
  [-20, 80.5, 0.7],
  [11.5, 87, 0.6],
];

/**
 * A stone column: a 6–7-sided tapered prism stacked from 1.3–2.2 m drums, each drum a strata tone,
 * a little turned and offset from the one below. Many columns side by side read as a jointed rock
 * outcrop (chunky, Arceus-style), never a building. `moss` caps the top with a turf drum whose top is y1.
 */
export function column(rand: () => number, x: number, z: number, r: number, y0: number, y1: number, moss: boolean): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const sides = rand() < 0.5 ? 6 : 7;
  const stoneTop = moss ? y1 - 0.3 : y1;
  // uneven drum heights: joints never line up across neighbouring columns
  const cuts: number[] = [];
  for (let y = y0; y < stoneTop - 0.6; ) cuts.push((y += 1.1 + rand() * 1.3));
  const joints = [y0, ...cuts.filter((y) => y < stoneTop - 0.6), stoneTop];
  const spin = rand() * Math.PI;
  for (let i = 0; i < joints.length - 1; i++) {
    const a = joints[i]!;
    const b = joints[i + 1]!;
    const k = (a - y0) / Math.max(1, stoneTop - y0);
    const rr = r * (1 - k * 0.14) * (0.95 + rand() * 0.1);
    // bare columns weather to a chamfered crown so the ridge line breaks instead of stepping like a wall
    const crown = !moss && i === joints.length - 2 ? 0.55 + rand() * 0.2 : 0.94;
    const geo = hewn(new THREE.CylinderGeometry(rr * crown, rr, b - a - 0.04, sides, 1), rand, 0.07);
    const tone = new THREE.Color(STRATA[(i + Math.floor(x * 3 + z)) & 3]!).multiplyScalar(0.88 + rand() * 0.2);
    const m = inked(geo, toon(tone, { contour: 0.5 }), 0.028, true);
    m.position.set((rand() - 0.5) * 0.24, (a + b) / 2, (rand() - 0.5) * 0.24);
    m.rotation.y = spin + (rand() - 0.5) * 0.4;
    g.add(m);
  }
  if (moss) {
    const rr = r * 0.86 * 1.04;
    const cap = inked(hewn(new THREE.CylinderGeometry(rr, rr * 0.97, 0.36, sides, 1), rand, 0.03), toon(MOSS, { hatchWeight: 0.4 }), 0.024, true);
    cap.position.y = y1 - 0.18;
    cap.rotation.y = spin;
    g.add(cap);
  }
  return g;
}

/** Register a column (one fade unit) with the chase-cam occlusion */
function occluder<T extends THREE.Object3D>(ctx: OpeningCtx, o: T): T {
  ctx.occluders.push(o);
  return o;
}

/**
 * H-a, the cold hearth: a two-step stone plinth carrying a ring of seven fire-blackened bowl stones
 * (rim ≈ ground + 1, around the reactor's ash bed at +0.92). It blocks like a low wall; the fox lights it
 * from beside it and rides the column from there.
 */
function buildHearth(ctx: OpeningCtx): void {
  const { scene, groundH, rand, colliders } = ctx;
  const y = groundH(HEARTH_A.x, HEARTH_A.z);
  const g = new THREE.Group();
  g.position.set(HEARTH_A.x, y, HEARTH_A.z);
  scene.add(g);
  // the bowl sits right where a dash stops: fade it like a cottage when it blocks the chase cam
  ctx.occluders.push(g);
  const plinth = [
    [2.0, 0.34, -0.06, 0x7e7465],
    [1.5, 0.28, 0.28, 0x8e8577],
  ] as const;
  for (const [w, h, y0, tone] of plinth) {
    const m = inked(hewn(new THREE.BoxGeometry(w, h, w, 2, 1, 2), rand, 0.05), toon(tone, { contour: 0.5 }), 0.022, true);
    m.position.y = y0 + h / 2;
    m.rotation.y = rand() * 0.5;
    g.add(m);
  }
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 + 0.05;
    const a1 = ((i + 1) / n) * Math.PI * 2 - 0.05;
    const s = new THREE.Shape();
    s.absarc(0, 0, 1.0, a0, a1, false);
    s.absarc(0, 0, 0.66, a1, a0, true);
    s.closePath();
    const h = 0.5 + rand() * 0.14;
    const geo = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 3 });
    geo.rotateX(-Math.PI / 2);
    const stone = inked(hewn(geo, rand, 0.03), toon(new THREE.Color(0x5a4f46).multiplyScalar(0.85 + rand() * 0.25), { contour: 0.5 }), 0.022, true);
    stone.position.y = 0.5;
    g.add(stone);
  }
  colliders.push({ kind: 'cap', x: HEARTH_A.x, z: HEARTH_A.z, r: 1.05, base: y, h: 1.05 });
}

/**
 * The H-a shelf and the cliff ridge it steps up into. Shelf-local frame (x east, z south, yaw SHELF.yaw);
 * the shelf top is exactly ground + SHELF.rise (the updraft's landing), the ridge blocks climb behind it.
 */
function buildShelf(ctx: OpeningCtx): void {
  const { scene, groundH, rand, colliders } = ctx;
  const g0 = groundH(SHELF.x, SHELF.z);
  const top = g0 + SHELF.rise;
  const root = new THREE.Group();
  root.position.set(SHELF.x, 0, SHELF.z);
  root.rotation.y = SHELF.yaw;
  scene.add(root);
  const c = Math.cos(SHELF.yaw);
  const s = Math.sin(SHELF.yaw);
  const world = (lx: number, lz: number) => [SHELF.x + lx * c + lz * s, SHELF.z - lx * s + lz * c] as const;

  const hw = SHELF.w / 2;
  const hd = SHELF.d / 2;
  // shelf: a 3 × 3 cluster of moss-capped columns whose turf is the walk surface (box collider)
  for (const lx of [-3, 0, 3]) {
    for (const lz of [-3, 0, 3]) {
      const edge = Math.abs(lx) + Math.abs(lz) > 0;
      root.add(occluder(ctx, column(rand, lx + (rand() - 0.5) * 0.4, lz + (rand() - 0.5) * 0.4, edge ? 2.25 : 2.0, g0 - 2, top, true)));
    }
  }
  colliders.push({ kind: 'box', x: SHELF.x, z: SHELF.z, yaw: SHELF.yaw, hx: hw, hz: hd, top });
  // the ridge: the shelf is its lowest step; taller columns climb behind it (east) and wrap south,
  // away from the village so it backs the glide without walling the meadow (+lz faces the village).
  // [lx, lz, r, height above g0] — blockers only, never a climb route
  const RIDGE: Array<[number, number, number, number]> = [
    [hw + 2.2, -3.2, 2.4, 7.4], [hw + 2.6, 1.2, 2.6, 8.3], [hw + 2.0, 5.0, 2.2, 6.4],
    [hw + 4.6, -1.0, 2.0, 9.4],
    [hw + 1.2, -hd - 2.2, 2.3, 6.6], [-1.5, -hd - 2.0, 2.3, 5.6],
  ];
  for (const [lx, lz, r, h] of RIDGE) {
    root.add(occluder(ctx, column(rand, lx, lz, r, g0 - 2, g0 + h + (h > 8 ? 1 : 0), h < 8.5 && rand() < 0.6)));
    const [wx, wz] = world(lx, lz);
    colliders.push({ kind: 'post', x: wx, z: wz, r: r * 0.95 });
  }
  // talus at the cliff feet (north and south faces; the west face toward the hearth stays clean)
  for (const [lx, lz, sz] of [[-2.6, -hd - 1.3, 0.7], [-0.8, -hd - 1.9, 0.45], [-6.2, hd + 1.2, 0.8], [-6.9, hd + 2.6, 0.5]] as const) {
    const [rx, rz] = world(lx, lz);
    const r = buildRock(rand, sz);
    r.position.set(rx, groundH(rx, rz) + sz * 0.2, rz);
    scene.add(r);
    scene.add(contactInk(r, groundH));
    colliders.push({ kind: 'cap', x: rx, z: rz, r: sz * 1.1, base: groundH(rx, rz), h: sz * 0.95 });
  }

  // the beacon: one olive maple on the far corner of the shelf, visible from the well
  const [tx, tz] = world(hw - 1.6, -hd + 1.7);
  const beacon = buildMaple(rand, 1.05, 'hero', 4, top);
  beacon.position.set(tx, top - 0.1, tz);
  beacon.rotation.y = 2.2;
  scene.add(beacon);
  ctx.occluders.push(beacon);
  colliders.push({ kind: 'post', x: tx, z: tz, r: 0.45 * 1.05 * 1.5 });
  // a boulder pair on the shelf so the landing has a foreground
  for (const [lx, lz, sz] of [[hw - 1.2, hd - 1.4, 0.55], [hw - 2.3, hd - 0.9, 0.35]] as const) {
    const [rx, rz] = world(lx, lz);
    const r = buildRock(rand, sz);
    r.position.set(rx, top + sz * 0.2, rz);
    scene.add(r);
    colliders.push({ kind: 'cap', x: rx, z: rz, r: sz * 1.1, base: top, h: sz * 0.95 });
  }
}

export function buildMeadow(ctx: OpeningCtx): void {
  const { scene, groundH, rand, colliders } = ctx;
  // umber litter pools under the crowns (no global pattern: it read as leopard spots on the rim)
  const litter = (x: number, z: number) => {
    let k = 0;
    for (const [tx, tz, sc] of TREES) k = Math.max(k, 1 - THREE.MathUtils.smoothstep(Math.hypot(x - tx, z - tz), 1.6 * sc, 3.6 * sc));
    return k * (0.75 + 0.25 * Math.sin(x * 1.3 + Math.sin(z * 0.9) * 2));
  };
  const groundCtx = { groundH, pathDist, toon, mapleLeafGeometry, litter };
  buildGround(scene, groundCtx, { cx: BOUNDS.cx, cz: BOUNDS.cz, w: BOUNDS.rx * 3, d: BOUNDS.rz * 3.4, seg: 170 });

  buildShelf(ctx);
  buildHearth(ctx);

  // nothing grows on lanes, house pads, the well plaza or the hearth apron
  const clear = (x: number, z: number, r: number) =>
    pathDist(x, z) > r &&
    Math.hypot(x - WELL.x, z - WELL.z) > 4 + r &&
    Math.hypot(x - HEARTH_A.x, z - HEARTH_A.z) > 2.5 + r &&
    HOUSES.every((h) => Math.max(Math.abs(x - h.x) - h.w / 2, Math.abs(z - h.z) - h.d / 2) > r);
  // the rim: a ring of big crowns on the bowl's lip closes the slice (no colliders: the slope blocks)
  const RIM_N = 16;
  for (let i = 0; i < RIM_N; i++) {
    const a = (i / RIM_N) * Math.PI * 2 + rand() * 0.25;
    const k = 1.06 + rand() * 0.14;
    const x = BOUNDS.cx + Math.cos(a) * BOUNDS.rx * k;
    const z = BOUNDS.cz + Math.sin(a) * BOUNDS.rz * k;
    if (inVista(x, z, 3)) continue;
    const y = groundH(x, z);
    const t = buildMaple(rand, 1.4 + rand() * 0.5, rand() < 0.4 ? 'tall' : 'grove', rand() < 0.6 ? 4 + (i & 1) : i & 3, y);
    t.position.set(x, y - 0.1, z);
    t.rotation.y = rand() * 6;
    scene.add(t);
  }
  // a second, deeper row of crowns up the slope, offset between the first
  for (let i = 0; i < RIM_N; i++) {
    const a = ((i + 0.5) / RIM_N) * Math.PI * 2 + (rand() - 0.5) * 0.15;
    const k2 = 1.32 + rand() * 0.18;
    const x2 = BOUNDS.cx + Math.cos(a) * BOUNDS.rx * k2;
    const z2 = BOUNDS.cz + Math.sin(a) * BOUNDS.rz * k2;
    if (inVista(x2, z2, 3)) continue;
    const y2 = groundH(x2, z2);
    const t = buildMaple(rand, 1.6 + rand() * 0.5, 'grove', 4 + (i & 1), y2);
    t.position.set(x2, y2 - 0.1, z2);
    t.rotation.y = rand() * 6;
    scene.add(t);
  }
  for (const [x, z, sc, kind, pal] of TREES) {
    const y = groundH(x, z);
    const t = buildMaple(rand, sc, kind, pal, y);
    t.position.set(x, y - 0.1, z);
    t.rotation.y = rand() * 6;
    scene.add(t);
    ctx.occluders.push(t);
    colliders.push({ kind: 'post', x, z, r: (kind === 'hero' ? 0.42 : kind === 'lean' ? 0.38 : 0.3) * sc * 1.5 });
  }
  for (const [x, z, s] of ROCKS) {
    const r = buildRock(rand, s);
    r.position.set(x, groundH(x, z) + s * 0.25, z);
    scene.add(r);
    colliders.push({ kind: 'cap', x, z, r: s * 1.1, base: groundH(x, z), h: s * 0.95 });
    scene.add(contactInk(r, (px, pz) => groundH(px, pz)));
  }

  // tufts over the play ellipse, thinning toward the rim; litter drifts under every crown
  buildGrass(scene, rand, groundCtx, {
    cx: BOUNDS.cx, cz: BOUNDS.cz, w: BOUNDS.rx * 2, d: BOUNDS.rz * 2, n: 2600,
    keep: (x, z) => clear(x, z, 0.6) && rimK(x, z) < 1 - rand() * 0.15,
  });
  buildLeaves(scene, rand, groundCtx, {
    cx: BOUNDS.cx, cz: BOUNDS.cz, r: 30, n: 2600,
    drifts: TREES.map(([x, z, sc]) => [x, z, 1.6 + sc * 1.4] as const),
    keep: (x, z) => clear(x, z, 0.2),
  });
  buildJogs(ctx, groundCtx, clear);
  // no ridge in the vista gap past the far crag: the Crown is framed there
  buildDistance(scene, rand, {
    cx: BOUNDS.cx, cz: BOUNDS.cz, dir: -Math.PI / 2, arc: Math.PI * 1.9, count: 16, y: 2,
    keep: (x, z) => !inVista(x, z, 18),
  });
}

/**
 * The jogs (DESIGN-jogs.md): waymark cairns at the bends of the canopy → ruin leg, each topped by a
 * finger-stone laid toward the next bend, and a wind-combed leaf ribbon along the line's shoulder.
 */
function buildJogs(ctx: OpeningCtx, groundCtx: Parameters<typeof buildLeaves>[2], clear: (x: number, z: number, r: number) => boolean): void {
  const { scene, groundH, rand, colliders } = ctx;
  for (const c of JOGS.cairns) {
    const y0 = groundH(c.x, c.z);
    let y = y0;
    // field stones of uneven size and thickness, each smaller and askew on the one below
    let sz = 0.4 + rand() * 0.12;
    const n = 3 + Math.floor(rand() * 2);
    for (let k = 0; k < n; k++) {
      const flat = 0.5 + rand() * 0.35;
      const r = buildRock(rand, sz, k === 0);
      r.scale.set(1.05 + rand() * 0.25, flat, 0.9 + rand() * 0.25);
      r.rotation.z = (rand() - 0.5) * 0.3;
      y += sz * 0.58 * flat;
      r.position.set(c.x + (rand() - 0.5) * 0.12, y, c.z + (rand() - 0.5) * 0.12);
      y += sz * 0.55 * flat;
      scene.add(r);
      sz *= 0.6 + rand() * 0.3;
    }
    // the finger-stone: a long hewn slab on the cap, its point toward the next bend, a little raised
    const yaw = Math.atan2(c.to.x - c.x, c.to.z - c.z);
    const finger = inked(hewn(new THREE.BoxGeometry(0.24, 0.12, 1.0, 1, 1, 4), rand, 0.03), toon(0x9c8a70, { contour: 0.5 }), 0.02, true);
    const pos = finger.geometry.getAttribute('position') as THREE.BufferAttribute;
    // taper to a point at +z
    for (let i = 0; i < pos.count; i++) {
      const k = THREE.MathUtils.smoothstep(pos.getZ(i), -0.1, 0.5);
      pos.setX(i, pos.getX(i) * (1 - 0.75 * k));
      pos.setY(i, pos.getY(i) * (1 - 0.4 * k));
    }
    pos.needsUpdate = true;
    finger.geometry.computeVertexNormals();
    finger.position.set(c.x, y - 0.02, c.z);
    finger.rotation.set(0, yaw, 0);
    finger.rotateX(-0.12);
    scene.add(finger);
    colliders.push({ kind: 'cap', x: c.x, z: c.z, r: 0.42, base: y0, h: y - y0 });
  }
  // the ribbon: drift centres along the line, set off to its shoulder and swung side to side like windrows
  const drifts: Array<readonly [number, number, number]> = [];
  const L = JOGS.line;
  for (let i = 0; i + 1 < L.length; i++) {
    const [ax, az] = L[i]!;
    const [bx, bz] = L[i + 1]!;
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.ceil(len / 1.1);
    for (let j = 0; j < n; j++) {
      const u = j / n;
      const side = 1.05 + 0.35 * Math.sin((i * n + j) * 1.7);
      drifts.push([ax + (bx - ax) * u + ((bz - az) / len) * side, az + (bz - az) * u - ((bx - ax) / len) * side, 0.55 + 0.25 * rand()] as const);
    }
  }
  const near = (x: number, z: number) => drifts.some(([dx, dz, dr]) => Math.hypot(x - dx, z - dz) < dr + 0.2);
  buildLeaves(scene, rand, groundCtx, { cx: -11, cz: 74, r: 1, n: 2600, drifts, keep: (x, z) => near(x, z) && clear(x, z, 0.2) });
}
