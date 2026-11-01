/**
 * Lanternhollow in the Pressed Ink → Living Cel kit: chunky timber-and-plaster cottages under thick
 * thatch or slate roofs, the Great Well, the cold village fire-pit, flagstone lanes, wattle fences,
 * festoon lanterns and doorstep clutter. Big readable shapes (Legends: Arceus prop language); every
 * prop is merged per ink weight into a few vertex-coloured toon meshes with ink hulls.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildMaple, hewn, inked, jitter, toon } from '../lookdevKit';
import type { OpeningCtx } from './scene';
import { HOUSES, PATHS, WELL } from './layout';

/** Muted so the fox stays the hottest note: dusty plaster, umber timber, olive thatch, blue slate */
const C = {
  plaster: 0xd6c4a2,
  plasterWarm: 0xcdb48e,
  timber: 0x5a3f2e,
  timberDark: 0x3d2a20,
  stone: 0x8a8274,
  stoneDark: 0x6b6358,
  stoneCool: 0x6e6d69,
  stoneField: 0x5f584f,
  cloth: [0xb9ab90, 0x8d6f62, 0x7d8088],
  thatch: 0x8d7a52,
  thatchDark: 0x6c5d40,
  slate: 0x5d5c66,
  slateDark: 0x4a4952,
  amber: 0xe6a65a,
  door: 0x6b4a32,
  flag: 0x9b917d,
  bloom: [0x9a4f3c, 0xa8834a, 0x7d5a6a],
  leaf: 0x5d6040,
  rope: 0x8a7357,
};

type V3 = [number, number, number];
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();

/** Collects parts as vertex-coloured, world-placed geometry; one inked toon mesh per ink weight */
class Kit {
  private buckets = new Map<number, THREE.BufferGeometry[]>();
  /** parent transform for following adds */
  frame = new THREE.Matrix4();

  add(geo: THREE.BufferGeometry, color: number, at: V3, rot: V3 = [0, 0, 0], ink = 0.016, scale: V3 = [1, 1, 1]): void {
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (g.getAttribute('uv')) g.deleteAttribute('uv');
    if (g.getAttribute('uv1')) g.deleteAttribute('uv1');
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const c = new THREE.Color(color);
    const n = g.getAttribute('position').count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    tmpM.compose(new THREE.Vector3(...at), tmpQ.setFromEuler(tmpE.set(...rot)), new THREE.Vector3(...scale));
    g.applyMatrix4(tmpM.premultiply(this.frame));
    const list = this.buckets.get(ink) ?? [];
    list.push(g);
    this.buckets.set(ink, list);
  }

  /** run `fn` with parts placed relative to (x, y, z, yaw) */
  at(x: number, y: number, z: number, yaw: number, fn: () => void): void {
    const prev = this.frame.clone();
    this.frame.multiply(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), tmpQ.setFromEuler(tmpE.set(0, yaw, 0)), new THREE.Vector3(1, 1, 1)));
    fn();
    this.frame.copy(prev);
  }

  build(): THREE.Group {
    const g = new THREE.Group();
    for (const [ink, list] of this.buckets) g.add(inked(mergeGeometries(list)!, kitMaterial(), ink));
    this.buckets.clear();
    return g;
  }
}
let kitMat: THREE.MeshToonMaterial | null = null;
const kitMaterial = () => (kitMat ??= toon(0xffffff, { vertexColors: true }));

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
function cyl(rt: number, rb: number, h: number, seg = 8, axis: 'x' | 'y' | 'z' = 'y'): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  if (axis === 'x') g.rotateZ(Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  return g;
}

/** triangle prism across x: base `d` (z), apex `h`, thickness `t` */
function gable(d: number, h: number, t: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-d / 2, 0);
  s.lineTo(d / 2, 0);
  s.lineTo(0, h);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false });
  g.translate(0, 0, -t / 2);
  g.rotateY(Math.PI / 2);
  return g;
}

/** round-topped slab in the xy plane */
function archSlab(w: number, h: number, t: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const r = w / 2;
  s.moveTo(-r, 0);
  s.lineTo(r, 0);
  s.lineTo(r, h - r);
  s.absarc(0, h - r, r, 0, Math.PI, false);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 10 });
  g.translate(0, 0, -t / 2);
  return g;
}

