/** Final milestone: explicitly staged chapter starts, live controller thereafter. */
export async function captureFinale({H,boot,video,shot,save,getPage,fps,out,execFileSync,fs,path}) {
  const clips=[], chapters=[];
  for (const name of ['arrival','windmill','reedmarsh']) {
    await boot('high',true);
    const page=getPage();
    await H('setKeys',[]);await H('setStick',null);await H('photoOff');
    const route=await H('route');
    if(name==='arrival')await H('autopilot',true,0,{assist:false});
    if(name==='windmill') {
      const idx=route.findIndex(w=>w.label==='cp-mills');if(idx<0)throw Error('No mill chapter start');
      const p=route[idx], y=await page.evaluate(p=>window.__gameHooks.debug.world.collision.groundAt(p.x,p.z,p.y+.5).y,p);
      if(!Number.isFinite(y)||y<p.y-1)throw Error('Unsafe mill chapter start');
      await H('teleport',p.x,y,p.z,Math.PI);await H('advance',3,1/60,false);await H('autopilot',true,idx,{assist:false});
    }
    if(name==='reedmarsh') {
      const y=await page.evaluate(()=>window.__gameHooks.debug.world.collision.groundAt(90,15,1.7).y);
      if(!Number.isFinite(y)||y<.2)throw Error('Unsafe Reedmarsh start');
      await H('teleport',90,y,15,Math.PI/2);await H('advance',3,1/60,false);
    }
    let phase=0, lift=false;
    const approach=[[92.4,12.6],[95,10],[98.4,10.5],[96,16.1],[95,17]];
    await video(`final-${name}`,20*fps,async()=>{
      if(name!=='reedmarsh')return;
      const st=await H('state'), hp=st.chem.hearths.find(h=>h.id==='HP');
      let target=approach[Math.min(phase,approach.length-1)], keys=[];
      if(phase>=approach.length) {
        target=st.pos[1]<15.5?[95,18]:[95.8,19.8];
        if(hp?.heat>.9)lift=true;
        if(lift&&st.pos[1]<15.5)keys=['Space'];
      }
      const dx=target[0]-st.pos[0], dz=target[1]-st.pos[2], d=Math.hypot(dx,dz),m=Math.min(.6,d/.75);
      await H('setStick',d>.08?dx/d*m:0,d>.08?dz/d*m:0);await H('setKeys',keys);
      if(phase<approach.length&&d<.28)phase++;
    },undefined,{traceEveryFrame:true,keyFrames:[0,5*fps,10*fps,15*fps,20*fps-1]});
    await H('setKeys',[]);await H('setStick',null);await shot(`final-${name}-end`);
    const end=await H('state');chapters.push({name,stagedStart:name!=='arrival',end});clips.push(path.join(out,`final-${name}.mp4`));
  }
  const concat=path.join(out,'gameplay-concat.txt');fs.writeFileSync(concat,clips.map(p=>`file '${p}'`).join('\n'));
  execFileSync('ffmpeg',['-y','-v','error','-f','concat','-safe','0','-i',concat,'-c','copy',path.join(out,'gameplay-60s.mp4')]);
  save('final-gameplay.json',{label:'Editorial three-chapter gameplay; staged starts disclosed, no forced solves; Arrival Meadow substitutes for unbuilt Lanternhollow hub',chapters,seconds:60});
  await boot('high',true);
  const y=await getPage().evaluate(()=>window.__gameHooks.debug.world.collision.highestAt(0,70));
  await H('teleport',0,y,70,-Math.PI/2);await H('setStick',-.45,0);
  await video('fox-closeup-run',6*fps,async()=>{},undefined,{traceEveryFrame:true,keyFrames:[0,2*fps,4*fps,6*fps-1],afterStep:async(i,st)=>{
    await H('photo',[st.pos[0],st.pos[1]+1.2,st.pos[2]+4.8],[st.pos[0],st.pos[1]+.65,st.pos[2]],38);
  }});
  await H('setStick',null);await H('setKeys',[]);
}
