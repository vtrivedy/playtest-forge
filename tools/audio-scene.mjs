// Real-time listening of one staged scene (disclosed staging): the sim is paced to the wall clock and the three
// pre-master stems are recorded sample-for-sample, like tools/mix-capture.mjs, but from a teleport + dev hook.
//   node tools/audio-scene.mjs --scene millbrook|finale --out DIR [--seconds 40]
// millbrook: stand on the bank near the dam, burst it (dev hook), listen to the brook start and the wheel turn.
// finale: force the finale (dev hook) beside the cradle, listen through the coda to silence.
import { chromium } from 'playwright';
import { installStemTap } from './lib/stem-tap.mjs';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const scene = arg('scene', 'millbrook');
const out = path.resolve(arg('out', `/tmp/audio-scene-${scene}`));
const seconds = Number(arg('seconds', '40'));
const port = Number(arg('port', '5196'));
fs.mkdirSync(out, { recursive: true });
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port, host: '127.0.0.1', strictPort: true, hmr: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 320, height: 180 } })).newPage();
page.setDefaultTimeout(600000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 300000 });
  await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });
  await page.evaluate(() => window.__gameHooks.setManual(true));
  await page.keyboard.press('ShiftRight');
  await page.waitForFunction(() => window.__gameHooks.state().opening.audio.context === 'running', null, { timeout: 60000 });
  const staged = await page.evaluate((scene) => {
    const h = window.__gameHooks;
    if (scene === 'millbrook') {
      h.teleport(-70, 96, 0);
      h.advance(30, 1 / 60, false);
    } else {
      h.finale();
      h.advance(30, 1 / 60, false);
    }
    const s = h.state();
    return { pos: s.pos, millrace: s.opening.millrace, finale: s.opening.finale?.phase };
  }, scene);
  await page.evaluate(installStemTap, ['music', 'ambience', 'sfx']);
  const wall0 = Date.now();
  const marks = [];
  for (let f = 0; f < seconds * 60; f++) {
    if (scene === 'millbrook' && f === 180) { await page.evaluate(() => window.__gameHooks.millBurst()); marks.push({ t: 3, what: 'burst' }); }
    const s = await page.evaluate(() => { const h = window.__gameHooks; h.setStick(0, 0); h.setKeys([]); const s = h.advance(1, 1 / 60, false); return { music: s.opening.audio.music, finale: s.opening.finale?.phase, mill: s.opening.millrace?.phase }; });
    if (f % 60 === 0) marks.push({ t: f / 60, what: `${s.music.swell}/${s.music.ending}/${s.finale ?? s.mill}` });
    const ahead = wall0 + (f / 60) * 1000 - Date.now();
    if (ahead > 0) await new Promise((r) => setTimeout(r, ahead));
  }
  const sr = await page.evaluate(() => window.__gameHooks.audioContext().sampleRate);
  const S = {};
  for (const k of ['music', 'ambience', 'sfx']) {
    S[k] = [];
    for (const c of [0, 1]) {
      const b64 = await page.evaluate(({ k, c }) => {
        const chunks = window.__stems[k][c];
        const n = chunks.reduce((a, x) => a + x.length, 0);
        const o = new Int16Array(n);
        let i = 0;
        for (const x of chunks) for (let j = 0; j < x.length; j++) o[i++] = Math.max(-32768, Math.min(32767, Math.round(x[j] * 32767)));
        const u8 = new Uint8Array(o.buffer);
        let s = '';
        for (let j = 0; j < u8.length; j += 0x8000) s += String.fromCharCode(...u8.subarray(j, j + 0x8000));
        return btoa(s);
      }, { k, c });
      const buf = Buffer.from(b64, 'base64');
      S[k].push(new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2));
    }
  }
  const n = Math.min(...Object.values(S).flatMap((s) => s.map((c) => c.length)));
  const wav = (name, L, R) => {
    const buf = Buffer.alloc(44 + n * 4);
    buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
    buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(sr, 24);
    buf.writeUInt32LE(sr * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
    for (let i = 0; i < n; i++) { buf.writeInt16LE(Math.max(-32768, Math.min(32767, L(i))), 44 + i * 4); buf.writeInt16LE(Math.max(-32768, Math.min(32767, R(i))), 46 + i * 4); }
    fs.writeFileSync(path.join(out, `${name}.wav`), buf);
  };
  for (const k of Object.keys(S)) wav(`stem-${k}`, (i) => S[k][0][i], (i) => S[k][1][i]);
  wav('mix', (i) => S.music[0][i] + S.ambience[0][i] + S.sfx[0][i], (i) => S.music[1][i] + S.ambience[1][i] + S.sfx[1][i]);
  fs.writeFileSync(path.join(out, 'marks.json'), JSON.stringify({ marks }));
  fs.writeFileSync(path.join(out, 'evidence.json'), JSON.stringify({ scene, staging: scene === 'millbrook' ? 'teleport to the bank (-70,96) + millBurst() dev hook at 3 s' : 'finale() dev hook', staged, seconds, wallSeconds: (Date.now() - wall0) / 1000, audioSeconds: n / sr, errors }, null, 1));
  console.log(JSON.stringify({ scene, staged, audioSeconds: n / sr, errors }));
} finally {
  await browser.close();
  await server.close();
}
