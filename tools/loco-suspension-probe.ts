/** CPU gallop suspension probe: per-phase support count, body lift and stance residual. npx tsx tools/loco-suspension-probe.ts [lift] */
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
const { AuthoredLocomotion } = await import(path.resolve('games/fox-spirit/src/locomotion.ts'));
Object.assign(globalThis, { self: globalThis, ProgressEvent: class extends Event { constructor(type: string, init: Record<string, unknown>) { super(type); Object.assign(this, init); } } });
const bytes = fs.readFileSync('assets/hero/spirit_fox.glb'); const jl = bytes.readUInt32LE(12);
const doc = JSON.parse(bytes.subarray(20, 20 + jl).toString());
doc.buffers[0].uri = `data:application/octet-stream;base64,${bytes.subarray(28 + jl).toString('base64')}`;
delete doc.images; delete doc.textures; delete doc.samplers; delete doc.materials;
for (const mesh of doc.meshes) for (const primitive of mesh.primitives) delete primitive.material;
const gltf = await new GLTFLoader().parseAsync(JSON.stringify(doc), '');
const root = gltf.scene, group = new THREE.Group(); group.add(root);
const box = new THREE.Box3().setFromObject(root); root.scale.setScalar(1.25 / (box.max.y - box.min.y));
const sc = new THREE.Box3().setFromObject(root); root.position.y -= sc.min.y;
const mixer = new THREE.AnimationMixer(root);
const loco = new AuthoredLocomotion(root, group, new Map(gltf.animations.map(c => [c.name, mixer.clipAction(c)])));
loco.params.suspensionLift = Number(process.argv[2] ?? loco.params.suspensionLift);
const pelvis = root.getObjectByName('pelvis')!;
for (const speed of [6.5, 9]) {
  loco.reset(); let res = 0, slide = 0; const bins = Array.from({ length: 20 }, () => ({ feet: 9, lift: 0, pelvis: 0, n: 0 }));
  for (let i = 0; i < 600; i++) {
    group.position.z += speed / 60; group.updateMatrixWorld(true);
    loco.input = { speed, grounded: true, yaw: 0, verticalSpeed: 0, groundAt: () => 0 };
    loco.beforeMixer(); loco.blend(1 / 60, 'run'); mixer.update(1 / 60); loco.afterMixer(1 / 60, 'run'); root.updateMatrixWorld(true);
    if (i > 200) {
      res = Math.max(res, loco.metrics.maxResidual); slide = Math.max(slide, loco.metrics.maxSlideMS);
      const b = bins[Math.floor(loco.metrics.phase * 20)]; b.feet = Math.min(b.feet, loco.metrics.stanceFeet); b.lift = Math.max(b.lift, loco.metrics.suspension); b.pelvis += pelvis.getWorldPosition(new THREE.Vector3()).y; b.n++;
    }
  }
  console.log(`speed ${speed} lift ${loco.params.suspensionLift} residualMm ${(res * 1000).toFixed(1)} slideMax ${slide.toFixed(2)} stanceRatio ${loco.metrics.stanceRatio.toFixed(2)}`);
  console.log(' feet ', bins.map(b => b.feet).join(' '));
  console.log(' liftCm', bins.map(b => (b.lift * 100).toFixed(0)).join(' '));
  console.log(' pelvisCm', bins.map(b => (b.pelvis / Math.max(1, b.n) * 100).toFixed(0)).join(' '));
}
