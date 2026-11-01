"""Preview material: vertex colour + ember mask from UV.x as emission (Blender review only)."""
import bpy
mat = bpy.data.materials.get("fox_preview") or bpy.data.materials.new("fox_preview")
mat.use_nodes = True
nt = mat.node_tree
nt.nodes.clear()
ca = nt.nodes.new("ShaderNodeVertexColor"); ca.layer_name = "Col"
uv = nt.nodes.new("ShaderNodeUVMap")
sep = nt.nodes.new("ShaderNodeSeparateXYZ")
bs = nt.nodes.new("ShaderNodeBsdfPrincipled")
out = nt.nodes.new("ShaderNodeOutputMaterial")
nt.links.new(ca.outputs["Color"], bs.inputs["Base Color"])
nt.links.new(ca.outputs["Color"], bs.inputs["Emission Color"])
nt.links.new(uv.outputs["UV"], sep.inputs[0])
nt.links.new(sep.outputs["X"], bs.inputs["Emission Strength"])
bs.inputs["Roughness"].default_value = 0.8
nt.links.new(bs.outputs[0], out.inputs[0])
for ob in bpy.data.collections["FOX"].objects:
    if ob.type == "MESH":
        ob.data.materials.clear(); ob.data.materials.append(mat)
