// Input sequence derived from tools/press-probe.mjs (keep the two in step); no placement/progress hooks.
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
  let s = h.advance(1, 1 / 60, false);
  if (dir) {
    h.setStick(dir[0] * 0.2, dir[1] * 0.2);
    h.setKeys(['Space']);
    s = h.advance(14, 1 / 60, false);
    h.setKeys(['Space', 'ShiftLeft']);
    s = h.advance(3, 1 / 60, false);
    h.setStick(null);
    h.setKeys([]);
    s = h.advance(70, 1 / 60, false);
  }
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
/** step into the draft at `center`, jump and hold glide to the crest, then air-dash south holding glide */
const inkstepFromCrest = (center) => page.evaluate((center) => {
  const h = window.__gameHooks;
  let s = h.advance(1, 1 / 60, false);
  for (let f = 0; f < 240; f++) {
    const dx = center[0] - s.pos[0], dz = center[1] - s.pos[2], d = Math.hypot(dx, dz);
    if (d < 0.25) break;
    h.setStick(dx / d * 0.5, dz / d * 0.5);
    s = h.advance(1, 1 / 60, false);
  }
  h.setStick(null);
  s = h.advance(20, 1 / 60, false);
  h.setKeys(['Space']);
  let best = s.pos[1];
  let still = 0;
  for (let f = 0; f < 240 && still < 8; f++) {
    s = h.advance(1, 1 / 60, false);
    if (s.pos[1] > best + 0.005) { best = s.pos[1]; still = 0; } else if (f > 20) still++;
  }
  h.setStick(0, -1);
  h.setKeys(['Space', 'ShiftLeft']);
  s = h.advance(4, 1 / 60, false);
  h.setKeys(['Space']);
  s = h.advance(50, 1 / 60, false);
  h.setStick(null);
  h.setKeys([]);
  return h.advance(40, 1 / 60, false);
}, center);
/** a running hop onto world [x, z]: steer there holding Space for the first 14 frames, until landed within 0.4 m */
const hop = (to) => page.evaluate((to) => {
  const h = window.__gameHooks;
  let s = h.state();
  for (let n = 0; n < 120; n++) {
    const dx = to[0] - s.pos[0], dz = to[1] - s.pos[2], d = Math.hypot(dx, dz);
    if (d < 0.4 && s.grounded && n > 14) break;
    const k = Math.min(1, d / 0.8);
    h.setStick(d > 0.05 ? (dx / d) * k : 0, d > 0.05 ? (dz / d) * k : 0);
    h.setKeys(n < 14 ? ['Space'] : []);
    s = h.advance(1, 1 / 60, false);
  }
  h.setStick(null);
  h.setKeys([]);
  return h.advance(6, 1 / 60, false);
}, to);
await shot('00-spawn');
// the direct try: lit brazier → seal fades on the way (the puzzle's lesson), then the relay
await walk(L(-20.6, 27.4), { r: 0.3 });
await shot('01-brazier');
await walk(L(0, 18), { r: 0.4 });
await shot('01b-faded-at-seal');
const failedDirect = await page.evaluate(()=>window.__gameHooks.state().opening.press);
if(failedDirect.warm>0 || failedDirect.sealOpen)throw Error('Direct brazier-to-seal bypassed the relay puzzle');
await walk(L(-20.6, 27.4), { r: 0.3 });
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
// Folded Archive (DESIGN-sumiro-play.md §2): the floor draft alone tops out under the shelf; an Inkstep from its crest
// tears the alcove's hanging membrane; the chimney behind it rises onto the shelf
let s = await breakAndRide([0, -1], L(0, -3.6), [...L(0, -3.6), 99], 3.2);
if (s.peak > s.opening.press.shelfTop - 0.5) throw Error('Floor draft alone reaches the shelf: the alcove Inkstep is bypassable');
s = await inkstepFromCrest(L(0, -3.6));
if (!s.opening.press.faceTorn) throw Error('Inkstep from the floor draft crest did not tear the alcove membrane');
await shot('04c-face-torn');
if (s.pos[1] < s.opening.press.sillTop - 0.3) s = await breakAndRide(null, L(0, -3.6), [...L(0, -7.3), s.opening.press.sillTop + 0.7], 6);
s = await breakAndRide(null, L(0, -7.3), [...L(0, -10.5), s.opening.press.shelfTop + 0.9], 8);
await shot('05-on-shelf');
const shelfY = s.pos[1];
// Wellspring Press (the Unpressed Stair): relay warmth, melt the ice, crack the short draft, ride it carrying warmth
// onto the pillar, the stair stands, climb it
await walk(L(28.6, -10.5), { r: 0.3 });
await shot('06-brazier-b');
await walk(L(14, -19.6), { r: 0.3 });
await shot('06b-relay-b');
if(!await page.evaluate(()=>window.__gameHooks.state().opening.press.lit[3]))throw Error('Second warmth relay did not light');
await walk(L(8.4, -11.2), { r: 0.3 });
await walk(L(5.6, -12.4), { r: 0.3 });
await page.evaluate(() => window.__gameHooks.advance(80, 1 / 60, false));
await shot('07-ice-melted');
await walk(L(4, -8.4), { r: 0.3 });
await walk(L(4, -10.6), { r: 0.2, mag: 0.4 });
await page.evaluate(() => {
  const h = window.__gameHooks;
  h.setStick(0, -0.2); h.setKeys(['Space']); h.advance(14, 1 / 60, false);
  h.setKeys(['Space', 'ShiftLeft']); h.advance(3, 1 / 60, false);
  h.setStick(null); h.setKeys([]); h.advance(70, 1 / 60, false);
});
s = await breakAndRide(null, L(4, -13.2), [...L(4, -20.6), shelfY + 4.0], 6);
if (s.opening.press.done.length === 3 || s.pos[1] > shelfY + 4.3) throw Error('Short draft alone reached the ledge');
await walk(L(8.4, -11.2), { r: 0.3 });
s = await breakAndRide(null, L(4, -13.2), [...L(4, -17), shelfY + 3.5], 6);
await page.evaluate(() => window.__gameHooks.advance(390, 1 / 60, false));
if(!await page.evaluate(()=>window.__gameHooks.state().opening.press.stair))throw Error('Warmth carried up the draft did not raise the stair');
await shot('08c-stair-stands');
await walk(L(0.6, -17.5), { r: 0.4, max: 4 });
await walk(L(-1.6, -12.6), { r: 0.4 });
await walk(L(-4.5, -10.4), { r: 0.3 });
for (let i = 0; i < 8; i++) s = await hop(L(-4.5, -11.2 - (i + 0.5) * 1.225));
s = await hop(L(-4.5, -22.6));
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
