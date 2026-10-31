import * as THREE from 'three';
import { FOX_RIG, SIDES } from './foxRig';

/** Load-time limb rework on the authored hero (before the look builds its coat layers):
 * 1. A carpus bone splits each forearm, so the front leg gets the wrist / metacarpal fold a fox walks on
 *    (the GLB forearm runs from the elbow straight to the pad).
 * 2. Bind-space radial mass on the lower legs so they read as furred legs, not dark sticks.
 * Clips never key the carpus; locomotion bends it. */
export const LIMB_RIG = {
  /** Carpus height above the wrist joint as a fraction of the forearm length. */
  carpusAt: 0.3,
  /** Skin blend half-width around the carpus, fraction of forearm length. */
  carpusBlend: 0.08,
  /** Radial scale per bone (1 = authored). */
  mass: { upperarm: 1.12, forearm: 1.3, carpus: 1.22, thigh: 1, shin: 1.22, foot: 1.38 } as Record<string, number>,
  /** Paw width (across the paw only, keeps the pad floor). */
  pawWidth: 1.14,
};

export const carpusName = (s: 'l' | 'r') => `carpus_${s}`;

export function applyFoxLimbRig(root: THREE.Object3D, clips: THREE.AnimationClip[]) {
  root.updateMatrixWorld(true);
  const meshes: THREE.SkinnedMesh[] = [];
  root.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(o as THREE.SkinnedMesh); });
  const inserted: { forearm: THREE.Bone; carpus: THREE.Bone; offset: THREE.Vector3 }[] = [];
  for (const s of SIDES) {
    const leg = FOX_RIG.foreleg(s);
    const forearm = root.getObjectByName(leg.lower) as THREE.Bone | undefined, paw = root.getObjectByName(leg.paw) as THREE.Bone | undefined;
    if (!forearm || !paw || paw.parent !== forearm) throw new Error(`[foxLimbRig] ${leg.lower} -> ${leg.paw} chain missing`);
    if (root.getObjectByName(carpusName(s))) throw new Error('[foxLimbRig] applied twice');
    // Forearm local +Y runs elbow -> wrist (rig contract), so the carpus sits on the paw's offset line.
    const offset = paw.position.clone().multiplyScalar(1 - LIMB_RIG.carpusAt);
    const carpus = new THREE.Bone(); carpus.name = carpusName(s);
    carpus.position.copy(offset);
    forearm.add(carpus);
    forearm.remove(paw); carpus.add(paw);
    paw.position.sub(offset);
    inserted.push({ forearm, carpus, offset });
    // Clips that key the paw translation were authored in forearm space.
    const track = `${leg.paw}.position`;
    for (const clip of clips) for (const t of clip.tracks) if (t.name === track)
      for (let i = 0; i < t.values.length; i += 3) { t.values[i] -= offset.x; t.values[i + 1] -= offset.y; t.values[i + 2] -= offset.z; }
  }
  root.updateMatrixWorld(true);

  const rebuilt = new Map<THREE.Skeleton, THREE.Skeleton>();
  const tmp = new THREE.Vector3(), world = new THREE.Vector3();
  for (const mesh of meshes) {
    const old = mesh.skeleton;
    if (!inserted.some((x) => old.bones.includes(x.forearm))) continue;
    let skeleton = rebuilt.get(old);
    if (!skeleton) {
      const bones = [...old.bones], inverses = old.boneInverses.map((m) => m.clone());
      for (const { forearm, carpus, offset } of inserted) {
        const fi = bones.indexOf(forearm);
        bones.push(carpus);
        inverses.push(new THREE.Matrix4().makeTranslation(-offset.x, -offset.y, -offset.z).multiply(old.boneInverses[fi]!));
      }
      skeleton = new THREE.Skeleton(bones, inverses);
      rebuilt.set(old, skeleton);
    }
    const g = mesh.geometry;
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const si = g.getAttribute('skinIndex') as THREE.BufferAttribute, sw = g.getAttribute('skinWeight') as THREE.BufferAttribute;
    const bindToBone = (i: number) => new THREE.Matrix4().multiplyMatrices(skeleton!.boneInverses[i]!, mesh.bindMatrix);
    // Segment frames in bind space: bone origin and +Y axis to its child (bone-local, length = child offset).
    type Seg = { index: number; toLocal: THREE.Matrix4; fromLocal: THREE.Matrix4; length: number; k: number; widthOnly?: boolean };
    const segs: Seg[] = [];
    const addSeg = (name: string, k: number, length: number, widthOnly = false) => {
      const index = skeleton!.bones.findIndex((b) => b.name === name);
      if (index < 0 || k === 1) return;
      const toLocal = bindToBone(index);
      segs.push({ index, toLocal, fromLocal: toLocal.clone().invert(), length, k, widthOnly });
    };
    const childLength = (name: string) => {
      const b = skeleton!.bones.find((x) => x.name === name);
      const c = b?.children.find((x) => (x as THREE.Bone).isBone);
      return c ? c.position.length() : 0;
    };
    for (const s of SIDES) {
      const f = FOX_RIG.foreleg(s), h = FOX_RIG.hindleg(s), m = LIMB_RIG.mass;
      addSeg(f.upper, m.upperarm, childLength(f.upper));
      addSeg(f.lower, m.forearm, childLength(f.lower));
      addSeg(carpusName(s), m.carpus, childLength(carpusName(s)));
      addSeg(h.thigh, m.thigh, childLength(h.thigh));
      addSeg(h.shin, m.shin, childLength(h.shin));
      addSeg(h.foot, m.foot, childLength(h.foot));
      addSeg(f.paw, LIMB_RIG.pawWidth, 1, true);
      addSeg(h.paw, LIMB_RIG.pawWidth, 1, true);
    }
    const carpusIndex = new Map(inserted.map(({ forearm, carpus }) => [skeleton!.bones.indexOf(forearm), { carpus: skeleton!.bones.indexOf(carpus) }]));
    const forearmLen = new Map(inserted.map(({ forearm, offset }) => [skeleton!.bones.indexOf(forearm), offset.length() / (1 - LIMB_RIG.carpusAt)]));
    const disp = new THREE.Vector3();
    for (let v = 0; v < pos.count; v++) {
      // 1. Reweight the lower forearm onto the carpus (soft blend, conserves total weight).
      for (let j = 0; j < 4; j++) {
        const bi = si.getComponent(v, j), w = sw.getComponent(v, j);
        const c = carpusIndex.get(bi);
        if (!c || w <= 0) continue;
        const len = forearmLen.get(bi)!;
        world.fromBufferAttribute(pos, v).applyMatrix4(bindToBone(bi));
        const at = len * (1 - LIMB_RIG.carpusAt), half = len * LIMB_RIG.carpusBlend;
        const share = THREE.MathUtils.smoothstep(world.y, at - half, at + half);
        if (share <= 0) continue;
        let slot = -1;
        for (let k = 0; k < 4; k++) if (si.getComponent(v, k) === c.carpus || sw.getComponent(v, k) === 0) { slot = k; break; }
        if (slot < 0) { // replace the weakest other influence and renormalise
          let min = Infinity;
          for (let k = 0; k < 4; k++) if (k !== j && sw.getComponent(v, k) < min) { min = sw.getComponent(v, k); slot = k; }
          const total = 1 - min;
          for (let k = 0; k < 4; k++) if (k !== slot) sw.setComponent(v, k, sw.getComponent(v, k) / total);
          sw.setComponent(v, slot, 0);
        }
        const wNow = sw.getComponent(v, j);
        si.setComponent(v, slot, c.carpus);
        sw.setComponent(v, slot, sw.getComponent(v, slot) + wNow * share);
        sw.setComponent(v, j, wNow * (1 - share));
      }
      // 2. Radial mass in each segment's frame, feathered by its skin weight.
      disp.set(0, 0, 0);
      const p = tmp.fromBufferAttribute(pos, v);
      for (const seg of segs) {
        let w = 0;
        for (let j = 0; j < 4; j++) if (si.getComponent(v, j) === seg.index) w += sw.getComponent(v, j);
        if (w <= 0) continue;
        const local = p.clone().applyMatrix4(seg.toLocal);
        const moved = local.clone();
        if (seg.widthOnly) moved.x *= seg.k;
        else {
                    const along = seg.length > 0 ? THREE.MathUtils.clamp(local.y / seg.length, 0, 1) : 0.5;
          // Full mass mid-bone, none at the proximal joint (keeps the haunch / shoulder seam closed).
          const k = 1 + (seg.k - 1) * THREE.MathUtils.smoothstep(along, 0, 0.35) * (0.55 + 0.45 * Math.sin(Math.PI * along));
          moved.x *= k; moved.z *= k;
        }
        disp.add(moved.applyMatrix4(seg.fromLocal).sub(p).multiplyScalar(w));
      }
      if (disp.lengthSq() > 0) pos.setXYZ(v, p.x + disp.x, p.y + disp.y, p.z + disp.z);
    }
    pos.needsUpdate = si.needsUpdate = sw.needsUpdate = true;
    g.computeBoundingBox(); g.computeBoundingSphere();
    mesh.bind(skeleton, mesh.bindMatrix);
  }
  root.updateMatrixWorld(true);
}
