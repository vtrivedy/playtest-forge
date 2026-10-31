/** CPU scenario metrics for the loco flow pass (DESIGN-loco-flow.md). Visual acceptance still needs a GPU capture.
 *
 *   npx tsx tools/loco-flow-metrics.ts [--glb assets/hero/spirit_fox.glb] [--loco games/fox-spirit/src/locomotion.ts]
 *
 * Scenarios mirror main.ts's state picker: running jump → land → gallop, standing jump, walk → stop, gallop turn.
 * Pad pops are measured from the paw bones directly (actor-space second difference per 60 Hz frame), so the same
 * script also measures an older locomotion.ts / GLB for A/B (`git show f973fd3:... > /tmp/x.ts`, pass --loco/--glb). */
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { applyFoxLimbRig } from '../games/fox-spirit/src/foxLimbRig';
Object.assign(globalThis, { self: globalThis, ProgressEvent: class extends Event { constructor(type: string, init: Record<string, unknown>) { super(type); Object.assign(this, init); } } });
const arg = (k: string, d: string) => process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d;
const { AuthoredLocomotion } = await import(path.resolve(arg('--loco', 'games/fox-spirit/src/locomotion.ts')));

const bytes = fs.readFileSync(arg('--glb', 'assets/hero/spirit_fox.glb'));
const jsonLength = bytes.readUInt32LE(12);
const doc = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
doc.buffers[0].uri = `data:application/octet-stream;base64,${bytes.subarray(28 + jsonLength).toString('base64')}`;
delete doc.images; delete doc.textures; delete doc.samplers; delete doc.materials;
for (const mesh of doc.meshes) for (const primitive of mesh.primitives) delete primitive.material;
const gltf = await new GLTFLoader().parseAsync(JSON.stringify(doc), '');
const root = gltf.scene; const group = new THREE.Group(); group.add(root);
const box = new THREE.Box3().setFromObject(root); root.scale.setScalar(1.25 / (box.max.y - box.min.y));
const scaled = new THREE.Box3().setFromObject(root); root.position.y -= scaled.min.y;
const center = scaled.getCenter(new THREE.Vector3()); root.position.x -= center.x; root.position.z -= center.z;
applyFoxLimbRig(root, gltf.animations);
const mixer = new THREE.AnimationMixer(root);
const actions = new Map(gltf.animations.map((c) => { const a = mixer.clipAction(c); const once = /^(jump_up|jump_fall|land|burst|skid)$/.test(c.name); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity); a.clampWhenFinished = once; return [c.name, a]; }));
const loco = new AuthoredLocomotion(root, group, actions);
const paws = ['front_paw_l', 'front_paw_r', 'hind_paw_l', 'hind_paw_r'].map((n) => root.getObjectByName(n)!);
const dt = 1 / 60;
let current = '';
const setAnim = (name: string, fade: number) => {
  if (current === name) return;
  actions.get(name)!.reset().setEffectiveTimeScale(1).play();
  loco.fadeSeconds = fade; current = name;
};

type Frame = { speed: number; yawRate?: number; vy?: number; y?: number; grounded?: boolean; anim: string; fade: number };
function run(name: string, frames: Frame[], report: (stats: Record<string, number>) => void = () => {}) {
  loco.reset(); group.position.set(0, 0, 0); group.rotation.set(0, 0, 0); current = ''; setAnim('idle', 0);
  const hist: THREE.Vector3[][] = paws.map(() => []);
  let lastKey = '', since = 99;
  const trace: string[] = [];
  const s = { padPopCm: 0, popAt: 0, padStepCm: 0, inertiaDeg: 0, tailMaxDeg: -90, tailMinDeg: 90, gatherMin: 0, gatherMax: 0, flexMin: 180, flexMax: -180, bendMax: 0, bankMax: 0, giveMax: 0, slideMax: 0, holdMax: 0, gapMax: 0 };
  frames.forEach((f, i) => {
    group.rotation.y += (f.yawRate ?? 0) * dt;
    group.position.addScaledVector(new THREE.Vector3(Math.sin(group.rotation.y), 0, Math.cos(group.rotation.y)), f.speed * dt);
    group.position.y = f.y ?? 0; group.updateMatrixWorld(true);
    setAnim(f.anim, f.fade);
    loco.input = { speed: f.speed, grounded: f.grounded ?? true, yaw: group.rotation.y, verticalSpeed: f.vy ?? 0, groundAt: () => 0, lookYaw: group.rotation.y + (f.yawRate ?? 0) * .3 };
    loco.beforeMixer(); loco.blend(dt, current); mixer.update(dt); loco.afterMixer(dt, current);
    root.updateMatrixWorld(true);
    const key = `${current}:${loco.metrics.gait}`;
    since = key === lastKey ? since + 1 : 0; lastKey = key;
    paws.forEach((p, k) => {
      const h = hist[k]; h.push(group.worldToLocal(p.getWorldPosition(new THREE.Vector3()))); if (h.length > 3) h.shift();
      // Only frames within 0.25 s of a state / gait change count: steady gallop swing has large accelerations of its own.
      if (h.length === 3 && i > 5 && since < 15) {
        const jerk = h[2].clone().sub(h[1]).sub(h[1].clone().sub(h[0])).length() * 100;
        if (jerk > s.padPopCm) { s.padPopCm = jerk; s.popAt = i * dt; }
        s.padStepCm = Math.max(s.padStepCm, h[2].distanceTo(h[1]) * 100);
      }
      if (process.env.TRACE === name && k === 2 && h.length > 1) trace.push(`${(i * dt).toFixed(2)} ${current.padEnd(9)} ${loco.metrics.gait.padEnd(9)} hindL step ${(h[h.length - 1].distanceTo(h[h.length - 2]) * 100).toFixed(1)}cm y ${(h[h.length - 1].y * 100).toFixed(0)} z ${(h[h.length - 1].z * 100).toFixed(0)}`);
    });
    const m = loco.metrics;
    s.inertiaDeg = Math.max(s.inertiaDeg, m.inertiaDeg ?? 0);
    if (m.tailPitchDeg !== undefined) { s.tailMaxDeg = Math.max(s.tailMaxDeg, m.tailPitchDeg); s.tailMinDeg = Math.min(s.tailMinDeg, m.tailPitchDeg); }
    s.gatherMin = Math.min(s.gatherMin, m.spineGatherDeg ?? 0); s.gatherMax = Math.max(s.gatherMax, m.spineGatherDeg ?? 0);
    if (i > 30) { s.flexMin = Math.min(s.flexMin, m.spineFlexDeg); s.flexMax = Math.max(s.flexMax, m.spineFlexDeg); }
    s.bendMax = Math.max(s.bendMax, Math.abs(m.spineBendDeg ?? 0)); s.bankMax = Math.max(s.bankMax, Math.abs(m.bank));
    s.giveMax = Math.max(s.giveMax, m.carpalGiveDeg ?? 0); s.slideMax = Math.max(s.slideMax, i > 30 ? m.maxSlideMS : 0);
    s.holdMax = Math.max(s.holdMax, m.stopHold ?? 0); s.gapMax = Math.max(s.gapMax, ...m.footGap.map(Math.abs));
  });
  report(s);
  if (trace.length) console.log(trace.join('\n'));
  console.log(`${name.padEnd(14)} ${Object.entries(s).map(([k, x]) => `${k} ${x.toFixed(k === 'popAt' ? 2 : 1)}`).join('  ')}`);
}

