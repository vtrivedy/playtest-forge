/** Pure CPU animation/IK diagnostic; visual acceptance still requires GPU playback. */
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
const mixer=new THREE.AnimationMixer(root);const actions=new Map(gltf.animations.map(c=>[c.name,mixer.clipAction(c)]));
const loco=new AuthoredLocomotion(root,group,actions);
console.log('rig',root.scale.x,root.getObjectByName('FrontPawL')?.name,gltf.animations.map(a=>a.name));
for(const speed of [1.62,4.05,9]) {
 let worst=0,sum=0,contacts=0,residual=0; const phases=[];
 for(let i=0;i<120;i++) {
  group.position.z+=speed/60; group.updateMatrixWorld(true);
  loco.input={speed,grounded:true,yaw:0,verticalSpeed:0,groundAt:()=>0};
  loco.beforeMixer();loco.blend(1/60,'run');mixer.update(1/60);loco.afterMixer(1/60,'run');
  worst=Math.max(worst,loco.metrics.maxPlantError);residual=Math.max(residual,loco.metrics.maxResidual);sum+=loco.metrics.maxPlantError;contacts+=loco.metrics.stanceFeet;
  if(i%20===0)phases.push({...loco.metrics});
 }
 console.log(JSON.stringify({speed,worst,residual,mean:sum/120,contacts:contacts/120,phases}));
}
