// Wall-slide feel clip: one staged placement beside a village house, then a diagonal stick push into its wall.
// Renders every 2nd sim step (30 fps) so the slide can be judged for skating; writes slide.mp4 + trace.json.
//   node tools/wall-slide-clip.mjs --out /tmp/wall-slide
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const out = path.resolve(arg('out', '/tmp/wall-slide'));
// --at x,z: start somewhere else (e.g. open ground, as the no-wall control for the same stick script)
const at = arg('at', '-21.9,87.6').split(',').map(Number);
const frames = path.join(out, 'frames');
fs.rmSync(frames, { recursive: true, force: true });
fs.mkdirSync(frames, { recursive: true });
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5213, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
page.setDefaultTimeout(600000);
await page.goto('http://127.0.0.1:5213/', { waitUntil: 'domcontentloaded', timeout: 600000 });
await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });
// west of the cottage at (-18, 84.6) (wall x = -20.55), facing it; then push 45° into the wall and south along it
await page.evaluate((at) => {
  const h = window.__gameHooks;
  h.setManual(true);
  h.teleport(at[0], at[1], Math.PI / 2);
  h.advance(60, 1 / 60, false);
}, at);
// --segs '[[frames,[sx,sz]],...]' overrides the default push script
const SEGS = JSON.parse(arg('segs', 'null')) ?? [
  [90, [0.7, -0.7]], // into the wall, down along it
  [60, [0.7, 0.7]], // back up along it
  [30, [-1, 0]], // away
];
const trace = [];
let n = 0;
for (const [count, [sx, sz]] of SEGS) {
  for (let f = 0; f < count; f++) {
    const render = f % 2 === 0;
    const s = await page.evaluate(({ sx, sz, render }) => {
      const h = window.__gameHooks;
      h.setStick(sx, sz);
      return h.advance(1, 1 / 60, render);
    }, { sx, sz, render });
    trace.push({ pos: s.pos, yaw: s.yaw, speed: s.speed, maxSlide: s.maxSlide, gait: s.gait });
    if (render) await page.screenshot({ path: path.join(frames, `f${String(n++).padStart(4, '0')}.jpg`), quality: 85 });
  }
}
fs.writeFileSync(path.join(out, 'trace.json'), JSON.stringify(trace));
execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', '30', '-i', path.join(frames, 'f%04d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', path.join(out, 'slide.mp4')]);
const moved = trace.slice(0, 90).map((t) => t.pos);
console.log(JSON.stringify({ out, frames: n, slideDistance: +Math.hypot(moved.at(-1)[0] - moved[20][0], moved.at(-1)[2] - moved[20][2]).toFixed(2), worstStanceSlide: Math.max(...trace.map((t) => t.maxSlide)) }));
await browser.close();
await server.close();
process.exit(0);