/** window facing +z at the kit frame: amber pane, cross mullion, sill, open shutters, optional flower box */
function windowUnit(k: Kit, rand: () => number, flowers: boolean): void {
  k.add(box(0.8, 0.72, 0.06), C.amber, [0, 0, 0.0]);
  k.add(box(0.07, 0.72, 0.09), C.timber, [0, 0, 0.04]);
  k.add(box(0.8, 0.07, 0.09), C.timber, [0, 0.02, 0.04]);
  k.add(box(0.98, 0.14, 0.2), C.timber, [0, -0.42, 0.08]);
  k.add(box(0.96, 0.12, 0.12), C.timberDark, [0, 0.42, 0.05]);
  for (const s of [-1, 1]) k.add(box(0.36, 0.82, 0.06), C.door, [s * 0.66, 0, 0.12], [0, s * 0.5, 0]);
  if (flowers) {
    k.add(box(0.9, 0.2, 0.24), C.timberDark, [0, -0.58, 0.16]);
    for (let i = 0; i < 4; i++) k.add(jitter(new THREE.IcosahedronGeometry(0.13, 0), 0.2, rand), i % 2 ? C.leaf : C.bloom[i % 3]!, [-0.3 + i * 0.2, -0.43, 0.17]);
  }
}

/** thatch course slab (local z = down-slope when `sz` = +1): lumpy top, scalloped fringe at the eave end */
function thatchCourse(w: number, t: number, len: number, sz: number, rand: () => number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, t, len, Math.ceil(w / 0.18), 1, 3);
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  const o = rand() * 10;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i) * sz;
    const bump = Math.sin(x * 2.1 + o) * Math.sin(z * 3.3 + o) * 0.035;
    if (y > 0) p.setY(i, y + bump);
    if (z > len / 2 - 1e-3) {
      // combed fringe: scallops every ~0.45 m, the tips droop
      const sc = Math.abs(Math.sin(x * 7 + o));
      p.setZ(i, (z + 0.09 * sc) * sz);
      p.setY(i, p.getY(i) - 0.07 * sc);
    }
  }
  g.computeVertexNormals();
  return g;
}

type House = (typeof HOUSES)[number];

