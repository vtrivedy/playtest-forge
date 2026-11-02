// Continuous clip of the Scribe's Press played through (same route as press-probe.mjs, driven frame by frame from
// node so every 2nd sim step is a rendered frame → 30 fps mp4). One staged travel("press"); then stick/Space/Shift.
//   node tools/press-clip.mjs --out /tmp/press-clip [--port 5216] [--size 960x540]
// SwiftShader renders ~0.6 frames/s here (2211 frames ≈ 58 min): run it from a pinned worktree in the background; if
// it is cut short, encode the frames already written with the same ffmpeg line.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const out = path.resolve(arg('out', '/tmp/press-clip'));
const port = Number(arg('port', 5216));
const [W, H] = arg('size', '960x540').split('x').map(Number);
const framesDir = path.join(out, 'frames');
fs.rmSync(framesDir, { recursive: true, force: true });
fs.mkdirSync(framesDir, { recursive: true });
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
page.setDefaultTimeout(600000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://127.0.0.1:${port}/?fresh`, { waitUntil: 'domcontentloaded', timeout: 600000 });
await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });
let s = await page.evaluate(() => {
  const h = window.__gameHooks;
  h.setManual(true);
  h.travel('press');
  return h.advance(30, 1 / 60, false);
});
let f = 0;
let n = 0;
/** one sim step with this input; every 2nd step is rendered and saved */
async function step(stick, keys) {
  const render = f % 2 === 0;
  s = await page.evaluate(({ stick, keys, render }) => {
    const h = window.__gameHooks;
    if (stick) h.setStick(stick[0], stick[1]);
    else h.setStick(null);
    h.setKeys(keys);
    return h.advance(1, 1 / 60, render);
  }, { stick, keys, render });
  if (render) await page.screenshot({ path: path.join(framesDir, `f${String(n++).padStart(5, '0')}.jpg`), quality: 88 });
  f++;
}
const L = (lx, lz) => [-700 + lx, 85 + lz];
async function walk(to, r = 0.4, mag = 1, maxS = 20) {
  for (let i = 0; i < maxS * 60; i++) {
    const dx = to[0] - s.pos[0], dz = to[1] - s.pos[2], d = Math.hypot(dx, dz);
    if (d < r) break;
    await step([(dx / d) * mag, (dz / d) * mag], []);
  }
}
async function idle(frames) {
  for (let i = 0; i < frames; i++) await step(null, []);
}
async function breakAndRide(center, glideTo, holdS) {
  for (let i = 0; i < 14; i++) await step([0, -0.2], ['Space']);
  for (let i = 0; i < 3; i++) await step([0, -0.2], ['Space', 'ShiftLeft']);
  await idle(70);
  for (let i = 0; i < 240; i++) {
    const dx = center[0] - s.pos[0], dz = center[1] - s.pos[2], d = Math.hypot(dx, dz);
    if (d < 0.25) break;
    await step([(dx / d) * 0.5, (dz / d) * 0.5], []);
  }
  await idle(20);
  for (let i = 0; i < holdS * 60; i++) {
    const up = s.pos[1] < glideTo[2];
    const dx = glideTo[0] - s.pos[0], dz = glideTo[1] - s.pos[2], d = Math.hypot(dx, dz) || 1;
    await step(up ? null : [dx / d, dz / d], s.grounded && i > 30 ? [] : ['Space']);
    if (s.grounded && i > 30) break;
  }
  await idle(20);
}

await idle(90);
await walk(L(-20.6, 27.4), 0.3);
await idle(20);
await walk(L(-7.6, 29.8), 0.3);
await walk(L(-1, 21), 0.4);
await walk(L(0, 16.4), 0.3, 1, 3);
await idle(100);
await walk(L(0, -0.2), 0.3);
await walk(L(0, -1.0), 0.2, 0.3, 2);
await breakAndRide(L(0, -3.6), [...L(0, -9), 7.6], 8);
await walk(L(28.6, -10.5), 0.3);
await walk(L(16, -22.4), 0.3);
await walk(L(0, -17.2), 0.3);
await idle(80);
await walk(L(0, -14.4), 0.3);
await walk(L(0, -16.0), 0.25, 0.4);
await breakAndRide(L(0, -18.6), [...L(0, -24), 12.2], 8);
await idle(420);
const press = s.opening.press;
execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', '30', '-i', path.join(framesDir, 'f%05d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', path.join(out, 'press.mp4')]);
const summary = { frames: n, seconds: +(n / 30).toFixed(1), press, errors };
fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary));
await browser.close();
await server.close();
process.exit(0);
