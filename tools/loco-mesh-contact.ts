/** CPU core-mesh contact probe. No browser/render; visual acceptance still requires GPU playback.
 * npx tsx tools/loco-mesh-contact.ts [swingEase] [releaseSwing] [carpalCurl] [dtJitter]
 * Tracks the same rest-pose vertex per pad throughout, avoiding lowest-vertex switches.
 * Near-floor motion includes toe-off/touchdown; it is not by itself a skating verdict.
 */
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import GAITS from '../assets/hero/spirit_fox.loco.json';
import { AuthoredLocomotion } from '../games/fox-spirit/src/locomotion';
Object.assign(globalThis,{self:globalThis,ProgressEvent:class extends Event {constructor(type:string,init:Record<string,unknown>){super(type);Object.assign(this,init);}}});
const bytes=fs.readFileSync('assets/hero/spirit_fox.glb');
const jsonLength=bytes.readUInt32LE(12);
const doc=JSON.parse(bytes.subarray(20,20+jsonLength).toString());
const bin=bytes.subarray(28+jsonLength);
doc.buffers[0].uri=`data:application/octet-stream;base64,${bin.toString('base64')}`;
delete doc.images;delete doc.textures;delete doc.samplers;delete doc.materials;
for(const mesh of doc.meshes)for(const primitive of mesh.primitives)delete primitive.material;
const gltf=await new GLTFLoader().parseAsync(JSON.stringify(doc),'');
const root=gltf.scene;const group=new THREE.Group();group.add(root);
const box=new THREE.Box3().setFromObject(root);root.scale.setScalar(1.25/(box.max.y-box.min.y));
const scaled=new THREE.Box3().setFromObject(root);root.position.y-=scaled.min.y;
const center=scaled.getCenter(new THREE.Vector3());root.position.x-=center.x;root.position.z-=center.z;
const mixer=new THREE.AnimationMixer(root);const actions=new Map(gltf.animations.map(c=>[c.name,mixer.clipAction(c)]));
const loco=new AuthoredLocomotion(root,group,actions);
const solvedFeet=(loco as unknown as {feet:{planted:boolean;upper:THREE.Object3D;lower:THREE.Object3D;paw:THREE.Object3D;hock?:THREE.Object3D;padLocal:THREE.Vector3;anchor:THREE.Vector3}[]}).feet;
for(const [i,[name,max]] of ([['swingEase',1],['releaseSwing',.4],['carpalCurl',.7]] as const).entries()) {
 if(process.argv[i+2]===undefined)continue;
 const value=Number(process.argv[i+2]);
 if(!Number.isFinite(value)||value<0||value>max)throw new Error(`${name} must be between 0 and ${max}`);
 loco.params[name]=value;
}

