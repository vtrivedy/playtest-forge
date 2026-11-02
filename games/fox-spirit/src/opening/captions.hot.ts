/** Album captions' per-frame fade (captions.ts builds them). No allocation. */
import * as THREE from 'three';
import { fitLetterPlane, type LetterPlane } from './lettering.hot';

export const CAPTION = { fadeIn: 1.0, hold: 3.6, fadeOut: 1.2 };

export type CaptionState = { plane: LetterPlane; cam: THREE.PerspectiveCamera | null; t: number };

export function updateCaption(c: CaptionState, dt: number): void {
  if (c.t < 0 || !c.cam) return;
  c.t += dt;
  const o = THREE.MathUtils.smoothstep(c.t, 0, CAPTION.fadeIn) * (1 - THREE.MathUtils.smoothstep(c.t, CAPTION.fadeIn + CAPTION.hold, CAPTION.fadeIn + CAPTION.hold + CAPTION.fadeOut));
  if (c.t > CAPTION.fadeIn + CAPTION.hold + CAPTION.fadeOut) c.t = -1;
  fitLetterPlane(c.plane, c.cam, c.t < 0 ? 0 : o);
}
