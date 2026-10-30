"""Bake role-based locomotion onto the current hero; no mesh rebuild.
blender -b -P tools/blender/scripts/build_loco_sol.py -- /tmp/source-fox-v3.glb
"""
import bpy, math, os, sys, json, hashlib, statistics
from mathutils import Vector, Quaternion, Euler
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
bpy.ops.wm.read_factory_settings(use_empty=True)
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
if not args: raise RuntimeError('Pass an explicit source GLB after --; output must never be its own input')
if os.path.realpath(args[0]) == os.path.realpath(f'{ROOT}/assets/hero/spirit_fox.glb'): raise RuntimeError('Source and output must differ')
bpy.ops.import_scene.gltf(filepath=os.path.abspath(args[0]))
sc = bpy.context.scene
SOURCE_FPS = sc.render.fps
sc.render.fps = 60
arm = next(o for o in sc.objects if o.type == 'ARMATURE')
# Bone-role aliases exist only while authoring; the exported rig keeps FOX's contract names.
ROLE = {'pelvis':'Body','spine_01':'Torso','spine_02':'Torso2','spine_04':'Torso3','head':'Head'}
for i in range(1,4): ROLE[f'neck_{i:02}']=f'Neck{i}'
for i in range(1,9): ROLE[f'tail_{i:02}']=f'Tail{i}'
for side in 'lr':
    for src,dst in [('upperarm','FrontUpperLeg'),('forearm','FrontLowerLeg'),('front_paw','FrontPaw'),('thigh','BackLeg'),('shin','BackUpperLeg'),('hind_foot','BackLowerLeg'),('hind_paw','BackPaw')]:
        ROLE[f'{src}_{side}']=f'{dst}.{side.upper()}'
    for i in range(1,5): ROLE[f'ear_{i:02}_{side}']=f'Ear{i}.{side.upper()}'
if 'pelvis' not in arm.data.bones: raise RuntimeError('Expected FOX v3 rig contract')
for src,dst in ROLE.items():
    if src in arm.data.bones: arm.data.bones[src].name=dst
for act in bpy.data.actions:
    for fc in act.fcurves:
        for src,dst in ROLE.items(): fc.data_path=fc.data_path.replace(f'pose.bones["{src}"]',f'pose.bones["{dst}"]')
SRC_ACTIONS = {a.name.split('_SpiritFox')[0]: a for a in bpy.data.actions}
# Reuse proven role-aware pose writer and sagittal anatomical solver, not the look stage.
exec(compile(open(f'{ROOT}/tools/blender/scripts/fox_gait_authoring.py').read(), 'fox_gait_authoring.py', 'exec'))
base = sample(SRC_ACTIONS['idle'], 0)
for a in list(bpy.data.actions):
    a.name = a.name.split('_SpiritFox')[0]
init_solver(base)
# Ground clips use linear stance sweep, smooth lifted recovery, no per-frame body scale.
def gait_pose(t, phases, duty, sweep, lift, kind):
    p = copy(base)
    for bn in LEG_BONES: p[bn][1] = Quaternion()
    if kind == 'gallop':
        return gallop_pose(t, st=1.7)
    bob = .018 if kind == 'walk' else .035
    wloc(p, 'Body', (0, 0, (-.18 if kind == 'walk' else -.24) + bob * math.cos(4 * math.pi * t)))
    wrot(p, 'Body', (0, 1, 0), (1.4 if kind == 'walk' else 2.2) * math.sin(2*math.pi*t))
    wrot(p, 'Neck1', (1,0,0), (8 if kind=='walk' else 14)+2*math.cos(4*math.pi*t))
    wrot(p, 'Head', (1,0,0), -6 if kind=='walk' else -10)
    tail_wave(p, t, amp_yaw=2, amp_pitch=2, speed=1, lift=-12, per=-1)
    apply_dict(p)
    for key, td in phases.items():
        stance, u = leg_phase(t, td, duty)
        side = key[0]
        if 'fore' in key:
            l = FORE[side]
            center=l['foot'].copy(); center.x=REST_YZ[l['up']][0].x+.05
            target = paw_path(stance, u, center, sweep/2, sweep/2, lift, duty=duty)
            a,b = ik2(posed_yz(l['up'])[0], target, l['a'], l['b'], pole=1)
            paw = rest_ang(l['paw']) + math.radians(30 * math.sin(math.pi*u) if not stance else 0)
            set_chain(p, [l['up'],l['lo'],l['paw']], [a,b,paw])
        else:
            l = HIND[side]
            target = paw_path(stance, u, l['foot'], sweep/2, sweep/2, lift*.8, duty=duty)
            mt = rest_ang(l['mt']) + math.radians(18*math.sin(math.pi*u) if not stance else -3+6*u)
            joint = target - Vector((math.cos(mt),math.sin(mt)))*l['c']
            a,b = ik2(posed_yz(l['th'])[0],joint,l['a'],l['b'])
            set_chain(p,[l['th'],l['sh'],l['mt'],l['paw']],[a,b,mt,rest_ang(l['paw'])])
    return p
