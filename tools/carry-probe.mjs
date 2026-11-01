// Carry acceptance through live controller input. Initial placements are STAGED and disclosed.
// node tools/carry-probe.mjs --out /tmp/carry-probe [--url http://127.0.0.1:5180]
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const arg = (key, fallback) => {
  const i = process.argv.indexOf(`--${key}`);
  return i < 0 ? fallback : process.argv[i + 1];
};
const out = path.resolve(arg('out', '/tmp/carry-probe'));
const portraitOnly = process.argv.includes('--portrait-only');
fs.mkdirSync(out, { recursive: true });
const remote = arg('url', '');
const server = remote ? null : await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5197, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server?.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 960, height: 540 }, recordVideo: { dir: out, size: { width: 960, height: 540 } } });
const page = await context.newPage();
page.setDefaultTimeout(120000);
const evidence = { staging: 'Initial and per-comparison teleports to authored coal source; keys/stick drive every action; no heat/latch state forced.', samples: [], assertions: [] };
page.on('pageerror', e => evidence.samples.push({ pageerror: String(e) }));
async function advance(frames = 1) {
  return page.evaluate(n => window.__gameHooks.advance(n, 1 / 60, true), frames);
}
async function sample(label, frames = 1, screenshot = false) {
  const state = await advance(frames);
  evidence.samples.push({ label, state });
  if (screenshot) await page.screenshot({ path: path.join(out, `${label}.png`) });
  return state;
}
const coal = s => s.opening.carry;
async function press(key, frames = 1) {
  await page.keyboard.down(key);
  const s = await advance(frames);
  await page.keyboard.up(key);
  await advance(1);
  return s;
}
function check(name, value) {
  evidence.assertions.push({ name, pass: !!value });
  assert.ok(value, name);
}
try {
  await page.goto(remote || 'http://127.0.0.1:5197/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__gameHooks?.ready, null, { timeout: 120000 });
  await page.evaluate(() => window.__gameHooks.setManual(true));
  const initial = await advance();
  assert.ok(initial.opening?.carry, 'Scene must expose opening.carry');
  const source = coal(initial).position;
  const start = [source[0], source[2] - 0.6, 0];
  async function stage() {
    await page.evaluate(([x,z,yaw]) => {
      const h = window.__gameHooks;
      h.setStick(0,0); h.setKeys([]); h.teleport(x,z,yaw); h.advance(12,1/60,true);
    }, start);
  }
  await stage();
  await sample('01-source', 1, true);
  await page.keyboard.down('e');
  const picked = await sample('02-carried', 30, true);
  check('Held E picks up exactly once', coal(picked).carried && coal(picked).pickups === 1 && coal(picked).placements === 0);
  // Disclosed inspection lens for mouth contact; the action still above uses normal chase cam.
  await page.evaluate(() => {
    const { camera, ctx } = window.__opening;
    window.__carrySavedCamera = { pos: camera.position.clone(), quat: camera.quaternion.clone() };
    const p = ctx.fox.root.position;
    camera.position.set(p.x + 1.3, p.y + 0.8, p.z + 1.6);
    camera.lookAt(p.x, p.y + 0.35, p.z + 0.15);
    window.__gameHooks.advance(0);
  });
  await page.screenshot({ path: path.join(out, '02b-carried-contact-staged-lens.png') });
  await page.evaluate(() => {
    const { camera } = window.__opening;
    camera.position.copy(window.__carrySavedCamera.pos);
    camera.quaternion.copy(window.__carrySavedCamera.quat);
    window.__gameHooks.advance(0);
  });
  if (process.argv.includes('--mouth-variants')) {
    for (const [name, values] of [
      ['jaw-a', { mouthSide: 0.09, mouthForward: 0.13, mouthLower: 0.055, emberSize: 0.085 }],
      ['jaw-b', { mouthSide: 0.045, mouthForward: 0.13, mouthLower: 0.065, emberSize: 0.075 }],
    ]) {
      await page.evaluate(values => Object.assign(window.__gameHooks.carry, values), values);
      await sample(`variant-${name}-chase`, 60, true);
      await page.evaluate(() => {
        const { camera, ctx } = window.__opening;
        window.__carrySavedCamera = { pos: camera.position.clone(), quat: camera.quaternion.clone() };
        const p = ctx.fox.root.position;
        camera.position.set(p.x + 1.3, p.y + 0.8, p.z + 1.6);
        camera.lookAt(p.x, p.y + 0.35, p.z + 0.15);
        window.__gameHooks.advance(0);
      });
      await page.screenshot({ path: path.join(out, `variant-${name}-contact.png`) });
      await page.evaluate(() => {
        const { camera } = window.__opening;
        camera.position.copy(window.__carrySavedCamera.pos);
        camera.quaternion.copy(window.__carrySavedCamera.quat);
      });
    }
  }
  await page.keyboard.up('e'); await advance(1);
  if (!portraitOnly) {
    await press('Space', 12);
    const air = await sample('03-carried-jump', 5, true);
    check('Jump preserves Carry', !air.grounded && coal(air).carried);
    const dash = await press('Shift', 1);
    evidence.samples.push({ label: 'air-dash-drop', state: dash });
    check('Air dash drops coal and still dashes', !coal(dash).carried && dash.dashing && coal(dash).dashDrops === 1);
    const drop = coal(dash).position;
    check('Air dash coal at grounded altitude', Math.abs(drop[1] - source[1]) < 0.3);
    await sample('04-dash-drop', 50, true);
    await stage();
    const recovered = await press('e');
    check('Dropped coal recoverable', coal(recovered).carried);
    await page.keyboard.down('Space');
    const glide = await sample('04b-carried-glide', 30, true);
    check('Hold-jump glide preserves Carry', glide.gliding && coal(glide).carried);
    await page.keyboard.up('Space');
    await advance(90);
    const placed = await press('e');
    check('Grounded E places coal', !coal(placed).carried && coal(placed).placements === 1);
    const settled = await sample('05-placed-keeps-burning', 120, true);
    check('Placed coal stays hot', coal(settled).heat === 1 && !coal(settled).cooling);
    check('Placed coal stays where left', Math.hypot(...coal(settled).position.map((v,i) => v - coal(placed).position[i])) < 0.001);
    await press('e');
    await stage();
    await page.evaluate(() => window.__gameHooks.setStick(null));
    await page.keyboard.down('w');
    const carryingRun = await advance(20);
    await page.keyboard.up('w');
    await stage();
    await press('e');
    await page.evaluate(() => window.__gameHooks.setStick(null));
    await page.keyboard.down('w');
    const emptyRun = await advance(20);
    await page.keyboard.up('w');
    check('Carrying preserves acceleration and run speed', Math.abs(carryingRun.speed - emptyRun.speed) < 0.015);
    evidence.samples.push({ label: 'movement-comparison', carryingRun, emptyRun });
  }
  if (!portraitOnly) {
    // Disclosed staged starts at each bowl rim; all pickup/place/reactions use live E input.
    if (!coal(await advance()).carried) { await stage(); await press('e'); }
    for (const name of ['steam', 'root']) {
      const bowl = (await advance()).opening.chemistry[name].position;
      await page.evaluate(([x,y,z]) => {
        const h = window.__gameHooks;
        h.setStick(0,0); h.setKeys([]); h.teleport(x, z + 1.4, Math.PI); h.advance(90,1/60,true);
      }, bowl);
      const before = await sample(`06-${name}-rim-carried`, 1, true);
      const placed = await press('e');
      check(`${name}: rim E places in bowl bed`, !coal(placed).carried && Math.hypot(...coal(placed).position.map((v,i) => v-bowl[i])) < 0.01);
      check(`${name}: fox stays outside bowl`, Math.hypot(placed.pos[0]-bowl[0],placed.pos[2]-bowl[2]) > 1.2);
      await sample(`07-${name}-rim-placed`, 180, true);
      const recovered = await press('e');
      check(`${name}: coal recoverable from same rim`, coal(recovered).carried);
      evidence.samples.push({ label: `${name}-rim-pose`, before });
    }
  }
  console.log(JSON.stringify({ out, assertions: evidence.assertions }, null, 2));
} finally {
  fs.writeFileSync(path.join(out, 'evidence.json'), JSON.stringify(evidence, null, 2));
  await context.close();
  await browser.close();
  await server?.close();
}
