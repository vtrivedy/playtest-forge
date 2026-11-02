// Full-mix listening capture: plays the no-teleport slice route (createSliceRoute) with the sim paced to the wall
// clock, and records the three pre-master stems (music / ambience / sfx) sample-for-sample from the shared graph,
// so it works while the master is muted. Writes stems + mix (stem sum at the MIX gains, unity master) as WAV,
// per-50 ms meter, event list (music cues, bird calls, footfalls) and the route trace.
//   node tools/mix-capture.mjs --out /tmp/mix-capture [--seconds 60] [--port 5194]
// The mix is pre-limiter (the limiter only acts above −6 dBFS); the route's first input unlocks the graph as a
// real keypress does.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { createSliceRoute, SLICE_START } from './opening-hero-route.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const out = path.resolve(arg('out', '/tmp/mix-capture'));
const seconds = Number(arg('seconds', '60'));
const port = Number(arg('port', '5194'));
// --late: after the route the fox idles in the painted meadow (birds come back); the Keeping is released with its
// dev hook at 85 s (disclosed staging; use --seconds 130). The homecoming needs every creature walked home first.
const late = process.argv.includes('--late');
fs.mkdirSync(out, { recursive: true });
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port, host: '127.0.0.1', strictPort: true, hmr: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 480, height: 270 } })).newPage();
page.setDefaultTimeout(600000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 300000 });
  await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });
  await page.evaluate(() => window.__gameHooks.setManual(true));
  await page.keyboard.press('ShiftRight'); // a real first input (no game action on its own)
  await page.waitForFunction(() => { const a = window.__gameHooks.state().opening.audio; return a.context === 'running' && a.loaded >= a.files; }, null, { timeout: 60000 });
  await page.evaluate(() => {
    const h = window.__gameHooks;
    const ac = h.audioContext();
    const b = h.audioBuses();
    window.__stems = { music: [[], []], ambience: [[], []], sfx: [[], []] };
    window.__keep = [];
    for (const name of ['music', 'ambience', 'sfx']) {
      const sp = ac.createScriptProcessor(4096, 2, 2);
      sp.onaudioprocess = (e) => { for (let c = 0; c < 2; c++) window.__stems[name][c].push(e.inputBuffer.getChannelData(c).slice()); };
      const mute = ac.createGain();
      mute.gain.value = 0;
      b[name].connect(sp).connect(mute).connect(ac.destination);
      window.__keep.push(sp);
    }
    window.__t0 = ac.currentTime;
  });
  const route = createSliceRoute();
  let state = await page.evaluate((s) => { const h = window.__gameHooks; h.teleport(s.x, s.z, s.yaw); return h.advance(1, 1 / 60, false); }, SLICE_START);
  const trace = [];
  const wall0 = Date.now();
  const frames = Math.round(seconds * 60);
  for (let f = 0; f < frames; f++) {
    const input = route(f / 60, state);
    if (late && (f === 85 * 60)) await page.evaluate((k) => window.__gameHooks[k](), 'keepingRelease');
    state = await page.evaluate((input) => {
      const h = window.__gameHooks;
      h.setStick(input.x, input.z);
      h.setKeys([...(input.jump ? ['Space'] : []), ...(input.dash ? ['ShiftLeft'] : []), ...(input.interact ? ['KeyE'] : [])]);
      const s = h.advance(1, 1 / 60, false);
      return { ...s, at: h.audioContext().currentTime - window.__t0 };
    }, input);
    if (f % 6 === 0) trace.push({ f, beat: input.beat, at: state.at, pos: state.pos, grounded: state.grounded, catches: state.opening.page.catches });
    // pace to the wall clock (never faster than real time; slower is reported)
    const ahead = wall0 + (f / 60) * 1000 - Date.now();
    if (ahead > 0) await new Promise((r) => setTimeout(r, ahead));
  }
  const wall = (Date.now() - wall0) / 1000;
  // pull each stem channel as base64 int16 (JSON float arrays of this size exhaust the node heap)
  const meta = await page.evaluate(() => ({ sr: window.__gameHooks.audioContext().sampleRate, final: window.__gameHooks.state().opening.audio, t0: window.__t0 }));
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
      const i16 = new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2);
      S[k].push(Float32Array.from(i16, (v) => v / 32767));
    }
  }
  const stems = { ...meta, stems: S };
  const sr = stems.sr;
  const n = Math.min(...Object.values(stems.stems).flatMap((s) => s.map((c) => c.length)));
  const wav = (name, L, R) => {
    const buf = Buffer.alloc(44 + n * 4);
    buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
    buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(sr, 24);
    buf.writeUInt32LE(sr * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
    for (let i = 0; i < n; i++) {
      buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4);
      buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4);
    }
    fs.writeFileSync(path.join(out, `${name}.wav`), buf);
  };
  for (const k of Object.keys(S)) wav(`stem-${k}`, S[k][0], S[k][1]);
  const mixL = new Float32Array(n), mixR = new Float32Array(n);
  for (const k of Object.keys(S)) for (let i = 0; i < n; i++) { mixL[i] += S[k][0][i]; mixR[i] += S[k][1][i]; }
  wav('mix', mixL, mixR);
  // per-50 ms meter (peak / RMS dBFS) of the mix and each stem
  const db = (v) => +(20 * Math.log10(v + 1e-9)).toFixed(1);
  const meter = [];
  const w = Math.round(sr * 0.05);
  for (let i = 0; i + w <= n; i += w) {
    const row = { t: +(i / sr).toFixed(2) };
    for (const [k, L, R] of [['mix', mixL, mixR], ...Object.keys(S).map((k) => [k, S[k][0], S[k][1]])]) {
      let p = 0, e = 0;
      for (let j = i; j < i + w; j++) { p = Math.max(p, Math.abs(L[j]), Math.abs(R[j])); e += L[j] * L[j] + R[j] * R[j]; }
      row[k] = [db(p), db(Math.sqrt(e / (2 * w)))];
    }
    meter.push(row);
  }
  const rel = (t) => +(t - stems.t0).toFixed(2);
  const events = [
    ...(stems.final.music.cued ?? []).map((c) => ({ time_s: rel(c.t), kind: `music:${c.cue}` })),
    ...stems.final.log.filter((e) => e.t >= stems.t0).map((e) => ({ time_s: rel(e.t), kind: e.id.replace(/-\d+$/, '') })),
  ].sort((a, b) => a.time_s - b.time_s);
  const perMinute = {};
  for (const e of events) perMinute[e.kind] = +(((perMinute[e.kind] ?? 0) + 60 / (n / sr))).toFixed(2);
  fs.writeFileSync(path.join(out, 'events.json'), JSON.stringify(events));
  const evidence = { perMinute, staging: late ? 'keepingRelease() at 85 s (dev hook)' : 'none', route: 'createSliceRoute (no teleports), sim paced to wall clock', simSeconds: seconds, wallSeconds: wall, audioSeconds: n / sr, sampleRate: sr, mixNote: 'stem sum at MIX bus gains, master at unity, pre-limiter', final: { ...stems.final, log: undefined }, events, errors };
  fs.writeFileSync(path.join(out, 'evidence.json'), JSON.stringify(evidence, null, 2));
  fs.writeFileSync(path.join(out, 'meter-50ms.json'), JSON.stringify(meter));
  fs.writeFileSync(path.join(out, 'trace.json'), JSON.stringify(trace));
  console.log(JSON.stringify({ simSeconds: seconds, wallSeconds: wall, audioSeconds: n / sr, perMinute, cued: stems.final.music.cued, ambience: stems.final.ambience, errors }).slice(0, 3000));
} finally {
  await browser.close();
  await server.close();
}
