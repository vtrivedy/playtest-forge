import ts from 'typescript';

/** Guard the semantic wiring, not merely a debug snapshot's shape. */
export function lintAutumnSave(sceneSource, progressSource) {
  const scene = ts.createSourceFile('scene.ts', sceneSource, ts.ScriptTarget.Latest, true);
  const calls = new Map(), bindings = new Map();
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) bindings.set(node.name.text, node.initializer);
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) calls.set(node.expression.text, node);
    ts.forEachChild(node, visit);
  }
  visit(scene);
  const findings = [];
  for (const [fact, level, builders] of [['savedMill', 'develop', [['createMillrace', 2], ['createMillWeir', 4]]], ['savedKeeping', 'combine', [['createKeeping', 1]]]]) {
    const init = bindings.get(fact);
    if (!init || !ts.isCallExpression(init) || !ts.isPropertyAccessExpression(init.expression)
      || init.expression.name.text !== 'isRestored' || init.arguments[0]?.text !== 'russetvale' || init.arguments[1]?.text !== level) findings.push(`scene.ts [autumn-save] ${fact} must read canonical ${level}.`);
    for (const [builder, arg] of builders) {
      const call = calls.get(builder);
      if (call?.arguments[arg]?.getText(scene) !== fact || init?.pos > call?.pos) findings.push(`scene.ts [autumn-save] ${builder} must construct from ${fact}.`);
    }
  }
  const chemistry = calls.get('createKeepingChemistry')?.arguments[0];
  const restored = chemistry && ts.isObjectLiteralExpression(chemistry) && chemistry.properties.find(p => ts.isPropertyAssignment(p) && p.name.getText(scene) === 'restoredAtLoad');
  if (!restored || restored.initializer.getText(scene) !== 'savedKeeping') findings.push('scene.ts [autumn-save] Keeping chemistry must rebuild from savedKeeping.');
  if (calls.get('createKeeping')?.pos > calls.get('createPlay')?.pos) findings.push('scene.ts [autumn-save] Saved bridge support must exist before controller proxies.');
  const sync = calls.get('syncAutumnProgress');
  if (sync?.arguments.map(a => a.getText(scene)).join('|') !== 'progress|homecoming.isPinned()|millWeir.lit|keeping.settled') findings.push('scene.ts [autumn-progress] Bind page home, kiln lit, tree settled using primitive views.');
  const progress = ts.createSourceFile('autumnProgress.hot.ts', progressSource, ts.ScriptTarget.Latest, true);
  const expected = new Set(['pageHome|teach', 'kilnLit|develop', 'treeSettled|combine']);
  function check(node) {
    if (ts.isIfStatement(node) && ts.isExpressionStatement(node.thenStatement) && ts.isCallExpression(node.thenStatement.expression)) {
      const call = node.thenStatement.expression;
      if (ts.isPropertyAccessExpression(call.expression) && call.expression.name.text === 'complete' && call.arguments[0]?.text === 'russetvale') expected.delete(`${node.expression.getText(progress)}|${call.arguments[1]?.text}`);
    }
    ts.forEachChild(node, check);
  }
  check(progress);
  if (expected.size) findings.push('autumnProgress.hot.ts [autumn-progress] Each canonical level must follow its own physical fact.');
  return findings;
}

export function autumnSaveSelfTest() {
  const scene = "const savedMill=progress.isRestored('russetvale','develop');const savedKeeping=progress.isRestored('russetvale','combine');createMillrace(ctx,wheel,savedMill);createMillWeir(ctx,parts,kiln,wheel,savedMill);createKeeping(ctx,savedKeeping);createPlay(opts);createKeepingChemistry({restoredAtLoad:savedKeeping});syncAutumnProgress(progress,homecoming.isPinned(),millWeir.lit,keeping.settled);";
  const binding = "if(pageHome)progress.complete('russetvale','teach');if(kilnLit)progress.complete('russetvale','develop');if(treeSettled)progress.complete('russetvale','combine');";
  if (lintAutumnSave(scene, binding).length) throw Error('Autumn save positive fixture failed');
  for (const bad of [scene.replace('wheel,savedMill', 'wheel,false'), scene.replace('ctx,savedKeeping', 'ctx'), scene.replace('restoredAtLoad:savedKeeping', 'restoredAtLoad:savedMill'), scene.replace('millWeir.lit', 'finale.state()'), scene.replace("'develop'", "'combine'")]) {
    if (!lintAutumnSave(bad, binding).length) throw Error('Autumn save negative fixture escaped');
  }
  if (!lintAutumnSave(scene, binding.replace('if(kilnLit)', 'if(treeSettled)')).length) throw Error('Autumn mapping negative fixture escaped');
}
