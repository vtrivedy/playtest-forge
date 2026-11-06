/**
 * The Scribe's Press, set to the bible (refs/bible/bible-press.jpg, DESIGN-sumiro-look.md shots 1–7): dripping ink
 * spires on the rim with a torn ink net strung between the tallest, flung ink droplets, stacked pressed pages, a far
 * forest of spires washing out into the paper sky, and the painted backdrop ring. Scenery only: the levels, their
 * colliders and the route are press.ts. Build-time code; the backdrop's per-frame follow lives in worldsScene.update.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from './lookdevKit';
import type { OpeningCtx } from './opening/scene';
import { pressE, pressH, WORLDS } from './opening/worlds';
import { inkWash } from './inkWash';
import { paintedBackdrop } from './paperBackdrop';
import { BRAZIERS, MEMBRANE_A } from './opening/pressLayout';

const P = WORLDS.press.origin;
/** page-stack clusters (local to the Press origin): off the brazier relays, the ridge gate, the spawn and the shelf */
/** puzzle pieces a stack must keep its distance from (local) */
const CLEAR: ReadonlyArray<readonly [number, number]> = [...BRAZIERS.map((b) => [b.lx, b.lz] as const), [MEMBRANE_A.lx, MEMBRANE_A.lz]];
const STACK_SPOTS: ReadonlyArray<readonly [number, number]> = [[-31, 23], [27, 21], [-33, 3], [33, 5], [24, 37], [-26, 36]];
const { smoothstep } = THREE.MathUtils;

/**
 * The Press's ground as drawn. Inside the walk mask and up the rim's first 3 m it is the terrain (pressH), so feet,
 * camera and lint agree; beyond, where nothing walks, the bank crests and falls away to a white plain (the terrain
 * function keeps climbing into a 60 m wall that hid the horizon), so the far spires and the painted sky show.
 */
export function pressVisualH(x: number, z: number): number {
  const e = pressE(x, z);
  if (e <= 3) return pressH(x, z);
  const base = pressH(x, z) - (smoothstep(e, -2, 3) * 9 + Math.max(0, e - 3) * 2.2);
  return base + 9 + 1.6 * smoothstep(e, 3, 6) - 6.5 * smoothstep(e, 6, 22);
}
/** lowest drawn ground under a disc: a mass set there never shows a gap on its downhill side */
function footY(x: number, z: number, rad: number): number {
  let y = pressVisualH(x, z);
  for (let k = 0; k < 8; k++) y = Math.min(y, pressVisualH(x + Math.cos(k * 0.785) * rad, z + Math.sin(k * 0.785) * rad));
  return y;
}

/**
 * One ink spire: a tapering irregular mass that leans and shoulders, cut for the wash (no cone read). Vertex colour
 * carries the pigment: violet-grey wash low, dense ink up the ridges and at the tip, pale where snow is blown on.
 */
