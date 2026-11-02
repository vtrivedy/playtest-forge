// Native scene notice timing from a staged rooftop pickup; no physical-climb claim.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.argv[2]||`/captures/hazel/page-notice-${Date.now()}`;
await fs.mkdir(out,{recursive:true});
const server=await createServer({configFile:'games/fox-spirit/vite.config.ts',server:{port:5230,host:'127.0.0.1',strictPort:true},logLevel:'error'});await server.listen();
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const evidence={scope:'Staged roof placement triggers the actual native secret/progress/Album path. Tests notice timing, not the climb.',errors:[],cases:[]};
try{
 for(const immediate of [false,true]){
  const context=await browser.newContext({viewport:{width:960,height:540}});const page=await context.newPage();page.setDefaultTimeout(120000);page.on('pageerror',e=>evidence.errors.push(String(e)));
  await page.goto('http://127.0.0.1:5230/?manual=1');await page.waitForFunction(()=>window.__gameHooks?.ready);
  const sample=async(n)=>page.evaluate(n=>{const state=window.__gameHooks.advance(n,1/60,true);return{state,visible:window.__opening.camera.getObjectByName('album-returned-notice').visible}},n);
  await page.evaluate(()=>{window.__gameHooks.teleport(13.4,94.4,Math.PI);window.__gameHooks.setStick(0,0);window.__gameHooks.setKeys([])});
  const start=await sample(1);assert.ok(start.state.opening.worlds.progress.secrets.includes('vale-loft'));assert.equal(start.visible,true);
  const label=immediate?'dismiss':'expire';await page.screenshot({path:`${out}/${label}-notice.png`});
  const result={immediate,start};evidence.cases.push(result);
  if(immediate){await page.keyboard.press('Tab');result.dismissed=await sample(1);assert.equal(result.dismissed.visible,false);assert.equal(result.dismissed.state.opening.worlds.mapOpen,true);await page.keyboard.press('Tab')}
  else{result.atSix=await sample(360);assert.equal(result.atSix.visible,true);result.afterEight=await sample(120);assert.equal(result.afterEight.visible,false);await page.screenshot({path:`${out}/expired.png`})}
  await page.evaluate(()=>{window.__noticeText=[];const original=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(t,...args){window.__noticeText.push(String(t));return original.call(this,t,...args)}});
  await page.keyboard.press('Tab');result.read=await sample(1);result.text=await page.evaluate(()=>window.__noticeText);assert.ok(result.text.includes('The house before the rain'));assert.equal(result.read.visible,false);await page.screenshot({path:`${out}/${label}-memory.png`});await page.keyboard.press('Tab');
  await page.reload();await page.waitForFunction(()=>window.__gameHooks?.ready);result.reload=await sample(60);assert.equal(result.reload.visible,false);assert.deepEqual(result.reload.state.opening.worlds.progress.secrets,['vale-loft']);
  for(const w of Object.values(result.reload.state.opening.worlds.progress.worlds)){assert.equal(w.fill,0);assert.equal(w.ability,null)}
  await fs.writeFile(`${out}/evidence.partial.json`,JSON.stringify(evidence,null,2));await context.close();
 }
 assert.deepEqual(evidence.errors,[]);evidence.completed=true;
}finally{await fs.writeFile(`${out}/evidence.json`,JSON.stringify(evidence,null,2));await browser.close();await server.close()}
console.log(`PASS native notice expiry/dismiss/read/reload: ${out}`);
