// Web (HTML5) export smoke: serve build/web, boot it in headless Chromium (SwiftShader WebGL2),
// wait for the slice to build, drive a few seconds of real keyboard input, screenshot.
//   node games/fox-spirit-godot/tools/web-smoke.mjs OUT_DIR
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../build/web');
const out = path.resolve(process.argv[2] ?? '/tmp/web-smoke');
fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.pck': 'application/octet-stream', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(file, (err, data) => {
    if (err) return void res.writeHead(404).end();
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' }).end(data);
  });
}).listen(5197, '127.0.0.1');
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
const log = [];
page.on('console', (m) => log.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => log.push(`[pageerror] ${e}`));
try {
  await page.goto('http://127.0.0.1:5197/', { waitUntil: 'load', timeout: 120000 });
  const t0 = Date.now();
  while (!log.some((l) => l.includes('[opening] built')) && Date.now() - t0 < 480000) await page.waitForTimeout(2000);
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(out, 'web-boot.png'), timeout: 300000 });
  await page.mouse.click(480, 270);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(6000);
  await page.keyboard.press('Space');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(out, 'web-run.png'), timeout: 300000 });
  await page.keyboard.up('KeyW');
} finally {
  fs.writeFileSync(path.join(out, 'console.log'), log.join('\n'));
  console.log(log.filter((l) => /opening|error|ERROR/i.test(l)).slice(0, 20).join('\n'));
  await browser.close();
  server.close();
}
