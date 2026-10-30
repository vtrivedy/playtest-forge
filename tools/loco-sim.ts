/**
 * Headless locomotion sanity sim (no browser): rebuilds the fox skeleton from the GLB node tree, drives the real
 * controller + locomotion with scripted input on flat ground / a slope, and reports stance skate, IK error and gait.
 * Usage: npx tsx tools/loco-sim.ts [--glb assets/hero/spirit_fox.glb]
 */
import * as THREE from 'three';
import fs from 'node:fs';
import { createLocomotion } from '../games/fox-spirit/src/locomotion/locomotion';
import { DEFAULT_MOVE, createMoveState, groundMove } from '../games/fox-spirit/src/locomotion/controller';
import { LEG_IDS } from '../games/fox-spirit/src/locomotion/rig';

const glbPath = process.argv.includes('--glb') ? process.argv[process.argv.indexOf('--glb') + 1] : 'assets/hero/spirit_fox.glb';
const b = fs.readFileSync(glbPath);
const j = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
const skinJoints = new Set<number>(j.skins[0].joints);
const objs: THREE.Object3D[] = j.nodes.map((n: any, i: number) => {
  const o = skinJoints.has(i) ? new THREE.Bone() : new THREE.Object3D();
  o.name = n.name;
  if (n.translation) o.position.fromArray(n.translation);
  if (n.rotation) o.quaternion.fromArray(n.rotation);
  if (n.scale) o.scale.fromArray(n.scale);
  return o;
});
j.nodes.forEach((n: any, i: number) => (n.children || []).forEach((c: number) => objs[i].add(objs[c])));
const root = new THREE.Group();
j.scenes[0].nodes.forEach((i: number) => root.add(objs[i]));
// same normalisation as fox.ts: scale to 1.25 tall from the skeleton box (approx: ear tip height)
root.updateMatrixWorld(true);
const box = new THREE.Box3();
root.traverse((o) => box.expandByPoint(o.getWorldPosition(new THREE.Vector3())));
const s = 1.25 / (box.max.y - box.min.y);
root.scale.setScalar(s);
root.position.y = -box.min.y * s;
const group = new THREE.Group();
group.add(root);

const slope = process.argv.includes('--slope') ? 0.3 : 0;
const groundAt = (x: number, z: number) => (slope ? Math.max(0, (-z - 4) * slope) : 0);
const loco = createLocomotion(group, groundAt, 0.02);
if (process.argv.includes("--rig")) { for (const id of LEG_IDS) { const L = loco.rig.legs[id]; console.log(id, "reach", L.reach.toFixed(3), "lens", L.lengths.map((v) => v.toFixed(3)).join(","), "hip", L.restJoints[0].toArray().map((v) => v.toFixed(3)).join(","), "foot", L.restFoot.toArray().map((v) => v.toFixed(3)).join(",")); } console.log("com", loco.rig.com.toArray()); }
const move = { ...DEFAULT_MOVE };
const ms = createMoveState(0);
const vel = new THREE.Vector3();
const dt = 1 / 60;
const maxSpeed = 9;
let t = 0;
let skateMax = 0;
const skateLeg: Record<string, number> = {};
let slips: number[] = [];
let pitchMax = 0;
let torsoRest: number | null = null;
const plantAge: Record<string, number> = {};
const badAges: number[] = [];
let skateSum = 0;
let skateN = 0;
let ikMax = 0;
const prevFoot: Record<string, THREE.Vector3 | null> = {};
const gaitLog: string[] = [];
let vy = 0;
let y = 0;

