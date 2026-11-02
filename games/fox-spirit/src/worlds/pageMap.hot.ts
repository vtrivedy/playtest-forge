/** Camera fitting and transient notice time. Event redraw/input live in pageMap.ts. */
import type * as THREE from 'three';
import { fitLetterPlane, type LetterPlane } from '../opening/lettering.hot';
export const PAGE_NOTICE_SECONDS = 7;
export type PageNoticeClock = { remaining: number };
export function stepPageMap(plane: LetterPlane, camera: THREE.PerspectiveCamera, open: boolean, badge?: LetterPlane, revelation?: LetterPlane, notice?: PageNoticeClock, dt = 0): void {
  if (notice) notice.remaining = Math.max(0, notice.remaining - Math.max(0, dt));
  fitLetterPlane(plane, camera, open ? 1 : 0);
  if (revelation) fitLetterPlane(revelation, camera, !open && notice && notice.remaining > 0 ? 1 : 0);
  if (badge) {
    fitLetterPlane(badge, camera, open ? 0 : 1);
    if (!open) {
      const halfH = Math.tan(camera.fov * .5 * Math.PI / 180);
      badge.mesh.position.x = halfH * camera.aspect * .93 - badge.mesh.scale.x * .5;
    }
  }
}
