/**
 * Album captions (seed DESIGN: ≤ 6 words, environmental story, the slice's only words): one line in the lower third
 * that fades in, holds and fades. Shared by every place that tells a story beat (finale, hermitage…). Drawn in the
 * rendered frame (lettering.ts) so recordings carry them.
 */
import type * as THREE from 'three';
import type { OpeningCtx } from './scene';
import { createLetterPlane } from './lettering';
import { updateCaption, type CaptionState } from './captions.hot';

export function createCaptions(ctx: OpeningCtx) {
  const plane = createLetterPlane(2048, 192, 0.085, -0.62);
  const c: CaptionState = { plane, cam: null, t: -1 };
  let showing = '';
  const said: string[] = [];
  ctx.onUpdate((dt) => updateCaption(c, dt));
  return {
    /** fix the line to the rendered lens (the camera must be in the scene) */
    mount(cam: THREE.PerspectiveCamera): void {
      cam.add(plane.mesh);
      c.cam = cam;
    },
    /** show one line now (replaces any line still showing) */
    say(text: string): void {
      // a dark ink outline under the cream: captions must read over snow (the Press) as well as autumn (Kit, 20:51)
      plane.draw([{ text, px: 84, italic: true, spacing: 0.03, outline: 0.12 }]);
      showing = text;
      c.t = 0;
      said.push(text);
    },
    /** primitive hot read: a story line is on screen */
    isShowing: () => c.t >= 0,
    state: () => ({ showing: c.t >= 0 ? showing : null, said: said.length }),
  };
}

export type Captions = ReturnType<typeof createCaptions>;
