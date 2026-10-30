"""Fox vs concept review scene: the turnaround crop as a reference plane beside the fox, rendered from the
matching angle with the fox scaled so its ground-to-ear-tip height equals the concept's. Everything except the
fox GLB is locked (camera, lights, plane, floor), so renders are comparable across passes.

blender -b --python fox_review.py -- <fox.glb> <label> [pose]      (pose: rest | <clip>:<frame>)
Inputs from $BLENDER_IN (fox-turnaround.jpg + the GLB), outputs <label>_<view>.png into $BLENDER_OUT.
Run on Modal: tools/modal/blender_render.py.
"""
import os, sys, math
import bpy
from mathutils import Vector, Matrix

args = sys.argv[sys.argv.index("--") + 1:]
IN, OUT = os.environ.get("BLENDER_IN", "."), os.environ.get("BLENDER_OUT", ".")
GLB, LABEL = os.path.join(IN, os.path.basename(args[0])), args[1]
POSE = args[2] if len(args) > 2 else "rest"
CONCEPT = os.path.join(IN, "fox-turnaround.jpg")
# concept crop (px box in the 1280x720 sheet), ear-tip y, ground y; camera direction from the fox (fox faces -Y)
VIEWS = {
    "front":   ((55, 40, 240, 390), 55, 385, (0, -1, 0.04)),
    "side":    ((270, 60, 700, 390), 75, 378, (1, 0, 0.03)),
    "three_q": ((680, 55, 1010, 390), 68, 382, (0.74, -0.67, 0.06)),
    "back":    ((1015, 55, 1265, 390), 65, 384, (0, 1, 0.05)),
    "face":    ((95, 40, 200, 200), 55, 385, (0.45, -1, 0.1)),  # head close-up (framed on the head below)
}
PAPER = (0.62, 0.50, 0.36)  # linear-ish match to the turnaround's parchment

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=GLB)
arm = next((o for o in sc.objects if o.type == "ARMATURE"), None)
for o in [o for o in sc.objects if o.type == "MESH" and arm and not any(m.type == "ARMATURE" for m in o.modifiers)]:
    bpy.data.objects.remove(o, do_unlink=True)
fox = [o for o in sc.objects if o.type == "MESH"]
if arm and arm.animation_data:
    arm.animation_data.action = None
    if POSE != "rest":
        clip, frame = POSE.split(":")
        arm.animation_data.action = next(a for a in bpy.data.actions if a.name.split("_SpiritFox")[0] == clip)
        sc.frame_set(int(frame))
    else:
        for pb in arm.pose.bones: pb.matrix_basis.identity()
