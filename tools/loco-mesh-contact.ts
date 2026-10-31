/** CPU core-mesh contact probe. No browser/render; visual acceptance still requires GPU playback.
 * npx tsx tools/loco-mesh-contact.ts [swingEase]
 * Tracks the same rest-pose vertex per pad throughout, avoiding lowest-vertex switches.
 * Near-floor motion includes toe-off/touchdown; it is not by itself a skating verdict.
 */
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
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
if(process.argv[2]!==undefined) {
 const ease=Number(process.argv[2]);
 if(!Number.isFinite(ease)||ease<0||ease>1)throw new Error('swingEase must be between 0 and 1');
 loco.params.swingEase=ease;
}

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
 let previous:THREE.Vector3[]=[];const near:number[]=[],flatNear:number[]=[],height:number[]=[],cadence:number[]=[]; let noSupport=0,maxResidual=0;
 for(let i=0;i<600;i++){
  group.position.z+=speed/60;group.updateMatrixWorld(true);loco.input={speed,grounded:true,yaw:0,verticalSpeed:0,groundAt:()=>0};
  loco.beforeMixer();loco.blend(1/60,'run');mixer.update(1/60);loco.afterMixer(1/60,'run');root.updateMatrixWorld(true);for(const mesh of meshes)mesh.skeleton.update();
  const now=pads.map(p=>p.mesh.localToWorld(p.mesh.getVertexPosition(p.index,new THREE.Vector3())));
  if(i>300) {
   cadence.push(loco.metrics.cadenceHz); if(loco.metrics.stanceFeet===0)noSupport++;
   maxResidual=Math.max(maxResidual,loco.metrics.maxResidual);
   now.forEach((p,j)=>{
    height.push(p.y);
    if(Math.abs(p.y)<.02&&Math.abs(previous[j].y)<.02) {
     const horizontal=Math.hypot(p.x-previous[j].x,p.z-previous[j].z)*60;
     near.push(horizontal);
     if(Math.abs(p.y-previous[j].y)*60<.1)flatNear.push(horizontal);
    }
   });
  }
  previous=now;
 }
 console.log(JSON.stringify({speed,swingEase:loco.params.swingEase,cadence:stats(cadence),noSupportFraction:noSupport/299,maxResidual,nearFloorSlide:stats(near),flatNearFloorSlide:stats(flatNear),height:stats(height),landmarks:pads.map(p=>({mesh:p.mesh.name,index:p.index}))}));
}
