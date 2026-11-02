/** The teach line's per-frame fade (teach.ts builds it). Allocation-free; redraw only when the offered words change. */
import type * as THREE from 'three';
import { fitLetterPlane, type LetterPlane } from './lettering.hot';

export type TeachState = {
  plane: LetterPlane;
  cam: THREE.PerspectiveCamera | null;
  /** offered since the last step (cleared each step) */
  offered: string | null;
  /** words currently on the canvas */
  drawn: string | null;
  o: number;
  redraw: (text: string) => void;
};

const FADE = 0.4;

export function updateTeach(t: TeachState, dt: number): void {
  const want = t.offered;
  t.offered = null;
  // Control words change immediately; only the panel appearance/disappearance fades.
  if (want !== null && want !== t.drawn) {
    t.redraw(want);
    t.drawn = want;
  }
  const on = want !== null && want === t.drawn;
  t.o = on ? Math.min(1, t.o + dt / FADE) : Math.max(0, t.o - dt / FADE);
  if (t.cam) fitLetterPlane(t.plane, t.cam, t.o);
}
