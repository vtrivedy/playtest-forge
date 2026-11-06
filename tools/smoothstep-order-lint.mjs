// three's MathUtils.smoothstep(x, min, max) takes x FIRST (GLSL takes it last). A numeric literal first argument means
// the edges were passed as x: `smoothstep(0.16, 0.02, t)` silently painted Press spires with the wrong pigment.
// Scans TypeScript call expressions only (shader strings are GLSL and use the other order).
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('games/fox-spirit/src');
const files = [];
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (p.endsWith('.ts')) files.push(p);
  }
};
walk(root);
const bad = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const visit = (n) => {
    if (ts.isCallExpression(n)) {
      const callee = n.expression.getText(sf);
      if (/(^|\.)smoothstep$/.test(callee) && n.arguments.length === 3) {
        const a0 = n.arguments[0];
        const lit = ts.isNumericLiteral(a0) || (ts.isPrefixUnaryExpression(a0) && ts.isNumericLiteral(a0.operand));
        if (lit) bad.push(`${path.relative(process.cwd(), f)}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1} ${n.getText(sf)}`);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
if (bad.length) {
  console.error(`smoothstep order: x goes first in THREE.MathUtils.smoothstep(x, min, max)\n  ${bad.join('\n  ')}`);
  process.exit(1);
}
console.log(`smoothstep order: ${files.length} files, no literal-first calls`);
