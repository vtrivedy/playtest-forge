/** CPU locomotion metrics for glide review (no browser). Visual acceptance still needs GPU capture.
 * npx tsx tools/loco-glide-metrics.ts [repoRoot]   — repoRoot defaults to cwd; point it at a main worktree to compare.
 * Per band (walk 1.62 / trot 4.05 / gallop 9 m/s, straight and 2.5 rad/s turn):
 *  cadence Hz; plant residual; per-footfall near-ground speed = median over contacts of the max paw-bone speed while
 *  within 3 cm of its idle height (pooled near-ground p95 is skewed by duty factor); head bob; pelvis->withers pitch swing.
 */
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const repo = path.resolve(process.argv[2] ?? '.');
const { AuthoredLocomotion } = await import(path.join(repo, 'games/fox-spirit/src/locomotion.ts'));
Object.assign(globalThis, { self: globalThis, ProgressEvent: class extends Event { constructor(type: string, init: Record<string, unknown>) { super(type); Object.assign(this, init); } } });
const bytes = fs.readFileSync(path.join(repo, 'assets/hero/spirit_fox.glb'));
const jsonLength = bytes.readUInt32LE(12);
const doc = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
doc.buffers[0].uri = `data:application/octet-stream;base64,${bytes.subarray(28 + jsonLength).toString('base64')}`;
delete doc.images; delete doc.textures; delete doc.samplers; delete doc.materials;
for (const mesh of doc.meshes) for (const primitive of mesh.primitives) delete primitive.material;
const gltf = await new GLTFLoader().parseAsync(JSON.stringify(doc), '');
const root = gltf.scene, group = new THREE.Group(); group.add(root);
const box = new THREE.Box3().setFromObject(root); root.scale.setScalar(1.25 / (box.max.y - box.min.y));
const scaled = new THREE.Box3().setFromObject(root); root.position.y -= scaled.min.y;
const center = scaled.getCenter(new THREE.Vector3()); root.position.x -= center.x; root.position.z -= center.z;
const mixer = new THREE.AnimationMixer(root);
const loco = new AuthoredLocomotion(root, group, new Map(gltf.animations.map(c => [c.name, mixer.clipAction(c)])));
const step = (speed: number, yaw: number, anim: string) => {
  loco.input = { speed, grounded: true, yaw, verticalSpeed: 0, groundAt: () => 0 };
  loco.beforeMixer(); loco.blend(1 / 60, anim); mixer.update(1 / 60); loco.afterMixer(1 / 60, anim); root.updateMatrixWorld(true);
};
const bone = (n: string) => root.getObjectByName(n)!;
const paws = ['front_paw_l', 'front_paw_r', 'hind_paw_l', 'hind_paw_r'].map(bone);
const w = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
loco.reset(); for (let i = 0; i < 30; i++) step(0, 0, 'idle');
const rest = paws.map(p => w(p).y);
const median = (a: number[]) => a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0;
const rows: Record<string, unknown>[] = [];
const speeds = (process.env.SPEEDS ?? "1.62,4.05,9").split(",").map(Number), rates = (process.env.RATES ?? "0,2.5").split(",").map(Number);
for (const rate of rates) for (const speed of speeds) {
  loco.reset(); group.position.set(0, 0, 0); group.rotation.y = 0;
  let yaw = 0, residual = 0, lastPhase = 0; const hz: number[] = [], events: number[] = [], heads: number[] = [], pitches: number[] = [];
  const prev = paws.map(() => new THREE.Vector3()), contact = paws.map(() => ({ on: false, max: 0 }));
  for (let i = 0; i < 600; i++) {
    yaw += rate / 60; group.rotation.y = yaw;
    group.position.x += Math.sin(yaw) * speed / 60; group.position.z += Math.cos(yaw) * speed / 60; group.updateMatrixWorld(true);
    step(speed, yaw, 'run');
    paws.forEach((p, j) => {
      const pos = w(p), c = contact[j];
      if (i > 200) {
        if (pos.y < rest[j] + .03) { c.max = Math.max(c.on ? c.max : 0, Math.hypot(pos.x - prev[j].x, pos.z - prev[j].z) * 60); c.on = true; }
        else if (c.on) { c.on = false; events.push(c.max); }
      }
      prev[j].copy(pos);
    });
    if (i > 200) {
      residual = Math.max(residual, loco.metrics.maxResidual);
      hz.push(((loco.metrics.phase - lastPhase + 1) % 1) * 60);
      heads.push(w(bone('head')).y);
      const a = w(bone('pelvis')), b = w(bone('spine_04'));
      pitches.push(Math.atan2(b.y - a.y, Math.hypot(b.x - a.x, b.z - a.z)));
    }
    lastPhase = loco.metrics.phase;
  }
  const range = (a: number[]) => Math.max(...a) - Math.min(...a);
  rows.push({ turn: rate, speed, cadenceHz: +median(hz).toFixed(2), plantResidual: +residual.toFixed(3),
    footfallNearGroundMS: +median(events).toFixed(2), headBobCm: +(range(heads) * 100).toFixed(1), torsoPitchDeg: +(range(pitches) * 180 / Math.PI).toFixed(1) });
}
console.table(rows);
// Gait handoffs: critically damped speed steps 3.8 <-> 9 m/s (the controller's groundEase shape).
{
  loco.reset(); group.position.set(0, 0, 0); group.rotation.y = 0;
  let v = 3.8, a = 0, slide = 0, residual = 0, pops = 0;
  const replantsBefore = loco.metrics.earlySteps;
  for (let i = 0; i < 360; i++) {
    const t = i / 60, target = t < 1 ? 3.8 : t < 3 ? 9 : t < 4.5 ? 3.8 : 9;
    for (let k = 0; k < 2; k++) { a += (121 * (target - v) - 22 * a) / 120; v += a / 120; }
    group.position.z += v / 60; group.updateMatrixWorld(true); step(v, 0, 'run');
    if (i > 60) { slide = Math.max(slide, loco.metrics.maxSlideMS); residual = Math.max(residual, loco.metrics.maxResidual); if (loco.metrics.maxSlideMS > 2) pops++; }
  }
  console.table([{ scenario: 'handoff 3.8<->9', maxPlantSlideMS: +slide.toFixed(2), plantResidual: +residual.toFixed(3), framesSlide2ms: pops, replants: loco.metrics.earlySteps - replantsBefore }]);
}
