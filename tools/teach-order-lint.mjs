import ts from 'typescript';

export function lintTeachOrderSource(file, source) {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const findings = [];
  let mountAt = Infinity;
  const builders = [];
  function visit(node) {
    if (ts.isCallExpression(node)) {
      if (node.expression.getText(sf) === 'ctx.teach.mount') mountAt = node.getStart(sf);
      if (file.endsWith('/scene.ts') && ts.isIdentifier(node.expression) && /^(build|create)/.test(node.expression.text) && node.arguments.some(a => ts.isIdentifier(a) && /^(ctx|.*Ctx)$/.test(a.text))) builders.push(node);
      if (file.endsWith('/teach.hot.ts') && node.expression.getText(sf) === 't.redraw') {
        let parent = node.parent;
        while (parent) {
          if (ts.isIfStatement(parent) && /\bt\.o\b/.test(parent.expression.getText(sf))) findings.push(`${file} [teach-choice-latency] Control words must update immediately; opacity cannot defer the current instruction.`);
          parent = parent.parent;
        }
      }
      if (file.endsWith('/teach.ts') && node.expression.getText(sf) === 'ctx.onUpdate') {
        let parent = node.parent;
        while (parent && !(ts.isMethodDeclaration(parent) && parent.name.getText(sf) === 'mount')) parent = parent.parent;
        if (!parent) findings.push(`${file} [teach-offer-order] Register the teach consumer in mount, after offer providers; early consumption lets a hearth overwrite the chase.`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  for (const node of builders) if (node.getStart(sf) > mountAt) findings.push(`${file} [teach-offer-order] Build ctx offer providers before ctx.teach.mount so the consumer runs last.`);
  return findings;
}

export function teachOrderSelfTest() {
  if (!lintTeachOrderSource('opening/teach.hot.ts', 'function update(){if(want!==t.drawn&&t.o<=.01)t.redraw(want);}').length || lintTeachOrderSource('opening/teach.hot.ts', 'function update(){if(want!==t.drawn)t.redraw(want);}').length) throw new Error('Teach choice latency negative/positive control failed');
  const bad = 'function createTeach(ctx){ctx.onUpdate(dt=>updateTeach(t,dt));return{mount(cam){t.cam=cam;}};}';
  const good = 'function createTeach(ctx){return{mount(cam){t.cam=cam;ctx.onUpdate(dt=>updateTeach(t,dt));}};}';
  if (!lintTeachOrderSource('opening/teach.ts', bad).length || lintTeachOrderSource('opening/teach.ts', good).length) throw new Error('Teach consumer order negative/positive control failed');
  if (!lintTeachOrderSource('opening/scene.ts', 'ctx.teach.mount(view); buildDiscovery(ctx);').length || lintTeachOrderSource('opening/scene.ts', 'buildDiscovery(ctx); ctx.teach.mount(view);').length) throw new Error('Teach provider order negative/positive control failed');
}
