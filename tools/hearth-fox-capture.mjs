// Hearth-fox lookdev stills + walk clip on SwiftShader 1280×720 (?lookdev=p0).
//
//   node tools/hearth-fox-capture.mjs                       # → /workspace/kit/sprints/redesign-s1/fox/
//   node tools/hearth-fox-capture.mjs --only close --out /tmp/fox
//   node tools/hearth-fox-capture.mjs --no-walk
//
// Stills: 01-fox-close (same shot/paint as P0 04-fox-close), 02-fox-profile, 03-fox-quarter, 04-fox-run.
// Walk: 30 fps deterministic frames → walk.mp4 + walk-sheet.png (ffmpeg).
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const port = Number(arg('port', '5188'));
const out = path.resolve(arg('out', '/workspace/kit/sprints/redesign-s1/fox'));
const only = arg('only', '');
const walk = !process.argv.includes("--no-walk") && (!only || only === "walk");
const walkSeconds = Number(arg('walk-seconds', '2.4'));
fs.mkdirSync(out, { recursive: true });

const server = await createServer({
  configFile: 'games/fox-spirit/vite.config.ts',
  server: { port, host: '127.0.0.1', strictPort: true },
  logLevel: 'error',
});
await server.listen();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
page.setDefaultTimeout(300000);
const errors = [];
page.on('pageerror', (e) => { errors.push(String(e)); console.log('PAGEERROR', String(e)); });
page.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); console.log('CONSERR', m.text()); } });

const STILLS = [
  { file: '01-fox-close.png', paint: 'half', shot: 'fox', clip: 'idle', t: 0.6 },
  { file: '02-fox-profile.png', paint: 'half', shot: 'foxProfile', clip: 'idle', t: 0.6 },
  { file: '03-fox-quarter.png', paint: 'half', shot: 'foxQuarter', clip: 'idle', t: 0.6 },
  { file: '04-fox-run.png', paint: 'half', shot: 'foxProfile', clip: 'run', t: 0.4 },
];

try {
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${port}/?lookdev=p0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window.__lookdevHooks?.ready === true, null, { timeout: 300000 });
  console.log(`lookdev ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  for (const s of STILLS) {
    if (only && !s.file.includes(only)) continue;
    await page.evaluate(({ paint, shot, clip, t }) => {
      const h = window.__lookdevHooks;
      h.setPaint(paint);
      h.setCamera(shot);
      h.setFoxClip(clip, false);
      h.advance(Math.round(t * 60), 1 / 60);
    }, s);
    await page.screenshot({ path: path.join(out, s.file) });
    console.log('wrote', s.file);
  }
  if (walk) {
    const dir = path.join(out, 'walk-frames');
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir);
    await page.evaluate(() => {
      const h = window.__lookdevHooks;
      h.setPaint('half');
      h.setCamera('foxWalk');
      h.setFoxClip('walk', true);
      h.advance(20, 1 / 60); // settle the crossfade before recording
    });
    const n = Math.round(walkSeconds * 30);
    const track = [];
    for (let i = 0; i < n; i++) {
      track.push(await page.evaluate(() => window.__lookdevHooks.advance(2, 1 / 60) && window.__lookdevHooks.fox.paws));
      await page.screenshot({ path: path.join(dir, `f${String(i).padStart(3, '0')}.png`) });
    }
    // skate metric: horizontal paw drift between consecutive frames while the paw is planted
    const metrics = {};
    for (const k of Object.keys(track[0])) {
      const ys = track.map((t) => t[k][1]);
      const floor = Math.min(...ys);
      let drift = 0, planted = 0, maxStep = 0;
      for (let i = 1; i < track.length; i++) {
        const [a, b] = [track[i - 1][k], track[i][k]];
        if (a[1] - floor < 0.008 && b[1] - floor < 0.008) {
          const d = Math.hypot(b[0] - a[0], b[2] - a[2]);
          drift += d; planted++; maxStep = Math.max(maxStep, d);
        }
      }
      metrics[k] = { plantedFrames: planted, meanSlipMmPerFrame: +((drift / Math.max(1, planted)) * 1000).toFixed(2), maxSlipMm: +(maxStep * 1000).toFixed(2), liftCm: +((Math.max(...ys) - floor) * 100).toFixed(1) };
    }
    const state = await page.evaluate(() => window.__lookdevHooks.fox);
    fs.writeFileSync(path.join(out, 'walk-metrics.json'), JSON.stringify({ speed: state.speed, frames: n, fps: 30, paws: metrics }, null, 2));
    console.log('walk metrics', JSON.stringify(metrics));
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', path.join(dir, 'f%03d.png'), '-pix_fmt', 'yuv420p', '-vcodec', 'libx264', '-crf', '20', path.join(out, 'walk.mp4')]);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(dir, 'f%03d.png'), '-vf', `select='not(mod(n\\,${Math.max(1, Math.floor(n / 8))}))',crop=1280:440:0:170,scale=640:-1,tile=2x4`, '-frames:v', '1', path.join(out, 'walk-sheet.png')]);
    console.log('wrote walk.mp4 + walk-sheet.png');
  }
} finally {
  await browser.close();
  await server.close();
}
if (errors.length) {
  console.log(`${errors.length} page error(s)`);
  process.exitCode = 1;
}