function cottage(k: Kit, ctx: OpeningCtx, h: House, index: number): number {
  const { rand } = ctx;
  const corners = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => ctx.groundH(h.x + (sx * h.w) / 2, h.z + (sz * h.d) / 2)));
  const y0 = Math.min(...corners);
  const { w, d, eave, rise } = h;
  const slate = index % 3 === 1;
  const stoneLower = index % 2 === 1;
  const plaster = index % 2 ? C.plasterWarm : C.plaster;
  const base = 0.55;
  const wallTop = base + eave;
  k.at(h.x, y0, h.z, 0, () => {
    // footing: a sunk hewn plinth wrapped in chunky field stones
    k.add(hewn(box(w + 0.45, 1.3, d + 0.45), rand, 0.03), C.stoneDark, [0, base - 0.65, 0], [0, 0, 0], 0.022);
    const per = (len: number, fn: (t: number, s: number) => void) => {
      const n = Math.max(2, Math.round(len / 0.75));
      for (let i = 0; i < n; i++) fn((i + 0.5) / n - 0.5, len / n);
    };
    // chunky, half-sunk field stones round the plinth (darker than the wall so the wall stays the light plane)
    const field = (x: number, z: number, r: number) =>
      k.add(jitter(new THREE.DodecahedronGeometry(r, 0), 0.18, rand), rand() < 0.4 ? C.stoneDark : rand() < 0.5 ? C.stoneField : C.stoneCool, [x, base - 0.42 + r * 0.35, z], [rand(), rand() * 6, rand()], 0.02, [1.25, 0.8, 1.1]);
    for (const sz of [-1, 1]) per(w + 0.5, (t) => field(t * (w + 0.5) + (rand() - 0.5) * 0.15, sz * (d / 2 + 0.2), 0.3 + rand() * 0.14));
    for (const sx of [-1, 1]) per(d + 0.1, (t) => field(sx * (w / 2 + 0.2), t * (d + 0.1) + (rand() - 0.5) * 0.15, 0.3 + rand() * 0.14));

    // walls (slightly bowed); some cottages keep a rubble-stone ground storey
    k.add(jitter(new THREE.BoxGeometry(w, eave, d, 4, 3, 3), 0.01, rand), plaster, [0, base + eave / 2, 0], [0, 0, 0], 0.016);
    if (stoneLower) {
      const courses = 3;
      for (let c = 0; c < courses; c++) {
        const yy = base + 0.18 + c * 0.32;
        for (const sz of [-1, 1]) per(w, (t, s) => k.add(hewn(box(s * 0.92, 0.3, 0.12), rand, 0.06), rand() < 0.5 ? C.stone : C.stoneDark, [t * w + (c % 2) * 0.15, yy, sz * (d / 2 + 0.04)], [0, 0, 0], 0.014));
        for (const sx of [-1, 1]) per(d, (t, s) => k.add(hewn(box(0.12, 0.3, s * 0.92), rand, 0.06), rand() < 0.5 ? C.stone : C.stoneDark, [sx * (w / 2 + 0.04), yy, t * d], [0, 0, 0], 0.014));
      }
    }

    // timber frame
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.add(box(0.22, eave + 0.1, 0.22), C.timber, [(sx * w) / 2, base + eave / 2, (sz * d) / 2]);
    for (const sz of [-1, 1]) {
      k.add(box(w + 0.14, 0.2, 0.18), C.timber, [0, wallTop - 0.1, (sz * d) / 2 + 0.03]);
      if (!stoneLower) k.add(box(w + 0.14, 0.16, 0.16), C.timber, [0, base + 0.12, (sz * d) / 2 + 0.03]);
      k.add(box(w + 0.1, 0.12, 0.12), C.timber, [0, base + eave * 0.52, (sz * d) / 2 + 0.04]);
    }
    for (const sx of [-1, 1]) {
      k.add(box(0.18, 0.2, d + 0.14), C.timber, [(sx * w) / 2 + 0.03, wallTop - 0.1, 0]);
      // end-wall cross braces in the upper bay
      const bh = eave * 0.42;
      const len = Math.hypot(d * 0.5, bh);
      const ang = Math.atan2(d * 0.5, bh);
      for (const s of [-1, 1]) k.add(box(0.1, len, 0.1), C.timber, [(sx * w) / 2 + 0.05, base + eave * 0.52 + bh / 2, s * d * 0.25], [s * ang, 0, 0]);
    }

    // gables (on the x ends) with a king post and a round attic window
    for (const sx of [-1, 1]) {
      k.at((sx * (w - 0.06)) / 2, wallTop, 0, 0, () => {
        k.add(gable(d + 0.1, rise, 0.14), plaster, [0, 0, 0]);
        k.add(box(0.16, rise * 0.85, 0.14), C.timber, [sx * 0.05, rise * 0.42, 0]);
        k.add(cyl(0.26, 0.26, 0.1, 12, 'x'), C.timberDark, [sx * 0.08, rise * 0.4, 0]);
        k.add(cyl(0.19, 0.19, 0.1, 12, 'x'), C.amber, [sx * 0.11, rise * 0.4, 0]);
      });
    }

    // roof: thick slabs with a big overhang, rolled thatch eaves + ridge, or slate courses
    const over = 0.6;
    const half = d / 2 + over;
    const slope = Math.atan2(rise, d / 2);
    const run = half / Math.cos(slope);
    const thick = slate ? 0.24 : 0.3;
    const tone = slate ? C.slate : C.thatch;
    const toneDark = slate ? C.slateDark : C.thatchDark;
    // t: 0 at the ridge → 1 at the eave edge; ySurf = the gable line extended under the overhang
    const ySurf = (t: number) => wallTop + rise - Math.tan(slope) * half * t;
    for (const sz of [-1, 1]) {
      const zAt = (t: number) => sz * half * t;
      if (slate) {
        k.add(hewn(new THREE.BoxGeometry(w + over * 2, thick, run, 5, 1, 4), rand, 0.012), tone, [0, ySurf(0.5) + thick / 2, zAt(0.5)], [sz * slope, 0, 0], 0.024);
        for (const t of [0.22, 0.42, 0.62, 0.82]) k.add(box(w + over * 2 + 0.02, 0.06, 0.12), toneDark, [0, ySurf(t) + thick + 0.01, zAt(t)], [sz * slope, 0, 0], 0.01);
        k.add(box(w + over * 2 + 0.06, thick + 0.04, 0.14), toneDark, [0, ySurf(1) + thick / 2, zAt(1)], [sz * slope, 0, 0], 0.016);
      } else {
        // three overlapping courses, each lower one proud of the last, each ending in a combed, scalloped fringe
        const bands = [[0, 0.42], [0.34, 0.72], [0.64, 1]] as const;
        bands.forEach(([t0, t1], c) => {
          const tm = (t0 + t1) / 2;
          const wide = w + over * 2 - (2 - c) * 0.06;
          k.add(thatchCourse(wide, thick, run * (t1 - t0), sz, rand), c % 2 ? C.thatchDark : tone, [0, ySurf(tm) + thick / 2 + c * 0.07, zAt(tm)], [sz * slope, 0, 0], c === 2 ? 0.022 : 0.016);
        });
      }
    }
    k.add(jitter(cyl(slate ? 0.17 : 0.36, slate ? 0.17 : 0.36, w + over * 2 + 0.15, 10, 'x'), slate ? 0.01 : 0.05, rand), toneDark, [0, ySurf(0) + thick + (slate ? 0.02 : 0.08), 0], [0, 0, 0], 0.024);

    // front (+z): arched door under a hooded porch, step, one or two windows
    const front = d / 2;
    const doorX = -w * 0.2;
    k.add(archSlab(1.12, 1.92, 0.12), C.timberDark, [doorX, base - 0.02, front + 0.05]);
    k.add(archSlab(0.88, 1.74, 0.12), C.door, [doorX, base, front + 0.1]);
    for (const dx of [-0.22, 0, 0.22]) k.add(box(0.03, 1.5, 0.04), C.timberDark, [doorX + dx, base + 0.8, front + 0.17]);
    k.add(cyl(0.05, 0.05, 0.06, 8, 'z'), C.amber, [doorX + 0.3, base + 0.9, front + 0.18]);
    k.add(hewn(box(1.4, 0.32, 0.7), rand, 0.05), C.stoneField, [doorX, base - 0.2, front + 0.45], [0, 0, 0], 0.02);
    k.at(doorX, base + 2.05, front + 0.35, 0, () => {
      for (const s of [-1, 1]) k.add(hewn(box(0.85, 0.12, 0.75), rand, 0.02), tone, [s * 0.36, 0.18, 0], [0, 0, -s * 0.5], 0.016);
      for (const s of [-1, 1]) k.add(box(0.08, 0.5, 0.08), C.timber, [s * 0.55, -0.12, -0.15], [0.7, 0, 0]);
    });
    k.at(w * 0.24, base + eave * 0.58, front + 0.03, 0, () => windowUnit(k, rand, true));
    // back (−z): two windows
    for (const sx of [-0.25, 0.25]) k.at(sx * w, base + eave * 0.58, -front - 0.03, Math.PI, () => windowUnit(k, rand, false));
    // ends: one window each under the brace
    for (const sx of [-1, 1]) k.at((sx * w) / 2 + sx * 0.03, base + eave * 0.36, d * 0.1, (sx * Math.PI) / 2, () => windowUnit(k, rand, false));

    if (h.chimney) {
      // stacked-stone chimney up the west gable, standing clear of the ridge
      const cx = -w / 2 - 0.35;
      const top = wallTop + rise + 1.0;
      let yy = base - 0.2;
      let s = 0.95;
      while (yy < top) {
        k.add(hewn(box(s, 0.45, s), rand, 0.06), rand() < 0.5 ? C.stone : C.stoneDark, [cx + (rand() - 0.5) * 0.05, yy + 0.22, -d * 0.18 + (rand() - 0.5) * 0.05], [0, (rand() - 0.5) * 0.2, 0], 0.02);
        yy += 0.42;
        s = Math.max(0.68, s - 0.03);
      }
      k.add(hewn(box(0.9, 0.16, 0.9), rand, 0.04), C.stoneDark, [cx, yy + 0.08, -d * 0.18], [0, 0, 0], 0.02);
      k.add(cyl(0.12, 0.14, 0.3, 7), C.stoneDark, [cx + 0.15, yy + 0.3, -d * 0.18 + 0.1]);
    }

    // doorstep clutter: barrel + crates; woodpile under the back eave
    k.add(cyl(0.34, 0.3, 0.78, 10), C.timber, [doorX - 1.0, base - 0.1 + 0.39 - 0.25, front + 0.6], [0, 0, 0], 0.016);
    for (const yy of [0.12, 0.55]) k.add(cyl(0.355, 0.33, 0.06, 10), C.timberDark, [doorX - 1.0, base - 0.35 + yy + 0.1, front + 0.6]);
    k.add(hewn(box(0.6, 0.55, 0.6), rand, 0.03), C.door, [w * 0.42, base - 0.3 + 0.27, front + 0.65], [0, 0.3, 0], 0.016);
    k.add(hewn(box(0.45, 0.4, 0.45), rand, 0.03), C.timber, [w * 0.42 + 0.05, base - 0.3 + 0.75, front + 0.62], [0, -0.2, 0], 0.016);
    for (let row = 0; row < 3; row++)
      for (let i = 0; i < 4 - row; i++)
        k.add(cyl(0.14, 0.14, 0.9, 7, 'z'), i % 2 ? C.timber : C.door, [w * 0.1 + (i - 1.5 + row * 0.5) * 0.29, base - 0.15 + row * 0.25, -front - 0.55], [0, 0, 0], 0.012);
  });
  return y0;
}