export function spireGeometry(r: () => number, h: number, base: number, detail = 1): THREE.BufferGeometry {
  const radial = Math.round(15 * detail);
  const rows = Math.round(30 * detail);
  const g = new THREE.CylinderGeometry(1, 1, 1, radial, rows, false).translate(0, 0.5, 0);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const seed = r() * 10;
  const lean = (r() - 0.5) * 0.35;
  const leanA = r() * Math.PI * 2;
  const lobes = 2 + Math.floor(r() * 3);
  const shoulder = 0.35 + r() * 0.3;
  // [angle, how far up it starts (t), width] per run
  const drips: number[] = [];
  for (let k = 0; k < 5 + Math.floor(r() * 4); k++) drips.push(r() * Math.PI * 2, 0.35 + r() * 0.6, 0.12 + r() * 0.12);
  const c = new THREE.Color();
  const ink = new THREE.Color(0x121119);
  const violet = new THREE.Color(0x56526e);
  const pale = new THREE.Color(0xa9a8b8);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const t = pos.getY(i);
    const a = Math.atan2(z, x);
    const rr = Math.hypot(x, z);
    // taper with a shoulder (a second, narrower spire growing out of the first) and ragged vertical ridges
    const taper = Math.pow(1 - t, 0.85) * (1 - 0.28 * THREE.MathUtils.smoothstep(t, shoulder - 0.05, shoulder + 0.05)) + 0.02;
    const ridge = 1 + 0.22 * Math.sin(a * lobes + seed + t * 3) + 0.1 * Math.sin(a * (lobes * 2 + 1) - seed * 2 + t * 7);
    // melting lumps: the mass reads as ink that has run and set in tiers, not a turned cone
    const tier = Math.sin(t * (9 + lobes * 2) + seed + Math.sin(a * 2 + seed) * 1.4);
    const lump = 1 + (0.16 * tier + 0.1 * Math.sin(a * 3 + t * 13 - seed) * Math.sin(t * 7 + a)) * (1 - t * 0.7);
    // drip grooves: runs of ink down the face from where each one starts
    let groove = 0;
    for (let k = 0; k < drips.length; k += 3) {
      const da = Math.atan2(Math.sin(a - drips[k]!), Math.cos(a - drips[k]!));
      if (t < drips[k + 1]!) groove = Math.max(groove, Math.exp(-(da * da) / (drips[k + 2]! * drips[k + 2]!)) * THREE.MathUtils.smoothstep(t, 0, drips[k + 1]!));
    }
    const R = base * taper * ridge * lump * (1 + 0.14 * groove) * (rr > 0.01 ? 1 : 0);
    const bend = lean * h * t * t;
    pos.setXYZ(i, Math.cos(a) * R + Math.cos(leanA) * bend, t * h, Math.sin(a) * R + Math.sin(leanA) * bend);
    // pigment, mottled like the bible: ink on the crests, the runs and up high; violet wash pools in the hollows;
    // pale blown snow at the foot and caught on the tier ledges
    const crest = 0.5 + 0.5 * Math.sin(a * lobes + seed + t * 3);
    const n = 0.5 + 0.5 * Math.sin(a * 5.3 + t * 23 + seed * 3) * Math.sin(a * 2.1 - t * 11 + seed);
    c.copy(violet).lerp(ink, Math.min(1, crest * 0.6 + t * 0.5 + n * 0.5 + groove * 0.6));
    const ledge = Math.max(0, tier) > 0.85 && n < 0.45 ? 0.55 : 0;
    c.lerp(pale, Math.min(1, (1 - THREE.MathUtils.smoothstep(t, 0.02, 0.14)) * 0.85 + ledge * (1 - t)));
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/** a heaped snow skirt round a spire's foot */
function skirtGeometry(r: () => number, rad: number, cx: number, cz: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const s = r() * 6;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const a = Math.atan2(z, x);
    const k = 1 + 0.25 * Math.sin(a * 3 + s) + 0.12 * Math.sin(a * 7 - s);
    const wx = cx + x * rad * k;
    const wz = cz + z * rad * k;
    pos.setXYZ(i, wx, pressVisualH(wx, wz) - 0.15 + y * rad * 0.22 * (0.8 + 0.4 * Math.sin(a * 2 + s)), wz);
  }
  g.computeVertexNormals();
  return g;
}

