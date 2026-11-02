// Fox legibility (Kit d03831b: "the whole payoff happened off-screen, the fox a 10 px speck"): one shared measure for
// every route tool. foxPx runs IN the page: the fox's feet → ears (0.6 m) projected through the rendered lens, in CSS px
// (0 when behind the lens). gate() fails a route when the fox stays under `min` px for longer than `maxSeconds`.
//   import { FOX_PX, foxPx, gate, summary } from './lib/fox-size.mjs';
//   const px = await page.evaluate(foxPx);              // per sampled frame
//   const bad = gate(samples, { dt: 1 / 30 });           // samples: number[] at a fixed step dt
/** default floor at 640x360 (scale with the viewport height: 24 px ≈ 6.7 % of 360) */
export const FOX_PX = { min: 24, refHeight: 360, maxSeconds: 1 };

/** page-side: pass to page.evaluate */
export function foxPx() {
  // the game's own definition (Bramble 21aae43: __gameHooks.foxScreenPx) wins; the fallback is the same math
  if (typeof window.__gameHooks.foxScreenPx === 'function') return window.__gameHooks.foxScreenPx();
  const s = window.__gameHooks.state();
  const cam = window.__opening.camera;
  cam.updateMatrixWorld();
  const a = cam.position.clone().set(s.pos[0], s.pos[1], s.pos[2]).project(cam);
  const b = cam.position.clone().set(s.pos[0], s.pos[1] + 0.6, s.pos[2]).project(cam);
  return a.z < 1 && b.z < 1 ? (Math.abs(b.y - a.y) * innerHeight) / 2 : 0;
}

/** longest run under the floor; returns a message when it exceeds maxSeconds, else null */
export function gate(samples, { dt, height = FOX_PX.refHeight, min = FOX_PX.min * (height / FOX_PX.refHeight), maxSeconds = FOX_PX.maxSeconds } = {}) {
  let run = 0, worst = 0;
  for (const px of samples) { run = px < min ? run + dt : 0; worst = Math.max(worst, run); }
  return worst > maxSeconds ? `fox under ${min.toFixed(0)} px on screen for ${worst.toFixed(1)} s` : null;
}

export function summary(samples) {
  const px = [...samples].sort((a, b) => a - b);
  return px.length ? { min: Math.round(px[0]), p10: Math.round(px[Math.floor(px.length * 0.1)]), median: Math.round(px[Math.floor(px.length / 2)]), frames: px.length } : null;
}
