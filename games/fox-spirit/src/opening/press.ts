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
import { rng } from '../lookdevKit';
import { inkWash, washCourses, washDripFrom } from '../inkWash';
import { inkTreeGeometry } from '../pressScenery';
import type { Collider } from '../lookdevPlay';
import type { OpeningCtx } from './scene';
import { pressE, pressH } from './worlds';
import { BRAZIER_REACH, BRAZIERS, DRAFT, LEDGE, LEDGE_TOP, MEMBRANE_A, MEMBRANE_B, press, RIDGE, RIDGE_BASE, SHELF, SHELF_TOP, THE_PRESS } from './pressLayout';
import { pressLift, updatePress, type PressRig } from './press.hot';

const LEVEL_IDS = ['teach', 'develop', 'combine'] as const;
/** distance from (px, pz) to the segment a → b */
const segD = (px: number, pz: number, ax: number, az: number, bx: number, bz: number) => {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
};
// ink as a material (DESIGN-sumiro-look.md): wash, grain, tide-lines and drips over the paper patch
const winter = (color: THREE.ColorRepresentation, extra: THREE.MeshToonMaterialParameters = {}) =>
  Object.assign(inkWash(color, { scale: 0.3, tide: 0.6, drip: 0.45, density: 0.8 }), extra);

