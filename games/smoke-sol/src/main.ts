import * as T from 'three';
import { createForgeRenderer } from '../../shared/renderer';
import { createPostStack } from '../../shared/postfx';
import { applyStylizedIslandLights } from '../../shared/environment';
import { Juice } from '../../shared/juice';
import { DEFAULT_FEEL, createFeelPanel } from '../../shared/character-feel';
import { publishGame } from '../../shared/game-state';

const brisk = false;
const feel = { ...DEFAULT_FEEL, moveSpeed: 6.4, accel: 38, turnRate: 14, jumpVelocity: 10, gravity: 24, airControl: .72, glideGravityScale: .18, glideDrag: .35, dashSpeed: 18, dashDuration: .18 };
createFeelPanel(feel).close();
const scene = new T.Scene(); scene.background = new T.Color('#b6b1d4'); scene.fog = new T.Fog('#b6b1d4', 36, 95);
const camera = new T.PerspectiveCamera(52, innerWidth / innerHeight, .1, 150);
const forge = await createForgeRenderer(); applyStylizedIslandLights(scene); scene.add(new T.AmbientLight(0xc7b9d8, .45));
const post = createPostStack(forge.renderer, scene, camera); post.bloom.strength = .24;
const juice = new Juice(scene, camera);
const mat = (color: string, roughness = .7, metalness = .05) => new T.MeshStandardMaterial({ color, roughness, metalness });
const mint = mat('#82c9a5'), rock = mat('#625978'), coral = mat('#f38475', .4), cream = mat('#fff0cb'), wingMat = mat('#3ba9a9', .4, .2), amber = new T.MeshStandardMaterial({ color: '#ffce65', emissive: '#d58921', emissiveIntensity: .6, roughness: .2, metalness: .5 });
function mesh(geo: T.BufferGeometry, material: T.Material, parent: T.Object3D, x=0,y=0,z=0) { const m = new T.Mesh(geo, material); m.position.set(x,y,z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
// A scalloped, elongated footprint; collision uses the same outline.
function radius(a: number) { return 1 + .08 * Math.cos(a * 5); }
const outline = new T.Shape();
for(let i=0;i<=100;i++){const a=i/100*Math.PI*2, r=radius(a), x=Math.cos(a)*7*r,z=Math.sin(a)*11*r; if(i===0)outline.moveTo(x,z);else outline.lineTo(x,z);}
const land = mesh(new T.ExtrudeGeometry(outline,{depth:1,bevelEnabled:true,bevelSize:.25,bevelThickness:.2,bevelSegments:2,steps:1}),mint,scene); land.rotation.x=-Math.PI/2; land.position.y=0;
const underside=mesh(new T.ConeGeometry(1,6,12),rock,scene,0,-2,0); underside.rotation.z=Math.PI; underside.scale.set(7,1,11);
for(let i=0;i<18;i++){const z=7-i*.85; const stone=mesh(new T.CylinderGeometry(.42,.5,.09,7),cream,scene,Math.sin(i*.7)*.8,1.25,z);stone.scale.x=1.5;}
for(const [x,z] of [[-4,3],[4,0],[-4,-5],[3,-8]]){mesh(new T.CylinderGeometry(.13,.25,2.4,7),rock,scene,x,2.3,z);const crown=mesh(new T.SphereGeometry(1.4,12,8),mat('#edac9c'),scene,x,3.7,z);crown.scale.y=.42;mesh(new T.SphereGeometry(.8,12,8),mint,scene,x+.5,4,z);}
for(let i=0;i<30;i++){const a=i*2.4,r=4.7;const x=Math.cos(a)*r,z=Math.sin(a)*r*1.8;mesh(new T.ConeGeometry(.15,.6,5),i%2?cream:wingMat,scene,x,1.5,z);}
for(let i=0;i<9;i++){const cloud=mesh(new T.IcosahedronGeometry(1,1),mat('#ded3df'),scene,Math.sin(i*2)*28,-7-i%3,Math.cos(i*2)*29);cloud.scale.set(6,1.1,3);}
const player = new T.Group();scene.add(player);player.position.set(0,1.85,7);
const model = new T.Group();player.add(model);
const body=mesh(new T.SphereGeometry(.48,20,14),coral,model,0,0,0);body.scale.set(.85,.9,1.25);
mesh(new T.SphereGeometry(.38,16,12),coral,model,0,.25,.46);
const muzzle=mesh(new T.SphereGeometry(.26,16,10),cream,model,0,.16,.73);muzzle.scale.set(1,.7,.7);
for(const side of [-1,1]){const ear=mesh(new T.ConeGeometry(.14,.75,8),coral,model,side*.26,.77,.4);ear.rotation.z=-side*.24;mesh(new T.SphereGeometry(.075,12,8),mat('#263447',.2),model,side*.26,.35,.71);mesh(new T.SphereGeometry(.12,10,8),cream,model,side*.34,-.35,.24);}
const tail=mesh(new T.ConeGeometry(.22,.9,10),cream,model,0,.1,-.8);tail.rotation.x=-1.1;
const wings=[-1,1].map(side=>{const pivot=new T.Group();pivot.position.set(side*.3,.15,-.1);model.add(pivot);const fan=mesh(new T.SphereGeometry(1,16,8),wingMat,pivot,side*.48,0,0);fan.scale.set(.65,.065,.48);return pivot;});
const gems=[[-.3,4],[1,-.5],[-1,-4],[0,-8]].map(([x,z])=>({m:mesh(new T.OctahedronGeometry(.32),amber,scene,x,1.95,z),taken:false}));
const keys=new Set<string>();let buffer=0,dashRequest=false;
addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();if(!e.repeat)buffer=feel.jumpBuffer;}if(e.code.startsWith('Shift')&&!e.repeat)dashRequest=true;keys.add(e.code);});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>keys.clear());
const velocity=new T.Vector3(), facing=new T.Vector3(0,0,-1), dashDir=new T.Vector3();
let elapsed=0, deaths=0, count=0, dashes=0, grounded=true,coyote=feel.coyoteTime,dash=0,air=0,apex=0,tta=0,lastAir=0,jumping=false,apexRecorded=false,gliding=false;
const floor=1.75;const target=new T.Vector3();camera.position.set(0,9,18);
let last=performance.now();
function tick(now:number){const dt=Math.min((now-last)/1000,.04);last=now;elapsed+=dt;
 const p=player.position; const a=Math.atan2(p.z/11,p.x/7); const onLand=Math.hypot(p.x/7,p.z/11)<=radius(a);
 grounded=onLand&&p.y<=floor+.04&&velocity.y<=0;
 if(grounded){p.y=floor;velocity.y=0;coyote=feel.coyoteTime;if(jumping){lastAir=air;jumping=false;juice.bump(.08);}}else coyote=Math.max(0,coyote-dt);
 buffer=Math.max(0,buffer-dt);
 if(buffer>0&&coyote>0){velocity.y=feel.jumpVelocity;buffer=0;coyote=0;grounded=false;jumping=true;apexRecorded=false;air=0;apex=0;juice.bump(.07);}
 const wish=new T.Vector3(Number(keys.has('KeyD'))-Number(keys.has('KeyA')),0,Number(keys.has('KeyS'))-Number(keys.has('KeyW'))).normalize();
 if(wish.lengthSq())facing.copy(wish);
 if(dashRequest&&dash<=0){dash=feel.dashDuration;dashDir.copy(facing);dashes++;juice.burst(p.clone(),0x80ece3);juice.bump(.12);}dashRequest=false;
 gliding=!grounded&&velocity.y<0&&keys.has('Space');
 if(!grounded){velocity.y-=feel.gravity*(gliding?feel.glideGravityScale:1)*dt;if(gliding)velocity.y=Math.max(velocity.y,-1.8);}
 if(dash>0){velocity.x=dashDir.x*feel.dashSpeed;velocity.z=dashDir.z*feel.dashSpeed;dash-=dt;}else{const k=1-Math.exp(-feel.accel*(grounded?1:feel.airControl)*dt);velocity.x=T.MathUtils.lerp(velocity.x,wish.x*feel.moveSpeed,k);velocity.z=T.MathUtils.lerp(velocity.z,wish.z*feel.moveSpeed,k);if(gliding){velocity.x*=Math.exp(-feel.glideDrag*dt);velocity.z*=Math.exp(-feel.glideDrag*dt);}}
 p.addScaledVector(velocity,dt);
 if(jumping){air+=dt;apex=Math.max(apex,p.y-floor);if(velocity.y<=0&&!apexRecorded){tta=air;apexRecorded=true;}}
 const desired=Math.atan2(facing.x,facing.z);model.rotation.y+=Math.atan2(Math.sin(desired-model.rotation.y),Math.cos(desired-model.rotation.y))*(1-Math.exp(-feel.turnRate*dt));
 model.rotation.z=Math.sin(elapsed*17)*Math.min(Math.hypot(velocity.x,velocity.z)*.008,.09);model.scale.set(1,grounded?1+Math.sin(elapsed*17)*.025:1.08,1);
 wings.forEach((w,i)=>w.rotation.z=T.MathUtils.damp(w.rotation.z,gliding?0:(i===0?1:-1)*1.1,12,dt));
 for(const g of gems){if(g.taken)continue;g.m.rotation.y+=dt*1.8;g.m.position.y=1.95+Math.sin(elapsed*2+g.m.position.z)*.12;if(p.distanceTo(g.m.position)<1.25){g.taken=true;g.m.visible=false;count++;juice.burst(g.m.position.clone(),0xffcf65);juice.bump(.12);}}
 if(p.y<-9){deaths++;p.set(0,floor,7);velocity.set(0,0,0);jumping=false;dash=0;}
 target.copy(p).add(new T.Vector3(0,6.7,10));camera.position.lerp(target,1-Math.exp(-5*dt));camera.lookAt(p.x,p.y+.2,p.z-1.8);juice.update(dt);
 document.getElementById('status')!.textContent=count===4?'Garden awakened · all 4 seeds gathered':`${count} / 4 amber seeds　·　${gliding?'FAN GLIDE':dash>0?'WIND DASH':grounded?'ROAM':'BOUND'}`;
 publishGame({title:'Amberwind',status:count===4?'won':'playing',score:count*100,lives:1,deaths,elapsedSec:+elapsed.toFixed(2),backend:forge.backend,winCondition:'Collect all 4 amber seeds',notes:[`lastJumpApex=${apex.toFixed(3)}`,`lastTimeToApex=${tta.toFixed(3)}`,`lastAirTime=${lastAir.toFixed(3)}`,`dashesUsed=${dashes}`,`gemsCollected=${count}`,`position=${p.toArray().map(n=>n.toFixed(2)).join(',')}`,`gliding=${gliding}`,`feel=${brisk?'brisk':'spring'}`]});post.render();requestAnimationFrame(tick);}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();forge.setSize(innerWidth,innerHeight);post.setSize(innerWidth,innerHeight);});requestAnimationFrame(tick);
