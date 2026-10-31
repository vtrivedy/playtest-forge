/** Remote review math only; no game/render path. Shared by planning, recording and acceptance. */
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export function installShadeLens() {
  if(window.__shadeLens)return;
  const h=()=>window.__gameHooks,V=h().debug.fox.position.constructor;
  const smooth=(x,a,b)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
  const boxOf=points=>{const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(let i=0;i<points.length;i+=3)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],points[i+k]);hi[k]=Math.max(hi[k],points[i+k]);}const corners=[];for(const x of [lo[0],hi[0]])for(const y of [lo[1],hi[1]])for(const z of [lo[2],hi[2]])corners.push(x,y,z);return{lo,hi,corners};};
  const posed=(root,skinnedOnly,headLimit=null)=>{
    const out=[],p=new V(),normal=new V();root?.updateWorldMatrix(true,true);
    root?.traverse(mesh=>{
      if(!mesh.isMesh||(skinnedOnly&&!mesh.isSkinnedMesh))return;
      if(skinnedOnly){let a=mesh;while(a){if(!a.visible)return;a=a.parent;}}
      const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];
      if(mats.every(m=>!m.visible||m.opacity===0))return;
      if(skinnedOnly&&/spirit[_-]?fx|wisps?|ember[_-]?wisp|smoulder|flame|spark|lick/i.test(mesh.name+' '+mats.map(m=>m.name).join(' ')))return;
      if(mesh.isSkinnedMesh)mesh.skeleton.update();
      const uniforms=mesh.material.uniforms,turn=headLimit??uniforms?.uNoticeYaw?.value??0,time=uniforms?.uTime?.value??0,seed=uniforms?.uSeed?.value??0,presence=uniforms?.uPresence?.value??1;
      for(let i=0;i<mesh.geometry.attributes.position.count;i++){
        mesh.getVertexPosition(i,p);
        if(!skinnedOnly){
          const a=turn*smooth(p.y,1.45,2.05)*smooth(p.z,.15,.55),x=p.x,z=p.z-.48;
          p.x=Math.cos(a)*x+Math.sin(a)*z;p.z=-Math.sin(a)*x+Math.cos(a)*z+.48;
          p.x+=Math.sin(time*1.7+p.y*2+seed)*.075;
          normal.fromBufferAttribute(mesh.geometry.attributes.normal,i);p.addScaledVector(normal,(1-presence)*.035);
        }
        p.applyMatrix4(mesh.matrixWorld);out.push(p.x,p.y,p.z);
      }
    });
    return new Float32Array(out);
  };
  const project=(points,camera,margin=.94)=>{
    const e=camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse).elements;
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,minZ=Infinity,maxZ=-Infinity,front=true;
    for(let i=0;i<points.length;i+=3){const x=points[i],y=points[i+1],z=points[i+2],w=e[3]*x+e[7]*y+e[11]*z+e[15];if(w<=0)front=false;const px=(e[0]*x+e[4]*y+e[8]*z+e[12])/w,py=(e[1]*x+e[5]*y+e[9]*z+e[13])/w,pz=(e[2]*x+e[6]*y+e[10]*z+e[14])/w;minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py);minZ=Math.min(minZ,pz);maxZ=Math.max(maxZ,pz);}
    return points.length?{heightFraction:(maxY-minY)/2,inFrame:front&&minX>=-margin&&maxX<=margin&&minY>=-margin&&maxY<=margin&&minZ>=-1&&maxZ<=1,vertices:points.length/3,bounds:[minX,maxX,minY,maxY]}:null;
  };
  const virtual=lens=>{const c=h().debug.camera.clone();c.position.fromArray(lens.pos);c.fov=lens.fov;c.lookAt(new V(...lens.look));c.updateProjectionMatrix();c.updateMatrixWorld(true);return c;};
  const overlap=(a,b)=>{const x=a.bounds,y=b.bounds;return Math.max(0,Math.min(x[1],y[1])-Math.max(x[0],y[0]))*Math.max(0,Math.min(x[3],y[3])-Math.max(x[2],y[2]))/Math.max(1e-6,Math.min((x[1]-x[0])*(x[3]-x[2]),(y[1]-y[0])*(y[3]-y[2])));};
  const clear=(eye,targets)=>!!h().photoBlocker&&targets.every(target=>!h().photoBlocker(eye,target));
  const targetIndices=core=>{
    if(core.geometry.userData.shadeReviewTargets)return core.geometry.userData.shadeReviewTargets;
    const g=core.geometry,p=g.attributes.position,m=g.attributes.aMass,tip=g.attributes.aTip,all=Array.from({length:p.count},(_,i)=>i),heavy=all.filter(i=>(m?.getX(i)??0)>.6),chosen=[];
    const dist=(a,b)=>(p.getX(a)-p.getX(b))**2+(p.getY(a)-p.getY(b))**2+(p.getZ(a)-p.getZ(b))**2;
    if(heavy.length){chosen.push(heavy[0]);while(chosen.length<12&&chosen.length<heavy.length){let best=-1,d=-1;for(const i of heavy){const near=Math.min(...chosen.map(j=>dist(i,j)));if(near>d){d=near;best=i;}}chosen.push(best);}}
    for(const sign of [-1,1])for(const axis of ['y','x']){const candidates=all.filter(i=>p.getY(i)>2.2&&p.getX(i)*sign>0&&(tip?.getX(i)??1)>.1);if(candidates.length)chosen.push(candidates.reduce((a,b)=>(axis==='y'?p.getY(a)>p.getY(b):p.getX(a)*sign>p.getX(b)*sign)?a:b));}
    const head=all.filter(i=>p.getY(i)>1.9&&p.getY(i)<2.3&&p.getZ(i)>.8);if(head.length){chosen.push(head.reduce((a,b)=>p.getZ(a)>p.getZ(b)?a:b));chosen.push(head.reduce((a,b)=>p.getY(a)>p.getY(b)?a:b));}
    core.geometry.userData.shadeReviewTargets=[...new Set(chosen)];return core.geometry.userData.shadeReviewTargets;
  };
  const snapshot=id=>{
    const a=h().shades.state().actors.find(a=>a.id===id);if(!a)throw Error('Missing Shade '+id);
    const fox=h().debug.fox,core=h().debug.scene.getObjectByName(id)?.getObjectByName('shade-density-core');if(!core)throw Error('Missing density core '+id);
    const foxPoints=posed(fox,true),shadePoints=posed(core,false),fy=fox.position.y-(h().debug.foxFeetOffset??.02);
    const targets=targetIndices(core).map(i=>Array.from(shadePoints.slice(i*3,i*3+3)));
    targets.push(...[.15,.6,.95].map(y=>[fox.position.x,fy+y,fox.position.z]));
    return{actor:a,foxPoints,shadePoints,targets,fox:[fox.position.x,fy,fox.position.z],core};
  };
  const inspect=(id,lens)=>{
    const s=snapshot(id),camera=virtual(lens),fox=project(s.foxPoints,camera),shade=project(s.shadePoints,camera),contactOverlap=!!h().state().dash?.collisionActiveLastStep||(s.actor.freed&&s.actor.releaseAge<.7),shared=fox&&shade?overlap(fox,shade):1;
    const fits=!!fox&&!!shade&&fox.heightFraction>.17&&shade.heightFraction>.18&&fox.inFrame&&shade.inFrame&&(contactOverlap||shared<.3);
    return{...lens,fox,shade,overlap:shared,contactOverlap,noFit:!fits,clear:fits&&clear(lens.pos,s.targets)};
  };
  const current=(id,previous,held)=>{
    if(held)return inspect(id,held);
    const s=snapshot(id),[x,y,z]=s.actor.pos,[fx,fy,fz]=s.fox,look=[x*.35+fx*.65,(y+s.actor.height*.5)*.35+(fy+(h().debug.foxHeight??1.25)*.5)*.65,z*.35+fz*.65],side=Math.atan2((fx-x)/Math.max(.01,Math.hypot(fx-x,fz-z)),-(fz-z)/Math.max(.01,Math.hypot(fx-x,fz-z)));
    const angles=[side-.65,side+Math.PI+.65,...Array.from({length:16},(_,i)=>i*Math.PI/8)],positions=[...(previous?[previous]:[]),...[2.5,4].flatMap(eye=>angles.flatMap(a=>[5.2,6,6.8].map(r=>[look[0]+Math.cos(a)*r,Math.max(y,fy)+eye,look[2]+Math.sin(a)*r])))];
    let fallback;
    for(const pos of positions){let visibility;for(const fov of [42,48,52,56]){
      const lens={pos,look,fov},camera=virtual(lens),fb=project(boxOf(s.foxPoints).corners,camera),sb=project(boxOf(s.shadePoints).corners,camera);
      if(!fb||!sb||fb.heightFraction<.17||sb.heightFraction<.18)continue;
      const fox=project(s.foxPoints,camera),shade=project(s.shadePoints,camera),contactOverlap=!!h().state().dash?.collisionActiveLastStep||(s.actor.freed&&s.actor.releaseAge<.7),shared=overlap(fox,shade);
      if(!fox.inFrame||!shade.inFrame||fox.heightFraction<=.17||shade.heightFraction<=.18||(!contactOverlap&&shared>=.3))continue;
      visibility??=clear(pos,s.targets);const result={...lens,fox,shade,overlap:shared,contactOverlap,noFit:false,clear:visibility};fallback??=result;if(visibility)return result;
    }}
    return fallback??{pos:positions[0],look,fov:56,clear:false,noFit:true};
  };
  const idleLocal=()=>{
    const fox=h().debug.fox,points=posed(fox,true),inverse=fox.matrixWorld.clone().invert(),p=new V(),out=[];
    for(let i=0;i<points.length;i+=3){p.fromArray(points,i).applyMatrix4(inverse);out.push(p.x,p.y,p.z);}return out;
  };
  const plan=(id,setup,idleHull)=>{
    const s=snapshot(id),[x,y,z]=s.actor.pos,col=h().debug.world.collision,frames=[],local=idleHull,points=new V(),feet=h().debug.foxFeetOffset??.02;let floor=setup.pos[1];
    for(let distance=0;distance<=7.31;distance+=.25){const px=setup.pos[0]+setup.direction[0]*distance,pz=setup.pos[2]+setup.direction[1]*distance,next=col.groundAt(px,pz,floor+.1).y;if(!Number.isFinite(next)||Math.abs(next-floor)>.35)return{lens:null,stats:{reason:'forecast floor discontinuity'}};floor=next;const verts=[];
      for(let i=0;i<local.length;i+=3){points.fromArray(local,i);points.y=(points.y+feet)*.7;points.applyAxisAngle(new V(0,1,0),setup.yaw);points.add(new V(px,floor,pz));verts.push(points.x,points.y,points.z);}frames.push({distance,pos:[px,floor,pz],points:verts,box:boxOf(verts)});
    }
    const union=[...s.shadePoints];for(const angle of [-.45,.45])union.push(...posed(s.core,false,angle));
    const drift=Math.min(.3,(h().shades.tun.speed??1.25)*.2),forward=[Math.sin(s.actor.heading??0)*drift,0,Math.cos(s.actor.heading??0)*drift],shade=[...union];for(let i=0;i<union.length;i+=3)shade.push(union[i]+forward[0],union[i+1],union[i+2]+forward[2]);
    const all=boxOf([...shade,...frames.flatMap(f=>f.points)]),look=all.lo.map((v,i)=>(v+all.hi[i])/2),highestFloor=Math.max(y,...frames.map(f=>f.pos[1])),stats={candidates:0,exactFits:0,sightTests:0,foxHullVertices:local.length/3,forecastSamples:frames.length},fitted=[];
    for(const fov of [42,48,52,56])for(const eye of [1.6,2.5,3.5])for(let angle=0;angle<16;angle++)for(const factor of [.78,.9,1]){
      const r=(h().debug.foxHeight??1.25)/(.21*2*Math.tan(fov*Math.PI/360))*factor,a=angle*Math.PI/8,lens={pos:[look[0]+Math.cos(a)*r,highestFloor+eye,look[2]+Math.sin(a)*r],look,fov};stats.candidates++;
      const camera=virtual(lens),sh=project(shade,camera,.9);if(!sh?.inFrame||sh.heightFraction<=.18)continue;let minimum=Infinity,ok=true;const projected=[];
      for(const f of frames){const broad=project(f.box.corners,camera,.9);if(!broad||broad.heightFraction<.17){ok=false;break;}const fox=project(f.points,camera,.9);const contact=Math.abs(f.distance-setup.startDistance)<(h().shades.tun.hitRadius+.6);if(!fox.inFrame||fox.heightFraction<=.17||(!contact&&overlap(fox,sh)>=.3)){ok=false;break;}minimum=Math.min(minimum,fox.heightFraction);projected.push({distance:f.distance,foxHeight:fox.heightFraction});}
      if(ok){stats.exactFits++;fitted.push({lens,minimum,projected,shadeHeight:sh.heightFraction});}
    }
    fitted.sort((a,b)=>b.minimum-a.minimum);
    const targets=[...s.targets.slice(0,-3)];for(const f of frames.filter((_,i)=>i%2===0))targets.push(...[.15,.6,.95].map(dy=>[f.pos[0],f.pos[1]+dy,f.pos[2]]));
    for(const fit of fitted){stats.sightTests++;if(clear(fit.lens.pos,targets))return{lens:fit.lens,stats,forecast:fit.projected,minimumFox:fit.minimum,shadeHeight:fit.shadeHeight,targets,actor:s.actor,method:'idle convex hull compressed to70% height; actual keyframe gate unchanged15%'};}
    return{lens:null,stats,actor:s.actor,reason:'No held exact-fit/all-clear lens'};
  };
  window.__shadeLens={posed,project,virtual,snapshot,current,inspect,idleLocal,plan,measure:id=>{const s=snapshot(id),c=h().debug.camera;return{actorId:id,freed:s.actor.freed,presence:s.actor.presence,shadePresent:!s.actor.freed||s.actor.presence>.5,method:'posed vertices incl head-yaw/sway; noise/alpha excluded',fox:project(s.foxPoints,c,1),shade:project(s.shadePoints,c,1)};}};
}

