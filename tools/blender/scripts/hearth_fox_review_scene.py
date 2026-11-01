"""Hearth-fox review scene: concept boards as image planes behind the model area.

Run in Blender (MCP exec or `blender -b --python`). Creates/refreshes scene 'FOX_review'.
Boards stand on +Y (behind the fox, which faces -Y in Blender = +Z in three.js after glTF export).
"""
import bpy

REFS = "/workspace/kit/sprints/redesign-s1/refs/"
BOARDS = [
    ("REF_concept_fox", "concept-fox.jpg", (0.0, 3.0, 1.6), 5.4),
    ("REF_board_fox", "concept-board-fox.jpg", (-5.6, 3.0, 1.6), 5.4),
    ("REF_board_world", "concept-board-world.jpg", (5.6, 3.0, 1.6), 5.4),
]

scene = bpy.data.scenes.get("FOX_review") or bpy.data.scenes.new("FOX_review")
if bpy.context.window:
    bpy.context.window.scene = scene
coll = bpy.data.collections.get("FOX_refs")
if coll is None:
    coll = bpy.data.collections.new("FOX_refs")
    scene.collection.children.link(coll)


def board(name, file, loc, width):
    img = bpy.data.images.load(REFS + file, check_existing=True)
    w, h = img.size
    height = width * h / w
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    emit = nt.nodes.new("ShaderNodeEmission")
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(tex.outputs["Color"], emit.inputs["Color"])
    nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])
    ob = bpy.data.objects.get(name)
    if ob is None:
        me = bpy.data.meshes.new(name)
        me.from_pydata(
            [(-0.5, 0, -0.5), (0.5, 0, -0.5), (0.5, 0, 0.5), (-0.5, 0, 0.5)], [], [(0, 1, 2, 3)]
        )
        me.uv_layers.new().data.foreach_set("uv", [0, 0, 1, 0, 1, 1, 0, 1])
        ob = bpy.data.objects.new(name, me)
        coll.objects.link(ob)
    ob.data.materials.clear()
    ob.data.materials.append(mat)
    ob.location = loc
    ob.scale = (width, 1, height)
    ob.hide_select = True


for b in BOARDS:
    board(*b)

# review camera + key light
cam = bpy.data.objects.get("FOX_cam")
if cam is None:
    cam = bpy.data.objects.new("FOX_cam", bpy.data.cameras.new("FOX_cam"))
    scene.collection.objects.link(cam)
cam.location = (0, -9.5, 1.8)
cam.rotation_euler = (1.5, 0, 0)
cam.data.lens = 28
scene.camera = cam
if not bpy.data.objects.get("FOX_sun"):
    sun = bpy.data.objects.new("FOX_sun", bpy.data.lights.new("FOX_sun", "SUN"))
    sun.data.energy = 3.0
    sun.rotation_euler = (0.9, 0.2, 0.6)
    scene.collection.objects.link(sun)
scene.render.resolution_x, scene.render.resolution_y = 960, 540
try:
    scene.render.engine = "BLENDER_EEVEE_NEXT"
except TypeError:
    scene.render.engine = "BLENDER_EEVEE"
scene.render.fps = 30
print("review scene ok", [o.name for o in coll.objects])
