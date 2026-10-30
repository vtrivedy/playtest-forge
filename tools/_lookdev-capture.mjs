import { chromium } from 'playwright';
import fs from 'node:fs';

const out = '/workspace/siyu/playtest-forge-artifacts/lookdev';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: out + '/vid', size: { width: 1280, height: 720 } },
});
fs.mkdirSync(out + '/vid', { recursive: true });
const page = await ctx.newPage();
page.setDefaultTimeout(60000);
const errors = [];
page.on('pageerror', (e) => { errors.push(String(e)); console.log('PAGEERROR', e); });
page.on('console', (m) => { if (m.type()==='error') { errors.push(m.text()); console.log('CONSERR', m.text()); }});

async function shot(name, url) {
  console.log('goto', name);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!(window.__game && window.__lookdev), null, { timeout: 45000 });
  await page.waitForTimeout(800);
  // pause flythrough so frame is stable
  await page.evaluate(() => {
    const g = document.querySelector('.dg') || null;
    void g;
  });
  const g = await page.evaluate(() => ({
    status: window.__game?.status,
    notes: window.__game?.notes,
    t: window.__lookdev?.t,
    color: window.__game?.colorSample,
  }));
  await page.screenshot({ path: `${out}/${name}.png`, timeout: 60000, animations: 'disabled' });
  console.log(name, JSON.stringify(g));
}

await shot('01-sepia-open', 'http://127.0.0.1:5190/?t=0.8');
await shot('02-ember-trail', 'http://127.0.0.1:5190/?t=5');
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
