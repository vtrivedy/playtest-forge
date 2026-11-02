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

// *.hot.ts runs every frame / audio quantum (LEARNINGS-tibo-tla §3): no allocation outside `// cold:begin` … `// cold:end`
// (construction). Ships with the Hearthsong worklet; GC pauses there are audible clicks, not just frame hitches.
const HOT_RULES = [
  { id: 'hot-new', test: (l) => /\bnew\s+[A-Z]\w*/.test(l), why: 'allocates: preallocate in a cold block' },
  { id: 'hot-closure', test: (l) => /=>|\bfunction\s*\(/.test(l), why: 'a closure per call: hoist it to module scope' },
  { id: 'hot-literal', test: (l) => /(^|[=(,:?]|return)\s*[[{]\s*[\w'"\]}.-]/.test(l) && !/^\s*(if|else|for|while|switch|do|try)\b|\)\s*\{\s*$|\{\s*$/.test(l), why: 'object/array literal: reuse a preallocated one' },
  { id: 'hot-copy', test: (l) => /\.(map|filter|slice|concat|flatMap|push|splice|toFixed|split|join)\(|\.\.\.\w|`|Object\.(keys|entries|values|assign|fromEntries)/.test(l), why: 'allocates a new array/string/object' },
];

const findings = [];
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));
for (const file of walk(ROOT).filter((n) => n.endsWith('.ts'))) {
  const hot = file.endsWith('.hot.ts');
  let cold = false;
  fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (/\/\/\s*cold:begin/.test(line)) cold = true;
    if (/\/\/\s*cold:end/.test(line)) cold = false;
    if (/lint-feel:\s*ok/.test(line) || /^\s*(\/\/|\*|\/\*)/.test(line)) return;
    const code = line.replace(/\/\/.*$/, '');
    for (const r of RULES) if (r.test(code)) findings.push(`${file}:${i + 1}  [${r.id}] ${r.why}\n    ${line.trim()}`);
    if (hot && !cold && !/^\s*(import|export\s+(type|\{)|type\s|declare\s)/.test(code)) {
      for (const r of HOT_RULES) if (r.test(code)) findings.push(`${file}:${i + 1}  [${r.id}] ${r.why}\n    ${line.trim()}`);
    }
  });
  if (cold) findings.push(`${file}: unterminated // cold:begin`);
}
if (findings.length) {
  console.log(findings.join('\n'));
  console.log(`\nlint-feel: ${findings.length} finding(s)`);
  process.exit(1);
}
console.log('lint-feel: clean');
