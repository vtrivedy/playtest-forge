// Opening audio smoke: real-time play with a real first keypress; records the post-limiter tap (audioTap) to WAV,
// reports loudness/peak per second and the audio state (music track, buses, event counts).
//   node tools/opening-audio-probe.mjs --out /tmp/audio-probe [--seconds 20] [--port 5230]
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const out = path.resolve(arg('out', '/tmp/audio-probe'));
const seconds = Number(arg('seconds', '20'));
const port = Number(arg('port', '5230'));
fs.mkdirSync(out, { recursive: true });
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port, host: '127.0.0.1', strictPort: true, hmr: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
page.setDefaultTimeout(600000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://127.0.0.1:${port}/`, { timeout: 300000 });
await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });
// a real first input unlocks the graph (and starts the music)
await page.keyboard.press('KeyW');
await page.waitForFunction(() => window.__gameHooks.audioContext().state === 'running', null, { timeout: 30000 });
// raw PCM from the tap via a ScriptProcessor (deprecated but universally available; capture only)
await page.evaluate(() => {
  const ac = window.__gameHooks.audioContext();
  const src = ac.createMediaStreamSource(window.__gameHooks.audioTap());
  const sp = ac.createScriptProcessor(4096, 2, 2);
  window.__pcm = [[], []];
  sp.onaudioprocess = (e) => { for (let c = 0; c < 2; c++) window.__pcm[c].push(Array.from(e.inputBuffer.getChannelData(c))); };
  const mute = ac.createGain();
  mute.gain.value = 0;
  src.connect(sp).connect(mute).connect(ac.destination);
});
const states = [];
const t0 = Date.now();
// run toward the meadow (footsteps), jump twice (cloth + land)
await page.keyboard.down('KeyW');
for (let s = 0; s < seconds; s++) {
  if (s === 4 || s === 7) await page.keyboard.press('Space');
  await page.waitForTimeout(1000);
  states.push(await page.evaluate(() => window.__gameHooks.state().opening.audio));
}
await page.keyboard.up('KeyW');
const pcm = await page.evaluate(() => { const r = window.__pcm.map((ch) => ch.flat()); return { sr: window.__gameHooks.audioContext().sampleRate, l: r[0], r: r[1] }; });
const n = Math.min(pcm.l.length, pcm.r.length);
const buf = Buffer.alloc(44 + n * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(pcm.sr, 24);
buf.writeUInt32LE(pcm.sr * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
let peak = 0;
const perSec = [];
for (let i = 0; i < n; i++) {
  const l = Math.max(-1, Math.min(1, pcm.l[i])), r = Math.max(-1, Math.min(1, pcm.r[i]));
  peak = Math.max(peak, Math.abs(l), Math.abs(r));
  buf.writeInt16LE(Math.round(l * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(r * 32767), 46 + i * 4);
  const s = Math.floor(i / pcm.sr);
  perSec[s] = (perSec[s] ?? 0) + l * l + r * r;
}
fs.writeFileSync(path.join(out, 'mix.wav'), buf);
const rmsDb = perSec.map((e) => +(10 * Math.log10(e / (2 * pcm.sr) + 1e-12)).toFixed(1));
const evidence = { seconds: n / pcm.sr, wallSeconds: (Date.now() - t0) / 1000, peakDbfs: +(20 * Math.log10(peak + 1e-12)).toFixed(2), rmsDbPerSecond: rmsDb, states, errors };
fs.writeFileSync(path.join(out, 'evidence.json'), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({ seconds: evidence.seconds, peakDbfs: evidence.peakDbfs, rmsDb, last: states.at(-1), errors }));
await browser.close();
await server.close();