const dtJitter=Number(process.argv[5] ?? 0);
if(!Number.isFinite(dtJitter)||dtJitter<0||dtJitter>.2)throw new Error('dtJitter must be between 0 and .2');
let jitterSeed=42;
const meshes:THREE.SkinnedMesh[]=[];
root.traverse(o=>{if((o as THREE.SkinnedMesh).isSkinnedMesh && !/fur|shell|glow|flame|spiritfx/i.test(o.name))meshes.push(o as THREE.SkinnedMesh)});
root.updateMatrixWorld(true);
const pads=['front_paw_l','front_paw_r','hind_paw_l','hind_paw_r'].map(name=>{
 const bone=root.getObjectByName(name)!;let low=Infinity;let found:{mesh:THREE.SkinnedMesh,index:number}|undefined;
 for(const mesh of meshes){mesh.skeleton.update();const bi=mesh.skeleton.bones.indexOf(bone as THREE.Bone),ix=mesh.geometry.getAttribute('skinIndex'),wt=mesh.geometry.getAttribute('skinWeight');
 for(let i=0;i<ix.count;i++){let w=0;for(let j=0;j<4;j++)if(ix.getComponent(i,j)===bi)w+=wt.getComponent(i,j);if(w<.65)continue;
 const v=mesh.localToWorld(mesh.getVertexPosition(i,new THREE.Vector3()));if(v.y<low){low=v.y;found={mesh,index:i}}}}
 if(!found)throw new Error(name);return found;
});
const stats=(xs:number[])=>{xs.sort((a,b)=>a-b);return {n:xs.length,min:xs[0],median:xs[Math.floor(xs.length*.5)],p95:xs[Math.floor(xs.length*.95)],max:xs[xs.length-1]}};
for(const speed of [1.62,4.05,9]) {
 loco.reset();group.position.set(0,0,0);group.rotation.y=0;
 const phaseSamples:Record<string,{height:number[];near:number[];step:number[]}>={};
 let previous:THREE.Vector3[]=[];let previousPlanted:boolean[]=[];const plantVertices:THREE.Vector3[]=[];
 const persistentSlide:number[]=[],persistentDrift:number[]=[];
 const contactOutliers:{phase:number;foot:number;residual:number;reachExcess:number}[]=[];const near:number[]=[],flatNear:number[]=[],height:number[]=[],cadence:number[]=[]; let noSupport=0,maxResidual=0;
 for(let i=0;i<1800;i++){
  jitterSeed=(Math.imul(jitterSeed,1664525)+1013904223)>>>0;
  const dt=(1+(jitterSeed/4294967296*2-1)*dtJitter)/60;
  group.position.z+=speed*dt;group.updateMatrixWorld(true);loco.input={speed,grounded:true,yaw:0,verticalSpeed:0,groundAt:()=>0};
  loco.beforeMixer();loco.blend(dt,'run');mixer.update(dt);loco.afterMixer(dt,'run');root.updateMatrixWorld(true);for(const mesh of meshes)mesh.skeleton.update();
  const now=pads.map(p=>p.mesh.localToWorld(p.mesh.getVertexPosition(p.index,new THREE.Vector3())));
  if(i>300) {
   cadence.push(loco.metrics.cadenceHz); if(loco.metrics.stanceFeet===0)noSupport++;
   maxResidual=Math.max(maxResidual,loco.metrics.maxResidual);
   if(loco.metrics.maxResidual>.01)solvedFeet.forEach((f,j)=>{
    if(!f.planted)return;
    const pad=f.paw.localToWorld(f.padLocal.clone()),delta=f.anchor.clone().sub(pad),residual=delta.length();
    if(residual<.01)return;
    const a=f.upper.getWorldPosition(new THREE.Vector3()),b=f.lower.getWorldPosition(new THREE.Vector3()),c=(f.hock ?? f.paw).getWorldPosition(new THREE.Vector3());
    contactOutliers.push({phase:loco.metrics.phase,foot:j,residual,reachExcess:a.distanceTo(c.clone().add(delta))-a.distanceTo(b)-b.distanceTo(c)});
   });
   now.forEach((p,j)=>{
    height.push(p.y);
    if(solvedFeet[j].planted && previousPlanted[j]) {
     persistentSlide.push(Math.hypot(p.x-previous[j].x,p.z-previous[j].z)/dt);
     persistentDrift.push(Math.hypot(p.x-plantVertices[j].x,p.z-plantVertices[j].z));
    }
    const gait=GAITS[loco.metrics.gait as keyof typeof GAITS];
    const contact=gait.contacts[j],u=(loco.metrics.phase-contact.phase+1)%1,end=contact.duty*loco.metrics.stanceRatio,sw=(u-end)/(1-end);
    const band=u<end ? 'stance' : sw<.12 ? 'lift' : sw>.84 ? 'reach' : 'recovery';
    const phase=phaseSamples[`${j<2 ? 'fore' : 'hind'}:${band}`] ??= {height:[],near:[],step:[]};
    phase.height.push(p.y);phase.step.push(Math.abs(p.y-previous[j].y));
    if(Math.abs(p.y)<.02&&Math.abs(previous[j].y)<.02) {
     const horizontal=Math.hypot(p.x-previous[j].x,p.z-previous[j].z)/dt;
     near.push(horizontal);phase.near.push(horizontal);
     if(Math.abs(p.y-previous[j].y)/dt<.1)flatNear.push(horizontal);
    }
   });
  }
  now.forEach((p,j)=>{if(solvedFeet[j].planted && !previousPlanted[j])plantVertices[j]=p.clone()});
  previousPlanted=solvedFeet.map(f=>f.planted);previous=now;
 }
 console.log(JSON.stringify({speed,dtJitter,swingEase:loco.params.swingEase,releaseSwing:loco.params.releaseSwing,carpalCurl:loco.params.carpalCurl,cadence:stats(cadence),noSupportFraction:noSupport/1499,maxResidual,contactOutliers:contactOutliers.sort((a,b)=>b.residual-a.residual).slice(0,12),persistentPlantSlide:stats(persistentSlide),persistentPlantDrift:stats(persistentDrift),nearFloorSlide:stats(near),flatNearFloorSlide:stats(flatNear),height:stats(height),phases:Object.fromEntries(Object.entries(phaseSamples).map(([name,p])=>[name,{height:stats(p.height),nearFloor:stats(p.near),verticalStep:stats(p.step)}])),landmarks:pads.map(p=>({mesh:p.mesh.name,index:p.index}))}));
}
