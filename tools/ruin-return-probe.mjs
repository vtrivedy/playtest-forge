// Staged overlook entry; all subsequent movement is the shared real-input slice route.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { createSliceRoute } from './opening-hero-route.mjs';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const out = process.argv[2] || '/captures/rook/ruin-return-staged';
fs.mkdirSync(out, { recursive: true });
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5195, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.setDefaultTimeout(180000);
const errors = []; page.on('pageerror', e => errors.push(String(e)));
try {
  await page.goto('http://127.0.0.1:5195/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__gameHooks?.ready);
  await page.evaluate(source => {
    const h = window.__gameHooks; h.setManual(true); h.teleport(-25.14, 71.06, Math.PI / 2); h.setStick(0, 0);
    window.__returnProbe = { route: new Function(`return (${source})`)()('to the return fold'), state: h.advance(60, 1 / 60, false), f: 0, beat: '', trace: [] };
  }, createSliceRoute.toString());
  let shots = 0;
  for (;;) {
    const result = await page.evaluate(() => {
      const p = window.__returnProbe, h = window.__gameHooks;
      let label = '';
      for (let i = 0; i < 60 && p.f < 1200; i++, p.f++) {
        const input = p.route(p.f / 60, p.state), shot = input.beat !== p.beat;
        p.beat = input.beat; h.setStick(input.x, input.z); h.setKeys([...(input.jump ? ['Space'] : []), ...(input.dash ? ['ShiftLeft'] : [])]);
        p.state = h.advance(1, 1 / 60, shot);
        p.trace.push({ f: p.f, input, ...p.state });
        if (shot) { label = p.beat; p.f++; break; }
      }
      return { done: p.f >= 1200, label, f: p.f, pos: p.state.pos };
    });
    if (result.label) { console.log(result.f, result.label, result.pos); await page.screenshot({ path: `${out}/${String(++shots).padStart(2, '0')}-${result.label.replaceAll(' ', '-')}.png` }); }
    if (result.done) break;
  }
  const evidence = await page.evaluate(() => ({ trace: window.__returnProbe.trace, game: { mode: window.__game.mode, state: window.__game.state() } }));
  const t = evidence.trace, steps = t.filter(s => s.input.beat === 'onto the return steps');
  const checks = {
    returnOpened: evidence.game.state.opening.popUpRuin.returns === 1,
    stayedOnOverlook: t.filter(s => s.input.beat === 'unfold the way home').every(s => s.grounded && Math.abs(s.pos[1] - 1.02) < .04),
    reachedSteps: steps.length > 0,
    reachedMeadow: t.some(s => s.input.beat === 'back through the grove'),
    noErrors: errors.length === 0,
  };
  fs.writeFileSync(`${out}/evidence.json`, JSON.stringify({ sha, staging: 'Initial overlook position only; shared input route; no fold/state forcing. Not full-slice acceptance.', ...evidence, errors, checks }, null, 2));
  console.log(JSON.stringify(checks));
  if (Object.values(checks).some(v => !v)) process.exitCode = 1;
} finally { await browser.close(); await server.close(); }
