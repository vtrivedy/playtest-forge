// Diagnostic world travel fixture: asserts local invitation scope, not real portal reachability.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='/captures/hazel/world-discovery-scope-ee49c473'; await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:960,height:540}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
try {
 await page.goto('http://127.0.0.1:5180/?manual=1'); await page.waitForFunction(()=>window.__gameHooks?.ready,{timeout:120000});
 const states={};
 for(const world of ['russetvale','ashwater','press','russetvale']){
  const state=await page.evaluate(world=>{const h=window.__gameHooks;h.travel(world);h.advance(60);return window.__game.state()},world);
  const name=world==='russetvale'&&states[world]?'russetvale-return':world;states[name]=state;
  if(world==='russetvale'){assert.equal(state.opening.discovery.visible,true);assert.equal(state.opening.teach.showing,'Follow the loose page')}
  else{assert.equal(state.opening.discovery.visible,false);assert.notEqual(state.opening.teach.showing,'Follow the loose page')}
  await page.screenshot({path:`${out}/${name}.png`});
 }
 assert.equal(errors.length,0);await fs.writeFile(`${out}/report.json`,JSON.stringify({scope:'dev-travel diagnostic only',errors,states},null,2));
 console.log('PASS local invitation visible in autumn, hidden in Ashwater/Press, restored on return; 0 page errors');
} finally {await browser.close()}
