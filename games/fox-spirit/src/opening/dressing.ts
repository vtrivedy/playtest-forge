/**
 * Ground dressing for the long open runs (TASK: "fill the long empty beige runs"): low bramble and
 * bracken bushes, aster and campion patches, mushroom rings, field-stone scatters and the odd fallen
 * limb. Nothing tall enough to hide the fox or block the chase camera, no colliders except logs, and
 * nothing inside an authored play space (keep-outs below). Everything is baked by cell (bake.ts).
 */
import * as THREE from 'three';
import { CANOPY, CANOPY_MOSS, canopyPad, RAMP_CANOPY, toon, type CanopyTones } from '../lookdevKit';
import type { OpeningCtx } from './scene';
import { bakeCells } from './bake';
import { C, cyl, Kit } from './village';
import { CANOPY as CANOPY_ROUTE, GLYPHS, HEARTH_A, HOUSES, inVista, JOGS, KEEPING, LEAF_PILES, PAGE, pathDist, POP_UP_RUIN, rimK, SHELF, SPAWN, UNPRESSED, WELL } from './layout';
import { BROOK, MILLBROOK, polyDist, westE } from './millbrookLayout';

/** [x, z, r]: authored spaces dressing never enters */
const KEEP_OUT: ReadonlyArray<readonly [number, number, number]> = [
  [SPAWN.x, SPAWN.z, 4],
  [WELL.x, WELL.z, 6.5],
  [HEARTH_A.x, HEARTH_A.z, 4.5],
  [SHELF.x, SHELF.z, 9],
  [KEEPING.terrace.x, KEEPING.terrace.z, 7],
  [KEEPING.crag.x, KEEPING.crag.z, 6],
  [KEEPING.steam.x, KEEPING.steam.z, 5],
  ...KEEPING.ledge.map(([x, z]) => [x, z, 4] as const),
  ...CANOPY_ROUTE.map((c) => [c.x, c.z, 4.5] as const),
  [POP_UP_RUIN.entry.x, POP_UP_RUIN.entry.z, 5],
  [POP_UP_RUIN.overlook.x, POP_UP_RUIN.overlook.z, 6],
  ...POP_UP_RUIN.leaves.map((l) => [l.x, l.z, 5] as const),
  ...GLYPHS.stones.map((s) => [s.x, s.z, 3.5] as const),
  [GLYPHS.shrine.x, GLYPHS.shrine.z, 5],
  ...JOGS.cairns.map((c) => [c.x, c.z, 2.5] as const),
  ...LEAF_PILES.map((p) => [p.x, p.z, 2] as const),
  ...PAGE.stages.flat().map(([x, , z]) => [x, z, 2.2] as const),
  [UNPRESSED.hare.x, UNPRESSED.hare.z, 2.5],
  [UNPRESSED.hedgehog.settle.x, UNPRESSED.hedgehog.settle.z, 2],
  [UNPRESSED.heron.settle.x, UNPRESSED.heron.settle.z, 3],
  [MILLBROOK.mill.x, MILLBROOK.mill.z, 7],
  [MILLBROOK.kiln.x, MILLBROOK.kiln.z, 4.5],
  [MILLBROOK.weir.x, MILLBROOK.weir.z, 6],
  [MILLBROOK.hay.x, MILLBROOK.hay.z, 8],
  [MILLBROOK.lookout.x, MILLBROOK.lookout.z, 7],
];

/** inside the playable world and clear of lanes, houses, play spaces and the brook */
function open(x: number, z: number, lane: number): boolean {
  if (pathDist(x, z) < lane) return false;
  if (inVista(x, z, 2)) return false;
  if (polyDist(BROOK, x, z).d < 3.2) return false;
  for (const [kx, kz, r] of KEEP_OUT) if ((x - kx) ** 2 + (z - kz) ** 2 < r * r) return false;
  for (const h of HOUSES) if (Math.max(Math.abs(x - h.x) - h.w / 2, Math.abs(z - h.z) - h.d / 2) < 2.2) return false;
  return true;
}
/** 0 deep inside the world, rising to 1 out on the rim slopes */
function edge(x: number, z: number): number {
  const bowl = rimK(x, z);
  const west = 1 + westE(x, z) / 12;
  return Math.min(bowl, west);
}

let bushMat: THREE.MeshToonMaterial | null = null;
function bush(rand: () => number, x: number, y: number, z: number, scale: number, tones: CanopyTones): THREE.Group {
  bushMat ??= toon(0xffffff, { vertexColors: true, contour: 0.9, ramp: RAMP_CANOPY });
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const lobes = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < lobes; i++) {
    const r = (0.42 + rand() * 0.3) * scale;
    const m = new THREE.Mesh(canopyPad(rand, r, r * 0.72, tones, 0.42), bushMat);
    const a = rand() * 6.28;
    m.position.set(Math.cos(a) * r * 0.8 * (i ? 1 : 0), r * 0.38, Math.sin(a) * r * 0.8 * (i ? 1 : 0));
    m.rotation.y = rand() * 6.28;
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }
  return g;
}

