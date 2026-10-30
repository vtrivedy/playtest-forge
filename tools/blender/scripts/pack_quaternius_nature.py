"""Pack the CC0 Quaternius Stylized Nature MegaKit pieces (via poly.pizza) into one GLB.

blender -b --factory-startup --python tools/blender/scripts/pack_quaternius_nature.py -- <src_dir> <out.glb>

<src_dir> holds the poly.pizza GLBs named <publicID>.glb (see assets/library/CREDITS.md).
Shared bark/leaf textures are deduplicated, downscaled to 512 px and written as WebP;
each piece becomes one named root object with its pivot at the trunk base.
"""
import sys
from pathlib import Path

import bpy

PIECES = {
    'twisted_1': '8oraKn9m0x', 'twisted_2': '7PDBpElkQr', 'twisted_3': 'GVTsMmuzv7',
    'twisted_4': '9aWlx82xUf', 'twisted_5': 'edSPJNECM7',
    'tree_1': 'YWjGDJ9F7g', 'tree_2': 't9KbsfYdXz', 'tree_3': 'aVOxaHRPWe', 'tree_4': 'QVOop92WmG', 'tree_5': 'qZtx0AHhcy',
    'dead_1': 'Mcd2zYqyww', 'dead_2': 'MlmK5488ou',
    'bush_red': 'EoTERLq3z2', 'bush_leafy': 'ooG6CkLyE8', 'fern': 'jqcanvH7D6', 'grass_wispy': 'Msr9zx66VU',
}
TEX = 512

src, out = sys.argv[sys.argv.index('--') + 1:][:2]
bpy.ops.wm.read_factory_settings(use_empty=True)
mats: dict[str, bpy.types.Material] = {}
for name, pid in PIECES.items():
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(Path(src) / f'{pid}.glb'))
    meshes = [o for o in set(bpy.data.objects) - before if o.type == 'MESH']
    for o in set(bpy.data.objects) - before:
        if o.type != 'MESH':
            o.select_set(False)
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.parent = None
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # pivot at the base centre
    xs = [v.co.x for v in ob.data.vertices]
    ys = [v.co.y for v in ob.data.vertices]
    zs = [v.co.z for v in ob.data.vertices]
    cx, cy, z0 = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(zs)
    for v in ob.data.vertices:
        v.co.x -= cx
        v.co.y -= cy
        v.co.z -= z0
    ob.location = (0, 0, 0)
    ob.name = ob.data.name = name
    for slot in ob.material_slots:
        base = slot.material.name.split('.')[0]
        slot.material = mats.setdefault(base, slot.material)
    print(name, 'dims', tuple(round(d, 2) for d in ob.dimensions), 'tris', sum(len(p.vertices) - 2 for p in ob.data.polygons))
    for o in set(bpy.data.objects) - before - {ob}:
        bpy.data.objects.remove(o)

for m in list(bpy.data.materials):
    if m.users == 0:
        bpy.data.materials.remove(m)
for img in list(bpy.data.images):
    if img.users == 0:
        bpy.data.images.remove(img)
    elif max(img.size) > TEX:
        img.scale(TEX, TEX)
print('materials', [m.name for m in bpy.data.materials], 'images', [i.name for i in bpy.data.images])
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_image_format='WEBP', export_yup=True,
                          export_apply=True, export_animations=False, export_extras=False)
