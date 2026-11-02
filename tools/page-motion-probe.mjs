// Real game + authored input route. Only the initial wake position is staged.
import { chromium } from 'playwright';
import { createServer, preview } from 'vite';
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
const production = arg('production', '0') === '1';
const variants = arg('variants', '0') === '1';
const clipFrom = Number(arg('clip-from', '0'));
const clipTo = Number(arg('clip-to', '999'));
const fps = Number(arg('fps', '30'));
const [width, height] = arg('size', '480x270').split('x').map(Number);
fs.mkdirSync(`${out}/frames`, { recursive: true });
fs.writeFileSync(`${out}/trace.partial.jsonl`, '');
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const server = production
  ? await preview({ configFile: 'games/fox-spirit/vite.config.ts', preview: { port: 5211, host: '127.0.0.1', strictPort: true }, logLevel: 'error' })
  : await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5211, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
if (!production) await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width, height } });
page.setDefaultTimeout(180000);
const errors = []; page.on('pageerror', e => errors.push(String(e)));
page.on('requestfailed', request => errors.push(`request ${request.url()}: ${request.failure()?.errorText}`));
page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`); });
try {
  await page.goto('http://127.0.0.1:5211/?manual=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__gameHooks?.ready);
  await page.evaluate(({ source, start, tape }) => {
    const h = window.__gameHooks;
    h.setManual(true); h.teleport(start.x, start.z, start.yaw);
    window.__pageProbe = { route: new Function(`return (${source})`)()(), state: h.advance(60, 1 / 60, false), f: 0, trace: [], tape, mismatches: [], keptStart: null, visual: [], sent: 0 };
  }, { source: createSliceRoute.toString(), start: SLICE_START, tape: replay?.trace ?? null });
  let image = 0, lastBeat = '', done = false;
  while (!done) {
    const r = await page.evaluate(({ dt, seconds, frames, clipFrom, clipTo, fps }) => {
      const p = window.__pageProbe, h = window.__gameHooks;
      let shot = false, beat = '';
      for (let i = 0; i < 60 && p.f * dt < seconds; i++) {
        const expected = p.tape?.[p.f];
        if (p.tape && !expected) throw new Error(`Replay tape ended at frame ${p.f}`);
        const input = expected?.input ?? p.route(p.f * dt, p.state);
        h.setStick(input.x, input.z); h.setKeys([...(input.jump ? ['Space'] : []), ...(input.dash ? ['ShiftLeft'] : [])]);
        const capture = frames && p.f * dt >= clipFrom && p.f * dt < clipTo && (input.beat === 'the page bolts' || input.beat === 'it flings away' || input.beat === 'leap to the overlook' || input.beat === 'catch it on the overlook' || input.beat === 'the page opens' || input.beat === 'colour rolls out');
        shot = capture && p.f % Math.max(1, Math.round(1 / (fps * dt))) === 0;
        p.state = h.advance(1, dt, shot);
        const s = p.state;
        if (shot && s.opening.page.phase === 'kept') {
          const holder = window.__opening.ctx.scene.getObjectByName('runaway-page');
          const sheet = holder.children[0].children.find(o => o.material?.map?.image?.width === 192);
          if (holder.visible && sheet.material.opacity > 0.05) {
            holder.updateMatrixWorld(true);
            const camera = window.__opening.camera, v = camera.position.clone(), vertices = sheet.geometry.getAttribute('position');
            let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
            for (let j=0;j<vertices.count;j++) {
              v.set(vertices.getX(j),vertices.getY(j),vertices.getZ(j));sheet.localToWorld(v);v.project(camera);
              minX=Math.min(minX,v.x);maxX=Math.max(maxX,v.x);minY=Math.min(minY,v.y);maxY=Math.max(maxY,v.y);
            }
            p.visual.push({frame:p.f,minX,maxX,minY,maxY,inFrame:minX>-.97&&maxX<.97&&minY>-.97&&maxY<.97});
          }
        }
        if (!p.keptStart && s.opening.page.phase === 'kept') p.keptStart = { page: s.opening.page.pos, fox: s.pos };
        if (expected && (JSON.stringify(s.opening.page) !== JSON.stringify(expected.opening.page) || JSON.stringify(s.pos) !== JSON.stringify(expected.pos))) {
          if (p.mismatches.length < 10) p.mismatches.push({ frame: p.f, expected: expected.opening.page, actual: s.opening.page, expectedFox: expected.pos, actualFox: s.pos });
        }
        p.trace.push({ frame: p.f++, input, pos: s.pos, vel: s.vel, grounded: s.grounded, dashesUsed: s.dashesUsed, lastJump: s.lastJump, lastDashDistance: s.lastDashDistance, camera: s.camera, opening: { page: s.opening.page } }); beat = input.beat;
        if (shot) break;
      }
      const records = p.trace.slice(p.sent); p.sent = p.trace.length;
      return { done: p.f * dt >= seconds, shot, beat, t: p.f * dt, catches: p.state.opening.page.catches, state: p.state, records };
    }, { dt, seconds, frames, clipFrom, clipTo, fps });
    fs.appendFileSync(`${out}/trace.partial.jsonl`, r.records.map(row => JSON.stringify(row)).join('\n') + '\n');
    fs.writeFileSync(`${out}/checkpoint.tmp`, JSON.stringify({ complete: false, sha, dt, production, images: image, seconds: r.t, state: r.state }));
    fs.renameSync(`${out}/checkpoint.tmp`, `${out}/checkpoint.json`);
    if (r.beat !== lastBeat) { console.log(r.t.toFixed(2), r.beat, r.catches); lastBeat = r.beat; }
    if (r.shot) await page.screenshot({ path: `${out}/frames/f${String(image++).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 88 });
    done = r.done;
  }
  const evidence = await page.evaluate(() => ({ trace: window.__pageProbe.trace, keptStart: window.__pageProbe.keptStart, visual: window.__pageProbe.visual, mismatches: window.__pageProbe.mismatches, game: { mode: window.__game.mode, state: window.__game.state() } }));
  const checks = {
    catches: evidence.game.state.opening.page.catches === 3,
    kept: evidence.game.state.opening.page.phase === 'kept',
    noErrors: !errors.length,
    finite: evidence.trace.every(s => s.pos.every(Number.isFinite) && s.opening.page.pos.every(Number.isFinite) && Number.isFinite(s.opening.page.yaw)),
  };
  if (seconds >= 80) checks.returnedHome = evidence.game.state.opening.homecoming.pinned === true;
  if (replay) checks.deterministicReplay = evidence.mismatches.length === 0;
  if (evidence.visual.length) checks.revealFramed = evidence.visual.every(s => s.inFrame);
  fs.writeFileSync(`${out}/evidence.tmp`, JSON.stringify({ sha, dt, runtime: production ? 'vite-production-preview' : 'vite-dev', replay: replayPath || null, staging: 'Initial wake position only; game input route; no forced catches or midroute teleport.', frames: image, errors, checks, ...evidence }, null, 2));
  fs.renameSync(`${out}/evidence.tmp`, `${out}/evidence.json`);
  fs.renameSync(`${out}/trace.partial.jsonl`, `${out}/trace.jsonl`);
  await page.evaluate(() => window.__gameHooks.advance(0, 0, true));
  await page.screenshot({ path: `${out}/final.png` });
  if (variants) {
    const reports = [];
    for (const variant of [{ name: 'low-wide', height: 1.0, scale: 1.4 }, { name: 'middle', height: 1.2, scale: 1.25 }, { name: 'high-small', height: 1.35, scale: 1.15 }]) {
      const report = await page.evaluate(variant => {
        const ctx = window.__opening.ctx, camera = window.__opening.camera, start = window.__pageProbe.keptStart;
        const holder = ctx.scene.getObjectByName('runaway-page');
        const body = holder.children[0], sheet = body.children.find(o => o.material?.map?.image?.width === 192);
        const floor = ctx.player.surfaceAt(start.page[0], start.page[2]);
        holder.visible = true; holder.position.set(start.page[0], floor + variant.height, start.page[2]);
        body.scale.setScalar(variant.scale); body.position.y = 0; sheet.material.opacity = 1;
        holder.updateMatrixWorld(true);
        const v = camera.position.clone(), vertices = sheet.geometry.getAttribute('position');
        let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
        for (let i=0; i<vertices.count; i++) {
          v.set(vertices.getX(i),vertices.getY(i),vertices.getZ(i)); sheet.localToWorld(v); v.project(camera);
          minX=Math.min(minX,v.x);maxX=Math.max(maxX,v.x);minY=Math.min(minY,v.y);maxY=Math.max(maxY,v.y);
        }
        window.__gameHooks.advance(0,0,true);
        return { ...variant, world: holder.position.toArray(), minX,maxX,minY,maxY, inFrame: minX>-.94 && maxX<.94 && minY>-.94 && maxY<.94 };
      }, variant);
      reports.push(report);
      await page.screenshot({ path: `${out}/variant-${variant.name}.png` });
    }
    fs.writeFileSync(`${out}/variants.json`, JSON.stringify(reports,null,2));
    console.log(JSON.stringify(reports));
  }
  fs.writeFileSync(`${out}/checkpoint.tmp`, JSON.stringify({ complete: true, sha, dt, production, images: image, seconds, checks }));
  fs.renameSync(`${out}/checkpoint.tmp`, `${out}/checkpoint.json`);
  console.log(JSON.stringify(checks));
  if (Object.values(checks).some(v => !v)) process.exitCode = 1;
} finally { await browser.close(); if (production) await new Promise(resolve => server.httpServer.close(resolve)); else await server.close(); }
