/**
 * The teach line: one short control hint (upper-left, clear of the fox and the caption band), drawn in the frame
 * (lettering.ts) so recordings carry it. Any place offers its line each frame it wants to teach (`ctx.teach.offer`);
 * the latest offer wins, the line fades in, and fades out once nobody offers. Redraws only when the words change.
 */
import type * as THREE from 'three';
import type { OpeningCtx } from './scene';
import { createLetterPlane } from './lettering';
import { updateTeach, type TeachState } from './teach.hot';

export function createTeach(ctx: OpeningCtx) {
  const plane = createLetterPlane(2048, 128, 0.062, 0.8, { x: -0.94, left: true, panel: true });
  const t: TeachState = { plane, cam: null, offered: null, drawn: null, o: 0, redraw: (text) => plane.draw([{ text, px: 60 }]) };
  ctx.onUpdate((dt) => updateTeach(t, dt));
  return {
    /** fix the line to the rendered lens (the camera must be in the scene) */
    mount(cam: THREE.PerspectiveCamera): void {
      cam.add(plane.mesh);
      t.cam = cam;
    },
    /** call every frame this hint should show (pass a constant string: no per-frame allocation) */
    offer(text: string): void {
      t.offered = text;
    },
    state: () => ({ showing: t.o > 0.01 ? t.drawn : null }),
  };
}

export type Teach = ReturnType<typeof createTeach>;
