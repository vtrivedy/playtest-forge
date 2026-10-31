/** CPU animation/IK diagnostic on prescribed flat-ground paths; no renderer or physics controller.
 * npx tsx tools/loco-spine-mean-probe.ts [--invariants | --flight]
 * Default: 312 gait/transition/turn cases. Visual acceptance still requires GPU playback.
 */
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AuthoredLocomotion } from '../games/fox-spirit/src/locomotion';
import { applyFoxLimbRig } from '../games/fox-spirit/src/foxLimbRig';
Object.assign(globalThis, { self: globalThis, ProgressEvent: class extends Event {
        constructor(type: string, init: Record<string, unknown>) { super(type); Object.assign(this, init); }
    } });
const bytes = fs.readFileSync('assets/hero/spirit_fox.glb');
const jsonLength = bytes.readUInt32LE(12);
const doc = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
const bin = bytes.subarray(28 + jsonLength);
doc.buffers[0].uri = `data:application/octet-stream;base64,${bin.toString('base64')}`;
delete doc.images;
delete doc.textures;
delete doc.samplers;
delete doc.materials;
for (const mesh of doc.meshes)
    for (const primitive of mesh.primitives)
        delete primitive.material;
const asset = JSON.stringify(doc);
const make = async (spineFlex: number) => {
    const gltf = await new GLTFLoader().parseAsync(asset, '');
    const root = gltf.scene, group = new THREE.Group();
    group.add(root);
    const box = new THREE.Box3().setFromObject(root);
    root.scale.setScalar(1.25 / (box.max.y - box.min.y));
    const scaled = new THREE.Box3().setFromObject(root);
    root.position.y -= scaled.min.y;
    const center = scaled.getCenter(new THREE.Vector3());
    root.position.x -= center.x;
    root.position.z -= center.z;
    const mixer = new THREE.AnimationMixer(root);
    const actions = new Map(gltf.animations.map(c => [c.name, mixer.clipAction(c)]));
    applyFoxLimbRig(root, gltf.animations);
    const loco = new AuthoredLocomotion(root, group, actions);
    loco.params.spineFlex = spineFlex;
    return { root, group, mixer, loco };
};
if (process.argv.includes('--flight')) {
    for (const hz of [30, 60, 120])
        for (const seed of [0, .25, .5, .75])
            for (const speed of [6.5, 9]) {
                const { root, group, mixer, loco } = await make(.6);
                group.position.set(0, .02, 0);
                loco.reset();
                Object.assign(loco, { phase: seed, weights: new Map([['idle', 1]]), lastActive: '' });
                let frames = 0, noSupport = 0, authoredFlight = 0, run = 0, longest = 0;
                const bins = Array.from({ length: 24 }, () => ({ frames: 0, noSupport: 0, minFeet: 4, maxFeet: 0 }));
                for (let i = 0; i < 8 * hz; i++) {
                    group.position.z += speed / hz;
                    group.updateMatrixWorld(true);
                    loco.input = { speed, grounded: true, yaw: 0, verticalSpeed: 0, groundAt: () => 0 };
                    loco.beforeMixer();
                    loco.blend(1 / hz, 'run');
                    mixer.update(1 / hz);
                    loco.afterMixer(1 / hz, 'run');
                    if (i < 2 * hz)
                        continue;
                    frames++;
                    const b = bins[Math.min(23, Math.floor(loco.metrics.phase * 24))];
                    b.frames++;
                    b.minFeet = Math.min(b.minFeet, loco.metrics.stanceFeet);
                    b.maxFeet = Math.max(b.maxFeet, loco.metrics.stanceFeet);
                    if (loco.metrics.authoredFlight)
                        authoredFlight++;
                    if (loco.metrics.stanceFeet === 0) {
                        noSupport++;
                        b.noSupport++;
                        run++;
                        longest = Math.max(longest, run);
                    }
                    else
                        run = 0;
                }
                console.log(JSON.stringify({ speed, hz, seed, frames, noSupport, authoredFlight, zeroSupportFraction: noSupport / frames, longestZeroSupportSeconds: longest / hz, earlyTouches: loco.metrics.earlyTouches, bins }));
            }
}
else if (process.argv.includes('--invariants')) {
    const cases = [];
    let maxAngle = 0;
    for (const gait of ['walk', 'trot', 'run'])
        for (const weight of [.25, .5, 1]) {
            const { loco } = await make(0), raw = loco as any;
            loco.params.spineFlex = 0;
            raw.weights = new Map([[gait, weight], ['idle', 1 - weight]]);
            const expected = raw.flexBones.map((bone: THREE.Object3D, i: number) => bone.quaternion.clone().slerp(raw.parts.get(gait).flexMean[i], weight));
            raw.glideLayer();
            const angles = raw.flexBones.map((bone: THREE.Object3D, i: number) => bone.quaternion.angleTo(expected[i]));
            maxAngle = Math.max(maxAngle, ...angles);
            cases.push({ gait, weight, angles });
        }
    console.log(JSON.stringify({ label: 'Single-gait cycle mean with total-weight scaling; expected source quaternion, no identity term', maxAngle, passed: maxAngle < 1e-6, cases }, null, 2));
    if (maxAngle >= 1e-6)
        process.exitCode = 1;
}
else {
    const pct = (a: number[], p: number) => { const sorted = [...a].sort((a, b) => a - b); return sorted[Math.floor((sorted.length - 1) * p)]; };
    const stats = (a: number[]) => ({ min: Math.min(...a), max: Math.max(...a), p95: pct(a, .95), range: Math.max(...a) - Math.min(...a) });
    const smooth = (x: number) => THREE.MathUtils.smoothstep(x, 0, 1);
    const schedules = { trot: (t: number) => ({ speed: 4.05, turn: 0 }), run: (t: number) => ({ speed: 9, turn: 0 }), gallopBlend: (t: number) => ({ speed: 6.5 + .6 * Math.sin(t * Math.PI / 3), turn: 0 }), trotLeft: (t: number) => ({ speed: 4.05, turn: 1.2 }), trotRight: (t: number) => ({ speed: 4.05, turn: -1.2 }), runLeft: (t: number) => ({ speed: 9, turn: 1.2 }), runRight: (t: number) => ({ speed: 9, turn: -1.2 }), steady: (t: number) => ({ speed: 1.62, turn: 0 }), startstop: (t: number) => ({ speed: 1.62 * smooth((t - 1) / .4) * (1 - smooth((t - 4.5) / .4)), turn: 0 }), ramp: (t: number) => ({ speed: 3.8 * smooth((t - .5) / 3) * (1 - smooth((t - 6.5) / 3)), turn: 0 }), blend: (t: number) => ({ speed: 2.6 + .6 * Math.sin(t * Math.PI / 3), turn: 0 }), left: (t: number) => ({ speed: 1.62, turn: .8 }), right: (t: number) => ({ speed: 1.62, turn: -.8 }) };
    for (const flex of [.6, 1])
        for (const hz of [30, 60, 120])
            for (const seed of [0, .25, .5, .75])
                for (const [name, schedule] of Object.entries(schedules)) {
                    const { root, group, mixer, loco } = await make(flex);
                    group.position.set(0, .02, 0);
                    loco.reset();
                    Object.assign(loco, { phase: seed, weights: new Map([['idle', 1]]), lastActive: '' });
                    let yaw = 0;
                    const rows: any[] = [];
                    let headReference: THREE.Quaternion | undefined, previousHead: THREE.Quaternion | undefined;
                    for (let frame = 0; frame < 10 * hz; frame++) {
                        const { speed, turn } = schedule(frame / hz);
                        yaw += turn / hz;
                        group.rotation.y = yaw;
                        group.position.x += Math.sin(yaw) * speed / hz;
                        group.position.z += Math.cos(yaw) * speed / hz;
                        group.updateMatrixWorld(true);
                        loco.input = { speed, grounded: true, yaw, verticalSpeed: 0, groundAt: () => 0 };
                        loco.beforeMixer();
                        loco.blend(1 / hz, speed > .01 ? 'run' : 'idle');
                        mixer.update(1 / hz);
                        loco.afterMixer(1 / hz, speed > .01 ? 'run' : 'idle');
                        if (frame < (['steady', 'trot', 'run'].includes(name) ? 1.5 : .25) * hz)
                            continue;
                        const point = (n: string) => root.getObjectByName(n)!.getWorldPosition(new THREE.Vector3()).sub(group.position).applyAxisAngle(new THREE.Vector3(0, 1, 0), -yaw);
                        const a = point('scapula_l'), b = point('scapula_r'), head = point('head'), chest = point('spine_04');
                        const headQ = group.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(root.getObjectByName('head')!.getWorldQuaternion(new THREE.Quaternion()));
                        headReference ??= headQ.clone();
                        const relative = headReference.clone().invert().multiply(headQ), euler = new THREE.Euler().setFromQuaternion(relative, 'YXZ');
                        const headAngularSpeed = previousHead ? previousHead.angleTo(headQ) * hz : 0;
                        previousHead = headQ.clone();
                        rows.push({ frame, speed, phase: loco.metrics.phase, slide: loco.metrics.maxSlideMS, residual: loco.metrics.maxResidual, shoulderRoll: Math.atan2(a.y - b.y, a.x - b.x), chestX: chest.x, headY: head.y, headPitch: euler.x, headYaw: euler.y, headRoll: euler.z, headAngularSpeed, maxCorrection: loco.metrics.maxCorrection, maxSwingPenetration: loco.metrics.maxSwingPenetration, groundClampFeet: loco.metrics.groundClampFeet, earlyTouches: loco.metrics.earlyTouches, landOffset: loco.metrics.landOffset, cadence: loco.metrics.cadenceHz, stanceRatio: loco.metrics.stanceRatio, bankCommand: loco.metrics.bankCommand, pelvisBank: loco.metrics.pelvisBankAngle, chestBank: loco.metrics.chestBankAngle });
                    }
                    console.log(JSON.stringify({ flex, hz, seed, schedule: name, label: 'Prescribed-speed animation/IK probe on flat ground, not controller/visual approval', metrics: Object.fromEntries(['slide', 'residual', 'shoulderRoll', 'chestX', 'headY', 'headPitch', 'headYaw', 'headRoll', 'headAngularSpeed', 'maxCorrection', 'maxSwingPenetration', 'groundClampFeet', 'earlyTouches', 'landOffset', 'cadence', 'stanceRatio', 'bankCommand', 'pelvisBank', 'chestBank'].map(key => [key, stats(rows.map(r => r[key]))])), samples: rows.filter((_, i) => i % Math.round(hz / 10) === 0) }));
                }
}
