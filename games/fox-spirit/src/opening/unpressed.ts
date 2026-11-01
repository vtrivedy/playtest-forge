/**
 * Unpressed creatures (DESIGN-unpressed.md): animals pressed flat into the Album, hidden as warm ink drawings
 * on scenery. A dash through one pops it off the page into a coloured creature that performs, then lives on.
 *
 * Each creature is authored once as a side-profile spec (x forward, y up, z across, metres at scale 1): the
 * same parts draw the canvas drawing and build the 3D body, so the pop reads as the drawing gaining depth.
 * Bones are groups pivoting at authored profile points; performances are hand-keyed procedural curves.
 */
import * as THREE from 'three';
import { RAMP_WORLD, inkMaterial, hullGeometry, plumeGeometry, hewn, toon, inked } from '../lookdevKit';
import type { OpeningCtx } from './scene';
import type { Collider } from '../lookdevPlay';
import { JOGS, KIT, UNPRESSED } from './layout';

type P2 = readonly [number, number];
type Part =
  /** ellipsoid at c with radii (x, y, z); `rot` tilts it in the profile plane; `z` offsets it across */
  | { k: 'ell'; bone: string; c: P2; r: readonly [number, number, number]; col: number; rot?: number; z?: number }
  /** tube through profile points, radius r0 → r1 */
  | { k: 'tube'; bone: string; pts: readonly P2[]; r: readonly [number, number]; col: number; z?: number }
  /** cone from base to tip */
  | { k: 'cone'; bone: string; from: P2; to: P2; r: number; col: number; z?: number }
  /** a flat feathered panel (wing): polygon in the profile plane, extruded `depth` across, at `z` */
  | { k: 'panel'; bone: string; pts: readonly P2[]; depth: number; col: number; z?: number }
  /** spines: small cones bristling from the upper half of an ellipsoid */
  | { k: 'spines'; bone: string; c: P2; r: readonly [number, number, number]; col: number; n: number };

type Spec = {
  id: 'hedgehog' | 'heron' | 'deer' | 'kit' | 'hare';
  scale: number;
  /** bone pivots in profile space and their parents (root = the creature's feet origin) */
  bones: Record<string, { at: P2; parent?: string }>;
  parts: Part[];
  /** eye: profile point + radius (drawn as an ink dot, built as a dark bead) on the head bone */
  eye: { at: P2; r: number; bone: string };
};

const INK_HEX = '#2a1a10';