/** the ink web: knotted, uneven cells, broken strands and blots, drawn with a wet brush on transparent paper */
function webTexture(seed: number): THREE.CanvasTexture {
  const W = 1024;
  const H = 512;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d')!;
  const r = rng(seed);
  const cols = 13;
  const rows = 7;
  const pts: [number, number][][] = [];
  for (let j = 0; j <= rows; j++) {
    const row: [number, number][] = [];
    for (let i = 0; i <= cols; i++) row.push([(i / cols) * W + (r() - 0.5) * 50, (j / rows) * H * 0.96 + (r() - 0.5) * 34 + 6]);
    pts.push(row);
  }
  g.lineCap = 'round';
  const stroke = (a: [number, number], b: [number, number], w: number) => {
    if (r() < 0.1) return; // torn strand
    g.strokeStyle = `rgba(18,17,26,${0.75 + r() * 0.25})`;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(a[0], a[1]);
    const mx = (a[0] + b[0]) / 2 + (r() - 0.5) * 16;
    const my = (a[1] + b[1]) / 2 + 6 + r() * 10;
    g.quadraticCurveTo(mx, my, b[0], b[1]);
    g.stroke();
  };
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const p = pts[j]![i]!;
      const w = (j === 0 ? 9 : 3.5) + r() * 3;
      if (i < cols) stroke(p, pts[j]![i + 1]!, w);
      if (j < rows) stroke(p, pts[j + 1]![i]!, 2.5 + r() * 3);
      if (j < rows && i < cols && r() < 0.45) stroke(p, pts[j + 1]![i + 1]!, 1.5 + r() * 2);
      // knots
      g.fillStyle = 'rgba(16,15,24,0.9)';
      g.beginPath();
      g.arc(p[0], p[1], 3 + r() * 5, 0, Math.PI * 2);
      g.fill();
    }
  }
  // hanging drips off the lowest strands, and splatter
  for (let i = 0; i < 70; i++) {
    const x = r() * W;
    const y = H * (0.3 + r() * 0.65);
    g.fillStyle = `rgba(16,15,24,${0.5 + r() * 0.5})`;
    g.beginPath();
    g.ellipse(x, y, 1.5 + r() * 4, 2 + r() * 7, 0, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** a web strung from a to b: its top strand sags between them, its lower edge hangs deep in the middle */
function netGeometry(a: THREE.Vector3, b: THREE.Vector3, sag: number, depth: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(1, 1, 28, 10);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i);
    const v = 1 - uv.getY(i);
    const bell = 4 * u * (1 - u);
    const top = new THREE.Vector3().lerpVectors(a, b, u);
    top.y -= sag * bell;
    const drop = depth * (0.25 + 0.75 * bell);
    // the web belly swells a little out of the plane, as if a wind leans on it
    pos.setXYZ(i, top.x + Math.sin(u * Math.PI) * v * 1.2, top.y - drop * v, top.z + Math.sin(u * Math.PI) * v * 1.4);
  }
  g.computeVertexNormals();
  return g;
}

