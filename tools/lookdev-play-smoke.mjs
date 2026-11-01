// Smoke for the playable opening (default boot `/`): boot, drive a short route, jump, stills + state.
//
//   node tools/lookdev-play-smoke.mjs --out /path/to/dir
//
// SwiftShader 1280×720, manual clock (60 Hz sim). Writes NN-<beat>.png and trace.json (per-frame state).
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHeroRoute, HERO_START } from './lookdev-hero-route.mjs';
import { createOpeningRoute, OPENING_START } from './opening-hero-route.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const port = Number(arg('port', '5191'));
const out = path.resolve(arg('out', '/tmp/lookdev-play-smoke'));
// --hero: run the 30 s hero route sim-only (stills at beat changes) instead of the short beat list
const hero = process.argv.includes('--hero') || process.argv.includes('--video');
// --video: hero route rendered every 2nd sim step → frames/ + hero-30s.mp4 (30 fps, 1280×720) + manifest
const video = process.argv.includes('--video');
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
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
page.on('console', (m) => m.type() === 'error' && console.log('CONSERR', m.text()));

// beats: [label, frames, stick [x,z] world | null, keys, still?]
const ROUTE = [
  ['idle', 30, null, [], true],
  ['walk', 90, [0, -0.2], [], true],
  ['run', 120, [0, -1], [], true],
  ['jump', 14, [0, -1], ['Space'], true],
  ['air', 16, [0, -1], [], false],
  ['land', 30, [0, -1], [], true],
  ['turn', 60, [-1, -0.3], [], true],
  ['stop', 45, null, [], true],
];
const trace = [];
try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 300000 });
  await page.evaluate(() => window.__gameHooks.setManual(true));
  let n = 0;
  if (hero) {
    const opening = await page.evaluate(() => window.__game?.mode === 'opening');
    const seconds = Number(arg('route-seconds', opening ? '75' : '30'));
    const totalFrames = Math.round(seconds * 60);
    const route = opening ? createOpeningRoute() : createHeroRoute();
    let state = await page.evaluate((s) => {
      const h = window.__gameHooks;
      h.teleport(s.x, s.z, s.yaw);
      return h.advance(1, 1 / 60, false);
    }, opening ? OPENING_START : HERO_START);
    let beat = '';
    let touchdownF = -1;
    let apexCaptured = false;
    let clipF = -1;
    for (let f = 0; f < totalFrames; f++) {
      const input = route(f / 60, state);
      const prev = state;
      // extra stills: jump apex, 2 frames after touchdown
      if (prev.grounded) apexCaptured = false;
      const apex = !apexCaptured && !prev.grounded && prev.vel[1] > 0 && prev.vel[1] - 15 / 60 <= 0;
      if (apex) apexCaptured = true;
      const touch = touchdownF >= 0 && f === touchdownF + 2;
      const shot = input.beat !== beat || apex || touch;
      // 2 s run clip (30 fps) at the start of the loop back
      if (input.beat === 'loop back' && clipF < 0) clipF = f;
      const clipFrame = !video && clipF >= 0 && f - clipF < 120 && (f - clipF) % 2 === 0;
      const videoFrame = video && f % 2 === 1;
      beat = input.beat;
      state = await page.evaluate(
        ({ input, shot }) => {
          const h = window.__gameHooks;
          h.setStick(input.x, input.z);
          h.setKeys([...(input.jump ? ['Space'] : []), ...(input.dash ? ['ShiftLeft'] : [])]);
          return h.advance(1, 1 / 60, shot);
        },
        { input, shot: shot || clipFrame || videoFrame },
      );
      if (videoFrame) {
        fs.mkdirSync(path.join(out, 'frames'), { recursive: true });
        await page.screenshot({ path: path.join(out, 'frames', `f${String((f - 1) / 2).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 92 });
        if (f % 120 === 1) console.log('frame', (f - 1) / 2, `/ ${totalFrames / 2}`);
      }
      if (clipFrame) {
        fs.mkdirSync(path.join(out, 'run-clip'), { recursive: true });
        await page.screenshot({ path: path.join(out, 'run-clip', `f${String((f - clipF) / 2).padStart(3, '0')}.jpg`), type: 'jpeg', quality: 90 });
      }
      trace.push({ f, beat, input, ...state, paws: undefined });
      if (!prev.grounded && state.grounded) touchdownF = f;
      if (shot) {
        const tag = apex ? 'apex' : touch ? 'touchdown+2' : beat.replace(/ /g, '-');
        await page.screenshot({ path: path.join(out, `${String(++n).padStart(2, '0')}-${tag}.png`) });
        console.log(f, beat.padEnd(18), JSON.stringify({ pos: state.pos, speed: state.speed, anim: state.anim, gait: state.gait, lastJump: state.lastJump }));
      }
    }
    fs.writeFileSync(path.join(out, 'trace.json'), JSON.stringify(trace));
    if (opening) {
      const hearths = trace.flatMap(s => s.updraft?.hearths ?? s.hearth?.hearths ?? []);
      const shelf = trace.filter(s => s.grounded && Math.hypot(s.pos[0] - 13, s.pos[2] - 75.5) < 3);
      const summary = {
        seconds, frames: trace.length, finalBeat: beat,
        beats: [...new Set(trace.map(s => s.beat))],
        hearthLit: hearths.some(h => h.id === 'H-a' && h.heat > 0.9),
        glideFrames: trace.filter(s => s.gliding).length,
        peakFeetY: Math.max(...trace.map(s => s.pos[1])),
        shelfLanding: shelf.length ? shelf.at(-1).pos : null,
        dashesUsed: Math.max(...trace.map(s => s.dashesUsed ?? 0)),
        lastJump: state.lastJump,
        game: await page.evaluate(() => ({ mode: window.__game?.mode, state: window.__gameHooks.state() })),
      };
      fs.writeFileSync(path.join(out, 'opening-summary.json'), JSON.stringify(summary, null, 2));
      console.log('OPENING_SUMMARY', JSON.stringify(summary));
    }
    if (video) {
      execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', '30', '-i', path.join(out, 'frames/f%04d.jpg'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', path.join(out, opening ? 'opening-75s.mp4' : 'hero-30s.mp4')]);
      const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
      fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ sha: git('rev-parse', 'HEAD'), dirty: git('status', '--porcelain'), url: '/', route: opening ? 'tools/opening-hero-route.mjs' : 'tools/lookdev-hero-route.mjs', sim: '60 Hz manual clock, render every 2nd step', fps: 30, frames: totalFrames / 2, resolution: [1280, 720], renderer: 'SwiftShader' }, null, 2));
    }
    if (!video && clipF >= 0)
      execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', '30', '-i', path.join(out, 'run-clip/f%03d.jpg'), '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', path.join(out, 'run-clip.mp4')]);
    const slide = trace.filter((s) => s.anim === 'loco').map((s) => s.maxSlide);
    console.log('end', JSON.stringify(state.pos), 'maxSlide loco p95', slide.sort((a, b) => a - b)[Math.floor(slide.length * 0.95)]);
  }
  for (const [label, frames, stick, keys, still] of hero ? [] : ROUTE) {
    const states = await page.evaluate(
      ({ frames, stick, keys }) => {
        const h = window.__gameHooks;
        h.setStick(stick ? stick[0] : null, stick ? stick[1] : 0);
        h.setKeys(keys);
        const s = [];
        for (let i = 0; i < frames; i++) s.push(h.advance(1, 1 / 60, i === frames - 1));
        return s;
      },
      { frames, stick, keys },
    );
    for (const s of states) trace.push({ beat: label, ...s, paws: undefined });
    const last = states.at(-1);
    console.log(label.padEnd(6), JSON.stringify({ pos: last.pos, speed: last.speed, anim: last.anim, gait: last.gait, rate: last.playback, grounded: last.grounded, lastJump: last.lastJump }));
    if (still) await page.screenshot({ path: path.join(out, `${String(++n).padStart(2, '0')}-${label}.png`) });
  }
  fs.writeFileSync(path.join(out, 'trace.json'), JSON.stringify(trace));
  // opening art review: fixed cameras, paper and painted (quick mode only)
  const shots = hero ? [] : await page.evaluate(() => window.__gameHooks.shots ?? []);
  for (const name of shots)
    for (const paint of ['none', 'full']) {
      await page.evaluate(({ name, paint }) => window.__gameHooks.shot(name, paint), { name, paint });
      await page.screenshot({ path: path.join(out, `${String(++n).padStart(2, '0')}-shot-${name}-${paint}.png`) });
    }
} finally {
  await browser.close();
  await server.close();
}
