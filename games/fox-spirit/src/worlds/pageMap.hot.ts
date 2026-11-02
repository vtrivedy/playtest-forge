/** Camera fitting only. Event redraw and input registration live in pageMap.ts. */
import type * as THREE from 'three';
import { fitLetterPlane, type LetterPlane } from '../opening/lettering.hot';
export function stepPageMap(plane: LetterPlane, camera: THREE.PerspectiveCamera, open: boolean, badge?: LetterPlane, revelation?: LetterPlane, pendingRevelation = false): void {
  fitLetterPlane(plane, camera, open ? 1 : 0);
  if (revelation) fitLetterPlane(revelation, camera, !open && pendingRevelation ? 1 : 0);
  if (badge) {
    fitLetterPlane(badge, camera, open ? 0 : 1);
    if (!open) {
      const halfH = Math.tan(camera.fov * .5 * Math.PI / 180);
      badge.mesh.position.x = halfH * camera.aspect * .93 - badge.mesh.scale.x * .5;
    }
  }
}
