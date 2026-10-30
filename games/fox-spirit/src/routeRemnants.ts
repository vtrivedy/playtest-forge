import * as THREE from 'three';
import { Bucket, PAL, trs } from './russetKit';

/** Restyle the existing CC0 Quaternius carving as a solid square jump remnant. */
export function routeRemnant(
  bucket: Bucket, column: THREE.BufferGeometry,
  x: number, z: number, yaw: number, bottom: number, top: number, width: number, variant: number,
): void {
  const remnant = column.clone();
  remnant.computeBoundingBox();
  const bounds = remnant.boundingBox!;
  const size = bounds.getSize(new THREE.Vector3());
  const centre = bounds.getCenter(new THREE.Vector3());
  const positions = remnant.getAttribute('position');
  const height = top - bottom;
  for (let i = 0; i < positions.count; i++) {
    const px = (positions.getX(i) - centre.x) / (size.x * 0.5);
    const pz = (positions.getZ(i) - centre.z) / (size.z * 0.5);
    const t = (positions.getY(i) - bounds.min.y) / size.y;
    const radius = Math.max(Math.abs(px), Math.abs(pz));
    // Keep the source's carved profile as shallow relief on a broad solid body.
    // A narrow round shaft would leave an invisible wall inside the old box collider.
    const edge = width * 0.5 * (0.88 + radius * 0.12);
    const scale = radius > 1e-6 ? edge / radius : 0;
    const y = t < 0.24 ? t / 0.24 * 0.28
      : t > 0.74 ? height - 0.42 + (t - 0.74) / 0.26 * 0.42
      : 0.28 + (t - 0.24) / 0.5 * (height - 0.70);
    positions.setXYZ(i, px * scale, y, pz * scale);
  }
  remnant.computeVertexNormals();
  const tint = PAL.stone.clone().lerp(PAL.pathEarth, 0.18 + variant * 0.04);
  bucket.add(remnant, trs(x, bottom, z, yaw + variant * Math.PI / 2), tint);
  remnant.dispose();
}
