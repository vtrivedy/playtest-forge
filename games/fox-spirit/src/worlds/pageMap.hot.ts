/** Camera fitting only. Event redraw and input registration live in pageMap.ts. */
import type * as THREE from 'three';
import { fitLetterPlane, type LetterPlane } from '../opening/lettering.hot';
export function stepPageMap(plane: LetterPlane, camera: THREE.PerspectiveCamera, open: boolean): void {
  fitLetterPlane(plane, camera, open ? 1 : 0);
}
