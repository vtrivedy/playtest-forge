// Real-time audio capture of the creature / homecoming SFX (DESIGN-audio-moss.md) from the shared graph's
// post-limiter tap: pops of all four creatures, the hare leading (bounds), the heron's hop and wheel (wingbeats),
// the page pinned, five lanterns kindling and the well-fill swell. The sim is paced to wall-clock so events land
// at their real spacing. Writes mix.webm + evidence.json (event log, peak/RMS per 50 ms).
//   node tools/sfx-capture.mjs [outDir]
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve(process.argv[2] ?? '/tmp/sfx-capture');
fs.mkdirSync(out, { recursive: true });
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5193, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
page.setDefaultTimeout(600000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
try {
  await page.goto('http://127.0.0.1:5193/', { waitUntil: 'domcontentloaded', timeout: 300000 });
  await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });
  await page.keyboard.press('KeyM');
  await page.evaluate(() => window.__gameHooks.setManual(true));
  // let every sample decode before the first event
  await page.waitForFunction(() => { const a = window.__gameHooks.state().opening.audio; return a.loaded >= a.files - 1; }, null, { timeout: 60000 });
  const result = await page.evaluate(async () => {
    const h = window.__gameHooks;
    const ac = h.audioContext();
    const stream = h.audioTap();
    const rec = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
    const chunks = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    const an = ac.createAnalyser();
    an.fftSize = 2048;
    ac.createMediaStreamSource(stream).connect(an);
    const buf = new Float32Array(an.fftSize);
    const meter = [];
    const marks = [];
    const t0 = performance.now();
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    /** advance the sim in wall-clock step for `secs`, metering every 50 ms; `each` runs before each step */
    const run = async (secs, each) => {
      const end = performance.now() + secs * 1000;
      let last = performance.now();
      while (performance.now() < end) {
        await sleep(50);
        const now = performance.now();
        const frames = Math.max(1, Math.round(((now - last) / 1000) * 60));
        last = now;
        each?.();
        h.advance(frames, 1 / 60, false);
        an.getFloatTimeDomainData(buf);
        let pk = 0, ss = 0;
        for (const v of buf) { pk = Math.max(pk, Math.abs(v)); ss += v * v; }
        meter.push({ t: +((now - t0) / 1000).toFixed(2), peak: +pk.toFixed(4), rms: +Math.sqrt(ss / buf.length).toFixed(4) });
      }
    };
    const mark = (what) => marks.push({ t: +((performance.now() - t0) / 1000).toFixed(2), what });
    rec.start(250);
    h.teleport(-3.0, 90.5, 0);
    await run(1.5);
    for (const id of ['hedgehog', 'heron', 'kit']) { mark(`pop ${id}`); h.unpress(id); await run(2.5); }
    // the hare: shadow it so it leads (its bounds), then let it settle at the ruin
    mark('pop hare'); h.unpress('hare');
    await run(9, () => {
      const c = h.state().opening.unpressed.creatures.find((k) => k.id === 'hare');
      if (c.phase === 'performing') h.teleport(c.at[0] + 1.2, c.at[2] - 1.2, 0);
    });
    // the kit is still trotting home; the homecoming wants everyone alive
    h.advance(1800, 1 / 60, false);
    h.teleport(-3.0, 90.5, 0);
    mark('homecoming (page pinned, lanterns, heron wheel, hare walks home, well fills)');
    h.homecoming();
    await run(20);
    rec.stop();
    await sleep(400);
    const blob = new Blob(chunks, { type: 'audio/webm' });
    const b64 = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
    return { b64, meter, marks, audio: h.state().opening.audio, homecoming: h.state().opening.homecoming };
  });
  fs.writeFileSync(path.join(out, 'mix.webm'), Buffer.from(result.b64, 'base64'));
  delete result.b64;
  const peak = Math.max(...result.meter.map((m) => m.peak));
  const clipped = result.meter.filter((m) => m.peak >= 0.999).length;
  fs.writeFileSync(path.join(out, 'evidence.json'), JSON.stringify({ errors, peak, clipped, ...result }, null, 2));
  console.log(JSON.stringify({ peak, clipped, marks: result.marks, counts: result.audio.counts, homecoming: result.homecoming, errors: errors.length }));
} finally {
  await browser.close();
  await server.close();
}