function stepSim(wish: THREE.Vector3, jump = false) {
  const grounded = y <= groundAt(group.position.x, group.position.z) + 1e-4 && vy <= 0;
  if (grounded) {
    groundMove(ms, move, wish, maxSpeed, group.rotation.y, vel, dt);
    group.rotation.y = wish.lengthSq() > 1e-4 || Math.hypot(vel.x, vel.z) > 0.05 ? ms.heading : group.rotation.y;
    if (jump) vy = 9;
  }
  if (!grounded || vy > 0) vy -= 27 * dt;
  group.position.x += vel.x * dt;
  group.position.z += vel.z * dt;
  y += vy * dt;
  const gy = groundAt(group.position.x, group.position.z);
  if (y < gy) { y = gy; vy = 0; }
  group.position.y = y + 0.02;
  group.updateMatrixWorld(true);
  const gnd = y <= gy + 1e-4 && vy <= 0;
  loco.update(dt, { vel: new THREE.Vector3(vel.x, vy, vel.z), grounded: gnd, gliding: false, dashing: false, skidding: gnd && ms.skidding, windup: 0 });
  t += dt;
  {
    // capture-stream torso metric: pelvis head → spine_04 head, vs idle
    const a = group.getObjectByName('pelvis')!.getWorldPosition(new THREE.Vector3());
    const b = group.getObjectByName('spine_04')!.getWorldPosition(new THREE.Vector3());
    const tp = Math.atan2(b.y - a.y, Math.hypot(b.x - a.x, b.z - a.z));
    if (torsoRest === null) torsoRest = tp;
    pitchMax = Math.max(pitchMax, Math.abs(tp - torsoRest));
  }
  for (const id of LEG_IDS) {
    const L = loco.legs[id];
    const head = L.rig.foot.getWorldPosition(new THREE.Vector3());
    const err = head.distanceTo(L.foot);
    if (L.mode !== 'air') ikMax = Math.max(ikMax, err);
    if (L.mode === 'plant' && !ms.skidding) {
      if (prevFoot[id]) {
        const d = head.distanceTo(prevFoot[id]!);
        skateMax = Math.max(skateMax, d);
        skateLeg[id] = Math.max(skateLeg[id] ?? 0, d);
        slips.push(d);
        if (d > 0.005) badAges.push(plantAge[id]);
        skateSum += d;
        skateN++;
      }
      prevFoot[id] = head;
      plantAge[id] = (plantAge[id] ?? 0) + 1;
    } else { prevFoot[id] = null; plantAge[id] = 0; }
    if (!Number.isFinite(err)) throw new Error('NaN at t=' + t);
    if (process.env.PEN && L.pen > 0.02) console.log('PEN', id, L.mode, (L.pen * 1000).toFixed(0), 't', t.toFixed(2), loco.state.gait, 'err', (L.err * 1000).toFixed(0));
  }
}
const W = (x: number, z: number) => new THREE.Vector3(x, 0, z);
const segs: [string, number, THREE.Vector3, boolean?][] = [
  ['idle', 1, W(0, 0)],
  ['walk', 2, W(0, 0.12)],
  ['trot', 2, W(0, 0.38)],
  ['gallop', 2.5, W(0, 1)],
  ['turnL', 1.2, W(1, 0.3).normalize()],
  ['hardstop', 1.5, W(-0.1, -1).normalize()],
  ['stop', 1.2, W(0, 0)],
  ['pivot', 1, W(-1, 0)],
  ['jump', 1.2, W(0, 1), true],
  ['idle2', 1, W(0, 0)],
];
for (const [name, dur, wish, jump] of segs) {
  const n = Math.round(dur / dt);
  const ikBefore = ikMax;
  skateMax = 0;
  for (const k of LEG_IDS) skateLeg[k] = 0;
  slips = [];
  pitchMax = 0;
  for (let i = 0; i < n; i++) stepSim(wish, !!jump && i === 10);
  const st = loco.snapshot();
  gaitLog.push(`${name.padEnd(8)} gait=${st.gait.padEnd(6)} speed=${st.speed.toFixed(2)} freq=${st.freq} duty=${st.duty} pitch=${st.pitch} roll=${st.roll} bend=${st.bend} skate=${LEG_IDS.map((k) => k + ':' + (skateLeg[k] * 1000).toFixed(0)).join(' ')}mm torsoErrMaxDeg=${(pitchMax * 57.3).toFixed(1)} bad=${slips.filter((d) => d > 0.005).length}/${slips.length} yaw=${group.rotation.y.toFixed(2)} contacts=${Object.values(st.contacts).map((c) => (c ? 1 : 0)).join('')}`);
  void ikBefore;
}
console.log(gaitLog.join('\n'));
console.log('bad slip plant-ages', JSON.stringify(badAges.slice(0, 80)));
console.log("solved metrics", JSON.stringify(loco.metrics()));
console.log(`stance skate mean ${(skateSum / Math.max(1, skateN) * 1000).toFixed(3)} mm/frame; IK max err ${(ikMax * 1000).toFixed(1)} mm`);
if (process.argv.includes('--trace')) {
  const leg = (process.argv[process.argv.indexOf('--trace') + 1] || 'LF') as (typeof LEG_IDS)[number];
  for (let i = 0; i < 90; i++) {
    stepSim(W(0, Number(process.env.WISH ?? 0.38)));
    const L = loco.legs[leg];
    const head = L.rig.foot.getWorldPosition(new THREE.Vector3());
    const hip = L.rig.chain[0].getWorldPosition(new THREE.Vector3());
    if (i > 50) console.log(i, L.mode, 'foot', L.foot.toArray().map((v) => v.toFixed(3)).join(','), 'head', head.toArray().map((v) => v.toFixed(3)).join(','), 'hipD', hip.distanceTo(L.foot).toFixed(3), '/', L.rig.reach.toFixed(3), 'liftF', loco.state.liftF.toFixed(3), 'pos', group.position.z.toFixed(3));
  }
}
if (process.argv.includes('--switchback')) {
  // autopilot-style steering through 3 m switchbacks (route waypoints 70–79 shape); must hit each within 0.9 u
  group.position.set(0, 0, 0); y = 0; vel.set(0, 0, 0);
  const pts = [[6.6, 0], [-6.4, 0], [-6.4, -2.8], [6.4, -2.8], [6.4, -5.8], [1.8, -5.8], [-2.1, -5.8], [-6.4, -5.8], [-6.4, -8.8]];
  let idx = 0; let frames = 0;
  while (idx < pts.length && frames < 60 * 40) {
    const [tx, tz] = pts[idx];
    const dx = tx - group.position.x, dz = tz - group.position.z, d = Math.hypot(dx, dz);
    if (d < 0.9) { idx++; continue; }
    stepSim(W(dx / d, dz / d)); frames++;
  }
  console.log(`switchback: reached ${idx}/${pts.length} in ${(frames / 60).toFixed(1)} s`);
}
if (process.argv.includes('--airtrace')) {
  for (let i = 0; i < 50; i++) {
    stepSim(W(0, 0.45), i === 5);
    const L = loco.legs.LF;
    const sh = L.rig.chain[0].getWorldPosition(new THREE.Vector3());
    console.log(i, L.mode, 'tgt rel y', (L.foot.y - sh.y).toFixed(2), 'tgt dist', L.foot.distanceTo(sh).toFixed(2), 'minR', L.rig.minReach.toFixed(2), 'err', (L.err * 1000).toFixed(0), 'wrist rel shoulder y', (L.solved.y - sh.y).toFixed(2), 'z', (L.solved.x - sh.x).toFixed(2));
  }
}
