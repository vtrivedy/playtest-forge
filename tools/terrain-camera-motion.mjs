// Staged hillside control -> enable the shipped body reserve -> ordinary jump/dash inputs.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const out = process.argv[2] || `/captures/hazel/terrain-motion-${Date.now()}`;
await fs.mkdir(`${out}/frames`, { recursive: true });
await fs.copyFile(new URL(import.meta.url), `${out}/probe.mjs`);
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5229, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.setDefaultTimeout(180000);
const evidence = { sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), scope: 'Staged known hillside with old camera bearing. First second disables the reserve as a negative control, then enables the shipped .28 setting. Ordinary Space/Shift and world-stick movement follow. Not an uninterrupted opening or real-time performance test.', fps: 15, simulationHz: 60, errors: [], frames: [] };
page.on('pageerror', e => evidence.errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') evidence.errors.push(m.text()); });
try {
  await page.goto('http://127.0.0.1:5229/?manual=1'); await page.waitForFunction(() => window.__gameHooks?.ready);
  await page.evaluate(async () => {
    const h = window.__gameHooks, x = -10.461263163608766, z = 57.92733046912392;
    window.__terrainVisibility = (await import('/src/cameraTerrain.hot.ts')).terrainBodyVisibility;
    h.camera.terrainBodyWidth = 0; h.setStick(0, 0); h.setKeys([]); h.teleport(x, z, -Math.PI / 2);
    window.__opening.ctx.player.cam.snapBehind(Math.atan2(-12.305792538440905 - x, 57.471576823629604 - z) - h.camera.sideBias - Math.PI);
    h.advance(60, 1 / 60, false);
  });
  for (let frame = 0; frame < 96; frame++) {
    if (frame === 15) await page.evaluate(() => { window.__gameHooks.camera.terrainBodyWidth = .28; });
    if (frame === 45) { await page.evaluate(() => window.__gameHooks.setStick(1, 0)); await page.keyboard.down('Space'); }
    if (frame === 54) await page.keyboard.up('Space');
    if (frame === 60) await page.keyboard.down('Shift');
    if (frame === 64) await page.keyboard.up('Shift');
    if (frame === 85) await page.evaluate(() => window.__gameHooks.setStick(0, 0));
    const row = await page.evaluate(() => {
      const h = window.__gameHooks, state = h.advance(4, 1 / 60, true), p = state.pos, l = state.camera.pos;
      return { state, bodyVisibility: window.__terrainVisibility(p[0], p[1] + h.camera.lookHeight, p[2], l[0], l[1], l[2], window.__opening.ctx.groundH, .28) };
    });
    evidence.frames.push({ frame, ...row });
    await page.screenshot({ path: `${out}/frames/f${String(frame).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 85 });
    if (frame % 15 === 14) await fs.writeFile(`${out}/evidence.partial.json`, JSON.stringify(evidence, null, 2));
  }
  assert.ok(evidence.frames[0].bodyVisibility < .99, 'negative control must reproduce terrain masking');
  assert.ok(evidence.frames[44].bodyVisibility > .99, 'active reserve must recover a clear body view');
  evidence.maxCaptureStepSpeed = Math.max(...evidence.frames.slice(1).map((r,i) => Math.hypot(...r.state.camera.pos.map((v,k) => v - evidence.frames[i].state.camera.pos[k])) * 15));
  assert.ok(evidence.maxCaptureStepSpeed < 24);
  const final = evidence.frames.at(-1).state;
  assert.ok(final.lastJump.apex > .3 && final.dashesUsed === 1, 'native jump/dash coverage');
  assert.deepEqual(evidence.errors, []); evidence.completed = true;
} finally {
  await fs.writeFile(`${out}/evidence.json`, JSON.stringify(evidence, null, 2));
  await browser.close(); await server.close();
}
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '15', '-i', `${out}/frames/f%04d.jpg`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', `${out}/terrain-recovery.mp4`]);
console.log(`Terrain recovery + native jump/dash PASS: ${out}`);
