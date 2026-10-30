"""blender -b --python tools/modal/render_candidate.py -- candidate.glb"""
import bpy, sys, math, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
path=Path(sys.argv[sys.argv.index('--')+1]).resolve()
model='hunyuan_clean' if 'hunyuan_clean' in path.stem else ('hunyuan' if 'hunyuan' in path.stem else 'trellis')
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(path))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
points=[o.matrix_world@Vector(v) for o in meshes for v in o.bound_box]
lo=Vector([min(v[i] for v in points) for i in range(3)]); hi=Vector([max(v[i] for v in points) for i in range(3)])
center=(lo+hi)/2; extent=max(hi-lo)
# TRELLIS exports glTF Y-up; Blender importer restores Z-up.
for o in meshes:
    for p in o.data.polygons: p.use_smooth=True
    for m in o.data.materials:
        if m and m.use_nodes:
            bs=m.node_tree.nodes.get('Principled BSDF')
            if bs: bs.inputs['Roughness'].default_value=.82
stats={'file':str(path.relative_to(ROOT)), 'triangles':sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons), 'vertices':sum(len(o.data.vertices) for o in meshes), 'bounds_blender':[list(lo),list(hi)], 'textures':[{ 'name':i.name,'width':i.size[0],'height':i.size[1]} for i in bpy.data.images if i.type=='IMAGE'], 'bytes':path.stat().st_size}
path.with_suffix('.stats.json').write_text(json.dumps(stats,indent=2))
scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=32; scene.cycles.use_denoising=True
scene.render.resolution_x=800; scene.render.resolution_y=800; scene.render.resolution_percentage=100
scene.world.color=(.19,.19,.19)
scene.view_settings.view_transform='AgX'
bpy.ops.mesh.primitive_plane_add(size=200, location=(center.x,center.y,lo.z-.008*extent))
floor=bpy.context.object; mat=bpy.data.materials.new('warm stone'); mat.diffuse_color=(.20,.17,.14,1); floor.data.materials.append(mat)
def area(name,pos,power,size):
    bpy.ops.object.light_add(type='AREA',location=center+Vector(pos)*extent)
    o=bpy.context.object; o.name=name; o.data.energy=power*extent**2; o.data.shape='DISK'; o.data.size=size*extent
    o.rotation_euler=(center-o.location).to_track_quat('-Z','Y').to_euler()
area('soft key',(-2,-3,4),450,3); area('fill',(3,-1,2),180,3); area('rim',(0,3,3),350,2)
bpy.ops.object.camera_add(); cam=bpy.context.object; scene.camera=cam; cam.data.clip_end=1000; cam.data.type='ORTHO'; cam.data.ortho_scale=extent*1.3
# TRELLIS candidate faces +X. Hunyuan orientation is reviewed separately.
if model.startswith('hunyuan'):
    views={'front':(0,-3,.15),'side':(3,0,.15),'3q':(2.4,-3,.9),'back':(0,3,.15)}
else:
    views={'front':(3,0,.15),'side':(0,-3,.15),'3q':(2.4,-3,.9),'back':(-3,0,.15)}
for label,offset in views.items():
    cam.location=center+Vector(offset)*extent*4
    cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(ROOT/f'assets/previews/review/hero_sol_{model}_{label}_render.png')
    bpy.ops.render.render(write_still=True)
