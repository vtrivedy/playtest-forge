import * as THREE from 'three';
import { FOX_RIG } from './foxRig';

export type MotionInput = {
  lookYaw?: number; brake?: number;
  /** Jump windup progress 0..1: feet stay planted while the body loads onto its haunches. */
  crouch?: number; speed: number; grounded: boolean; yaw: number; verticalSpeed: number;
  groundAt: (x: number, z: number, ceiling: number) => number;
};
import GAITS from '../../../assets/hero/spirit_fox.loco.json';
type Gait = keyof typeof GAITS;
/** Measured: rotating the gaze about the actor right axis raises +Y pitch, so the correction flips. */
const CARRIAGE_SIGN = -1;


const BRACE_CLIPS = ['skid'];
const GAIT_NAMES = Object.keys(GAITS) as Gait[];
/** Speed each gait's designed cadence is quoted at (gait-gym bands). */
const CADENCE_REF: Record<Gait, number> = { walk: 1.5, trot: 3.8, run: 9 };
type GaitParts = { body: THREE.AnimationAction; legs: THREE.AnimationAction[]; bobMean: THREE.Vector3[]; flexMean: THREE.Quaternion[] };
const v = () => new THREE.Vector3();
const q = () => new THREE.Quaternion();
class Spring {
  value=0; velocity=0;
  step(target:number, dt:number, frequency:number, damping:number) {
    const n=Math.max(1,Math.ceil(dt/.008)); const h=dt/n; const omega=2*Math.PI*frequency;
    for(let i=0;i<n;i++) {
      this.velocity+=(omega*omega*(target-this.value)-2*damping*omega*this.velocity)*h;
      this.value+=this.velocity*h;
    }
    return this.value;
  }
}

