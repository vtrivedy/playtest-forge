// Village stuck gate: the naive well-plaza wander (tools/naive-explore.mjs --tether 14, 90 s) over fixed seeds must
// stay under a stuck budget. b4fa63a measured 16.9 / 6.7 / 15.6 stuck-seconds on seeds 1-3; the wall slide brought it
// to a few seconds. A controller or village-layout change that traps the fox again fails here.
//   node tools/checks/village-stuck.mjs [--budget 4]   (mean stuck-seconds per 90 s run)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const i = process.argv.indexOf('--budget');
const budget = i > 0 ? Number(process.argv[i + 1]) : 4;
const seeds = [1, 2, 3];
const rows = seeds.map((seed) => {
  const out = `/tmp/village-stuck-${seed}`;
  execFileSync('node', ['tools/naive-explore.mjs', '--seconds', '90', '--frames', '0', '--tether', '14', '--seed', String(seed), '--out', out], { stdio: 'ignore' });
  const r = JSON.parse(fs.readFileSync(`${out}/naive.json`, 'utf8'));
  return { seed, unsticks: r.unsticks, stuckSeconds: r.stuckSeconds, errors: r.errors.length };
});
const mean = rows.reduce((a, r) => a + r.stuckSeconds, 0) / rows.length;
console.table(rows);
const ok = mean <= budget && rows.every((r) => r.errors === 0);
console.log(`village-stuck: mean ${mean.toFixed(2)} stuck-s / 90 s (budget ${budget}) ${ok ? 'PASS' : 'FAIL'}`);
process.exit(ok ? 0 : 1);
