import * as THREE from 'three';
import { FOX_RIG } from './foxRig';
import { carpusName } from './foxLimbRig';

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
    minStanceRatio: .35, bodyBob: .45, spineFlex: .6, swingEase: 1, releaseSwing: .25, earlyContact: .92, headBob: .8,
    // Natural gait: swing paw lift (m, walk/trot; gallop keeps its authored arc), carpal flick / hock fold (rad),
    // stance carpal give, footfall bob (m), pelvis+chest weight-shift roll and spine sway (rad), idle breath.
    liftForeWalk: .02, liftForeTrot: 0, liftHindWalk: .11, liftHindTrot: .13, carpalFlex: .65, carpalFlexRun: .6, hockFold: .28, swingReach: .72, swingReachHind: .6, swingReachRun: .5,
    carpalGive: .14, landCarpalGive: .5, strideBob: .012, rideDrop: .03, idleSettle: .02, idleRestLift: .04, idleRestFold: .6, idleForeUnder: .5, trackNarrow: .03, earTwitch: .5, idleHipShot: .07, idleLook: .16, gallopFlex: .2, gallopFlexPhase: .8, weightRoll: .04, spineSway: .08, breath: .04,
    runningGather: .6, tailAir: .05, airTuck: 1.25, airForeSwing: .55, airHindSwing: .45, airReach: .25, airHindStream: .45, airArch: .12,
    // Glide carriage: share of per-stride head height / head pitch removed, tail streaming and ribbon wave.
    takeoffCrouch: .12, takeoffPitch: .07,
    headHold: .8, gallopHeadHold: 1.5, headLevel: .75, stationarySupport: 0, tailStream: .012, tailWave: .045, tailWaveLag: .7,
    headLead: .24, headFrequency: 3, headDamping: .85, headStabilize: .65, tailLoad: .20, suspensionLift: .04, gatherLift: .09, brakeSquat: .04, brakePitch: .09, landSquash: .24, landPitch: 1, landFrequency: 3, landDamping: .9, plantStrength: 1, maxCorrection: .16, turnPlant: 1, turnLean: .08, bankMax: .2, rootBank: 1, pelvisBank: .45, headRollStabilize: .65, tailLag: .1, springFrequency: 3, springDamping: .8, debug: false };
  metrics = { supportEvaluated: false, supportRequested: 0, supportDrop: 0, supportLimited: false, supportConflict: false, supportLimitingFoot: '', supportUpperFoot: '', supportOverridden: false, supportUnreachableFeet: 0, landPitch: 0, fallPoseTime: 0, fallPoseHeld: false, bankCommand: 0, pelvisBankAngle: 0, chestBankAngle: 0, windupLoad: 0, windupActive: false, lastLandingImpact: 0, authoredFlight: false, noSupport: false, noSupportFrames: 0, noSupportSeconds: 0, contactReleaseFrames: 0, cadenceHz: 0, stanceRatio: 1, stanceRatioRate: 0, brakeLoad: 0, contactModel: 'weighted-mesh-pad', landOffset: 0, gait: 'idle', phase: 0, playback: 1, stanceFeet: 0, maxPlantError: 0, maxResidual: 0,
    earlyTouches: 0, spineFlexCommand: 0, maxSwingLift: 0, airPose: 0, pelvisRoll: 0, spineSway: 0, groundClampFeet: 0, maxSwingPenetration: 0, maxSwingResidual: 0, phaseReleaseFeet: 0, maxCorrection: 0, maxSlideMS: 0, earlySteps: 0, maxTouchdownShift: 0, suspension: 0, turnRate: 0, clipWeights: {} as Record<string, number> };
  input: MotionInput = { speed: 0, grounded: true, yaw: 0, verticalSpeed: 0, groundAt: () => 0 };
  private feet: { upper: THREE.Object3D; lower: THREE.Object3D; paw: THREE.Object3D; hock: THREE.Object3D; pole: number;
    padLocal: THREE.Vector3; planted: boolean; anchor: THREE.Vector3; clearance: number; previousSolved: THREE.Vector3; correction: THREE.Vector3; strength: number; replantTime: number; releaseCorrection: THREE.Vector3; releaseProgress: number; phaseRelease: boolean; dot: THREE.Mesh }[] = [];
  private debugGroup = new THREE.Group();
  private phase = 0;
  private lastActive = '';
  reset() {
    this.beforeMixer();
    for (const foot of this.feet) { foot.planted=false; foot.correction.set(0,0,0); foot.replantTime=0;foot.releaseCorrection.set(0,0,0);foot.releaseProgress=0;foot.phaseRelease=false; }
    this.nodSpring.value=0;this.nodSpring.velocity=0;
    this.tailLoadSpring.value=0;this.tailLoadSpring.velocity=0;
    this.lookSpring.value=0;this.lookSpring.velocity=0;
    this.brake=0;
    this.landSpring.value=0;this.landSpring.velocity=0;this.carriageReady=false;this.wasGrounded=true;this.previousVerticalSpeed=0;
    this.pelvisShare=0;
    this.supportDrop=0;this.metrics.supportDrop=0;this.metrics.supportRequested=0;this.metrics.supportEvaluated=false;this.metrics.supportLimited=false;this.metrics.supportConflict=false;this.metrics.supportLimitingFoot='';this.metrics.supportUpperFoot='';this.metrics.supportOverridden=false;this.metrics.supportUnreachableFeet=0;
    this.metrics.authoredFlight=false;this.metrics.noSupport=false;this.metrics.windupActive=false;this.metrics.windupLoad=0;
    this.metrics.fallPoseTime=0;this.metrics.fallPoseHeld=false;this.metrics.landPitch=0;
    this.metrics.bankCommand=0;this.metrics.pelvisBankAngle=0;this.metrics.chestBankAngle=0;
    this.metrics.noSupportFrames=0;this.metrics.noSupportSeconds=0;this.metrics.contactReleaseFrames=0;this.metrics.lastLandingImpact=0;this.metrics.earlyTouches=0;
    this.turn=0; this.yaw=this.group.rotation.y; this.pitch=0;
    this.leanSpring.value=0;this.leanSpring.velocity=0;
    this.pitchSpring.value=0;this.pitchSpring.velocity=0;
    for(const spring of [...this.tailSprings,...this.tailPitchSprings]){spring.value=0;spring.velocity=0;}
    this.previousSpeed=this.input.speed;this.terrainOffset=0;
  }
  /** A deliberate dash-facing snap is not a physical turn impulse. */
  syncYaw(yaw:number) { this.yaw=yaw; this.turn=0; }
  private brake=0;
  private landSpring=new Spring();
  private wasGrounded=true;
  private previousVerticalSpeed=0;
  private yaw = 0;
  private pitch = 0;
  private turn = 0;
  private lean = 0;
  private pelvisShare=0;
  private bankRestUp: {bone:THREE.Object3D;up:THREE.Vector3}[]=[];
  private tail = 0;
  private leanSpring=new Spring();
  private pitchSpring=new Spring();
  private tailSprings=Array.from({length:8},()=>new Spring());
  private tailPitchSprings=Array.from({length:8},()=>new Spring());
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
  private ears:THREE.Object3D[]=[];
  private lookSpring=new Spring();
  private nodSpring=new Spring();
  private tailLoadSpring=new Spring();
  private spine?: THREE.Object3D;
  private tailBone?: THREE.Object3D;
  private overlays: { bone: THREE.Object3D; rotation: THREE.Quaternion }[] = [];
  /** Each gait clip split into body + four legs so every leg can run its own warped clip time. */
  private parts = new Map<Gait, GaitParts>();
  private bobBones: THREE.Object3D[] = [];
  private flexBones: THREE.Object3D[] = [];
  /** Stance time / authored stance time per gait: < 1 compresses stance and lengthens the swing. */
  private stanceRatio: Record<Gait, number> = { walk: 1, trot: 1, run: 1 };
  /** Per-foot weighted swing progress 0..1 (0 while in stance). */
  private swingProgress = [0, 0, 0, 0];
  /** Per-foot swing bell (0 at lift-off and touchdown) and early-swing distal fold, blended over gaits. */
  private swingBell = [0, 0, 0, 0];
  private swingFold = [0, 0, 0, 0];
  private swingLift = [0, 0, 0, 0];
  private time = 0;
  private air = new Spring();
  constructor(private root: THREE.Object3D, private group: THREE.Group,
    private actions: Map<string, THREE.AnimationAction>) {
    this.rootPosition=root.position.clone();
    root.updateWorldMatrix(true, true);
    const arm = root.getObjectByName('SpiritFox_Armature');
    this.armScale = arm ? arm.getWorldScale(v()).x : root.getWorldScale(v()).x;
    this.yaw=group.rotation.y;
    this.spine = root.getObjectByName(FOX_RIG.pelvis);
    this.spines=FOX_RIG.spine.map(n=>root.getObjectByName(n)).filter((b):b is THREE.Object3D=>!!b);
    this.bankRestUp=[this.spine!,this.spines[this.spines.length-1]].map(bone=>({bone,up:new THREE.Vector3(0,1,0).applyQuaternion(bone.getWorldQuaternion(q()).invert())}));
    this.necks=FOX_RIG.neck.map(n=>root.getObjectByName(n)).filter((b):b is THREE.Object3D=>!!b);
    this.head=root.getObjectByName(FOX_RIG.head);
    this.ears=(['l','r'] as const).map(s=>root.getObjectByName(FOX_RIG.ear(s)[1])).filter((b):b is THREE.Object3D=>!!b);
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
      const hock=root.getObjectByName(upper.startsWith('thigh') ? upper.replace('thigh','hind_foot') : carpusName(upper.endsWith('_l') ? 'l' : 'r'));
      if (!a || !b || !c || !hock) throw new Error(`FOX rig is missing locomotion chain ${upper}/${lower}/${paw} (carpus needs applyFoxLimbRig)`);
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
      this.feet.push({padLocal,upper:a,lower:b,paw:c,hock,pole:upper.startsWith('thigh') ? 1 : -1,planted:false,anchor:v(),previousSolved:v(),correction:v(),strength:1,replantTime:0,releaseCorrection:v(),releaseProgress:0,phaseRelease:false,clearance:.005,dot});
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
    if (active!==this.lastActive) {
      if(!GAIT_NAMES.includes(active as Gait) || !GAIT_NAMES.includes(this.lastActive as Gait))
        for (const foot of this.feet) foot.planted=false;
      this.lastActive=active;
    }
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
    this.metrics.stanceRatioRate=0;
    for(const g of GAIT_NAMES) {
      const ratio=speed>.01 ? THREE.MathUtils.clamp(reach(g)*cadence/speed,this.params.minStanceRatio,1) : 1;
      if((this.weights.get(g) ?? 0)>.05)
        this.metrics.stanceRatioRate=Math.max(this.metrics.stanceRatioRate,Math.abs(ratio-this.stanceRatio[g])/Math.max(dt,1e-5));
      this.stanceRatio[g]=ratio;
    }
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
    this.swingBell.fill(0);this.swingFold.fill(0);this.swingLift.fill(0);this.swingProgress.fill(0);
    for(const [name,action] of this.actions) {
      const target=locomoting ? (weights[name as Gait] ?? 0) : name===active ? 1 : 0;
      const weight=THREE.MathUtils.lerp(this.weights.get(name) ?? 0,target,alpha);
      this.weights.set(name,weight);
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
          // Hermite swing approaches the stance clip rate at its endpoints. The 3x tangent cap
          // keeps recovery monotone; capped cases retain a velocity mismatch. 0 = linear swing.
          const sw=(u-stance)/(1-stance), m=Math.min(3,1+(stance<duty ? (duty/stance)*(1-stance)/(1-duty)-1 : 0)*this.params.swingEase);
          local=duty+(1-duty)*(sw*sw*(3-2*sw)+m*(2*sw*sw*sw-3*sw*sw+sw));
          this.swingProgress[i]+=weight*sw;
          // Lift peaks early (the paw clears, then reaches); fold snaps up right after lift-off, unfolds to reach.
          const bell=Math.sin(Math.PI*Math.pow(sw,.75));
          this.swingBell[i]+=weight*bell;
          const fold=i<2 ? THREE.MathUtils.smoothstep(sw,0,.28)*(1-THREE.MathUtils.smoothstep(sw,.5,.88)) : bell;
          this.swingFold[i]+=weight*fold*(i<2 ? (gait==='run' ? this.params.carpalFlexRun : this.params.carpalFlex) : this.params.hockFold*(gait==='run' ? .5 : 1));
          const lift=gait==='walk' ? (i<2 ? this.params.liftForeWalk : this.params.liftHindWalk) : gait==='trot' ? (i<2 ? this.params.liftForeTrot : this.params.liftHindTrot) : 0;
          this.swingLift[i]+=weight*bell*lift;
        }
        drive(parts.legs[i],weight,((contact.phase+local)%1)*duration);
      });
    }

    this.metrics.gait=locomoting ? dominant : active;
    this.metrics.clipWeights=Object.fromEntries(this.weights);
  }
  /** Float the body over the legs: pull the clip's root/pelvis bob toward its cycle mean. */
  private glideLayer() {
    let total=0;
    for(const g of GAIT_NAMES) total+=this.weights.get(g) ?? 0;
    if(total<1e-3)return;
    const keep=1-(1-this.params.bodyBob)*Math.min(1,total);
    // Long back line: pull the clip's per-stride pelvis/spine flexion toward its cycle mean.
    const flex=(1-this.params.spineFlex)*Math.min(1,total), mean=q();
    this.flexBones.forEach((bone,i)=>{
      // Vector4 defaults w to1; the quaternion accumulator must start at zero.
      const sum=new THREE.Vector4(0,0,0,0);
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
  private supportDrop=0;
  private contactAnchor(foot:{planted:boolean;anchor:THREE.Vector3;correction:THREE.Vector3;clearance:number;upper:THREE.Object3D;pole:number},pad:THREE.Vector3,ground:number,active:string,dt:number) {
    const anchor=foot.planted?foot.anchor.clone():pad.clone().add(foot.correction);
    if(!foot.planted && ['run','walk','trot'].includes(active)) {
      // Foxes track narrow: paws land in toward the midline, so elbows and hocks read from the front.
      const centre=this.group.position, side=new THREE.Vector3(1,0,0).applyQuaternion(this.group.quaternion);
      const offset=anchor.clone().sub(centre).dot(side);
      anchor.addScaledVector(side,-Math.sign(offset)*Math.min(Math.abs(offset)*.5,this.params.trackNarrow));
    }
    if(active==='idle') {
      // Standing square: forepaws settle under the shoulders instead of propping out in an A-frame.
      const target=pad.clone();
      if(foot.pole<0){const shoulder=foot.upper.getWorldPosition(v());target.x=THREE.MathUtils.lerp(target.x,shoulder.x,this.params.idleForeUnder);target.z=THREE.MathUtils.lerp(target.z,shoulder.z,this.params.idleForeUnder);}
      anchor.lerp(target,1-Math.exp(-5*dt));
    }
    anchor.y=ground+foot.clearance;
    return anchor;
  }
  /** Keep a quiet landing recovery within the planted legs' reach, without stretching bones. */
  private stationarySupport(dt:number,active:string) {
    this.metrics.supportEvaluated=false;this.metrics.supportRequested=0;this.metrics.supportLimited=false;this.metrics.supportConflict=false;this.metrics.supportLimitingFoot='';this.metrics.supportUpperFoot='';this.metrics.supportOverridden=false;this.metrics.supportUnreachableFeet=0;
    if(this.params.stationarySupport<=0){this.supportDrop=0;this.metrics.supportDrop=0;return;}
    const standing=active==='idle'||active==='land'||active==='jump_up'&&(this.input.crouch??0)>0;
    const eligible=this.input.grounded&&this.input.speed<.5&&Math.abs(this.turn)<.5&&standing;
    let requested=0,upperDrop=Infinity;
    const limitDrop=(limit:number,name:string)=>{if(limit<upperDrop){upperDrop=Math.max(0,limit);this.metrics.supportUpperFoot=name;}};
    if(eligible)for(const foot of this.feet) {
      const a=foot.upper.getWorldPosition(v()),b=foot.lower.getWorldPosition(v()),c=foot.hock.getWorldPosition(v());
      const paw=foot.paw.getWorldPosition(v()),pad=foot.paw.localToWorld(foot.padLocal.clone());
      const sample=foot.planted?foot.anchor:pad;
      const ground=this.input.groundAt(sample.x,sample.z,this.group.position.y+.6);
      if(!Number.isFinite(ground)||foot.replantTime>dt)continue;
      if((foot.planted?foot.strength:this.params.plantStrength)<.999)continue;
      if(foot.planted&&Math.hypot(foot.anchor.x-pad.x,foot.anchor.z-pad.z)>this.params.maxCorrection*.9)continue;
      // Match contact entry, including correction carried through the land-to-idle blend.
      const anchor=this.contactAnchor(foot,pad,ground,active,dt);
      const target=anchor.sub(pad.clone().sub(paw));
      target.sub(paw.clone().sub(c));
      const first=a.distanceTo(b),second=b.distanceTo(c),reach=first+second-.0001,inner=Math.abs(first-second)+.0001;
      const horizontal=Math.hypot(target.x-a.x,target.z-a.z);
      if(horizontal>=reach){this.metrics.supportUnreachableFeet++;limitDrop(0,foot.paw.name);continue;}
      const vertical=a.y-target.y,outerHeight=Math.sqrt(Math.max(0,reach*reach-horizontal*horizontal));
      limitDrop(vertical+outerHeight,foot.paw.name);
      if(horizontal<inner) {
        const innerHeight=Math.sqrt(Math.max(0,inner*inner-horizontal*horizontal));
        // Stay on the standing branch, with the upper joint above the endpoint.
        if(vertical<innerHeight){this.metrics.supportUnreachableFeet++;limitDrop(0,foot.paw.name);}
        else limitDrop(vertical-innerHeight,foot.paw.name);
      }
      const needed=vertical-outerHeight;
      if(needed>requested){requested=needed;this.metrics.supportLimitingFoot=foot.paw.name;}
    }
    this.metrics.supportEvaluated=eligible;
    this.metrics.supportRequested=requested;
    this.metrics.supportLimited=requested>this.params.stationarySupport;
    this.metrics.supportConflict=requested>upperDrop;
    this.supportDrop=Math.min(this.params.stationarySupport,upperDrop,Math.max(requested,this.supportDrop*Math.exp(-12*dt)));
    this.metrics.supportDrop=this.supportDrop;
    if(this.supportDrop>0){
      const target=this.root.getWorldPosition(v()).add(new THREE.Vector3(0,-this.supportDrop,0));
      this.root.position.copy(this.root.parent?this.root.parent.worldToLocal(target):target);
      this.root.updateWorldMatrix(true,true);
    }
  }
  /** Gallop flight: carry the body up through each authored zero-support window (gathered and extended), so the
   * legs fold under a rising body instead of crowding a level one. Zero at every touchdown and lift-off. */
  private suspension() {
    const run=this.weights.get('run') ?? 0;
    if(!this.input.grounded || run<1e-3 || this.params.suspensionLift<=0)return 0;
    const intervals=GAITS.run.contacts.map(c=>[c.phase,c.phase+c.duty*this.stanceRatio.run] as [number,number]).sort((a,b)=>a[0]-b[0]);
    let lift=0;
    // Forelegs are contacts 0,1: the window after the fore stance is the gathered flight (legs folded under),
    // which needs the larger lift or it reads as the lowest, hunched pose of the cycle.
    const fore=GAITS.run.contacts.slice(0,2).map(c=>c.phase+c.duty*this.stanceRatio.run);
    intervals.forEach(([,end],k)=>{
      const covered=intervals.reduce((e,[s0,e0])=>s0<=e+1e-6 && e0>e ? e0 : e,end);
      const next=k+1<intervals.length ? intervals[k+1][0] : intervals[0][0]+1;
      if(next<=covered)return;
      const t=((this.phase-covered)%1+1)%1/(next-covered);
      const gathered=fore.some(f=>Math.abs(f-covered)<1e-6);
      if(t<1)lift=Math.max(lift,Math.sin(Math.PI*t)*(gathered ? this.params.gatherLift : this.params.suspensionLift));
    });
    return lift*run;
  }
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
    // The gallop head rides its gather rather than kinking the neck base to hold height.
    const hold=THREE.MathUtils.lerp(this.params.headHold,this.params.gallopHeadHold,this.metrics.clipWeights.run ?? 0);
    worldOverlay(base,right.clone(),THREE.MathUtils.clamp((height-heightSmooth)/reach,-.35,.35)*hold);
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
      const impact=THREE.MathUtils.clamp(-this.previousVerticalSpeed/14,0,1);
      this.landSpring.velocity-=this.params.landSquash*Math.max(.15,impact)*16;
      this.metrics.lastLandingImpact=impact;
    }
    this.wasGrounded=this.input.grounded;this.previousVerticalSpeed=this.input.verticalSpeed;
    const landOffset=this.landSpring.step(0,dt,this.params.landFrequency,this.params.landDamping);
    this.metrics.landOffset=landOffset;
    let dy=Math.atan2(Math.sin(this.input.yaw-this.yaw),Math.cos(this.input.yaw-this.yaw));
    if(Math.abs(dy)>1)dy=0;
    this.yaw=this.input.yaw;
    this.turn=THREE.MathUtils.damp(this.turn,dy/step,12,dt);
    this.metrics.turnRate=this.turn;
    this.lean=this.leanSpring.step(THREE.MathUtils.clamp(-this.turn*this.input.speed*this.params.turnLean,-this.params.bankMax,this.params.bankMax),dt,this.params.springFrequency,this.params.springDamping);
    this.metrics.bankCommand=this.lean;
    this.pelvisShare=THREE.MathUtils.damp(this.pelvisShare,this.input.grounded ? this.params.pelvisBank : 0,12,dt);
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
    // Standing jumps load the haunches fully; a running leap keeps a shallower gather so the take-off still reads.
    const crouch=THREE.MathUtils.smoothstep(this.input.crouch ?? 0,0,1)*THREE.MathUtils.lerp(1,this.params.runningGather,THREE.MathUtils.smoothstep(this.input.speed,1,3));
    this.metrics.windupLoad=crouch;
    this.metrics.windupActive=this.input.grounded && active==='jump_up' && (this.input.crouch ?? 0)>0;
    const suspension=this.suspension();
    this.metrics.suspension=suspension;
    this.root.position.y+=this.terrainOffset+landOffset+suspension-this.brake*this.params.brakeSquat-crouch*this.params.takeoffCrouch;
    // Radians per meter of compression: shoulders lead the landing load.
    const landingPitch=Math.max(0,-landOffset)*this.params.landPitch;
    this.metrics.landPitch=landingPitch;
    if(landingPitch>0){
      this.overlays.push({bone:this.root,rotation:this.root.quaternion.clone()});
      this.root.quaternion.premultiply(q().setFromEuler(new THREE.Euler(landingPitch,0,0)));
    }
    // Whole-body lean about the ground line: legs tilt with the body, so the outer hip stays over its plant.
    const rootLean=this.lean*this.params.rootBank*this.pelvisShare/Math.max(.001,this.params.pelvisBank);
    if(Math.abs(rootLean)>1e-5){
      this.overlays.push({bone:this.root,rotation:this.root.quaternion.clone()});
      this.root.quaternion.premultiply(q().setFromAxisAngle(new THREE.Vector3(0,0,1),rootLean));
    }
    if(crouch>0){
      this.overlays.push({bone:this.root,rotation:this.root.quaternion.clone()});
      this.root.quaternion.premultiply(q().setFromEuler(new THREE.Euler(-crouch*this.params.takeoffPitch,0,0)));
    }
    overlay(this.spine,new THREE.Vector3(1,0,0),-this.brake*this.params.brakePitch);
    const lookDelta=this.input.lookYaw===undefined ? 0 : Math.atan2(Math.sin(this.input.lookYaw-this.input.yaw),Math.cos(this.input.lookYaw-this.input.yaw));
    const look=this.lookSpring.step(THREE.MathUtils.clamp(lookDelta*this.params.headLead+this.turn*.06,-.32,.32),dt,this.params.headFrequency,this.params.headDamping);
    const worldOverlay=(bone:THREE.Object3D|undefined,worldAxis:THREE.Vector3,angle:number)=>{
      if(!bone)return;
      bone.updateWorldMatrix(true,false);
      const localAxis=worldAxis.clone().applyQuaternion(bone.getWorldQuaternion(q()).invert());
      overlay(bone,localAxis,angle);
    };
    const bankAxis=new THREE.Vector3(Math.sin(this.input.yaw),0,Math.cos(this.input.yaw));
    // Load the hips as well as the shoulders; total chest bank stays bounded by the same lean.
    const bodyLean=this.lean-rootLean;
    worldOverlay(this.spine,bankAxis.clone(),bodyLean*this.pelvisShare);
    for(const spine of this.spines)worldOverlay(spine,bankAxis.clone(),bodyLean*(1-this.pelvisShare)/this.spines.length);
    const headBank=-this.lean*this.params.headRollStabilize;
    for(const neck of this.necks)worldOverlay(neck,bankAxis.clone(),headBank*.5/this.necks.length);
    worldOverlay(this.head,bankAxis.clone(),headBank*.5);
    const bend=THREE.MathUtils.clamp(this.turn*.05,-.2,.2);
    for(let i=0;i<this.spines.length;i++)worldOverlay(this.spines[i],new THREE.Vector3(0,1,0),bend/this.spines.length);
    for(const neck of this.necks)worldOverlay(neck,new THREE.Vector3(0,1,0),look*.22);
    worldOverlay(this.head,new THREE.Vector3(0,1,0),look*.34);
    const right=new THREE.Vector3(Math.cos(this.input.yaw),0,-Math.sin(this.input.yaw));
    for(const neck of this.necks)worldOverlay(neck,right.clone(),.10);
    worldOverlay(this.head,right.clone(),-.10*this.necks.length);
    const runWeight=this.metrics.clipWeights.run ?? 0;
    const groundBob=this.params.headBob*(Math.sin(this.phase*Math.PI*4)*.03*(1-runWeight)+Math.sin(this.phase*Math.PI*2)*.06*runWeight);
    const nod=this.nodSpring.step(-landOffset*2-this.brake*.10+(this.input.grounded ? groundBob : THREE.MathUtils.clamp(-this.input.verticalSpeed*.012,-.1,.1)),dt,6,.7);
    worldOverlay(this.head,right,-this.pitch*this.params.headStabilize+nod);
    const tailLoad=this.tailLoadSpring.step(this.params.tailLoad-this.input.speed*this.params.tailStream-landOffset*3+this.brake*.10,dt,2.8,.8);
    overlay(this.tailBone,new THREE.Vector3(1,0,0),tailLoad);
    this.ribbon=THREE.MathUtils.damp(this.ribbon,this.input.grounded && ['run','walk','trot'].includes(active) ? 1 : 0,4,dt);
    let tailTarget=THREE.MathUtils.clamp(-this.turn*this.params.tailLag,-.25,.25);
    // Vertical follow-through (+X droops): the brush trails a rise, lifts on the fall, whips down on landing;
    // each segment chases the one before it, so the motion travels to the flame tip instead of moving as a rod.
    let pitchTarget=THREE.MathUtils.clamp((this.input.grounded ? 0 : this.input.verticalSpeed*this.params.tailAir)-landOffset*4,-.45,.45);
    for(let i=0;i<this.tails.length;i++) {
      const pitch=this.tailPitchSprings[i].step(pitchTarget,dt,Math.max(1.1,2.6-i*.2),.55);
      overlay(this.tails[i],new THREE.Vector3(1,0,0),pitch*(i===0 ? .5 : .22));
      pitchTarget=pitch;
      const bone=this.tails[i]; const spring=this.tailSprings[i];
      const angle=spring.step(tailTarget,dt,Math.max(1.2,this.params.springFrequency-i*.16),this.params.springDamping);
      overlay(bone,new THREE.Vector3(0,0,1),angle*(i===0 ? 1 : .35));
      // Ribbon: a pitch wave travelling down the tail, locked to the stride.
      overlay(bone,new THREE.Vector3(1,0,0),this.ribbon*this.params.tailWave*Math.sin(2*Math.PI*this.phase-i*this.params.tailWaveLag));
      tailTarget=angle*.9;
    }

    this.naturalBody(dt,active,worldOverlay,bankAxis,right);
    this.root.updateWorldMatrix(true,true);
    this.stationarySupport(dt,active);
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
      if(Number.isFinite(deficit)&&deficit>0){const lift=Math.min(.1,deficit);this.root.position.y+=lift;this.metrics.supportOverridden=this.supportDrop>0;this.metrics.supportDrop=Math.max(0,this.supportDrop-lift);this.root.updateWorldMatrix(true,true);}
    }
    const gait=this.metrics.gait as Gait;
    const phase=this.phase;
    this.metrics.phase=phase;
    const fallAction=this.actions.get('jump_fall');
    this.metrics.fallPoseTime=active==='jump_fall' ? fallAction?.time ?? 0 : 0;
    this.metrics.fallPoseHeld=active==='jump_fall' && !!fallAction?.paused && !!fallAction?.clampWhenFinished;
    this.footfalls.length=0;
    this.metrics.maxSwingLift=0;this.metrics.stanceFeet=0; this.metrics.maxPlantError=0; this.metrics.maxResidual=0; this.metrics.maxSlideMS=0; this.metrics.maxCorrection=0;this.metrics.maxTouchdownShift=0;this.metrics.groundClampFeet=0;this.metrics.maxSwingPenetration=0;this.metrics.maxSwingResidual=0;this.metrics.phaseReleaseFeet=0;
    const locomoting=['run','walk','trot'].includes(active);
    this.debugGroup.visible=this.params.debug;
    let authoredSupportFeet=0;
    this.feet.forEach((foot,i)=>{
      const paw=foot.paw.localToWorld(foot.padLocal.clone());
      const padOffset=paw.clone().sub(foot.paw.getWorldPosition(v()));
      
      const gaitWeight=GAIT_NAMES.reduce((sum,name)=>sum+(this.metrics.clipWeights[name] ?? 0),0);
      const support=(Object.keys(GAITS) as Gait[]).reduce((sum,name)=> {
        const d=GAITS[name].contacts[i]; const p=(phase-d.phase+1)%1;
        return sum+(p<d.duty*this.stanceRatio[name] ? (this.metrics.clipWeights[name] ?? 0) : 0);
      },0);
      const normalizedSupport=support/Math.max(.001,gaitWeight);
      if(normalizedSupport>.5)authoredSupportFeet++;
      const windup=active==='jump_up' && (this.input.crouch ?? 0)>0 && this.input.speed<3;
      let stance=this.input.grounded && (locomoting ? normalizedSupport>(foot.planted ? .45 : .55) : (active==='idle' || active==='land' || windup));
      let earlyTouch=false;
      const swingProgress=this.swingProgress[i]/Math.max(.001,gaitWeight);
      // The gallop's touchdowns are authored to the frame; an early catch there plants a pad that then outruns the cap.
      if(!stance && locomoting && this.input.grounded && swingProgress>this.params.earlyContact && (this.metrics.clipWeights.run ?? 0)<.5) {
        const floor=this.input.groundAt(paw.x,paw.z,this.group.position.y+.6);
        if(foot.planted || (Number.isFinite(floor) && paw.y<floor+foot.clearance+.01)) {stance=true;earlyTouch=true;}
      }
      const sample=foot.planted ? foot.anchor : paw;
      const ground=this.input.groundAt(sample.x,sample.z,this.group.position.y+.6);
      foot.replantTime=Math.max(0,foot.replantTime-dt);
      if(!Number.isFinite(ground) || foot.replantTime>0)stance=false;
      // Release before the correction cap, then allow the authored leg to recover.
      // Keeping an anchor at the cap would repeatedly count steps while the pad slid.
      if(stance && foot.planted && Math.hypot(foot.anchor.x-paw.x,foot.anchor.z-paw.z)>this.params.maxCorrection*.9) {
        stance=false; foot.replantTime=.08; this.metrics.earlySteps++;
      }
      if (stance) {
        foot.phaseRelease=false;foot.releaseCorrection.set(0,0,0);foot.releaseProgress=0;
        const touchdown=!foot.planted;
        if (touchdown) {
          // Re-enter at the current solved pad, including any fading correction.
          foot.strength=this.params.plantStrength;
          if(earlyTouch)this.metrics.earlyTouches++;
          if(locomoting && this.input.speed>1) this.footfalls.push(paw.clone().setY(ground));
        }
        foot.anchor.copy(this.contactAnchor(foot,paw,ground,active,dt));
        if(touchdown && locomoting && this.input.grounded) {
          const plant=this.turnPlant(i,paw,gaitWeight);
          if(plant.lengthSq()>0){
            const before=foot.anchor.clone();
            foot.anchor.copy(paw).add(plant);foot.anchor.y=before.y;
            this.metrics.maxTouchdownShift=Math.max(this.metrics.maxTouchdownShift,before.distanceTo(foot.anchor));
          }
        }
        const delta=foot.anchor.clone().sub(paw);
        this.metrics.maxPlantError=Math.max(this.metrics.maxPlantError,Math.hypot(delta.x,delta.z));
        // Latch strength at touchdown: another pose fading in cannot move an anchor.
        delta.clampLength(0,this.params.maxCorrection).multiplyScalar(foot.strength);
        foot.correction.copy(delta);
      } else {
        const normalRelease=locomoting && this.input.grounded && Number.isFinite(ground) && foot.replantTime===0;
        const gallopWeight=(this.metrics.clipWeights.run ?? 0)/Math.max(.001,gaitWeight);
        if(i<2 && normalRelease && gallopWeight>.5 && foot.planted && swingProgress<this.params.releaseSwing && this.metrics.cadenceHz>1e-4) {
          // Refresh XZ against this frame's pose; preserve the existing vertical fade below.
          foot.releaseCorrection.copy(foot.anchor).sub(paw).setY(0).clampLength(0,this.params.maxCorrection).multiplyScalar(foot.strength);
          foot.releaseProgress=swingProgress;foot.phaseRelease=true;
        }
        if(normalRelease && foot.phaseRelease) {
          foot.releaseProgress=Math.max(foot.releaseProgress,swingProgress);
          const keep=1-THREE.MathUtils.smoothstep(foot.releaseProgress,0,this.params.releaseSwing);
          const vertical=foot.correction.y*Math.exp(-dt/.04);
          foot.correction.copy(foot.releaseCorrection).multiplyScalar(keep).setY(vertical);
          foot.correction.clampLength(0,this.params.maxCorrection);
          this.metrics.phaseReleaseFeet++;
          if(keep<=0){foot.phaseRelease=false;foot.releaseCorrection.set(0,0,0);}
        } else {
          foot.phaseRelease=false;
          foot.correction.multiplyScalar(Math.exp(-dt/.04));
        }
        if(normalRelease && !foot.phaseRelease && swingProgress>.5) {
          // Steer late swing toward the turn plant so the touchdown latch below barely moves the paw.
          const lead=this.turnPlant(i,paw,gaitWeight).multiplyScalar(THREE.MathUtils.smoothstep(swingProgress,.5,.9));
          foot.correction.x=lead.x;foot.correction.z=lead.z;
        }
        if(foot.correction.lengthSq()<1e-8)foot.correction.set(0,0,0);
      }
      let swingFloor:number|null=null;
      if(!stance && locomoting && this.input.grounded) {
        const floor=this.input.groundAt(paw.x,paw.z,this.group.position.y+.6);
        if(Number.isFinite(floor)) {
          swingFloor=floor;
          const penetration=floor+foot.clearance-paw.y-foot.correction.y;
          this.metrics.maxSwingPenetration=Math.max(this.metrics.maxSwingPenetration,penetration);
          if(penetration>0) {
            foot.correction.y+=penetration;
            foot.correction.clampLength(0,this.params.maxCorrection);
            this.metrics.groundClampFeet++;
          }
        }
      }
      // Coming out of a landing the forelegs plant and reach; folding them then reads as hooks.
      const landed=1-THREE.MathUtils.clamp(-this.landSpring.value/.04,0,1);
      const lift=this.swingLift[i]/Math.max(.001,gaitWeight), fold=landed*this.swingFold[i]/Math.max(.001,gaitWeight);
      // Idle rests the right hind: hock softly flexed, toe tipped, weight on the other three.
      const resting=active==='idle' && i===3 && this.input.grounded && Number.isFinite(ground);
      if(resting && stance){stance=false;foot.correction.set(0,0,0);}
      const swinging=!stance && locomoting && this.input.grounded;
      if(resting) {
        const w=this.weights.get('idle') ?? 0;
        this.swingPose(foot,i,this.params.idleRestLift*w,this.params.idleRestFold*w,ground);
        foot.previousSolved.copy(foot.paw.localToWorld(foot.padLocal.clone()));
      } else if(swinging) {
        this.swingPose(foot,i,lift,fold,swingFloor);
        foot.previousSolved.copy(foot.paw.localToWorld(foot.padLocal.clone()));
      } else if(stance || foot.correction.lengthSq()>0) {
        this.metrics.maxCorrection=Math.max(this.metrics.maxCorrection,foot.correction.length());
        if(stance && i<2)this.carpalGive(foot,dt);
        this.placePaw(foot,paw.add(foot.correction).sub(padOffset));
        const corrected=foot.paw.localToWorld(foot.padLocal.clone());
        if(stance && foot.planted)this.metrics.maxSlideMS=Math.max(this.metrics.maxSlideMS,corrected.distanceTo(foot.previousSolved)/step);
        foot.previousSolved.copy(corrected);
        if(stance) {
          this.metrics.maxResidual=Math.max(this.metrics.maxResidual,corrected.distanceTo(foot.anchor));
          this.metrics.stanceFeet++;
        }
      }
      if(swingFloor!==null) {
        const solvedPad=foot.paw.localToWorld(foot.padLocal.clone());
        this.metrics.maxSwingResidual=Math.max(this.metrics.maxSwingResidual,swingFloor+foot.clearance-solvedPad.y);
      }
      foot.planted=stance;
      foot.dot.position.copy(this.group.worldToLocal(foot.anchor.clone()));
      foot.dot.visible=stance;
    });
    this.metrics.authoredFlight=this.input.grounded && locomoting && authoredSupportFeet===0;
    this.metrics.noSupport=this.input.grounded && locomoting && this.metrics.stanceFeet===0;
    if(this.metrics.noSupport && dt>0) {
      this.metrics.noSupportFrames++; this.metrics.noSupportSeconds+=dt;
      if(!this.metrics.authoredFlight)this.metrics.contactReleaseFrames++;
    }
    const left=new THREE.Vector3(Math.cos(this.input.yaw),0,-Math.sin(this.input.yaw));
    // Rest-relative up projected into the actor heading plane measures the evaluated pose.
    const bankAngles=this.bankRestUp.map(({bone,up})=>{
      bone.updateWorldMatrix(true,false);
      const actualUp=up.clone().applyQuaternion(bone.getWorldQuaternion(q()));
      return -Math.atan2(actualUp.dot(left),actualUp.y);
    });
    [this.metrics.pelvisBankAngle,this.metrics.chestBankAngle]=bankAngles;
    if (!locomoting) this.metrics.gait=active;
  }
  /** Carved turn: the hips yaw over a planted pad, so a pad planted where it lands drifts 0..d through stance and
   * the outer feet hit the re-step cap. Offset to the predicted mid-stance point instead (drift -d/2..+d/2). */
  private turnPlant(i:number,pad:THREE.Vector3,gaitWeight:number) {
    const out=v();
    if(this.params.turnPlant<=0 || this.metrics.cadenceHz<1e-4)return out;
    const stanceSeconds=GAIT_NAMES.reduce((sum,g)=>sum+(this.metrics.clipWeights[g] ?? 0)*GAITS[g].contacts[i].duty*this.stanceRatio[g],0)/Math.max(.001,gaitWeight)/this.metrics.cadenceHz;
    // Slow walk pivots keep the authored plant (long stance over-rotates the prediction).
    const striding=1-(this.metrics.clipWeights.walk ?? 0)/Math.max(.001,gaitWeight);
    const angle=THREE.MathUtils.clamp(this.turn*stanceSeconds*.5*this.params.turnPlant*striding,-.35,.35);
    const pivot=this.group.position;
    return out.copy(pad).sub(pivot).applyAxisAngle(new THREE.Vector3(0,1,0),angle).add(pivot).sub(pad).setY(0).clampLength(0,this.params.maxCorrection);
  }
  /** Two-bone (fore) or hock-preserving (hind) solve that puts the paw bone at target, keeping pad orientation. */
  private chainLength(foot:{upper:THREE.Object3D;lower:THREE.Object3D;hock:THREE.Object3D}) {
    const b=foot.lower.getWorldPosition(v());
    return foot.upper.getWorldPosition(v()).distanceTo(b)+b.distanceTo(foot.hock.getWorldPosition(v()));
  }
  /** Swing: fold the distal joint anatomically (carpal flick fore, hock fold hind), then lift the carpus/hock
   * through the two-bone chain so elbow and stifle bend; the toes follow the fold. */
  private swingPose(foot:{upper:THREE.Object3D;lower:THREE.Object3D;paw:THREE.Object3D;hock:THREE.Object3D;pole:number;padLocal:THREE.Vector3;correction:THREE.Vector3;clearance:number},i:number,lift:number,fold:number,floor:number|null) {
    this.overlays.push({bone:foot.hock,rotation:foot.hock.quaternion.clone()});
    // Measured: +local X on the carpus flexes the metacarpus back; -local X on the hind foot folds the hock.
    foot.hock.quaternion.multiply(q().setFromAxisAngle(new THREE.Vector3(1,0,0),i<2 ? fold : -fold));
    foot.hock.updateWorldMatrix(false,true);
    const target=foot.paw.getWorldPosition(v()).add(foot.correction).add(new THREE.Vector3(0,lift,0));
    this.placePaw(foot,target);
    if(i<2) {
      // A forepaw folded up past its own elbow reads as a hook jabbing the chest: keep it below.
      const over=foot.paw.getWorldPosition(v()).y-(foot.lower.getWorldPosition(v()).y-.05);
      if(over>0){target.y-=over;this.placePaw(foot,target);}
    } else for(let pass=0;pass<2;pass++) {
      // A stifle lifted past the hip pushes the thigh skin out through the back: keep the knee under the hip.
      const over=foot.lower.getWorldPosition(v()).y-(foot.upper.getWorldPosition(v()).y-.04);
      if(over<=0)break;
      target.y-=over*1.5;this.placePaw(foot,target);
    }
    if(floor!==null) {
      const under=floor+foot.clearance+.01-foot.paw.localToWorld(foot.padLocal.clone()).y;
      if(under>0){target.y+=under;this.placePaw(foot,target);}
    }
    this.metrics.maxSwingLift=Math.max(this.metrics.maxSwingLift,lift);
  }
  /** Stance: the pastern gives under load (more on landing / windup) instead of standing as a straight post. */
  private carpalGive(foot:{hock:THREE.Object3D;paw:THREE.Object3D},dt:number) {
    const load=THREE.MathUtils.clamp(-this.landSpring.value/.08,0,1)+(this.input.crouch ?? 0)*.5;
    const give=this.params.carpalGive+this.params.landCarpalGive*Math.min(1,load);
    this.overlays.push({bone:foot.hock,rotation:foot.hock.quaternion.clone()},{bone:foot.paw,rotation:foot.paw.quaternion.clone()});
    foot.hock.quaternion.multiply(q().setFromAxisAngle(new THREE.Vector3(1,0,0),-give));
    foot.paw.quaternion.multiply(q().setFromAxisAngle(new THREE.Vector3(1,0,0),give));
    foot.hock.updateWorldMatrix(false,true);
    void dt;
  }
  /** Living body over the legs: footfall bob, weight-shift roll, spine sway with shoulder counter-rotation,
   * idle breath and the jump air pose. Runs before the leg solve so planted feet absorb every body motion. */
  private naturalBody(dt:number,active:string,worldOverlay:(bone:THREE.Object3D|undefined,axis:THREE.Vector3,angle:number)=>void,forward:THREE.Vector3,right:THREE.Vector3) {
    this.time+=dt;
    const up=new THREE.Vector3(0,1,0);
    const locomoting=this.input.grounded && ['run','walk','trot'].includes(active);
    const w=(g:Gait)=>locomoting ? this.weights.get(g) ?? 0 : 0;
    const walk=w('walk'), trot=w('trot');
    const mid=(g:Gait,leg:number)=>{const c=GAITS[g].contacts[leg];return c.phase+c.duty*this.stanceRatio[g]/2;};
    const wave=(leg:number,fn:(x:number)=>number)=>walk*fn(2*Math.PI*(this.phase-mid('walk',leg)))+trot*fn(2*Math.PI*(this.phase-mid('trot',leg)));
    // Stance-side hip and shoulder ride up (+roll about forward raises the fox's left).
    const pelvisRoll=this.params.weightRoll*wave(2,Math.cos), chestRoll=this.params.weightRoll*wave(0,Math.cos);
    // Bob and roll only ever lower the body: legs already near full reach can't follow a rise (floating pads).
    // Lowest just after each footfall pair; the roll's raised side is paid back with a matching drop.
    this.root.position.y-=this.params.strideBob*(walk*.6+trot)*(1+Math.cos(4*Math.PI*(this.phase-.1)))*.5+(Math.abs(pelvisRoll)+Math.abs(chestRoll))*.5*.09+this.params.rideDrop*(walk+trot);
    const sway=this.params.spineSway*wave(2,Math.sin);
    const idle=this.input.grounded ? this.weights.get('idle') ?? 0 : 0;
    const breath=Math.sin(2*Math.PI*.27*this.time), shift=Math.sin(2*Math.PI*.07*this.time+1);
    // Idle stands hip-shot: one haunch dropped, shoulders countering, weight drifting slowly.
    worldOverlay(this.spine,forward.clone(),pelvisRoll+idle*(this.params.idleHipShot+.012*shift));
    worldOverlay(this.spine,up.clone(),sway);
    const chest=this.spines[2], withers=this.spines[3];
    worldOverlay(chest,forward.clone(),chestRoll-pelvisRoll-idle*(this.params.idleHipShot*1.4+.02*shift));
    worldOverlay(chest,up.clone(),-2*sway);
    if(this.necks[0])worldOverlay(this.necks[0],up.clone(),sway*.8);
    // Gallop back: rounds through the gathered flight (legs folded under), lengthens through the extended one.
    // Positive about the actor right axis lowers a forward-pointing bone: the spines curl the chest down.
    const run=locomoting ? this.weights.get('run') ?? 0 : 0;
    const flexPhase=Math.cos(2*Math.PI*(this.phase-this.params.gallopFlexPhase));
    // Rounding only: an extension past the authored line lifts the withers beyond the planted forelegs' reach.
    const flex=run*this.params.gallopFlex*(flexPhase>0 ? flexPhase : .4*flexPhase);
    if(Math.abs(flex)>1e-4) {
      // The pelvis stays put: tucking it opens a seam at the haunch.
      for(const spine of this.spines)worldOverlay(spine,right.clone(),flex/this.spines.length*1.5);
      // Level eyeline: the head counter-pitches what the back does.
      worldOverlay(this.head,right.clone(),-flex*2);
    }
    this.metrics.spineFlexCommand=flex;
    // Breath: ribcage lifts, withers ease, root rises a few mm.
    worldOverlay(chest,right.clone(),-idle*this.params.breath*breath);
    worldOverlay(withers,right.clone(),idle*this.params.breath*.6*breath);
    // Standing soft, not locked: hips and shoulders settle a little so elbows and hocks keep a bend.
    this.root.position.y+=idle*(.006*breath-this.params.idleSettle);
    worldOverlay(this.head,right.clone(),idle*.03*breath);
    // Ear twitch: a quick flick every few seconds, alternating ears.
    const cycle=this.time/3.1, flick=Math.max(0,Math.sin(Math.PI*Math.min(1,(cycle%1)/.06)))*(cycle%1<.06 ? 1 : 0);
    const ear=this.ears[Math.floor(cycle)%2];
    if(ear && flick>0)worldOverlay(ear,forward.clone(),(Math.floor(cycle)%2 ? -1 : 1)*this.params.earTwitch*flick*Math.max(idle,.3));
    // Idle attention: an unhurried look around, carried mostly by the neck.
    const gaze=idle*this.params.idleLook*(Math.sin(2*Math.PI*.09*this.time)+.5*Math.sin(2*Math.PI*.23*this.time+2));
    if(this.necks[1])worldOverlay(this.necks[1],up.clone(),gaze*.6);
    worldOverlay(this.head,up.clone(),gaze*.4);
    // Air pose: forelegs tuck on the rise and reach on the fall, hind legs stream back off the push, body arcs.
    const airborne=!this.input.grounded && /^jump_/.test(active);
    const a=this.air.step(airborne ? THREE.MathUtils.clamp(this.input.verticalSpeed/6,-1,1) : 0,dt,3.2,.9);
    const airW=airborne ? 1 : Math.max(0,1-Math.abs(a)*4) < 1 ? Math.abs(a) : 0;
    this.metrics.airPose=a;
    if(Math.abs(a)>1e-3 || airborne) {
      // Paws curl only while rising; from the apex on the forelegs open and reach so nothing hangs limp.
      const tuck=THREE.MathUtils.lerp(this.params.airReach,this.params.airTuck,THREE.MathUtils.smoothstep(a,.1,.7));
      const reach=1-THREE.MathUtils.smoothstep(a,0,.6);
      const hind=this.params.airHindStream*(a>0 ? a : .6*a);
      const k=airborne ? 1 : airW;
      // Upper limb (measured: +local X swings the limb back): forelegs fold back under the chest on the rise and
      // reach forward-down on the fall; hind legs stream back off the push, then gather under for the landing.
      const rise=Math.max(0,a);
      for(let i=0;i<4;i++){
        const foot=this.feet[i];
        this.overlays.push({bone:foot.hock,rotation:foot.hock.quaternion.clone()},{bone:foot.upper,rotation:foot.upper.quaternion.clone()},{bone:foot.lower,rotation:foot.lower.quaternion.clone()});
        foot.hock.quaternion.multiply(q().setFromAxisAngle(new THREE.Vector3(1,0,0),k*(i<2 ? tuck : hind)));
        const upper=i<2 ? this.params.airForeSwing*(rise*.4-reach) : this.params.airHindSwing*(rise-reach*.5);
        const lower=i<2 ? this.params.airForeSwing*(rise*1.2-reach*.25) : -this.params.airHindSwing*reach*.4;
        foot.upper.quaternion.multiply(q().setFromAxisAngle(new THREE.Vector3(1,0,0),k*upper));
        foot.lower.quaternion.multiply(q().setFromAxisAngle(new THREE.Vector3(1,0,0),k*lower));
      }
      this.overlays.push({bone:this.root,rotation:this.root.quaternion.clone()});
      this.root.quaternion.premultiply(q().setFromEuler(new THREE.Euler(-k*a*this.params.airArch,0,0)));
      // Apex arch: the back rounds over the top of the arc.
      const arch=k*this.params.airArch*1.5*(1-Math.min(1,Math.abs(a)*1.6));
      for(const spine of this.spines)worldOverlay(spine,right.clone(),arch/this.spines.length);
    }
    this.metrics.pelvisRoll=pelvisRoll;this.metrics.spineSway=sway;
  }
  /** Three-joint leg: solve shoulder/hip -> elbow/stifle so the carpus/hock carries its metacarpus/metatarsus
   * (world orientation kept) onto the target; the pad keeps its own orientation. */
  private placePaw(foot:{upper:THREE.Object3D;lower:THREE.Object3D;paw:THREE.Object3D;hock:THREE.Object3D;pole:number},target:THREE.Vector3) {
    // Save every joint so correction cannot accumulate when a clip doesn't key that bone.
    for (const bone of [foot.upper,foot.lower,foot.paw,foot.hock]) this.overlays.push({bone,rotation:bone.quaternion.clone()});
    const padRotation=foot.paw.getWorldQuaternion(q());
    const hockRotation=foot.hock.getWorldQuaternion(q());
    const metatarsus=foot.paw.getWorldPosition(v()).sub(foot.hock.getWorldPosition(v()));
    // Clips touch down with the hock / carpus tucked under the hip / shoulder, which folds the short upper bone
    // flat. Tip the metatarsus / metacarpus about the paw (sagittal) until the limb is open enough.
    const hip=foot.upper.getWorldPosition(v());
    const minReach=this.chainLength(foot)*THREE.MathUtils.lerp(foot.pole<0 ? this.params.swingReach : this.params.swingReachHind,this.params.swingReachRun,this.metrics.clipWeights.run ?? 0);
    const side=new THREE.Vector3(1,0,0).applyQuaternion(this.group.quaternion), tip=q();
    if(target.clone().sub(metatarsus).distanceTo(hip)<minReach) {
      const best={d:0,r:q()};
      for(let k=1;k<=18 && best.d<minReach;k++)for(const sign of [-1,1]) {
        const r=q().setFromAxisAngle(side,sign*k*.05), d=target.clone().sub(metatarsus.clone().applyQuaternion(r)).distanceTo(hip);
        if(d>best.d){best.d=d;best.r.copy(r);}
      }
      tip.copy(best.r);
      metatarsus.applyQuaternion(tip);
    }
    this.solve(foot.upper,foot.lower,foot.hock,target.clone().sub(metatarsus),foot.pole);
    foot.hock.quaternion.copy(foot.hock.parent!.getWorldQuaternion(q()).invert().multiply(tip.multiply(hockRotation)));
    foot.hock.updateWorldMatrix(false,true);
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
