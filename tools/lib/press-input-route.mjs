// Input sequence derived from Thistle's press-probe; no placement/progress hooks.
// Caller must arrive physically at the Press spawn; this is solvability, not blind discovery.
export async function playPressInputRoute(page, shot) {
const L = (lx, lz) => [-700 + lx, 85 + lz];
/** walk toward world [x, z] until within r (or max s) */
const walk = (to, o = {}) => page.evaluate(({ to, o }) => {
  const h = window.__gameHooks;
  let s = h.state();
  for (let f = 0; f < (o.max ?? 20) * 60; f++) {
    const dx = to[0] - s.pos[0], dz = to[1] - s.pos[2], d = Math.hypot(dx, dz);
    if (d < (o.r ?? 0.6)) break;
    h.setStick(dx / d * (o.mag ?? 1), dz / d * (o.mag ?? 1));
    h.setKeys([]);
    s = h.advance(1, 1 / 60, false);
  }
  h.setStick(null);
  return h.advance(10, 1 / 60, false);
}, { to, o });
/** jump toward `dir` and air-dash at the top (cracks a membrane), land, step back onto it, jump into the draft and
 *  hold glide straight up until `glideTo[2]`, then drift to [glideTo[0], glideTo[1]] */
const breakAndRide = (dir, center, glideTo, holdS) => page.evaluate(({ dir, center, glideTo, holdS }) => {
  const h = window.__gameHooks;
  let s;
  h.setStick(dir[0] * 0.2, dir[1] * 0.2);
  h.setKeys(['Space']);
  s = h.advance(14, 1 / 60, false);
  h.setKeys(['Space', 'ShiftLeft']);
  s = h.advance(3, 1 / 60, false);
  h.setStick(null);
  h.setKeys([]);
  s = h.advance(70, 1 / 60, false);
  for (let f = 0; f < 240; f++) {
    const dx = center[0] - s.pos[0], dz = center[1] - s.pos[2], d = Math.hypot(dx, dz);
    if (d < 0.25) break;
    h.setStick(dx / d * 0.5, dz / d * 0.5);
    s = h.advance(1, 1 / 60, false);
  }
  h.setStick(null);
  s = h.advance(20, 1 / 60, false);
  let peak = s.pos[1];
  h.setKeys(['Space']);
  for (let f = 0; f < holdS * 60; f++) {
    const up = s.pos[1] < glideTo[2];
    const dx = glideTo[0] - s.pos[0], dz = glideTo[1] - s.pos[2], d = Math.hypot(dx, dz) || 1;
    h.setStick(up ? null : dx / d, up ? 0 : dz / d);
    h.setKeys(s.grounded && f > 30 ? [] : ['Space']);
    s = h.advance(1, 1 / 60, false);
    peak = Math.max(peak, s.pos[1]);
    if (s.grounded && f > 30) break;
  }
  h.setStick(null);
  h.setKeys([]);
  s = h.advance(20, 1 / 60, false);
  return { ...s, peak };
}, { dir, center, glideTo, holdS });
await shot('00-spawn');
// the direct try: lit brazier → seal fades on the way (the puzzle's lesson), then the relay
await walk(L(-24.6, 29), { r: 0.3 });
await shot('01-brazier');
await walk(L(0, 18), { r: 0.4 });
await shot('01b-faded-at-seal');
const failedDirect = await page.evaluate(()=>window.__gameHooks.state().opening.press);
if(failedDirect.warm>0 || failedDirect.sealOpen)throw Error('Direct brazier-to-seal bypassed the relay puzzle');
await walk(L(-24.6, 29), { r: 0.3 });
await walk(L(-7.6, 29.8), { r: 0.3 });
await shot('01c-relay-lit');
if(!await page.evaluate(()=>window.__gameHooks.state().opening.press.lit[1]))throw Error('First warmth relay did not light');
await walk(L(-1, 21), { r: 0.4 });
await walk(L(0, 16.4), { r: 0.3, max: 3 });
await page.evaluate(() => window.__gameHooks.advance(100, 1 / 60, false));
await shot('02-seal-thawed');
await walk(L(0, 8), { r: 0.5 });
await shot('03-through-gate');
await walk(L(0, -0.2), { r: 0.3 });
await walk(L(0, -1.0), { r: 0.2, mag: 0.3, max: 2 });
await shot('04-before-membrane');
let s = await breakAndRide([0, -1], L(0, -3.6), [...L(0, -9), 7.6], 8);
console.log('ride1 peak', s.peak);
await shot('05-on-shelf');
await walk(L(28.6, -10.5), { r: 0.3 });
await shot('06-brazier-b');
await walk(L(16, -22.4), { r: 0.3 });
await shot('06b-relay-b');
if(!await page.evaluate(()=>window.__gameHooks.state().opening.press.lit[3]))throw Error('Second warmth relay did not light');
await walk(L(0, -17.2), { r: 0.3 });
await page.evaluate(() => window.__gameHooks.advance(80, 1 / 60, false));
await shot('07-ice-melted');
await walk(L(0, -14.4), { r: 0.3 });
await walk(L(0, -16.0), { r: 0.25, mag: 0.4 });
s = await breakAndRide([0, -1], L(0, -18.6), [...L(0, -24), 12.2], 8);
console.log('ride2 peak', s.peak);
await shot('08-ledge');
await page.evaluate(() => { const h = window.__gameHooks; h.setStick(0.6, 0.8); h.advance(40, 1 / 60, false); h.setStick(null); h.advance(60, 1 / 60, false); });
await shot('09-the-press');

const final = await page.evaluate(()=>window.__gameHooks.state());
if(final.opening.press.done.length!==3)throw Error('Physical Press input route did not restore all three levels');
const progress = final.opening.worlds.progress.worlds.press;
if(progress.ability!=='Inkstep' || progress.fill!==1 || progress.restored.length!==3)throw Error('Physical Press completion did not earn Inkstep and fill Maple');
await page.evaluate(()=>window.__gameHooks.advance(120,1/60,false));
await shot('10-scribe-hold');
await page.evaluate(()=>window.__gameHooks.advance(120,1/60,false));
await shot('11-scribe-coda');
await page.keyboard.press('Tab');
await shot('12-album');
await page.keyboard.press('Tab');
return final;
}