bpy.context.view_layer.update()
# Review material parity with foxLook.ts. Cameras, lights and reference planes stay locked.
# Cycles alpha approximates the runtime's stable dither; game captures remain authoritative.
for m in {slot.material for o in fox for slot in o.material_slots if slot.material}:
    if not m.use_nodes: continue
    nt = m.node_tree
    bs = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if not bs: continue
    name = m.name.lower()
    if "spiritwisp" in name:
        glow = "glow" in name
        opacity = 0.12 if glow else 0.24 if "tailflame" in name else 0.32
        strength = 0.3 if glow else min(bs.inputs["Emission Strength"].default_value, 0.5)
        bs.inputs["Emission Strength"].default_value = strength
        alpha = bs.inputs["Alpha"]
        old = alpha.links[0].from_socket if alpha.links else None
        mul = nt.nodes.new("ShaderNodeMath"); mul.operation = "MULTIPLY"
        mul.inputs[1].default_value = opacity
        if old: nt.links.new(old, mul.inputs[0])
        else: mul.inputs[0].default_value = alpha.default_value
        nt.links.new(mul.outputs[0], alpha)
    if "fur" in name:
        bs.inputs["Roughness"].default_value = 0.85
        for n in nt.nodes:
            if n.type == "NORMAL_MAP": n.inputs["Strength"].default_value = 0.28
    if "fur" in name and "shell" in name:
        geom = nt.nodes.new("ShaderNodeNewGeometry")
        dot = nt.nodes.new("ShaderNodeVectorMath"); dot.operation = "DOT_PRODUCT"
        nt.links.new(geom.outputs["Normal"], dot.inputs[0]); nt.links.new(geom.outputs["Incoming"], dot.inputs[1])
        absolute = nt.nodes.new("ShaderNodeMath"); absolute.operation = "ABSOLUTE"
        nt.links.new(dot.outputs["Value"], absolute.inputs[0])
        fade = nt.nodes.new("ShaderNodeMapRange"); fade.interpolation_type = "SMOOTHSTEP"
        fade.inputs["From Min"].default_value = 0.25; fade.inputs["From Max"].default_value = 0.65
        fade.inputs["To Min"].default_value = 1; fade.inputs["To Max"].default_value = 0
        nt.links.new(absolute.outputs[0], fade.inputs["Value"])
        alpha = bs.inputs["Alpha"]; old = alpha.links[0].from_socket if alpha.links else None
        mul = nt.nodes.new("ShaderNodeMath"); mul.operation = "MULTIPLY"
        if old: nt.links.new(old, mul.inputs[0])
        else: mul.inputs[0].default_value = alpha.default_value
        nt.links.new(fade.outputs[0], mul.inputs[1]); nt.links.new(mul.outputs[0], alpha)
    if name.startswith("foxtailfur"):
        uv = nt.nodes.new("ShaderNodeTexCoord"); separate = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(uv.outputs["UV"], separate.inputs[0])
        fade = nt.nodes.new("ShaderNodeMapRange"); fade.interpolation_type = "SMOOTHSTEP"
        fade.inputs["From Min"].default_value = 0.92; fade.inputs["From Max"].default_value = 1
        fade.inputs["To Min"].default_value = 1; fade.inputs["To Max"].default_value = 0
        nt.links.new(separate.outputs["Y"], fade.inputs["Value"])
        alpha = bs.inputs["Alpha"]; old = alpha.links[0].from_socket if alpha.links else None
        mul = nt.nodes.new("ShaderNodeMath"); mul.operation = "MULTIPLY"
        if old: nt.links.new(old, mul.inputs[0])
        else: mul.inputs[0].default_value = alpha.default_value
        nt.links.new(fade.outputs[0], mul.inputs[1]); nt.links.new(mul.outputs[0], alpha)
        heat = nt.nodes.new("ShaderNodeMapRange"); heat.interpolation_type = "SMOOTHSTEP"
        heat.inputs["From Min"].default_value = 0.72; heat.inputs["From Max"].default_value = 1
        heat.inputs["To Min"].default_value = 0; heat.inputs["To Max"].default_value = 0.12
        nt.links.new(separate.outputs["Y"], heat.inputs["Value"])
        bs.inputs["Emission Color"].default_value = (1.0, 0.72, 0.42, 1)
        nt.links.new(heat.outputs[0], bs.inputs["Emission Strength"])

def world_pts(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        me = o.evaluated_get(dg).to_mesh()
        for v in me.vertices: yield o.matrix_world @ v.co
body = [o for o in fox if o.name == "SpiritFox_Body"] or fox
pts = list(world_pts(body))
ground = min(p.z for p in pts); ear = max(p.z for p in pts)
allpts = list(world_pts(fox))
lo = Vector([min(p[i] for p in allpts) for i in range(3)]); hi = Vector([max(p[i] for p in allpts) for i in range(3)])
H = ear - ground
centre = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, ground + H / 2))

