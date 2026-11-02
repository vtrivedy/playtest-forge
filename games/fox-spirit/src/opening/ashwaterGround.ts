import * as THREE from 'three';
import { ASH_ORIGIN, E, waterAt } from './ashwaterLayout';

/** Static rainwater in the existing terrain hollows; never a gameplay water body. */
export function buildAshwaterPuddles(terrain: THREE.BufferGeometry): THREE.Mesh {
  const surface = -0.045;
  const pos = terrain.getAttribute('position');
  const index = terrain.index!;
  const vertices: number[] = [];
  const colors: number[] = [];
  type Point = { x: number; y: number; z: number };
  for (let i = 0; i < index.count; i += 3) {
    const triangle: Point[] = [];
    let excluded = false;
    for (let k = 0; k < 3; k++) {
      const j = index.getX(i + k);
      const x = pos.getX(j), z = pos.getZ(j);
      triangle.push({ x, y: pos.getY(j), z });
      // A dry margin separates cosmetic pools from the drainable puzzle channels.
      for (const dx of [-1.2, 0, 1.2]) for (const dz of [-1.2, 0, 1.2]) {
        if (waterAt(x + ASH_ORIGIN.x + dx, z + ASH_ORIGIN.z + dz) !== null) excluded = true;
      }
      if (E(x + ASH_ORIGIN.x, z + ASH_ORIGIN.z) > -4) excluded = true;
    }
    if (excluded) continue;
    const clipped: Point[] = [];
    for (let k = 0; k < 3; k++) {
      const a = triangle[k], b = triangle[(k + 1) % 3];
      if (a.y <= surface) clipped.push(a);
      if ((a.y <= surface) !== (b.y <= surface)) {
        const t = (surface - a.y) / (b.y - a.y);
        clipped.push({ x: a.x + (b.x - a.x) * t, y: surface, z: a.z + (b.z - a.z) * t });
      }
    }
    for (let k = 1; k + 1 < clipped.length; k++) {
      for (const p of [clipped[0], clipped[k], clipped[k + 1]]) {
        vertices.push(p.x, surface + 0.004, p.z);
        colors.push(1, 1, 1, THREE.MathUtils.smoothstep(surface - p.y, 0, 0.07));
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color: 0x708781, roughness: 0.24, metalness: 0.04,
    vertexColors: true, transparent: true, opacity: 0.76,
  }));
  mesh.name = 'ashwater-rain-puddles';
  mesh.position.set(ASH_ORIGIN.x, 0, ASH_ORIGIN.z);
  mesh.receiveShadow = true;
  return mesh;
}
