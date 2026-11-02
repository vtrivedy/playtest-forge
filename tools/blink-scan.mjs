// Black-frame scan over the full slice route (Kit: 0.1 s full-black blinks in the landing clip). Drives the shared
// input route (opening-hero-route createSliceRoute), renders every Nth frame and measures mean luminance of the actual
// canvas in-page (no screenshots), reporting any frame darker than --min (default 12/255) with its time, beat and state.
//   node tools/blink-scan.mjs [--seconds 130] [--every 2] [--size 320x180] [--min 12]
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { createSliceRoute, SLICE_START } from './opening-hero-route.mjs';
const arg = (k, d) => (process.argv.includes(`--${k}`) ? process.argv[process.argv.indexOf(`--${k}`) + 1] : d);
const seconds = Number(arg('seconds', '130')), every = Number(arg('every', '2')), min = Number(arg('min', '12'));
const [w, h] = arg('size', '320x180').split('x').map(Number);
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5193, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
page.setDefaultTimeout(600000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://127.0.0.1:5193/');
await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });
await page.evaluate(({ source, start }) => {
  const hk = window.__gameHooks;
  hk.setManual(true); hk.teleport(start.x, start.z, start.yaw);
  const c = document.createElement('canvas'); c.width = 32; c.height = 18;
  window.__blink = { route: new Function(`return (${source})`)()(), state: hk.advance(60, 1 / 60, false), f: 0, dark: [], lum: [], c, g: c.getContext('2d', { willReadFrequently: true }) };
}, { source: createSliceRoute.toString(), start: SLICE_START });
let done = false;
while (!done) {
  done = await page.evaluate(({ seconds, every, min }) => {
    const p = window.__blink, hk = window.__gameHooks, dt = 1 / 60;
    for (let i = 0; i < 120 && p.f * dt < seconds; i++) {
      const input = p.route(p.f * dt, p.state);
      hk.setStick(input.x, input.z); hk.setKeys([...(input.jump ? ['Space'] : []), ...(input.dash ? ['ShiftLeft'] : [])]);
      const render = p.f % every === 0;
      p.state = hk.advance(1, dt, render);
      if (render) {
        p.g.drawImage(window.__opening.ctx.renderer.domElement, 0, 0, 32, 18);
        const d = p.g.getImageData(0, 0, 32, 18).data;
        let s = 0; for (let k = 0; k < d.length; k += 4) s += 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2];
        const L = s / (d.length / 4);
        p.lum.push(L);
        if (L < min) p.dark.push({ t: +(p.f * dt).toFixed(2), L: +L.toFixed(1), beat: input.beat, pos: p.state.pos, cam: p.state.camera?.pos });
      }
      p.f++;
    }
    return p.f * dt >= seconds;
  }, { seconds, every, min });
}
const r = await page.evaluate(() => { const p = window.__blink; const s = [...p.lum].sort((a, b) => a - b); return { frames: p.lum.length, min: s[0], median: s[s.length >> 1], dark: p.dark }; });
console.log(JSON.stringify({ errors, ...r }, null, 1));
await browser.close(); await server.close();
