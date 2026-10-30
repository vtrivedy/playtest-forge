import * as THREE from 'three';

/**
 * Rig contract: the locomotion system only talks to bones through these roles.
 * A new fox rig drops in by editing RIG_MAP (names) — nothing else assumes bone names or local axes.
 * Leg chains run hip → … → last bone; `foot` is the bone whose head is the ground-contact point.
 */
export const RIG_MAP = {
  root: 'Body',
  pelvis: 'Back',
  spine: ['Torso', 'Torso2', 'Torso3'],
  neck: ['Neck1', 'Neck2', 'Neck3'],
  head: 'Head',
  tail: ['Tail1', 'Tail2', 'Tail3', 'Tail4', 'Tail5', 'Tail6', 'Tail7', 'Tail8'],
  ears: [
    ['Ear1.L', 'Ear2.L'],
    ['Ear1.R', 'Ear2.R'],
  ],
  legs: {
    LF: { chain: ['FrontUpperLeg.L', 'FrontLowerLeg.L'], foot: 'FrontPaw.L' },
    RF: { chain: ['FrontUpperLeg.R', 'FrontLowerLeg.R'], foot: 'FrontPaw.R' },
    LH: { chain: ['BackLeg.L', 'BackUpperLeg.L', 'BackLowerLeg.L'], foot: 'BackPaw.L' },
    RH: { chain: ['BackLeg.R', 'BackUpperLeg.R', 'BackLowerLeg.R'], foot: 'BackPaw.R' },
  },
} as const;

export type LegId = keyof typeof RIG_MAP.legs;
export const LEG_IDS: LegId[] = ['LH', 'LF', 'RH', 'RF'];

export type RigLeg = {
  id: LegId;
  fore: boolean;
  /** +1 = fox's left */
  side: 1 | -1;
  chain: THREE.Bone[];
  foot: THREE.Bone;
  /** Segment lengths in world units (rest pose) */
  lengths: number[];
  reach: number;
  /** Rest joint positions (chain heads + foot head) in fox-model space (world units, group-local) */
  restJoints: THREE.Vector3[];
  /** Rest foot-head position in model space (on the ground plane, y≈0) */
  restFoot: THREE.Vector3;
};

export type Rig = {
  root: THREE.Bone;
  pelvis: THREE.Bone;
  spine: THREE.Bone[];
  neck: THREE.Bone[];
  head: THREE.Bone;
  tail: THREE.Bone[];
  ears: THREE.Bone[][];
  legs: Record<LegId, RigLeg>;
  /** Every bone we write each frame — reset to rest before the procedural pass */
  driven: THREE.Bone[];
  rest: Map<THREE.Bone, { p: THREE.Vector3; q: THREE.Quaternion }>;
  /** Rest model-space positions of the shoulder/hip midpoints and COM */
  shoulder: THREE.Vector3;
  hip: THREE.Vector3;
  com: THREE.Vector3;
  /** Rest tail joint positions (model space), plus a tip point */
  tailRest: THREE.Vector3[];
};

/** Build the rig from a loaded model. `model` is the fox group (its local frame = model space, +Z forward, +Y up). */
export function buildRig(model: THREE.Object3D): Rig {
  const byName = new Map<string, THREE.Bone>();
  model.traverse((o) => {
    if ((o as THREE.Bone).isBone) byName.set(o.name, o as THREE.Bone);
  });
  const get = (n: string) => {
    const b = byName.get(n);
    if (!b) throw new Error(`[loco] rig missing bone "${n}" — update RIG_MAP`);
    return b;
  };
  model.updateMatrixWorld(true);
  const toModel = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const mpos = (b: THREE.Object3D) => b.getWorldPosition(new THREE.Vector3()).applyMatrix4(toModel);

  const legs = {} as Record<LegId, RigLeg>;
  for (const id of LEG_IDS) {
    const def = RIG_MAP.legs[id];
    const chain = def.chain.map(get);
    const foot = get(def.foot);
    const restJoints = [...chain, foot].map(mpos);
    const lengths = restJoints.slice(1).map((p, i) => p.distanceTo(restJoints[i]));
    legs[id] = {
      id,
      fore: id.endsWith('F'),
      side: id.startsWith('L') ? 1 : -1,
      chain,
      foot,
      lengths,
      reach: lengths.reduce((a, b) => a + b, 0),
      restJoints,
      restFoot: restJoints[restJoints.length - 1].clone(),
    };
  }

  const tail = RIG_MAP.tail.map(get);
  const tailRest = tail.map(mpos);
  // tip: extrapolate the last segment
  const n = tailRest.length;
  tailRest.push(tailRest[n - 1].clone().add(tailRest[n - 1].clone().sub(tailRest[n - 2])));

  const rig: Rig = {
    root: get(RIG_MAP.root),
    pelvis: get(RIG_MAP.pelvis),
    spine: RIG_MAP.spine.map(get),
    neck: RIG_MAP.neck.map(get),
    head: get(RIG_MAP.head),
    tail,
    ears: RIG_MAP.ears.map((e) => e.map(get)),
    legs,
    driven: [],
    rest: new Map(),
    shoulder: legs.LF.restJoints[0].clone().add(legs.RF.restJoints[0]).multiplyScalar(0.5),
    hip: legs.LH.restJoints[0].clone().add(legs.RH.restJoints[0]).multiplyScalar(0.5),
    com: new THREE.Vector3(),
    tailRest,
  };
  rig.com.copy(rig.shoulder).lerp(rig.hip, 0.45);
  const driven = new Set<THREE.Bone>([rig.root, rig.pelvis, ...rig.spine, ...rig.neck, rig.head, ...tail, ...rig.ears.flat()]);
  for (const id of LEG_IDS) {
    for (const b of legs[id].chain) driven.add(b);
    driven.add(legs[id].foot);
  }
  rig.driven = [...driven];
  for (const b of rig.driven) rig.rest.set(b, { p: b.position.clone(), q: b.quaternion.clone() });
  return rig;
}

export function resetToRest(rig: Rig) {
  for (const b of rig.driven) {
    const r = rig.rest.get(b)!;
    b.position.copy(r.p);
    b.quaternion.copy(r.q);
  }
}

const _pq = new THREE.Quaternion();
const _wq = new THREE.Quaternion();
const _dq = new THREE.Quaternion();

/** Pre-multiply a world-space rotation onto a bone (keeps its world position), then refresh its subtree. */
export function rotateBoneWorld(bone: THREE.Object3D, worldRot: THREE.Quaternion, update = true) {
  bone.getWorldQuaternion(_wq);
  bone.parent!.getWorldQuaternion(_pq);
  _dq.copy(_pq).invert().multiply(worldRot).multiply(_wq);
  bone.quaternion.copy(_dq);
  if (update) bone.updateMatrixWorld(true);
}

const _q = new THREE.Quaternion();
export function rotateBoneAxis(bone: THREE.Object3D, axisWorld: THREE.Vector3, angle: number, update = true) {
  if (angle === 0) return;
  _q.setFromAxisAngle(axisWorld, angle);
  rotateBoneWorld(bone, _q, update);
}

/** Set a bone's world orientation directly. */
export function setBoneWorldQuat(bone: THREE.Object3D, worldQuat: THREE.Quaternion, update = true) {
  bone.parent!.getWorldQuaternion(_pq);
  bone.quaternion.copy(_pq).invert().multiply(worldQuat);
  if (update) bone.updateMatrixWorld(true);
}