specs = [('walk',1.4,.65,1.0,.23,{'L_hind':0,'L_fore':.25,'R_hind':.5,'R_fore':.75}),
         ('trot',2.2,.48,1.3,.34,{'L_hind':0,'R_fore':0,'R_hind':.5,'L_fore':.5}),
         ('run',2.8,.34,.90,.34,LEGS)]
for name,hz,duty,sweep,lift,phases in specs:
    old = bpy.data.actions.get(name)
    if old: bpy.data.actions.remove(old)
    n = round(60/hz)
    poses = [gait_pose(i/n,phases,duty,sweep,lift,'gallop' if name=='run' else name) for i in range(n)]
    poses.append(copy(poses[0])); make(name,poses)
metadata = {}
for name,hz,duty,sweep,lift,phases in specs:
    if name=='run':
        contacts=[{'phase':LEGS[key][0], 'duty':LEGS[key][1], 'sweep':(1.462 if 'fore' in key else 1.6456)} for key in ['L_fore','R_fore','L_hind','R_hind']]
    else:
        contacts=[{'phase':phases[key], 'duty':duty, 'sweep':sweep} for key in ['L_fore','R_fore','L_hind','R_hind']]
    metadata[name]={'stride':sum(c['sweep']/c['duty'] for c in contacts)/4,'contacts':contacts}
# Quiet turn steps and a low braced stop, authored as dedicated clips.
for name,direction in [('turn_left',1),('turn_right',-1)]:
    poses=[]
    for i in range(49):
        t=i/48; p=gait_pose(t,{'L_hind':0,'L_fore':.25,'R_hind':.5,'R_fore':.75},.65,.16,.09,'walk')
        wrot(p,'Torso',(0,0,1),direction*4*math.sin(math.pi*t)**2)
        wrot(p,'Neck1',(0,0,1),direction*9)
        poses.append(p)
    make(name,poses)
poses=[]
for i in range(25):
    t=i/24; p=copy(base); k=math.sin(math.pi*t)*(1-t)
    wloc(p,'Body',(0,0,-.10*k)); wrot(p,'Body',(1,0,0),-7*k)
    wrot(p,'Neck1',(1,0,0),8*k); tail_wave(p,t,amp_yaw=2,amp_pitch=3,lift=8)
    poses.append(p)
make('skid',poses)
# Immediate gameplay takeoff: a 3-frame anatomical gather followed by a readable hind push.
# The collider stays responsive; the pelvis loads inside the rising capsule, without mesh scaling.
jump_source=SRC_ACTIONS['jump_up']
jump_final=sample(jump_source,jump_source.frame_range[1])
old=bpy.data.actions.get('jump_up')
if old: bpy.data.actions.remove(old)
frames=[]
for i in range(13):
    t=i/12; k=max(0,min(1,(t-.20)/.6)); k=k*k*(3-2*k)
    p=blend(base,jump_final,k)
    load=math.sin(math.pi*min(1,t/.4)) if t<.4 else 0
    wloc(p,'Body',(0,0,-.16*load))
    wrot(p,'Neck1',(1,0,0),8*load)
    frames.append(p)
