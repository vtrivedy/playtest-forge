import ts from 'typescript';
import assert from 'node:assert/strict';

/** Forge's composer owns AA; native MSAA caused full black GPU output frames. */
export function lintRenderSurface(file, source) {
  const sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS),findings=[];
  function visit(node){
    if(ts.isNewExpression(node)&&/(^|\.)WebGLRenderer$/.test(node.expression.getText(sf))){
      const options=node.arguments?.[0];
      const aa=options&&ts.isObjectLiteralExpression(options)?options.properties.find(p=>ts.isPropertyAssignment(p)&&p.name.getText(sf)==='antialias'):null;
      const explicitOff=aa&&aa.initializer.kind===ts.SyntaxKind.FalseKeyword;
      const mutableOptions=options&&ts.isObjectLiteralExpression(options)&&options.properties.some(p=>ts.isSpreadAssignment(p)||ts.isPropertyAssignment(p)&&p.name.getText(sf)==='context');
      if(!explicitOff||mutableOptions){
        const at=sf.getLineAndCharacterOfPosition(node.getStart(sf));
        findings.push(`${file}:${at.line+1} [single-aa-owner] Forge postprocessing owns AA: WebGLRenderer requires literal antialias:false and no overriding spread/context (T4/EGL black-frame regression).`);
      }
    }
    ts.forEachChild(node,visit);
  }
  visit(sf);return findings;
}

export function renderSurfaceSelfTest(){
  assert.equal(lintRenderSurface('test.ts','new THREE.WebGLRenderer({antialias:false})').length,0);
  for(const source of ['new THREE.WebGLRenderer({antialias:true})','new WebGLRenderer({antialias:policy})','new THREE.WebGLRenderer()','new THREE.WebGLRenderer({})','new THREE.WebGLRenderer({antialias:false,...options})','new THREE.WebGLRenderer({antialias:false,context:gl})'])
    assert.equal(lintRenderSurface('negative.ts',source).length,1,source);
}
