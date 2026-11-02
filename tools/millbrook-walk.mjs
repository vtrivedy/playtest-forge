// Millbrook walk: village → sunken lane → mill → dash the leaf dam → watch the brook run → bridge →
// orchard → lookout, driven only by stick + Shift through __gameHooks (no mid-route teleports).
//   node tools/millbrook-walk.mjs --out /tmp/mw [--every 4] [--size 960x540] [--from village|lane|mill]
// Fixed 1/60 sim; renders a chase-cam jpg every `every` sim frames, encodes clip.mp4 at 60/every fps.
// Writes route.json (beats, timings, stuck spans, final __game state) before encoding.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const out = path.resolve(arg('out', '/tmp/millbrook-walk'));
const every = Number(arg('every', '4'));
const [W, H] = arg('size', '960x540').split('x').map(Number);
const from = arg('from', 'village');
const frames = path.join(out, 'frames');
fs.rmSync(frames, { recursive: true, force: true });
fs.mkdirSync(frames, { recursive: true });

// [beat, target xz | null, options]; hold = seconds standing; dash = Shift on arrival; until = state test
const ROUTE = [
  ['wake', null, { hold: 1.5 }],
  ['plaza west', [-12.5, 89.4]],
  ['cottage lane', [-18.7, 87.4]],
  ['west cottages', [-29.2, 87.6]],
  ['last cottage', [-35.5, 89.2]],
  ['into the lane', [-46, 90.4]],
  ['lane bend', [-55, 88.7]],
  ['lane mouth', [-63.5, 86.7]],
  ['valley opens', [-69.5, 87.6], { hold: 1.5 }],
  ['mill door', [-71.4, 91.4]],
  ['mill east wall', [-68.4, 92.0]],
  ['past the kiln', [-63.2, 95.0]],
  ['north of the mill', [-68.0, 100.6]],
  ['above the dam', [-71.6, 101.6], { hold: 1.0 }],
  ['dash the dam', [-75.2, 101.4], { dash: true, mag: 1 }],
  ['watch it run', null, { hold: 6.5 }],
  ['to the kiln', [-66.4, 97.4]],
  ['kiln waking', null, { hold: 4, until: 'kiln' }],
  ['onto the kiln', [-65.65, 96.14], { jump: true, mag: 0.4 }],
  ['ride the warm air', null, { lift: true }],
  ['glide to the weir', [-70.5, 106.3], { glide: true }],
  ['on the weir', null, { hold: 3 }],
  ['drop to the valley', [-67.6, 101.0], { glide: true }],
  ['east of the mill', [-67.4, 93.0]],
  ['to the bridge', [-70, 87.6]],
  ['bridge approach', [-75.0, 85.6]],
  ['bridge east', [-76.2, 86.0]],
  ['bridge west', [-81.8, 88.0]],
  ['off the bridge', [-83.2, 88.2]],
  ['orchard', [-88, 84.5]],
  ['foot of the hill', [-93.5, 80.5]],
  ['climb', [-95.5, 75.5]],
  ['lookout', [-97.9, 72.8]],
  ['the view', [-98.6, 72.4], { hold: 4, face: [-60, 84] }],
];
const START = {
  village: { at: [-5.2, 92.5, Math.atan2(2.2, -11.5)], beat: 0 },
  lane: { at: [-36, 89, -1.4], beat: 5 },
  mill: { at: [-69.5, 87.6, -0.4], beat: 9 },
  kiln: { at: [-66.4, 97.4, 0], beat: 18 },
}[from];

