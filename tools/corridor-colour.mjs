// Colour coverage of the travel corridors (fix 2, DESIGN-corridors.md): the fox stands on each corridor and the real
// chase lens renders it; we count the share of pixels that read as *colour* rather than sepia paper/ink.
//   node tools/corridor-colour.mjs [--out DIR] [--state cold|story|both] [--size 960x540] [--views plaza,hermitage]
//   node tools/corridor-colour.mjs --images a.jpg b.jpg ...   (score existing frames with the same metric)
// A pixel counts as colour when HSV sat > 0.45, value > 0.22, and it leaves the sepia axis: green or blue against red
// (g/r > 0.86 or b/r > 0.75) or sat > 0.62. Sepia paper (sat ~0.32–0.42) and ink (value < 0.22) never pass.
// Calibrated on Kit's b4fa63a review frames: naive-mid 0.03, t002 0.05, herm-desk 0.14, end-160 0.38, t060 0.73.
// `tint` is the looser companion: any visible hue off the sepia axis (pale washes included; sat > 0.15, green or blue
// against red, or a red well past sepia): naive-mid 0.017, herm-desk 0.083, end-160 0.167, t060 0.336.
// 'story' forces the slice's beats with dev hooks (homecoming, Keeping steam + release, mill burst, Hermitage lines)
// and lets 45 s of sim pass so restores and their bleed settle — same forced state before and after a change.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const out = path.resolve(arg('--out', '/tmp/corridor-colour'));
const [W, H] = arg('--size', '960x540').split('x').map(Number);
const which = arg('--state', 'both');
const only = arg('--views', '').split(',').filter(Boolean);
fs.mkdirSync(out, { recursive: true });

/** [name, fox x, z, look-toward x, z] — every authored corridor between the slice's places */
const VIEWS = [
  ['plaza', -5.2, 92.5, -3, 81],
  ['well-west', -14, 87.8, -24, 88.3],
  ['meadow-lane', 0, 79, -3, 62],
  ['east-lane', 9, 88, 25, 88],
  ['keeping-approach', 18, 82, 28, 73.6],
  ['south-lane', 6.2, 69, 12.5, 53],
  ['press-lane', 12.5, 53, 21.1, 40.2],
  ['mill-lane', -46, 90.6, -63.5, 86.6],
  ['mill-yard', -66, 87, -73.4, 80.4],
  ['north-lane', -12.6, 108.2, -11.4, 120.8],
  ['hermitage', -7, 129.4, -8.6, 135.4],
];

function score(b64s) {
  return Promise.all(b64s.map(async (b64) => {
    const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const c = new OffscreenCanvas(img.width, img.height);
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, img.width, img.height).data;
    let n = 0, t = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] / 255 + 1e-6, gg = d[i + 1] / 255, b = d[i + 2] / 255;
      const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
      const sat = (mx - mn) / (mx + 1e-6);
      if (sat > 0.45 && mx > 0.22 && (gg / r > 0.86 || b / r > 0.75 || sat > 0.62)) n++;
      if (sat > 0.15 && mx > 0.18 && (gg / r > 0.95 || b / r > 0.85 || (gg / r < 0.6 && sat > 0.4))) t++;
    }
    return [n / (d.length / 4), t / (d.length / 4)];
  }));
}

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const imgIdx = process.argv.indexOf('--images');
if (imgIdx >= 0) {
  const files = process.argv.slice(imgIdx + 1);
  const page = await browser.newPage();
  // jpg/png both decode through the same fetch→bitmap path (the data URL's mime is advisory)
  const s = await page.evaluate(score, files.map((f) => fs.readFileSync(f).toString('base64')));
  files.forEach((f, i) => console.log(`${path.basename(f).padEnd(24)} colour ${s[i][0].toFixed(3)} tint ${s[i][1].toFixed(3)}`));
  await browser.close();
  process.exit(0);
}

const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5231, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const report = { sha: execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(), dirty: execFileSync('git', ['status', '--porcelain', 'games/fox-spirit/src'], { encoding: 'utf8' }).trim() !== '', size: [W, H], errors: [], states: {} };
try {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.setDefaultTimeout(900000);
  page.on('pageerror', (e) => report.errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') report.errors.push(m.text()); });
  for (const state of which === 'both' ? ['cold', 'story'] : [which]) {
    await page.goto('http://127.0.0.1:5231/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__gameHooks?.ready === true);
    await page.evaluate((state) => {
      const h = window.__gameHooks;
      h.setManual(true);
      h.audioContext?.()?.suspend?.();
      if (state === 'story') {
        h.homecoming();
        h.keepingSteam();
        h.keepingRelease();
        h.millBurst();
        h.hermitageFree();
        h.advance(45 * 30, 1 / 30, false);
      }
    }, state);
    const rows = [];
    for (const [name, x, z, tx, tz] of VIEWS.filter((v) => !only.length || only.includes(v[0]))) {
      await page.evaluate(([x, z, tx, tz]) => {
        const h = window.__gameHooks;
        h.teleport(x, z, Math.atan2(tx - x, tz - z));
        h.advance(75, 1 / 30, false);
        h.advance(1, 1 / 30, true);
      }, [x, z, tx, tz]);
      const file = path.join(out, `${state}-${name}.png`);
      const buf = await page.screenshot({ path: file });
      const [[cov, tint]] = await page.evaluate(score, [buf.toString('base64')]);
      rows.push({ name, coverage: Number(cov.toFixed(3)), tint: Number(tint.toFixed(3)) });
      console.log(`${state.padEnd(6)} ${name.padEnd(18)} colour ${cov.toFixed(3)} tint ${tint.toFixed(3)}`);
    }
    const mean = rows.reduce((a, r) => a + r.coverage, 0) / rows.length;
    const tintMean = rows.reduce((a, r) => a + r.tint, 0) / rows.length;
    report.states[state] = { mean: Number(mean.toFixed(3)), min: Math.min(...rows.map((r) => r.coverage)), tintMean: Number(tintMean.toFixed(3)), tintMin: Math.min(...rows.map((r) => r.tint)), views: rows };
    console.log(`${state} mean colour ${mean.toFixed(3)} tint ${tintMean.toFixed(3)}`);
  }
} finally {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  await server.close();
}