function greatWell(k: Kit, ctx: OpeningCtx): void {
  const { rand } = ctx;
  const y = ctx.groundH(WELL.x, WELL.z);
  k.at(WELL.x, y, WELL.z, 0.3, () => {
    for (let ring = 0; ring < 2; ring++)
      for (let i = 0; i < 11; i++) {
        const a = ((i + ring * 0.5) / 11) * Math.PI * 2;
        k.add(hewn(box(0.78, 0.42, 0.5), rand, 0.07), (i + ring) % 3 ? C.stone : C.stoneDark, [Math.sin(a) * 1.28, 0.2 + ring * 0.4, Math.cos(a) * 1.28], [0, a, 0], 0.02);
      }
    for (let i = 0; i < 11; i++) {
      const a = ((i + 0.25) / 11) * Math.PI * 2;
      k.add(hewn(box(0.8, 0.16, 0.6), rand, 0.05), C.stoneCool, [Math.sin(a) * 1.3, 0.9, Math.cos(a) * 1.3], [0, a, 0], 0.02);
    }
    k.add(new THREE.CircleGeometry(1.05, 18).rotateX(-Math.PI / 2), 0x23201f, [0, 0.55, 0], [0, 0, 0], 0.001);
    for (const s of [-1, 1]) {
      k.add(box(0.24, 2.6, 0.24), C.timber, [s * 1.38, 1.3, 0]);
      k.add(box(0.16, 0.9, 0.16), C.timber, [s * 1.38, 0.45, 0.35], [-0.5, 0, 0]);
    }
    k.add(cyl(0.11, 0.11, 3.0, 8, 'x'), C.timberDark, [0, 1.9, 0]);
    k.add(cyl(0.2, 0.2, 0.32, 10, 'x'), C.timber, [0, 1.9, 0]);
    k.add(box(0.08, 0.55, 0.08), C.timberDark, [1.6, 1.68, 0.14], [0, 0, 0.5]);
    k.add(cyl(0.02, 0.02, 0.75, 4), C.rope, [0.0, 1.47, 0.18]);
    k.add(cyl(0.22, 0.17, 0.32, 10), C.timber, [0.0, 0.98, 0.18], [0, 0, 0], 0.016);
    // shingled hood with a rolled ridge
    for (const s of [-1, 1]) k.add(hewn(box(3.5, 0.2, 1.4), rand, 0.025), C.slate, [0, 2.62, s * 0.52], [s * 0.62, 0, 0], 0.022);
    k.add(cyl(0.13, 0.13, 3.6, 8, 'x'), C.slateDark, [0, 2.98, 0]);
    // the stone maple relief that names the Great Well
    k.add(hewn(box(0.7, 0.5, 0.12), rand, 0.03), C.stoneDark, [0, 0.45, 1.58]);
    k.add(new THREE.ExtrudeGeometry(mapleShape(0.22), { depth: 0.05, bevelEnabled: false }), C.stoneCool, [0, 0.46, 1.63]);
  });
}

