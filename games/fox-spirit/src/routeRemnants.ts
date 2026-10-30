import * as THREE from 'three';
import { Bucket, PAL, trs } from './russetKit';

/** Existing CC0 Quaternius capital and shaft, fitted to the old jump-stump envelope. */
export function routeRemnant(
  bucket: Bucket, column: THREE.BufferGeometry,
  x: number, z: number, yaw: number, bottom: number, top: number,
): void {
  column.computeBoundingBox();
  const bounds = column.boundingBox!;
  const size = bounds.getSize(new THREE.Vector3());
  const centre = bounds.getCenter(new THREE.Vector3());
  const fit = new THREE.Matrix4().makeTranslation(-centre.x, -bounds.min.y, -centre.z);
  fit.premultiply(new THREE.Matrix4().makeScale(1.9 / size.x, (top - bottom) / size.y, 1.9 / size.z));
  fit.premultiply(trs(x, bottom, z, yaw));
  bucket.add(column, fit, PAL.stone.clone().lerp(PAL.pathEarth, 0.22));
}