const SPECS: Spec[] = [
  {
    id: 'hedgehog',
    scale: 1.25,
    bones: { body: { at: [0, 0.16] }, head: { at: [0.15, 0.16], parent: 'body' }, legF: { at: [0.11, 0.08], parent: 'body' }, legB: { at: [-0.12, 0.08], parent: 'body' } },
    parts: [
      { k: 'ell', bone: 'body', c: [0, 0.17], r: [0.24, 0.15, 0.17], col: 0x7a5638 },
      { k: 'spines', bone: 'body', c: [-0.03, 0.19], r: [0.25, 0.17, 0.18], col: 0x3e2a1c, n: 70 },
      { k: 'ell', bone: 'head', c: [0.22, 0.14], r: [0.11, 0.085, 0.09], col: 0xd2b088, rot: -0.15 },
      { k: 'cone', bone: 'head', from: [0.28, 0.13], to: [0.39, 0.1], r: 0.04, col: 0xd2b088 },
      { k: 'ell', bone: 'head', c: [0.395, 0.1], r: [0.022, 0.02, 0.022], col: 0x1a1010 },
      { k: 'ell', bone: 'head', c: [0.2, 0.22], r: [0.03, 0.035, 0.012], col: 0xb08a68, z: 0.07 },
      { k: 'tube', bone: 'legF', pts: [[0.11, 0.08], [0.13, 0.0]], r: [0.03, 0.025], col: 0x4e3424, z: 0.08 },
      { k: 'tube', bone: 'legF', pts: [[0.11, 0.08], [0.13, 0.0]], r: [0.03, 0.025], col: 0x4e3424, z: -0.08 },
      { k: 'tube', bone: 'legB', pts: [[-0.12, 0.08], [-0.13, 0.0]], r: [0.03, 0.025], col: 0x4e3424, z: 0.09 },
      { k: 'tube', bone: 'legB', pts: [[-0.12, 0.08], [-0.13, 0.0]], r: [0.03, 0.025], col: 0x4e3424, z: -0.09 },
    ],
    eye: { at: [0.27, 0.165], r: 0.016, bone: 'head' },
  },
  {
    id: 'heron',
    scale: 0.78,
    bones: {
      body: { at: [0, 1.0] },
      neck: { at: [0.28, 1.1], parent: 'body' },
      head: { at: [0.4, 1.74], parent: 'neck' },
      wingL: { at: [0.18, 1.12], parent: 'body' },
      wingR: { at: [0.18, 1.12], parent: 'body' },
      legL: { at: [0.02, 0.88], parent: 'body' },
      legR: { at: [0.02, 0.88], parent: 'body' },
    },
    parts: [
      { k: 'ell', bone: 'body', c: [0, 1.0], r: [0.4, 0.2, 0.19], col: 0x6c7a82, rot: 0.22 },
      { k: 'ell', bone: 'body', c: [-0.4, 0.88], r: [0.2, 0.07, 0.1], col: 0x3c464c, rot: 0.35 },
      { k: 'panel', bone: 'wingL', pts: [[0.16, 1.14], [0.02, 1.2], [-0.2, 1.17], [-0.44, 1.07], [-0.66, 0.9], [-0.58, 0.88], [-0.6, 0.83], [-0.48, 0.86], [-0.46, 0.8], [-0.34, 0.86], [-0.3, 0.82], [-0.18, 0.9], [0.0, 0.94], [0.14, 1.02]], depth: 0.035, col: 0x56636b, z: 0.19 },
      { k: 'panel', bone: 'wingR', pts: [[0.16, 1.14], [0.02, 1.2], [-0.2, 1.17], [-0.44, 1.07], [-0.66, 0.9], [-0.58, 0.88], [-0.6, 0.83], [-0.48, 0.86], [-0.46, 0.8], [-0.34, 0.86], [-0.3, 0.82], [-0.18, 0.9], [0.0, 0.94], [0.14, 1.02]], depth: 0.035, col: 0x56636b, z: -0.19 },
      { k: 'tube', bone: 'neck', pts: [[0.28, 1.1], [0.4, 1.32], [0.3, 1.52], [0.4, 1.72]], r: [0.075, 0.05], col: 0xb9bdb8 },
      { k: 'ell', bone: 'head', c: [0.44, 1.78], r: [0.1, 0.065, 0.06], col: 0xcfd0ca },
      { k: 'tube', bone: 'head', pts: [[0.42, 1.83], [0.3, 1.86], [0.2, 1.82]], r: [0.02, 0.006], col: 0x22222a },
      { k: 'cone', bone: 'head', from: [0.52, 1.78], to: [0.86, 1.73], r: 0.032, col: 0xd9952e },
      { k: 'tube', bone: 'legL', pts: [[0.02, 0.88], [0.05, 0.46], [0.02, 0.0]], r: [0.03, 0.018], col: 0x8a6a3a, z: 0.07 },
      { k: 'tube', bone: 'legR', pts: [[0.02, 0.88], [0.05, 0.46], [0.02, 0.0]], r: [0.03, 0.018], col: 0x8a6a3a, z: -0.07 },
    ],
    eye: { at: [0.47, 1.8], r: 0.014, bone: 'head' },
  },
  {
    id: 'deer',
    scale: 0.85,
    bones: {
      body: { at: [0, 0.95] },
      neck: { at: [0.36, 1.05], parent: 'body' },
      head: { at: [0.58, 1.5], parent: 'neck' },
      legFL: { at: [0.32, 0.82], parent: 'body' },
      legFR: { at: [0.32, 0.82], parent: 'body' },
      legBL: { at: [-0.34, 0.84], parent: 'body' },
      legBR: { at: [-0.34, 0.84], parent: 'body' },
      tail: { at: [-0.52, 1.08], parent: 'body' },
    },
    parts: [
      { k: 'ell', bone: 'body', c: [0, 0.97], r: [0.5, 0.26, 0.22], col: 0x8e6a4a },
      { k: 'ell', bone: 'body', c: [-0.36, 0.99], r: [0.21, 0.22, 0.19], col: 0x86624a },
      { k: 'ell', bone: 'body', c: [0.02, 0.86], r: [0.38, 0.1, 0.17], col: 0xd8b48a },
      { k: 'ell', bone: 'body', c: [-0.3, 0.86], r: [0.17, 0.2, 0.2], col: 0x86624a },
      { k: 'ell', bone: 'body', c: [0.3, 0.88], r: [0.13, 0.17, 0.17], col: 0x8e6a4a },
      { k: 'ell', bone: 'tail', c: [-0.56, 1.06], r: [0.06, 0.1, 0.05], col: 0xf0e2c8, rot: 0.5 },
      { k: 'tube', bone: 'neck', pts: [[0.36, 1.05], [0.48, 1.28], [0.58, 1.5]], r: [0.13, 0.085], col: 0x8e6a4a },
      { k: 'ell', bone: 'head', c: [0.68, 1.55], r: [0.16, 0.09, 0.08], col: 0x8e6a4a, rot: -0.35 },
      { k: 'cone', bone: 'head', from: [0.74, 1.52], to: [0.88, 1.44], r: 0.055, col: 0x5a3a26 },
      { k: 'ell', bone: 'head', c: [0.57, 1.66], r: [0.08, 0.035, 0.02], col: 0x7c5a42, rot: 0.7, z: 0.08 },
      { k: 'ell', bone: 'head', c: [0.57, 1.66], r: [0.08, 0.035, 0.02], col: 0x7c5a42, rot: 0.7, z: -0.08 },
      { k: 'tube', bone: 'head', pts: [[0.63, 1.63], [0.61, 1.86], [0.52, 2.02]], r: [0.026, 0.012], col: 0xe6d6b0, z: 0.06 },
      { k: 'tube', bone: 'head', pts: [[0.61, 1.8], [0.72, 1.94]], r: [0.016, 0.008], col: 0xe6d6b0, z: 0.06 },
      { k: 'tube', bone: 'head', pts: [[0.63, 1.63], [0.61, 1.86], [0.52, 2.02]], r: [0.026, 0.012], col: 0xe6d6b0, z: -0.06 },
      { k: 'tube', bone: 'head', pts: [[0.61, 1.8], [0.72, 1.94]], r: [0.016, 0.008], col: 0xe6d6b0, z: -0.06 },
      { k: 'tube', bone: 'legFL', pts: [[0.32, 0.86], [0.36, 0.56], [0.33, 0.36], [0.34, 0.06]], r: [0.09, 0.032], col: 0x6e5240, z: 0.09 },
      { k: 'cone', bone: 'legFL', from: [0.33, 0.07], to: [0.35, 0.0], r: 0.04, col: 0x2a1a12, z: 0.09 },
      { k: 'tube', bone: 'legFR', pts: [[0.32, 0.86], [0.36, 0.56], [0.33, 0.36], [0.34, 0.06]], r: [0.09, 0.032], col: 0x6e5240, z: -0.09 },
      { k: 'cone', bone: 'legFR', from: [0.33, 0.07], to: [0.35, 0.0], r: 0.04, col: 0x2a1a12, z: -0.09 },
      { k: 'tube', bone: 'legBL', pts: [[-0.32, 0.9], [-0.44, 0.6], [-0.48, 0.42], [-0.38, 0.06]], r: [0.13, 0.032], col: 0x6e5240, z: 0.09 },
      { k: 'cone', bone: 'legBL', from: [-0.36, 0.07], to: [-0.35, 0.0], r: 0.04, col: 0x2a1a12, z: 0.09 },
      { k: 'tube', bone: 'legBR', pts: [[-0.32, 0.9], [-0.44, 0.6], [-0.48, 0.42], [-0.38, 0.06]], r: [0.13, 0.032], col: 0x6e5240, z: -0.09 },
      { k: 'cone', bone: 'legBR', from: [-0.36, 0.07], to: [-0.35, 0.0], r: 0.04, col: 0x2a1a12, z: -0.09 },
    ],
    eye: { at: [0.71, 1.58], r: 0.018, bone: 'head' },
  },
  {
    id: 'kit',
    scale: 1,
    bones: {
      body: { at: [0, 0.28] },
      head: { at: [0.24, 0.36], parent: 'body' },
      tail: { at: [-0.2, 0.32], parent: 'body' },
      legF: { at: [0.14, 0.2], parent: 'body' },
      legB: { at: [-0.14, 0.2], parent: 'body' },
    },
    parts: [
      { k: 'ell', bone: 'body', c: [0, 0.29], r: [0.24, 0.12, 0.12], col: 0xc8642c },
      { k: 'ell', bone: 'body', c: [0.14, 0.27], r: [0.1, 0.1, 0.1], col: 0xf2e6d2 },
      { k: 'ell', bone: 'head', c: [0.31, 0.43], r: [0.12, 0.1, 0.1], col: 0xc8642c },
      { k: 'cone', bone: 'head', from: [0.38, 0.41], to: [0.52, 0.38], r: 0.05, col: 0xf2e6d2 },
      { k: 'ell', bone: 'head', c: [0.525, 0.38], r: [0.018, 0.016, 0.018], col: 0x1a1010 },
      { k: 'ell', bone: 'head', c: [0.28, 0.58], r: [0.04, 0.08, 0.02], col: 0xb85626, rot: 0.25, z: 0.06 },
      { k: 'ell', bone: 'head', c: [0.28, 0.58], r: [0.04, 0.08, 0.02], col: 0xb85626, rot: 0.25, z: -0.06 },
      { k: 'tube', bone: 'tail', pts: [[-0.2, 0.32], [-0.36, 0.38], [-0.5, 0.34]], r: [0.06, 0.1], col: 0xc8642c },
      { k: 'ell', bone: 'tail', c: [-0.55, 0.33], r: [0.07, 0.07, 0.07], col: 0xf2e6d2 },
      { k: 'tube', bone: 'legF', pts: [[0.14, 0.2], [0.15, 0.0]], r: [0.035, 0.03], col: 0x3a2418, z: 0.06 },
      { k: 'tube', bone: 'legF', pts: [[0.14, 0.2], [0.15, 0.0]], r: [0.035, 0.03], col: 0x3a2418, z: -0.06 },
      { k: 'tube', bone: 'legB', pts: [[-0.14, 0.2], [-0.15, 0.0]], r: [0.04, 0.03], col: 0x3a2418, z: 0.06 },
      { k: 'tube', bone: 'legB', pts: [[-0.14, 0.2], [-0.15, 0.0]], r: [0.04, 0.03], col: 0x3a2418, z: -0.06 },
    ],
    eye: { at: [0.36, 0.46], r: 0.016, bone: 'head' },
  },
  {
    id: 'hare',
    scale: 1.15,
    bones: {
      body: { at: [0, 0.2] },
      head: { at: [0.17, 0.3], parent: 'body' },
      earL: { at: [0.2, 0.42], parent: 'head' },
      earR: { at: [0.2, 0.42], parent: 'head' },
      tail: { at: [-0.22, 0.25], parent: 'body' },
      legF: { at: [0.12, 0.15], parent: 'body' },
      legB: { at: [-0.1, 0.17], parent: 'body' },
    },
    parts: [
      { k: 'ell', bone: 'body', c: [0, 0.22], r: [0.2, 0.12, 0.11], col: 0x9a7452, rot: 0.12 },
      { k: 'ell', bone: 'body', c: [-0.12, 0.19], r: [0.13, 0.13, 0.12], col: 0x8c6848 },
      { k: 'ell', bone: 'body', c: [0.06, 0.15], r: [0.13, 0.05, 0.08], col: 0xe8d8bc },
      { k: 'ell', bone: 'tail', c: [-0.25, 0.25], r: [0.05, 0.05, 0.05], col: 0xf4ecdc },
      { k: 'ell', bone: 'head', c: [0.24, 0.34], r: [0.1, 0.075, 0.07], col: 0x9a7452, rot: -0.3 },
      { k: 'ell', bone: 'head', c: [0.325, 0.31], r: [0.02, 0.018, 0.02], col: 0x3a2418 },
      { k: 'ell', bone: 'earL', c: [0.17, 0.55], r: [0.035, 0.14, 0.018], col: 0x8c6848, rot: 0.35, z: 0.035 },
      { k: 'ell', bone: 'earL', c: [0.12, 0.66], r: [0.022, 0.04, 0.02], col: 0x2a1a12, rot: 0.35, z: 0.035 },
      { k: 'ell', bone: 'earR', c: [0.17, 0.55], r: [0.035, 0.14, 0.018], col: 0x8c6848, rot: 0.35, z: -0.035 },
      { k: 'ell', bone: 'earR', c: [0.12, 0.66], r: [0.022, 0.04, 0.02], col: 0x2a1a12, rot: 0.35, z: -0.035 },
      { k: 'tube', bone: 'legF', pts: [[0.12, 0.15], [0.14, 0.0]], r: [0.03, 0.022], col: 0x7a5a3e, z: 0.05 },
      { k: 'tube', bone: 'legF', pts: [[0.12, 0.15], [0.14, 0.0]], r: [0.03, 0.022], col: 0x7a5a3e, z: -0.05 },
      { k: 'ell', bone: 'legB', c: [-0.04, 0.02], r: [0.1, 0.022, 0.03], col: 0x7a5a3e, z: 0.08 },
      { k: 'ell', bone: 'legB', c: [-0.04, 0.02], r: [0.1, 0.022, 0.03], col: 0x7a5a3e, z: -0.08 },
    ],
    eye: { at: [0.26, 0.37], r: 0.015, bone: 'head' },
  },
];

