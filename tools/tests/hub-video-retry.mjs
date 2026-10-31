import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

// CPU control-flow fixtures execute the actual capture functions with inert I/O.
// No renderer, canvas, browser or video process is created.
const source=fs.readFileSync('tools/gpu-capture.mjs','utf8');
const ast=ts.createSourceFile('gpu-capture.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const names=new Set(['captureVideoJpeg','assertHubContext','settleHubCompositor']);
const functions=[];
function visit(node) {
  if(ts.isFunctionDeclaration(node) && names.has(node.name?.text)) functions.push(node.getText(ast));
  ts.forEachChild(node,visit);
}
visit(ast);
assert.equal(functions.length,3,'Capture helper source markers changed');
async function fixture({frames=['valid'],drift=false,lost=false,timeout=false,fixedClock=true,invariantError=false,name='hub-test'}={}) {
  const writes=[],saves=[],steps=[],mimes=[];
  let shots=0,invariants=0,rafs=0;
  const context={
    report:{},path,out:'/inert',Date,Buffer,Promise,Error,
    window:{__gpuContextLost:false,__gameHooks:{debug:{renderer:{getContext:()=>({isContextLost:()=>false})}}},
      __gpuNativeRaf:callback=>{rafs++;callback();}},
    setTimeout:timeout?callback=>{callback();return 1;}:setTimeout,
    clearTimeout:timeout?()=>{}:clearTimeout,
    fs:{writeFileSync:(name,bytes)=>writes.push({name,bytes})},
    save:(name,data)=>saves.push({name,data:JSON.parse(JSON.stringify(data))}),
    H:async(...args)=>{steps.push(args);},
    hubStillInvariant:async()=>{if(invariantError)throw Error('Invariant unavailable');return {digest:drift && invariants++?'different':'fixed',pose:'same-frame',fixedClock};},
    screenshotPixels:async(buffer,mime)=>{mimes.push(mime);return {black:buffer.toString()==='black'};},
    page:{screenshot:async options=>{
      assert.equal(options.type,'jpeg');assert.equal(options.quality,96);
      const bytes=Buffer.from(frames[shots++] ?? 'black');
      if(lost && shots===2) context.window.__gpuContextLost=true;
      return bytes;
    },evaluate:async callback=>callback()},
  };
  vm.createContext(context);
  vm.runInContext(functions.join('\n')+'\nglobalThis.capture=captureVideoJpeg;',context);
  let output,error;
  try { output=await context.capture(name,425); } catch(e) {error=e;}
  return {output,error,writes,saves,steps,mimes,shots,rafs,report:context.report};
}
const good=await fixture();
assert.equal(good.output.toString(),'valid');assert.equal(good.shots,1);assert.equal(good.steps.length,0);assert.equal(good.writes.length,0);
const recovered=await fixture({frames:['black','same-frame-valid']});
assert.equal(recovered.output.toString(),'same-frame-valid');assert.equal(recovered.shots,2);
assert.deepEqual(recovered.steps,[['advance',0,1/60,true]],'Recovery must render zero simulation steps');
assert.equal(recovered.rafs,2);
assert.deepEqual(recovered.mimes,['image/jpeg','image/jpeg']);
assert.equal(recovered.writes[0].bytes.toString(),'black');assert.match(recovered.writes[0].name,/frame-00425-attempt-1-black\.jpg$/);
assert.equal(recovered.saves.length,3);assert.equal(recovered.saves[0].data['hub-test-frame-00425'].frame,425);
assert.equal(recovered.report.hubVideoAttempts['hub-test-frame-00425'].invariantsMatch,true);
for(const options of [{frames:['black','black']},{frames:['black','valid'],drift:true}]) {
  const rejected=await fixture(options);assert.match(rejected.error?.message ?? '',/recovery failed or changed/);
  assert.equal(rejected.shots,2);assert.equal(rejected.output,undefined);assert.equal(rejected.writes.length,1);
}
const lost=await fixture({frames:['black','valid'],lost:true});assert.match(lost.error?.message ?? '',/context loss/);assert.equal(lost.writes.length,1);
const stalled=await fixture({frames:['black'],timeout:true});assert.match(stalled.error?.message ?? '',/barrier timed out/);assert.equal(stalled.shots,1);
assert.equal(stalled.writes.length,1);assert.equal(stalled.saves.length,3);
assert.equal(stalled.saves[0].data['hub-test-frame-00425'].preserved,'hub-test-frame-00425-attempt-1-black.jpg');
assert.match(stalled.saves.at(-1).data['hub-test-frame-00425'].error,/barrier timed out/);
const liveClock=await fixture({frames:['black'],fixedClock:false});assert.match(liveClock.error?.message ?? '',/fixed clock required/);assert.equal(liveClock.steps.length,0);
assert.equal(liveClock.writes.length,1);assert.match(liveClock.saves.at(-1).data['hub-test-frame-00425'].error,/fixed clock required/);
const missingInvariant=await fixture({frames:['black'],invariantError:true});assert.match(missingInvariant.error?.message ?? '',/Invariant unavailable/);
assert.equal(missingInvariant.writes[0].bytes.toString(),'black');assert.equal(missingInvariant.steps.length,0);
assert.match(missingInvariant.saves.at(-1).data['hub-test-frame-00425'].error,/Invariant unavailable/);
const other=await fixture({name:'other-test',frames:['black']});assert.equal(other.output.toString(),'black');assert.equal(other.mimes.length,0);assert.equal(other.steps.length,0);
console.log('Hub JPEG retry CPU PASS: original bytes, same-frame zero-step barrier, persistent-black/drift/loss/timeout rejection, nonhub unchanged. GPU verification pending.');
