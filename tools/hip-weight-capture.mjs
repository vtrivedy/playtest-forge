/** Remote hip surface experiment. The planner is CPU-only; capture runs on Modal. */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

export async function planHipWeights(repo) {
  const THREE=await import(pathToFileURL(path.join(repo,'node_modules/three/build/three.module.js')).href);
  const {GLTFLoader}=await import(pathToFileURL(path.join(repo,'node_modules/three/examples/jsm/loaders/GLTFLoader.js')).href);
  globalThis.self??=globalThis;
  globalThis.ProgressEvent??=class extends Event {constructor(type,init){super(type);Object.assign(this,init);}};
  const bytes=fs.readFileSync(path.join(repo,'assets/hero/spirit_fox.glb')),length=bytes.readUInt32LE(12);
  const doc=JSON.parse(bytes.subarray(20,20+length).toString());
  doc.buffers[0].uri=`data:application/octet-stream;base64,${bytes.subarray(28+length).toString('base64')}`;
  delete doc.images;delete doc.textures;delete doc.samplers;delete doc.materials;
  for(const mesh of doc.meshes)for(const primitive of mesh.primitives)delete primitive.material;
  const gltf=await new GLTFLoader().parseAsync(JSON.stringify(doc),'');gltf.scene.updateMatrixWorld(true);
  const mesh=gltf.scene.getObjectByName('Cube');
  if(!mesh?.isSkinnedMesh)throw Error('Hip diagnostic requires the authored Cube core');
  mesh.skeleton.update();
  const geometry=mesh.geometry,pos=geometry.getAttribute('position'),ix=geometry.getAttribute('skinIndex'),wt=geometry.getAttribute('skinWeight');
  const names=mesh.skeleton.bones.map(b=>b.name),count=names.length,n=pos.count;
  const originalIndex=Array.from(ix.array),originalWeight=Array.from(wt.array),positions=Array.from(pos.array);
  const original=Array.from({length:n},(_,i)=>Object.fromEntries([0,1,2,3].map(j=>[names[ix.getComponent(i,j)],wt.getComponent(i,j)]).filter(([,w])=>w>1e-6)));
  const restPoint=name=>{const i=names.indexOf(name);if(i<0)throw Error(`Missing ${name}`);return new THREE.Vector3().setFromMatrixPosition(mesh.bindMatrix.clone().invert().multiply(mesh.skeleton.boneInverses[i].clone().invert()));};
  const joints=['l','r'].map(side=>{const a=restPoint(`thigh_${side}`),axis=restPoint(`shin_${side}`).sub(a);return {side,a,axis,length:axis.length()};});
  const protectedBone=name=>/^(front_paw|hind_paw|hind_foot|tail_|neck_|head|ear_|forearm|upperarm)/.test(name);
  const allowed=names.map(name=>/^(pelvis|spine_|hip_|thigh_|shin_)/.test(name));
  const mask=i=>{
    const w=original[i];if(Object.entries(w).some(([name,value])=>protectedBone(name)&&value>0))return 0;
    const p=new THREE.Vector3().fromBufferAttribute(pos,i);let best=0;
    for(const {side,a,axis,length}of joints){const leg=(w[`thigh_${side}`]??0)+(w[`shin_${side}`]??0);if(leg<.05)continue;
      const relative=p.clone().sub(a),u=relative.dot(axis)/(length*length),radial=relative.addScaledVector(axis,-u).length()/length;
      best=Math.max(best,(1-THREE.MathUtils.smoothstep(u,.55,1.4))*(1-THREE.MathUtils.smoothstep(radial,.8,1.5))*THREE.MathUtils.smoothstep(leg,.05,.3));}
    return best;
  };
  const keys=new Map(),groups=[],groupId=[];
  for(let i=0;i<n;i++){
    const p=new THREE.Vector3().fromBufferAttribute(pos,i),key=p.toArray().map(x=>Math.round(x*1e5)).join(':');let id=keys.get(key);
    if(id===undefined){id=groups.length;keys.set(key,id);groups.push({ids:[],weights:new Float64Array(count),mask:1,neighbors:new Set()});}
    groupId[i]=id;const group=groups[id];group.ids.push(i);group.mask=Math.min(group.mask,mask(i));
    for(let j=0;j<4;j++)group.weights[ix.getComponent(i,j)]+=wt.getComponent(i,j);
  }
  for(const group of groups)group.weights=group.weights.map(w=>w/group.ids.length);
  const indices=geometry.index?.array??Array.from({length:n},(_,i)=>i);
  for(let i=0;i<indices.length;i+=3)for(const [a,b]of [[0,1],[1,2],[2,0]]){const u=groupId[indices[i+a]],v=groupId[indices[i+b]];if(u!==v){groups[u].neighbors.add(v);groups[v].neighbors.add(u);}}
  for(let pass=0;pass<12;pass++){
    const next=groups.map(group=>{
      if(!group.mask||!group.neighbors.size)return group.weights;
      const average=new Float64Array(count);for(const id of group.neighbors)for(let b=0;b<count;b++)if(allowed[b])average[b]+=groups[id].weights[b]/group.neighbors.size;
      const weights=group.weights.map((w,b)=>allowed[b]?THREE.MathUtils.lerp(w,average[b],.65*group.mask):w);
      const sum=weights.reduce((a,b)=>a+b,0);return weights.map(w=>w/sum);
    });groups.forEach((group,i)=>group.weights=next[i]);
  }
  let changed=0,protectedChanged=0;
  const before=Array.from({length:n},(_,i)=>mesh.getVertexPosition(i,new THREE.Vector3()));
  for(const group of groups){if(!group.mask)continue;const top=Array.from(group.weights,(weight,index)=>({weight,index})).filter(x=>x.weight>0).sort((a,b)=>b.weight-a.weight).slice(0,4),sum=top.reduce((s,x)=>s+x.weight,0);
    for(const i of group.ids){let differs=false;for(let j=0;j<4;j++){const item=top[j]??{index:0,weight:0},weight=item.weight/sum;differs||=ix.getComponent(i,j)!==item.index||Math.abs(wt.getComponent(i,j)-weight)>1e-7;ix.setComponent(i,j,item.index);wt.setComponent(i,j,weight);}if(differs){changed++;if(Object.keys(original[i]).some(protectedBone))protectedChanged++;}}
  }
  let maxRestDelta=0,minSum=Infinity,maxSum=0;
  for(let i=0;i<n;i++){maxRestDelta=Math.max(maxRestDelta,before[i].distanceTo(mesh.getVertexPosition(i,new THREE.Vector3())));let sum=0;for(let j=0;j<4;j++)sum+=wt.getComponent(i,j);minSum=Math.min(minSum,sum);maxSum=Math.max(maxSum,sum);}
  if(protectedChanged||maxRestDelta>2e-6||minSum<.99999||maxSum>1.00001)throw Error('Hip plan violates protected weights or bind invariance');
  return {base:{meshName:mesh.name,vertices:n,boneNames:names,positions,indices:originalIndex,weights:originalWeight},smooth:{indices:Array.from(ix.array),weights:Array.from(wt.array)},audit:{helperSha256:createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex'),sourceSha256:createHash('sha256').update(bytes).digest('hex'),passes:12,gain:.65,changed,protectedChanged,maxRestDelta,minSum,maxSum,weldGroups:groups.length}};
}

export async function captureHipWeightAB({repo,H,boot,video,save,getPage,fps,quality}) {
  if(fps!==60)throw Error('Hip diagnostic requires60fps');
  const plan=await planHipWeights(repo);save('hip-weight-plan.json',plan.audit);const clips=[];
  for(const mode of ['original','smoothed','backfaces']){
    await boot(quality,true);const page=getPage();await page.addStyleTag({content:'.lil-gui,#hud{visibility:hidden!important}'});await H('setFeelPreset','brisk');const originalFx=(await H('state')).fx.enabled;
    const installed=await page.evaluate(async plan=>{
      const THREE=await import('/gpu-three.js'),root=window.__gameHooks.debug.fox,core=root.getObjectByName(plan.base.meshName),matches=[];
      const same=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
      if(!core?.isSkinnedMesh)throw Error('No live hip core');
      root.traverse(mesh=>{if(!mesh.isSkinnedMesh||/tail|spiritfx/i.test(mesh.name))return;const p=mesh.geometry.getAttribute('position'),i=mesh.geometry.getAttribute('skinIndex'),w=mesh.geometry.getAttribute('skinWeight');
        if(p?.count!==plan.base.vertices||!i||!w)return;if(!same(Array.from(p.array),plan.base.positions)||!same(mesh.skeleton.bones.map(b=>b.name),plan.base.boneNames))return;
        if(!same(Array.from(i.array),plan.base.indices)||!same(Array.from(w.array),plan.base.weights))throw Error('Live body weights differ from source plan');matches.push(mesh);
      });
      if(!matches.includes(core))throw Error('Live body geometry differs from source plan');
      const material=new THREE.MeshBasicMaterial({color:0xff00ff,side:THREE.BackSide,depthWrite:false,depthTest:true,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,toneMapped:false,fog:false});
      const back=new THREE.SkinnedMesh(core.geometry,material);back.name='LOCO_HIP_BACKFACES';back.position.copy(core.position);back.quaternion.copy(core.quaternion);back.scale.copy(core.scale);back.bind(core.skeleton,core.bindMatrix);back.renderOrder=100;back.visible=false;core.parent.add(back);
      window.__hipApply=mode=>{const data=mode==='smoothed'?plan.smooth:plan.base;for(const mesh of matches){const i=mesh.geometry.getAttribute('skinIndex'),w=mesh.geometry.getAttribute('skinWeight');i.array.set(data.indices);w.array.set(data.weights);i.needsUpdate=true;w.needsUpdate=true;}back.visible=mode==='backfaces';};
      window.__hipRestore=()=>{window.__hipApply('original');back.parent?.remove(back);material.dispose();return matches.every(mesh=>same(Array.from(mesh.geometry.getAttribute('skinIndex').array),plan.base.indices)&&same(Array.from(mesh.geometry.getAttribute('skinWeight').array),plan.base.weights));};
      return {meshes:matches.map(mesh=>mesh.name),vertices:plan.base.vertices};
    },plan);
    save(`hip-${mode}-installation.json`,installed);
    let failure;
    try {
      for(const [gait,stick]of [['trot',.45],['run',1]]){
        await page.evaluate(mode=>window.__hipApply(mode),mode);await H('setFxEnabled',mode==='backfaces'?false:originalFx);await H('setKeys',[]);await H('setStick',0,0);
        const y=await page.evaluate(()=>window.__gameHooks.debug.world.collision.highestAt(40,88));await H('teleport',40,y,88,Math.PI);
        await page.evaluate(()=>{const l=window.__gameHooks.locomotion;l.phase=0;l.weights=new Map([['idle',1]]);l.lastActive='';});await H('advance',18,1/60,false);
        const name=`hip-${mode}-${gait}`,start=await H('state'),phases=[];
        const end=await video(name,120,async()=>{await H('setStick',0,-stick);},undefined,{traceEveryFrame:true,keyFrames:Array.from({length:60},(_,i)=>i*2),sheetFrames:[0,10,20,30,40,50,60,70,80,90,100,118],label:(frame,state)=>`${mode} ${gait} ${frame<60?'side':'rear-side'} f${frame} phase${state?.locomotion?.phase?.toFixed(3)}`,afterStep:async(frame,state)=>{if(frame%2===0)phases.push({frame,phase:state.locomotion.phase,lens:frame<60?'side':'rear-side'});const [x,y,z]=state.pos;await H('photo',[x-(frame<60?3.7:3),y+1.1,z+(frame<60?.2:2)],[x,y+.6,z],38);}});
        const phase92=['side','rear-side'].map(lens=>phases.filter(row=>row.lens===lens&&row.frame>=30).sort((a,b)=>Math.abs(Math.atan2(Math.sin((a.phase-.92)*Math.PI*2),Math.cos((a.phase-.92)*Math.PI*2)))-Math.abs(Math.atan2(Math.sin((b.phase-.92)*Math.PI*2),Math.cos((b.phase-.92)*Math.PI*2))))[0]);
        save(`${name}-phase92.json`,{requestedPhase:.92,selected:phase92,phases});
        clips.push({name,mode,gait,start,end,phase92,cameraCutFrame:60,phaseReset:0,label:'Staged live controller, two disclosed tracking lenses; not a continuous route clear'});
        await H('setStick',0,0);await page.evaluate(()=>window.__hipApply('original'));
        if(end.deaths!==start.deaths)throw Error(`${name}: death during hip comparison`);
      }
    } catch(error){failure=error;throw error;} finally {
      let restored=false,restoreError=null;try{restored=await page.evaluate(()=>window.__hipRestore());await H('setFxEnabled',originalFx);}catch(error){restoreError=String(error);}
      save(`hip-${mode}-restore.json`,{restored,originalFx,restoreError});if(!restored&&!failure)throw Error(`Hip ${mode} buffers did not restore: ${restoreError}`);
    }
  }
  save('hip-weight-ab.json',{audit:plan.audit,clips,label:'Capture-only weights and back-face diagnostic; no asset adoption or beauty approval'});
}