/** dash within this horizontal distance of a drawing's foot point unpresses it */
export const UNPRESS = { trigger: 2.0, pop: 0.85 };
/** the heron's lasting gift: land on its back and it flings you up the shelf cliff (vy, m/s; dwell, s) */
export const HERON_FLING = { launch: 13.4, dwell: 0.05, backTop: 0.64, hx: 0.48, hz: 0.3, bowNear: 2.6 };

const creatureMat = (col: number) => new THREE.MeshToonMaterial({ color: col, gradientMap: RAMP_WORLD });

function partGeometry(p: Part, rand: () => number): THREE.BufferGeometry[] {
  if (p.k === 'ell') {
    const g = new THREE.SphereGeometry(1, 18, 12);
    g.scale(p.r[0], p.r[1], p.r[2]);
    g.rotateZ(p.rot ?? 0);
    g.translate(p.c[0], p.c[1], p.z ?? 0);
    return [g];
  }
  if (p.k === 'tube') {
    const curve = new THREE.CatmullRomCurve3(p.pts.map(([x, y]) => new THREE.Vector3(x, y, p.z ?? 0)));
    return [plumeGeometry(curve, (t) => THREE.MathUtils.lerp(p.r[0], p.r[1], t), 14, 8, 0)];
  }
  if (p.k === 'panel') {
    const sh = new THREE.Shape(p.pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: p.depth, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.01, bevelSegments: 1, curveSegments: 4 });
    g.translate(0, 0, (p.z ?? 0) - p.depth / 2);
    return [g];
  }
  if (p.k === 'cone') {
    const len = Math.hypot(p.to[0] - p.from[0], p.to[1] - p.from[1]);
    const g = new THREE.ConeGeometry(p.r, len, 10, 1);
    g.translate(0, len / 2, 0);
    g.rotateZ(Math.atan2(p.to[1] - p.from[1], p.to[0] - p.from[0]) - Math.PI / 2);
    g.translate(p.from[0], p.from[1], p.z ?? 0);
    return [g];
  }
  // spines: tapered cones on the upper/back half of the ellipsoid, swept back
  const out: THREE.BufferGeometry[] = [];
  for (let i = 0; i < p.n; i++) {
    const u = rand() * Math.PI * 2;
    const v = Math.acos(1 - rand() * 1.25);
    const dir = new THREE.Vector3(Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u));
    if (dir.x > 0.55) continue;
    const at = new THREE.Vector3(dir.x * p.r[0], dir.y * p.r[1], dir.z * p.r[2]).add(new THREE.Vector3(p.c[0], p.c[1], 0));
    const g = new THREE.ConeGeometry(0.018, 0.11 + rand() * 0.05, 4, 1);
    g.translate(0, 0.05, 0);
    const out3 = dir.clone().add(new THREE.Vector3(-0.7, 0.1, 0)).normalize();
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), out3));
    g.translate(at.x, at.y, at.z);
    out.push(g);
  }
  return out;
}

