// Redesign P0 lookdev stills ("Pressed Ink → Living Cel") on SwiftShader at 1280×720.
//
//   node tools/redesign-p0-capture.mjs                 # → /workspace/kit/captures/redesign-p0/
//   node tools/redesign-p0-capture.mjs --skip-before   # lookdev stills only
//
// 00-before-main.png is the current game (/?fresh=1) at spawn for comparison.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const port = Number(arg('port', '5187'));
const out = path.resolve(arg('out', '/workspace/kit/captures/redesign-p0'));
const skipBefore = process.argv.includes('--skip-before');
const only = arg('only', '');
fs.mkdirSync(out, { recursive: true });

const server = await createServer({
  configFile: 'games/fox-spirit/vite.config.ts',
  server: { port, host: '127.0.0.1', strictPort: true },
  logLevel: 'error',
});
await server.listen();

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
page.setDefaultTimeout(300000);
const errors = [];
page.on('pageerror', (e) => { errors.push(String(e)); console.log('PAGEERROR', String(e)); });
page.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); console.log('CONSERR', m.text()); } });

const STILLS = [
  { file: '01-unpainted.png', paint: 'none', shot: 'wide' },
  { file: '02-half-paint.png', paint: 'half', shot: 'wide' },
  { file: '03-full-paint.png', paint: 'full', shot: 'wide' },
  { file: '04-fox-close.png', paint: 'half', shot: 'fox' },
  { file: '05-wide-hero.png', paint: 'full', shot: 'hero' },
];

try {
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${port}/?lookdev=p0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window.__lookdevHooks?.ready === true, null, { timeout: 300000 });
  console.log(`lookdev ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  for (const s of STILLS) {
    if (only && !s.file.includes(only)) continue;
    await page.evaluate(({ paint, shot }) => {
      const h = window.__lookdevHooks;
      h.setPaint(paint);
      h.setCamera(shot);
      h.advance(4, 1 / 60);
    }, s);
    await page.screenshot({ path: path.join(out, s.file) });
    console.log('wrote', s.file);
  }

  if (!skipBefore && !only) {
    try {
      await page.goto(`http://127.0.0.1:${port}/?fresh=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
      await page.waitForFunction(() => !!(window.__game && window.__gameHooks?.advance), null, { timeout: 300000 });
      await page.evaluate(() => {
        window.__gameHooks.setManual?.(true);
        window.__gameHooks.advance(60, 1 / 60, true);
      });
      await page.screenshot({ path: path.join(out, '00-before-main.png') });
      console.log('wrote 00-before-main.png');
    } catch (e) {
      console.log('SKIP 00-before-main:', String(e).split('\n')[0]);
    }
  }
} finally {
  await browser.close();
  await server.close();
}
if (errors.length) {
  console.log(`${errors.length} page error(s)`);
  process.exitCode = 1;
}
