/**
 * Millbrook's race (DESIGN-millbrook.md, tla/Millrace.tla): the brook water, the leaf dam holding it,
 * and the wheel. Dash through the dam → it bursts → the water front runs down the dry bed → at the
 * wheel the wheel turns and the valley paints, once. Per-frame code here allocates nothing: every
 * vector, matrix and option object is made at build time.
 */
import * as THREE from 'three';
import { mapleLeafGeometry, toon } from '../lookdevKit';
import type { OpeningCtx } from './scene';
import { BROOK, brookAt, brookLength, MILLBROOK, waterY } from './millbrookLayout';
import { createWaterSounds } from './waterSounds.hot';

export const MILLRACE = {
  /** brook section length (m) of the water ribbon */
  section: 0.5,
  /** water front speed down the dry bed (m/s) */
  frontSpeed: 3.2,
  /** dash reach to burst the dam (m from its centre, xz) */
  reach: 2.4,
  /** wheel turn rate when running (rad/s) and spin-up rate (1/s) */
  wheelRate: 0.85,
  spinUp: 0.6,
  /** permanent wash at the mill when the wheel takes the water */
  paintR: 26,
  paintSecs: 3.2,
  /** surface flecks riding the current */
  flecks: 70,
  flowSpeed: 1.5,
  pondDrift: 0.12,
  /** dam leaves */
  leaves: 240,
};

type Phase = 'held' | 'burst';

