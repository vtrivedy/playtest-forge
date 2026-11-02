// Finale route with real input (DESIGN-finale.md). STAGED start: the Keeping is settled with the dev release, the fox
// is teleported to the ember on the shelf (E picks it up for real) and then onto the far crag carrying it. From there
// every step is live controller input: run off the crag's south lip holding jump → glide into Press Hollow → walk to
// the cradle → E sets the ember down → the finale plays; then rest, and finally walk out of the hollow to the meadow.
//   node tools/finale-route.mjs [outDir] [--clip]
// Writes trace.json (per-frame pos / grounded / gliding / carried / finale phase) before any video encoding.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const out = path.resolve(args[0] && !args[0].startsWith('--') ? args[0] : '/tmp/finale-route');
const clip = args.includes('--clip');
fs.mkdirSync(out, { recursive: true });
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5197, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
page.setDefaultTimeout(600000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const trace = [];
const notes = [];
let frame = 0;
const save = () => fs.writeFileSync(path.join(out, 'trace.json'), JSON.stringify({ notes, errors, trace }, null, 0));
try {
  await page.goto('http://127.0.0.1:5197/', { waitUntil: 'domcontentloaded', timeout: 300000 });
  await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });
  await page.keyboard.press('KeyM');
  // staged: settle the Keeping, pick up the ember on the shelf, stand on the far crag facing the vista
  notes.push(['staged', await page.evaluate(() => {
    const h = window.__gameHooks;
    h.setManual(true);
    h.keepingRelease();
    h.advance(600, 1 / 60, false);
    const c = h.state().opening.carry.position;
    h.teleport(c[0] + 0.5, c[2] + 0.4, Math.PI);
    h.advance(10, 1 / 60, false);
    h.setKeys(['KeyE']);
    h.advance(2, 1 / 60, false);
    h.setKeys([]);
    const carried = h.state().opening.carry.carried;
    h.teleport(25.6, 63.8, Math.PI);
    h.advance(30, 1 / 60, false);
    const s = h.state();
    return { carried, keeping: s.opening.keeping.phase, pos: s.pos, finale: s.opening.finale.phase };
  })]);
  // live input legs: [target x, z, keys, until]; the stick points at the target (unit, world-relative)
  const legs = [
    // run south off the crag lip and hold jump the whole way down: glide
    { to: [21.4, 46], keys: ['Space'], jumpAt: 0.9, until: (s) => s.grounded && s.pos[1] < 3, max: 600 },
    // walk to the cradle (stops short; E sets the ember in the bowl ahead of the feet)
    { to: [21.2, 39.75], keys: [], until: (s, d) => d < 0.35, max: 900 },
    { to: null, keys: ['KeyE'], until: () => true, max: 2 },
    // rest by the cradle while the finale plays to the card and past it
    { to: null, keys: [], until: (s) => s.opening.finale.card === 'done', max: 60 * 60 },
    // walk out of the hollow back into the meadow
    { to: [14.5, 50], keys: [], until: (s, d) => d < 0.8, max: 900 },
    { to: [11.5, 58], keys: [], until: (s, d) => d < 0.8, max: 900 },
    { to: [6, 66], keys: [], until: (s, d) => d < 0.8, max: 900 },
  ];
  for (const [li, leg] of legs.entries()) {
    let done = false;
    for (let n = 0; n < leg.max && !done; n += 2) {
      const r = await page.evaluate(([leg, n]) => {
        const h = window.__gameHooks;
        let s = h.state();
        let d = 0;
        if (leg.to) {
          const dx = leg.to[0] - s.pos[0], dz = leg.to[1] - s.pos[2];
          d = Math.hypot(dx, dz);
          h.setStick(dx / d, dz / d);
        } else h.setStick(null);
        const keys = leg.jumpAt != null && n < leg.jumpAt * 60 ? [] : leg.keys;
        h.setKeys(keys);
        s = h.advance(2, 1 / 60, false);
        return { s: { pos: s.pos, grounded: s.grounded, gliding: s.gliding, speed: s.speed, opening: { carry: { carried: s.opening.carry.carried, position: s.opening.carry.position }, finale: s.opening.finale } }, d };
      }, [{ to: leg.to, keys: leg.keys, jumpAt: leg.jumpAt }, n]);
      frame += 2;
      const s = r.s;
      trace.push([frame, li, s.pos.map((v) => +v.toFixed(3)), s.grounded, s.gliding, s.opening.carry.carried, s.opening.finale.phase, s.opening.finale.card]);
      if (clip) {
        await page.evaluate(() => window.__gameHooks.advance(0, 1 / 60, true));
        await page.screenshot({ path: path.join(out, `f${String(frame / 2).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 80 });
      }
      done = leg.until({ ...s, grounded: s.grounded }, r.d);
    }
    notes.push([`leg${li}`, { done, frame, last: trace[trace.length - 1] }]);
    save();
    if (!done) throw new Error(`leg ${li} did not complete`);
  }
  await page.evaluate(() => window.__gameHooks.setStick(null));
  if (clip) {
    const ff = await import('imageio-ffmpeg').catch(() => null);
    const bin = ff?.get_ffmpeg_exe?.() ?? 'ffmpeg';
    execFileSync(bin, ['-y', '-v', 'error', '-framerate', '30', '-pattern_type', 'glob', '-i', path.join(out, 'f*.jpg'), '-pix_fmt', 'yuv420p', path.join(out, 'route.mp4')]);
  }
} catch (e) {
  errors.push(String(e?.stack ?? e));
} finally {
  save();
  console.log(JSON.stringify({ errors, notes }, null, 1));
  await browser.close();
  await server.close();
}