export async function createShadeLensReview({repo,getPage,H,report,save}) {
  const {Vector3}=await import(pathToFileURL(repo+'/node_modules/three/build/three.module.js').href);
  const {ConvexHull}=await import(pathToFileURL(repo+'/node_modules/three/examples/jsm/math/ConvexHull.js').href);
  const hulls=new WeakMap(),latest=new Map();let previous=null;
  const ready=async()=>getPage().evaluate(installShadeLens);
  const hull=async()=>{const page=getPage();if(hulls.has(page))return hulls.get(page);await ready();const values=await page.evaluate(()=>window.__shadeLens.idleLocal()),points=[];for(let i=0;i<values.length;i+=3)points.push(new Vector3(values[i],values[i+1],values[i+2]));const convex=new ConvexHull().setFromPoints(points),unique=new Set();for(const face of convex.faces){let edge=face.edge;do{unique.add(edge.head().point);edge=edge.next;}while(edge!==face.edge);}const result=[...unique].flatMap(p=>p.toArray());hulls.set(page,result);return result;};
  const camera=async(id,held=null)=>{await ready();const framing=await getPage().evaluate(({id,previous,held})=>window.__shadeLens.current(id,previous,held),{id,previous,held});previous=framing.pos;latest.set(id,{clear:framing.clear,noFit:framing.noFit,overlap:framing.overlap??null,contactOverlap:framing.contactOverlap??false,foxHeight:framing.fox?.heightFraction??null,shadeHeight:framing.shade?.heightFraction??null,held:!!held});report.shadeReviewQuality??={};const counts=report.shadeReviewQuality[id]??={noFit:0,occluded:0};if(framing.noFit)counts.noFit++;else if(!framing.clear)counts.occluded++;await H('photo',framing.pos,framing.look,framing.fov);return framing;};
  const matrix=async()=>{const values=await getPage().evaluate(()=>{const c=window.__gameHooks.debug.camera;return[...c.matrixWorld.elements,...c.projectionMatrix.elements].map(v=>Math.round(v*1e5));});return createHash('sha256').update(JSON.stringify(values)).digest('hex');};
  const measure=async id=>{await ready();return getPage().evaluate(id=>window.__shadeLens.measure(id),id);};
  const options=(name,id,keyFrames,held=null)=>({traceEveryFrame:true,keyFrames,afterStep:()=>camera(id,held),sample:async frame=>({...(keyFrames.includes(frame)?await measure(id):{actorId:id,lensOnly:true}),lens:{...latest.get(id),matrixHash:await matrix()}}),label:(frame,state)=>{const p=state?.capture;return`${id} f${frame} p${p?.presence??'?'} fox ${p?.fox?(p.fox.heightFraction*100).toFixed(0):'?'}% shade ${p?.shade?(p.shade.heightFraction*100).toFixed(0):'?'}%`;}});
  const plan=async(id,setup)=>{await ready();return getPage().evaluate(({id,setup,idle})=>window.__shadeLens.plan(id,setup,idle),{id,setup,idle:await hull()});};
  return{camera,measure,options,plan,matrix,latest,reset:()=>{previous=null;}};
}
