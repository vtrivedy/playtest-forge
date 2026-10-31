import * as THREE from 'three';
import { FOX_RIG } from './foxRig';

export type MotionInput = {
  lookYaw?: number; brake?: number; speed: number; grounded: boolean; yaw: number; verticalSpeed: number;
  groundAt: (x: number, z: number, ceiling: number) => number;
};
import GAITS from '../../../assets/hero/spirit_fox.loco.json';
type Gait = keyof typeof GAITS;
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
  params = { trotSpeed: 2.6, gallopSpeed: 6.5, strideScale: 1.03, gaitBlendSeconds: .32, headBob: .35,
    headLead: .24, headFrequency: 3, headDamping: .85, headStabilize: .65, tailLoad: .20, brakeSquat: .025, brakePitch: .06, landSquash: .11, landFrequency: 3.5, plantStrength: 1, maxCorrection: .16, turnLean: .045, tailLag: .1, springFrequency: 3, springDamping: .8, debug: false };
  metrics = { brakeLoad: 0, contactModel: 'weighted-mesh-pad', cycleHz: 0, effectiveStride: 0, landOffset: 0, gait: 'idle', phase: 0, playback: 1, stanceFeet: 0, maxPlantError: 0, maxResidual: 0,
    maxCorrection: 0, maxSlideMS: 0, earlySteps: 0, turnRate: 0, clipWeights: {} as Record<string, number> };
  input: MotionInput = { speed: 0, grounded: true, yaw: 0, verticalSpeed: 0, groundAt: () => 0 };
  private feet: { upper: THREE.Object3D; lower: THREE.Object3D; paw: THREE.Object3D; hock?: THREE.Object3D;
    padLocal: THREE.Vector3; planted: boolean; anchor: THREE.Vector3; clearance: number; previousSolved: THREE.Vector3; correction: THREE.Vector3; dot: THREE.Mesh }[] = [];
  private debugGroup = new THREE.Group();
  private phase = 0;
  private lastActive = '';
  reset() {
    this.beforeMixer();
    for (const foot of this.feet) { foot.planted=false; foot.correction.set(0,0,0); }
    this.nodSpring.value=0;this.nodSpring.velocity=0;
    this.tailLoadSpring.value=0;this.tailLoadSpring.velocity=0;
    this.lookSpring.value=0;this.lookSpring.velocity=0;
    this.brake=0;
    this.landSpring.value=0;this.landSpring.velocity=0;this.wasGrounded=true;this.previousVerticalSpeed=0;
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
      this.feet.push({padLocal,upper:a,lower:b,paw:c,hock:upper.startsWith('thigh') ? root.getObjectByName(upper.replace('thigh','hind_foot')) : undefined,planted:false,anchor:v(),previousSolved:v(),correction:v(),clearance:.005,dot});
    }
    root.position.y-=padHeights.reduce((a,b)=>a+b,0)/padHeights.length;
    this.rootPosition.copy(root.position);
    root.updateWorldMatrix(true,true);
    this.standingPelvisHeight=this.spine!.getWorldPosition(v()).y-floor;
    this.debugGroup.name='LocomotionContactDebug';
    group.add(this.debugGroup);
  }
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
      // A gait label changes at the blend midpoint; it is not a new touchdown.
      const groundGaits=['run','walk','trot'];
      if(!groundGaits.includes(active) || !groundGaits.includes(this.lastActive))
        for (const foot of this.feet) foot.planted=false;
      this.lastActive=active;
    }
    const locomoting=['run','walk','trot'].includes(active);
    const speed=this.input.speed;
    const walkToTrot=THREE.MathUtils.smoothstep(speed,this.params.trotSpeed-.65,this.params.trotSpeed+.65);
    const trotToGallop=THREE.MathUtils.smoothstep(speed,this.params.gallopSpeed-.8,this.params.gallopSpeed+.8);
    const weights = {walk:1-walkToTrot,trot:walkToTrot*(1-trotToGallop),run:trotToGallop};

    // All grounded clips share one phase. Cadence must use the evaluated blend,
    // otherwise contact timing changes before the visible legs have blended.
    const hasNonGaitPose=[...this.weights].some(([name,weight])=>!(name in GAITS) && weight>.01);
    const fade=locomoting && !hasNonGaitPose ? this.params.gaitBlendSeconds : this.fadeSeconds;
    const alpha=fade<=0 ? 1 : 1-Math.exp(-4*dt/fade);
    for(const name of this.actions.keys()) {
      const target=locomoting ? (weights[name as Gait] ?? 0) : name===active ? 1 : 0;
      this.weights.set(name,THREE.MathUtils.lerp(this.weights.get(name) ?? 0,target,alpha));
    }
    const gaitWeight=(Object.keys(GAITS) as Gait[]).reduce((sum,name)=>sum+(this.weights.get(name) ?? 0),0);
    let dominant: Gait='walk';
    for(const name of Object.keys(GAITS) as Gait[])
      if((this.weights.get(name) ?? 0)>(this.weights.get(dominant) ?? 0))dominant=name;
    const stride = (Object.keys(GAITS) as Gait[]).reduce((sum,name) =>
      sum + (this.weights.get(name) ?? 0)*GAITS[name].stride*this.armScale*this.params.strideScale, 0)/Math.max(.001,gaitWeight);
    this.metrics.effectiveStride=stride;
    this.metrics.cycleHz=locomoting ? speed/Math.max(.01,stride) : 0;
    if(locomoting) this.phase=(this.phase+dt*this.metrics.cycleHz)%1;
    for(const [name,action] of this.actions) {
      const weight=this.weights.get(name) ?? 0;
      if(weight>1e-5 && !action.isScheduled()) action.play();
      action.enabled=true;
      action.setEffectiveWeight(weight);
      if(name in GAITS) {
        action.paused=false;
        action.time=this.phase*action.getClip().duration;
        action.setEffectiveTimeScale(0);
        if(name===dominant)this.metrics.playback=speed*action.getClip().duration/Math.max(.01,stride);
      }
    }
    this.metrics.gait=locomoting ? dominant : active;
    this.metrics.clipWeights=Object.fromEntries(this.weights);
  }
  afterMixer(dt: number, active: string) {
    const step=Math.max(dt,.00001);
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
    this.root.position.y+=this.terrainOffset+landOffset-this.brake*this.params.brakeSquat;
    overlay(this.spine,new THREE.Vector3(1,0,0),-this.brake*this.params.brakePitch);
    const lookDelta=this.input.lookYaw===undefined ? 0 : Math.atan2(Math.sin(this.input.lookYaw-this.input.yaw),Math.cos(this.input.lookYaw-this.input.yaw));
    const look=this.lookSpring.step(THREE.MathUtils.clamp(lookDelta*this.params.headLead+this.turn*.04,-.32,.32),dt,this.params.headFrequency,this.params.headDamping);
    const worldOverlay=(bone:THREE.Object3D|undefined,worldAxis:THREE.Vector3,angle:number)=>{
      if(!bone)return;
      bone.updateWorldMatrix(true,false);
      const localAxis=worldAxis.applyQuaternion(bone.getWorldQuaternion(q()).invert());
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
    const runWeight=(this.weights.get('run') ?? 0)/Math.max(.001,(this.weights.get('walk') ?? 0)+(this.weights.get('trot') ?? 0)+(this.weights.get('run') ?? 0));
    const bob=THREE.MathUtils.lerp(Math.sin(this.phase*Math.PI*4)*.06,Math.sin(this.phase*Math.PI*2)*.22,runWeight)*this.params.headBob;
    const nod=this.nodSpring.step(-landOffset*2-this.brake*.10+(this.input.grounded ? bob : THREE.MathUtils.clamp(-this.input.verticalSpeed*.012,-.1,.1)),dt,6,.7);
    worldOverlay(this.head,right,-this.pitch*this.params.headStabilize+nod);
    const tailLoad=this.tailLoadSpring.step(this.params.tailLoad+this.input.speed*.005-landOffset*3+this.brake*.10+(this.input.grounded ? 0 : THREE.MathUtils.clamp(this.input.verticalSpeed*.015,-.1,.15)),dt,2.8,.8);
    overlay(this.tailBone,new THREE.Vector3(1,0,0),tailLoad);
    let tailTarget=THREE.MathUtils.clamp(-this.turn*this.params.tailLag,-.25,.25);
    for(let i=0;i<this.tails.length;i++) {
      const bone=this.tails[i]; const spring=this.tailSprings[i];
      const angle=spring.step(tailTarget,dt,Math.max(1.2,this.params.springFrequency-i*.16),this.params.springDamping);
      overlay(bone,new THREE.Vector3(0,0,1),angle*(i===0 ? 1 : .35));
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
      
      const gaitWeight=(Object.keys(GAITS) as Gait[]).reduce((sum,name)=>sum+(this.metrics.clipWeights[name] ?? 0),0);
      const support=(Object.keys(GAITS) as Gait[]).reduce((sum,name)=> {
        const d=GAITS[name].contacts[i]; const p=(phase-d.phase+1)%1;
        return sum+(p<d.duty ? (this.metrics.clipWeights[name] ?? 0) : 0);
      },0)/Math.max(.001,gaitWeight);
      const stance=this.input.grounded && (locomoting ? support>(foot.planted ? .3 : .55) : (active==='idle' || active==='land'));
      if (stance) {
        const sample=foot.planted ? foot.anchor : paw;
        const ground=this.input.groundAt(sample.x,sample.z,this.group.position.y+.6);
        if (!Number.isFinite(ground)) {foot.planted=false;return;}
        if (!foot.planted) { foot.anchor.copy(paw); if(locomoting && this.input.speed>1) this.footfalls.push(paw.clone().setY(ground)); }
        if(active==='idle')foot.anchor.lerp(paw,1-Math.exp(-5*dt));
        foot.anchor.y=ground+foot.clearance;
        // A tight turn can pull a stance outside its reach. Transfer support and take a new step;
        // don't solve an impossible fixed anchor or hide the event in the residual metric.
        if(foot.planted && Math.abs(this.turn)>1 && Math.hypot(foot.anchor.x-paw.x,foot.anchor.z-paw.z)>.20) {
          foot.planted=false;foot.anchor.copy(paw).setY(ground+foot.clearance);this.metrics.earlySteps++;
        }
        const delta=foot.anchor.clone().sub(paw);
        this.metrics.maxPlantError=Math.max(this.metrics.maxPlantError,Math.hypot(delta.x,delta.z));
        // Contact votes choose stance; global pose weight controls strength so
        // another clip's touchdown cannot pop an already planted paw.
        const plantBlend=locomoting ? THREE.MathUtils.smoothstep(gaitWeight,0,.85) : 1;
        delta.clampLength(0,this.params.maxCorrection).multiplyScalar(this.params.plantStrength*plantBlend);
        foot.correction.copy(delta);
      } else {
        // Carry a decaying world correction into recovery; releasing an anchor
        // must not pop the paw straight back to its uncorrected authored pose.
        foot.correction.multiplyScalar(Math.exp(-dt/.04));
        if(!this.input.grounded || foot.correction.lengthSq()<1e-8)foot.correction.set(0,0,0);
      }
      if(stance || foot.correction.lengthSq()>0) {
        this.metrics.maxCorrection=Math.max(this.metrics.maxCorrection,foot.correction.length());
        // Save both joints so correction cannot accumulate when a clip doesn't key that bone.
        for (const bone of [foot.upper,foot.lower,foot.paw,foot.hock]) if(bone) this.overlays.push({bone,rotation:bone.quaternion.clone()});
        const padRotation=foot.paw.getWorldQuaternion(q());
        const target=paw.add(foot.correction).sub(padOffset);
        if(foot.hock) {
          const hockRotation=foot.hock.getWorldQuaternion(q());
          const hockPosition=foot.hock.getWorldPosition(v());
          const metatarsus=foot.paw.getWorldPosition(v()).sub(hockPosition);
          this.solve(foot.upper,foot.lower,foot.hock,target.clone().sub(metatarsus),1);
          foot.hock.quaternion.copy(foot.hock.parent!.getWorldQuaternion(q()).invert().multiply(hockRotation));
          foot.hock.updateWorldMatrix(false,true);
        } else this.solve(foot.upper,foot.lower,foot.paw,target,-1);
        const padParent=foot.paw.parent!.getWorldQuaternion(q());
        foot.paw.quaternion.copy(padParent.invert().multiply(padRotation));
        foot.paw.updateWorldMatrix(false,true);
        const corrected=foot.paw.localToWorld(foot.padLocal.clone());
        if(stance && foot.planted)this.metrics.maxSlideMS=Math.max(this.metrics.maxSlideMS,corrected.distanceTo(foot.previousSolved)/step);
        foot.previousSolved.copy(corrected);
        if(stance) {
          this.metrics.maxResidual=Math.max(this.metrics.maxResidual,corrected.distanceTo(foot.anchor));
          this.metrics.stanceFeet++;
        }
      }
      foot.planted=stance;
      foot.dot.position.copy(this.group.worldToLocal(foot.anchor.clone()));
      foot.dot.visible=stance;
    });
    if (!locomoting) this.metrics.gait=active;
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
