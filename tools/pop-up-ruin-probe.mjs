// Staged entry only; all subsequent movement uses real controller input. No fold/state forcing.
import {chromium} from 'playwright';
import {createServer} from 'vite';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const out=process.argv[2]||'/captures/rook/ruin-greybox'; fs.mkdirSync(out,{recursive:true});
const server=await createServer({configFile:'games/fox-spirit/vite.config.ts',server:{port:5197,host:'127.0.0.1',strictPort:true},logLevel:'error'});await server.listen();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:960,height:540},recordVideo:{dir:out,size:{width:960,height:540}}});page.setDefaultTimeout(120000);
const evidence={staging:'Only entry staged. Real keyboard jump/dash; controller world stick movement. No direct fold/restore/physics edits. Manual 60Hz clock.',samples:[],trace:[],errors:[]};page.on('pageerror',e=>evidence.errors.push(String(e)));
const motion=process.argv.includes('--motion');let simFrame=0,movieFrame=0;
if(motion)fs.mkdirSync(`${out}/frames`,{recursive:true});
async function advance(n=1,render=false){let state;for(let remaining=n;remaining>0;){const count=motion?Math.min(remaining,6-(simFrame%6)):remaining;remaining-=count;simFrame+=count;const draw=render||(motion&&simFrame%6===0);state=await page.evaluate(([n,r])=>window.__gameHooks.advance(n,1/60,r),[count,draw]);if(motion&&simFrame%6===0)await page.screenshot({path:`${out}/frames/${String(movieFrame++).padStart(5,'0')}.png`});}return state;}
const stick=async(x,z)=>page.evaluate(([x,z])=>window.__gameHooks.setStick(x,z),[x,z]);
async function sample(label){const state=await advance(1,true);evidence.samples.push({label,state});await page.screenshot({path:`${out}/${label}.png`});console.log(label,JSON.stringify({pos:state.pos,ruin:state.opening.popUpRuin,lastJump:state.lastJump}));return state;}
async function walk(x,z,max=360){let s;for(let i=0;i<max;i++){s=await advance(1);const dx=x-s.pos[0],dz=z-s.pos[2],d=Math.hypot(dx,dz);if(d<.13)break;await stick(dx/d,dz/d);evidence.trace.push(s);}await stick(0,0);await advance(14);return s;}
async function dash(){await page.keyboard.down('Shift');await advance(15);await page.keyboard.up('Shift');await stick(0,0);await advance(45);}
async function jumpTo(x,z){await page.keyboard.down('Space');let s;for(let i=0;i<130;i++){s=await advance(1);const dx=x-s.pos[0],dz=z-s.pos[2],d=Math.hypot(dx,dz);await stick(d>.12?dx/d:0,d>.12?dz/d:0);evidence.trace.push(s);if(i>16&&s.grounded)break;}await page.keyboard.up('Space');await stick(0,0);await advance(15);return s;}
async function face(x,z){await stick(x*.08,z*.08);await advance(45);await stick(0,0);}
async function runJumpNorth(takeoff,x,z){await stick(0,-1);for(let i=0;i<240;i++){const s=await advance(1);evidence.trace.push(s);if(s.pos[2]<=takeoff)break;}return jumpTo(x,z);}
async function runJumpEast(takeoff,x,z){await stick(1,0);for(let i=0;i<240;i++){const s=await advance(1);evidence.trace.push(s);if(s.pos[0]>=takeoff)break;}return jumpTo(x,z);}
async function runJump(takeoff,target){await stick(-1,0);for(let i=0;i<240;i++){const s=await advance(1);evidence.trace.push(s);if(s.pos[0]<=takeoff)break;}return jumpTo(target,75);}
try{
await page.goto('http://127.0.0.1:5197/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__gameHooks?.ready);await page.evaluate(()=>{const h=window.__gameHooks;h.setManual(true);h.teleport(-23.6,75,-Math.PI/2);h.setStick(0,0);h.advance(90,1/60,false);});
if(process.argv[3])await page.evaluate(async v=>{const m=await import('/src/opening/popUpRuin.ts');m.RUIN_FEEL.unfold=v},Number(process.argv[3]));
await sample('01-folded-entry');
await stick(-1,0);await dash();await stick(0,0);await sample('02-first-unfold');
await walk(-22.5,75);await runJump(-24.3,-26.7);await sample('03-first-land');
await walk(-26.5,77.8);await sample('03b-safe-miss');
await walk(-24,78.2);await walk(-22.5,75);await runJump(-24.3,-26.7);await sample('03c-first-retry');
await walk(-28.2,74.8);await face(0,-1);await stick(0,-1);await dash();await stick(0,0);await sample('04-second-unfold');
await walk(-28.4,75.7);await face(0,-1);await runJumpNorth(73.9,-28.4,71.2);await sample('05-second-land');
await walk(-29.4,71);await face(1,0);await runJumpEast(-27.7,-24.6,71);await sample('06-overlook');
await walk(-24.4,71.1);await face(0,1);await stick(0,1);await dash();await stick(0,0);await sample('07-return-unfold');
await walk(-24.4,75.7);await sample('08-return-ground');
await walk(-23,77);await walk(-24,75);await sample('09-retry-entry');
const at=l=>evidence.samples.find(s=>s.label===l).state;
evidence.assertions=[['first opens',at('02-first-unfold').opening.popUpRuin.folds[0].phase==='open'],['first landing',Math.abs(at('03-first-land').pos[1]+.08)<.1],['safe miss and retry',at('03b-safe-miss').grounded&&at('03b-safe-miss').opening.popUpRuin.misses>0&&Math.abs(at('03c-first-retry').pos[1]+.08)<.1],['second opens',at('04-second-unfold').opening.popUpRuin.folds[1].phase==='open'],['second landing',Math.abs(at('05-second-land').pos[1]-.47)<.1],['overlook reached',at('06-overlook').opening.popUpRuin.reached],['return opens',at('07-return-unfold').opening.popUpRuin.returns===1],['ground retry',at('09-retry-entry').grounded&&Math.hypot(at('09-retry-entry').pos[0]+24,at('09-retry-entry').pos[2]-75)<.4],['no page errors',!evidence.errors.length]].map(([name,pass])=>({name,pass}));
fs.writeFileSync(`${out}/evidence.json`,JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence.assertions));
if(evidence.assertions.some(a=>!a.pass))throw Error('Ruin route failed; inspect evidence.json');
}finally{await browser.close();await server.close();}
if(motion&&movieFrame)execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','10','-i',`${out}/frames/%05d.png`,'-c:v','libx264','-pix_fmt','yuv420p',`${out}/route.mp4`]);