const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5195, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
page.setDefaultTimeout(600000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const log = { route: from, every, beats: [], stuck: [], errors };
try {
  await page.goto('http://127.0.0.1:5195/', { waitUntil: 'domcontentloaded', timeout: 300000 });
  await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });
  await page.evaluate((at) => {
    const h = window.__gameHooks;
    h.setManual(true);
    // silent visual probe: a live synth worklet would steal the 1-CPU box from the renderer
    h.audioContext?.()?.suspend?.();
    h.teleport(at[0], at[1], at[2]);
    h.advance(30, 1 / 60, false);
  }, START.at);
  let beat = START.beat;
  let held = 0;
  let frame = 0;
  let shot = 0;
  let lastProgress = { t: 0, d: Infinity };
  let stuckFrom = -1;
  const t0 = Date.now();
  while (beat < ROUTE.length && frame < 60 * 240) {
    const [name, to, o = {}] = ROUTE[beat];
    const render = frame % every === 0;
    const r = await page.evaluate(({ to, o, render, frame }) => {
      const h = window.__gameHooks;
      const s = h.state();
      const [x, y, z] = s.pos;
      const w = (window.__walk ??= { airborne: false, launchY: null });
      let arrived = false;
      if (o.lift) {
        // stay in the kiln column's core holding jump until the warm air has carried us high
        const k = s.opening.millWeir;
        const c = [-65.65, 96.14];
        w.launchY ??= y;
        const dx = c[0] - x;
        const dz = c[1] - z;
        const d = Math.hypot(dx, dz) || 1;
        const mag = Math.min(0.3, d * 0.7);
        h.setStick(dx / d * mag, dz / d * mag);
        h.setKeys(['Space']);
        h.advance(1, 1 / 60, render);
        arrived = y > w.launchY + 8.5 || (k && y > w.launchY + 5 && s.vel && s.vel[1] < 0.2);
        if (arrived) w.launchY = null;
        return { arrived, d: 0, pos: s.pos, frame, lift: true };
      }
      if (to) {
        const dx = to[0] - x;
        const dz = to[1] - z;
        const d = Math.hypot(dx, dz);
        if (o.glide) {
          if (!s.grounded) w.airborne = true;
          arrived = (w.airborne && s.grounded) || d < 0.9;
          if (arrived) w.airborne = false;
        } else arrived = d < (o.dash ? 1.2 : o.jump ? 1.7 : 0.9);
        const mag = o.mag ?? 1;
        h.setStick(dx / d * mag, dz / d * mag);
        h.setKeys(o.dash && d < 3.2 ? ['ShiftLeft'] : o.glide ? ['Space'] : []);
        h.advance(1, 1 / 60, render);
        return { arrived, d, pos: s.pos, frame };
      }
      if (o.until === 'kiln' && !s.opening.millWeir?.lit) {
        h.setStick(0, 0);
        h.setKeys([]);
        h.advance(1, 1 / 60, render);
        return { arrived: false, d: 0, pos: s.pos, frame, wait: true };
      }
      if (o.face) {
        const dx = o.face[0] - x;
        const dz = o.face[1] - z;
        const d = Math.hypot(dx, dz);
        h.setStick(dx / d * 0.05, dz / d * 0.05);
      } else h.setStick(0, 0);
      h.setKeys([]);
      h.advance(1, 1 / 60, render);
      return { arrived: false, d: 0, pos: s.pos, frame };
    }, { to, o, render, frame });
    if (render) {
      await page.screenshot({ path: path.join(frames, `f${String(shot).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 85 });
      shot++;
    }
    frame++;
    const t = frame / 60;
    if (to) {
      if (r.d < lastProgress.d - 0.3) lastProgress = { t, d: r.d };
      if (t - lastProgress.t > 3 && stuckFrom < 0) stuckFrom = t;
    }
    let advanceBeat = to || o.lift ? r.arrived : !r.wait && (held += 1 / 60) >= (o.hold ?? 0);
    if (r.wait && t - lastProgress.t > 30) advanceBeat = true;
    if (to && t - lastProgress.t > 12) advanceBeat = true; // give up on a blocked leg, but record it
    if (advanceBeat) {
      if (stuckFrom >= 0) log.stuck.push({ beat: name, from: stuckFrom, to: t });
      stuckFrom = -1;
      log.beats.push({ beat: name, t: Math.round(t * 100) / 100, pos: r.pos.map((v) => Math.round(v * 100) / 100), shot });
      console.log(name, t.toFixed(1), JSON.stringify(r.pos.map((v) => Math.round(v * 10) / 10)), `${((Date.now() - t0) / 1000).toFixed(0)}s wall`);
      beat++;
      held = 0;
      lastProgress = { t, d: Infinity };
    }
  }
  log.final = await page.evaluate(() => {
    const s = window.__gameHooks.state();
    return { pos: s.pos, millrace: s.opening.millrace, millWeir: s.opening.millWeir, restores: s.opening.restores };
  });
  log.simSeconds = frame / 60;
  fs.writeFileSync(path.join(out, 'route.json'), JSON.stringify(log, null, 1));
  console.log('final', JSON.stringify(log.final), 'stuck', JSON.stringify(log.stuck), 'errors', errors.length);
} finally {
  await browser.close();
  await server.close();
}
const ffmpeg = execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();
execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-framerate', String(60 / every), '-i', path.join(frames, 'f%05d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', path.join(out, 'clip.mp4')]);
console.log('clip', path.join(out, 'clip.mp4'));
