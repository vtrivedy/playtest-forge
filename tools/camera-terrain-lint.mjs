import ts from 'typescript';

export function lintTerrainCameraBinding(controller, camera) {
  const findings = [];
  for (const [source, factory, expected] of [[controller, 'createFollowCamera', 'groundH'], [camera, 'createCameraEnvelope', 'opts.terrainAt']]) {
    const sf = ts.createSourceFile('camera.ts', source, ts.ScriptTarget.Latest, true);
    let binding;
    function visit(n) {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === factory) {
        const arg = n.arguments[0];
        if (arg && ts.isObjectLiteralExpression(arg)) binding = arg.properties.find(p => ts.isPropertyAssignment(p) && p.name.getText(sf) === 'terrainAt');
      }
      ts.forEachChild(n, visit);
    }
    visit(sf);
    if (binding?.initializer.getText(sf).replace(/\s+/g, '') !== expected) findings.push(`camera [terrain-body-binding] ${factory} must receive terrainAt:${expected}; point-floor clearance cannot replace lateral body visibility.`);
  }
  return findings;
}
export function terrainCameraBindingSelfTest() {
  const controller = 'createFollowCamera({terrainAt:groundH});', camera = 'createCameraEnvelope({terrainAt:opts.terrainAt});';
  if (lintTerrainCameraBinding(controller, camera).length) throw Error('Terrain camera positive fixture failed');
  for (const bad of ['createFollowCamera({});', 'createFollowCamera({terrainAt:surface});']) if (!lintTerrainCameraBinding(bad, camera).length) throw Error('Terrain camera controller negative escaped');
  if (!lintTerrainCameraBinding(controller, 'createCameraEnvelope({terrainAt:opts.surfaceAt});').length) throw Error('Terrain camera envelope negative escaped');
}