function mapleShape(s: number): THREE.Shape {
  const pts = [[0, 0.26], [0.055, 0.13], [0.17, 0.2], [0.14, 0.07], [0.27, 0.08], [0.19, -0.03], [0.25, -0.1], [0.07, -0.13], [0.025, -0.17], [0.025, -0.25], [-0.025, -0.25], [-0.025, -0.17], [-0.07, -0.13], [-0.25, -0.1], [-0.19, -0.03], [-0.27, 0.08], [-0.14, 0.07], [-0.17, 0.2], [-0.055, 0.13]];
  const sh = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? sh.lineTo(x! * s * 3.7, y! * s * 3.7) : sh.moveTo(x! * s * 3.7, y! * s * 3.7)));
  sh.closePath();
  return sh;
}

/** the village fire-pit by the plaza: a ring of stones round cold, charred logs (wake-up anchor) */
function firePit(k: Kit, ctx: OpeningCtx, x: number, z: number): void {
  const { rand } = ctx;
  k.at(x, ctx.groundH(x, z), z, 0, () => {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      k.add(hewn(new THREE.DodecahedronGeometry(0.26, 0), rand, 0.15), i % 2 ? C.stone : C.stoneDark, [Math.sin(a) * 0.85, 0.08, Math.cos(a) * 0.85], [0, a, 0], 0.02, [1.2, 0.8, 1]);
    }
    for (let i = 0; i < 4; i++) k.add(cyl(0.09, 0.11, 0.9, 7, 'x'), 0x2f2622, [0, 0.12, 0], [0.25, (i / 4) * Math.PI, 0.35], 0.012);
    // a log bench for the evenings nobody keeps any more
    k.add(cyl(0.2, 0.2, 1.6, 9, 'x'), C.timber, [0, 0.22, -1.9], [0, 0.2, 0], 0.018);
  });
}