/** the drawing: ink silhouette + warm wash on transparent paper, from the profile spec */
function drawProfile(spec: Spec): { tex: THREE.CanvasTexture; w: number; h: number; ox: number; oy: number } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const p of spec.parts) {
    const pts: P2[] = p.k === 'ell' || p.k === 'spines' ? [[p.c[0] - p.r[0] - 0.12, p.c[1] - p.r[1] - 0.12], [p.c[0] + p.r[0] + 0.12, p.c[1] + p.r[1] + 0.12]] : p.k === 'tube' || p.k === 'panel' ? [...p.pts] : [p.from, p.to];
    for (const [x, y] of pts) {
      xs.push(x);
      ys.push(y);
    }
  }
  const pad = 0.1;
  const x0 = Math.min(...xs) - pad;
  const x1 = Math.max(...xs) + pad;
  const y0 = Math.min(...ys) - pad;
  const y1 = Math.max(...ys) + pad;
  const W = 512;
  const H = Math.round((W * (y1 - y0)) / (x1 - x0));
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d')!;
  const k = W / (x1 - x0);
  const X = (x: number) => (x - x0) * k;
  const Y = (y: number) => H - (y - y0) * k;
  const shape = (p: Part, grow: number) => {
    g.beginPath();
    if (p.k === 'ell' || p.k === 'spines') {
      g.ellipse(X(p.c[0]), Y(p.c[1]), p.r[0] * k + grow, p.r[1] * k + grow, -(p.k === 'ell' ? p.rot ?? 0 : 0), 0, Math.PI * 2);
      g.fill();
    } else if (p.k === 'panel') {
      g.lineJoin = 'round';
      g.lineWidth = grow * 2;
      g.moveTo(X(p.pts[0]![0]), Y(p.pts[0]![1]));
      for (const q of p.pts.slice(1)) g.lineTo(X(q[0]), Y(q[1]));
      g.closePath();
      g.fill();
      if (grow > 0) g.stroke();
    } else if (p.k === 'tube') {
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.lineWidth = (p.r[0] + p.r[1]) * k + grow * 2;
      g.moveTo(X(p.pts[0]![0]), Y(p.pts[0]![1]));
      for (const q of p.pts.slice(1)) g.lineTo(X(q[0]), Y(q[1]));
      g.stroke();
    } else {
      const a = Math.atan2(p.to[1] - p.from[1], p.to[0] - p.from[0]);
      const nx = -Math.sin(a) * (p.r * k + grow);
      const ny = Math.cos(a) * (p.r * k + grow);
      g.moveTo(X(p.from[0]) - nx, Y(p.from[1]) + ny);
      g.lineTo(X(p.from[0]) + nx, Y(p.from[1]) - ny);
      g.lineTo(X(p.to[0]) + Math.cos(a) * grow, Y(p.to[1]) - Math.sin(a) * grow);
      g.closePath();
      g.fill();
    }
  };
  // the pressed page: a torn parchment patch, foxed at the edge, the creature inked onto it
  {
    g.save();
    g.beginPath();
    const n = 64;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const tear = 0.9 + 0.06 * Math.sin(a * 7.3) + 0.04 * Math.sin(a * 17.1 + 1.3) + 0.03 * Math.sin(a * 41.7);
      // a squarish page (superellipse) so it reads as paper, not a decal blob
      const cx = Math.sign(Math.cos(a)) * Math.pow(Math.abs(Math.cos(a)), 0.45);
      const cy = Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 0.45);
      const x = W / 2 + cx * (W / 2 - 6) * tear;
      const y = H / 2 + cy * (H / 2 - 6) * tear;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    const grad = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.6);
    grad.addColorStop(0, 'rgba(240,226,196,0.92)');
    grad.addColorStop(1, 'rgba(196,164,118,0.92)');
    g.fillStyle = grad;
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = 'rgba(120,84,50,0.6)';
    g.stroke();
    g.restore();
  }
  // ink: every part a little fat, so overlaps merge into one hand-drawn silhouette
  g.fillStyle = g.strokeStyle = INK_HEX;
  for (const p of spec.parts) shape(p, 3.2);
  // the wash: pale warm paper inside the line, darker where the 3D part is darker
  for (const p of spec.parts) {
    const c = new THREE.Color(p.col).lerp(new THREE.Color(0xe9dcc2), 0.45);
    g.fillStyle = g.strokeStyle = `#${c.getHexString()}`;
    shape(p, 0);
  }
  // spines: a zigzag crest of ink strokes over the back
  for (const p of spec.parts)
    if (p.k === 'spines') {
      g.strokeStyle = INK_HEX;
      g.lineWidth = 2.2;
      g.beginPath();
      for (let i = 0; i <= 22; i++) {
        const a = Math.PI * (0.05 + (i / 22) * 0.95);
        const r = i % 2 ? 1.0 : 1.32;
        const x = X(p.c[0] + Math.cos(a) * p.r[0] * r * 1.05);
        const y = Y(p.c[1] + Math.sin(a) * p.r[1] * r * 1.05);
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
  g.fillStyle = INK_HEX;
  g.beginPath();
  g.arc(X(spec.eye.at[0]), Y(spec.eye.at[1]), Math.max(2.5, spec.eye.r * k), 0, Math.PI * 2);
  g.fill();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, w: x1 - x0, h: y1 - y0, ox: x0, oy: y0 };
}

type Bones = Record<string, THREE.Group>;

function buildCreature(spec: Spec, rand: () => number): { root: THREE.Group; bones: Bones } {
  const root = new THREE.Group();
  const bones: Bones = {};
  // build bones in order so parents exist; each bone group sits at its pivot relative to its parent pivot
  const order = Object.keys(spec.bones);
  for (const name of order) {
    const b = spec.bones[name]!;
    const g = new THREE.Group();
    const parent = b.parent ? bones[b.parent]! : root;
    const pAt = b.parent ? spec.bones[b.parent]!.at : ([0, 0] as P2);
    g.position.set(b.at[0] - pAt[0], b.at[1] - pAt[1], 0);
    parent.add(g);
    bones[name] = g;
  }
  const byBoneCol = new Map<string, THREE.BufferGeometry[]>();
  for (const p of spec.parts) {
    const at = spec.bones[p.bone]!.at;
    for (const g of partGeometry(p, rand)) {
      g.translate(-at[0], -at[1], 0);
      const key = `${p.bone}|${p.col}`;
      (byBoneCol.get(key) ?? byBoneCol.set(key, []).get(key)!).push(g);
    }
  }
  for (const [key, geos] of byBoneCol) {
    const [bone, col] = key.split('|');
    for (const geo of geos) {
      const m = new THREE.Mesh(geo, creatureMat(Number(col)));
      m.castShadow = true;
      const hull = new THREE.Mesh(hullGeometry(geo), inkMaterial(0.012));
      hull.userData.ink = true;
      m.add(hull);
      bones[bone!]!.add(m);
    }
  }
  // eyes: dark beads with a warm glint, both sides
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(spec.eye.r * 1.4, 8, 6), new THREE.MeshBasicMaterial({ color: 0x140c08 }));
    const at = spec.bones[spec.eye.bone]!.at;
    const zr = spec.parts.find((p) => p.k === 'ell' && p.bone === spec.eye.bone) as Extract<Part, { k: 'ell' }> | undefined;
    e.position.set(spec.eye.at[0] - at[0], spec.eye.at[1] - at[1], s * (zr ? zr.r[2] * 0.78 : 0.05));
    bones[spec.eye.bone]!.add(e);
  }
  root.scale.setScalar(spec.scale);
  return { root, bones };
}

type Phase = 'pressed' | 'popping' | 'performing' | 'alive';

/**
 * Sound: a pressed drawing breathes a faint glassy shimmer you can find by ear; the pop is a paper "fwump"
 * and a two-note chime, then the creature's own voice. WebAudio starts on the first key, like the hearth hum.
 */
