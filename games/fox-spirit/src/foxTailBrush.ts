import * as THREE from 'three';
import { FOX_RIG } from './foxRig';
import { TailBrushCurve, tailProfileAt } from './foxTailShape';

const RADIAL = 12;
const SEGMENTS = 45;
const PROFILE: readonly [number, number][] = [[0, 0.08], [0.065, 0.082], [0.15, 0.095], [0.25, 0.12], [0.40, 0.15], [0.52, 0.14], [0.60, 0.12], [0.70, 0.095], [0.80, 0.07], [0.90, 0.042], [1, 0.015]];

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
  const controls = [heads[0]!.clone().addScaledVector(first, -0.095 / metresPerUnit), ...heads, heads[7]!.clone().addScaledVector(last, 0.04 / metresPerUnit)];
  const joints = [bones[0]!.index, ...bones.map((b) => b.index), bones[7]!.index];
  const curve = new TailBrushCurve(controls);
  const segments = SEGMENTS;
  const length = curve.getLength();
  const pelvis = tail.skeleton.bones.findIndex((bone) => bone.name === FOX_RIG.pelvis);
  if (pelvis < 0) throw new Error('Ember brush requires the existing pelvis bone');
  const rootArcMetres = 0.095;
  const profileRadiusAt = (t: number) => tailProfileAt(t, PROFILE) / metresPerUnit;
  const boneCoordinate = (point: THREE.Vector3) => {
    let distance = Infinity, coordinate = 0;
    for (let i = 0; i < controls.length - 1; i++) {
      const segment = controls[i + 1]!.clone().sub(controls[i]!);
      const fraction = THREE.MathUtils.clamp(point.clone().sub(controls[i]!).dot(segment) / segment.lengthSq(), 0, 1);
      const squared = point.distanceToSquared(controls[i]!.clone().addScaledVector(segment, fraction));
      if (squared < distance) { distance = squared; coordinate = i + fraction; }
    }
    return coordinate;
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
  const frames: { center: THREE.Vector3; tangent: THREE.Vector3; vertical: THREE.Vector3; side: THREE.Vector3 }[] = [];
  for (let ring = 0; ring <= segments; ring++) {
    const t = ring / segments, center = curve.getPointAt(t), tangent = curve.getTangentAt(t).normalize();
    const previous = frames[ring - 1];
    const vertical = previous ? previous.vertical.clone().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(previous.tangent, tangent)) : new THREE.Vector3(0, 1, 0);
    vertical.addScaledVector(tangent, -vertical.dot(tangent));
    if (vertical.lengthSq() < 0.01) vertical.set(0, 0, 1).addScaledVector(tangent, -tangent.z);
    vertical.normalize();
    frames.push({ center, tangent, vertical, side: tangent.clone().cross(vertical).normalize() });
  }
  const shapeEnvelope = (top: boolean) => {
    const radii = Array.from({ length: segments + 1 }, (_, i) => {
      const t = i / segments, radius = profileRadiusAt(t), safe = safeRadiusAt(t);
      const lo = Math.max(0, t - 0.004), hi = Math.min(1, t + 0.004);
      const bend = curve.getTangentAt(hi).sub(curve.getTangentAt(lo));
      const vertical = frames[i]!.vertical;
      const downwardBend = bend.lengthSq() > 1e-10 && bend.normalize().dot(vertical) < -Math.cos(25 * Math.PI / 180);
      // The root bends down. Its top is the outside of the bend and needs no inward clamp.
      return top && downwardBend ? radius : safe;
    });
    const peak = radii.indexOf(Math.max(...radii));
    const monotone = () => {
      for (let i = peak - 1; i >= 0; i--) radii[i] = Math.min(radii[i]!, radii[i + 1]!);
      for (let i = peak + 1; i <= segments; i++) radii[i] = Math.min(radii[i]!, radii[i - 1]!);
    };
    monotone();
    const maxRadiusStep = 0.42 * length / segments;
    for (let i = 1; i <= peak; i++) radii[i] = Math.min(radii[i]!, radii[i - 1]! + maxRadiusStep);
    for (let i = segments - 1; i >= peak; i--) radii[i] = Math.min(radii[i]!, radii[i + 1]! + maxRadiusStep);
    for (let pass = 0; pass < 4; pass++) {
      const previous = [...radii];
      for (let i = 1; i < segments; i++) radii[i] = Math.min(previous[i]!, (previous[i - 1]! + 2 * previous[i]! + previous[i + 1]!) * 0.25);
      monotone();
    }
    return radii;
  };
  const topRadii = shapeEnvelope(true), bottomRadii = shapeEnvelope(false);
  const radiusAt = (t: number, top: boolean) => {
    const index = THREE.MathUtils.clamp(t, 0, 1) * segments, lower = Math.min(segments - 1, Math.floor(index));
    const radii = top ? topRadii : bottomRadii;
    return THREE.MathUtils.lerp(radii[lower]!, radii[lower + 1]!, index - lower);
  };
  const makeGeometry = (shellScale: number) => {
    const positions: number[] = [], normals: number[] = [], uvs: number[] = [], skin: number[] = [], weights: number[] = [], indices: number[] = [];
    const addVertex = (p: THREE.Vector3, normal: THREE.Vector3, u: number, v: number, j0: number, j1: number, f: number, t: number) => {
      positions.push(p.x, p.y, p.z); normals.push(normal.x, normal.y, normal.z); uvs.push(u, v);
      const pelvisWeight = 1 - THREE.MathUtils.smoothstep(t * length * metresPerUnit, rootArcMetres - 0.02, rootArcMetres + 0.12);
      skin.push(pelvis, j0, j1, 0); weights.push(pelvisWeight, (1 - pelvisWeight) * (1 - f), (1 - pelvisWeight) * f, 0);
      return positions.length / 3 - 1;
    };
    let previousCoordinate = 0;
    for (let ring = 0; ring <= segments; ring++) {
      const t = ring / segments;
      const { center, tangent, vertical, side } = frames[ring]!;
      const coordinate = Math.max(previousCoordinate, boneCoordinate(center));
      previousCoordinate = coordinate;
      const segment = Math.min(controls.length - 2, Math.floor(coordinate));
      const segmentFraction = coordinate - segment;
      const lower = segmentFraction < 0.5 ? Math.max(0, segment - 1) : segment;
      const upper = Math.min(joints.length - 1, lower + 1);
      const f = segmentFraction < 0.5 ? 0.5 + segmentFraction : segmentFraction - 0.5;
      const lo = Math.max(0, t - 1 / segments), hi = Math.min(1, t + 1 / segments);
      for (let radial = 0; radial <= RADIAL; radial++) {
        const angle = radial / RADIAL * Math.PI * 2, c = Math.cos(angle), s = Math.sin(angle);
        const top = radial <= RADIAL / 2 || radial === RADIAL;
        const radius = radiusAt(t, top) * shellScale;
        const slope = (radiusAt(hi, top) - radiusAt(lo, top)) * shellScale / Math.max(0.0001, (hi - lo) * length);
        const sideRadius = radiusAt(t, true) * shellScale * THREE.MathUtils.lerp(0.75, 0.80, THREE.MathUtils.smoothstep(t, 0.15, 0.40));
        const p = center.clone().addScaledVector(side, c * sideRadius).addScaledVector(vertical, s * radius);
        const widthAt = (u: number) => radiusAt(u, true) * shellScale * THREE.MathUtils.lerp(0.75, 0.80, THREE.MathUtils.smoothstep(u, 0.15, 0.40));
        const widthSlope = (widthAt(hi) - widthAt(lo)) / Math.max(0.0001, (hi - lo) * length);
        const normalSlope = radius / sideRadius * widthSlope * c * c + slope * s * s;
        const normal = side.clone().multiplyScalar(c * radius / sideRadius).addScaledVector(vertical, s).addScaledVector(tangent, -normalSlope).normalize();
        addVertex(p, normal, radial / RADIAL, 1 - t, joints[lower]!, joints[upper]!, f, t);
      }
    }
    // Two shrinking rings and a distinct axial point replace coplanar flat end fans.
    const tipTangent = curve.getTangentAt(1).normalize();
    const tipVertical = frames[segments]!.vertical.clone();
    const tipSide = tipTangent.clone().cross(tipVertical).normalize();
    const tipRadius = radiusAt(1, true) * shellScale;
    const closingLength = tipRadius * (1.5 + (shellScale - 1) * 2);
    for (const [distance, taper] of [[0.35, 0.75], [0.75, 0.40]]) {
      const center = curve.getPointAt(1).addScaledVector(tipTangent, closingLength * distance!);
      for (let radial = 0; radial <= RADIAL; radial++) {
        const angle = radial / RADIAL * Math.PI * 2, c = Math.cos(angle), s = Math.sin(angle);
        const halfRadius = radiusAt(1, radial <= RADIAL / 2 || radial === RADIAL) * shellScale;
        const p = center.clone().addScaledVector(tipSide, c * tipRadius * taper! * 0.80).addScaledVector(tipVertical, s * halfRadius * taper!);
        const normal = tipSide.clone().multiplyScalar(c / 0.80).addScaledVector(tipVertical, s).addScaledVector(tipTangent, tipRadius / closingLength).normalize();
        addVertex(p, normal, radial / RADIAL, -closingLength * distance! / length, bones[7]!.index, bones[7]!.index, 0, 1);
      }
    }
    const stride = RADIAL + 1;
    for (let ring = 0; ring < segments + 2; ring++) for (let radial = 0; radial < RADIAL; radial++) {
      const a = ring * stride + radial, b = a + stride;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const start = addVertex(curve.getPoint(0), curve.getTangent(0).normalize().negate(), 0.5, 1, joints[0]!, joints[0]!, 0, 0);
    const end = addVertex(curve.getPointAt(1).addScaledVector(tipTangent, closingLength), tipTangent, 0.5, 0, joints[joints.length - 1]!, joints[joints.length - 1]!, 0, 1);
    for (let radial = 0; radial < RADIAL; radial++) {
      indices.push(start, radial, radial + 1);
      const a = (segments + 2) * stride + radial;
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
  root.userData.tailBrush = { type: 'closed-spindle', profile: 'bspline-root', vertices: tail.geometry.getAttribute('position').count, radialSegments: RADIAL, rings: segments + 3, fringeLayers: 2, maxRadiusMetres: Math.max(...topRadii) * metresPerUnit, rootTopRadiusMetres: topRadii[0]! * metresPerUnit, rootBottomRadiusMetres: bottomRadii[0]! * metresPerUnit, rootHalfWidthMetres: topRadii[0]! * metresPerUnit * 0.75, rootArcMetres, peakAt: topRadii.indexOf(Math.max(...topRadii)) / segments, terminalClosure: 'tapered', boneInfluences: 3 };
}