# ---------------------------------------------------------------- locked stage
sc.render.engine = "CYCLES"
sc.cycles.samples = int(os.environ.get("REVIEW_SAMPLES", 96)); sc.cycles.use_denoising = True
if os.environ.get("BLENDER_GPU"):
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for kind in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = kind; prefs.get_devices()
            if any(d.type == kind for d in prefs.devices):
                for d in prefs.devices: d.use = d.type == kind
                sc.cycles.device = "GPU"; break
        except TypeError: pass
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Base Contrast"
w = bpy.data.worlds.new("paper"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (*PAPER, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 0.35
bpy.ops.mesh.primitive_plane_add(size=60, location=(centre.x, centre.y, ground))
floor = bpy.context.object; fm = bpy.data.materials.new("floor"); fm.use_nodes = True
bsdf = next(n for n in fm.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
bsdf.inputs["Base Color"].default_value = (*PAPER, 1); bsdf.inputs["Roughness"].default_value = 1
floor.data.materials.append(fm)
def light(name, d, energy, size, color=(1, 0.95, 0.88)):
    bpy.ops.object.light_add(type="AREA", location=centre + Vector(d).normalized() * H * 4)
    o = bpy.context.object; o.name = name; o.data.energy = energy * H * H; o.data.size = size * H; o.data.color = color
    o.rotation_euler = (centre - o.location).to_track_quat("-Z", "Y").to_euler()
light("key", (-0.6, -1.0, 1.1), 260, 1.6)
light("fill", (1.0, -0.4, 0.4), 70, 2.5, (0.9, 0.92, 1.0))
light("rim", (0.3, 1.2, 0.9), 220, 1.2, (1.0, 0.8, 0.6))

img = bpy.data.images.load(CONCEPT); IW, IH = img.size
bpy.ops.object.camera_add(); cam = bpy.context.object; sc.camera = cam; cam.data.type = "ORTHO"
sc.render.resolution_y = 600

for view, (box, ear_px, ground_px, d) in VIEWS.items():
    d = Vector(d).normalized()
    rot = (-d).to_track_quat("-Z", "Y").to_matrix()
    right, up = rot.col[0], rot.col[1]
    s = H / (ground_px - ear_px)                        # world units per concept px
    pw, ph = (box[2] - box[0]) * s, (box[3] - box[1]) * s
    fox_w = max((p - centre).dot(right) for p in allpts) - min((p - centre).dot(right) for p in allpts)
    gap = 0.15 * H
    # reference plane left of the fox, its ground line on the fox's ground
    plane_c = centre - right * (fox_w / 2 + gap + pw / 2) + up * ((ground_px - (box[1] + box[3]) / 2) * s - H / 2)
    bpy.ops.mesh.primitive_plane_add(size=1)
    pl = bpy.context.object; pl.name = f"concept_{view}"
    pl.matrix_world = Matrix.Translation(plane_c) @ rot.to_4x4() @ Matrix.Diagonal((pw, ph, 1, 1))
    uv = pl.data.uv_layers.active.data
    u0, u1 = box[0] / IW, box[2] / IW; v0, v1 = 1 - box[3] / IH, 1 - box[1] / IH
    for li, loop in enumerate(pl.data.loops):
        co = pl.data.vertices[loop.vertex_index].co
        uv[li].uv = (u0 if co.x < 0 else u1, v0 if co.y < 0 else v1)
    m = bpy.data.materials.new(f"concept_{view}"); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = img; tex.interpolation = "Cubic"
    em = nt.nodes.new("ShaderNodeEmission"); outn = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(tex.outputs[0], em.inputs[0]); nt.links.new(em.outputs[0], outn.inputs[0])
    pl.data.materials.append(m); pl.visible_shadow = False; pl.visible_diffuse = False; pl.visible_glossy = False
    # camera: ortho, frames plane + fox
    span_w = pw + gap + fox_w + 0.3 * H
    mid = (plane_c + centre) / 2
    if view == "face":  # frame the head only, beside the concept face crop
        head_pts = [p for p in pts if p.z > ground + 0.62 * H]
        hc = sum(head_pts, Vector()) / len(head_pts)
        hw = max((p - hc).dot(right) for p in head_pts) - min((p - hc).dot(right) for p in head_pts)
        plane_c = hc - right * (hw / 2 + gap + pw / 2) + up * ((ground_px - (box[1] + box[3]) / 2) * s - (hc.z - ground))
        pl.matrix_world = Matrix.Translation(plane_c) @ rot.to_4x4() @ Matrix.Diagonal((pw, ph, 1, 1))
        span_w = pw + gap + hw + 0.2 * H; mid = (plane_c + hc) / 2; ph = max(ph, 0.4 * H); fox_h = ph
    else:
        fox_h = H
    cam.matrix_world = Matrix.Translation(mid + d * H * 10) @ rot.to_4x4()
    cam.data.clip_end = H * 40
    aspect = span_w / (max(ph, fox_h) * 1.15)
    sc.render.resolution_x = int(600 * aspect) // 2 * 2
    cam.data.ortho_scale = max(span_w, max(ph, fox_h) * 1.15 * aspect)
    sc.render.filepath = os.path.join(OUT, f"{LABEL}_{view}.png")
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(pl, do_unlink=True)
print("REVIEW", LABEL, "H", round(H, 3), "views", list(VIEWS))
