// Finale (DESIGN-finale.md) stills: settle the Keeping (dev release), park the fox by the Press cradle, force the
// finale and watch it through the fixed `press` / `hollow` lenses at each phase; then the chase cam.
//   node tools/finale-stills.mjs [outDir] [--clip] [--real]
// --clip: continuous 30 fps chase-cam frames over the whole sequence → clip.mp4 (motion review).
// --real: no force — carry the real ember from the root-hearth across the bridge, glide into the hollow, set it
//         in the cradle (scripted stick input after an explicit staged start on the terrace).
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const out = path.resolve(args[0] && !args[0].startsWith('--') ? args[0] : '/tmp/finale-stills');
const clip = args.includes('--clip');
fs.mkdirSync(out, { recursive: true });
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5196, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
page.setDefaultTimeout(600000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const log = [];
const save = () => fs.writeFileSync(path.join(out, 'log.json'), JSON.stringify({ log, errors }, null, 1));
try {
  await page.goto('http://127.0.0.1:5196/', { waitUntil: 'domcontentloaded', timeout: 300000 });
  await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });
  await page.keyboard.press('KeyM');
  const H = (fn, ...a) => page.evaluate(([fn, a]) => window.__gameHooks[fn](...a), [fn, a]);
  await H('setManual', true);
  const snap = async (name, lens) => {
    if (lens) await H('shot', lens);
    else await H('advance', 0, 1 / 60, true);
    await page.screenshot({ path: path.join(out, `${name}.png`) });
    const st = await page.evaluate(() => window.__gameHooks.state().opening.finale);
    log.push([name, st]);
    save();
  };
  await snap('00-hollow-sealed', 'hollow');
  await snap('01-press-sealed', 'press');
  // settle the Keeping (staged: dev release), then park the fox by the cradle facing the Press
  await page.evaluate(() => { const h = window.__gameHooks; h.keepingRelease(); h.advance(600, 1 / 60, false); });
  log.push(['keeping', await page.evaluate(() => window.__gameHooks.state().opening.keeping.phase)]);
  await page.evaluate(() => {
    const h = window.__gameHooks;
    h.teleport(20.0, 42.2, Math.PI + 0.3);
    h.advance(90, 1 / 60, false);
    h.finale();
  });
  const marks = [[1.5, 'warming'], [4.5, 'unbinding'], [7.5, 'open'], [10, 'released-a'], [13, 'released-b'], [17, 'released-c'], [21, 'snow-a'], [27, 'snow-b']];
  let t = 0;
  for (const [at, name] of marks) {
    const frames = Math.round((at - t) * 60);
    if (clip) {
      for (let i = 0; i < frames / 2; i++) {
        await H('advance', 2, 1 / 60, true);
        await page.screenshot({ path: path.join(out, `f${String(Math.round(t * 30) + i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 80 });
      }
    } else await H('advance', frames, 1 / 60, false);
    t = at;
    await snap(`${String(marks.findIndex((m) => m[1] === name) + 2).padStart(2, '0')}-${name}`, 'press');
  }
  await snap('20-hollow-after', 'hollow');
  await snap('21-chase');
  // rest: the fox stands still by the cradle → the card
  for (const [n, f] of [['22-card-a', 150], ['23-card-b', 240], ['24-card-c', 300], ['25-after', 420]]) {
    await H('advance', f, 1 / 60, false);
    await snap(n);
  }
  // a minute on: the first snow has settled over the hollow and the village
  await H('advance', 2400, 1 / 60, false);
  await snap('26-late-chase');
  await snap('27-late-press', 'press');
  await snap('28-late-hollow', 'hollow');
  await snap('29-late-hub', 'hub');
  if (clip) {
    const ff = (await import('imageio-ffmpeg').catch(() => null));
    const bin = ff?.get_ffmpeg_exe?.() ?? 'ffmpeg';
    execFileSync(bin, ['-y', '-v', 'error', '-framerate', '30', '-pattern_type', 'glob', '-i', path.join(out, 'f*.jpg'), '-pix_fmt', 'yuv420p', path.join(out, 'clip.mp4')]);
  }
} catch (e) {
  errors.push(String(e?.stack ?? e));
} finally {
  save();
  console.log(JSON.stringify({ errors, last: log[log.length - 1] }, null, 1));
  await browser.close();
  await server.close();
}