export function buildPressScenery(ctx: OpeningCtx) {
  const { scene } = ctx;
  const groundH = pressVisualH;
  const root = new THREE.Group();
  root.name = 'press-scenery';
  scene.add(root);
  const r = rng(6203);
  const spireMat = inkWash(0xffffff, { vertexColors: true, scale: 0.22, tide: 0.8, drip: 0.75, contour: 0.25, density: 0.92 });
  const snowMat = inkWash(0xf2f1ee, { scale: 0.3, tide: 0.35, drip: 0 });

  // ---- rim formations (shot 2): clusters of 2–4 spires standing in the rim slope, skirts of snow round their feet
  type Formation = { x: number; z: number; tip: THREE.Vector3; h: number };
  const forms: Formation[] = [];
  const spireGeos: THREE.BufferGeometry[] = [];
  const skirtGeos: THREE.BufferGeometry[] = [];
  const N = 15;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + (r() - 0.5) * 0.18;
    const rr = 50 + r() * 6;
    const x = P.x + Math.cos(a) * rr;
    const z = P.z + Math.sin(a) * rr;
    const y = footY(x, z, 3);
    const hMain = 19 + r() * 17;
    const count = 2 + Math.floor(r() * 3);
    for (let k = 0; k < count; k++) {
      const h = k === 0 ? hMain : hMain * (0.35 + r() * 0.45);
      const base = (k === 0 ? 3.2 : 1.6) + r() * 1.5;
      const ox = k === 0 ? 0 : (r() - 0.5) * 7;
      const oz = k === 0 ? 0 : (r() - 0.5) * 7;
      const sg = spireGeometry(r, h, base).translate(x + ox, footY(x + ox, z + oz, base * 1.3) - 0.4, z + oz);
      spireGeos.push(sg);
      skirtGeos.push(skirtGeometry(r, base * 1.25, x + ox, z + oz));
    }
    forms.push({ x, z, h: hMain, tip: new THREE.Vector3(x, y + hMain * 0.72, z) });
  }
  const spires = new THREE.Mesh(mergeGeometries(spireGeos), spireMat);
  spires.castShadow = true;
  spires.receiveShadow = true;
  const skirts = new THREE.Mesh(mergeGeometries(skirtGeos), snowMat);
  skirts.receiveShadow = true;
  root.add(spires, skirts);

  // ---- nets (shot 2): webs strung between neighbouring tall formations; tears are in the drawing
  const netMats = [1, 2, 3].map((s) => new THREE.MeshBasicMaterial({ map: webTexture(400 + s), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, color: 0xffffff, fog: true }));
  const netGeos: THREE.BufferGeometry[][] = [[], [], []];
  for (let i = 0; i < forms.length; i++) {
    const A = forms[i]!;
    const B = forms[(i + 1) % forms.length]!;
    if (A.h + B.h < 33 && i % 3 !== 0) continue;
    const a = A.tip.clone();
    const b = B.tip.clone();
    // keep the web inside the ring of spires, a little in from the rim
    const lo = Math.min(a.y, b.y);
    const span = a.distanceTo(b);
    netGeos[i % 3]!.push(netGeometry(a, b, span * 0.12, Math.max(4, lo - groundH((a.x + b.x) / 2, (a.z + b.z) / 2) - 2 - span * 0.12)));
  }
  netGeos.forEach((gs, i) => {
    if (!gs.length) return;
    const m = new THREE.Mesh(mergeGeometries(gs), netMats[i]!);
    root.add(m);
  });

  // ---- flung droplets (shot 2): ink spattered off the spires and webs, hanging in the air like the bible's
  const DROPS = 260;
  const drops = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.12, 0), new THREE.MeshBasicMaterial({ color: 0x17161f }), DROPS);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  for (let i = 0; i < DROPS; i++) {
    const F = forms[Math.floor(r() * forms.length)]!;
    const k = 0.4 + r();
    v.set(F.x + (r() - 0.5) * 12, F.tip.y * (0.5 + r() * 0.7), F.z + (r() - 0.5) * 12);
    s.setScalar(k);
    m4.compose(v, q, s);
    drops.setMatrixAt(i, m4);
  }
  root.add(drops);

  // ---- the far forest (shot 7): spires beyond the rim, simpler, washed out by the fog into the paper
  const farGeos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 46; i++) {
    const a = r() * Math.PI * 2;
    const rr = 72 + r() * 60;
    const x = P.x + Math.cos(a) * rr;
    const z = P.z + Math.sin(a) * rr;
    const h = 16 + r() * 34;
    const b = 2.5 + r() * 3.5;
    farGeos.push(spireGeometry(r, h, b, 0.55).translate(x, footY(x, z, b * 1.3) - 0.5, z));
  }
  const far = new THREE.Mesh(mergeGeometries(farGeos), spireMat);
  root.add(far);
  // ---- page stacks (shot 3): pressed pages stacked like quarry stone in clusters off the relay routes
  const paperMat = inkWash(0xd9d1bf, { scale: 0.5, tide: 0.5, drip: 0.25 });
  const edgeMat = inkWash(0x9a8f78, { scale: 0.5, tide: 0.5, drip: 0.25 });
  const stackGeos: { paper: THREE.BufferGeometry[]; edge: THREE.BufferGeometry[]; snow: THREE.BufferGeometry[] } = { paper: [], edge: [], snow: [] };
  const rs = rng(3307);
  for (const [lx, lz] of STACK_SPOTS) {
    const n = 2 + Math.floor(rs() * 3);
    for (let k = 0; k < n; k++) {
      const x = P.x + lx + (k === 0 ? 0 : (rs() - 0.5) * 5);
      const z = P.z + lz + (k === 0 ? 0 : (rs() - 0.5) * 5);
      if (pressE(x, z) > -5 || CLEAR.some(([cx, cz]) => Math.hypot(x - P.x - cx, z - P.z - cz) < 5)) continue;
      const w = 1.6 + rs() * 0.9;
      const d = 1.2 + rs() * 0.5;
      const h = k === 0 ? 1.6 + rs() * 0.8 : 0.7 + rs() * 1.3;
      const yaw = rs() * Math.PI;
      const y = footY(x, z, Math.max(w, d) * 0.6) - 0.05;
      const st = pageStackGeometry(rs, w, d, h);
      const place = (g: THREE.BufferGeometry) => g.rotateY(yaw).translate(x, y, z);
      stackGeos.paper.push(place(st.paper));
      stackGeos.edge.push(place(st.edge));
      stackGeos.snow.push(place(st.snow));
      ctx.colliders.push({ kind: 'box', x, z, yaw, hx: w / 2, hz: d / 2, top: y + h });
    }
  }
  for (const [geos, mat] of [[stackGeos.paper, paperMat], [stackGeos.edge, edgeMat], [stackGeos.snow, snowMat]] as const) {
    if (!geos.length) continue;
    const m = new THREE.Mesh(mergeGeometries(geos), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
  }

  const backdrop = paintedBackdrop(scene, 'press');
  return { root, backdrop };
}

