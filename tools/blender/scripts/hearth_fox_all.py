"""One-shot hearth-fox pipeline: mesh → rig → clips → GLB.

MCP:      exec(open(".../hearth_fox_all.py").read())
Headless: blender -b --python tools/blender/scripts/hearth_fox_all.py
Stops after STAGE (env FOX_STAGE = build|rig|anim|export; default export).
"""
import os

HERE = "/workspace/kit/wt/s1-fox/tools/blender/scripts/"
STAGE = os.environ.get("FOX_STAGE", globals().get("FOX_STAGE", "export"))
_ns = globals()
for _stage in ("review_scene", "build", "rig", "anim", "export"):
    exec(open(HERE + f"hearth_fox_{_stage}.py").read(), _ns)
    if _stage == STAGE:
        break
