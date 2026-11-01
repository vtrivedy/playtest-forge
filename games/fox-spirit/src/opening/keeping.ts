/**
 * The first Keeping's place (DESIGN-keeping-place.md): the ledge out of the shelf with its one safe bend,
 * the steam spring basin, the root-hearth terrace, the far crag, the coal cradle, and the arrested
 * Hearthtree. `release()` plays the authored settle — a shiver, the fall it was holding, one bounce —
 * and the trunk becomes the bridge (a walk box pushed into ctx.colliders). Not physics: one curve.
 * Leaves pressed in mid-air around the crown resume falling with the tree and keep falling after.
 */
import * as THREE from 'three';
import { canopyPad, hewn, inked, jitter, mapleLeafGeometry, plumeGeometry, RAMP_CANOPY, toon, CANOPY, buildRock, contactInk } from '../lookdevKit';
import type { Collider } from '../lookdevPlay';
import type { OpeningCtx } from './scene';
import { KEEPING, SHELF_TOP } from './layout';
import { column } from './meadow';

/** Authored settle timing (s from release) and shape */
export const SETTLE = {
  shiver: 0.9,
  fall: 1.6,
  bounce: 0.9,
  /** fall curve exponent: > 1 accelerates like a toppling mass */
  ease: 2.3,
  /** bounce lift after impact (rad) */
  rebound: 0.045,
};

type Phase = 'arrested' | 'settling' | 'bridge';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const BARK = 0x4a3326;
const ASH = 0x2e2522;
const STONE = 0x5a4f46;

/** Ring of hewn arc stones (bowl rim) with an inner bed disc; local origin = bed centre at the floor */
function stoneRing(rand: () => number, rOut: number, rIn: number, h: number, bed: number, n = 7): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 + 0.06;
    const a1 = ((i + 1) / n) * Math.PI * 2 - 0.06;
    const s = new THREE.Shape();
    s.absarc(0, 0, rOut, a0, a1, false);
    s.absarc(0, 0, rIn, a1, a0, true);
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: h * (0.8 + rand() * 0.4), bevelEnabled: false, curveSegments: 3 });
    geo.rotateX(-Math.PI / 2);
    g.add(inked(hewn(geo, rand, 0.03), toon(new THREE.Color(STONE).multiplyScalar(0.85 + rand() * 0.25), { contour: 0.5 }), 0.02, true));
  }
  const disc = new THREE.Mesh(new THREE.CircleGeometry(rIn + 0.02, 24), toon(bed, { contour: 0.2 }));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = h * 0.45;
  disc.receiveShadow = true;
  g.add(disc);
  return g;
}

/** Column cluster under an oriented box (terrace / crag / pad): moss-capped turf is the walk surface */
function plinth(ctx: OpeningCtx, box: { x: number; z: number; hx: number; hz: number; yaw: number; top: number }, r: number, n: number): void {
  const root = new THREE.Group();
  root.position.set(box.x, 0, box.z);
  root.rotation.y = box.yaw;
  ctx.scene.add(root);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const lx = n === 1 ? 0 : (i / (n - 1) - 0.5) * (box.hx * 2 - r * 1.3);
      const lz = n === 1 ? 0 : (j / (n - 1) - 0.5) * (box.hz * 2 - r * 1.3);
      const c = Math.cos(box.yaw);
      const s = Math.sin(box.yaw);
      const g0 = ctx.groundH(box.x + lx * c + lz * s, box.z - lx * s + lz * c);
      const col = column(ctx.rand, lx + (ctx.rand() - 0.5) * 0.25, lz + (ctx.rand() - 0.5) * 0.25, r * (0.95 + ctx.rand() * 0.12), g0 - 2, box.top, true);
      root.add(col);
      ctx.occluders.push(col);
    }
  }
  ctx.colliders.push({ kind: 'box', ...box });
}

