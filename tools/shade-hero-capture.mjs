/** Focused open-ground live encounter review. Modal GPU only; no forced actor/free/health edits. */
import {createShadeLensReview} from './shade-lens-capture.mjs';
export async function captureShadeHero({repo,getPage,H,advance,video,shot,save,report}) {
  const page=getPage(),id='shade-meadow';
  const waterExclusion=await page.evaluate(()=>window.__gameHooks.debug.world.group.userData.shadeMeadowHabitat.waterExclusion);
  const dry=([x,,z])=>((x-waterExclusion.center[0])/waterExclusion.radii[0])**2+((z-waterExclusion.center[1])/waterExclusion.radii[1])**2>waterExclusion.minimumEllipse;
  const review=await createShadeLensReview({repo,getPage,H,report,save});
  save('shade-hero-identity.json',{label:'Authored optional Lanternhollow-edge habitat; staged fox teleport, live AI and real controller',actor:await page.evaluate(id=>window.__gameHooks.shades.state().actors.find(a=>a.id===id),id),ink:await page.evaluate(id=>window.__gameHooks.debug.scene.getObjectByName(id)?.userData.shadeInk,id)});
  const hearth=await page.evaluate(()=>window.__gameHooks.debug.world.hearthSpots[0]);
  await H('photo',[hearth.x+3,hearth.y+2.4,hearth.z+4],[hearth.x,hearth.y+1.8,hearth.z],42);
  await advance(0);await shot('shade-hearth-cold-ink');
  const wait=[];let setup;
  for(let frame=0;frame<=1200;frame+=15){
    const candidates=await page.evaluate(({id,waterExclusion:w})=>{
      const h=window.__gameHooks,a=h.shades.state().actors.find(a=>a.id===id),[x,y,z]=a.pos,col=h.debug.world.collision,result=[];
      for(let k=0;k<32;k++){
        const angle=k*Math.PI/16,dx=Math.cos(angle),dz=Math.sin(angle);let floor=y,safe=true;
        for(let distance=-5.5;distance<=3.1&&safe;distance+=.1)for(const width of [-.35,0,.35]){
          const px=x+dx*distance-dz*width,pz=z+dz*distance+dx*width,fy=col.groundAt(px,pz,floor+.2).y;
          if(((px-w.center[0])/w.radii[0])**2+((pz-w.center[1])/w.radii[1])**2<=w.minimumEllipse||!Number.isFinite(fy)||Math.abs(fy-y)>.2||col.blocked(px,pz,fy)){safe=false;break;}floor=fy;
        }
        if(safe)result.push({pos:[x+dx*2.7,col.groundAt(x+dx*2.7,z+dz*2.7,y+.2).y,z+dz*2.7],direction:[-dx,-dz],yaw:Math.atan2(-dx,-dz),startDistance:2.7});
      }return result;
    },{id,waterExclusion});
    const entry={frame,candidates:candidates.length,plans:[]};wait.push(entry);
    for(const candidate of candidates.filter((_,i)=>i%Math.max(1,Math.ceil(candidates.length/8))===0)){
      const plan=await review.plan(id,candidate);entry.plans.push(plan);
      if(plan.lens){setup={...candidate,heldLens:plan.lens};break;}
    }
    save('shade-hero-stage.json',{passed:!!setup,setup,wait});
    if(setup)break;
    await advance(15,false);
  }
  if(!setup)throw Error('No supported open-meadow runway with one clear held lens after20s live patrol');
  await H('teleport',...setup.pos,setup.yaw);await H('setKeys',[]);await H('setStick',null);
  await review.camera(id,setup.heldLens);await advance(0);
  const before=await H('state'),beforeHash=await review.matrix();
  await shot('shade-hero-before');
  save('shade-hero-before.json',{game:await page.evaluate(()=>window.__game),matrixHash:beforeHash,framing:await review.measure(id),setup});
  await H('setStick',...setup.direction);await H('setKeys',['ShiftLeft']);
  const keys=[...Array.from({length:30},(_,i)=>i*6),179];
  const after=await video('shade-hero-release',180,async frame=>{if(frame===12){await H('setKeys',[]);await H('setStick',null);}},undefined,review.options('Open meadow release',id,keys,setup.heldLens));
  await shot('shade-hero-after');
  save('shade-hero-after.json',{game:await page.evaluate(()=>window.__game),matrixHash:await review.matrix(),framing:await review.measure(id)});
  const take=report.videos['shade-hero-release'],rows=take.trace,hashes=[...new Set(rows.map(r=>r.state.capture?.lens?.matrixHash))],framed=rows.filter(r=>r.state.capture?.shadePresent);
  const badPair=framed.filter(r=>{const c=r.state.capture;return !c.fox?.inFrame||!c.shade?.inFrame||c.fox.heightFraction<=.15||c.shade.heightFraction<=.15;}).map(r=>r.frame);
  const blocked=rows.filter(r=>!r.state.capture?.lens?.clear||r.state.capture?.lens?.noFit).map(r=>r.frame);
  const floors=await page.evaluate(positions=>positions.map(p=>{const y=window.__gameHooks.debug.world.collision.groundAt(p[0],p[2],p[1]+.2).y;return Number.isFinite(y)?p[1]-y:null;}),rows.map(r=>r.state.pos));
  const states=await page.evaluate(()=>window.__gameHooks.shades.state()),actor=states.actors.find(a=>a.id===id);
  const checks={dryGround:dry(actor.pos)&&rows.every(r=>dry(r.state.pos)),realFree:actor.freed&&states.frees===before.shades.frees+1,heldCamera:hashes.length===1&&hashes[0]===beforeHash,framed:framed.length>0&&!badPair.length,clear:!blocked.length,supported:floors.every(gap=>gap!==null&&Math.abs(gap)<=.15)&&after.grounded,noDeath:after.deaths===before.deaths,noExtraHit:states.hits===before.shades.hits,realDash:after.dash.used>before.dash.used};
  const result={passed:Object.values(checks).every(Boolean),checks,badPair,blocked,hashes,frames:rows.length,maximumFloorGap:Math.max(...floors.map(v=>v??Infinity)),before,after,game:await page.evaluate(()=>window.__game)};
  save('shade-hero-acceptance.json',result);
  if(!result.passed)report.failures.push('Open meadow release failed: '+JSON.stringify(checks));
  await advance(600,false);await advance(0);await shot('shade-hero-empty');
}

