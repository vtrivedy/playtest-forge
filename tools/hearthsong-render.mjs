// Offline render of the Hearthsong score along a scripted walk (src/opening/music/render.ts) → WAV + marks.
//   node tools/hearthsong-render.mjs --out /tmp/hearthsong [--seconds 220] [--seed 1]
// Faster than real time; the synth is the shipped worklet. Then: tools/audio-meter.py, tools/spectrogram.py.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const out = path.resolve(arg('out', '/tmp/hearthsong'));
const seconds = Number(arg('seconds', '220'));
const seed = Number(arg('seed', '1'));
const port = Number(arg('port', '5197'));
fs.mkdirSync(out, { recursive: true });
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port, host: '127.0.0.1', strictPort: true, hmr: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(600000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'warning' || m.type() === 'error' ? errors.push(m.text()) : 0);
  await page.goto(`http://127.0.0.1:${port}/hearthsong.html`);
  await page.waitForFunction(() => window.__hearthsongReady === true);
  const t0 = Date.now();
  const r = await page.evaluate(([s, sd]) => window.renderHearthsong(s, undefined, sd), [seconds, seed]);
  const l = Buffer.from(r.l, 'base64');
  const rr = Buffer.from(r.r, 'base64');
  const n = l.length / 2;
  const data = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) { data.writeInt16LE(l.readInt16LE(i * 2), i * 4); data.writeInt16LE(rr.readInt16LE(i * 2), i * 4 + 2); }
  const hdr = Buffer.alloc(44);
  hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVE', 8); hdr.write('fmt ', 12);
  hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22); hdr.writeUInt32LE(r.sr, 24);
  hdr.writeUInt32LE(r.sr * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);
  fs.writeFileSync(path.join(out, 'hearthsong.wav'), Buffer.concat([hdr, data]));
  fs.writeFileSync(path.join(out, 'marks.json'), JSON.stringify({ seconds, seed, renderMs: Date.now() - t0, errors, events: r.marks.map((m) => ({ time_s: m.t, kind: m.cue ? `cue:${m.place}` : m.place })) }, null, 1));
  console.log(JSON.stringify({ out, seconds, renderMs: Date.now() - t0, errors }));
} finally {
  await browser.close();
  await server.close();
}