export function buildPress(
  ctx: OpeningCtx,
  opts: { complete: (level: (typeof LEVEL_IDS)[number]) => boolean; hasInkstep: () => boolean; restored: (level: (typeof LEVEL_IDS)[number]) => boolean },
) {
  const { scene, colliders } = ctx;
  const root = new THREE.Group();
  root.name = 'press-levels';
  scene.add(root);
  // solids the chase camera may fade through (no decals under here: Moss's occluder rule)
  const solids = new THREE.Group();
  solids.name = 'press-solids';
  root.add(solids);
  ctx.occluders.push(solids);

  // the ridge is dried ink: runs hang from its top lip (the wash's drip from that height)
  const inkMat = washDripFrom(inkWash(0x46445a, { scale: 0.3, tide: 0.9, drip: 0.95 }), RIDGE_BASE + RIDGE.rise);
  const ribMat = winter(0xc9c0ac);
  // the ridge's spine ribs sit a value above the ink, not paper-white (pale ribs read as a fence)
  const spineMat = inkWash(0x77718a, { scale: 0.3, tide: 0.6, drip: 0.5 });
  const paperMat = washCourses(winter(0xcfc6b2), -0.16);
  const paperEdge = washCourses(winter(0x9c927c), -0.16);
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
      for (const face of [-1, 1]) box(x - 0.12, x + 0.12, RIDGE.lz + face * (RIDGE.half + 0.02) - 0.04, RIDGE.lz + face * (RIDGE.half + 0.02) + 0.04, RIDGE_BASE - 0.5, ridgeTop - 0.25, spineMat);
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

  // ---- braziers: iron bowls of embers on stone, the only warm light in the white; the cold ones wait for a flame
  const braziers: THREE.PointLight[] = [];
  const coalsOf: THREE.MeshStandardMaterial[] = [];
  for (const B of BRAZIERS) {
    const at = press(B.lx, B.lz);
    const g = new THREE.Group();
    g.position.set(at.x, B.shelf ? SHELF_TOP : pressH(at.x, at.z), at.z);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.55, 7), stone);
    plinth.position.y = 0.27;
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.3, 0.32, 9, 1, true), timber);
    bowl.position.y = 0.7;
    const coalMat = new THREE.MeshStandardMaterial({ color: 0x2b2522, roughness: 0.9, emissive: 0xff7a2a, emissiveIntensity: B.lit ? 1.6 : 0 });
    const coals = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 0), coalMat);
    coals.scale.y = 0.45;
    coals.position.y = 0.8;
    const light = new THREE.PointLight(0xff8a3a, B.lit ? 1.6 : 0, 7, 1.8);
    light.position.y = 1.4;
    g.add(plinth, bowl, coals, light);
    root.add(g);
    braziers.push(light);
    coalsOf.push(coalMat);
    colliders.push({ kind: 'post', x: at.x, z: at.z, r: 0.45 });
  }
  void BRAZIER_REACH;

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
  // the lever the Scribe lifts at the end (pivots at the beam's east end)
  const lever = new THREE.Group();
  lever.position.set(1.7, 2.9, 0);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.6).translate(0, 0, 0.8), timber);
  const grip = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), stone);
  grip.position.z = 1.6;
  lever.add(arm, grip);
  lever.rotation.x = 0.55;
  thePress.add(beam, screw, platen, bed, pressLight, lever);
  // the Scribe: small and old, in a flared ink-grey robe and a fox-eared hood (the Warden's shape, in daylight), a
  // crimson scarf the eye finds against the snow, spectacles, ink to the elbows — bowed over the Press it held shut
  const scribe = new THREE.Group();
  const robePts: THREE.Vector2[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    robePts.push(new THREE.Vector2(0.46 - 0.3 * Math.pow(t, 0.7) + 0.05 * Math.sin(t * 9) * (1 - t), t * 1.18));
  }
  const robe = new THREE.Mesh(new THREE.LatheGeometry(robePts, 14), winter(0x4c4f63));
  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.04, 6, 18).rotateX(Math.PI / 2), winter(0xb9b4a6));
  hem.position.y = 0.04;
  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 9).translate(0, 1.16, 0), winter(0x43465a));
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.065, 7, 14).rotateX(Math.PI / 2), winter(0xa8322a));
  scarf.position.y = 1.3;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.04).translate(0, -0.21, 0), winter(0xa8322a));
  tail.position.set(0.12, 1.28, 0.18);
  tail.rotation.z = 0.2;
  const head = new THREE.Group();
  head.position.set(0, 1.44, 0.06);
  const hoodMat = winter(0x5d6076, { side: THREE.DoubleSide });
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.64), hoodMat);
  hood.rotation.x = -0.35;
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 4), hoodMat);
    ear.position.set(side * 0.12, 0.2, -0.04);
    ear.rotation.z = -side * 0.35;
    head.add(ear);
  }
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 9), winter(0xe0ccb4));
  face.position.set(0, -0.03, 0.08);
  const beard = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.3, 8).rotateX(Math.PI), winter(0xeeebe4));
  beard.position.set(0, -0.2, 0.13);
  const lensMat = new THREE.MeshBasicMaterial({ color: 0x2b2a2e });
  for (const side of [-1, 1]) {
    const lens = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.009, 5, 12), lensMat);
    lens.position.set(side * 0.05, 0.0, 0.2);
    head.add(lens);
  }
  head.add(hood, face, beard);
  const sleeveMat = winter(0x23252d);
  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.58, 7).translate(0, -0.28, 0), sleeveMat);
  armL.position.set(-0.27, 1.2, 0.05);
  armL.rotation.x = -0.5;
  const armR = armL.clone();
  armR.position.x = 0.27;
  const quill = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.34, 4).translate(0, -0.6, 0.02), winter(0xf2efe6));
  armL.add(quill);
  scribe.add(robe, hem, shoulders, scarf, tail, head, armL, armR);
  const sAt = press(THE_PRESS.lx + 3.1, THE_PRESS.lz + 1.2);
  scribe.position.set(sAt.x, LEDGE_TOP, sAt.z);
  // facing the Press (west), bowed
  scribe.rotation.y = -Math.PI / 2 - 0.25;
  shoulders.rotation.x = 0.3;
  head.rotation.x = 0.45;
  // the work surface: page stacks, ink pots, and the pressed autumn under the platen — one maple leaf, held flat
  const stackMat = winter(0xd8d0bc);
  for (const [dx, dz, h] of [[-2.3, 0.5, 0.5], [-2.0, -0.6, 0.32], [2.0, -0.9, 0.42], [-2.6, -0.1, 0.22]] as const) {
    for (let k = 0; k < 3; k++) {
      const pg = new THREE.Mesh(new THREE.BoxGeometry(0.62, h / 3 - 0.01, 0.46), k % 2 ? paperEdge : stackMat);
      pg.position.set(dx + (k - 1) * 0.03, (h / 3) * (k + 0.5), dz);
      pg.rotation.y = (k - 1) * 0.12 + dx;
      thePress.add(pg);
    }
  }
  const inkPot = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.18, 9), new THREE.MeshStandardMaterial({ color: 0x14161f, roughness: 0.1 }));
  inkPot.position.set(-2.0, 0.42, -0.6);
  thePress.add(inkPot);
  const leafShape = new THREE.Shape();
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const lobes = 0.55 + 0.45 * Math.pow(Math.abs(Math.cos(a * 2.5)), 0.6);
    const r = 0.5 * lobes * (a > Math.PI * 1.35 && a < Math.PI * 1.65 ? 0.3 : 1);
    const x = Math.cos(a + Math.PI / 2) * r;
    const y = Math.sin(a + Math.PI / 2) * r;
    if (i === 0) leafShape.moveTo(x, y);
    else leafShape.lineTo(x, y);
  }
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xc8501e, roughness: 0.6, emissive: 0xff6a20, emissiveIntensity: 0.05, side: THREE.DoubleSide });
  const pressedLeaf = new THREE.Mesh(new THREE.ShapeGeometry(leafShape).rotateX(-Math.PI / 2), leafMat);
  pressedLeaf.position.y = 0.51;
  thePress.add(pressedLeaf);
  root.add(scribe);
  colliders.push({ kind: 'post', x: sAt.x, z: sAt.z, r: 0.4 });
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

  // ---- dressing: snow caps on every top edge, page edges on the shelf face, icicles under the ridge, loose pages and
  // ink blots on the snow (instanced; own seed — never ctx.rand)
  const rd = rng(9127);
  const snowCap = winter(0xf1f2f4);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const caps: [number, number, number, number, number][] = [];
  for (const side of [-1, 1]) caps.push([side < 0 ? -RIDGE.xMax : RIDGE.gate + 0.35, side < 0 ? -RIDGE.gate - 0.35 : RIDGE.xMax, RIDGE.lz, ridgeTop, RIDGE.half + 0.12]);
  caps.push([-SHELF.xMax, SHELF.xMax, SHELF.z1, SHELF_TOP, 0.5]);
  caps.push([LEDGE.x0, LEDGE.x1, LEDGE.z1, LEDGE_TOP, 0.45]);
  for (const [x0, x1, lz, top, d] of caps) {
    const c = press((x0 + x1) / 2, lz);
    const cap = new THREE.Mesh(new THREE.CapsuleGeometry(d * 0.55, x1 - x0, 3, 8).rotateZ(Math.PI / 2), snowCap);
    cap.scale.set(1, 0.42, 1);
    cap.position.set(c.x, top + 0.04, c.z);
    root.add(cap);
  }
  // page edges: thin dark strips across the shelf and ledge faces, staggered like a sheaf seen side-on
  const edgeGeo = new THREE.BoxGeometry(1, 0.035, 0.05);
  const EDGES = 520;
  const edges = new THREE.InstancedMesh(edgeGeo, winter(0x6f6656), EDGES);
  for (let i = 0; i < EDGES; i++) {
    const onLedge = i > EDGES * 0.85;
    const x0 = onLedge ? LEDGE.x0 : -SHELF.xMax + 2;
    const x1 = onLedge ? LEDGE.x1 : SHELF.xMax - 2;
    const lx = x0 + rd() * (x1 - x0);
    const y = onLedge ? SHELF_TOP + 0.1 + rd() * (LEDGE.rise - 0.2) : RIDGE_BASE - 0.4 + rd() * (SHELF_TOP - RIDGE_BASE + 0.2);
    const at = press(lx, (onLedge ? LEDGE.z1 : SHELF.z1) + 0.02 + (onLedge ? 0.3 : 0.35) * rd());
    sc.set(1.5 + rd() * 6, 1, 1);
    m4.compose(v.set(at.x, y, at.z), q.identity(), sc);
    edges.setMatrixAt(i, m4);
  }
  root.add(edges);
  // icicles under the ridge's lintel and along its north face
  const icicle = new THREE.ConeGeometry(0.07, 0.6, 5).rotateX(Math.PI).translate(0, -0.3, 0);
  const ICE = 160;
  const icicles = new THREE.InstancedMesh(icicle, new THREE.MeshStandardMaterial({ color: 0xdbe6f2, roughness: 0.15, transparent: true, opacity: 0.85 }), ICE);
  for (let i = 0; i < ICE; i++) {
    let lx = (rd() * 2 - 1) * 40;
    if (Math.abs(lx) < RIDGE.gate + 0.4) lx += Math.sign(lx || 1) * 2;
    const at = press(lx, RIDGE.lz + (rd() > 0.5 ? 1 : -1) * (RIDGE.half + 0.06));
    sc.set(1, 0.6 + rd() * 1.2, 1);
    m4.compose(v.set(at.x, ridgeTop - 0.05, at.z), q.identity(), sc);
    icicles.setMatrixAt(i, m4);
  }
  root.add(icicles);
  // loose pages and ink blots lying in the snow (kept off the puzzle lanes' membranes)
  const LEAVES = 140;
  const leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.42, 0.56).rotateX(-Math.PI / 2), winter(0xe2dccd, { side: THREE.DoubleSide }), LEAVES);
  const BLOTS = 60;
  const blots = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 9).rotateX(-Math.PI / 2), winter(0x262833), BLOTS);
  let nl = 0;
  let nb = 0;
  for (let i = 0; i < 400 && (nl < LEAVES || nb < BLOTS); i++) {
    const lx = (rd() * 2 - 1) * 38;
    const lz = -40 + rd() * 78;
    const onShelf = lz < SHELF.z1 && lz > SHELF.z0;
    const at = press(lx, lz);
    if (Math.hypot(lx - MEMBRANE_A.lx, lz - MEMBRANE_A.lz) < 3 || Math.hypot(lx - MEMBRANE_B.lx, lz - MEMBRANE_B.lz) < 3) continue;
    if (Math.hypot(lx, lz - 38) < 7) continue;
    if (Math.abs(lz - RIDGE.lz) < 1.6 || (lx > LEDGE.x0 - 1 && lx < LEDGE.x1 + 1 && lz < LEDGE.z1 + 1 && lz > LEDGE.z0)) continue;
    const y = onShelf ? SHELF_TOP : pressH(at.x, at.z);
    if (!onShelf && pressH(at.x, at.z) > RIDGE_BASE + 1.2) continue;
    if (nl < LEAVES && rd() < 0.75) {
      e.set((rd() - 0.5) * 0.3, rd() * 6.3, (rd() - 0.5) * 0.3);
      m4.compose(v.set(at.x, y + 0.03, at.z), q.setFromEuler(e), sc.set(1, 1, 1));
      leaves.setMatrixAt(nl++, m4);
    } else if (nb < BLOTS) {
      const r = 0.3 + rd() * 0.9;
      m4.compose(v.set(at.x, y + 0.02, at.z), q.setFromEuler(e.set(0, rd() * 6.3, 0)), sc.set(r, 1, r * (0.6 + rd() * 0.5)));
      blots.setMatrixAt(nb++, m4);
    }
  }
  leaves.count = nl;
  blots.count = nb;
  root.add(leaves, blots);

  // ---- the floor as a place: ink trees with page-leaf crowns heavy with snow, giant books half sunk in drifts,
  // lantern posts marking the way between braziers (all off the lanes, the braziers' legs and the gates)
  const onShelfTop = (lx: number, lz: number, pad: number) =>
    lz < SHELF.z1 - 3 - pad && lz > SHELF.z0 + 1 + pad && !(lx > LEDGE.x0 - 4 - pad && lx < LEDGE.x1 + 4 + pad) &&
    segD(lx, lz, BRAZIERS[2]!.lx, BRAZIERS[2]!.lz, BRAZIERS[3]!.lx, BRAZIERS[3]!.lz) > 3 + pad &&
    segD(lx, lz, BRAZIERS[3]!.lx, BRAZIERS[3]!.lz, MEMBRANE_B.lx, MEMBRANE_B.lz) > 3 + pad &&
    Math.hypot(lx - BRAZIERS[2]!.lx, lz - BRAZIERS[2]!.lz) > 4 && Math.hypot(lx - MEMBRANE_B.lx, lz - MEMBRANE_B.lz) > 5 && pressE(press(lx, lz).x, press(lx, lz).z) < -5;
  const clearOf = (lx: number, lz: number, pad: number) => {
    if (Math.abs(lz - RIDGE.lz) < 3 + pad) return false;
    if (lz < SHELF.z1 + 2.5 + pad && lz > SHELF.z0 - 2) return onShelfTop(lx, lz, pad);
    if (Math.abs(lx) < 5 + pad && lz > SHELF.z1 && lz < 40) return false;
    for (const B of BRAZIERS) if (Math.hypot(lx - B.lx, lz - B.lz) < 4 + pad) return false;
    // the relay legs (lit → cold → gate) stay open
    if (segD(lx, lz, BRAZIERS[0]!.lx, BRAZIERS[0]!.lz, BRAZIERS[1]!.lx, BRAZIERS[1]!.lz) < 3 + pad || segD(lx, lz, BRAZIERS[1]!.lx, BRAZIERS[1]!.lz, 0, 18) < 3 + pad) return false;
    const at = press(lx, lz);
    return pressE(at.x, at.z) < -4 - pad && pressH(at.x, at.z) < RIDGE_BASE + 0.8;
  };
  // bare ink trees with snow on their limbs (pressScenery.inkTreeGeometry); shapes draw their own rng so the shared
  // `rd` stream (and every later placement) keeps exactly the draws the old crowns used: 2 + 4 × 6
  const trunkMat = winter(0x15161c);
  const crownMat = winter(0xeef0f2);
  const treeR = rng(7741);
  let trees = 0;
  // three placed in the arrival view first (the spawn faces south down the margin), then the scatter
  const PLACED: ReadonlyArray<readonly [number, number]> = [[9, 31], [13.5, 27.5], [-12, 35.5]];
  for (let i = 0; i < 340 && trees < 34; i++) {
    const lx = i < PLACED.length ? PLACED[i]![0] : (rd() * 2 - 1) * 40;
    const lz = i < PLACED.length ? PLACED[i]![1] : -40 + rd() * 80;
    if (!clearOf(lx, lz, 0.5)) continue;
    const at = press(lx, lz);
    const y = lz < SHELF.z1 && lz > SHELF.z0 ? SHELF_TOP : pressH(at.x, at.z);
    const h = 2.4 + rd() * 2.2;
    const tree = new THREE.Group();
    tree.position.set(at.x, y, at.z);
    tree.rotation.y = rd() * 6.3;
    for (let k = 0; k < 24; k++) rd();
    const shape = inkTreeGeometry(treeR, h * 1.7);
    tree.add(new THREE.Mesh(shape.wood, trunkMat), new THREE.Mesh(shape.snow, crownMat));
    solids.add(tree);
    colliders.push({ kind: 'post', x: at.x, z: at.z, r: 0.28 });
    trees++;
  }
  const coverMats = [winter(0x5b2f2a), winter(0x2f3d55), winter(0x4a4033)];
  let books = 0;
  for (let i = 0; i < 300 && books < 8; i++) {
    const lx = i === 0 ? 14 : (rd() * 2 - 1) * 34;
    const lz = i === 0 ? 33 : -38 + rd() * 74;
    if (!clearOf(lx, lz, 2.5)) continue;
    const at = press(lx, lz);
    const y = lz < SHELF.z1 && lz > SHELF.z0 ? SHELF_TOP : pressH(at.x, at.z);
    const w = 2.6 + rd() * 1.6;
    const d = 1.8 + rd() * 1.0;
    const t = 0.6 + rd() * 0.5;
    const yaw = rd() * Math.PI;
    const tilt = 0.25 + rd() * 0.35;
    const book = new THREE.Group();
    book.position.set(at.x, y - 0.2, at.z);
    book.rotation.set(0, yaw, tilt);
    const cover = new THREE.Mesh(new THREE.BoxGeometry(w, t, d), coverMats[books % 3]!);
    const block = new THREE.Mesh(new THREE.BoxGeometry(w - 0.12, t - 0.12, d + 0.02), paperMat);
    block.position.x = 0.05;
    const drift = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), snowCap);
    drift.scale.set(w * 0.55, 0.35, d * 0.7);
    drift.position.y = -t * 0.3;
    drift.rotation.z = -tilt;
    book.add(cover, block, drift);
    solids.add(book);
    colliders.push({ kind: 'box', x: at.x, z: at.z, yaw, hx: (w / 2) * Math.cos(tilt), hz: d / 2, top: y - 0.2 + Math.sin(tilt) * w * 0.5 + t * 0.5 });
    books++;
  }
  // lantern posts along the relay legs: a warm dot every few metres says "this way" without words
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffc27a });
  const postMat = winter(0x2a2b31);
  const [A, A2, B, B2] = BRAZIERS as [typeof BRAZIERS[0], typeof BRAZIERS[0], typeof BRAZIERS[0], typeof BRAZIERS[0]];
  for (const [ax, az, bx, bz] of [[A.lx, A.lz, A2.lx, A2.lz], [A2.lx, A2.lz, 0, 19], [B.lx, B.lz, B2.lx, B2.lz], [B2.lx, B2.lz, MEMBRANE_B.lx + 1.5, MEMBRANE_B.lz]] as const) {
    const n = Math.max(2, Math.floor(Math.hypot(bx - ax, bz - az) / 6));
    for (let k = 1; k < n; k++) {
      const f = k / n;
      const side = k % 2 ? 1.4 : -1.4;
      const nx = -(bz - az) / Math.hypot(bx - ax, bz - az);
      const nz = (bx - ax) / Math.hypot(bx - ax, bz - az);
      const lx = ax + (bx - ax) * f + nx * side;
      const lz = az + (bz - az) * f + nz * side;
      const at = press(lx, lz);
      const y = lz < SHELF.z1 ? SHELF_TOP : pressH(at.x, at.z);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.1, 5).translate(0, 0.55, 0), postMat);
      post.position.set(at.x, y, at.z);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), lampMat);
      lamp.position.set(at.x, y + 1.15, at.z);
      root.add(post, lamp);
    }
  }

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
      arrive: () => say(opts.restored('combine') ? 'The Press keeps its warmth.' : 'Snow keeps the unfinished pages.'),
      warmed: () => ctx.audio.play('soft-paper', { at: ctx.fox.root.position.clone(), gain: 0.08, rate: 0.5 }),
      kindled: () => {
        ctx.audio.play('soft-paper', { at: ctx.fox.root.position.clone(), gain: 0.12, rate: 0.7 });
        say('A cold brazier takes the flame.');
      },
      thawSeal: () => {
        ctx.audio.cue('millrace-burst');
        say('The frozen ink lets go.');
      },
      crack: () => {
        ctx.audio.cue('millrace-burst');
        say('The ink breathes.');
      },
      meltIce: () => say('The ice runs off the ink.'),
      coda: () => say('The Warden was the Scribe’s shadow.'),
      complete: (level) => {
        opts.complete(LEVEL_IDS[level]);
        if (level === 0) say('Inkstep · frozen ink breaks now.');
        if (level === 1) say('The Folded Archive opens.');
        if (level === 2) {
          pressLight.intensity = 2.2;
          ctx.audio.cue('finale-kindle');
          say('The Scribe lifts the lever.');
          // a held two-shot: the Scribe at the Press, the fox in front — from off the ledge's north lip, looking south
          const cam = ctx.player?.cam;
          if (cam) {
            const look = new THREE.Vector3(sAt.x - 1.4, LEDGE_TOP + 1.1, sAt.z - 0.6);
            const lens = press(THE_PRESS.lx + 4.2, LEDGE.z1 + 3.2);
            const at = new THREE.Vector3(lens.x, LEDGE_TOP + 2.0, lens.z);
            const look0 = cam.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(6).add(cam.camera.position);
            cam.playPath({
              keys: [
                { t: 0, pos: cam.camera.position.clone(), look: look0 },
                { t: 1.6, pos: at, look },
                { t: 6.5, pos: at.clone().add(new THREE.Vector3(-0.8, 0.2, -0.9)), look },
              ],
              blendInS: 0.8, blendOutS: 2, lockS: 3.5,
            });
          }
        }
      },
    },
    seal,
    sealCol,
    warmGlow,
    warmLight,
    braziers,
    coals: coalsOf,
    membranes,
    ice,
    drafts,
    lever,
    platen,
    scribe,
    scribeHead: head,
    scribeArm: armR,
    leafMat,
    s: { lit: BRAZIERS.reduce((m, B, i) => (B.lit ? m | (1 << i) : m), 0), wasWarm: 0, warm: 0, sealK: 0, thawed: 0, crackA: -1, crackB: -1, iceK: 0, iced: 1, done: 0, dashWasAir: 0, time: 0, hint: 0, arrived: 0, coda: -1, leverK: 0 },
  };
  // a saved world comes back as it was left, quietly: open seal, breathing drafts, melted ice, lit Press
  if (opts.restored('teach')) {
    rig.s.lit |= 0b0011;
    rig.s.thawed = 1;
    rig.s.sealK = 1;
    rig.s.done |= 1;
    rig.s.hint = 1;
    seal.visible = false;
    sealCol.top = seal.userData.base;
  }
  if (opts.restored('develop')) {
    rig.s.crackA = 5;
    rig.s.done |= 2;
  }
  if (opts.restored('combine')) {
    rig.s.lit |= 0b1100;
    rig.s.iced = 0;
    rig.s.iceK = 1;
    rig.s.crackB = 5;
    rig.s.done |= 4;
    ice.visible = false;
    pressLight.intensity = 2.2;
    rig.s.leverK = 1;
    rig.s.coda = -2;
  }
  ctx.onUpdate((dt) => updatePress(rig, dt));

  return {
    /** fold the drafts into a lift sample (the controller's updraft read) */
    liftAt: (x: number, feetY: number, z: number, out: { k: number; radialK: number; ax: number; az: number }) => pressLift(rig, x, feetY, z, out),
    state: () => ({
      lit: BRAZIERS.map((_, i) => (rig.s.lit & (1 << i)) !== 0),
      warm: +rig.s.warm.toFixed(2), sealOpen: rig.s.sealK >= 1, draftA: rig.s.crackA >= 0, iced: rig.s.iced === 1, draftB: rig.s.crackB >= 0,
      done: LEVEL_IDS.filter((_, i) => (rig.s.done & (1 << i)) !== 0),
    }),
  };
}

export type Press = ReturnType<typeof buildPress>;