function createUnpressedAudio() {
  let ac: AudioContext | null = null;
  let master: GainNode;
  const shimmers = new Map<string, GainNode>();
  const start = () => {
    if (ac) return;
    ac = new AudioContext();
    master = ac.createGain();
    master.gain.value = 0.6;
    master.connect(ac.destination);
  };
  addEventListener('keydown', start, { once: true });
  addEventListener('pointerdown', start, { once: true });
  const env = (g: GainNode, t0: number, peak: number, a: number, d: number) => {
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  };
  const tone = (f0: number, f1: number, type: OscillatorType, t0: number, peak: number, a: number, d: number, lp = 4000) => {
    const o = ac!.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(f1, t0 + a + d);
    const f = ac!.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lp;
    const g = ac!.createGain();
    env(g, t0, peak, a, d);
    o.connect(f).connect(g).connect(master);
    o.start(t0);
    o.stop(t0 + a + d + 0.05);
  };
  return {
    /** per-frame: shimmer loudness by distance to each still-pressed drawing (0 when found) */
    shimmer(id: string, k: number) {
      if (!ac) return;
      let g = shimmers.get(id);
      if (!g) {
        g = ac.createGain();
        g.gain.value = 0;
        const f = ac.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 1800 + shimmers.size * 260;
        f.Q.value = 6;
        for (const [hz, det] of [[880, 0], [1320, 2.5], [1760, -1.5]] as const) {
          const o = ac.createOscillator();
          o.type = 'sine';
          o.frequency.value = hz * (1 + shimmers.size * 0.125) + det;
          o.connect(f);
          o.start();
        }
        f.connect(g).connect(master);
        shimmers.set(id, g);
      }
      g.gain.setTargetAtTime(0.018 * k, ac.currentTime, 0.2);
    },
    pop(id: string) {
      if (!ac) return;
      const t = ac.currentTime;
      // paper fwump: a short low-passed noise burst
      const len = Math.floor(ac.sampleRate * 0.35);
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
      const src = ac.createBufferSource();
      src.buffer = buf;
      const f = ac.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(2400, t);
      f.frequency.exponentialRampToValueAtTime(300, t + 0.3);
      const g = ac.createGain();
      env(g, t, 0.35, 0.01, 0.32);
      src.connect(f).connect(g).connect(master);
      src.start(t);
      // two-note chime, a little different per creature
      const root = id === 'hedgehog' ? 784 : id === 'heron' ? 659 : 587;
      tone(root, root, 'sine', t + 0.08, 0.09, 0.01, 1.2);
      tone(root * 1.5, root * 1.5, 'sine', t + 0.26, 0.07, 0.01, 1.4);
      // the creature's voice
      if (id === 'hedgehog') for (const dt of [0.7, 0.86]) tone(1500, 2300, 'sine', t + dt, 0.05, 0.01, 0.07);
      if (id === 'heron') tone(420, 260, 'sawtooth', t + 1.0, 0.06, 0.02, 0.32, 1200);
      if (id === 'deer') tone(700, 520, 'triangle', t + 1.0, 0.05, 0.05, 0.5, 1800);
      if (id === 'hare') for (const dt of [1.1, 1.32]) tone(190, 110, 'sine', t + dt, 0.09, 0.005, 0.12);
      shimmers.get(id)?.gain.setTargetAtTime(0, t, 0.1);
    },
  };
}

const smooth = (a: number, b: number, t: number) => THREE.MathUtils.smoothstep(t, a, b);
/** a springy settle 0 → 1 with one overshoot */
const spring = (t: number) => (t >= 1 ? 1 : 1 - Math.exp(-6 * t) * Math.cos(t * 9.5));

