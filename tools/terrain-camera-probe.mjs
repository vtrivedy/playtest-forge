// Staged historical hillside location; runtime camera-tunable comparisons, not a blind discovery trial.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const out = process.argv[2] || `/captures/hazel/terrain-camera-${Date.now()}`;
const body = process.argv.includes('--body');
await fs.mkdir(out, { recursive: true });
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5228, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const evidence = { sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), scope: 'Staged known hillside location and historical camera azimuth, then one second settling; runtime tunables only. Not the original blind input route or exact transient rig pose.', errors: [], variants: [] };
try {
  for (const value of body ? [0, .18, .28, .38] : [.35, .55, .8]) {
    const clearance = body ? .35 : value;
    const width = body ? value : undefined;
    const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
    const page = await context.newPage(); page.setDefaultTimeout(180000);
    page.on('pageerror', e => evidence.errors.push(String(e)));
    await page.goto('http://127.0.0.1:5228/?manual=1');
    await page.waitForFunction(() => window.__gameHooks?.ready);
    const state = await page.evaluate(({clearance,width}) => {
      const h = window.__gameHooks;
      const x = -10.461263163608766, z = 57.92733046912392;
      const oldLens = [-12.305792538440905, 5.39552195861432, 57.471576823629604];
      h.camera.clearance = clearance;
      if(width !== undefined)h.camera.terrainBodyWidth = width;
      h.setStick(0, 0); h.setKeys([]); h.teleport(x, z, -Math.PI / 2);
      window.__opening.ctx.player.cam.snapBehind(Math.atan2(oldLens[0] - x, oldLens[2] - z) - h.camera.sideBias - Math.PI);
      return h.advance(60, 1 / 60, true);
    }, {clearance,width});
    const label = `${body?'body':'clearance'}-${value.toFixed(2)}`;
    await page.screenshot({ path: `${out}/${label}.png` });
    evidence.variants.push({ clearance, width, state });
    await fs.writeFile(`${out}/evidence.partial.json`, JSON.stringify(evidence, null, 2));
    await context.close();
  }
  assert.deepEqual(evidence.errors, []); evidence.completed = true;
} finally {
  await fs.writeFile(`${out}/evidence.json`, JSON.stringify(evidence, null, 2));
  await browser.close(); await server.close();
}
console.log(`Terrain-camera staged comparisons complete: ${out}`);
