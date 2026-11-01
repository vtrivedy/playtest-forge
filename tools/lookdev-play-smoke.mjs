// Smoke for the playable P0 clearing (?lookdev=p0&play=1): boot, drive a short route, jump, stills + state.
//
//   node tools/lookdev-play-smoke.mjs --out /path/to/dir
//
// SwiftShader 1280×720, manual clock (60 Hz sim). Writes NN-<beat>.png and trace.json (per-frame state).
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const port = Number(arg('port', '5191'));
const out = path.resolve(arg('out', '/tmp/lookdev-play-smoke'));
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
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
page.setDefaultTimeout(300000);
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
page.on('console', (m) => m.type() === 'error' && console.log('CONSERR', m.text()));

// beats: [label, frames, stick [x,z] world | null, keys, still?]
const ROUTE = [
  ['idle', 30, null, [], true],
  ['walk', 90, [0, -0.2], [], true],
  ['run', 120, [0, -1], [], true],
  ['jump', 14, [0, -1], ['Space'], true],
  ['air', 16, [0, -1], [], false],
  ['land', 30, [0, -1], [], true],
  ['turn', 60, [-1, -0.3], [], true],
  ['stop', 45, null, [], true],
];
const trace = [];
try {
  await page.goto(`http://127.0.0.1:${port}/?lookdev=p0&play=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 300000 });
  await page.evaluate(() => window.__gameHooks.setManual(true));
  let n = 0;
  for (const [label, frames, stick, keys, still] of ROUTE) {
    const states = await page.evaluate(
      ({ frames, stick, keys }) => {
        const h = window.__gameHooks;
        h.setStick(stick ? stick[0] : null, stick ? stick[1] : 0);
        h.setKeys(keys);
        const s = [];
        for (let i = 0; i < frames; i++) s.push(h.advance(1, 1 / 60, i === frames - 1));
        return s;
      },
      { frames, stick, keys },
    );
    for (const s of states) trace.push({ beat: label, ...s, paws: undefined });
    const last = states.at(-1);
    console.log(label.padEnd(6), JSON.stringify({ pos: last.pos, speed: last.speed, anim: last.anim, gait: last.gait, rate: last.playback, grounded: last.grounded, lastJump: last.lastJump }));
    if (still) await page.screenshot({ path: path.join(out, `${String(++n).padStart(2, '0')}-${label}.png`) });
  }
  fs.writeFileSync(path.join(out, 'trace.json'), JSON.stringify(trace));
} finally {
  await browser.close();
  await server.close();
}
