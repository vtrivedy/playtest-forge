// Input-only integration evidence. Plans contain no executable code or state setters.
// node tools/world-input-probe.mjs --plan route.json --out /tmp/world-route
// {steps:[{name:'entry',frames:60,stick:[0,1],keys:[],expect:[{path:'pos.1',finite:true}]}]}
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import {createServer} from 'vite';
const arg=(key,fallback)=>{const i=process.argv.indexOf(`--${key}`);return i<0?fallback:process.argv[i+1];};
const plan=JSON.parse(fs.readFileSync(arg('plan',''),'utf8'));
if(!Array.isArray(plan.steps)||!plan.steps.length)throw Error('plan.steps must be nonempty');
for(const step of plan.steps){
  if(!/^[a-z0-9-]+$/.test(step.name)||!Number.isInteger(step.frames)||step.frames<0||step.frames>36000)throw Error('invalid step name/frames');
  if(!Array.isArray(step.stick)||step.stick.length!==2||step.stick.some(v=>!Number.isFinite(v)||Math.abs(v)>1))throw Error('invalid stick');
  if(!Array.isArray(step.keys)||step.keys.some(k=>!['Space','ShiftLeft','ShiftRight','KeyM','Escape'].includes(k)))throw Error('invalid keys');
}
const out=path.resolve(arg('out','/tmp/world-input-probe'));
fs.mkdirSync(out,{recursive:true});
const report={commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}),provenance:'Fresh default opening boot; only setKeys, setStick and fixed-step advance. No teleport, restore or puzzle setters.',plan,errors:[],steps:[],passed:false};
const port=Number(arg('port','5241'));
let server,browser;
try{
  server=await createServer({configFile:'games/fox-spirit/vite.config.ts',server:{host:'127.0.0.1',port,strictPort:true},logLevel:'error'});
  await server.listen();
  browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
  const page=await(await browser.newContext({viewport:{width:960,height:540}})).newPage();
  page.on('pageerror',e=>report.errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/?manual=1`,{waitUntil:'domcontentloaded',timeout:300000});
  await page.waitForFunction(()=>window.__gameHooks?.ready===true,null,{timeout:300000});
  for(const step of plan.steps){
    const state=await page.evaluate(step=>{
      const h=window.__gameHooks;
      h.setKeys(step.keys);h.setStick(...step.stick);
      h.advance(step.frames,1/60,true);
      return {hooks:h.state(),game:typeof window.__game.state==='function'?window.__game.state():window.__game};
    },step);
    await page.screenshot({path:path.join(out,`${report.steps.length}-${step.name}.png`)});
    const checks=(step.expect??[]).map(expect=>{
      const value=expect.path.split('.').reduce((v,k)=>v?.[k],state.hooks);
      const passed=expect.finite===true?Number.isFinite(value):JSON.stringify(value)===JSON.stringify(expect.equals);
      return {...expect,value,passed};
    });
    report.steps.push({name:step.name,state,checks,simulationSeconds:step.frames/60});
  }
  report.passed=report.errors.length===0&&report.steps.every(s=>s.checks.every(c=>c.passed));
}catch(e){report.errors.push(String(e));}
finally{
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
  await browser?.close();await server?.close();
}
console.log(JSON.stringify({passed:report.passed,commit:report.commit,steps:report.steps.length,errors:report.errors,out}));
process.exitCode=report.passed?0:1;
