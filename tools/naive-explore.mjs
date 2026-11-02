// Naive wander: a player with no route knowledge. Forward-biased world-space heading, a turn + jump when
// actually stuck, rare random jumps / dashes. Seeded (mulberry32) so a run replays from the same inputs.
// Scores discovery from game state (page catches, regions) and measures how often the fox is truly stuck.
//
//   node tools/naive-explore.mjs --seconds 90 --seed 1 --out /tmp/naive [--frames 1] [--legacy-stuck] [--tether 14]
//
// Stuck = commanded to move but travelled < STUCK_FRAC of the stick's expected distance over the last 1 s.
// The seed version (/swarm/seed/naive-explore.mjs) flagged stuck below 0.08 m per 1/60 s step = 4.8 m/s,
// faster than PLAY.runSpeed (3.2 m/s), so it "unstuck" every 0.75 s whatever the fox did (≈120 per 90 s).
// --legacy-stuck reproduces that test for comparison.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const out = path.resolve(arg('out', '/tmp/naive'));
const seconds = Number(arg('seconds', 90));
const seed = Number(arg('seed', 1));
const framesHz = Number(arg('frames', 1)); // screenshots per sim second (0 = none)
const port = Number(arg('port', 5211));
const legacy = process.argv.includes('--legacy-stuck');
// --tether R: a well-plaza wander (the review's village stuck test): past R m from the Great Well, steer home
const tether = Number(arg('tether', 0));
const framesDir = path.join(out, 'frames');
fs.rmSync(framesDir, { recursive: true, force: true });
fs.mkdirSync(framesDir, { recursive: true });

const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
page.setDefaultTimeout(600000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 600000 });
await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });

// the whole policy lives in the page: one evaluate per chunk keeps a 90 s run fast and the RNG stream exact
await page.evaluate(({ seed, legacy, tether }) => {
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const RUN = 3.2, MAG = 0.85, WIN = 60, STUCK_FRAC = 0.15;
  const hist = new Float64Array(WIN * 2);
  const W = {
    step: 0, heading: Math.PI, stuckFor: 0, stuck: false, legacyStuck: 0, last: null,
    unsticks: 0, stuckFrames: 0, events: [], path: [],
    disc: { catches: 0, stageMax: 0, kept: false, overlookMin: Infinity, overlook: false, millbrook: false, hermitage: false, pressHollow: false, leftVillage: false, captions: [] },
  };
  window.__naive = W;
  W.run = (n) => {
    const h = window.__gameHooks;
    let s = h.state();
    for (let i = 0; i < n; i++, W.step++) {
      const [x, y, z] = s.pos;
      const k = W.step % WIN;
      // rolling 1 s displacement (only judged once the window is full)
      const ox = hist[k * 2], oz = hist[k * 2 + 1];
      hist[k * 2] = x;
      hist[k * 2 + 1] = z;
      let trigger = false;
      if (legacy) {
        if (W.last) W.legacyStuck = Math.hypot(x - W.last[0], z - W.last[1]) < 0.08 ? W.legacyStuck + 1 : 0;
        W.stuckFor = W.legacyStuck;
        if (W.legacyStuck > 45) trigger = true;
      } else if (W.step >= WIN) {
        const moved = Math.hypot(x - ox, z - oz);
        const nowStuck = moved < RUN * MAG * STUCK_FRAC; // < 0.41 m in 1 s while pushing the stick
        if (nowStuck) W.stuckFrames++;
        W.stuckFor = nowStuck ? W.stuckFor + 1 : 0;
        // fire on entering stuck, then again every further stuck second (a pinned fox keeps trying)
        if (nowStuck && (!W.stuck || W.stuckFor % WIN === 0)) trigger = true;
        W.stuck = nowStuck;
      }
      W.last = [x, z];
      if (trigger) {
        W.unsticks++;
        W.heading += (rand() > 0.5 ? 1 : -1) * (0.6 + rand());
        W.legacyStuck = 0;
        W.events.push({ t: +(W.step / 60).toFixed(2), x: +x.toFixed(2), y: +y.toFixed(2), z: +z.toFixed(2) });
      } else if (rand() < 0.002) W.heading += (rand() - 0.5) * 0.8;
      if (trigger) W.lastTurn = W.step;
      if (tether > 0 && W.step - (W.lastTurn ?? -1e9) > 120 && Math.hypot(x + 8, z - 85) > tether) {
        const home = Math.atan2(-8 - x, 85 - z);
        const d = home - W.heading;
        W.heading += Math.atan2(Math.sin(d), Math.cos(d)) * 0.05;
      }

      const op = s.opening;
      const pg = op?.page;
      if (pg) {
        W.disc.catches = Math.max(W.disc.catches, pg.catches ?? 0);
        W.disc.stageMax = Math.max(W.disc.stageMax, pg.stage ?? 0);
        if (pg.phase === 'kept') W.disc.kept = true;
      }
      const cap = op?.captions?.showing ?? op?.finale?.caption ?? null;
      if (typeof cap === 'string' && !W.disc.captions.includes(cap)) W.disc.captions.push(cap);
      const dOver = Math.hypot(x + 24.4, z - 71);
      W.disc.overlookMin = Math.min(W.disc.overlookMin, dOver);
      if (dOver < 2.5 && y > 0.6) W.disc.overlook = true;
      if (x < -60 && z > 70 && z < 120) W.disc.millbrook = true;
      if (z > 120) W.disc.hermitage = true;
      if (z < 50 && x > 10 && x < 35) W.disc.pressHollow = true;
      if (Math.hypot(x + 8, z - 85) > 22) W.disc.leftVillage = true;
      if (W.step % 30 === 0) W.path.push([+x.toFixed(1), +z.toFixed(1)]);

      const jump = W.stuckFor > 20 || rand() < 0.004;
      const dash = rand() < 0.003;
      h.setStick(Math.sin(W.heading) * MAG, Math.cos(W.heading) * MAG);
      h.setKeys(jump && dash ? ['Space', 'ShiftLeft'] : jump ? ['Space'] : dash ? ['ShiftLeft'] : []);
      s = h.advance(1, 1 / 60, false);
    }
    return { t: W.step / 60, pos: s.pos, unsticks: W.unsticks, disc: W.disc };
  };
}, { seed, legacy, tether });