function flagstones(ctx: OpeningCtx): THREE.InstancedMesh {
  const { rand } = ctx;
  const stone = hewn(new THREE.CylinderGeometry(0.32, 0.36, 0.12, 7), rand, 0.06);
  const pts: THREE.Matrix4[] = [];
  for (const [ax, az, bx, bz] of PATHS) {
    if (Math.min(az, bz) < 78) continue; // meadow tracks are worn earth, not flagged
    const len = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / len;
    const nz = (bx - ax) / len;
    for (let s = 0.4; s < len; s += 0.55 + rand() * 0.25) {
      const t = s / len;
      const side = (rand() - 0.5) * 1.0;
      const x = ax + (bx - ax) * t + nx * side;
      const z = az + (bz - az) * t + nz * side;
      const sc = 0.75 + rand() * 0.5;
      pts.push(new THREE.Matrix4().compose(new THREE.Vector3(x, ctx.groundH(x, z) - 0.03, z), tmpQ.setFromEuler(tmpE.set(0, rand() * 6, 0)), new THREE.Vector3(sc, 1, sc * (0.8 + rand() * 0.3))));
    }
  }
  const mesh = new THREE.InstancedMesh(stone, toon(C.flag, { hatchWeight: 0.5 }), pts.length);
  pts.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.receiveShadow = true;
  return mesh;
}

function lanternPost(k: Kit, ctx: OpeningCtx, x: number, z: number, yaw: number): THREE.Vector3 {
  const y = ctx.groundH(x, z);
  k.at(x, y, z, yaw, () => {
    k.add(hewn(box(0.4, 0.3, 0.4), ctx.rand, 0.06), C.stoneDark, [0, 0.1, 0], [0, 0, 0], 0.016);
    k.add(box(0.17, 2.5, 0.17), C.timber, [0, 1.25, 0]);
    k.add(box(0.75, 0.13, 0.13), C.timber, [0.3, 2.38, 0]);
    k.add(box(0.08, 0.5, 0.08), C.timber, [0.18, 2.12, 0], [0, 0, -0.8]);
    k.add(box(0.3, 0.38, 0.3), C.amber, [0.55, 2.02, 0]);
    k.add(box(0.36, 0.06, 0.36), C.timberDark, [0.55, 1.82, 0]);
    k.add(new THREE.ConeGeometry(0.28, 0.22, 4), C.timberDark, [0.55, 2.3, 0], [0, Math.PI / 4, 0]);
  });
  return new THREE.Vector3(x, y + 2.4, z);
}

/** sagging string of paper lanterns between two points */
function festoon(k: Kit, a: THREE.Vector3, b: THREE.Vector3, sag: number): void {
  const n = Math.max(4, Math.round(a.distanceTo(b) / 1.1));
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    pts.push(a.clone().lerp(b, t).setY(THREE.MathUtils.lerp(a.y, b.y, t) - sag * 4 * t * (1 - t)));
  }
  k.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.018, 4), C.rope, [0, 0, 0], [0, 0, 0], 0.006);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const p = a.clone().lerp(b, t);
    p.y = THREE.MathUtils.lerp(a.y, b.y, t) - sag * 4 * t * (1 - t) - 0.2;
    k.add(new THREE.SphereGeometry(0.13, 8, 6).scale(1, 1.25, 1), i % 3 === 1 ? C.bloom[0]! : C.amber, [p.x, p.y, p.z], [0, 0, 0], 0.01);
  }
}

/** wattle fence run (posts + woven rails), returns its collider */
function fence(k: Kit, ctx: OpeningCtx, ax: number, az: number, bx: number, bz: number): { x: number; z: number; yaw: number; hx: number; hz: number; top: number } {
  const len = Math.hypot(bx - ax, bz - az);
  const yaw = Math.atan2(bx - ax, bz - az);
  const n = Math.max(2, Math.round(len / 1.2));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = ax + (bx - ax) * t;
    const z = az + (bz - az) * t;
    k.add(cyl(0.06, 0.07, 0.95, 6), C.timber, [x, ctx.groundH(x, z) + 0.42, z], [(ctx.rand() - 0.5) * 0.12, 0, (ctx.rand() - 0.5) * 0.12], 0.012);
  }
  const mx = (ax + bx) / 2;
  const mz = (az + bz) / 2;
  const y = ctx.groundH(mx, mz);
  for (const yy of [0.32, 0.62]) k.add(jitter(new THREE.BoxGeometry(0.07, 0.16, len, 1, 1, Math.ceil(len)), 0.02, ctx.rand), C.timberDark, [mx, y + yy, mz], [0, yaw, 0], 0.012);
  return { x: mx, z: mz, yaw, hx: 0.12, hz: len / 2, top: y + 0.8 };
}

