/**
 * Album captions (seed DESIGN: ≤ 6 words, environmental story, the slice's only words): one line in the lower third
 * that fades in, holds and fades. Shared by every place that tells a story beat (finale, hermitage…).
 */
import type { OpeningCtx } from './scene';
import { updateCaption, type CaptionState } from './captions.hot';

export function createCaptions(ctx: OpeningCtx) {
  const el = document.createElement('div');
  el.dataset.caption = 'album';
  Object.assign(el.style, {
    position: 'fixed', left: '0', right: '0', bottom: '17%', textAlign: 'center', pointerEvents: 'none',
    color: '#f4e5cb', font: 'italic 24px Georgia,serif', letterSpacing: '0.03em', opacity: '0',
    textShadow: '0 1px 12px rgba(40,24,12,.7)',
  });
  document.body.append(el);
  const c: CaptionState = { el, t: -1 };
  const said: string[] = [];
  ctx.onUpdate((dt) => updateCaption(c, dt));
  return {
    /** show one line now (replaces any line still showing) */
    say(text: string): void {
      el.textContent = text;
      c.t = 0;
      said.push(text);
    },
    state: () => ({ showing: c.t >= 0 ? el.textContent : null, said: said.length }),
  };
}

export type Captions = ReturnType<typeof createCaptions>;
