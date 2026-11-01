// Runaway Page chase probe: a naive chaser (run straight at the page, dash when close) plays all three
// stages through live input; records time-to-catch, skips, dashes and stills per beat.
//   node tools/page-chase-probe.mjs --out /tmp/page-chase [--dash-at 2.2]
// Staged: stage 2/3 starts teleport the fox near the stage (the walk between stages is not the test).
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const out = path.resolve(arg('out', '/tmp/page-chase'));
const dashAt = Number(arg('dash-at', '2.2'));
// --clip N: also render stage N's chase every 2nd frame into clipN/ + clipN.mp4 (30 fps)
const clip = Number(arg('clip', '-1'));
fs.mkdirSync(out, { recursive: true });
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5201, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
page.setDefaultTimeout(600000);
const evidence = { staging: 'stage starts teleport the fox ~7 m from the page; chasing is stick + Shift only', dashAt, stages: [], errors: [] };
page.on('pageerror', (e) => evidence.errors.push(String(e)));
await page.goto('http://127.0.0.1:5201/', { timeout: 300000 });
await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });
await page.evaluate(() => window.__gameHooks.setManual(true));
const STARTS = [[-6, 92.5], [2, 76], [-24, 75]];
async function clipStage(stage) {
  const dir = path.join(out, `clip${stage + 1}`);
  fs.mkdirSync(dir, { recursive: true });
  await page.evaluate(({ stage, start }) => { const h = window.__gameHooks; h.pageStage(stage); h.teleport(start[0], start[1], 0); h.advance(30, 1 / 60, false); }, { stage, start: STARTS[stage] });
  for (let f = 0, n = 0; f < 60 * 12; f++) {
    const done = await page.evaluate(({ f, dashAt }) => {
      const h = window.__gameHooks;
      const s = h.state();
      const p = s.opening.page;
      const dx = p.pos[0] - s.pos[0], dz = p.pos[2] - s.pos[2], d = Math.hypot(dx, dz);
      h.setStick(dx / (d || 1), dz / (d || 1));
      h.setKeys(d < dashAt && !s.dashing && f % 10 === 0 ? ['ShiftLeft'] : []);
      const r = h.advance(1, 1 / 60, f % 2 === 0);
      return r.opening.page.phase === 'flung' && r.opening.page.stage > 0 && f > 60 ? r.opening.page : null;
    }, { f, dashAt });
    if (f % 2 === 0) await page.screenshot({ path: path.join(dir, `f${String(n++).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 88 });
    if (done && f > 200) break;
  }
  await page.evaluate(() => { const h = window.__gameHooks; h.setStick(null); h.setKeys([]); });
  const { execFileSync } = await import('node:child_process');
  try { execFileSync('which', ['ffmpeg']); } catch { return; }
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', '30', '-i', path.join(dir, 'f%04d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', path.join(out, `clip${stage + 1}.mp4`)]);
}
if (clip >= 0) await clipStage(clip);
for (let stage = 0; stage < 3; stage++) {
  const r = await page.evaluate(({ stage, start, dashAt }) => {
    const h = window.__gameHooks;
    h.pageStage(stage);
    h.teleport(start[0], start[1], 0);
    let s = h.advance(30, 1 / 60, false);
    const before = s.opening.page.catches;
    let dashes = 0, f = 0, minD = 99;
    const trail = [];
    for (; f < 60 * 60; f++) {
      const p = s.opening.page;
      if (p.catches > before) break;
      const dx = p.pos[0] - s.pos[0], dz = p.pos[2] - s.pos[2], d = Math.hypot(dx, dz);
      minD = Math.min(minD, d);
      h.setStick(dx / (d || 1), dz / (d || 1));
      const dash = d < dashAt && !s.dashing && f % 10 === 0;
      if (dash) dashes++;
      h.setKeys(dash ? ['ShiftLeft'] : []);
      s = h.advance(1, 1 / 60, false);
      if (f % 30 === 0) trail.push({ f, d: +d.toFixed(2), phase: p.phase });
    }
    h.setStick(null);
    h.setKeys([]);
    return { stage, seconds: +(f / 60).toFixed(2), caught: s.opening.page.catches > before, dashes, skips: s.opening.page.skips, minD: +minD.toFixed(2), phase: s.opening.page.phase, trail };
  }, { stage, start: STARTS[stage], dashAt });
  evidence.stages.push(r);
  console.log(JSON.stringify({ ...r, trail: undefined }));
  await page.evaluate(() => window.__gameHooks.advance(50, 1 / 60, true));
  await page.screenshot({ path: path.join(out, `stage${stage + 1}-caught+50f.png`) });
}
await page.evaluate(() => window.__gameHooks.advance(120, 1 / 60, true));
await page.screenshot({ path: path.join(out, 'kept+170f.png') });
await page.evaluate(() => window.__gameHooks.advance(240, 1 / 60, true));
await page.screenshot({ path: path.join(out, 'kept-wash.png') });
evidence.final = await page.evaluate(() => window.__gameHooks.state().opening.page);
fs.writeFileSync(path.join(out, 'evidence.json'), JSON.stringify(evidence, null, 2));
await browser.close();
await server.close();
