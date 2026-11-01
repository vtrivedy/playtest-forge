// Staged near/far starts; real controller walk toward H-a, screenshots + __game.
import {chromium} from 'playwright';
import {createServer} from 'vite';
import fs from 'node:fs';
const out=process.argv[2]||'/captures/rook/hearth-hint';fs.mkdirSync(out,{recursive:true});
const server=await createServer({configFile:'games/fox-spirit/vite.config.ts',server:{port:5196,host:'127.0.0.1',strictPort:true},logLevel:'error'});await server.listen();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:960,height:540}});page.setDefaultTimeout(120000);const errors=[],samples=[];page.on('pageerror',e=>errors.push(String(e)));
try {
await page.goto('http://127.0.0.1:5196/');await page.waitForFunction(()=>window.__gameHooks?.ready);
for(const [label,x,z,frames,stick] of [['far',5.6,83,180,0],['near',5.6,79,180,0],['walk-away',5.6,79,100,1],['ruin',-23.6,75,180,0]]){
const sample=await page.evaluate(([label,x,z,frames,stick])=>{const h=window.__gameHooks;h.setManual(true);h.setKeys([]);h.setStick(0,0);h.teleport(x,z,0);h.advance(180,1/60,false);h.setStick(0,stick);const state=h.advance(frames,1/60,true);h.setStick(0,0);return {label,state,game:window.__game,hud:document.querySelector('[data-opening-teach="heat"]').style.opacity}},[label,x,z,frames,stick]);samples.push(sample);await page.waitForTimeout(500);await page.screenshot({path:`${out}/${label}.png`});
}
const assertions=samples.map(s=>({name:s.label,pass:s.hud===(s.label==='near'?'1':'0')}));assertions.push({name:'no page errors',pass:!errors.length});fs.writeFileSync(`${out}/evidence.json`,JSON.stringify({samples,errors,assertions},null,2));console.log(JSON.stringify(assertions));if(assertions.some(a=>!a.pass))process.exitCode=1;
} finally {await browser.close();await server.close();}
