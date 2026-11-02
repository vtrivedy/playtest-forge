// Focused staged-start real-input check of the mill's authored colour payoff.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const i = process.argv.indexOf('--out');
const out = path.resolve(i < 0 ? '/tmp/millbrook-colour' : process.argv[i + 1]);
fs.mkdirSync(out, { recursive: true });
const report = { sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), stagedStart: true, errors: [], observations: [], complete: false };
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5196, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
  page.setDefaultTimeout(300000);
  page.on('pageerror', e => report.errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  await page.goto('http://127.0.0.1:5196/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__gameHooks?.ready);
  await page.evaluate(() => {
    const h = window.__gameHooks;
    h.setManual(true);
    h.audioContext?.()?.suspend?.();
    h.teleport(-71.6, 101.6, -Math.PI / 2);
    h.advance(30, 1 / 60, false);
  });
  for (const [name, steps, dash] of [['held', 0, false], ['dash', 24, true], ['water-arrival', 120, false], ['wash', 120, false], ['settled', 240, false]]) {
    const observation = await page.evaluate(({ name, steps, dash }) => {
      const h = window.__gameHooks;
      const { ctx, camera } = window.__opening;
      h.setStick(dash ? -1 : 0, dash ? -0.05 : 0);
      h.setKeys(dash ? ['ShiftLeft'] : []);
      h.advance(steps, 1 / 60, false);
      camera.position.set(-59, 8, 86);
      camera.lookAt(-74, 2, 98);
      camera.updateMatrixWorld();
      h.advance(0, 1 / 60, true);
      return { name, steps, dash, game: window.__game, state: h.state(), restores: ctx.field.restores.map(r => ({ center: r.center.toArray(), radius: r.radius, target: r.targetRadius })) };
    }, { name, steps, dash });
    report.observations.push(observation);
    await page.screenshot({ path: path.join(out, `${name}.png`) });
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    console.log(name, JSON.stringify(observation.state.opening.millrace));
  }
  const last = report.observations.at(-1).state.opening.millrace;
  report.complete = true;
  report.pass = last.painted && last.turning && report.errors.length === 0;
  if (!report.pass) process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  await server.close();
}