/** Authored pose is evaluated first; contact correction only moves a two-bone chain. */
export class AuthoredLocomotion {
  params = { trotSpeed: 2.6, gallopSpeed: 6.5,
    // Glide: designed stride frequency (Hz at the gait's reference speed); bodyBob keeps that share of the clip's pelvis bob.
    walkHz: 1.8, trotHz: 2.1, gallopHz: 2.4, cadenceExponent: .35,
    minStanceRatio: .35, bodyBob: .45, spineFlex: .6, swingEase: 1, swingTuck: .35, earlyContact: .85,
    // Glide carriage: share of per-stride head bob / head pitch removed, tail streaming and ribbon wave.
    takeoffCrouch: .09, takeoffPitch: .07,
    headHold: 1.2, headLevel: .75, tailStream: .012, tailWave: .045, tailWaveLag: .7,
    headLead: .24, headFrequency: 3, headDamping: .85, headStabilize: .65, tailLoad: .20, brakeSquat: .04, brakePitch: .09, landSquash: .11, landFrequency: 3.5, plantStrength: 1, maxCorrection: .16, turnLean: .045, tailLag: .1, springFrequency: 3, springDamping: .8, debug: false };
  metrics = { cadenceHz: 0, stanceRatio: 1, brakeLoad: 0, contactModel: 'weighted-mesh-pad', landOffset: 0, gait: 'idle', phase: 0, playback: 1, stanceFeet: 0, maxPlantError: 0, maxResidual: 0,
    maxCorrection: 0, maxSlideMS: 0, earlySteps: 0, turnRate: 0, clipWeights: {} as Record<string, number> };
  input: MotionInput = { speed: 0, grounded: true, yaw: 0, verticalSpeed: 0, groundAt: () => 0 };
  private feet: { upper: THREE.Object3D; lower: THREE.Object3D; paw: THREE.Object3D; hock?: THREE.Object3D;
    padLocal: THREE.Vector3; planted: boolean; early: boolean; anchor: THREE.Vector3; clearance: number; previousSolved: THREE.Vector3; dot: THREE.Mesh }[] = [];
  private debugGroup = new THREE.Group();
  private phase = 0;
  private lastActive = '';
  private lastGait = '';
  reset() {
    this.beforeMixer();
    for (const foot of this.feet) foot.planted=false;
    this.nodSpring.value=0;this.nodSpring.velocity=0;
    this.tailLoadSpring.value=0;this.tailLoadSpring.velocity=0;
    this.lookSpring.value=0;this.lookSpring.velocity=0;
    this.brake=0;
    this.landSpring.value=0;this.landSpring.velocity=0;this.carriageReady=false;this.wasGrounded=true;this.previousVerticalSpeed=0;
    this.turn=0; this.yaw=this.group.rotation.y; this.pitch=0;
    this.leanSpring.value=0;this.leanSpring.velocity=0;
    this.pitchSpring.value=0;this.pitchSpring.velocity=0;
    for(const spring of this.tailSprings){spring.value=0;spring.velocity=0;}
    this.previousSpeed=this.input.speed;this.terrainOffset=0;
  }
  private brake=0;
  private landSpring=new Spring();
  private wasGrounded=true;
  private previousVerticalSpeed=0;
  private yaw = 0;
  private pitch = 0;
  private turn = 0;
  private lean = 0;
  private tail = 0;
  private leanSpring=new Spring();
  private pitchSpring=new Spring();
  private tailSprings=Array.from({length:8},()=>new Spring());
  private tails: THREE.Object3D[]=[];
  readonly footfalls: THREE.Vector3[]=[];
  private previousSpeed=0;
  private armScale = 1;
  private rootPosition: THREE.Vector3;
  private terrainOffset=0;
  private standingPelvisHeight=0;
  private spines:THREE.Object3D[]=[];
  private necks:THREE.Object3D[]=[];
  private head?:THREE.Object3D;
  private lookSpring=new Spring();
  private nodSpring=new Spring();
  private tailLoadSpring=new Spring();
  private spine?: THREE.Object3D;
  private tailBone?: THREE.Object3D;
  private overlays: { bone: THREE.Object3D; rotation: THREE.Quaternion }[] = [];
  /** Each gait clip split into body + four legs so every leg can run its own warped clip time. */
  private parts = new Map<Gait, GaitParts>();
  private bobBones: THREE.Object3D[] = [];
  /** Braced clips split body/legs: legs cross in ~2 frames (blending a folded gallop leg toward a brace flings it up), body eases. */
  private brace = new Map<string, { body: THREE.AnimationAction; legs: THREE.AnimationAction[] }>();
  private legWeights = new Map<string, number>();
  private flexBones: THREE.Object3D[] = [];
  /** Stance time / authored stance time per gait: < 1 compresses stance and lengthens the swing. */
  private stanceRatio: Record<Gait, number> = { walk: 1, trot: 1, run: 1 };
  /** Per-foot weighted swing progress 0..1 (0 while in stance). */
  private swingProgress = [0, 0, 0, 0];
  /** Per-foot swing tuck 0..1 (blended over gaits): folds the lower leg so a slowed swing clears the ground. */
  private tuck = [0, 0, 0, 0];
  constructor(private root: THREE.Object3D, private group: THREE.Group,
    private actions: Map<string, THREE.AnimationAction>) {
    this.rootPosition=root.position.clone();
    root.updateWorldMatrix(true, true);
    const arm = root.getObjectByName('SpiritFox_Armature');
    this.armScale = arm ? arm.getWorldScale(v()).x : root.getWorldScale(v()).x;
    this.yaw=group.rotation.y;
    this.spine = root.getObjectByName(FOX_RIG.pelvis);
    this.spines=FOX_RIG.spine.map(n=>root.getObjectByName(n)).filter((b):b is THREE.Object3D=>!!b);
    this.necks=FOX_RIG.neck.map(n=>root.getObjectByName(n)).filter((b):b is THREE.Object3D=>!!b);
    this.head=root.getObjectByName(FOX_RIG.head);
    this.tailBone = root.getObjectByName(FOX_RIG.tail[0]);
    this.tails=FOX_RIG.tail.map(name=>root.getObjectByName(name)).filter((b): b is THREE.Object3D=>!!b);
    const floor = new THREE.Box3().setFromObject(root).min.y;
    const chains = [FOX_RIG.foreleg('l'),FOX_RIG.foreleg('r')].map(l=>[l.upper,l.lower,l.paw]);
    chains.push(...[FOX_RIG.hindleg('l'),FOX_RIG.hindleg('r')].map(l=>[l.thigh,l.shin,l.paw]));
    // SkinnedMesh.updateMatrixWorld refreshes bindMatrixInverse after hero normalization.
    // Object3D.updateWorldMatrix alone does not run that override.
    root.updateMatrixWorld(true);
    const padHeights:number[]=[];
    for (const [upper, lower, paw] of chains) {
      const a=root.getObjectByName(upper), b=root.getObjectByName(lower), c=root.getObjectByName(paw);
      if (!a || !b || !c) throw new Error(`FOX rig is missing locomotion chain ${upper}/${lower}/${paw}`);
      const padPoints:THREE.Vector3[]=[];
      root.traverse(object=>{
        const mesh=object as THREE.SkinnedMesh;
        if(!mesh.isSkinnedMesh || /fur|shell|glow|flame|spiritfx/i.test(mesh.name))return;
        const boneIndex=mesh.skeleton.bones.indexOf(c as THREE.Bone);
        if(boneIndex<0)return;
        mesh.skeleton.update();
        const indices=mesh.geometry.getAttribute('skinIndex'),weights=mesh.geometry.getAttribute('skinWeight');
        for(let index=0;index<indices.count;index++) {
          let weight=0;
          for(let j=0;j<4;j++)if(indices.getComponent(index,j)===boneIndex)weight+=weights.getComponent(index,j);
          if(weight>=.65)padPoints.push(mesh.localToWorld(mesh.getVertexPosition(index,v())));
        }
      });
      if(!padPoints.length)throw new Error(`No rendered pad vertices for ${paw}`);
      const low=Math.min(...padPoints.map(p=>p.y));
      const band=padPoints.filter(p=>p.y<low+.015);
      const padWorld=band.reduce((a,b)=>a.add(b),v()).multiplyScalar(1/band.length);
      const padLocal=c.worldToLocal(padWorld.clone());
      padHeights.push(padWorld.y-floor);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(.025,6,4), new THREE.MeshBasicMaterial({color:0xffcc44, depthTest:false}));
      this.debugGroup.add(dot);
      this.feet.push({padLocal,upper:a,lower:b,paw:c,hock:upper.startsWith('thigh') ? root.getObjectByName(upper.replace('thigh','hind_foot')) : undefined,planted:false,early:false,anchor:v(),previousSolved:v(),clearance:.005,dot});
    }
    root.position.y-=padHeights.reduce((a,b)=>a+b,0)/padHeights.length;
    this.rootPosition.copy(root.position);
    root.updateWorldMatrix(true,true);
    this.standingPelvisHeight=this.spine!.getWorldPosition(v()).y-floor;
    this.splitGaits(root);
    this.debugGroup.name='LocomotionContactDebug';
    group.add(this.debugGroup);
  }
  private splitGaits(root: THREE.Object3D) {
    const legs=[FOX_RIG.foreleg('l'),FOX_RIG.foreleg('r'),FOX_RIG.hindleg('l'),FOX_RIG.hindleg('r')].map(l=>Object.values(l) as string[]);
    const legBones=new Set(legs.flat());
    const bobNames=[FOX_RIG.root,FOX_RIG.pelvis];
    this.bobBones=bobNames.map(n=>root.getObjectByName(n)!);
    this.flexBones=[FOX_RIG.pelvis,...FOX_RIG.spine].map(n=>root.getObjectByName(n)!);
    const boneOf=(t:THREE.KeyframeTrack)=>t.name.slice(0,t.name.lastIndexOf('.'));
    for(const gait of GAIT_NAMES) {
      const source=this.actions.get(gait);
      if(!source)throw new Error(`FOX clip ${gait} missing`);
      const clip=source.getClip(), mixer=source.getMixer();
      const sample=(name:string,property:'quaternion'|'position')=>{
        const track=clip.tracks.find(t=>t.name===`${name}.${property}`);
        if(!track)throw new Error(`FOX clip ${gait} has no ${name}.${property}`);
        // three's typings omit createInterpolant; it picks the track's own (slerp for quaternions).
        const interpolant=(track as unknown as {createInterpolant():THREE.Interpolant}).createInterpolant(), size=track.getValueSize(), sum=new Array(size).fill(0);
        const first=Array.from(interpolant.evaluate(0) as ArrayLike<number>);
        for(let i=0;i<32;i++) {
          const value=Array.from(interpolant.evaluate(clip.duration*i/32) as ArrayLike<number>);
          const sign=size===4 && value.reduce((a,x,j)=>a+x*first[j],0)<0 ? -1 : 1;
          value.forEach((x,j)=>sum[j]+=sign*x/32);
        }
        return sum;
      };
      this.parts.set(gait,{
        body: mixer.clipAction(new THREE.AnimationClip(`${gait}_body`,clip.duration,clip.tracks.filter(t=>!legBones.has(boneOf(t))))),
        legs: legs.map((names,i)=>mixer.clipAction(new THREE.AnimationClip(`${gait}_leg${i}`,clip.duration,clip.tracks.filter(t=>names.includes(boneOf(t)))))),
        bobMean: bobNames.map(n=>new THREE.Vector3().fromArray(sample(n,'position'))),
        flexMean: this.flexBones.map(b=>new THREE.Quaternion().fromArray(sample(b.name,'quaternion')).normalize()),
      });
    }
    for(const name of BRACE_CLIPS) {
      const source=this.actions.get(name);
      if(!source)continue;
      const clip=source.getClip(), mixer=source.getMixer();
      this.brace.set(name,{
        body: mixer.clipAction(new THREE.AnimationClip(`${name}_body`,clip.duration,clip.tracks.filter(t=>!legBones.has(boneOf(t))))),
        legs: legs.map((names,i)=>mixer.clipAction(new THREE.AnimationClip(`${name}_leg${i}`,clip.duration,clip.tracks.filter(t=>names.includes(boneOf(t)))))),
      });
    }
  }
  private hz(gait: Gait) { return gait==='walk' ? this.params.walkHz : gait==='trot' ? this.params.trotHz : this.params.gallopHz; }
  /** Undo last frame's additive layer before the mixer supplies the next authored pose. */
  beforeMixer() {
    for (let i=this.overlays.length-1;i>=0;i--) {const o=this.overlays[i];o.bone.quaternion.copy(o.rotation);}
    this.overlays.length=0;
    this.root.position.copy(this.rootPosition);
  }
  fadeSeconds = .16;
  private weights = new Map<string,number>([['idle',1]]);
  blend(dt: number, active: string) {
    if (active!==this.lastActive) { for (const foot of this.feet) foot.planted=false; this.lastActive=active; }
    const locomoting=['run','walk','trot'].includes(active);
    const speed=this.input.speed;
    const walkToTrot=THREE.MathUtils.smoothstep(speed,this.params.trotSpeed-.3,this.params.trotSpeed+.3);
    const trotToGallop=THREE.MathUtils.smoothstep(speed,this.params.gallopSpeed-.25,this.params.gallopSpeed+.25);
    const weights = {walk:1-walkToTrot,trot:walkToTrot*(1-trotToGallop),run:trotToGallop};
    let dominant: Gait='walk';
    for (const name of GAIT_NAMES) if (weights[name]>weights[dominant]) dominant=name;
    // Designed cadence, bounded so stance is never slower than the ground (no skating) and never
    // compressed below minStanceRatio. Lower cadence than the clip's natural one buys suspension.
    const reach=(g:Gait)=>GAITS[g].stride*this.armScale;
    // Cadence follows the weights the pose actually blends (smoothed), not the instantaneous targets.
    const alpha=this.fadeSeconds<=0 ? 1 : 1-Math.exp(-4*dt/this.fadeSeconds);
    const blended={} as Record<Gait,number>; let blendTotal=0;
    for(const g of GAIT_NAMES){blended[g]=THREE.MathUtils.lerp(this.weights.get(g) ?? 0,locomoting ? weights[g] : 0,alpha);blendTotal+=blended[g];}
    for(const g of GAIT_NAMES)blended[g]=blendTotal>1e-3 ? blended[g]/blendTotal : weights[g];
    let cadence=0;
    for(const g of GAIT_NAMES) {
      const natural=speed/reach(g);
      const designed=this.hz(g)*Math.pow(Math.max(speed,.05)/CADENCE_REF[g],this.params.cadenceExponent);
      cadence+=blended[g]*THREE.MathUtils.clamp(designed,natural*this.params.minStanceRatio,natural);
    }
    for(const g of GAIT_NAMES) this.stanceRatio[g]=speed>.01 ? THREE.MathUtils.clamp(reach(g)*cadence/speed,this.params.minStanceRatio,1) : 1;
    if(locomoting) this.phase=(this.phase+dt*cadence)%1;
    this.metrics.cadenceHz=cadence; this.metrics.playback=cadence; this.metrics.stanceRatio=this.stanceRatio[dominant];
    const drive=(action:THREE.AnimationAction,weight:number,time?:number)=>{
      if(weight>1e-5 && !action.isScheduled()) action.play();
      action.enabled=true;
      action.setEffectiveWeight(weight);
      if(time===undefined)return;
      action.paused=false;
      action.time=time;
      action.setEffectiveTimeScale(0);
    };
    this.tuck.fill(0); this.swingProgress.fill(0);
    const bracing=this.brace.has(active) || [...this.brace.keys()].some(n=>(this.legWeights.get(n) ?? 0)>.01);
    const legAlpha=bracing ? 1-Math.exp(-4*dt/.02) : alpha;
    for(const [name,action] of this.actions) {
      const target=locomoting ? (weights[name as Gait] ?? 0) : name===active ? 1 : 0;
      const weight=THREE.MathUtils.lerp(this.weights.get(name) ?? 0,target,alpha);
      this.weights.set(name,weight);
      const legWeight=THREE.MathUtils.lerp(this.legWeights.get(name) ?? 0,target,legAlpha);
      this.legWeights.set(name,legWeight);
      const brace=this.brace.get(name);
      if(brace) {
        // The source keeps its clock (one-shot clamp) at zero weight; its splits play at that time.
        drive(action,0);
        drive(brace.body,weight,action.time);
        for(const leg of brace.legs)drive(leg,legWeight,action.time);
        continue;
      }
      const parts=this.parts.get(name as Gait);
      if(!parts) { drive(action,weight); continue; }
      // The whole clip never plays; its body and per-leg splits do.
      action.enabled=false; action.setEffectiveWeight(0);
      const gait=name as Gait, duration=action.getClip().duration;
      drive(parts.body,weight,this.phase*duration);
      GAITS[gait].contacts.forEach((contact,i)=>{
        // Per-leg warp: stance [0,duty) of the leg's own cycle is compressed to duty·ratio so the pad
        // sweeps at ground speed; the remaining time is a longer, slower swing.
        const duty=contact.duty, stance=duty*this.stanceRatio[gait];
        const u=(this.phase-contact.phase+1)%1;
        let local=duty*u/stance;
        if(u>=stance) {
          // Hermite swing: leave and re-enter stance at the stance clip rate (no paw-velocity kink at
          // lift-off/touch-down), easing into the slower reach between. swingEase 0 = linear swing.
          const sw=(u-stance)/(1-stance), m=Math.min(3,1+(stance<duty ? (duty/stance)*(1-stance)/(1-duty)-1 : 0)*this.params.swingEase);
          local=duty+(1-duty)*(sw*sw*(3-2*sw)+m*(2*sw*sw*sw-3*sw*sw+sw));
          // Tuck grows with the suspension the warp added (none at the authored cadence).
          if(locomoting)this.tuck[i]+=weight*Math.sin(Math.PI*sw)*(1-this.stanceRatio[gait]);
          this.swingProgress[i]+=weight*sw;
        }
        drive(parts.legs[i],legWeight,((contact.phase+local)%1)*duration);
      });
    }
    if (this.lastGait!==dominant) { for(const foot of this.feet)foot.planted=false; this.lastGait=dominant; }
    this.metrics.gait=locomoting ? dominant : active;
    this.metrics.clipWeights=Object.fromEntries(this.weights);
  }
  /** Float the body over the legs: pull the clip's root/pelvis bob toward its cycle mean. */
  private glideLayer() {
    this.feet.forEach((foot,i)=>{
      // Measured: negative rotation about the lower bone's local X folds forearm and shin.
      const angle=-this.tuck[i]*this.params.swingTuck;
      if(Math.abs(angle)<1e-4)return;
      this.overlays.push({bone:foot.lower,rotation:foot.lower.quaternion.clone()});
      foot.lower.quaternion.multiply(q().setFromAxisAngle(new THREE.Vector3(1,0,0),angle));
    });
    let total=0;
    for(const g of GAIT_NAMES) total+=this.weights.get(g) ?? 0;
    if(total<1e-3)return;
    const keep=1-(1-this.params.bodyBob)*Math.min(1,total);
    // Long back line: pull the clip's per-stride pelvis/spine flexion toward its cycle mean.
    const flex=(1-this.params.spineFlex)*Math.min(1,total), mean=q();
    this.flexBones.forEach((bone,i)=>{
      const sum=new THREE.Vector4();
      for(const g of GAIT_NAMES){const w=this.weights.get(g) ?? 0, m=this.parts.get(g)!.flexMean[i];
        const sign=sum.x*m.x+sum.y*m.y+sum.z*m.z+sum.w*m.w<0 ? -1 : 1;
        sum.x+=sign*w*m.x;sum.y+=sign*w*m.y;sum.z+=sign*w*m.z;sum.w+=sign*w*m.w;}
      mean.set(sum.x,sum.y,sum.z,sum.w).normalize();
      this.overlays.push({bone,rotation:bone.quaternion.clone()});
      bone.quaternion.slerp(mean,flex);
    });
    this.bobBones.forEach((bone,i)=>{
      const m=v();
      for(const g of GAIT_NAMES) m.addScaledVector(this.parts.get(g)!.bobMean[i],(this.weights.get(g) ?? 0)/total);
      bone.position.sub(m).multiplyScalar(keep).add(m);
    });
  }
  private headHeightSpring=new Spring();
  private headPitchSpring=new Spring();
  private carriageReady=false;
  private ribbon=0;
  /** Pitch of a bone's +Y in the world (chain bones point toward their child along +Y). */
  private static pitchOf(bone:THREE.Object3D) {
    const d=new THREE.Vector3(0,1,0).applyQuaternion(bone.getWorldQuaternion(q()));
    return Math.atan2(d.y,Math.hypot(d.x,d.z));
  }
  /** Low-pass the back line and gaze: slope and turns still read, the per-stride rock and nod don't. */
  private carriage(dt:number,worldOverlay:(bone:THREE.Object3D|undefined,axis:THREE.Vector3,angle:number)=>void,right:THREE.Vector3) {
    if(!this.head||!this.necks.length)return;
    // Head carriage is held from the neck base so the shoulders (and forepaw stance sweep) stay authored.
    const base=this.necks[0];
    this.root.updateWorldMatrix(true,true);
    const headY=()=>this.head!.getWorldPosition(v()).y-this.group.position.y;
    const height=headY();
    if(!this.carriageReady){this.headHeightSpring.value=height;this.headPitchSpring.value=AuthoredLocomotion.pitchOf(this.head);this.headHeightSpring.velocity=this.headPitchSpring.velocity=0;this.carriageReady=true;}
    const heightSmooth=this.headHeightSpring.step(height,dt,1.2,1);
    const reach=Math.max(.05,base.getWorldPosition(v()).distanceTo(this.head.getWorldPosition(v())));
    // Positive rotation about the actor's right axis lowers a forward-pointing neck.
    worldOverlay(base,right.clone(),THREE.MathUtils.clamp((height-heightSmooth)/reach,-.35,.35)*this.params.headHold);
    this.root.updateWorldMatrix(true,true);
    const head=AuthoredLocomotion.pitchOf(this.head);
    const headSmooth=this.headPitchSpring.step(head,dt,1.2,1);
    const level=(headSmooth-head)*this.params.headLevel*CARRIAGE_SIGN;
    for(const neck of this.necks)worldOverlay(neck,right.clone(),level*.5/this.necks.length);
    worldOverlay(this.head,right.clone(),level*.5);
    this.root.updateWorldMatrix(true,true);
  }

  afterMixer(dt: number, active: string) {
    const step=Math.max(dt,.00001);
    this.glideLayer();
    if(this.input.grounded && !this.wasGrounded) {
      const impact=THREE.MathUtils.clamp(-this.previousVerticalSpeed/14,.15,1);
      this.landSpring.velocity-=this.params.landSquash*impact*16;
    }
    this.wasGrounded=this.input.grounded;this.previousVerticalSpeed=this.input.verticalSpeed;
    const landOffset=this.landSpring.step(0,dt,this.params.landFrequency,.75);
    this.metrics.landOffset=landOffset;
    let dy=Math.atan2(Math.sin(this.input.yaw-this.yaw),Math.cos(this.input.yaw-this.yaw));
    if(Math.abs(dy)>1)dy=0;
    this.yaw=this.input.yaw;
    this.turn=THREE.MathUtils.damp(this.turn,dy/step,12,dt);
    this.metrics.turnRate=this.turn;
    this.lean=this.leanSpring.step(THREE.MathUtils.clamp(-this.turn*this.input.speed*this.params.turnLean,-.16,.16),dt,this.params.springFrequency,this.params.springDamping);
    this.tail=THREE.MathUtils.damp(this.tail,-this.turn*this.params.tailLag,7,dt);
    const overlay=(bone:THREE.Object3D|undefined,axis:THREE.Vector3,angle:number)=>{
      if (!bone) return;
      this.overlays.push({bone,rotation:bone.quaternion.clone()});
      bone.quaternion.multiply(q().setFromAxisAngle(axis,angle));
    };
    const forward=new THREE.Vector3(Math.sin(this.input.yaw),0,Math.cos(this.input.yaw));
    const front=this.group.position.clone().addScaledVector(forward,.45);
    const back=this.group.position.clone().addScaledVector(forward,-.45);
    const fg=this.input.groundAt(front.x,front.z,this.group.position.y+.8);
    const bg=this.input.groundAt(back.x,back.z,this.group.position.y+.8);
    const slope=this.input.grounded && Number.isFinite(fg) && Number.isFinite(bg) ? -Math.atan2(fg-bg,.9) : 0;
    const brakeTarget=this.input.grounded ? this.input.brake ?? 0 : 0;
    this.brake=THREE.MathUtils.damp(this.brake,brakeTarget,brakeTarget>this.brake ? 14 : 5,dt);
    this.metrics.brakeLoad=this.brake;
    const acceleration=(this.input.speed-this.previousSpeed)/step; this.previousSpeed=this.input.speed;
    this.pitch=this.pitchSpring.step(THREE.MathUtils.clamp(slope+acceleration*.002,-.4,.4),dt,this.params.springFrequency,this.params.springDamping);
    this.overlays.push({bone:this.root,rotation:this.root.quaternion.clone()});
    this.root.quaternion.premultiply(q().setFromEuler(new THREE.Euler(this.pitch,0,0)));
    this.root.updateWorldMatrix(true,true);
    // The actor pivot was centred on the whole silhouette (including the tail). Terrain height must
    // be sampled under the rendered rig origin, otherwise downhill leaves the forelegs beyond reach.
    const rigOrigin=this.root.getWorldPosition(v());
    const rigGround=this.input.groundAt(rigOrigin.x,rigOrigin.z,this.group.position.y+.8);
    const actorGround=this.input.groundAt(this.group.position.x,this.group.position.z,this.group.position.y+.8);
    const terrainTarget=this.input.grounded && Number.isFinite(rigGround) && Number.isFinite(actorGround)
      ? THREE.MathUtils.clamp(rigGround-actorGround,-.3,.3) : 0;
    this.terrainOffset=THREE.MathUtils.damp(this.terrainOffset,terrainTarget,25,dt);
    // Standing jumps load the haunches; a gallop carries its momentum straight into the leap.
    const crouch=THREE.MathUtils.smoothstep(this.input.crouch ?? 0,0,1)*(1-THREE.MathUtils.smoothstep(this.input.speed,1,3));
    this.root.position.y+=this.terrainOffset+landOffset-this.brake*this.params.brakeSquat-crouch*this.params.takeoffCrouch;
    if(crouch>0){
      this.overlays.push({bone:this.root,rotation:this.root.quaternion.clone()});
      this.root.quaternion.premultiply(q().setFromEuler(new THREE.Euler(-crouch*this.params.takeoffPitch,0,0)));
    }
    overlay(this.spine,new THREE.Vector3(1,0,0),-this.brake*this.params.brakePitch);
    const lookDelta=this.input.lookYaw===undefined ? 0 : Math.atan2(Math.sin(this.input.lookYaw-this.input.yaw),Math.cos(this.input.lookYaw-this.input.yaw));
    const look=this.lookSpring.step(THREE.MathUtils.clamp(lookDelta*this.params.headLead+this.turn*.04,-.32,.32),dt,this.params.headFrequency,this.params.headDamping);
    const worldOverlay=(bone:THREE.Object3D|undefined,worldAxis:THREE.Vector3,angle:number)=>{
      if(!bone)return;
      bone.updateWorldMatrix(true,false);
      const localAxis=worldAxis.clone().applyQuaternion(bone.getWorldQuaternion(q()).invert());
      overlay(bone,localAxis,angle);
    };
    for(const spine of this.spines)worldOverlay(spine,new THREE.Vector3(Math.sin(this.input.yaw),0,Math.cos(this.input.yaw)),this.lean/this.spines.length);
    const bend=THREE.MathUtils.clamp(this.turn*.035,-.14,.14);
    for(let i=0;i<this.spines.length;i++)worldOverlay(this.spines[i],new THREE.Vector3(0,1,0),bend/this.spines.length);
    for(const neck of this.necks)worldOverlay(neck,new THREE.Vector3(0,1,0),look*.22);
    worldOverlay(this.head,new THREE.Vector3(0,1,0),look*.34);
    const right=new THREE.Vector3(Math.cos(this.input.yaw),0,-Math.sin(this.input.yaw));
    for(const neck of this.necks)worldOverlay(neck,right.clone(),.10);
    worldOverlay(this.head,right.clone(),-.10*this.necks.length);
    const nod=this.nodSpring.step(-landOffset*2-this.brake*.10+(this.input.grounded ? Math.sin(this.phase*Math.PI*(this.metrics.gait==='run' ? 2 : 4))*(this.metrics.gait==='run' ? .06 : .03) : THREE.MathUtils.clamp(-this.input.verticalSpeed*.012,-.1,.1)),dt,6,.7);
    worldOverlay(this.head,right,-this.pitch*this.params.headStabilize+nod);
    const tailLoad=this.tailLoadSpring.step(this.params.tailLoad-this.input.speed*this.params.tailStream-landOffset*3+this.brake*.10+(this.input.grounded ? 0 : THREE.MathUtils.clamp(this.input.verticalSpeed*.015,-.1,.15)),dt,2.8,.8);
    overlay(this.tailBone,new THREE.Vector3(1,0,0),tailLoad);
    this.ribbon=THREE.MathUtils.damp(this.ribbon,this.input.grounded && ['run','walk','trot'].includes(active) ? 1 : 0,4,dt);
    let tailTarget=THREE.MathUtils.clamp(-this.turn*this.params.tailLag,-.25,.25);
    for(let i=0;i<this.tails.length;i++) {
      const bone=this.tails[i]; const spring=this.tailSprings[i];
      const angle=spring.step(tailTarget,dt,Math.max(1.2,this.params.springFrequency-i*.16),this.params.springDamping);
      overlay(bone,new THREE.Vector3(0,0,1),angle*(i===0 ? 1 : .35));
      // Ribbon: a pitch wave travelling down the tail, locked to the stride.
      overlay(bone,new THREE.Vector3(1,0,0),this.ribbon*this.params.tailWave*Math.sin(2*Math.PI*this.phase-i*this.params.tailWaveLag));
      tailTarget=angle*.9;
    }

    this.root.updateWorldMatrix(true,true);
    if(this.tailBone && this.input.grounded) {
      const base=this.tailBone.getWorldPosition(v()); let lift=0;
      for(const bone of this.tails.slice(1)) {
        const p=bone.getWorldPosition(v()); const ground=this.input.groundAt(p.x,p.z,this.group.position.y+.6);
        if(Number.isFinite(ground))lift=Math.max(lift,Math.atan2(Math.max(0,ground+.24-p.y),Math.max(.2,p.distanceTo(base))));
      }
      if(lift>0) {overlay(this.tailBone,new THREE.Vector3(1,0,0),Math.min(.65,lift));this.root.updateWorldMatrix(true,true);}
    }
    this.carriage(dt,worldOverlay,right);
    if(this.input.grounded && Math.abs(slope)<.1 && Math.abs(this.turn)>.5 && this.spine) {
      const pelvis=this.spine.getWorldPosition(v());
      const floorY=this.input.groundAt(pelvis.x,pelvis.z,this.group.position.y+.8);
      const deficit=this.standingPelvisHeight-.10-(pelvis.y-floorY);
      if(Number.isFinite(deficit)&&deficit>0){this.root.position.y+=Math.min(.1,deficit);this.root.updateWorldMatrix(true,true);}
    }
    const gait=this.metrics.gait as Gait;
    const data=GAITS[gait];
    const action=this.actions.get(gait);
    const phase=this.phase;
    this.metrics.phase=phase;
    this.footfalls.length=0;
    this.metrics.stanceFeet=0; this.metrics.maxPlantError=0; this.metrics.maxResidual=0; this.metrics.maxSlideMS=0; this.metrics.maxCorrection=0;
    const locomoting=['run','walk','trot'].includes(active);
    this.debugGroup.visible=this.params.debug;
    this.feet.forEach((foot,i)=>{
      const paw=foot.paw.localToWorld(foot.padLocal.clone());
      const padOffset=paw.clone().sub(foot.paw.getWorldPosition(v()));
      
      const support=(Object.keys(GAITS) as Gait[]).reduce((sum,name)=> {
        const d=GAITS[name].contacts[i]; const p=(phase-d.phase+1)%1;
        return sum+(p<d.duty*this.stanceRatio[name] ? (this.metrics.clipWeights[name] ?? 0) : 0);
      },0);
      const windup=active==='jump_up' && (this.input.crouch ?? 0)>0 && this.input.speed<3;
      let early=false;
      let stance=this.input.grounded && (locomoting ? support>.55 : (active==='idle' || active==='land' || windup));
      // Early touch-down: at the slowed cadence the clip's paw meets the ground a frame or two before its
      // stance window. Plant it where it lands instead of sliding it along the surface.
      if(!stance && locomoting && this.input.grounded && this.swingProgress[i]>this.params.earlyContact) {
        const ground=this.input.groundAt(paw.x,paw.z,this.group.position.y+.6);
        if(Number.isFinite(ground) && paw.y<ground+foot.clearance+.01) stance=early=true;
      }
      // Latched: an early plant holds until its nominal stance window takes over.
      if(!stance && foot.early && foot.planted && locomoting && this.input.grounded) stance=early=true;
      foot.early=early;
      if (stance) {
        const sample=foot.planted ? foot.anchor : paw;
        const ground=this.input.groundAt(sample.x,sample.z,this.group.position.y+.6);
        if (!Number.isFinite(ground)) {foot.planted=false;return;}
        if (!foot.planted) { foot.anchor.copy(paw); if(locomoting && this.input.speed>1) this.footfalls.push(paw.clone().setY(ground)); }
        if(active==='idle')foot.anchor.lerp(paw,1-Math.exp(-5*dt));
        foot.anchor.y=ground+foot.clearance;
        // A tight turn can pull a stance outside its reach. Transfer support and take a new step;
        // don't solve an impossible fixed anchor or hide the event in the residual metric.
        if(foot.planted && Math.hypot(foot.anchor.x-paw.x,foot.anchor.z-paw.z)>(Math.abs(this.turn)>1 ? .20 : .25)) {
          foot.planted=false;foot.anchor.copy(paw).setY(ground+foot.clearance);this.metrics.earlySteps++;
        }
        const delta=foot.anchor.clone().sub(paw);
        this.metrics.maxPlantError=Math.max(this.metrics.maxPlantError,Math.hypot(delta.x,delta.z));
        // IK confidence follows blended contact agreement, so a 50/50 gait handoff keeps its plants.
        // An established plant keeps full correction; only a fresh contact during a gait handoff eases in.
        const plantBlend=!locomoting || early || foot.planted ? 1 : THREE.MathUtils.smoothstep(support,.55,.9);
        delta.clampLength(0,this.params.maxCorrection).multiplyScalar(this.params.plantStrength*plantBlend);
        this.metrics.maxCorrection=Math.max(this.metrics.maxCorrection,delta.length());
        this.placePaw(foot,paw.add(delta).sub(padOffset));
        const corrected=foot.paw.localToWorld(foot.padLocal.clone());
        if(foot.planted)this.metrics.maxSlideMS=Math.max(this.metrics.maxSlideMS,corrected.distanceTo(foot.previousSolved)/step);
        foot.previousSolved.copy(corrected);
        this.metrics.maxResidual=Math.max(this.metrics.maxResidual,corrected.distanceTo(foot.anchor));
        this.metrics.stanceFeet++;
      }
      else if(locomoting && this.input.grounded) {
        // Swing ground clamp: the clip's paw dips under the surface just before touch-down; at the
        // slowed cadence that frame is visible as a paw sliding through the ground. Lift it, vertically only.
        const ground=this.input.groundAt(paw.x,paw.z,this.group.position.y+.6);
        if(Number.isFinite(ground) && paw.y<ground+foot.clearance)
          this.placePaw(foot,paw.setY(ground+foot.clearance).sub(padOffset));
      }
      foot.planted=stance;
      foot.dot.position.copy(this.group.worldToLocal(foot.anchor.clone()));
      foot.dot.visible=stance;
    });
    if (!locomoting) this.metrics.gait=active;
  }
  /** Two-bone (fore) or hock-preserving (hind) solve that puts the paw bone at target, keeping pad orientation. */
  private placePaw(foot:{upper:THREE.Object3D;lower:THREE.Object3D;paw:THREE.Object3D;hock?:THREE.Object3D},target:THREE.Vector3) {
    // Save every joint so correction cannot accumulate when a clip doesn't key that bone.
    for (const bone of [foot.upper,foot.lower,foot.paw,foot.hock]) if(bone) this.overlays.push({bone,rotation:bone.quaternion.clone()});
    const padRotation=foot.paw.getWorldQuaternion(q());
    if(foot.hock) {
      const hockRotation=foot.hock.getWorldQuaternion(q());
      const metatarsus=foot.paw.getWorldPosition(v()).sub(foot.hock.getWorldPosition(v()));
      this.solve(foot.upper,foot.lower,foot.hock,target.clone().sub(metatarsus),1);
      foot.hock.quaternion.copy(foot.hock.parent!.getWorldQuaternion(q()).invert().multiply(hockRotation));
      foot.hock.updateWorldMatrix(false,true);
    } else this.solve(foot.upper,foot.lower,foot.paw,target,-1);
    foot.paw.quaternion.copy(foot.paw.parent!.getWorldQuaternion(q()).invert().multiply(padRotation));
    foot.paw.updateWorldMatrix(false,true);
  }
  private solve(upper:THREE.Object3D, lower:THREE.Object3D, paw:THREE.Object3D,target:THREE.Vector3,poleSign:number) {
    const a=upper.getWorldPosition(v()), b=lower.getWorldPosition(v()), c=paw.getWorldPosition(v());
    const l1=a.distanceTo(b),l2=b.distanceTo(c); if(l1<.001||l2<.001)return;
    const direction=target.clone().sub(a).normalize();
    const distance=THREE.MathUtils.clamp(a.distanceTo(target),Math.abs(l1-l2)+.0001,l1+l2-.0001);
    // Anatomical pole: fore elbow backward, hind stifle forward, always in the actor's sagittal plane.
    const pole=new THREE.Vector3(0,0,poleSign).applyQuaternion(this.group.quaternion);
    const bend=pole.addScaledVector(direction,-pole.dot(direction));
    if(bend.lengthSq()<1e-8)return;
    bend.normalize();
    const along=(l1*l1+distance*distance-l2*l2)/(2*distance);
    const joint=a.clone().addScaledVector(direction,along).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-along*along)));
    const aim=(bone:THREE.Object3D,from:THREE.Vector3,to:THREE.Vector3)=>{
      const world=bone.getWorldQuaternion(q());
      const correction=q().setFromUnitVectors(from.normalize(),to.normalize());
      const parent=bone.parent?.getWorldQuaternion(q()) ?? q();
      bone.quaternion.copy(parent.invert().multiply(correction.multiply(world)));
      bone.updateWorldMatrix(false,true);
    };
    aim(upper,b.clone().sub(a),joint.clone().sub(a));
    const elbow=lower.getWorldPosition(v()),end=paw.getWorldPosition(v());
    aim(lower,end.sub(elbow),target.clone().sub(elbow));
  }
}
