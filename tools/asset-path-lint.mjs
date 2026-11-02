import ts from 'typescript';

// /assets/ is served by configureServer only. Import repo assets with ?url so the
// production graph owns them; successful dev loads do not prove deployability.
export function lintAssetSource(file, source) {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const findings = [];
  const visit = node => {
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && node.text.startsWith('/assets/')) {
      const at = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      findings.push(`${file}:${at.line + 1}  [no-dev-only-asset-url] import repo assets with ?url; /assets/ literals work only through dev middleware\n    ${source.split('\n')[at.line].trim()}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return findings;
}

export function assetLintSelfTest() {
  for (const source of ["loader.loadAsync('/assets/hero/fox.glb');", "loader.load(timber ? '/assets/bark.jpg' : stoneUrl);"]) {
    if (!lintAssetSource('fixture.ts', source).length) throw new Error('asset lint missed a dev-only URL');
  }
  if (lintAssetSource('fixture.ts', "import foxUrl from '../../../assets/fox.glb?url'; loader.loadAsync(foxUrl);").length) throw new Error('asset lint rejected a bundled import');
}
