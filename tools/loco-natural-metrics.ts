/** Pure CPU gait probe for the natural-gait pass: joint fold, paw lift, plant slide, body/head bob, landing drop.
 * Numbers only; visual acceptance still requires GPU playback. Run: npx tsx tools/loco-natural-metrics.ts */
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AuthoredLocomotion } from '../games/fox-spirit/src/locomotion';
Object.assign(globalThis, { self: globalThis, ProgressEvent: class extends Event { constructor(type: string, init: Record<string, unknown>) { super(type); Object.assign(this, init); } } });
const bytes = fs.readFileSync('assets/hero/spirit_fox.glb');
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
const actions = new Map(gltf.animations.map(c => [c.name, mixer.clipAction(c)]));
for (const [name, act] of actions) if (/^(jump_up|jump_fall|land|burst|skid)$/.test(name)) { act.setLoop(THREE.LoopOnce, 1); act.clampWhenFinished = true; }
const loco = new AuthoredLocomotion(root, group, actions);
let current = '';
const play = (name: string) => { if (current === name) return; actions.get(name)?.reset().play(); current = name; };
const step = (speed: number, anim: string, extra: Partial<typeof loco.input> = {}) => {
  play(anim);
  loco.input = { speed, grounded: true, yaw: group.rotation.y, verticalSpeed: 0, groundAt: () => 0, ...extra };
  loco.beforeMixer(); loco.blend(1 / 60, anim); mixer.update(1 / 60); loco.afterMixer(1 / 60, anim); root.updateMatrixWorld(true);
};
const bone = (n: string) => root.getObjectByName(n)!;
const w = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
const angle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => a.clone().sub(b).angleTo(c.clone().sub(b)) * 180 / Math.PI;
const legs = [['upperarm_l', 'forearm_l', 'front_paw_l'], ['upperarm_r', 'forearm_r', 'front_paw_r'], ['thigh_l', 'shin_l', 'hind_foot_l', 'hind_paw_l'], ['thigh_r', 'shin_r', 'hind_foot_r', 'hind_paw_r']];
const pawTip = (n: string) => { const p = bone(n); const tip = p.children.find(c => (c as THREE.Bone).isBone); return tip ? w(tip) : p.localToWorld(new THREE.Vector3(0, .05, 0)); };
const legLength = (l: string[]) => { let s = 0; for (let i = 0; i + 1 < l.length; i++) s += w(bone(l[i])).distanceTo(w(bone(l[i + 1]))); return s; };
loco.reset(); for (let i = 0; i < 60; i++) step(0, 'idle');
const rest = legs.map(l => w(bone(l[l.length - 1])).y);
const restChest = w(bone('spine_04')).y;
const lens = legs.map(legLength);
const range = (a: number[]) => Math.max(...a) - Math.min(...a);
const out: Record<string, unknown> = { legLength: lens.map(x => +x.toFixed(3)), restChestY: +restChest.toFixed(3) };
for (const [gait, speed] of [['walk', 1.5], ['trot', 3.8], ['run', 9]] as const) {
  loco.reset(); group.position.set(0, 0, 0); group.rotation.y = 0;
  const elbow: number[] = [], carpal: number[] = [], stifle: number[] = [], hock: number[] = [], lift = legs.map(() => 0), pelvis: number[] = [], chest: number[] = [], head: number[] = [], flex: number[] = [], hz: number[] = [];
  let slide = 0;
  for (let i = 0; i < 480; i++) {
    group.position.z += speed / 60; group.updateMatrixWorld(true);
    step(speed, 'run');
    if (i < 180) continue;
    slide = Math.max(slide, loco.metrics.maxSlideMS); hz.push(loco.metrics.cadenceHz);
    const L = (n: string) => w(bone(n));
    elbow.push(angle(L('upperarm_l'), L('forearm_l'), L('front_paw_l')));
    carpal.push(angle(L('forearm_l'), L('front_paw_l'), pawTip('front_paw_l')));
    stifle.push(angle(L('thigh_l'), L('shin_l'), L('hind_foot_l')));
    hock.push(angle(L('shin_l'), L('hind_foot_l'), L('hind_paw_l')));
    legs.forEach((l, j) => { lift[j] = Math.max(lift[j], w(bone(l[l.length - 1])).y - rest[j]); });
    pelvis.push(L('pelvis').y); chest.push(L('spine_04').y); head.push(L('head').y);
    const a = L('pelvis'), b = L('spine_02'), c = L('spine_04');
    flex.push(angle(a, b, c));
  }
  const r = (a: number[]) => [+Math.min(...a).toFixed(0), +Math.max(...a).toFixed(0)];
  out[gait] = { cadenceHz: +(hz.reduce((x, y) => x + y, 0) / hz.length).toFixed(2), maxSlideMS: +slide.toFixed(3),
    elbowDeg: r(elbow), carpalDeg: r(carpal), stifleDeg: r(stifle), hockDeg: r(hock),
    pawLiftOverLeg: lift.map((x, j) => +(x / lens[j]).toFixed(2)), pelvisBobCm: +(range(pelvis) * 100).toFixed(1), chestBobCm: +(range(chest) * 100).toFixed(1),
    headBobCm: +(range(head) * 100).toFixed(1), meanChestY: +(chest.reduce((x, y) => x + y, 0) / chest.length).toFixed(3), spineFlexDeg: r(flex) };
}
// Landing: drop from a 1.8 m jump onto flat ground at -8 m/s.
{
  loco.reset(); group.position.set(0, 0, 0);
  for (let i = 0; i < 30; i++) step(0, 'idle');
  for (let i = 0; i < 20; i++) step(0, 'jump_fall', { grounded: false, verticalSpeed: -8 });
  const chest: number[] = [];
  for (let i = 0; i < 40; i++) { step(0, i < 18 ? 'land' : 'idle'); chest.push(w(bone('spine_04')).y); }
  const low = Math.min(...chest), at = chest.indexOf(low);
  out.landing = { chestDropOverRest: +((restChest - low) / restChest).toFixed(3), framesToBottom: at, framesBelowHalf: chest.filter(y => restChest - y > (restChest - low) / 2).length };
}
console.log(JSON.stringify(out, null, 1));
