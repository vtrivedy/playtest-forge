import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const out=process.argv[2] || '/captures/sorrel/homecoming-deferred';
fs.mkdirSync(out,{recursive:true});
const evidence={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),staging:'Page-only homecoming dev hook; initial remote root-hearth and later plaza teleports. Ordinary stick before/after pause. No creature release or camera override. 30Hz manual simulation.',samples:[],errors:[]};
const save=()=>fs.writeFileSync(`${out}/evidence.json`,JSON.stringify(evidence,null,2));
const server=await createServer({configFile:'games/fox-spirit/vite.config.ts',server:{port:5239,host:'127.0.0.1',strictPort:true},logLevel:'error'});await server.listen();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:640,height:360}});page.setDefaultTimeout(300000);page.on('pageerror',e=>evidence.errors.push(String(e)));
const record=async(name,n=30)=>{
 const sample=await page.evaluate(({name,n})=>{const h=window.__gameHooks;h.advance(n,1/30,true);const c=window.__opening.camera;return {name,game:window.__game.state(),path:window.__opening.ctx.player.cam.pathState(),camera:{pos:c.position.toArray(),quat:c.quaternion.toArray()}};},{name,n});
 evidence.samples.push(sample);save();await page.screenshot({path:`${out}/${name}.png`});console.log(name,JSON.stringify({home:sample.game.opening.homecoming,onward:sample.game.opening.finale.onward,path:sample.path}));return sample;
};
try{
 await page.goto('http://127.0.0.1:5239/?manual=1',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__gameHooks?.ready);
 await page.evaluate(()=>{const h=window.__gameHooks;h.setManual(true);h.teleport(28,76,Math.PI);h.advance(60,1/30,false);h.homecoming();});
 await record('01-remote-page',240);
 await page.evaluate(()=>{const h=window.__gameHooks;h.setStick(0,-.2);h.teleport(-7.2,88,Math.PI);});
 await record('02-plaza-walking',30);
 await page.evaluate(()=>window.__gameHooks.setStick(0,0));
 await record('03-plaza-paused',30);
 await record('04-reveal-held',30);
 await page.evaluate(()=>window.__gameHooks.setStick(0,-1));
 await record('05-move-yield',15);
 await record('06-move-return',60);
 await page.evaluate(()=>{const h=window.__gameHooks;h.setStick(0,0);h.advance(150,1/30,false);h.teleport(-7.2,88,Math.PI);});
 await record('07-plaza-revisit',120);
 const s=Object.fromEntries(evidence.samples.map(x=>[x.name,x]));
 evidence.checks={pageOnly:evidence.samples.every(x=>x.game.opening.homecoming.pinned && !x.game.opening.homecoming.full && x.game.opening.homecoming.lit.length===1),onward:evidence.samples.every(x=>x.game.opening.finale.onward===48),remotePending:s['01-remote-page'].path===null,remoteCameraNearFox:Math.hypot(s['01-remote-page'].camera.pos[0]-s['01-remote-page'].game.pos[0],s['01-remote-page'].camera.pos[2]-s['01-remote-page'].game.pos[2])<15,walkingPending:s['02-plaza-walking'].path===null,pausedReveal:!!s['03-plaza-paused'].path,heldReveal:!!s['04-reveal-held'].path,moveYield:s['05-move-yield'].path?.yielding===true,moveReturns:s['06-move-return'].path===null,revisitNoReplay:s['07-plaza-revisit'].path===null,finite:evidence.samples.every(x=>[...x.camera.pos,...x.camera.quat,...x.game.pos].every(Number.isFinite)),noErrors:evidence.errors.length===0};save();console.log(JSON.stringify(evidence.checks));if(Object.values(evidence.checks).some(v=>!v))process.exitCode=1;
}finally{save();await browser.close();await server.close();}
