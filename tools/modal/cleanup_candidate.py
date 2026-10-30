"""UV-preserving cleanup of the raw Hunyuan candidate; never edits adopted hero."""
from pathlib import Path
import bpy, bmesh
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
FOLDER=ROOT/'assets/hero/candidates/sol'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(FOLDER/'fox_hunyuan_seed42.glb'))
obj=next(o for o in bpy.context.scene.objects if o.type=='MESH')
bpy.context.view_layer.objects.active=obj
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
def smooth(a,b,x):
    t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
original=[v.co.copy() for v in obj.data.vertices]
# Map each tail cross-section to a rounded taper instead of flattening its lobe.
import math
for vertex,source in zip(obj.data.vertices,original):
    x,y,z=source
    if y>.2:
        section=[v for v in original if abs(v.y-y)<.045 and v.y>.2]
        zlo=min(v.z for v in section);zhi=max(v.z for v in section)
        zmid=(zlo+zhi)/2;zrad=max(.01,(zhi-zlo)/2)
        xrad=max(.01,max(abs(v.x) for v in section))
        t=max(0,min(1,(y-.2)/.81))
        weight=smooth(.2,.42,y)
        radius=.025+.15*math.sin(math.pi*t)**.8
        center=-.08-.22*t
        vertex.co.x=x*(1-weight)+(x/xrad)*radius*.7*weight
        vertex.co.z=z*(1-weight)+(center+(z-zmid)/zrad*radius)*weight
        vertex.co.y=.2+(y-.2)*(1-.12*weight)
# Bisect above actual ear tips after the tall tail lobe has been reduced.
# UV loops survive seam-vertex welding and bisect; only tiny new cap faces are added.
bm=bmesh.new();bm.from_mesh(obj.data)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6)
cut=bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-6,plane_co=Vector((0,0,.51)),plane_no=Vector((0,0,1)),clear_outer=True,clear_inner=False)
edges=[e for e in cut['geom_cut'] if isinstance(e,bmesh.types.BMEdge) and e.is_boundary]
uv=bm.loops.layers.uv.active
uv_by_vert={}
if uv:
    for edge in edges:
        for vert in edge.verts:
            for loop in vert.link_loops:
                uv_by_vert[vert]=loop[uv].uv.copy()
if edges:
    caps=bmesh.ops.holes_fill(bm,edges=edges,sides=0)['faces']
    for face in caps:
        for loop in face.loops:
            if uv and loop.vert in uv_by_vert:loop[uv].uv=uv_by_vert[loop.vert]
# Collapse the tiny cut caps to pointed, natural ear tips.
for v in bm.verts:
    if v.co.y<-.4 and v.co.z>.37:
        weight=smooth(.37,.51,v.co.z)
        v.co.x=v.co.x*(1-weight)+(.225 if v.co.x>0 else -.225)*weight
        v.co.y=v.co.y*(1-weight)-.72*weight
        v.co.z+=.025*weight
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-5)
bmesh.ops.dissolve_degenerate(bm,dist=1e-6,edges=list(bm.edges))
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
bmesh.ops.triangulate(bm,faces=list(bm.faces))
bm.to_mesh(obj.data);bm.free()
obj.name='Sol_Hunyuan_Clean_Unrigged'
for p in obj.data.polygons:p.use_smooth=True
bpy.ops.object.select_all(action='DESELECT');obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(FOLDER/'fox_hunyuan_clean_seed42.glb'),export_format='GLB',use_selection=True,export_animations=False,export_yup=True)
print('Cleaned triangles:',len(obj.data.polygons))
