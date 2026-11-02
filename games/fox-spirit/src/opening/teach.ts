/**
 * The teach line: one short control hint (upper-left, clear of the fox and the caption band), drawn in the frame
 * (lettering.ts) so recordings carry it. Any place offers its line each frame it wants to teach (`ctx.teach.offer`);
 * the latest offer wins, the line fades in, and fades out once nobody offers. Redraws only when the words change.
 */
import type * as THREE from 'three';
import type { OpeningCtx } from './scene';
import { createLetterPlane, type LetterLine } from './lettering';
import { updateTeach, type TeachState } from './teach.hot';

export function createTeach(ctx: OpeningCtx) {
  const plane = createLetterPlane(2560, 128, 0.075, 0.8, { x: -0.94, left: true, panel: true });
  const line: LetterLine = { text: '', px: 70 };
  const lines = [line];
  const t: TeachState = { plane, cam: null, offered: null, drawn: null, o: 0, redraw: (text) => { line.text = text; plane.draw(lines); } };
  return {
    /** fix the line to the rendered lens (the camera must be in the scene) */
    mount(cam: THREE.PerspectiveCamera): void {
      cam.add(plane.mesh);
      t.cam = cam;
      // Mount after every builder: consume this frame's offers after all providers have run.
      ctx.onUpdate((dt) => updateTeach(t, dt));
    },
    /** call every frame this hint should show (pass a constant string: no per-frame allocation) */
    offer(text: string): void {
      t.offered = text;
    },
    /**
     * Story-pace hints (not a control the player needs this second) wait while an Album caption is on screen, so two
     * lines never talk at once (Kit, homecoming: 'Follow the warm light home' over 'One page still holds the autumn.').
     */
    offerAfterCaption(text: string): void {
      if (!ctx.captions.isShowing()) t.offered = text;
    },
    state: () => ({ showing: t.o > 0.01 ? t.drawn : null }),
  };
}

export type Teach = ReturnType<typeof createTeach>;
