// Real game + authored input route. Only the initial wake position is staged.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { createSliceRoute, SLICE_START } from './opening-hero-route.mjs';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const arg = (k, d) => process.argv.includes(`--${k}`) ? process.argv[process.argv.indexOf(`--${k}`) + 1] : d;
const out = arg('out', '/captures/sorrel/page-motion');
const dt = Number(arg('dt', '0.016666666666666666'));
const seconds = Number(arg('seconds', '100'));
const replayPath = arg('replay', '');
const replay = replayPath ? JSON.parse(fs.readFileSync(replayPath, 'utf8')) : null;
const frames = arg('frames', '0') === '1';
const clipFrom = Number(arg('clip-from', '0'));
const clipTo = Number(arg('clip-to', '999'));
const fps = Number(arg('fps', '30'));
const [width, height] = arg('size', '480x270').split('x').map(Number);
fs.mkdirSync(`${out}/frames`, { recursive: true });
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5211, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width, height } });
page.setDefaultTimeout(180000);
const errors = []; page.on('pageerror', e => errors.push(String(e)));
try {
  await page.goto('http://127.0.0.1:5211/?manual=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__gameHooks?.ready);
  await page.evaluate(({ source, start, tape }) => {
    const h = window.__gameHooks;
    h.setManual(true); h.teleport(start.x, start.z, start.yaw);
    window.__pageProbe = { route: new Function(`return (${source})`)()(), state: h.advance(60, 1 / 60, false), f: 0, trace: [], tape, mismatches: [] };
  }, { source: createSliceRoute.toString(), start: SLICE_START, tape: replay?.trace ?? null });
  let image = 0, lastBeat = '', done = false;
  while (!done) {
    const r = await page.evaluate(({ dt, seconds, frames, clipFrom, clipTo, fps }) => {
      const p = window.__pageProbe, h = window.__gameHooks;
      let shot = false, beat = '';
      for (let i = 0; i < 60 && p.f * dt < seconds; i++) {
        const expected = p.tape?.[p.f];
        const input = expected?.input ?? p.route(p.f * dt, p.state);
        h.setStick(input.x, input.z); h.setKeys([...(input.jump ? ['Space'] : []), ...(input.dash ? ['ShiftLeft'] : [])]);
        const capture = frames && p.f * dt >= clipFrom && p.f * dt < clipTo && (input.beat === 'the page bolts' || input.beat === 'it flings away' || input.beat === 'leap to the overlook' || input.beat === 'catch it on the overlook' || input.beat === 'the page opens' || input.beat === 'colour rolls out');
        shot = capture && p.f % Math.max(1, Math.round(1 / (fps * dt))) === 0;
        p.state = h.advance(1, dt, shot);
        const s = p.state;
        if (expected && (JSON.stringify(s.opening.page) !== JSON.stringify(expected.opening.page) || JSON.stringify(s.pos) !== JSON.stringify(expected.pos))) {
          if (p.mismatches.length < 10) p.mismatches.push({ frame: p.f, expected: expected.opening.page, actual: s.opening.page, expectedFox: expected.pos, actualFox: s.pos });
        }
        p.trace.push({ frame: p.f++, input, pos: s.pos, vel: s.vel, grounded: s.grounded, dashesUsed: s.dashesUsed, lastJump: s.lastJump, lastDashDistance: s.lastDashDistance, camera: s.camera, opening: { page: s.opening.page } }); beat = input.beat;
        if (shot) break;
      }
      return { done: p.f * dt >= seconds, shot, beat, t: p.f * dt, catches: p.state.opening.page.catches };
    }, { dt, seconds, frames, clipFrom, clipTo, fps });
    if (r.beat !== lastBeat) { console.log(r.t.toFixed(2), r.beat, r.catches); lastBeat = r.beat; }
    if (r.shot) await page.screenshot({ path: `${out}/frames/f${String(image++).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 88 });
    done = r.done;
  }
  const evidence = await page.evaluate(() => ({ trace: window.__pageProbe.trace, mismatches: window.__pageProbe.mismatches, game: { mode: window.__game.mode, state: window.__game.state() } }));
  const checks = { deterministicReplay: !replay || evidence.mismatches.length === 0, catches: evidence.game.state.opening.page.catches === 3, kept: evidence.game.state.opening.page.phase === 'kept', noErrors: !errors.length, finite: evidence.trace.every(s => s.pos.every(Number.isFinite)) };
  fs.writeFileSync(`${out}/evidence.json`, JSON.stringify({ sha, dt, replay: replayPath || null, staging: 'Initial wake position only; game input route; no forced catches or midroute teleport.', frames: image, errors, checks, ...evidence }, null, 2));
  await page.evaluate(() => window.__gameHooks.advance(0, 0, true));
  await page.screenshot({ path: `${out}/final.png` });
  console.log(JSON.stringify(checks));
  if (Object.values(checks).some(v => !v)) process.exitCode = 1;
} finally { await browser.close(); await server.close(); }
