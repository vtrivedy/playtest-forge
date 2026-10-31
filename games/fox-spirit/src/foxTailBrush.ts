import * as THREE from 'three';
import { FOX_RIG } from './foxRig';

const RADIAL = 12;
const RINGS_PER_SEGMENT = 4;
const PROFILE: readonly [number, number][] = [[0, 0.05], [0.16, 0.11], [0.46, 0.15], [0.60, 0.12], [0.82, 0.075], [1, 0.022]];

/** Restyle the imported tail surface only. The authored skeleton, inverse binds and animation stay intact. */
export function rebuildTailBrush(root: THREE.Object3D, metresPerUnit: number) {
  root.updateWorldMatrix(true, true);
  let core: THREE.SkinnedMesh | undefined;
  const oldShells: THREE.SkinnedMesh[] = [];
  root.traverse((object) => {
    if (!(object as THREE.SkinnedMesh).isSkinnedMesh) return;
    const mesh = object as THREE.SkinnedMesh;
    const name = ((mesh.material as THREE.Material).name ?? '').toLowerCase();
    if (name === 'foxtailfur') core = mesh;
    else if (name.startsWith('foxtailfur') && name.includes('shell')) oldShells.push(mesh);
  });
  if (!core || !(metresPerUnit > 0)) throw new Error('Ember brush requires the authored tail mesh and a valid scale');
  const tail = core;
  const bones = FOX_RIG.tail.map((name) => {
    const index = tail.skeleton.bones.findIndex((bone) => bone.name === name);
    if (index < 0) throw new Error(`Ember brush missing authored bone ${name}`);
    return { bone: tail.skeleton.bones[index]!, index };
  });
  const inverse = tail.matrixWorld.clone().invert();
  const heads = bones.map(({ bone }) => bone.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse));
  const first = heads[1]!.clone().sub(heads[0]!).normalize();
  const last = heads[7]!.clone().sub(heads[6]!).normalize();
  const controls = [heads[0]!.clone().addScaledVector(first, -0.07 / metresPerUnit), ...heads, heads[7]!.clone().addScaledVector(last, 0.04 / metresPerUnit)];
  const joints = [bones[0]!.index, ...bones.map((b) => b.index), bones[7]!.index];
  const curve = new THREE.CatmullRomCurve3(controls, false, 'centripetal');
  const segments = (controls.length - 1) * RINGS_PER_SEGMENT;
  const length = curve.getLength();
  const profileRadiusAt = (t: number) => {
    for (let i = 1; i < PROFILE.length; i++) {
      const [a, ra] = PROFILE[i - 1]!, [b, rb] = PROFILE[i]!;
      if (t <= b) return THREE.MathUtils.lerp(ra, rb, THREE.MathUtils.smoothstep(t, a, b)) / metresPerUnit;
    }
    return PROFILE[PROFILE.length - 1]![1] / metresPerUnit;
  };
  const curvatureAt = (t: number) => {
    const lo = Math.max(0, t - 0.004), hi = Math.min(1, t + 0.004);
    return curve.getTangentAt(hi).sub(curve.getTangentAt(lo)).length() / Math.max(0.0001, (hi - lo) * length);
  };
  const safeRadiusAt = (t: number) => {
    // Keep even the outer fringe inside a tight bind-pose bend; preserve the spindle elsewhere.
    const k = Math.max(curvatureAt(t), curvatureAt(Math.max(0, t - 0.5 / segments)), curvatureAt(Math.min(1, t + 0.5 / segments)));
    return Math.min(profileRadiusAt(t), k > 0.0001 ? 0.60 / (k * 1.16) : Infinity);
  };
  const radii = Array.from({ length: segments + 1 }, (_, i) => safeRadiusAt(i / segments));
  const peak = radii.indexOf(Math.max(...radii));
  const monotone = () => {
    for (let i = peak - 1; i >= 0; i--) radii[i] = Math.min(radii[i]!, radii[i + 1]!);
    for (let i = peak + 1; i <= segments; i++) radii[i] = Math.min(radii[i]!, radii[i - 1]!);
  };
  monotone();
  const maxRadiusStep = 0.42 * length / segments;
  for (let i = 1; i <= peak; i++) radii[i] = Math.min(radii[i]!, radii[i - 1]! + maxRadiusStep);
  for (let i = segments - 1; i >= peak; i--) radii[i] = Math.min(radii[i]!, radii[i + 1]! + maxRadiusStep);
  monotone();
  // Only reduce the safe envelope: smooth the pinches without reintroducing folded inner faces.
  for (let pass = 0; pass < 4; pass++) {
    const previous = [...radii];
    for (let i = 1; i < segments; i++) radii[i] = Math.min(previous[i]!, (previous[i - 1]! + 2 * previous[i]! + previous[i + 1]!) * 0.25);
    monotone();
  }
  const radiusAt = (t: number) => {
    const index = THREE.MathUtils.clamp(t, 0, 1) * segments, lower = Math.min(segments - 1, Math.floor(index));
    return THREE.MathUtils.lerp(radii[lower]!, radii[lower + 1]!, index - lower);
  };
  const makeGeometry = (shellScale: number) => {
    const positions: number[] = [], normals: number[] = [], uvs: number[] = [], skin: number[] = [], weights: number[] = [], indices: number[] = [];
    const addVertex = (p: THREE.Vector3, normal: THREE.Vector3, u: number, v: number, j0: number, j1: number, f: number) => {
      positions.push(p.x, p.y, p.z); normals.push(normal.x, normal.y, normal.z); uvs.push(u, v);
      skin.push(j0, j1, 0, 0); weights.push(1 - f, f, 0, 0);
      return positions.length / 3 - 1;
    };
    const up = new THREE.Vector3(0, 1, 0), previousTangent = new THREE.Vector3(), previousVertical = new THREE.Vector3();
    for (let ring = 0; ring <= segments; ring++) {
      const t = ring / segments, parameter = curve.getUtoTmapping(t, 0);
      const segment = Math.min(controls.length - 2, Math.floor(parameter * (controls.length - 1)));
      const segmentFraction = parameter * (controls.length - 1) - segment;
      // Centre each transition on a joint: rings behind a joint remain parent-led.
      const lower = segmentFraction < 0.5 ? Math.max(0, segment - 1) : segment;
      const upper = Math.min(joints.length - 1, lower + 1);
      const f = segmentFraction < 0.5 ? 0.5 + segmentFraction : segmentFraction - 0.5;
      const center = curve.getPoint(parameter), tangent = curve.getTangent(parameter).normalize();
      const vertical = ring === 0 ? up.clone().addScaledVector(tangent, -tangent.y) : previousVertical.clone().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(previousTangent, tangent));
      vertical.addScaledVector(tangent, -vertical.dot(tangent));
      if (vertical.lengthSq() < 0.01) vertical.set(0, 0, 1).addScaledVector(tangent, -tangent.z);
      vertical.normalize();
      previousTangent.copy(tangent); previousVertical.copy(vertical);
      const side = tangent.clone().cross(vertical).normalize();
      const radius = radiusAt(t) * shellScale;
      const lo = Math.max(0, t - 1 / segments), hi = Math.min(1, t + 1 / segments);
      const slope = (radiusAt(hi) - radiusAt(lo)) * shellScale / Math.max(0.0001, (hi - lo) * length);
      for (let radial = 0; radial <= RADIAL; radial++) {
        const angle = radial / RADIAL * Math.PI * 2, c = Math.cos(angle), s = Math.sin(angle);
        const p = center.clone().addScaledVector(side, c * radius * 0.85).addScaledVector(vertical, s * radius);
        const normal = side.clone().multiplyScalar(c / 0.85).addScaledVector(vertical, s).addScaledVector(tangent, -slope).normalize();
        addVertex(p, normal, radial / RADIAL, 1 - t, joints[lower]!, joints[upper]!, f);
      }
    }
    const stride = RADIAL + 1;
    for (let ring = 0; ring < segments; ring++) for (let radial = 0; radial < RADIAL; radial++) {
      const a = ring * stride + radial, b = a + stride;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const start = addVertex(curve.getPoint(0), curve.getTangent(0).normalize().negate(), 0.5, 1, joints[0]!, joints[0]!, 0);
    const end = addVertex(curve.getPoint(1), curve.getTangent(1).normalize(), 0.5, 0, joints[joints.length - 1]!, joints[joints.length - 1]!, 0);
    for (let radial = 0; radial < RADIAL; radial++) {
      indices.push(start, radial, radial + 1);
      const a = segments * stride + radial;
      indices.push(end, a + 1, a);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skin, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
    geometry.setIndex(indices); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
  };
  // Remove the imported petal/lock shells rather than drawing a second tail over them.
  for (const mesh of oldShells) {
    mesh.removeFromParent(); mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) material.dispose();
  }
  const oldGeometry = tail.geometry;
  tail.geometry = makeGeometry(1); oldGeometry.dispose();
  tail.computeBoundingBox(); tail.computeBoundingSphere(); tail.frustumCulled = false;
  const material = tail.material as THREE.MeshStandardMaterial;
  material.side = THREE.FrontSide;
  for (const [i, scale] of [1.08, 1.16].entries()) {
    const shell = tail.clone(false), coat = material.clone();
    coat.name = `FoxTailFurShell${i + 1}`;
    coat.transparent = false; coat.depthWrite = true; coat.alphaTest = i === 0 ? 0.18 : 0.38;
    shell.name = `FoxTailBrushFringe${i + 1}`; shell.geometry = makeGeometry(scale); shell.material = coat;
    shell.castShadow = false; shell.computeBoundingBox(); shell.computeBoundingSphere(); shell.frustumCulled = false;
    tail.parent!.add(shell);
  }
  root.userData.tailBrush = { type: 'closed-spindle', profile: 'monotone-safe', vertices: tail.geometry.getAttribute('position').count, radialSegments: RADIAL, rings: segments + 1, fringeLayers: 2, maxRadiusMetres: Math.max(...radii) * metresPerUnit };
}
