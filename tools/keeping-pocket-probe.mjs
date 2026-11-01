// Soft-lock probe: flood-fills walkable floor (player.surfaceAt, rise ≤ 0.3 per 0.25 m) from the meadow at (2, 78)
// and lists cells that cannot walk back to it. `node tools/keeping-pocket-probe.mjs [after]` (after = stair open + tree settled).
import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5196, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 320, height: 200 } });
await page.goto('http://127.0.0.1:5196/', { waitUntil: 'domcontentloaded', timeout: 300000 });
await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });
const res = await page.evaluate(async (stage) => {
  const h = window.__gameHooks; h.setManual(true);
  if (stage) { h.keepingSteam(); h.keepingRelease(); h.advance(400, 1/60, false); }
  const { ctx } = window.__opening;
  const S = ctx.player.surfaceAt;
  const x0 = 0, x1 = 38, z0 = 56, z1 = 90, d = 0.25;
  const nx = Math.round((x1 - x0) / d), nz = Math.round((z1 - z0) / d);
  const H = new Float32Array(nx * nz);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const v = S(x0 + i * d, z0 + j * d); H[i * nz + j] = Number.isFinite(v) ? v : 1e9; }
  // walk graph: neighbour reachable if rise ≤ 0.3 per 0.25 (≈ slope probe), any drop allowed
  const seen = new Uint8Array(nx * nz);
  const q = [Math.round((2 - x0) / d) * nz + Math.round((78 - z0) / d)];
  seen[q[0]] = 1;
  while (q.length) {
    const c = q.pop(); const i = Math.floor(c / nz), j = c % nz;
    for (const [a, b] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
      const n = ii * nz + jj; if (seen[n]) continue;
      if (H[n] - H[c] > 0.3) continue;
      seen[n] = 1; q.push(n);
    }
  }
  // cells from which the meadow seed is NOT reachable by walking: reverse check = can a fox standing there get to the seed?
  // reverse graph: from seed, move to neighbour n if H[c] - H[n] <= 0.3 (i.e. n → c is a legal step)
  const back = new Uint8Array(nx * nz); const q2 = [q.length ? 0 : Math.round((2 - x0) / d) * nz + Math.round((78 - z0) / d)]; back[q2[0]] = 1;
  while (q2.length) { const c = q2.pop(); const i = Math.floor(c / nz), j = c % nz;
    for (const [a, b] of [[1,0],[-1,0],[0,1],[0,-1]]) { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue; const n = ii * nz + jj; if (back[n]) continue; if (H[c] - H[n] > 0.3) continue; if (H[n] > 1e8) continue; back[n] = 1; q2.push(n); } }
  const stuck = [];
  for (let n = 0; n < nx * nz; n++) if (H[n] < 1e8 && !back[n]) stuck.push([+(x0 + Math.floor(n / nz) * d).toFixed(2), +(z0 + (n % nz) * d).toFixed(2), +H[n].toFixed(2)]);
  return { stuckCount: stuck.length, stuck };
}, process.argv[2] === 'after');
// cluster summary by height band
const bands = {};
for (const [x, z, y] of res.stuck) { const k = Math.round(y); (bands[k] ??= []).push([x, z]); }
for (const [k, v] of Object.entries(bands)) { const xs = v.map(p => p[0]), zs = v.map(p => p[1]); console.log(`y≈${k}: ${v.length} cells x ${Math.min(...xs)}..${Math.max(...xs)} z ${Math.min(...zs)}..${Math.max(...zs)}`); }
console.log(JSON.stringify((bands[0]||[]).filter((_,i)=>i%3==0)));
await browser.close(); await server.close();