/**
 * A bare winter tree drawn in ink: a crooked trunk that forks, limbs reaching out and up, snow caught on the top of
 * each limb. One merged geometry for the wood (`wood`) and one for the snow (`snow`), local to the tree's foot.
 */
export function inkTreeGeometry(r: () => number, h: number): { wood: THREE.BufferGeometry; snow: THREE.BufferGeometry } {
  const wood: THREE.BufferGeometry[] = [];
  const snow: THREE.BufferGeometry[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion();
  const limb = (from: THREE.Vector3, dir: THREE.Vector3, len: number, rad: number, depth: number) => {
    const segs = 3;
    let p = from.clone();
    let d = dir.clone().normalize();
    for (let s = 0; s < segs; s++) {
      const l = len / segs;
      const r0 = rad * (1 - s / segs * 0.6);
      const r1 = rad * (1 - (s + 1) / segs * 0.6);
      const g = new THREE.CylinderGeometry(r1, r0, l, 6, 1).translate(0, l / 2, 0);
      g.applyQuaternion(q.setFromUnitVectors(up, d));
      g.translate(p.x, p.y, p.z);
      wood.push(g);
      // snow lies along the upper side of near-level limbs
      if (d.y < 0.75 && depth > 0) {
        const sg = new THREE.SphereGeometry(1, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(r0 * 1.5, r0 * 0.9, l * 0.45).translate(0, r0 * 0.6, l / 2);
        const flat = new THREE.Vector3(d.x, 0, d.z).normalize();
        sg.applyQuaternion(q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), flat.lengthSq() > 0 ? flat : new THREE.Vector3(0, 0, 1)));
        sg.translate(p.x, p.y + l * d.y * 0.5, p.z);
        snow.push(sg);
      }
      p = p.addScaledVector(d, l);
      // crook: each segment bends a little, sometimes against the last
      d = d.add(new THREE.Vector3((r() - 0.5) * 0.5, (r() - 0.3) * 0.25, (r() - 0.5) * 0.5)).normalize();
    }
    if (depth <= 0 || rad < 0.025) return;
    const kids = depth > 1 ? 3 : 2 + Math.floor(r() * 2);
    for (let k = 0; k < kids; k++) {
      const a = r() * Math.PI * 2;
      const out = new THREE.Vector3(Math.cos(a), 0.25 + r() * 0.7, Math.sin(a)).normalize().lerp(d, 0.3).normalize();
      limb(p, out, len * (0.55 + r() * 0.2), rad * 0.62, depth - 1);
    }
  };
  limb(new THREE.Vector3(0, -0.2, 0), new THREE.Vector3((r() - 0.5) * 0.15, 1, (r() - 0.5) * 0.15), h * 0.5, 0.17 + h * 0.025, 2);
  return { wood: mergeGeometries(wood)!, snow: mergeGeometries(snow.length ? snow : [new THREE.BufferGeometry()])! };
}

/**
 * Bundles of pressed pages stacked like quarry stone (shot 3): uneven slabs, alternate leaves of pale paper and
 * edge-browned paper, a snow lid. Local to the stack's foot; `hx`/`hz`/`top` give its collider.
 */
export function pageStackGeometry(r: () => number, w: number, d: number, h: number): { paper: THREE.BufferGeometry; edge: THREE.BufferGeometry; snow: THREE.BufferGeometry } {
  const paper: THREE.BufferGeometry[] = [];
  const edge: THREE.BufferGeometry[] = [];
  let y = 0;
  let i = 0;
  while (y < h) {
    const t = 0.1 + r() * 0.22;
    const g = new THREE.BoxGeometry(w * (0.92 + r() * 0.1), t, d * (0.92 + r() * 0.1)).translate((r() - 0.5) * 0.12, y + t / 2, (r() - 0.5) * 0.12);
    g.rotateY((r() - 0.5) * 0.08);
    (i++ % 3 === 1 ? edge : paper).push(g);
    y += t;
  }
  const snow = new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(w * 0.52, 0.22, d * 0.52).translate(0, y - 0.02, 0);
  return { paper: mergeGeometries(paper)!, edge: mergeGeometries(edge.length ? edge : [new THREE.BoxGeometry(0.01, 0.01, 0.01)])!, snow };
}