/** Running (or standing) jump: windup on the ground, ballistic arc, land clip briefly, then the gait (main.ts picker). */
function jump(speed: number) {
  const frames: Frame[] = [];
  for (let i = 0; i < 60; i++) frames.push({ speed, anim: speed > .08 ? 'run' : 'idle', fade: .16 });
  const windup = speed > 3 ? .1 : .15;
  for (let t = 0; t < windup; t += dt) frames.push({ speed, anim: 'jump_up', fade: speed > 3 ? .04 : .12 });
  let y = 0, vy = 8.2;
  while (y >= 0) {
    vy -= (vy > 0 ? 22 : 30) * dt; y += vy * dt;
    frames.push({ speed, y: Math.max(0, y), vy, grounded: false, anim: vy > 2.2 ? 'jump_up' : vy > -1.6 ? 'jump_apex' : 'jump_fall', fade: .1 });
  }
  const landT = speed > 1.5 ? .083 : .3;
  for (let t = 0; t < landT; t += dt) frames.push({ speed, anim: 'land', fade: .05 });
  for (let i = 0; i < 60; i++) frames.push({ speed, anim: speed > .08 ? 'run' : 'idle', fade: .16 });
  return frames;
}
run('jump run 7', jump(7));
run('jump trot 2.4', jump(2.4));
run('jump stand', jump(0));
// Walk then release the stick: ground speed decays (groundAccel 5.5) to a stop.
const stop: Frame[] = [];
for (let i = 0; i < 90; i++) stop.push({ speed: .9, anim: 'run', fade: .16 });
let sp = .9;
for (let i = 0; i < 60; i++) { sp *= Math.exp(-5.5 * dt); stop.push({ speed: sp, anim: sp > .08 ? 'run' : 'idle', fade: .16 }); }
for (let i = 0; i < 30; i++) stop.push({ speed: 0, anim: 'idle', fade: .16 });
run('walk stop', stop);
// Start from idle into walk.
const start: Frame[] = [];
for (let i = 0; i < 30; i++) start.push({ speed: 0, anim: 'idle', fade: .16 });
sp = 0;
for (let i = 0; i < 90; i++) { sp += (.9 - sp) * (1 - Math.exp(-5.5 * dt)); start.push({ speed: sp, anim: sp > .08 ? 'run' : 'idle', fade: .16 }); }
run('walk start', start);
// Gallop with a sustained left turn then straight.
const turn: Frame[] = [];
for (let i = 0; i < 150; i++) turn.push({ speed: 6, yawRate: i > 30 && i < 100 ? 2.2 : 0, anim: 'run', fade: .16 });
run('gallop turn', turn);
const gallop: Frame[] = [];
for (let i = 0; i < 150; i++) gallop.push({ speed: 6, anim: 'run', fade: .16 });
run('gallop 6', gallop);
// Gait changes up and down the blend tree.
const ramp: Frame[] = [];
for (let i = 0; i < 300; i++) ramp.push({ speed: i < 150 ? .5 + i * .05 : 8 - (i - 150) * .05, anim: 'run', fade: .16 });
run('gait ramp', ramp);