export function buildUnpressed(ctx: OpeningCtx) {
  const { scene, rand } = ctx;
  const floorAt = (x: number, z: number) => {
    const s = ctx.player?.surfaceAt(x, z);
    return s !== undefined && Number.isFinite(s) ? s : ctx.groundH(x, z);
  };

  /** a standing page-stone a drawing is pressed into (its face = local +z) */
  const pageStone = (x: number, z: number, yaw: number, foot: number, w: number, h: number) => {
    const slab = inked(hewn(new THREE.BoxGeometry(w, h, 0.32, 2, 2, 1), rand, 0.05), toon(0x8e8172, { contour: 0.5 }), 0.022, true);
    slab.position.set(x, foot + h / 2 - 0.07, z);
    slab.rotation.y = yaw;
    slab.rotation.z = 0.04;
    scene.add(slab);
    ctx.occluders.push(slab);
    ctx.colliders.push({ kind: 'box', x, z, yaw, hx: w / 2, hz: 0.2, top: foot + h - 0.1 });
  };
  // the far crag's page-stone (the deer is pressed into its face)
  pageStone(UNPRESSED.deer.stone.x, UNPRESSED.deer.stone.z, UNPRESSED.deer.stone.yaw, UNPRESSED.deer.y, 1.5, 1.7);
  // the hare's low waymark stone at the canopy's foot, its face toward the roost
  pageStone(JOGS.hare.stone.x, JOGS.hare.stone.z, UNPRESSED.hare.yaw, ctx.groundH(JOGS.hare.stone.x, JOGS.hare.stone.z), 1.0, 1.1);

  const creatures = SPECS.map((spec) => {
    const at = spec.id === 'kit' ? KIT : UNPRESSED[spec.id];
    const { root, bones } = buildCreature(spec, rand);
    const holder = new THREE.Group();
    holder.position.set(at.x, at.y, at.z);
    holder.rotation.y = at.yaw;
    holder.add(root);
    scene.add(holder);
    root.visible = false;
    // the drawing, a hair off the surface
    const d = drawProfile(spec);
    const paper = new THREE.Mesh(
      new THREE.PlaneGeometry(d.w * spec.scale, d.h * spec.scale),
      new THREE.MeshBasicMaterial({ map: d.tex, transparent: true, depthWrite: false, fog: true, polygonOffset: true, polygonOffsetFactor: -2 }),
    );
    paper.position.set((d.ox + d.w / 2) * spec.scale, (d.oy + d.h / 2) * spec.scale, 0.02);
    holder.add(paper);
    // a few paper flakes that scatter when it peels
    const flakes = Array.from({ length: 14 }, () => {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.05), new THREE.MeshBasicMaterial({ color: 0xeee2c8, side: THREE.DoubleSide, transparent: true }));
      f.visible = false;
      holder.add(f);
      return { m: f, v: new THREE.Vector3(), s: new THREE.Vector3() };
    });
    // the hare's scut glows a little so the white flash carries across the sepia meadow
    if (spec.id === 'hare')
      bones.tail!.traverse((o) => {
        if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshToonMaterial) o.material.emissive.setHex(0x8a7a62);
      });
    // the kit's page is sealed behind the glyph shrine's door until it opens
    paper.visible = spec.id !== 'kit';
    return { spec, at, root, bones, holder, paper, flakes, phase: 'pressed' as Phase, t: 0, idleSeed: rand() * 10, userFrom: null as THREE.Vector3 | null, gait: 0, arrived: null as number | null, leg: 0, bow: 0 };
  });

  const world = new THREE.Vector3();
  const local = new THREE.Vector3();
  const audio = createUnpressedAudio();

  function unpress(id: string): boolean {
    const c = creatures.find((k) => k.spec.id === id);
    if (!c || c.phase !== 'pressed') return false;
    c.phase = 'popping';
    c.t = 0;
    c.root.visible = true;
    audio.pop(c.spec.id);
    for (const f of c.flakes) {
      f.m.visible = true;
      f.m.position.set((rand() - 0.2) * 0.8 * c.spec.scale, (0.2 + rand() * 1.3) * c.spec.scale, 0.05);
      f.v.set((rand() - 0.5) * 1.4, 0.6 + rand() * 1.2, 0.8 + rand() * 1.4);
      f.s.set(rand() * 8, rand() * 8, rand() * 8);
    }
    return true;
  }

  // ---- performances: t from the start of 'performing'; return true when done
  const B = (c: (typeof creatures)[number], n: string) => c.bones[n]!;
  /** holder walks/flies from its current spot toward `to` (world xz), facing travel (local +x) */
  function face(c: (typeof creatures)[number], dx: number, dz: number, k: number) {
    // the profile's +x (the creature's nose) turns to face travel
    const want = Math.atan2(-dz, dx);
    c.holder.rotation.y = lerpAngle(c.holder.rotation.y, want, k);
  }
  const lerpAngle = (a: number, b: number, k: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;

  const perform: Partial<Record<Spec['id'], (c: (typeof creatures)[number], t: number, dt: number) => boolean>> = {
    hedgehog(c, t, dt) {
      const s = UNPRESSED.hedgehog.settle;
      // shake off the page, hop down from the wall face, trundle an arc, settle and sniff
      B(c, 'head').rotation.y = t < 0.7 ? Math.sin(t * 28) * 0.35 * (1 - t / 0.7) : 0;
      if (t < 0.7) return false;
      const dx = s.x - c.holder.position.x;
      const dz = s.z - c.holder.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.05) {
        face(c, dx, dz, Math.min(1, dt * 5));
        const step = Math.min(d, dt * 0.9);
        c.holder.position.x += (dx / d) * step;
        c.holder.position.z += (dz / d) * step;
        const patter = t * 22;
        B(c, 'legF').rotation.z = Math.sin(patter) * 0.7;
        B(c, 'legB').rotation.z = -Math.sin(patter) * 0.7;
        B(c, 'body').position.y = 0.16 + Math.abs(Math.sin(patter)) * 0.015;
      }
      const ground = floorAt(c.holder.position.x, c.holder.position.z);
      c.holder.position.y = THREE.MathUtils.damp(c.holder.position.y, ground, 10, dt);
      return d <= 0.05 && t > 2.5;
    },
    heron(c, t, dt) {
      const s = UNPRESSED.heron.settle;
      const o = UNPRESSED.heron.out;
      const head = B(c, 'head');
      const wl = B(c, 'wingL');
      const wr = B(c, 'wingR');
      // 0–0.8 shake the head free; 0.8–1.2 wings open; 1.2–2.6 one flapping hop down to the cliff foot;
      // 2.6–3.2 fold; turn to face out over the meadow
      head.rotation.z = t < 0.8 ? Math.sin(t * 22) * 0.25 * (1 - t / 0.8) : 0;
      const open = smooth(0.8, 1.2, t) * (1 - smooth(2.6, 3.2, t));
      const flap = t > 1.2 && t < 2.7 ? Math.sin((t - 1.2) * 11) : 0;
      wl.rotation.x = -(0.15 + 1.25 * open + flap * 0.75 * open);
      wr.rotation.x = 0.15 + 1.25 * open + flap * 0.75 * open;
      B(c, 'legL').rotation.z = B(c, 'legR').rotation.z = smooth(1.3, 1.6, t) * (1 - smooth(2.3, 2.6, t)) * 0.9;
      if (t < 1.2) return false;
      const u = smooth(1.2, 2.6, t);
      const from = c.userFrom ?? (c.userFrom = c.holder.position.clone());
      const to = new THREE.Vector3(s.x, s.y, s.z);
      const mid = from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, 1.2, 0));
      const a = from.clone().lerp(mid, u);
      const b = mid.clone().lerp(to, u);
      c.holder.position.copy(a.lerp(b, u));
      c.holder.position.y += flap * 0.04 * (1 - u);
      if (t < 2.6) face(c, to.x - from.x, to.z - from.z, Math.min(1, dt * 4));
      else face(c, o.x, o.z, Math.min(1, dt * 3));
      B(c, 'body').rotation.z = (1 - smooth(2.3, 2.7, t)) * smooth(1.2, 1.5, t) * -0.2;
      return t > 3.8;
    },
    deer(c, t, dt) {
      const path = UNPRESSED.deer.path;
      const s = path[Math.min(c.leg, path.length - 1)]!;
      // step out of the stone, walk to the far edge, look up at the Crown, lower the head to graze
      B(c, 'head').rotation.z = t < 0.7 ? Math.sin(t * 18) * 0.12 * (1 - t / 0.7) : 0;
      B(c, 'tail').rotation.z = Math.sin(t * 9) * 0.3;
      if (t < 0.7) return false;
      const dx = s.x - c.holder.position.x;
      const dz = s.z - c.holder.position.z;
      const d = Math.hypot(dx, dz);
      if (d <= 0.06 && c.leg < path.length - 1) c.leg++;
      const walking = d > 0.06 || c.leg < path.length - 1;
      if (walking && d > 0.001) {
        face(c, dx, dz, Math.min(1, dt * 4));
        const step = Math.min(d, dt * 0.85);
        c.holder.position.x += (dx / d) * step;
        c.holder.position.z += (dz / d) * step;
        c.gait += dt * 6.2;
      }
      const g = c.gait;
      const amp = walking ? 0.45 : 0;
      B(c, 'legFL').rotation.z = Math.sin(g) * amp;
      B(c, 'legBR').rotation.z = Math.sin(g) * amp;
      B(c, 'legFR').rotation.z = -Math.sin(g) * amp;
      B(c, 'legBL').rotation.z = -Math.sin(g) * amp;
      B(c, 'body').position.y = 0.95 + (walking ? Math.abs(Math.cos(g)) * 0.025 : 0);
      // the crag top is flat: stay on it (its page-stone collider must not lift the deer)
      c.holder.position.y = UNPRESSED.deer.y;
      if (walking) return false;
      // arrived: turn toward the Crown (due south down the vista gap) and look, then graze
      c.arrived = c.arrived ?? t;
      const at = t - c.arrived;
      face(c, -0.05, -1, Math.min(1, dt * 2));
      B(c, 'neck').rotation.z = smooth(0.2, 1.0, at) * 0.18 - smooth(3.0, 4.2, at) * 0.95;
      return at > 4.4;
    },
  };

  perform.kit = (c, t, dt) => {
    // shake free, look at the fox, then trot home across the meadow and curl up by the well
    // a quick shake, then a bound out through the door into open ground before it looks back at the fox
    B(c, 'head').rotation.z = t < 0.35 ? Math.sin(t * 40) * 0.25 * (1 - t / 0.35) : 0;
    B(c, 'tail').rotation.z = Math.sin(t * 7) * 0.35;
    if (t < 0.35) return false;
    const path = KIT.path;
    const s = path[Math.min(c.leg, path.length - 1)]!;
    const dx = s.x - c.holder.position.x;
    const dz = s.z - c.holder.position.z;
    const d = Math.hypot(dx, dz);
    const advanced = d <= 0.15 && c.leg < path.length - 1;
    if (advanced) c.leg++;
    const moving = d > 0.15 || advanced;
    if (moving && d > 0.001) {
      face(c, dx, dz, Math.min(1, dt * 6));
      const step = Math.min(d, dt * 2.2);
      c.holder.position.x += (dx / d) * step;
      c.holder.position.z += (dz / d) * step;
      c.gait += dt * 14;
    }
    const sw = moving ? Math.sin(c.gait) * 0.8 : 0;
    B(c, 'legF').rotation.z = sw;
    B(c, 'legB').rotation.z = -sw;
    B(c, 'body').position.y = 0.28 + (moving ? Math.abs(Math.sin(c.gait)) * 0.035 : 0);
    c.holder.position.y = THREE.MathUtils.damp(c.holder.position.y, floorAt(c.holder.position.x, c.holder.position.z), 12, dt);
    return !moving;
  };

  perform.hare = (c, t, dt) => {
    // shake off the page, sit up and look at the fox, then lope ahead along the jog; lag and it sits up and
    // looks back for you; at the end it sits at the ruin's entry facing the paper
    B(c, 'head').rotation.z = t < 0.5 ? Math.sin(t * 34) * 0.22 * (1 - t / 0.5) : 0;
    B(c, 'earL').rotation.x = B(c, 'earR').rotation.x = t < 0.5 ? Math.sin(t * 40) * 0.3 : 0;
    const fox = ctx.fox.root.position;
    const path = UNPRESSED.hare.path;
    const s = path[Math.min(c.leg, path.length - 1)]!;
    const dx = s.x - c.holder.position.x;
    const dz = s.z - c.holder.position.z;
    const d = Math.hypot(dx, dz);
    const advanced = d <= 0.2 && c.leg < path.length - 1;
    if (advanced) c.leg++;
    const end = c.leg === path.length - 1 && d <= 0.2;
    const near = Math.hypot(fox.x - c.holder.position.x, fox.z - c.holder.position.z) < JOGS.lead;
    // it goes once it has seen you (1.1 s), keeps a lead, and holds while you lag
    const moving = t > 1.1 && !end && (near || c.gait % (Math.PI * 2) > 0.4);
    if (moving && d > 0.001) {
      face(c, dx, dz, Math.min(1, dt * 7));
      const step = Math.min(d, dt * 3.6);
      c.holder.position.x += (dx / d) * step;
      c.holder.position.z += (dz / d) * step;
      c.gait += dt * 11;
    } else c.gait = 0;
    // the bound: hind legs drive, the body arcs, forelegs reach for the landing
    const g = c.gait;
    const air = moving ? Math.max(0, Math.sin(g)) : 0;
    B(c, 'legB').rotation.z = moving ? -0.9 * Math.sin(g + 0.6) : 0;
    B(c, 'legF').rotation.z = moving ? 0.8 * Math.sin(g - 0.5) : 0;
    // waiting: sit up tall, ears up, head turned back toward the fox
    c.bow = THREE.MathUtils.damp(c.bow, moving ? 0 : 1, 6, dt);
    B(c, 'body').position.y = 0.2 + air * 0.12;
    B(c, 'body').rotation.z = (moving ? Math.cos(g) * 0.16 : 0) + c.bow * 0.5;
    B(c, 'head').rotation.z -= c.bow * 0.42;
    const look = end ? JOGS.look : fox;
    const rel = Math.atan2(-(look.z - c.holder.position.z), look.x - c.holder.position.x) - c.holder.rotation.y;
    B(c, 'head').rotation.y = THREE.MathUtils.clamp(Math.atan2(Math.sin(rel), Math.cos(rel)), -1.3, 1.3) * c.bow;
    // the scut flashes white on every bound: what you follow at range
    B(c, 'tail').rotation.z = Math.sin(t * 6) * 0.2 + air * 0.7;
    B(c, 'tail').scale.setScalar(1 + air * 0.9);
    c.holder.position.y = THREE.MathUtils.damp(c.holder.position.y, floorAt(c.holder.position.x, c.holder.position.z), 12, dt);
    if (!end) return false;
    face(c, JOGS.look.x - c.holder.position.x, JOGS.look.z - c.holder.position.z, Math.min(1, dt * 3));
    c.arrived = c.arrived ?? t;
    return t - c.arrived > 1.2;
  };

  const idle: Record<Spec['id'], (c: (typeof creatures)[number], t: number) => void> = {
    hedgehog(c, t) {
      // snuffle: quick nose bobs in bursts, the odd look round
      const burst = Math.max(0, Math.sin(t * 0.9 + c.idleSeed));
      B(c, 'head').rotation.z = Math.sin(t * 18) * 0.08 * burst - 0.05;
      B(c, 'head').rotation.y = Math.sin(t * 0.37 + c.idleSeed) * 0.35;
      B(c, 'body').scale.y = 1 + Math.sin(t * 3.1) * 0.02;
    },
    heron(c, t) {
      if (fling >= 0) {
        // the fling: crouch under the fox, then a great downstroke as it throws you up
        const u = fling;
        const crouch = Math.sin(Math.min(1, u / 0.35) * Math.PI);
        B(c, 'body').position.y = 1.0 - c.bow * 0.38 - crouch * 0.1;
        const stroke = smooth(0, 0.12, u) * (1 - smooth(0.25, 0.8, u));
        B(c, 'wingL').rotation.x = -(0.15 + c.bow * 1.3 + 0.9 * stroke);
        B(c, 'wingR').rotation.x = 0.15 + c.bow * 1.3 + 0.9 * stroke;
        B(c, 'neck').rotation.z = -crouch * 0.3;
        return;
      }
      // the fox comes close: the heron bows low and spreads its back, offering the lift
      const fx = ctx.fox.root.position;
      const near = 1 - THREE.MathUtils.smoothstep(Math.hypot(fx.x - c.holder.position.x, fx.z - c.holder.position.z), 1.2, HERON_FLING.bowNear);
      c.bow = THREE.MathUtils.damp(c.bow, near, 5, 1 / 60);
      B(c, 'body').position.y = 1.0 - c.bow * 0.38;
      B(c, 'legL').rotation.z = B(c, 'legR').rotation.z = -c.bow * 0.5;
      if (c.bow > 0.05) {
        B(c, 'neck').rotation.z = -c.bow * 0.55;
        B(c, 'head').rotation.z = c.bow * 0.5;
        // wings spread flat to either side: a feathered step under the fox's paws
        B(c, 'wingL').rotation.x = -(0.15 + c.bow * 1.3);
        B(c, 'wingR').rotation.x = 0.15 + c.bow * 1.3;
        return;
      }
      // still as a heron: slow neck sway, a preen every few seconds, a weight shift
      const preen = smooth(0, 0.3, Math.sin(t * 0.45 + c.idleSeed));
      B(c, 'neck').rotation.z = Math.sin(t * 0.6) * 0.05 - preen * 0.9;
      B(c, 'head').rotation.z = preen * 0.9 + Math.sin(t * 7) * 0.08 * preen;
      B(c, 'body').rotation.z = Math.sin(t * 0.3) * 0.03;
      B(c, 'wingL').rotation.x = -0.15 - preen * 0.15;
    },
    kit(c, t) {
      // curled up asleep by the well: tucked head, tail wrapped round, slow breathing
      c.bow = THREE.MathUtils.damp(c.bow, 1, 2, 1 / 60);
      const tuck = c.bow;
      B(c, 'body').position.y = 0.28 - 0.1 * tuck;
      B(c, 'body').scale.y = 1 - 0.18 * tuck + Math.sin(t * 1.7) * 0.03;
      B(c, 'head').rotation.z = -0.55 * tuck;
      B(c, 'head').rotation.y = 0.5 * tuck;
      B(c, 'tail').rotation.y = -1.6 * tuck;
      B(c, 'legF').rotation.z = -1.2 * tuck;
      B(c, 'legB').rotation.z = 1.2 * tuck;
    },
    hare(c, t) {
      // sits at the ruin's entry: nose twitches, ear flicks, a face-wash every few seconds; watches the fox near
      const fx = ctx.fox.root.position;
      const dx = fx.x - c.holder.position.x;
      const dz = fx.z - c.holder.position.z;
      const watch = 1 - THREE.MathUtils.smoothstep(Math.hypot(dx, dz), 2.5, 5);
      const rel = Math.atan2(-dz, dx) - c.holder.rotation.y;
      c.bow = THREE.MathUtils.damp(c.bow, watch, 3, 1 / 60);
      const wash = smooth(0, 0.25, Math.sin(t * 0.5 + c.idleSeed)) * (1 - c.bow);
      B(c, 'body').position.y = 0.2;
      B(c, 'body').rotation.z = 0.35 + c.bow * 0.15 + Math.sin(t * 2.4) * 0.015;
      B(c, 'head').rotation.y = THREE.MathUtils.clamp(Math.atan2(Math.sin(rel), Math.cos(rel)), -1.3, 1.3) * c.bow;
      B(c, 'head').rotation.z = -0.3 - c.bow * 0.12 - wash * 0.35 + Math.sin(t * 19) * 0.02;
      B(c, 'legF').rotation.z = wash * (1.4 + Math.sin(t * 9) * 0.25);
      const flick = Math.max(0, Math.sin(t * 1.3 + c.idleSeed * 2)) ** 12;
      B(c, 'earL').rotation.x = flick * 0.5;
      B(c, 'earR').rotation.x = -(Math.max(0, Math.sin(t * 1.1 + c.idleSeed)) ** 12) * 0.5;
      B(c, 'tail').rotation.z = 0;
      B(c, 'tail').scale.setScalar(1);
    },
    deer(c, t) {
      // graze, lift the head, chew, ear flicks and tail flicks
      // when the fox is near it stops grazing and watches it, head turned (a companion, not scenery)
      const fx = ctx.fox.root.position;
      const dx = fx.x - c.holder.position.x;
      const dz = fx.z - c.holder.position.z;
      const watch = 1 - THREE.MathUtils.smoothstep(Math.hypot(dx, dz), 3.5, 7);
      const rel = Math.atan2(-dz, dx) - c.holder.rotation.y;
      const turn = THREE.MathUtils.clamp(Math.atan2(Math.sin(rel), Math.cos(rel)), -1.1, 1.1);
      c.bow = THREE.MathUtils.damp(c.bow, watch, 3, 1 / 60);
      B(c, 'neck').rotation.y = turn * 0.6 * c.bow;
      B(c, 'head').rotation.y = turn * 0.4 * c.bow;
      const up = Math.max(c.bow, smooth(0.2, 0.8, Math.sin(t * 0.35 + c.idleSeed)));
      B(c, 'neck').rotation.z = -0.95 + up * 1.05;
      B(c, 'head').rotation.z = Math.sin(t * 5) * 0.04 * (1 - up);
      B(c, 'tail').rotation.z = Math.max(0, Math.sin(t * 2.3 + 1)) * 0.5;
    },
  };

  let heronBack: Collider | null = null;
  let onBack = 0;
  let fling = -1;
  let flings = 0;
  /** onGroundContact hook (controller's supported-top spring): the heron's back flings the fox up */
  function contact(at: THREE.Vector3, _arrival: number, _held: boolean, dt: number): number | null {
    const h = creatures.find((k) => k.spec.id === 'heron')!;
    if (!heronBack || h.phase !== 'alive') return null;
    local.copy(at).sub(h.holder.position).applyAxisAngle(new THREE.Vector3(0, 1, 0), -h.holder.rotation.y);
    const on = Math.abs(local.x) < HERON_FLING.hx && Math.abs(local.z) < HERON_FLING.hz && Math.abs(at.y - (h.holder.position.y + HERON_FLING.backTop)) < 0.15;
    if (!on) {
      onBack = 0;
      return null;
    }
    onBack += dt;
    if (onBack < HERON_FLING.dwell) return null;
    onBack = 0;
    fling = 0;
    flings++;
    return HERON_FLING.launch;
  }

  let clock = 0;
  ctx.onUpdate((dt) => {
    clock += dt;
    const p = ctx.player?.state() as { dashing?: boolean } | undefined;
    const fox = ctx.fox.root.position;
    for (const c of creatures) {
      if (c.phase === 'pressed') {
        if (!c.paper.visible) continue;
        // a slow warm breath in the wash so a drawing can be spotted as alive
        const m = c.paper.material as THREE.MeshBasicMaterial;
        const breath = 0.5 + 0.5 * Math.sin(clock * 1.6 + c.idleSeed);
        m.color.setRGB(1, 0.93 + 0.07 * breath, 0.84 + 0.12 * breath);
        m.opacity = 0.82 + 0.18 * breath;
        const dist = Math.hypot(fox.x - c.at.x, fox.z - c.at.z);
        audio.shimmer(c.spec.id, (1 - THREE.MathUtils.smoothstep(dist, 2, 12)) * (0.6 + 0.4 * breath));
        if (p?.dashing && Math.hypot(fox.x - c.at.x, fox.z - c.at.z) < UNPRESS.trigger && Math.abs(fox.y - c.at.y) < 2.2) unpress(c.spec.id);
        continue;
      }
      c.t += dt;
      if (c.phase === 'popping') {
        // the page peels: the drawing fades as the body inflates from flat to round, squash-and-stretch
        const u = c.t / UNPRESS.pop;
        (c.paper.material as THREE.MeshBasicMaterial).opacity = 1 - smooth(0, 0.45, u);
        const depth = Math.max(0.03, spring(u));
        c.root.scale.set(c.spec.scale * (1 + (1 - depth) * 0.12), c.spec.scale * (1 - (1 - depth) * 0.1), c.spec.scale * depth);
        const half = c.spec.id === 'heron' ? 0.2 : c.spec.id === 'deer' ? 0.22 : 0.18;
        c.root.position.z = half * c.spec.scale * depth;
        for (const f of c.flakes) {
          f.v.y -= dt * 2.2;
          f.m.position.addScaledVector(f.v, dt);
          f.m.rotation.x += f.s.x * dt;
          f.m.rotation.y += f.s.y * dt;
          (f.m.material as THREE.MeshBasicMaterial).opacity = 1 - smooth(0.5, 1.4, u);
        }
        if (u >= 1.6) {
          c.phase = 'performing';
          c.t = 0;
          c.paper.visible = false;
          for (const f of c.flakes) f.m.visible = false;
          // re-seat the body on the holder origin so it can turn freely about its own feet
          c.holder.getWorldPosition(world);
          local.set(0, 0, c.root.position.z).applyQuaternion(c.holder.quaternion);
          c.holder.position.add(local);
          c.root.position.set(0, 0, 0);
          c.root.scale.setScalar(c.spec.scale);
        }
        continue;
      }
      if (c.phase === 'performing') {
        if (perform[c.spec.id]!(c, c.t, dt)) {
          c.phase = 'alive';
          c.t = 0;
          if (c.spec.id === 'heron') {
            // its back: a one-way top (hop up onto it from any side; walking under it never snags)
            const back = { kind: 'box' as const, x: c.holder.position.x, z: c.holder.position.z, yaw: c.holder.rotation.y, hx: HERON_FLING.hx, hz: HERON_FLING.hz, top: c.holder.position.y + HERON_FLING.backTop, oneWay: true };
            heronBack = back;
            ctx.colliders.push(back);
          }
        }
        continue;
      }
      idle[c.spec.id](c, clock);
    }
    if (fling >= 0 && (fling += dt) > 0.9) fling = -1;
  });

  /** the glyph shrine opened: its sealed page fades in and becomes findable */
  function unlock(id: string): void {
    const c = creatures.find((k) => k.spec.id === id);
    if (!c || c.paper.visible) return;
    c.paper.visible = true;
  }

  return {
    unpress,
    unlock,
    contact,
    state() {
      return {
        flings,
        found: creatures.filter((c) => c.phase !== 'pressed').map((c) => c.spec.id),
        creatures: creatures.map((c) => ({ id: c.spec.id, phase: c.phase, t: +c.t.toFixed(2), at: c.holder.position.toArray().map((v) => +v.toFixed(2)) })),
      };
    },
  };
}
