import ts from 'typescript';

export function lintDiscoverySafety(file, source) {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const bindings = new Map(), findings = [];
  function collect(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) bindings.set(node.name.text, node.initializer);
    ts.forEachChild(node, collect);
  }
  collect(sf);
  function visit(node) {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(node.left)) {
      const name = node.left.text;
      const completes = name === 'leg' && ts.isStringLiteral(node.right) && node.right.text === 'done';
      const disables = name === 'active' && node.right.kind !== ts.SyntaxKind.TrueKeyword;
      if (completes || disables) {
        let parent = node.parent;
        while (parent && !ts.isFunctionDeclaration(parent)) parent = parent.parent;
        if (parent?.name?.text !== 'completeGuide' || parent.parameters[0]?.type?.getText(sf) !== 'typeof landingToken') findings.push(`${file} [discovery-safe-completion] Only completeGuide with a current grounded-overlook proof may finish/hide the invitation.`);
      }
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'completeGuide') {
      const arg = node.arguments[0];
      const origin = arg && ts.isIdentifier(arg) ? bindings.get(arg.text) : null;
      if (!origin || !ts.isCallExpression(origin) || origin.expression.getText(sf) !== 'readOverlookLanding') findings.push(`${file} [discovery-safe-completion] Completion must consume readOverlookLanding() after a non-null check, never page.kept or the raw token.`);
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return findings;
}

export function discoverySafetySelfTest() {
  const bad = "function update(){active=!page.kept;if(page.kept)leg='done';}";
  const good = "function completeGuide(proof:typeof landingToken){leg='done';active=false;} function update(){active=true;const landing=readOverlookLanding();if(landing!==null)completeGuide(landing);}";
  if (!lintDiscoverySafety('discovery.hot.ts', bad).length || lintDiscoverySafety('discovery.hot.ts', good).length) throw new Error('Discovery completion positive/negative control failed');
  if (!lintDiscoverySafety('discovery.hot.ts', 'completeGuide(landingToken);').length) throw new Error('Raw landing token must not bypass validation');
}
