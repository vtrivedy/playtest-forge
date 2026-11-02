/** Album captions' per-frame fade (captions.ts builds them). No allocation beyond the style string. */
import * as THREE from 'three';

export const CAPTION = { fadeIn: 1.0, hold: 3.6, fadeOut: 1.2 };

export type CaptionState = { el: HTMLElement; t: number };

export function updateCaption(c: CaptionState, dt: number): void {
  if (c.t < 0) return;
  c.t += dt;
  const o = THREE.MathUtils.smoothstep(c.t, 0, CAPTION.fadeIn) * (1 - THREE.MathUtils.smoothstep(c.t, CAPTION.fadeIn + CAPTION.hold, CAPTION.fadeIn + CAPTION.hold + CAPTION.fadeOut));
  c.el.style.opacity = o.toFixed(3);
  if (c.t > CAPTION.fadeIn + CAPTION.hold + CAPTION.fadeOut) c.t = -1;
}
