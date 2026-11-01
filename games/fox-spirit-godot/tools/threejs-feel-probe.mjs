// Feel probe on the three.js opening (reference side of FEEL.md): same stick inputs as
// godot `--probe`, reports jump apex/air and stance-paw slide per gait band.
//   node games/fox-spirit-godot/tools/threejs-feel-probe.mjs   (run from the repo root)
import { chromium } from 'playwright';
import { createServer } from 'vite';

const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5194, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
page.setDefaultTimeout(600000);
try {
  await page.goto('http://127.0.0.1:5194/?lookdev=p0&play=1', { waitUntil: 'domcontentloaded', timeout: 300000 });
  await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });
  const result = await page.evaluate(() => {
    const h = window.__gameHooks;
    h.setManual(true);
    const out = {};
    const band = (name, mag, secs) => {
      h.teleport(-1.5, 80, Math.PI);
      h.setStick(0, -mag);
      h.advance(60, 1 / 60, false);
      const slides = [];
      let s;
      for (let i = 0; i < secs * 60; i++) {
        s = h.advance(1, 1 / 60, false);
        if (s.stanceFeet > 0) slides.push(s.maxSlide);
      }
      slides.sort((a, b) => a - b);
      out[name] = { gait: s.gait, speed: s.speed, playback: s.playback, slideP50: slides[slides.length >> 1], slideP95: slides[Math.floor(slides.length * 0.95)] };
    };
    band('walk', 0.15, 3);
    band('trot', 0.35, 3);
    band('run', 1.0, 2.5);
    h.teleport(-1.5, 80, Math.PI);
    h.setStick(0, -1);
    h.advance(60, 1 / 60, false);
    h.setKeys(['Space']);
    h.advance(20, 1 / 60, false);
    h.setKeys([]);
    let s;
    for (let i = 0; i < 120; i++) s = h.advance(1, 1 / 60, false);
    out.jump = s.lastJump;
    return out;
  });
  console.log(JSON.stringify(result, null, 1));
} finally {
  await browser.close();
  await server.close();
}