/** two-wheeled hand cart, tipped onto its shafts */
function handCart(k: Kit, ctx: OpeningCtx, x: number, z: number, yaw: number): void {
  const { rand } = ctx;
  k.at(x, ctx.groundH(x, z), z, yaw, () => {
    k.add(hewn(box(1.2, 0.12, 1.6), rand, 0.02), C.timber, [0, 0.62, 0], [0.12, 0, 0], 0.016);
    for (const s of [-1, 1]) {
      k.add(box(0.08, 0.36, 1.6), C.timberDark, [s * 0.6, 0.82, 0], [0.12, 0, 0]);
      k.add(cyl(0.48, 0.48, 0.1, 12, 'x'), C.timber, [s * 0.68, 0.48, 0.1], [0, 0, 0], 0.016);
      k.add(cyl(0.12, 0.12, 0.14, 8, 'x'), C.timberDark, [s * 0.7, 0.48, 0.1]);
      k.add(box(0.07, 0.07, 1.4), C.timber, [s * 0.4, 0.3, -1.25], [-0.3, 0, 0]);
    }
    k.add(cyl(0.3, 0.26, 0.6, 9), C.timber, [0.2, 1.0, 0.25], [0.12, 0, 0], 0.014);
    k.add(jitter(new THREE.IcosahedronGeometry(0.32, 1), 0.2, rand), C.thatch, [-0.25, 0.85, -0.3], [0, 0, 0], 0.014, [1.2, 0.7, 1]);
  });
}

/** washing line between two crooked poles, a few cloths hanging */
function washingLine(k: Kit, ctx: OpeningCtx, ax: number, az: number, bx: number, bz: number): void {
  const a = new THREE.Vector3(ax, ctx.groundH(ax, az) + 2.1, az);
  const b = new THREE.Vector3(bx, ctx.groundH(bx, bz) + 2.1, bz);
  for (const p of [a, b]) k.add(cyl(0.06, 0.08, 2.2, 6), C.timber, [p.x, p.y - 1.05, p.z], [(ctx.rand() - 0.5) * 0.1, 0, (ctx.rand() - 0.5) * 0.1], 0.012);
  const yaw = Math.atan2(b.x - a.x, b.z - a.z);
  const sag = (t: number) => a.clone().lerp(b, t).setY(THREE.MathUtils.lerp(a.y, b.y, t) - 0.3 * 4 * t * (1 - t));
  k.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => sag(i / 8))), 12, 0.015, 4), C.rope, [0, 0, 0], [0, 0, 0], 0.005);
  [0.2, 0.42, 0.66, 0.84].forEach((t, i) => {
    const p = sag(t);
    const w = 0.5 + (i % 2) * 0.25;
    const h = 0.6 + (i % 3) * 0.15;
    k.add(jitter(new THREE.BoxGeometry(0.03, h, w, 1, 3, 3), 0.04, ctx.rand), C.cloth[i % 3]!, [p.x, p.y - h / 2, p.z], [0, yaw, (i % 2 ? 1 : -1) * 0.05], 0.01);
  });
}

/** slow chimney smoke: a column of ink-wash puffs that swell, drift and fade (one hearth still kept) */
function chimneySmoke(ctx: OpeningCtx, x: number, y: number, z: number): void {
  const puffs: THREE.Mesh[] = [];
  const mat = toon(0xc9bfb2);
  const geo = jitter(new THREE.IcosahedronGeometry(0.3, 1), 0.15, ctx.rand);
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = false;
    ctx.scene.add(m);
    puffs.push(m);
  }
  ctx.onUpdate((_dt, t) => {
    puffs.forEach((m, i) => {
      const life = (t * 0.16 + i / puffs.length) % 1;
      const s = Math.sin(Math.PI * Math.min(1, life * 1.4)) * (0.5 + life * 1.3);
      m.scale.setScalar(Math.max(0.001, s));
      m.position.set(x + life * 1.6 + Math.sin(t * 0.7 + i) * 0.12, y + life * 3.2, z - life * 0.5);
    });
  });
}

