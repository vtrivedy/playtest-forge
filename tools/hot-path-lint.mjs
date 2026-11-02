import ts from 'typescript';

// Follow local helper calls from frame callbacks: moving an allocation into emit()/caught()
// must not evade the gate. Construction and dev snapshots remain outside the hot graph.
export function lintHotSource(file, source) {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const functions = new Map();
  const roots = [];
  const visit = node => {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) functions.set(node.name.text, node);
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
      functions.set(node.name.text, node.initializer);
      if (/^(update|tick|frame)/i.test(node.name.text)) roots.push(node.initializer);
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && /^(onUpdate|onTick|onFrame)$/.test(node.expression.name.text)) {
      for (const arg of node.arguments) roots.push(arg);
    }
    if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.name && /^(update|tick|frame)/i.test(node.name.getText(sf))) roots.push(node);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  const findings = [], seen = new Set();
  const lines = source.split('\n');
  const report = (node, id, why) => {
    const at = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    const line = lines[at.line];
    if (/lint-feel:\s*ok\s+\S/.test(line)) return;
    findings.push(`${file}:${at.line + 1}  [${id}] ${why}\n    ${line.trim()}`);
  };
  const scanFunction = fn => {
    if (ts.isIdentifier(fn)) fn = functions.get(fn.text);
    if (!fn || seen.has(fn) || !fn.body) return;
    seen.add(fn);
    const scan = node => {
      if (ts.isNewExpression(node) || ts.isObjectLiteralExpression(node) || ts.isArrayLiteralExpression(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node)) report(node, 'no-alloc-in-hot', 'allocate during build setup, never inside a frame callback or its local helpers');
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.SlashToken && node.left.getText(sf) === '1' && /^(30|60)$/.test(node.right.getText(sf))) report(node, 'no-fixed-frame-dt', 'use elapsed dt, never a fixed frame duration');
      if (ts.isNumericLiteral(node) && node.text === '16.67') report(node, 'no-fixed-frame-dt', 'use elapsed dt, never a fixed frame duration');
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && /rotation\.y$/.test(node.left.getText(sf)) && ts.isCallExpression(node.right) && node.right.expression.getText(sf) === 'Math.atan2') report(node, 'no-bare-yaw-assign', 'damp wrapped bearing and preserve the turn side at the rear boundary');
      if (ts.isCallExpression(node)) {
        if (ts.isIdentifier(node.expression)) scanFunction(functions.get(node.expression.text));
        if (ts.isPropertyAccessExpression(node.expression) && ['map', 'filter', 'slice', 'concat', 'flat', 'flatMap', 'toArray', 'clone'].includes(node.expression.name.text)) report(node, 'no-alloc-in-hot', 'this method creates a temporary collection/object on the hot path');
        if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'state') report(node, 'no-diagnostic-snapshot-in-hot', 'state() is a cold diagnostic snapshot; read a reusable live scalar view in frame code');
        if (node.expression.getText(sf) === 'Math.random') report(node, 'no-unseeded-hot-random', 'use a seeded stream so gameplay replays from identical inputs');
      }
      ts.forEachChild(node, scan);
    };
    scan(fn.body);
  };
  for (const root of roots) scanFunction(root);
  return findings;
}

export function hotLintSelfTest() {
  const bad = [
    'function build(){ctx.onUpdate((dt)=>{ const m = new THREE.Matrix4(); });}',
    'function build(){const emit=()=>{return {x:1};}; ctx.onUpdate((dt)=>{emit();});}',
    'function build(){ctx.onUpdate((dt)=>{const ahead = perches.map(p=>p+1).filter(p=>p>0);});}',
    'function update(dt){const options = [];}',
    'function tick(dt){Math.random();}',
    'function update(dt){y += 1 / 30;}',
    'function frame(dt){body.rotation.y = Math.atan2(x,z);}',
    'function update(dt){const s=player.state();}',
    'const updateEnvelope=(dt)=>{return {x:dt};};',
  ];
  for (const source of bad) if (!lintHotSource('fixture.hot.ts', source).length) throw new Error(`hot lint missed: ${source}`);
  const good = 'function build(){const p=new THREE.Vector3(); const options={edgeMax:3}; function emit(){p.set(1,2,3);} ctx.onUpdate((dt)=>{emit();p.x+=dt;});return {state:()=>({pos:p.toArray()})};}';
  if (lintHotSource('fixture.hot.ts', good).length) throw new Error('hot lint rejected preallocation / cold diagnostics');
}
