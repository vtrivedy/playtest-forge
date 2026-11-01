// Authored chemistry/lift/bridge regression. Transfers are STAGED teleports; actions use real keys.
import {chromium} from 'playwright';
import {createServer} from 'vite';
import fs from 'node:fs';
const out=process.argv[2]||'/tmp/keeping-authored-probe'; fs.mkdirSync(out,{recursive:true});
const server=await createServer({configFile:'games/fox-spirit/vite.config.ts',server:{port:5198,host:'127.0.0.1',strictPort:true},logLevel:'error'});await server.listen();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:960,height:540}});page.setDefaultTimeout(120000);
const evidence={staging:'Source, basin, root and bridge starts teleported. Real E pickup/place and Space lift; no heat, latch or release forced. Not uninterrupted route completion.',samples:[],errors:[]};page.on('pageerror',e=>evidence.errors.push(String(e)));
async function sample(label,shot=false){const state=await page.evaluate(()=>window.__gameHooks.advance(1,1/60,true));evidence.samples.push({label,state});if(shot)await page.screenshot({path:`${out}/${label}.png`});return state;}
async function stage(x,z,yaw=0){await page.evaluate(([x,z,yaw])=>{const h=window.__gameHooks;h.setKeys([]);h.setStick(0,0);h.teleport(x,z,yaw);h.advance(15,1/60,false);},[x,z,yaw]);}
async function advance(n){return page.evaluate(n=>window.__gameHooks.advance(n,1/60,false),n);}
async function key(k,n=1){await page.keyboard.down(k);await advance(n);await page.keyboard.up(k);await advance(1);}
try{
await page.goto('http://127.0.0.1:5198/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__gameHooks?.ready);await page.evaluate(()=>window.__gameHooks.setManual(true));
const K=await page.evaluate(async()=> (await import('/src/opening/layout.ts')).KEEPING);
await stage(K.coal.x,K.coal.z);await key('e');await sample('01-carry',true);
await stage(24.17,80.65,Math.atan2(K.steam.x-24.17,K.steam.z-80.65));await advance(360);await sample('02-carried-basin-reject');await key('e');await advance(360);await sample('03-steam',true);
await key('e');await sample('03b-rim-recovered',true);
await page.keyboard.down('Space');let maxY=-Infinity;for(let i=0;i<12;i++){const s=await advance(15);maxY=Math.max(maxY,s.pos[1]);evidence.samples.push({label:`lift-${i}`,state:s});}await sample('04-lift',true);await page.keyboard.up('Space');evidence.maxLiftY=maxY;
await stage(24.17,80.65,Math.atan2(K.steam.x-24.17,K.steam.z-80.65));await sample('05-recovered');
await stage(29.0,77.35,Math.atan2(K.root.x-29.0,K.root.z-77.35));await key('e');await advance(480);await sample('06-root-bridge',true);
await stage(K.hinge.x+K.fall.x*K.span*.5,K.hinge.z+K.fall.z*K.span*.5,Math.atan2(K.fall.x,K.fall.z));await advance(30);await sample('07-bridge-collision',true);
evidence.expected={terraceTop:K.terrace.top,bridgeTop:K.terrace.top+.12};
const at=label=>evidence.samples.find(s=>s.label===label).state;
const C=s=>s.opening.chemistry;
evidence.assertions=[
['carried coal rejects basin ignition',!C(at('02-carried-basin-reject')).steamLatched],
['placed coal latches steam',C(at('03-steam')).steamLatched],
['spring fox stays outside rim',Math.hypot(at('03-steam').pos[0]-K.steam.x,at('03-steam').pos[2]-K.steam.z)>1.05],
['same-rim recovery carries coal',at('03b-rim-recovered').opening.carry.carried],
['lift retains coal',at('04-lift').opening.carry.carried],
['lift clears authored terrace',maxY>K.terrace.top+1],
['recovery preserves steam',at('05-recovered').opening.carry.carried&&C(at('05-recovered')).steamLatched],
['root placement keeps fox outside bowl',Math.hypot(at('06-root-bridge').pos[0]-K.root.x,at('06-root-bridge').pos[2]-K.root.z)>1.05],
['root releases bridge exactly once',C(at('06-root-bridge')).releases===1&&at('06-root-bridge').opening.keeping.impacts===1],
['bridge supports player',at('07-bridge-collision').grounded&&Math.abs(at('07-bridge-collision').pos[1]-evidence.expected.bridgeTop)<.03],
['no page errors',evidence.errors.length===0]
].map(([name,pass])=>({name,pass}));
fs.writeFileSync(`${out}/evidence.json`,JSON.stringify(evidence,null,2));console.log(JSON.stringify({out,maxLiftY:maxY,states:evidence.samples.filter(s=>!s.label.startsWith('lift-')).map(s=>({label:s.label,pos:s.state.pos,carry:s.state.opening.carry.carried,chem:s.state.opening.chemistry,keeping:s.state.opening.keeping}))},null,2));
if(evidence.assertions.some(a=>!a.pass))throw Error('Authored Keeping regression failed; inspect evidence.json');
}finally{await browser.close();await server.close();}