const steps = Math.round(seconds * 60);
const chunk = framesHz > 0 ? Math.max(1, Math.round(60 / framesHz)) : 600;
let frame = 0;
for (let done = 0; done < steps; done += chunk) {
  const r = await page.evaluate((n) => window.__naive.run(n), Math.min(chunk, steps - done));
  if (framesHz > 0) {
    await page.evaluate(() => window.__gameHooks.advance(0, 1 / 60, true));
    await page.screenshot({ path: path.join(framesDir, `f${String(frame++).padStart(5, '0')}.jpg`), quality: 72 });
  }
  if (Math.round(r.t) % 10 === 0) console.error(`t=${r.t.toFixed(1)} pos=(${r.pos[0].toFixed(1)},${r.pos[2].toFixed(1)}) unsticks=${r.unsticks} catches=${r.disc.catches} overlookMin=${r.disc.overlookMin.toFixed(1)}`);
}
const W = await page.evaluate(() => {
  const h = window.__gameHooks;
  h.setStick(null);
  h.setKeys([]);
  const w = window.__naive;
  return { unsticks: w.unsticks, stuckSeconds: +(w.stuckFrames / 60).toFixed(2), events: w.events, path: w.path, disc: w.disc, final: h.state().pos };
});
const result = { seconds, seed, tether, stuckTest: legacy ? 'legacy (<0.08 m/step for 45 steps)' : '1 s window < 15% of stick travel', ...W, errors };
fs.writeFileSync(path.join(out, 'naive.json'), JSON.stringify(result, null, 2));
if (frame > 1) {
  try {
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(Math.min(30, framesHz * 4)), '-i', path.join(framesDir, 'f%05d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', path.join(out, 'naive.mp4')]);
  } catch (e) {
    console.error('encode failed', e.message);
  }
}
const { events, path: _p, ...summary } = result;
console.log(JSON.stringify(summary, null, 2));
await browser.close();
await server.close();
process.exit(0);
