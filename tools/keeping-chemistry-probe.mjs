// Isolated browser verification of placed-coal chemistry using the real opening render.
// This probe supplies synthetic coal poses; full route input evidence is a separate gate.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
const out = process.argv[2] ?? '/tmp/keeping-chemistry-probe';
await fs.mkdir(out, { recursive: true });
const server = await createServer({ configFile:'games/fox-spirit/vite.config.ts', server:{port:5194,strictPort:true}, logLevel:'error' });
await server.listen();
let browser;
try {
  browser = await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
  const page = await browser.newPage({viewport:{width:960,height:540}});
  const errors=[];
  page.on('pageerror', e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:5194/');
  await page.waitForFunction(()=>window.__gameHooks?.ready,{timeout:180000});
  const state = await page.evaluate(async()=>{
    const {createUpdrafts}=await import('/src/chem/updraft.ts');
    const {createKeepingChemistry}=await import('/src/opening/chemistry.ts');
    const {ctx}=window.__opening;
    const h=window.__gameHooks;
    h.setManual(true);
    const y=ctx.groundH(13,75.5)+5;
    const updrafts=createUpdrafts(ctx.scene,[{id:'probe-steam',x:12,y,z:75,height:8,medium:'steam'},{id:'probe-root',x:15,y,z:75,height:8}]);
    const coal={position:ctx.fox.root.position.clone().set(12,y+.15,75),carried:true,heat:1};
    let steamEvents=0,completeEvents=0,t=0;
    const chem=createKeepingChemistry({updrafts,steamId:'probe-steam',rootId:'probe-root',coal:()=>coal,onSteam:()=>steamEvents++,onComplete:()=>completeEvents++});
    const tick=(frames)=>{for(let i=0;i<frames;i++){t+=1/60;chem.update(1/60,t);}};
    tick(90);
    const carried=chem.state();
    coal.carried=false;coal.position.y=y+4;tick(90);
    const wrongFloor=chem.state();
    coal.position.y=y+.15;tick(60);
    const steam=chem.state();
    coal.carried=true;tick(600);
    const recovered=chem.state();
    coal.carried=false;coal.position.set(15,y+.15,75);tick(60);
    const completed=chem.state();
    tick(600);
    ctx.field.restore(coal.position.clone().set(13,y,75),20,.01,{edgeMax:2});
    h.teleport(10.5,76.5,1.2);h.advance(60,1/60,false);
    const camera=window.__opening.camera;
    camera.position.set(5,y+3,81);camera.lookAt(13,y+2.5,75);camera.updateMatrixWorld();h.advance(0,1/60,true);
    return {carried,wrongFloor,steam,recovered,completed,final:chem.state(),steamEvents,completeEvents,game:window.__game.state()};
  });
  await page.screenshot({path:`${out}/steam-and-root.png`});
  await fs.writeFile(`${out}/state.json`,JSON.stringify({state,errors},null,2));
  if(errors.length||state.carried.steamLatched||state.wrongFloor.steamLatched||!state.steam.steamLatched||!state.recovered.steam.restored||!state.completed.completed||state.steamEvents!==1||state.completeEvents!==1) throw Error('Chemistry probe failed: inspect state.json');
  console.log(JSON.stringify({out,passed:true,steamEvents:state.steamEvents,completeEvents:state.completeEvents}));
} finally {await browser?.close();await server.close();}
