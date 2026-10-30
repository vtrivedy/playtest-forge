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
const center=scaled.getCenter(new THREE.Vector3());root.position.x-=center.x;root.position.z-=center.z;

root.updateMatrixWorld(true);
root.traverse(o=>{
 if(!(o as THREE.SkinnedMesh).isSkinnedMesh)return;
 const mesh=o as THREE.SkinnedMesh;mesh.skeleton.update();
 const indices=mesh.geometry.getAttribute('skinIndex'),weights=mesh.geometry.getAttribute('skinWeight');
 console.log('MESH',mesh.name,mesh.geometry.getAttribute('position').count);
 for(const name of ['front_paw_l','front_paw_r','hind_paw_l','hind_paw_r']){
  const boneId=mesh.skeleton.bones.findIndex(b=>b.name===name);const points:THREE.Vector3[]=[];
  for(let i=0;i<indices.count;i++){
   let weight=0;for(let j=0;j<4;j++)if(indices.getComponent(i,j)===boneId)weight+=weights.getComponent(i,j);
   if(weight<.65)continue;
   points.push(mesh.localToWorld(mesh.getVertexPosition(i,new THREE.Vector3())));
  }
  if(!points.length)continue;
  points.sort((a,b)=>a.y-b.y);const low=points.filter(p=>p.y<points[0].y+.015);
  const center=low.reduce((a,b)=>a.add(b),new THREE.Vector3()).multiplyScalar(1/low.length);
  console.log(name,JSON.stringify({n:points.length,low:low.length,minY:points[0].y,center:center.toArray(),local:root.getObjectByName(name)!.worldToLocal(center.clone()).toArray()}));
 }
});
