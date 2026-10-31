/** CPU metrics for the clip-driven locomotion (DESIGN-loco-clips.md). Visual acceptance still needs a GPU capture. */
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AuthoredLocomotion } from '../games/fox-spirit/src/locomotion';
import { applyFoxLimbRig } from '../games/fox-spirit/src/foxLimbRig';
Object.assign(globalThis, { self: globalThis, ProgressEvent: class extends Event { constructor(type: string, init: Record<string, unknown>) { super(type); Object.assign(this, init); } } });
const bytes = fs.readFileSync('assets/hero/spirit_fox.glb');
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
const dt = 1 / 60;
const slopeArg = Number(process.argv[2] ?? 0);
for (const speed of [.5, .9, 1.5, 2.4, 3.5, 5, 7, 9]) {
  loco.reset(); group.position.set(0, 0, 0);
  let slide = 0, gap = 0, residual = 0, stance = 0, n = 0, rate = 0, drop = 0, plant = 0;
  const groundAt = (_x: number, z: number) => z * slopeArg;
  for (let i = 0; i < 300; i++) {
    group.position.z += speed * dt; group.position.y = groundAt(0, group.position.z); group.updateMatrixWorld(true);
    loco.input = { speed, grounded: true, yaw: 0, verticalSpeed: 0, groundAt };
    loco.beforeMixer(); loco.blend(dt, 'run'); mixer.update(dt); loco.afterMixer(dt, 'run');
    if (i < 120) continue;
    const m = loco.metrics; n++;
    slide = Math.max(slide, m.maxSlideMS); residual = Math.max(residual, m.maxResidual); stance += m.stanceFeet; rate = m.playback;
    gap = Math.max(gap, ...m.footGap.map(Math.abs)); drop = Math.min(drop, m.pelvisOffset); plant = Math.max(plant, m.maxPlantError);
  }
  const m = loco.metrics;
  console.log(`speed ${speed.toFixed(1)} gait ${m.gait.padEnd(4)} hz ${m.cadenceHz.toFixed(2)} rate ${rate.toFixed(2)} stance ${(stance / n).toFixed(2)} slideMax ${slide.toFixed(2)} m/s lockErrMax ${(plant * 100).toFixed(1)} cm gapMax ${(gap * 100).toFixed(1)} cm residual ${(residual * 100).toFixed(1)} cm pelvis ${(drop * 100).toFixed(1)} cm spineFlex ${m.spineFlexDeg.toFixed(1)}° w ${JSON.stringify(Object.fromEntries(Object.entries(m.clipWeights).filter(([, w]) => w > .01).map(([k, w]) => [k, +w.toFixed(2)])))}`);
}