/** Same staged-observer review for old puzzle and new open habitat; live AI is never overridden. */
export async function captureShadeBehavior({repo,getPage,H,video,save,report,id='shade-meadow',name='shade-meadow-behavior',review}) {
  review??=await createShadeLensReview({repo,getPage,H,report,save});
  const page=getPage(),transitions=[],placements=[],before=await H('state');let missing=false;
  save(name+'-staging.json',{label:'10s staged observer teleports every15frames; actual actor AI, authored chase tuning, no forced actor state',nearFrames:[90,300],retreatFrames:[300,315]});
  const keyFrames=[0,89,180,299,300,315,390,480,599];
  await video(name,600,async frame=>{
    if(frame%15!==0)return;
    const observer=await page.evaluate(({id,near,retreat})=>{
      const h=window.__gameHooks,a=h.shades.state().actors.find(a=>a.id===id),[x,y,z]=a.pos,col=h.debug.world.collision,w=h.debug.world.group.userData.shadeMeadowHabitat?.waterExclusion;
      const dry=(px,pz)=>id!=='shade-meadow'||!w||((px-w.center[0])/w.radii[0])**2+((pz-w.center[1])/w.radii[1])**2>w.minimumEllipse;
      for(const radius of retreat?[7.2]:near?[2.9]:[4.8,4.3,5.3,5.5])for(let k=0;k<64;k++){
        const angle=k*Math.PI/32,px=x+Math.cos(angle)*radius,pz=z+Math.sin(angle)*radius,floor=col.groundAt(px,pz,y+.5).y;
        if(!Number.isFinite(floor)||Math.abs(floor-y)>.35||!dry(px,pz)||col.blocked(px,pz,floor))continue;
        let safe=true;for(const [dx,dz]of [[.35,0],[-.35,0],[0,.35],[0,-.35]]){const fy=col.groundAt(px+dx,pz+dz,floor+.2).y;if(!Number.isFinite(fy)||Math.abs(fy-floor)>.2||col.blocked(px+dx,pz+dz,floor)){safe=false;break;}}
        if(safe)return{pos:[px,floor,pz,Math.atan2(x-px,z-pz)],mode:a.mode,actor:a.pos};
      }return null;
    },{id,near:frame>=90&&frame<300,retreat:frame>=300&&frame<315});
    placements.push({frame,observer});
    if(!observer){missing=true;return;}
    if(transitions.at(-1)?.mode!==observer.mode)transitions.push({frame,mode:observer.mode});
    await H('teleport',...observer.pos);
  },undefined,review.options('Behavior',id,keyFrames));
  const take=report.videos[name],rows=take.trace,framed=rows.filter(r=>r.state.capture?.shadePresent),failed=framed.filter(r=>{const c=r.state.capture;return !c.fox?.inFrame||!c.shade?.inFrame||c.fox.heightFraction<=.15||c.shade.heightFraction<=.15;}).map(r=>r.frame),blocked=rows.filter(r=>!r.state.capture?.lens?.clear||r.state.capture?.lens?.noFit).map(r=>r.frame);
  const after=await H('state'),expected=['patrol','chase','return','patrol'];let observed=0;for(const t of transitions)if(t.mode===expected[observed])observed++;
  const checks={cycle:observed===expected.length,observers:!missing,framed:framed.length>0&&!failed.length,clear:!blocked.length,noHit:after.shades.hits===before.shades.hits,noDeath:after.deaths===before.deaths};
  const result={passed:Object.values(checks).every(Boolean),checks,transitions,placements,failedFrames:failed,blockedFrames:blocked,state:after,game:await page.evaluate(()=>window.__game)};
  save(name+'-state.json',result);if(!result.passed)report.failures.push(name+': '+JSON.stringify(checks));return result;
}
