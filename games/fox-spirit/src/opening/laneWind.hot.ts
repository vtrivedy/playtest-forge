/**
 * Something alive on the walk west (Kit 08:56: "the lane is where a player gives up"; Bramble's lane, Ember's
 * file). While the fox is on the sunken leaf lane, every 5–10 s a gust comes down it: you hear it arrive from
 * up-lane (soft band-swept noise, placed and moving), and a handful of maple leaves blow off the lane's trees,
 * tumble past the fox along the wind and settle, then fade. No colliders, own seed, allocation-free per frame.
 */
import * as THREE from 'three';
import { mapleLeafGeometry, RAMP_CANOPY, rng } from '../lookdevKit';
import { LANE } from './millbrookLayout';
import type { OpeningCtx } from './scene';

export const LANE_WIND = {
  /** within this far of the lane centre line the lane breathes */
  near: 7,
  gapMin: 5,
  gapMax: 10,
  leavesPerGust: 13,
  /** wind speed along the lane (m/s) and how long a leaf lies before fading (s) */
  wind: 2.6,
  rest: 6,
  gain: 0.05,
};
const LEAVES = 44;

export function createLaneWind(ctx: OpeningCtx) {
  // cold:begin (construction only)
  const rand = rng(9011);
  // plain toon, not the paint patch: in the sepia world the patch would turn them to paper and they would vanish
  // (KNOWLEDGE: things that must read before the payoff stay in colour) — the lane's one moving warm note
  const mat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: RAMP_CANOPY, side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(mapleLeafGeometry(0.22), mat, LEAVES);
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  ctx.scene.add(mesh);
  const tone = new THREE.Color();
  const p = new Float32Array(LEAVES * 3);
  const v = new Float32Array(LEAVES * 3);
  const r = new Float32Array(LEAVES * 3);
  const spin = new Float32Array(LEAVES);
  const sway = new Float32Array(LEAVES);
  /** 0 hidden, 1 flying, 2 resting; age while resting */
  const st = new Uint8Array(LEAVES);
  const age = new Float32Array(LEAVES);
  for (let i = 0; i < LEAVES; i++) {
    mesh.setColorAt(i, tone.setHex(i % 3 === 0 ? 0xc77b3a : i % 3 === 1 ? 0xa4483a : 0xb8913f).multiplyScalar(0.85 + rand() * 0.25));
    spin[i] = (rand() - 0.5) * 6;
    sway[i] = rand() * 6.28;
  }
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < LEAVES; i++) mesh.setMatrixAt(i, hidden);
  // the gust's voice: looped noise through a band that sweeps as it passes, placed where the gust is
  const ac = ctx.audio.ac;
  const len = ac.sampleRate * 2;
  const nb = ac.createBuffer(1, len, ac.sampleRate);
  const nd = nb.getChannelData(0);
  for (let i = 0, b = 0; i < len; i++) nd[i] = b = b * 0.6 + (rand() * 2 - 1) * 0.4;
  const src = ac.createBufferSource();
  src.buffer = nb;
  src.loop = true;
  const band = new BiquadFilterNode(ac, { type: 'bandpass', frequency: 500, Q: 0.6 });
  const gain = new GainNode(ac, { gain: 0 });
  const pan = ctx.audio.at(new THREE.Vector3(LANE[0]![0], 2, LANE[0]![1]), 5);
  src.connect(band).connect(gain).connect(pan);
  src.start();
  let next = 3;
  let t = 0;
  let gusts = 0;
  let next0 = 0;
  /** wind direction for the current gust (unit xz) and where it is */
  let wx = 1;
  let wz = 0;
  const gustAt = new THREE.Vector3();
  let gustLife = 0;
  // cold:end

  /** distance from (x, z) to the lane line, and the lane's down-lane direction there (into wx/wz) */
  function laneDist(x: number, z: number): number {
    let best = Infinity;
    for (let i = 0; i + 1 < LANE.length; i++) {
      const ax = LANE[i]![0];
      const az = LANE[i]![1];
      const dx = LANE[i + 1]![0] - ax;
      const dz = LANE[i + 1]![1] - az;
      const l2 = dx * dx + dz * dz;
      const k = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / l2));
      const d = Math.hypot(x - ax - dx * k, z - az - dz * k);
      if (d < best) {
        best = d;
        const l = Math.sqrt(l2);
        // the wind runs west, down the lane toward the valley
        wx = dx / l;
        wz = dz / l;
      }
    }
    return best;
  }

  function gust(fx: number, fz: number): void {
    gusts++;
    // it is heard arriving from up-lane, and shakes leaves off the lane-side maples just ahead of the fox (where the
    // chase cam looks: a walking fox would outrun leaves that start behind it)
    gustAt.set(fx - wx * 4, ctx.groundH(fx, fz) + 2.6, fz - wz * 4);
    gustLife = 0;
    const now = ac.currentTime;
    gain.gain.setTargetAtTime(LANE_WIND.gain, now, 0.5);
    gain.gain.setTargetAtTime(0, now + 2.2, 0.9);
    band.frequency.setValueAtTime(320, now);
    band.frequency.setTargetAtTime(900, now, 0.8);
    band.frequency.setTargetAtTime(380, now + 2.2, 1);
    let made = 0;
    for (let k = 0; k < LEAVES && made < LANE_WIND.leavesPerGust; k++) {
      const i = (next0 + k) % LEAVES;
      if (st[i] === 1) continue;
      made++;
      const side = (rand() < 0.5 ? -1 : 1) * (1.2 + rand() * 2.2);
      const ahead = 2 + rand() * 5;
      const o = i * 3;
      p[o] = fx + wx * ahead - wz * side;
      p[o + 1] = ctx.groundH(fx, fz) + 1.8 + rand() * 1.8;
      p[o + 2] = fz + wz * ahead + wx * side;
      const s = LANE_WIND.wind * (0.7 + rand() * 0.6);
      v[o] = wx * s;
      v[o + 1] = 0.2 + rand() * 0.5;
      v[o + 2] = wz * s;
      st[i] = 1;
      age[i] = 0;
    }
    next0 = (next0 + LANE_WIND.leavesPerGust) % LEAVES;
  }

  ctx.onUpdate((dt) => {
    t += dt;
    const f = ctx.fox.root.position;
    const near = laneDist(f.x, f.z) < LANE_WIND.near;
    if (near && t >= next) {
      gust(f.x, f.z);
      next = t + LANE_WIND.gapMin + rand() * (LANE_WIND.gapMax - LANE_WIND.gapMin);
    } else if (!near) next = Math.max(next, t + 2);
    // the voice travels with the gust
    if (gustLife < 4) {
      gustLife += dt;
      gustAt.x += wx * LANE_WIND.wind * dt;
      gustAt.z += wz * LANE_WIND.wind * dt;
      const now = ac.currentTime;
      pan.positionX.setTargetAtTime(gustAt.x, now, 0.1);
      pan.positionY.setTargetAtTime(gustAt.y, now, 0.1);
      pan.positionZ.setTargetAtTime(gustAt.z, now, 0.1);
    }
    let dirty = false;
    for (let i = 0; i < LEAVES; i++) {
      if (st[i] === 0) continue;
      dirty = true;
      const o = i * 3;
      if (st[i] === 1) {
        sway[i]! += dt * 2.4;
        v[o + 1] = Math.max(-0.8, v[o + 1]! - dt * 1.6);
        // the wind dies as the leaf drops; it swings across the lane on the way down
        v[o] = THREE.MathUtils.damp(v[o]!, wx * LANE_WIND.wind * 0.4 + Math.cos(sway[i]!) * 0.5 * -wz, 1.2, dt);
        v[o + 2] = THREE.MathUtils.damp(v[o + 2]!, wz * LANE_WIND.wind * 0.4 + Math.cos(sway[i]!) * 0.5 * wx, 1.2, dt);
        p[o]! += v[o]! * dt;
        p[o + 1]! += v[o + 1]! * dt;
        p[o + 2]! += v[o + 2]! * dt;
        r[o]! += spin[i]! * dt;
        r[o + 2]! += spin[i]! * 0.6 * dt;
        const floor = ctx.groundH(p[o]!, p[o + 2]!) + 0.02;
        if (p[o + 1]! <= floor) {
          p[o + 1] = floor;
          r[o] = (rand() - 0.5) * 0.2;
          r[o + 2] = (rand() - 0.5) * 0.2;
          st[i] = 2;
          age[i] = 0;
        }
      } else {
        age[i]! += dt;
        if (age[i]! > LANE_WIND.rest + 1.5) {
          st[i] = 0;
          mesh.setMatrixAt(i, hidden);
          continue;
        }
      }
      const fade = st[i] === 2 ? 1 - THREE.MathUtils.smoothstep(age[i]!, LANE_WIND.rest, LANE_WIND.rest + 1.5) : 1;
      pos.set(p[o]!, p[o + 1]!, p[o + 2]!);
      e.set(r[o]!, r[o + 1]!, r[o + 2]!);
      q.setFromEuler(e);
      scl.setScalar(Math.max(0.001, fade));
      mesh.setMatrixAt(i, m4.compose(pos, q, scl));
    }
    if (dirty) mesh.instanceMatrix.needsUpdate = true;
  });

  // cold:begin (built once)
  return { state: () => ({ gusts, flying: st.reduce((a, s) => a + (s === 1 ? 1 : 0), 0) }) };
  // cold:end
}
