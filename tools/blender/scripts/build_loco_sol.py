"""Bake role-based locomotion onto the current hero; no mesh rebuild.
blender -b -P tools/blender/scripts/build_loco_sol.py
"""
import bpy, math, os, sys, json, hashlib
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
    wrot(p, 'Neck1', (1,0,0), 2*math.cos(4*math.pi*t))
    tail_wave(p, t, amp_yaw=2, amp_pitch=2, speed=1, lift=-12, per=-1)
    apply_dict(p)
    for key, td in phases.items():
        stance, u = leg_phase(t, td, duty)
        side = key[0]
        if 'fore' in key:
            l = FORE[side]
            center=l['foot'].copy(); center.x=REST_YZ[l['up']][0].x+.05
            target = paw_path(stance, u, center, sweep/2, sweep/2, lift)
            a,b = ik2(posed_yz(l['up'])[0], target, l['a'], l['b'])
            paw = rest_ang(l['paw']) + math.radians(30 * math.sin(math.pi*u) if not stance else 0)
            set_chain(p, [l['up'],l['lo'],l['paw']], [a,b,paw])
        else:
            l = HIND[side]
            target = paw_path(stance, u, l['foot'], sweep/2, sweep/2, lift*.8)
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
        contacts=[{'phase':LEGS[key][0], 'duty':LEGS[key][1], 'sweep':(1.462 if 'fore' in key else 1.768)} for key in ['L_fore','R_fore','L_hind','R_hind']]
    else:
        contacts=[{'phase':phases[key], 'duty':duty, 'sweep':sweep} for key in ['L_fore','R_fore','L_hind','R_hind']]
    metadata[name]={'stride':sum(c['sweep']/c['duty'] for c in contacts)/4,'contacts':contacts}
with open(f'{ROOT}/assets/hero/spirit_fox.loco.json','w') as f: json.dump(metadata,f,indent=2)
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
# Imported clips were 24fps; preserve their seconds after switching authoring scene to 60fps.
for name,act in SRC_ACTIONS.items():
    if name in {'run'}: continue
    if act.name not in bpy.data.actions: continue
    for fc in act.fcurves:
        for key in fc.keyframe_points:
            key.co.x *= 60/SOURCE_FPS; key.handle_left.x *= 60/SOURCE_FPS; key.handle_right.x *= 60/SOURCE_FPS
arm.animation_data.action=bpy.data.actions['idle']
for o in bpy.data.objects:
    if o.type=='ARMATURE' and o.animation_data:
        for tr in list(o.animation_data.nla_tracks): o.animation_data.nla_tracks.remove(tr)
bpy.ops.export_scene.gltf(filepath=f'{ROOT}/assets/hero/spirit_fox.glb',export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_optimize_animation_size=True,export_def_bones=False,export_yup=True)
