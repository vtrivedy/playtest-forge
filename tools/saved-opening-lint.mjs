import ts from 'typescript';

// The page and invitation must consume the same persisted completion fact at construction.
export function lintSavedOpening(source) {
  const sf = ts.createSourceFile('scene.ts', source, ts.ScriptTarget.Latest, true);
  const bindings = new Map(), calls = new Map();
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) bindings.set(node.name.text, node.initializer);
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) calls.set(node.expression.text, node);
    ts.forEachChild(node, visit);
  }
  visit(sf);
  const page = calls.get('buildRunawayPage'), discovery = calls.get('buildDiscovery');
  const pageFact = page?.arguments[1], guideFact = discovery?.arguments[4];
  if (!pageFact || !guideFact || !ts.isIdentifier(pageFact) || !ts.isIdentifier(guideFact) || pageFact.text !== guideFact.text) return ['scene.ts [saved-opening] Page and discovery must initialize from the same saved completion fact.'];
  const fact = bindings.get(pageFact.text);
  if (!fact || !ts.isCallExpression(fact) || !ts.isPropertyAccessExpression(fact.expression)
    || fact.expression.name.text !== 'isRestored' || fact.arguments[0]?.text !== 'russetvale' || fact.arguments[1]?.text !== 'teach'
    || fact.pos > page.pos || fact.pos > discovery.pos) return ['scene.ts [saved-opening] Initialization must read restored Russetvale teach before building page and discovery.'];
  return [];
}

export function savedOpeningSelfTest() {
  const good = "const saved=progress.isRestored('russetvale','teach');buildRunawayPage(ctx,saved);buildDiscovery(ctx,page,canopy,ruin,saved);";
  for (const bad of [good.replace('ctx,saved', 'ctx'), good.replace('ruin,saved', 'ruin,false'), good.replace("'teach'", "'combine'")]) {
    if (!lintSavedOpening(bad).length) throw new Error('Saved opening negative control escaped');
  }
  if (lintSavedOpening(good).length) throw new Error('Saved opening positive control failed');
}