export function buildDressing(ctx: OpeningCtx): void {
  const { rand, groundH, scene } = ctx;
  const roots: THREE.Object3D[] = [];
  const kit = new Kit();
  // sample both the bowl and Millbrook; dense where the world is open, thinning up the rim
  const tries = (n: number, fn: (x: number, z: number, e: number) => boolean) => {
    let placed = 0;
    for (let i = 0; i < n * 40 && placed < n; i++) {
      const x = -118 + rand() * 162;
      const z = 46 + rand() * 76;
      const e = edge(x, z);
      if (e > 1.35) continue;
      if (fn(x, z, e)) placed++;
    }
  };
  // bushes: bramble / bracken clumps, moss-olive in the open, rust toward the rim
  tries(120, (x, z, e) => {
    if (!open(x, z, 2.4)) return false;
    if (e < 0.55 && rand() < 0.6) return false;
    const tones = e > 0.95 ? CANOPY[Math.floor(rand() * CANOPY.length)]! : CANOPY_MOSS[Math.floor(rand() * CANOPY_MOSS.length)]!;
    roots.push(bush(rand, x, groundH(x, z) - 0.05, z, 0.8 + rand() * 0.55 + (e > 1 ? 0.4 : 0), tones));
    return true;
  });
  // flower patches: low asters / campion, a dozen heads each
  tries(70, (x, z, e) => {
    if (e > 1.05 || !open(x, z, 1.6)) return false;
    const tone = C.bloom[Math.floor(rand() * C.bloom.length)]!;
    for (let i = 0; i < 16 + Math.floor(rand() * 10); i++) {
      const a = rand() * 6.28;
      const r = Math.sqrt(rand()) * 0.75;
      const px = x + Math.cos(a) * r;
      const pz = z + Math.sin(a) * r;
      const y = groundH(px, pz);
      const h = 0.1 + rand() * 0.16;
      kit.add(cyl(0.01, 0.012, h, 3), C.leaf, [px, y + h / 2, pz]);
      kit.add(new THREE.IcosahedronGeometry(0.028 + rand() * 0.018, 0), rand() < 0.15 ? C.amber : tone, [px, y + h, pz], [rand(), rand(), 0], 0.004);
    }
    return true;
  });
  // mushroom rings under the trees' edge: pale stems, rust caps
  tries(22, (x, z, e) => {
    if (e > 1 || !open(x, z, 1.8)) return false;
    const n = 4 + Math.floor(rand() * 5);
    const rr = 0.4 + rand() * 0.5;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.28 + rand() * 0.4;
      const px = x + Math.cos(a) * rr;
      const pz = z + Math.sin(a) * rr;
      const y = groundH(px, pz);
      const s = 0.7 + rand() * 0.6;
      kit.add(cyl(0.025 * s, 0.035 * s, 0.14 * s, 5), C.plaster, [px, y + 0.07 * s, pz], [0, 0, (rand() - 0.5) * 0.3]);
      kit.add(new THREE.SphereGeometry(0.075 * s, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), i % 3 ? C.bloom[0]! : C.door, [px, y + 0.13 * s, pz], [0, 0, 0], 0.006, [1, 0.7, 1]);
    }
    return true;
  });
  // field-stone scatters
  tries(40, (x, z, e) => {
    if (!open(x, z, 1.8)) return false;
    for (let i = 0; i < 2 + Math.floor(rand() * 3); i++) {
      const r = 0.1 + rand() * 0.2 + (e > 0.9 ? 0.15 : 0);
      const px = x + (rand() - 0.5) * 1.4;
      const pz = z + (rand() - 0.5) * 1.4;
      kit.add(new THREE.DodecahedronGeometry(r, 0), rand() < 0.5 ? C.stoneField : C.stoneCool, [px, groundH(px, pz) + r * 0.25, pz], [rand(), rand() * 6, rand()], 0.014, [1.3, 0.6, 1.1]);
    }
    return true;
  });
  // fallen limbs: a hop-over log or two in the wider runs
  tries(9, (x, z, e) => {
    // only in Millbrook: the bowl's open runs carry other teams' input routes (page chase, Keeping)
    if (x > -48 || e > 0.85 || !open(x, z, 3)) return false;
    const yaw = rand() * Math.PI;
    const len = 2.2 + rand() * 1.6;
    const y = groundH(x, z);
    kit.at(x, y, z, yaw, () => {
      kit.add(cyl(0.2, 0.25, len, 8, 'x'), C.timber, [0, 0.2, 0], [0, 0, 0.03], 0.02);
      kit.add(cyl(0.04, 0.07, 0.7, 5), C.timberDark, [len * 0.25, 0.45, 0.05], [0.5, 0, -0.6], 0.01);
    });
    ctx.colliders.push({ kind: 'box', x, z, yaw: yaw + Math.PI / 2, hx: 0.24, hz: len / 2, top: y + 0.42 });
    return true;
  });
  roots.push(kit.build());
  for (const g of bakeCells(roots, 28, 'dressing')) scene.add(g);
}
