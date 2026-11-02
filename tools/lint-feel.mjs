#!/usr/bin/env node
// Feel lint: bugs we already fixed once, as rules so they can't come back (Kit :1520, after poteto's tibo.dog notes).
// Scans the opening's runtime code; a line may opt out with `// lint-feel: ok <reason>`.
//   node tools/lint-feel.mjs            (exit 1 on any finding)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'games/fox-spirit/src/opening';
const RULES = [
  {
    id: 'fixed-frame-time',
    test: (l) => /\b1\s*\/\s*60\b/.test(l) && !/\badvance\s*\(/.test(l),
    why: 'per-frame code must use the real dt, not 1/60 (refresh-rate dependent damping/motion; the creature idle bug)',
  },
  {
    id: 'yaw-clamp-flip',
    test: (l) => /clamp\(\s*Math\.atan2\(/.test(l) || /clamp\(\s*rel\b/.test(l),
    why: 'clamping a wrapped bearing flips ±lim in one frame when the target crosses behind; use a damped, side-holding turn (unpressed lookToward)',
  },
  {
    id: 'set-from-raw-displacement',
    test: (l) => /rotation\.y\s*=\s*Math\.atan2\(\s*\w+\.x\s*-\s*prev/.test(l),
    why: 'heading from a raw per-frame displacement flip-flops near half turns (the page jitter); smooth the velocity and cap the turn rate',
  },
];

const findings = [];
for (const f of fs.readdirSync(ROOT).filter((n) => n.endsWith('.ts'))) {
  const file = path.join(ROOT, f);
  fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (/lint-feel:\s*ok/.test(line) || /^\s*(\/\/|\*)/.test(line)) return;
    for (const r of RULES) if (r.test(line)) findings.push(`${file}:${i + 1}  [${r.id}] ${r.why}\n    ${line.trim()}`);
  });
}
if (findings.length) {
  console.log(findings.join('\n'));
  console.log(`\nlint-feel: ${findings.length} finding(s)`);
  process.exit(1);
}
console.log('lint-feel: clean');
