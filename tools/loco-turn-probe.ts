/** CPU carved-turn probe: stance slide, residual, re-steps and measured bank. No browser; GPU capture still decides.
 * npx tsx tools/loco-turn-probe.ts [repoRoot] [json-params-override]
 */
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const repo = path.resolve(process.argv[2] ?? '.');
const override = JSON.parse(process.argv[3] ?? '{}');
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
Object.assign(loco.params, override);
const step = (speed: number, yaw: number, anim: string) => {
  loco.input = { speed, grounded: true, yaw, verticalSpeed: 0, groundAt: () => 0 };
  loco.beforeMixer(); loco.blend(1 / 60, anim); mixer.update(1 / 60); loco.afterMixer(1 / 60, anim); root.updateMatrixWorld(true);
};
const rows: Record<string, unknown>[] = [];
const pct = (a: number[], p: number) => a.length ? [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] : 0;
for (const [speed, rate] of [[2.9, 2.5], [3.4, 3.2], [4.05, 2.5], [9, 1.2], [1.62, 2.5]]) {
  loco.reset(); group.position.set(0, 0, 0); group.rotation.y = 0;
  let yaw = 0; const slide: number[] = [], res: number[] = []; let residual = 0, shift = 0, bank = 0, chest = 0; const steps0 = loco.metrics.earlySteps;
  for (let i = 0; i < 600; i++) {
    yaw += rate / 60; group.rotation.y = yaw;
    group.position.x += Math.sin(yaw) * speed / 60; group.position.z += Math.cos(yaw) * speed / 60; group.updateMatrixWorld(true);
    step(speed, yaw, 'run');
    if (i > 200) {
      slide.push(loco.metrics.maxSlideMS); res.push(loco.metrics.maxResidual); residual = Math.max(residual, loco.metrics.maxResidual); shift = Math.max(shift, loco.metrics.maxTouchdownShift);
      bank = Math.max(bank, Math.abs(loco.metrics.pelvisBankAngle)); chest = Math.max(chest, Math.abs(loco.metrics.chestBankAngle));
    }
  }
  rows.push({ speed, rate, slideP95: +pct(slide, .95).toFixed(2), slideMax: +Math.max(...slide).toFixed(2), residualMm: +(residual * 1000).toFixed(1), residualP95Mm: +(pct(res, .95) * 1000).toFixed(1),
    reSteps: loco.metrics.earlySteps - steps0, touchdownShiftMm: +(shift * 1000).toFixed(1), pelvisBankDeg: +(bank * 57.3).toFixed(1), chestBankDeg: +(chest * 57.3).toFixed(1) });
}
console.table(rows);
