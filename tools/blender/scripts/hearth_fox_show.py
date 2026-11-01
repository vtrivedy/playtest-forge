"""Review helper: show a source clip on the rig (MCP)."""
import bpy
rig = bpy.data.objects["fox_rig"]
sc = bpy.data.scenes["FOX_review"]
act = bpy.data.actions[SHOW]
rig.animation_data.action = act
sc.frame_start, sc.frame_end = int(act.frame_range[0]), int(act.frame_range[1])
sc.frame_set(0)
