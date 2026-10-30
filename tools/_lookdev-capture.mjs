import { chromium } from 'playwright';
import fs from 'node:fs';

const out = '/workspace/siyu/playtest-forge-artifacts/lookdev';
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(out + '/vid', { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: out + '/vid', size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
page.setDefaultTimeout(60000);
const errors = [];
page.on('pageerror', (e) => { errors.push(String(e)); console.log('PAGEERROR', e); });
page.on('console', (m) => { if (m.type()==='error') { errors.push(m.text()); console.log('CONSERR', m.text()); }});

async function shot(name, url) {
  console.log('goto', name);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!(window.__game && window.__lookdev && window.__game.backend), null, { timeout: 45000 });
  // wait until at least one rendered frame with non-trivial time
  await page.waitForFunction(() => (window.__lookdev?.t ?? 0) > 0.05, null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    document.querySelectorAll('.dg, .lil-gui').forEach((el) => { el.style.display = 'none'; });
  });
  // force one more RAF paint
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const g = await page.evaluate(() => ({
    status: window.__game?.status,
    notes: window.__game?.notes,
    t: window.__lookdev?.t,
    color: window.__game?.colorSample,
  }));
  const canvas = await page.$('canvas');
  if (canvas) {
    await canvas.screenshot({ path: `${out}/${name}.png`, timeout: 60000, animations: 'disabled' });
  } else {
    await page.screenshot({ path: `${out}/${name}.png`, timeout: 60000, animations: 'disabled' });
  }
  console.log(name, JSON.stringify(g), 'bytes', fs.statSync(`${out}/${name}.png`).size);
}

// warm-up so first real shot isn't cold SwiftShader black
await shot('_warmup', 'http://127.0.0.1:5190/?t=2');
await shot('01-sepia-open', 'http://127.0.0.1:5190/?t=0.8');
await shot('02-ember-trail', 'http://127.0.0.1:5190/?t=5');
await shot('02b-fox-close', 'http://127.0.0.1:5190/?t=7&restore=0');
await shot('03-shrine-flood', 'http://127.0.0.1:5190/?t=10.5&restore=1');
await shot('04-autumn-restored', 'http://127.0.0.1:5190/?t=13&restore=1');
await shot('05-wide-amber', 'http://127.0.0.1:5190/?t=18&restore=1');

fs.writeFileSync(`${out}/metrics.json`, JSON.stringify({ errors }, null, 2));
console.log('errors', errors);
await ctx.close();
await browser.close();
const vids = fs.readdirSync(out + '/vid').filter((f) => f.endsWith('.webm'));
if (vids[0]) {
  fs.copyFileSync(`${out}/vid/${vids[0]}`, `${out}/flythrough-autumn.webm`);
  console.log('video ok', vids[0]);
}
fs.rmSync(`${out}/_warmup.png`, { force: true });
