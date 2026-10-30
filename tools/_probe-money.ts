// scratch probe (not committed): stills around the wellspring
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const port = 5291;
const out = process.argv[2] ?? '/tmp/opus-money/probe';
const q = process.argv[3] ?? 'low';
fs.mkdirSync(out, { recursive: true });
const vite = spawn('npx', ['vite', '--config', 'games/fox-spirit/vite.config.ts', '--host', '127.0.0.1', '--port', String(port)], { stdio: 'ignore', detached: true });
const url = `http://127.0.0.1:${port}/?q=${q}`;
try {
  for (let t = Date.now(); Date.now() - t < 45000; ) { try { await fetch(url); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => console.log('[console]', m.text()));
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('Boolean(window.__gameHooks)', null, { timeout: 90000 });
  await page.evaluate('window.__gameHooks.setManual(true)');
  const poses = JSON.parse(process.argv[4] ?? '[]') as Array<[string, string]>;
  for (const [name, js] of poses) {
    const r = await page.evaluate(js);
    if (r !== undefined) console.log(name, JSON.stringify(r).slice(0, 600));
    await page.screenshot({ path: `${out}/${name}.png`, timeout: 120000 });
  }
  await browser.close();
} finally {
  try { process.kill(-vite.pid!, 'SIGTERM'); } catch { /* */ }
}
