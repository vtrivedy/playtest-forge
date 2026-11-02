// Staged saved-fact diagnostic; does not prove earning the facts or walking through arches.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = process.argv[2] || `/captures/hazel/world-save-${Date.now()}`;
await fs.mkdir(out, { recursive: true });
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5198, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const evidence = { scope: 'Injected completed facts; native Tab and developer world travel. Reconstruction diagnostic only.', errors: [], cases: [] };
try {
  for (const restored of [['teach'], ['teach', 'develop'], ['teach', 'develop', 'combine']]) {
    const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
    await context.addInitScript(restored => localStorage.setItem('russet-vale-worlds-v1', JSON.stringify({ version: 1, worlds: { russetvale: { restored }, ashwater: { restored }, press: { restored } } })), restored);
    const page = await context.newPage();
    page.on('pageerror', e => evidence.errors.push(String(e)));
    await page.goto('http://127.0.0.1:5198/?manual=1');
    await page.waitForFunction(() => window.__gameHooks?.ready, null, { timeout: 120000 });
    const boot = await page.evaluate(() => window.__gameHooks.advance(60, 1 / 60, true));
    const label = restored.length === 1 ? 'teach' : restored.length === 2 ? 'develop' : 'full';
    await page.screenshot({ path: `${out}/${label}-hub.png` });
    assert.ok(boot.opening.worlds.progress.worlds.russetvale.restored.includes('teach'));
    const marsh = await page.evaluate(() => { window.__gameHooks.travel('ashwater'); return window.__gameHooks.advance(180, 1 / 60, true); });
    await page.screenshot({ path: `${out}/${label}-marsh.png` });
    await page.keyboard.press('Tab');
    await page.evaluate(() => window.__gameHooks.advance(2, 1 / 60, true));
    await page.screenshot({ path: `${out}/${label}-album.png` });
    const cameraDistance = Math.hypot(...marsh.camera.pos.map((v, i) => v - marsh.pos[i]));
    await page.keyboard.press('Tab');
    const press = await page.evaluate(() => { window.__gameHooks.travel('press'); return window.__gameHooks.advance(180, 1 / 60, true); });
    await page.screenshot({ path: `${out}/${label}-press.png` });
    // Explicit inspection lens, not a player-reachable viewpoint or travel claim.
    await page.evaluate(() => {
      const camera = window.__opening.camera;
      camera.position.set(-688, 15, 88);
      camera.lookAt(-700, 6, 66);
      camera.updateMatrixWorld(true);
      window.__gameHooks.advance(0, 1 / 60, true);
    });
    await page.screenshot({ path: `${out}/${label}-press-overview.png` });
    const pressCameraDistance = Math.hypot(...press.camera.pos.map((v, i) => v - press.pos[i]));
    const pressState = press.opening.press;
    const full = restored.includes('combine');
    const pressMatchesSave = restored.every(level => pressState.done.includes(level)) && pressState.sealOpen && pressState.draftA === restored.includes('develop') && pressState.draftB === full && pressState.iced === !full;
    const savedOpeningMatches = boot.opening.homecoming.pinned && !boot.opening.discovery.active
      && boot.opening.page.phase === 'kept' && boot.opening.page.catches === 3
      && boot.opening.discovery.restoredAtLoad && boot.opening.discovery.completionAt === null;
    evidence.cases.push({ restored, boot, marsh, press, cameraDistance, pressCameraDistance, pressMatchesSave, savedOpeningMatches, physicalMatchesSave: restored.every(level => marsh.opening.ashwater.done.includes(level)) });
    await fs.writeFile(`${out}/evidence.partial.json`, JSON.stringify(evidence, null, 2));
    await context.close();
  }
  assert.deepEqual(evidence.errors, []);
  assert.ok(evidence.cases.every(c => c.physicalMatchesSave), 'saved Ashwater facts must reconstruct physical completion');
  assert.ok(evidence.cases.every(c => c.cameraDistance < 12), 'travel must leave no lens in the old world');
  assert.ok(evidence.cases.every(c => c.pressMatchesSave), 'saved Press facts must reconstruct seal, drafts and ice');
  assert.ok(evidence.cases.every(c => c.pressCameraDistance < 12), 'Press travel must relocate the lens');
  evidence.worldReconstructionCompleted = true;
  assert.ok(evidence.cases.every(c => c.savedOpeningMatches), 'saved returned page must not restart the discovery invitation');
  evidence.completed = true;
} finally {
  await fs.writeFile(`${out}/evidence.json`, JSON.stringify(evidence, null, 2));
  await browser.close(); await server.close();
}
console.log(`Save reconstruction diagnostic complete: ${out}`);