export function buildVillage(ctx: OpeningCtx): void {
  const { scene, colliders } = ctx;
  HOUSES.forEach((h, i) => {
    const k = new Kit();
    const y0 = cottage(k, ctx, h, i);
    const g = k.build();
    g.name = `cottage-${i}`;
    scene.add(g);
    ctx.occluders.push(g);
    colliders.push({ kind: 'box', x: h.x, z: h.z, yaw: 0, hx: h.w / 2 + 0.45, hz: h.d / 2 + 0.45, top: y0 + 0.55 + h.eave + h.rise });
    colliders.push({ kind: 'post', x: h.x - h.w * 0.2 - 1.0, z: h.z + h.d / 2 + 0.6, r: 0.36 });
    colliders.push({ kind: 'post', x: h.x + h.w * 0.42, z: h.z + h.d / 2 + 0.65, r: 0.38 });
    if (h.chimney) {
      colliders.push({ kind: 'post', x: h.x - h.w / 2 - 0.35, z: h.z - h.d * 0.18, r: 0.5 });
      // only the cottage nearest the waking fox still keeps a fire
      if (i === 0) chimneySmoke(ctx, h.x - h.w / 2 - 0.35, y0 + 0.55 + h.eave + h.rise + 1.6, h.z - h.d * 0.18);
    }
  });

  const props = new Kit();
  greatWell(props, ctx);
  colliders.push({ kind: 'post', x: WELL.x, z: WELL.z, r: 1.8 });
  firePit(props, ctx, -11.5, 93.6);
  colliders.push({ kind: 'cap', x: -11.5, z: 93.6, r: 1.1, base: ctx.groundH(-11.5, 93.6), h: 0.25 });
  const posts: Record<string, THREE.Vector3> = {};
  for (const [name, x, z, yaw] of [['plaza', -12, 86.4, 0.4], ['east', 6.6, 89.4, Math.PI], ['meadow', -3.2, 81.6, -0.6], ['north', -4.2, 96.5, 2.4]] as const) {
    posts[name] = lanternPost(props, ctx, x, z, yaw);
    colliders.push({ kind: 'post', x, z, r: 0.2 });
  }
  // festoons: plaza post ↔ well hood ↔ meadow post, and across the north lane
  const wellTop = new THREE.Vector3(WELL.x, ctx.groundH(WELL.x, WELL.z) + 2.75, WELL.z);
  festoon(props, posts.plaza!, wellTop, 0.45);
  festoon(props, wellTop, posts.meadow!, 0.5);
  festoon(props, posts.north!, new THREE.Vector3(-9, ctx.groundH(-9, 97.6) + 2.7, 97.6), 0.35);
  // back-garden fences
  for (const [ax, az, bx, bz] of [[-21, 81.8, -15, 81.8], [-31.5, 81.2, -25.5, 81.2], [8.6, 92.2, 15.4, 92.2], [-12, 97.2, -6.2, 97.2]] as const)
    colliders.push({ kind: 'box', ...fence(props, ctx, ax, az, bx, bz) });
  handCart(props, ctx, -11.2, 81.8, 0.7);
  colliders.push({ kind: 'box', x: -11.2, z: 81.8, yaw: 0.7, hx: 0.75, hz: 1.2, top: ctx.groundH(-11.2, 81.8) + 0.9 });
  for (const [x, z, yaw] of [[-23.2, 90.4, 0.3], [-22.0, 90.9, 1.2], [-22.7, 90.6, 0.8]] as const) {
    const y = ctx.groundH(x, z);
    props.add(hewn(new THREE.BoxGeometry(1.0, 0.55, 0.6, 2, 1, 1), ctx.rand, 0.05), C.thatch, [x, y + 0.26 + (x === -22.7 ? 0.55 : 0), z], [0, yaw, 0], 0.016);
  }
  colliders.push({ kind: 'box', x: -22.6, z: 90.6, yaw: 0.6, hx: 1.1, hz: 0.7, top: ctx.groundH(-22.6, 90.6) + 1.1 });
  washingLine(props, ctx, -33.5, 91.2, -29.2, 91.8);
  for (const [x, z] of [[-33.5, 91.2], [-29.2, 91.8]] as const) colliders.push({ kind: 'post', x, z, r: 0.12 });
  const pg = props.build();
  pg.name = 'village-props';
  scene.add(pg);
  ctx.occluders.push(pg);
  scene.add(flagstones(ctx));

  // a few village maples between the cottages (meadow trees are meadow.ts)
  for (const [x, z, s, pal] of [[-23.5, 95.5, 1.0, 1], [-1.5, 104, 1.15, 2], [3.5, 96.5, 0.85, 3], [-35.5, 94.5, 1.1, 0]] as const) {
    const y = ctx.groundH(x, z);
    const t = buildMaple(ctx.rand, s, 'grove', pal, y);
    t.position.set(x, y - 0.1, z);
    t.rotation.y = ctx.rand() * 6;
    scene.add(t);
    colliders.push({ kind: 'post', x, z, r: 0.45 * s });
  }
}