make('jump_up',frames)
# Landing absorbs in the skeleton over .30s, then returns to a quiet stance.
land_source=SRC_ACTIONS['land']
land_start=sample(land_source,0)
old=bpy.data.actions.get('land')
if old: bpy.data.actions.remove(old)
frames=[]
for i in range(19):
    t=i/18; k=t*t*(3-2*t)
    p=blend(land_start,base,k)
    load=math.sin(math.pi*min(1,t/.55))*(1-t) if t<.55 else 0
    wloc(p,'Body',(0,0,-.16*load))
    wrot(p,'Neck1',(1,0,0),9*load)
    frames.append(p)
make('land',frames)
# Imported clips were 24fps; preserve their seconds after switching authoring scene to 60fps.
for name,act in SRC_ACTIONS.items():
    if name in {'run','jump_up','land'}: continue
    if act.name not in bpy.data.actions: continue
    for fc in act.fcurves:
        for key in fc.keyframe_points:
            key.co.x *= 60/SOURCE_FPS; key.handle_left.x *= 60/SOURCE_FPS; key.handle_right.x *= 60/SOURCE_FPS
# Quantitative bake evidence: per-foot stance speed and height, derived from the actual evaluated bones.
# Metadata timing is authored once above and consumed directly by the runtime.
original_action=arm.animation_data.action
channel_hash=hashlib.sha256()
for name,data in metadata.items():
    act=bpy.data.actions[name]; arm.animation_data.action=act
    n=round(act.frame_range[1]); samples=[]
    for frame in range(n+1):
        sc.frame_set(frame); bpy.context.view_layer.update()
        samples.append([arm.pose.bones[bn].head.copy() for bn in ['FrontPaw.L','FrontPaw.R','BackPaw.L','BackPaw.R']])
    measured=[]
    for i,contact in enumerate(data['contacts']):
        speeds=[]; heights=[]
        for frame in range(n):
            phase=(frame/n-contact['phase'])%1
            next_phase=((frame+1)/n-contact['phase'])%1
            if phase<contact['duty']:
                heights.append(samples[frame][i].z)
                if next_phase<contact['duty'] and next_phase>phase:
                    speeds.append((samples[frame+1][i].y-samples[frame][i].y)*FPS)
        mean=statistics.mean(speeds) if speeds else 0
        measured.append({'meanStanceSpeed':mean,'stanceSpeedCV':statistics.pstdev(speeds)/max(.001,abs(mean)) if speeds else 0,
                         'stanceHeightRange':max(heights)-min(heights) if heights else 0})
    if any(m['stanceSpeedCV']>.05 or m['stanceHeightRange']>.015 for m in measured):
        raise RuntimeError(f'{name}: authored stance failed speed/height gate: {measured}')
    data['measured']=measured
    channel_hash.update(name.encode())
    for fc in act.fcurves:
        channel_hash.update(f'{fc.data_path}:{fc.array_index}'.encode())
        for key in fc.keyframe_points: channel_hash.update(f'{key.co.x:.6f},{key.co.y:.6f}'.encode())
    print('MEASURED',name,json.dumps(measured))
arm.animation_data.action=original_action
print('CHANNEL_SHA256',channel_hash.hexdigest())
with open(f'{ROOT}/assets/hero/spirit_fox.loco.json','w') as f: json.dump(metadata,f,indent=2)
for src,dst in ROLE.items():
    if dst in arm.data.bones: arm.data.bones[dst].name=src
for act in bpy.data.actions:
    for fc in act.fcurves:
        for src,dst in ROLE.items(): fc.data_path=fc.data_path.replace(f'pose.bones["{dst}"]',f'pose.bones["{src}"]')
arm.animation_data.action=bpy.data.actions['idle']
for o in bpy.data.objects:
    if o.type=='ARMATURE' and o.animation_data:
        for tr in list(o.animation_data.nla_tracks): o.animation_data.nla_tracks.remove(tr)
bpy.ops.export_scene.gltf(filepath=f'{ROOT}/assets/hero/spirit_fox.glb',export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_optimize_animation_size=True,export_def_bones=False,export_yup=True)