/** The Hearthtree in its fall frame: trunk along +y, falls toward +z (pivot.rotation.y = fall yaw) */
function buildHearthtree(rand: () => number, baseY: number) {
  const tree = new THREE.Group();
  const climbBase = baseY + 0.4;
  const bark = toon(BARK, { contour: 0.8, climbBase });
  const L = 10.5;
  // a near-straight trunk (it must lie flat as a walk), a little S so it never reads as a pole
  const trunk = new THREE.CatmullRomCurve3([V(0, -0.5, 0), V(0.12, L * 0.35, -0.08), V(-0.1, L * 0.7, 0.1), V(0.05, L, 0.18)]);
  const radius = (t: number) => THREE.MathUtils.lerp(0.72, 0.3, t) + (1 - THREE.MathUtils.smoothstep(t, 0, 0.1)) * 0.35;
  tree.add(inked(jitter(plumeGeometry(trunk, radius, 28, 11, 0), 0.04, rand, 2.0), bark, 0.026, true));
  const pads: Array<{ at: THREE.Vector3; r: number }> = [];
  // limbs: sideways (±x) and forward (+z, they hang under the bridge once fallen); never back (−z → up)
  const LIMBS: Array<[number, number, number, number]> = [
    // [t along trunk, azimuth (0 = +x, π/2 = +z), reach, rise]
    [0.5, 0.15, 2.6, 1.6], [0.58, Math.PI - 0.2, 2.4, 1.9], [0.66, Math.PI / 2 + 0.3, 2.0, 1.6],
    [0.74, -0.25, 2.2, 2.0], [0.8, Math.PI + 0.35, 2.0, 2.0], [0.86, Math.PI / 2 - 0.5, 1.8, 2.2],
  ];
  LIMBS.forEach(([t, a, reach, rise], i) => {
    const from = trunk.getPointAt(t);
    const end = from.clone().add(V(Math.cos(a) * reach, rise, Math.sin(a) * reach));
    const mid = from.clone().lerp(end, 0.5).add(V(0, -0.25, 0));
    const curve = new THREE.CatmullRomCurve3([from, mid, end]);
    const lr = 0.26 * (1 - t * 0.4);
    tree.add(inked(plumeGeometry(curve, (u) => THREE.MathUtils.lerp(lr, lr * 0.28, u), 10, 6, 0), bark, 0.018, true));
    // one bare limb so sky shows through the crown with the inked branch in it
    if (i === 3) {
      const tip = end.clone().add(V(Math.cos(a) * 0.9, 0.8, Math.sin(a) * 0.9));
      tree.add(inked(plumeGeometry(new THREE.CatmullRomCurve3([end, end.clone().lerp(tip, 0.5).add(V(0, -0.1, 0)), tip]), (u) => THREE.MathUtils.lerp(lr * 0.28, lr * 0.05, u), 6, 5, 0), bark, 0.014, true));
      return;
    }
    pads.push({ at: end.clone().lerp(from, 0.15), r: 1.25 + rand() * 0.5 });
  });
  const top = trunk.getPointAt(1);
  pads.push({ at: top.clone().add(V(0, 1.3, 0)), r: 2.3 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + rand() * 0.6;
    pads.push({ at: top.clone().add(V(Math.cos(a) * 1.7, (rand() - 0.4) * 1.2, Math.sin(a) * 1.7)), r: 1.2 + rand() * 0.5 });
  }
  // ember crimson → rust crowns: the brightest canopy in the slice once it is painted
  const TONES = [CANOPY[2]!, CANOPY[0]!, [0xb4583a, 0x8a3a2a, 0x52262a] as [number, number, number]];
  const padMeshes: THREE.Mesh[] = [];
  pads.forEach((pd, i) => {
    const pad = inked(canopyPad(rand, pd.r, pd.r * 0.78, TONES[i % TONES.length]!), toon(0xffffff, { vertexColors: true, contour: 0.9, climbBase, ramp: RAMP_CANOPY }), 0.03, true);
    pad.position.copy(pd.at);
    pad.rotation.set((rand() - 0.5) * 0.5, rand() * 6.28, (rand() - 0.5) * 0.5);
    pad.userData.rest = pad.position.clone();
    tree.add(pad);
    padMeshes.push(pad);
  });
  return { tree, pads: padMeshes, crown: pads.map((p) => ({ at: p.at.clone(), r: p.r })) };
}

/** Static roots on the terrace around the hinge (they hold; the trunk is what finishes falling) */
function buildRoots(rand: () => number, climbBase: number): THREE.Group {
  const g = new THREE.Group();
  const bark = toon(BARK, { contour: 0.8, climbBase });
  for (let i = 0; i < 7; i++) {
    // fan back over the terrace (−z) and to the sides; root-hearth bowl sits in the gap at −z
    const a = -Math.PI / 2 + (i / 6 - 0.5) * 3.6 + (rand() - 0.5) * 0.25;
    if (Math.abs(a + Math.PI / 2) < 0.35) continue;
    const reach = 1.6 + rand() * 1.1;
    const p0 = V(0, 0.55, 0);
    const p1 = V(Math.cos(a) * reach * 0.45, 0.62, Math.sin(a) * reach * 0.45);
    const p2 = V(Math.cos(a) * reach, 0.45, Math.sin(a) * reach);
    g.add(inked(plumeGeometry(new THREE.CatmullRomCurve3([p0, p1, p2]), (t) => THREE.MathUtils.lerp(0.26, 0.05, t), 10, 6, 0), bark, 0.018, true));
  }
  return g;
}

export function createKeeping(ctx: OpeningCtx) {
  const { scene, rand, colliders, groundH } = ctx;
  const K = KEEPING;

  // ---- ledge: shelf → bend → steam pad, moss-capped columns under walk boxes, a low curb on the drop side
  const W = K.ledgeWidth;
  const pts = K.ledge;
  const curbMat = toon(0x7a6a58, { contour: 0.5 });
  const curb = (x: number, z: number, yaw: number, len: number) => {
    const h = 0.42 + rand() * 0.12;
    const m = inked(hewn(new THREE.BoxGeometry(0.42, h, len, 1, 1, 2), rand, 0.06), curbMat, 0.02, true);
    m.position.set(x, SHELF_TOP + h / 2 - 0.12, z);
    m.rotation.y = yaw + (rand() - 0.5) * 0.12;
    scene.add(m);
    colliders.push({ kind: 'box', x, z, yaw, hx: 0.24, hz: len / 2 + 0.05, top: SHELF_TOP + h - 0.12 });
  };
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i]!;
    const [bx, bz] = pts[i + 1]!;
    const len = Math.hypot(bx - ax, bz - az);
    const yaw = Math.atan2(bx - ax, bz - az);
    const dir = { x: (bx - ax) / len, z: (bz - az) / len };
    colliders.push({ kind: 'box', x: (ax + bx) / 2, z: (az + bz) / 2, yaw, hx: W / 2, hz: len / 2 + 0.2, top: SHELF_TOP });
    const cols = Math.ceil(len / 2.1);
    for (let k = 0; k <= cols; k++) {
      const t = k / cols;
      const side = (k & 1 ? 1 : -1) * 0.22;
      const x = ax + (bx - ax) * t + dir.z * side;
      const z = az + (bz - az) * t - dir.x * side;
      if (i === 0 && t < 0.3) continue; // the shelf's own columns carry the first stretch
      const col = column(rand, x, z, 1.85, groundH(x, z) - 2, SHELF_TOP, true);
      scene.add(col);
      ctx.occluders.push(col);
    }
    // curb on the drop sides: the outside of the bend on A (its inside is the ridge), both sides of B
    const n = { x: dir.z, z: -dir.x };
    const other = i === 0 ? pts[2]! : pts[0]!;
    const inside = Math.sign((other[0] - pts[1]![0]) * n.x + (other[1] - pts[1]![1]) * n.z);
    const sides = i === 0 ? [-inside] : [-inside, inside];
    for (const sd of sides) {
      const off = (W / 2 - 0.2) * sd;
      const t0 = i === 0 ? 0.35 : 0;
      const t1 = i === pts.length - 2 ? 0.88 : 1;
      const m = Math.max(1, Math.round(((t1 - t0) * len) / 1.25));
      for (let k = 0; k < m; k++) {
        const t = t0 + ((k + 0.5) / m) * (t1 - t0);
        curb(ax + (bx - ax) * t + n.x * off, az + (bz - az) * t + n.z * off, yaw, ((t1 - t0) * len) / m - 0.1);
      }
    }
  }
  // the bend itself: a square pad so the corner has no seam, curbed round the outside
  {
    const [bx, bz] = pts[1]!;
    colliders.push({ kind: 'box', x: bx, z: bz, yaw: 0.35, hx: W / 2, hz: W / 2, top: SHELF_TOP });
  }
  // steam pad under the spring, a little wider than the ledge
  plinth(ctx, { x: K.steam.x, z: K.steam.z, hx: 1.9, hz: 1.9, yaw: K.terrace.yaw, top: SHELF_TOP }, 1.7, 2);

  // ---- steam spring: a still, pressed pool in a stone ring (the chemistry draws its vapour)
  {
    const g = stoneRing(rand, K.steam.r + 0.25, K.steam.r - 0.05, 0.2, 0x8c9a94);
    g.position.set(K.steam.x, SHELF_TOP, K.steam.z);
    scene.add(g);
  }

  // ---- coal cradle on the shelf: a small lit ring the coal rests in
  {
    const g = stoneRing(rand, 0.42, 0.26, 0.14, ASH, 6);
    g.position.set(K.coal.x, SHELF_TOP, K.coal.z);
    scene.add(g);
  }

  // ---- root-hearth terrace + far crag
  plinth(ctx, K.terrace, 1.55, 3);
  plinth(ctx, K.crag, 1.5, 3);
  {
    // talus at the crag foot so it sits in the rim slope instead of standing on it
    for (const [lx, lz, sz] of [[2.6, 1.2, 0.8], [-2.4, -0.6, 0.65], [1.0, -3.1, 0.9]] as const) {
      const c = Math.cos(K.crag.yaw);
      const s = Math.sin(K.crag.yaw);
      const x = K.crag.x + lx * c + lz * s;
      const z = K.crag.z - lx * s + lz * c;
      const r = buildRock(rand, sz);
      r.position.set(x, groundH(x, z) + sz * 0.2, z);
      scene.add(r);
      scene.add(contactInk(r, groundH));
      colliders.push({ kind: 'cap', x, z, r: sz * 1.1, base: groundH(x, z), h: sz * 0.95 });
    }
  }

  // ---- root-hearth bowl among the roots
  {
    const g = stoneRing(rand, K.root.r + 0.22, K.root.r - 0.08, 0.26, ASH);
    g.position.set(K.root.x, K.terrace.top, K.root.z);
    scene.add(g);
  }

  // ---- the Hearthtree
  const pivot = new THREE.Group();
  pivot.position.set(K.hinge.x, K.hinge.y, K.hinge.z);
  pivot.rotation.y = K.terrace.yaw;
  scene.add(pivot);
  pivot.add(buildRoots(rand, K.terrace.top + 0.4));
  const { tree, pads, crown } = buildHearthtree(rand, K.terrace.top);
  pivot.add(tree);
  ctx.occluders.push(tree);
  const settled = Math.PI / 2 - 0.035;
  tree.rotation.x = K.leanArrested;

  // ---- leaves pressed in mid-air under the crown; they resume with the tree
  const LEAVES = 170;
  const leafMat = toon(0xffffff, { contour: 0.3, climbBase: K.terrace.top, ramp: RAMP_CANOPY });
  leafMat.side = THREE.DoubleSide;
  const leaves = new THREE.InstancedMesh(mapleLeafGeometry(0.11), leafMat, LEAVES);
  leaves.castShadow = false;
  leaves.frustumCulled = false;
  scene.add(leaves);
  const leaf = Array.from({ length: LEAVES }, () => ({
    p: new THREE.Vector3(), v: new THREE.Vector3(), rot: new THREE.Euler(rand() * 6, rand() * 6, rand() * 6),
    spin: (rand() - 0.5) * 5, sway: rand() * 6.28, state: 'frozen' as 'frozen' | 'falling' | 'rest', restT: 0,
  }));
  const tone = new THREE.Color();
  leaf.forEach((l, i) => leaves.setColorAt(i, tone.setHex(i % 3 ? 0xa4483a : 0xc06a3c).multiplyScalar(0.85 + rand() * 0.25)));
  const crownWorld = (out: THREE.Vector3) => {
    const c = crown[Math.floor(rand() * crown.length)]!;
    out.set((rand() - 0.5) * c.r * 1.4, (rand() - 0.6) * c.r, (rand() - 0.5) * c.r * 1.4).add(c.at);
    return tree.localToWorld(out);
  };
  scene.updateMatrixWorld(true);
  for (const l of leaf) {
    // a pressed drift: a loose sheet hanging from the crown toward the gorge floor, stopped mid-fall
    crownWorld(l.p);
    l.p.y -= rand() * rand() * 7;
  }
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const syncLeaves = () => {
    leaf.forEach((l, i) => leaves.setMatrixAt(i, m4.compose(l.p, q.setFromEuler(l.rot), one)));
    leaves.instanceMatrix.needsUpdate = true;
  };
  syncLeaves();
  const floorAt = (x: number, z: number) => {
    const s = ctx.player?.surfaceAt(x, z) ?? groundH(x, z);
    return Number.isFinite(s) ? s : groundH(x, z);
  };

  // ---- release + settle
  let phase: Phase = 'arrested';
  let t = 0;
  let impacts = 0;
  let bridge: Collider | null = null;
  let onSettled: (() => void) | null = null;
  let lastImpact = false;
  const bridgeBox = (): Collider => {
    const reach = K.span - K.crag.hz + 0.8;
    const s = reach / 2 - 0.3;
    return { kind: 'box', x: K.hinge.x + K.fall.x * s, z: K.hinge.z + K.fall.z * s, yaw: K.terrace.yaw, hx: 0.62, hz: reach / 2 + 0.3, top: K.terrace.top + 0.12 };
  };
  const angleAt = (tau: number): number => {
    const S = SETTLE;
    if (tau < S.shiver) return K.leanArrested + 0.014 * Math.sin(tau * 52) * THREE.MathUtils.smoothstep(tau, 0, 0.35);
    const u = (tau - S.shiver) / S.fall;
    if (u < 1) return K.leanArrested + (settled - K.leanArrested) * Math.pow(u, S.ease);
    const v = tau - S.shiver - S.fall;
    return settled - S.rebound * Math.exp(-5 * v) * Math.abs(Math.sin(v * Math.PI * 2.4));
  };

  function release(): void {
    if (phase !== 'arrested') return;
    phase = 'settling';
    t = 0;
  }

  ctx.onUpdate((dt) => {
    const S = SETTLE;
    let impact = false;
    if (phase === 'settling') {
      const before = t;
      t += dt;
      tree.rotation.x = angleAt(t);
      const hit = S.shiver + S.fall;
      if (before < hit && t >= hit) {
        impact = true;
        impacts++;
        // the bridge takes weight a beat after the trunk lands
        bridge = bridgeBox();
        colliders.push(bridge);
      }
      if (t >= hit + S.bounce) {
        phase = 'bridge';
        tree.rotation.x = settled;
        onSettled?.();
      }
    }
    // crown follow-through: lobes lag the trunk, then wobble out after the impact
    const sinceHit = phase === 'arrested' ? -1 : t - S.shiver - S.fall;
    for (const [i, pad] of pads.entries()) {
      const rest = pad.userData.rest as THREE.Vector3;
      const wob = sinceHit > 0 ? Math.exp(-3.5 * sinceHit) * Math.sin(sinceHit * 14 + i) * 0.22 : 0;
      pad.position.set(rest.x, rest.y + wob, rest.z + (phase === 'settling' && sinceHit < 0 ? -0.15 : 0));
    }
    // leaves: frozen until the shiver ends; then they fall, settle, and the living crown keeps dropping them
    const go = phase !== 'arrested' && t > S.shiver * 0.6;
    for (const l of leaf) {
      if (l.state === 'frozen') {
        if (!go) continue;
        l.state = 'falling';
        l.v.set((rand() - 0.5) * 0.4, -0.2 - rand() * 0.4, (rand() - 0.5) * 0.4);
      }
      if (impact && rand() < 0.45) {
        // the landing shakes a burst loose from the crown
        crownWorld(l.p);
        l.v.set((rand() - 0.5) * 2.4, 1.0 + rand() * 1.6, (rand() - 0.5) * 2.4);
        l.state = 'falling';
      }
      if (l.state === 'rest') {
        l.restT += dt;
        if (phase === 'bridge' && l.restT > 8 && rand() < dt * 0.08) {
          crownWorld(l.p);
          l.v.set(0, -0.3, 0);
          l.state = 'falling';
        }
        continue;
      }
      l.sway += dt * 2.2;
      l.v.y = Math.max(-0.9, l.v.y - dt * 2.2);
      l.v.x = THREE.MathUtils.damp(l.v.x, Math.cos(l.sway) * 0.55, 2, dt);
      l.v.z = THREE.MathUtils.damp(l.v.z, Math.sin(l.sway * 0.7) * 0.4, 2, dt);
      l.p.addScaledVector(l.v, dt);
      l.rot.x += l.spin * dt;
      l.rot.z += l.spin * 0.6 * dt;
      const floor = floorAt(l.p.x, l.p.z);
      if (l.p.y <= floor + 0.02) {
        l.p.y = floor + 0.02;
        l.rot.set((rand() - 0.5) * 0.2, rand() * 6, (rand() - 0.5) * 0.2);
        l.state = 'rest';
        l.restT = 0;
      }
    }
    if (phase !== 'arrested') syncLeaves();
    lastImpact = impact;
  });

  return {
    release,
    /** Called once when the tree has finished settling (the bridge is already walkable at impact) */
    onSettled(fn: () => void) {
      onSettled = fn;
    },
    state() {
      return {
        phase,
        t: +t.toFixed(3),
        angle: +tree.rotation.x.toFixed(4),
        bridge: bridge !== null,
        impact: lastImpact,
        impacts,
        bridgeTop: +(K.terrace.top + 0.12).toFixed(3),
      };
    },
  };
}
