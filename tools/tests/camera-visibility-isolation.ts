import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ColorField} from '../../src/render/colorField';
import {createCameraVisibilityProbe} from '../../games/fox-spirit/src/cameraVisibility';
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
const field=new ColorField(),mat=new THREE.MeshStandardMaterial();field.patchMaterial(mat);
const shader=()=>({vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:THREE.UniformsUtils.clone(THREE.ShaderLib.standard.uniforms)});
const live=shader();mat.onBeforeCompile(live as any,{} as any);
scene.add(new THREE.Mesh(new THREE.PlaneGeometry(),mat));const fox=new THREE.Group();fox.add(new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.MeshStandardMaterial()));scene.add(fox);
let target: THREE.WebGLRenderTarget|null=null;const compiled=new Set();
// API double ONLY invokes shader callbacks. No browser, canvas, WebGL context,
// rasterization or real renderer is constructed or run. Pixel arrays are synthetic.
const renderer:any={shadowMap:{autoUpdate:true,needsUpdate:false},autoClear:true,
 getRenderTarget:()=>target,getDrawingBufferSize:(v:any)=>v.set(8,8),getActiveCubeFace:()=>0,getActiveMipmapLevel:()=>0,
 getViewport:(v:any)=>v.set(0,0,8,8),getScissor:(v:any)=>v.set(0,0,8,8),getScissorTest:()=>false,
 getClearColor:(v:any)=>v.set(0),getClearAlpha:()=>1,setClearColor:()=>{},setScissorTest:()=>{},setViewport:()=>{},setScissor:()=>{},
 setRenderTarget:(v:any)=>{target=v},clear:()=>{},
 render:(s:any)=>s.traverse((o:any)=>{for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])if(m.visible&&!compiled.has(m)){compiled.add(m);m.onBeforeCompile(shader(),renderer)}}),
 readRenderTargetPixels:(_t:any,_x:any,_y:any,_w:any,_h:any,bytes:any)=>bytes.fill(255),getContext:()=>({getError:()=>0})};
const probe=createCameraVisibilityProbe(scene,renderer,camera,fox);probe.measure();
const preserved=mat.userData.colorFieldShader===live;
field.fox.set(7,8,9);field.syncMaterial(mat);
const actual=(live.uniforms as any).uFox.value.toArray();
assert.equal(preserved,true,'mask compilation preserves the live ColorField shader binding');
assert.deepEqual(actual,[7,8,9],'later live colour updates still reach the world shader');
assert.equal((scene.children[0] as THREE.Mesh).material,mat,'probe restores live material');
probe.dispose();
console.log('PASS: diagnostic shader callbacks preserve subsequent live ColorField uniform sync (CPU API double, no rendering)');
