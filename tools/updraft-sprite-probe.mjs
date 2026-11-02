// Render the actual updraft shader alone at known lens depths; inspect GPU pixels,
// not shader source patterns. Optional --baseline-sha proves the old shader fails.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const out=path.resolve(process.argv[2]??'/tmp/updraft-sprites');
const at=process.argv.indexOf('--baseline-sha');
const baselineSha=at<0?null:process.argv[at+1];
let baseline=null;
if(baselineSha){
  const text=execFileSync('git',['show',`${baselineSha}:games/fox-spirit/src/chem/updraft.ts`],{encoding:'utf8'});
  baseline=text.slice(text.indexOf('const embers = new THREE.ShaderMaterial')).match(/vertexShader:[^`]*`([\s\S]*?)`/)?.[1];
  if(!baseline)throw Error('Baseline ember shader missing');
}
fs.mkdirSync(out,{recursive:true});
const server=await createServer({configFile:'games/fox-spirit/vite.config.ts',server:{port:5194,host:'127.0.0.1',strictPort:true},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:480,height:270}});
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
  await page.goto('http://127.0.0.1:5194/?manual=1',{waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForFunction(()=>window.__gameHooks?.ready===true,null,{timeout:300000});
  const samples=await page.evaluate(async ({baseline,threeUrl})=>{
    const THREE=await import(threeUrl);
    const renderer=window.__opening.ctx.renderer;
    const hearth=window.__opening.ctx.scene.getObjectByName('hearth-kiln');
    const source=hearth.children.find(c=>c.isPoints&&c.material.uniforms?.uEmberSize)?.material;
    if(!source)throw Error('Live kiln ember shader missing');
    const target=new THREE.WebGLRenderTarget(96,96);
    const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(50,1,.02,100);
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(3),3));
    geometry.setAttribute('seed',new THREE.BufferAttribute(new Float32Array([.2,.1,.3,0]),4));
    const shader=source.clone();
    const points=new THREE.Points(geometry,shader);points.frustumCulled=false;scene.add(points);
    const previousTarget=renderer.getRenderTarget(),colour=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha();
    const pixels=new Uint8Array(96*96*4),samples=[];
    try{
      renderer.setRenderTarget(target);renderer.setClearColor(0,1);
      for(const variant of baseline?['current','baseline']:['current']){
        shader.vertexShader=variant==='baseline'?baseline:source.vertexShader;shader.needsUpdate=true;
        shader.uniforms.uTime.value=0;shader.uniforms.uHeat.value=1;shader.uniforms.uHeight.value=9;
        shader.uniforms.uRadius.value=2.2;shader.uniforms.uScale.value=640;shader.uniforms.uEmberSize.value=1;
        for(const leaf of [0,1]){
          geometry.attributes.seed.setW(0,leaf);geometry.attributes.seed.needsUpdate=true;
          const ph=.2,y=ph*9*(leaf?.95:1),angle=.3*Math.PI*2+ph*5;
          const r=2.2*(leaf?.35+.45*.1:.08+.7*Math.sqrt(.1))*(.55+.45*ph);
          const x=Math.cos(angle)*r,z=Math.sin(angle)*r;
          for(const depth of [.5,1.5,3]){
            camera.position.set(x,y,z+depth);camera.lookAt(x,y,z);camera.updateMatrixWorld();
            renderer.clear();renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,96,96,pixels);
            let minX=96,minY=96,maxX=-1,maxY=-1,count=0;
            for(let y=0;y<96;y++)for(let x=0;x<96;x++){
              const i=(y*96+x)*4;
              if(Math.max(pixels[i],pixels[i+1],pixels[i+2])<=4)continue;
              count++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
            }
            const width=count?maxX-minX+1:0,height=count?maxY-minY+1:0,limit=leaf?28:16;
            const pass=depth===.5?count===0:width<=limit&&height<=limit&&(depth!==3||count>0);
            samples.push({variant,kind:leaf?'leaf':'ember',depth,width,height,count,pass,pixels:Array.from(pixels)});
          }
        }
      }
    }finally{
      renderer.setRenderTarget(previousTarget);renderer.setClearColor(colour,alpha);
      target.dispose();geometry.dispose();shader.dispose();
    }
    return samples;
  },{baseline,threeUrl:`/@fs/${path.resolve('node_modules/three/build/three.module.js')}`});
  for(const s of samples){fs.writeFileSync(path.join(out,`${s.variant}-${s.kind}-${s.depth}.rgba`),new Uint8Array(s.pixels));delete s.pixels;}
  const current=samples.filter(s=>s.variant==='current'),bad=samples.filter(s=>s.variant==='baseline');
  const result={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),baselineSha,errors,samples,pass:!errors.length&&current.every(s=>s.pass)&&(!baselineSha||bad.some(s=>!s.pass)),scope:'actual shader GPU raster at96x96; controlled individual sprite, no bloom'};
  fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));if(!result.pass)process.exitCode=1;
}finally{await browser.close();await server.close();}