export function createMillrace(ctx: OpeningCtx, wheel: THREE.Object3D) {
  const F = MILLRACE;
  const M = MILLBROOK;
  const { scene } = ctx;

  // brook sections, sampled once: centre, tangent, water height
  const n = Math.floor(brookLength / F.section) + 1;
  const sx = new Float32Array(n);
  const sz = new Float32Array(n);
  const stx = new Float32Array(n);
  const stz = new Float32Array(n);
  const sy = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = brookAt(i * F.section);
    sx[i] = p.x;
    sz[i] = p.z;
    stx[i] = p.tx;
    stz[i] = p.tz;
    sy[i] = waterY(p.z);
  }

  // the water ribbon: 5 verts across per section (pale shallows → deep centre; the edges sink under the banks)
  const ACROSS = [-2.4, -1.25, 0, 1.25, 2.4];
  const TONES = [0xa9c2b8, 0x8fb0ab, 0x5f8a93, 0x8fb0ab, 0xa9c2b8].map((h) => new THREE.Color(h));
  const A = ACROSS.length;
  const pos = new Float32Array(n * A * 3);
  const col = new Float32Array(n * A * 3);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < A; j++) {
      const o = (i * A + j) * 3;
      pos[o] = sx[i]! - stz[i]! * ACROSS[j]!;
      pos[o + 1] = sy[i]!;
      pos[o + 2] = sz[i]! + stx[i]! * ACROSS[j]!;
      const c = TONES[j]!;
      col[o] = c.r;
      col[o + 1] = c.g;
      col[o + 2] = c.b;
    }
  }
  const index: number[] = [];
  for (let i = 0; i + 1 < n; i++) {
    for (let j = 0; j + 1 < A; j++) {
      const a = i * A + j;
      const b = (i + 1) * A + j;
      index.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  const water = new THREE.Mesh(geo, toon(0xffffff, { vertexColors: true, hatchWeight: 0.15 }));
  water.name = 'brook-water';
  water.receiveShadow = true;
  scene.add(water);
  const PER_SECTION = (A - 1) * 6;
  const damSection = Math.round(M.dam.s / F.section);
  const wheelSection = Math.round(M.wheel.s / F.section);

  // flecks: pale streaks drifting on the surface (slow in the pond, quick in the running brook)
  const fleckGeo = new THREE.PlaneGeometry(0.035, 0.26);
  fleckGeo.rotateX(-Math.PI / 2);
  const flecks = new THREE.InstancedMesh(fleckGeo, toon(0xa9c0b9), F.flecks);
  flecks.frustumCulled = false;
  scene.add(flecks);
  const fs = new Float32Array(F.flecks);
  const fo = new Float32Array(F.flecks);
  const fv = new Float32Array(F.flecks);
  for (let i = 0; i < F.flecks; i++) {
    fs[i] = ctx.rand() * M.dam.s;
    fo[i] = (ctx.rand() - 0.5) * 1.8;
    fv[i] = 0.75 + ctx.rand() * 0.5;
  }

  // the dam: a mound of leaves across the channel, then a burst of leaves that settle or float away
  const leafMat = toon(0xffffff);
  leafMat.side = THREE.DoubleSide;
  const leaves = new THREE.InstancedMesh(mapleLeafGeometry(0.085), leafMat, F.leaves);
  leaves.frustumCulled = false;
  scene.add(leaves);
  const lp = new Float32Array(F.leaves * 3);
  const lv = new Float32Array(F.leaves * 3);
  const lr = new Float32Array(F.leaves * 3);
  const ls = new Float32Array(F.leaves * 3);
  /** 0 resting in the mound, 1 flying, 2 floating, 3 settled on the bank */
  const lstate = new Uint8Array(F.leaves);
  const LEAF = [0xb4502e, 0xc8763c, 0x9a4a2a, 0xd09040, 0x8a5a34, 0x6e5a3a];
  const leafColour = new THREE.Color();
  const damY = sy[damSection]!;
  const dtx = stx[damSection]!;
  const dtz = stz[damSection]!;
  for (let i = 0; i < F.leaves; i++) {
    const across = (ctx.rand() - 0.5) * 4.4;
    const alongK = (ctx.rand() - 0.5) * 1.3;
    const hump = 0.55 * (1 - (across / 2.4) ** 2) * (1 - (alongK / 0.8) ** 2);
    const o = i * 3;
    lp[o] = M.dam.x - dtz * across + dtx * alongK;
    lp[o + 1] = damY - 0.3 + Math.max(0, hump) * ctx.rand() + ctx.rand() * 0.25;
    lp[o + 2] = M.dam.z + dtx * across + dtz * alongK;
    lr[o] = (ctx.rand() - 0.5) * 1.4;
    lr[o + 1] = ctx.rand() * 6.28;
    lr[o + 2] = (ctx.rand() - 0.5) * 1.4;
    ls[o] = (ctx.rand() - 0.5) * 9;
    ls[o + 1] = (ctx.rand() - 0.5) * 9;
    ls[o + 2] = (ctx.rand() - 0.5) * 9;
    leaves.setColorAt(i, leafColour.setHex(LEAF[i % LEAF.length]!));
  }

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const scl = new THREE.Vector3();
  const paintAt = new THREE.Vector3(M.mill.x, 0, M.mill.z);
  const PAINT_OPTS = { edgeMax: 2.6 };
  // Ember's synthesized brook babble / wheel knocks / burst (waterSounds.hot.ts)
  const sounds = createWaterSounds({
    audio: ctx.audio,
    brook: BROOK.map(([x, z]) => new THREE.Vector3(x, waterY(z), z)),
    wheel: new THREE.Vector3(M.wheel.x, waterY(M.wheel.z) + 1.35, M.wheel.z),
  });
  const damAt = new THREE.Vector3(M.dam.x, waterY(M.dam.z), M.dam.z);

  // one teach line, like the hearth's: only while standing by the held dam
  const hud = document.createElement('div');
  hud.dataset.openingTeach = 'millrace';
  hud.textContent = 'The leaves have stopped the brook · Shift dash through them';
  Object.assign(hud.style, {
    position: 'fixed', left: '50%', bottom: '7%', transform: 'translateX(-50%)',
    color: '#f4e5cb', background: 'rgba(43,35,30,.76)', padding: '10px 18px',
    borderRadius: '5px', font: '16px Georgia,serif', textAlign: 'center',
    pointerEvents: 'none', maxWidth: '80vw', transition: 'opacity .4s', opacity: '0',
  });
  document.body.append(hud);
  let nearT = 0;
  let teaching = false;

  let phase: Phase = 'held';
  let front = damSection * F.section;
  let turning = false;
  let painted = false;
  let spin = 0;
  let dashWindow = 0;
  let burstAt = -1;

  function placeLeaf(i: number): void {
    const o = i * 3;
    v.set(lp[o]!, lp[o + 1]!, lp[o + 2]!);
    e.set(lr[o]!, lr[o + 1]!, lr[o + 2]!);
    q.setFromEuler(e);
    scl.copy(one);
    if (lstate[i] === 2) scl.multiplyScalar(Math.max(0.001, 1 - (lv[o + 1]! / 14)));
    leaves.setMatrixAt(i, m4.compose(v, q, scl));
  }
  for (let i = 0; i < F.leaves; i++) placeLeaf(i);
  leaves.instanceMatrix.needsUpdate = true;

  function burst(t: number): void {
    phase = 'burst';
    burstAt = t;
    sounds.burst(damAt);
    ctx.audio.cue('millrace-burst');
    for (let i = 0; i < F.leaves; i++) {
      const o = i * 3;
      const r = ctx.rand();
      lstate[i] = 1;
      // fling: up and outward, carried downstream
      lv[o] = (ctx.rand() - 0.5) * 3.2 + dtx * (1.5 + r * 2.5);
      lv[o + 1] = 2.2 + ctx.rand() * 3.4;
      lv[o + 2] = (ctx.rand() - 0.5) * 3.2 + dtz * (1.5 + r * 2.5);
    }
  }

  /** nearest section at/before arc length s */
  function sectionAt(s: number): number {
    return Math.max(0, Math.min(n - 1, Math.floor(s / F.section)));
  }

  function update(dt: number, t: number): void {
    // the burst: a dash whose path passes the dam
    if (burstAt === -2) burst(t);
    if (dashWindow > 0) {
      dashWindow -= dt;
      const f = ctx.fox.root.position;
      if (phase === 'held' && Math.hypot(f.x - M.dam.x, f.z - M.dam.z) < F.reach) burst(t);
    }
    const fox = ctx.fox.root.position;
    const near = phase === 'held' && Math.hypot(fox.x - M.dam.x, fox.z - M.dam.z) < 7;
    nearT = near ? nearT + dt : 0;
    if (teaching !== nearT > 1.2) {
      teaching = nearT > 1.2;
      hud.style.opacity = teaching ? '1' : '0';
    }
    if (phase === 'burst' && front < brookLength) front = Math.min(brookLength, front + F.frontSpeed * dt);
    geo.setDrawRange(0, Math.max(1, sectionAt(front)) * PER_SECTION);
    if (!turning && front >= wheelSection * F.section) {
      turning = true;
      ctx.audio.cue('mill-turning');
      if (!painted) {
        painted = true;
        ctx.field.restore(paintAt, F.paintR, F.paintSecs, PAINT_OPTS);
      }
    }
    spin = THREE.MathUtils.damp(spin, turning ? F.wheelRate : 0, F.spinUp, dt);
    wheel.rotateX(-spin * dt);
    sounds.update(ctx.fox.root.position, phase === 'burst' ? Math.min(1, (front - M.dam.s) / 6) : 0, spin / F.wheelRate, dt);

    // flecks ride the current inside the drawn water
    const head = phase === 'held' ? M.dam.s - 0.6 : front - 0.3;
    const held = phase === 'held';
    for (let i = 0; i < F.flecks; i++) {
      fs[i] = fs[i]! + fv[i]! * (held ? F.pondDrift : F.flowSpeed) * dt;
      if (fs[i]! > head) fs[i] = (fs[i]! - head) % 1.5;
      const k = sectionAt(fs[i]!);
      const u = Math.min(1, fs[i]! / F.section - k);
      const k2 = Math.min(n - 1, k + 1);
      const x = sx[k]! + (sx[k2]! - sx[k]!) * u;
      const z = sz[k]! + (sz[k2]! - sz[k]!) * u;
      v.set(x - stz[k]! * fo[i]!, sy[k]! + 0.025, z + stx[k]! * fo[i]!);
      e.set(0, Math.atan2(stx[k]!, stz[k]!), 0);
      q.setFromEuler(e);
      // fade in at the wrap so a fleck never pops into being
      const life = Math.min(1, fs[i]! / 1.2, (head - fs[i]!) / 0.8);
      scl.set(1, 1, Math.max(0.001, life) * (held ? 0.6 : 1.2));
      flecks.setMatrixAt(i, m4.compose(v, q, scl));
    }
    flecks.instanceMatrix.needsUpdate = true;

    if (phase === 'burst' && t - burstAt < 40) {
      for (let i = 0; i < F.leaves; i++) {
        const st = lstate[i]!;
        if (st === 3) continue;
        const o = i * 3;
        if (st === 1) {
          lv[o + 1] = lv[o + 1]! - 9.8 * dt;
          // flutter: drag toward a slow fall once descending
          if (lv[o + 1]! < -0.8) lv[o + 1] = THREE.MathUtils.damp(lv[o + 1]!, -0.8, 4, dt);
          lv[o] = THREE.MathUtils.damp(lv[o]!, 0, 0.8, dt);
          lv[o + 2] = THREE.MathUtils.damp(lv[o + 2]!, 0, 0.8, dt);
          lp[o] = lp[o]! + (lv[o]! + Math.sin(t * 2.1 + i) * 0.4) * dt;
          lp[o + 1] = lp[o + 1]! + lv[o + 1]! * dt;
          lp[o + 2] = lp[o + 2]! + (lv[o + 2]! + Math.cos(t * 1.7 + i) * 0.4) * dt;
          lr[o] = lr[o]! + ls[o]! * dt;
          lr[o + 1] = lr[o + 1]! + ls[o + 1]! * dt;
          lr[o + 2] = lr[o + 2]! + ls[o + 2]! * dt;
          const g = ctx.groundH(lp[o]!, lp[o + 2]!);
          const w = waterY(lp[o + 2]!);
          if (lv[o + 1]! < 0 && lp[o + 1]! <= Math.max(g, w) + 0.02) {
            if (w > g) {
              // floating: arc length + offset across the flow live in the spin slots, age in vy
              lstate[i] = 2;
              const s0 = nearestS(lp[o]!, lp[o + 2]!);
              const k = sectionAt(s0);
              ls[o] = s0;
              ls[o + 2] = (lp[o]! - sx[k]!) * -stz[k]! + (lp[o + 2]! - sz[k]!) * stx[k]!;
              lv[o + 1] = 0;
              lr[o] = 0;
              lr[o + 2] = 0;
            } else {
              lstate[i] = 3;
              lp[o + 1] = g + 0.02;
              lr[o] = 0;
              lr[o + 2] = 0;
            }
          }
        } else if (st === 2) {
          // float away down the current, shrinking out as it goes
          // ride the current, but never ahead of the front
          ls[o] = Math.min(front - 0.5, ls[o]! + F.flowSpeed * 0.8 * dt);
          const k = sectionAt(ls[o]!);
          lp[o] = sx[k]! - stz[k]! * ls[o + 2]!;
          lp[o + 2] = sz[k]! + stx[k]! * ls[o + 2]!;
          lp[o + 1] = sy[k]! + 0.02;
          lr[o + 1] = lr[o + 1]! + ls[o + 1]! * 0.1 * dt;
          lv[o + 1] = lv[o + 1]! + dt;
          if (lv[o + 1]! > 14) lstate[i] = 3;
        }
        placeLeaf(i);
      }
      leaves.instanceMatrix.needsUpdate = true;
    }
  }

  /** arc length of the nearest section (coarse: scans sections near the dam → mouth) */
  function nearestS(x: number, z: number): number {
    let best = 0;
    let bd = Infinity;
    for (let i = damSection; i < n; i += 2) {
      const d = (sx[i]! - x) ** 2 + (sz[i]! - z) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best * F.section;
  }

  ctx.onUpdate(update);
  return {
    /** the controller accepted a dash: watch its path for the dam for the dash's duration */
    onDash(): void {
      dashWindow = 0.35;
    },
    turning: () => turning,
    spin: () => spin,
    /** dev: burst the dam as if dashed */
    burst(): void {
      if (phase === 'held') burstAt = -2;
    },
    state() {
      return { phase, front: Math.round(front * 10) / 10, turning, painted, spin: Math.round(spin * 100) / 100 };
    },
  };
}
