// Sim-only camera audit of the hero route (?lookdev=p0&play=1): counts frames where the follow camera
// reports the fox's sight line blocked, per beat. No rendering beyond boot.
//
//   node tools/lookdev-cam-probe.mjs
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { createHeroRoute, HERO_START } from './lookdev-hero-route.mjs';

const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5193, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.setDefaultTimeout(300000);
  await page.goto('http://127.0.0.1:5193/?lookdev=p0&play=1');
  await page.waitForFunction(() => window.__gameHooks?.ready === true);
  let state = await page.evaluate((s) => { const h = window.__gameHooks; h.setManual(true); h.teleport(s.x, s.z, s.yaw); return h.advance(1, 1 / 60, false); }, HERO_START);
  const route = createHeroRoute();
  const blocked = {};
  for (let f = 0; f < 1800; f++) {
    const input = route(f / 60, state);
    state = await page.evaluate((i) => { const h = window.__gameHooks; h.setStick(i.x, i.z); h.setKeys(i.jump ? ['Space'] : []); return h.advance(1, 1 / 60, false); }, input);
    if (state.camera.blocked) (blocked[input.beat] ??= []).push(f);
  }
  for (const [beat, fs] of Object.entries(blocked)) console.log(beat.padEnd(18), fs.length, 'frames', fs[0], '…', fs.at(-1));
  console.log('total blocked', Object.values(blocked).flat().length, '/ 1800');
} finally {
  await browser.close();
  await server.close();
}
