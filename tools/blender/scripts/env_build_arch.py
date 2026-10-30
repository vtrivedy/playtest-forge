"""
Color Fox — broken ruin arch (keyart ruins). Chunky stacked blocks, crown collapsed.
Headless: blender --background --factory-startup --python tools/blender/scripts/env_build_arch.py
Out: assets/env/procedural/ruin_arch.glb, assets/previews/env_ruin_arch.png
Arch spans Blender X (walk-through along Y == three Z).
"""
import math
import random
import sys
from pathlib import Path

from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import env_common as E  # noqa: E402

SEED = 23
TOP = 4.6


def build():
    rng = random.Random(SEED)
    mb = E.MeshBuilder()

    def stone(tint=1.0, moss=0.45):
        return E.stone_color_fn(rng, moss=moss, grime_z=(0.0, TOP),
                                tint=tint * rng.uniform(0.78, 1.12))

    px, hd, pw = 1.6, 0.44, 0.42  # pillar center x, half depth
    spring = 0.0
    # --- pillars: wide plinth + stacked drums of uneven height
    for sx, n_blocks in ((-1, 5), (1, 5)):
        x = sx * px
        mb.block((x, 0, 0.13), (pw + 0.13, hd + 0.13, 0.13), stone(0.85, 0.6), chamfer=0.04,
                 jitter=0.02, rng=rng)
        z = 0.26
        for k in range(n_blocks):
            h = rng.uniform(0.38, 0.55)
            off = (rng.uniform(-0.04, 0.04), rng.uniform(-0.04, 0.04))
            w = pw * rng.uniform(0.94, 1.04)
            mb.block((x + off[0], off[1], z + h / 2), (w, hd, h / 2 - 0.004), stone(),
                     rot=(0, 0, rng.uniform(-0.06, 0.06)), chamfer=0.03, jitter=0.035, rng=rng)
            z += h
        # impost / capital slab
        mb.block((x, 0, z + 0.08), (pw + 0.08, hd + 0.06, 0.08), stone(1.08), chamfer=0.03,
                 jitter=0.015, rng=rng)
        spring = max(spring, z + 0.16)

    # --- voussoirs: semicircle, crown + right haunch collapsed
    r_in, r_out = px - pw, px + pw
    n = 9
    keep = {0, 1, 2, 3, 4, 5, 8}  # left (0) .. right (8); crown 6-7 fell
    gap = math.radians(0.7)
    for i in range(n):
        if i not in keep:
            continue
        a0 = math.pi - math.pi * i / n - gap
        a1 = math.pi - math.pi * (i + 1) / n + gap
        drop = 0.0
        if i == 5:  # last stone before the break has slipped
            drop = 0.06
        corners = []
        for b in range(8):
            a = a1 if b & 1 else a0
            y = hd if b & 2 else -hd
            r = (r_out + (0.06 if i in (4, 5) else 0.0)) if b & 4 else r_in
            corners.append(Vector((math.cos(a) * r, y, spring + math.sin(a) * r - drop)))
        mb.block(None, None, stone(1.05), chamfer=0.03, jitter=0.03, rng=rng, corners=corners)
    # --- fallen voussoirs + rubble on the ground (right / front)
    def fallen(cx, cy, rot, s=1.0):
        a0, a1 = 0.0, math.pi / n
        corners = []
        for b in range(8):
            a = a1 if b & 1 else a0
            y = hd * s if b & 2 else -hd * s
            r = r_out * s if b & 4 else r_in * s
            corners.append(Vector((math.cos(a) * r - (r_in + r_out) / 2 * s, y, math.sin(a) * r)))
        from mathutils import Euler
        m = Euler(rot, "XYZ").to_matrix()
        corners = [m @ c + Vector((cx, cy, 0)) for c in corners]
        zmin = min(c.z for c in corners)
        corners = [c - Vector((0, 0, zmin + 0.02)) for c in corners]
        mb.block(None, None, stone(0.9, 0.6), chamfer=0.05, jitter=0.03, rng=rng,
                 corners=corners)

    fallen(0.55, -0.9, (0.0, -1.1, 0.5))
    fallen(2.45, -1.1, (math.pi / 2, 0.2, 1.2))
    for (x, y, s) in ((1.0, 0.85, 0.2), (-0.3, -1.25, 0.14), (2.3, 0.6, 0.16),
                      (-2.25, -0.85, 0.12), (0.2, 0.3, 0.1)):
        mb.block((x, y, s * 0.6), (s * 1.4, s, s * 0.75), stone(0.88, 0.7),
                 rot=(rng.uniform(-0.4, 0.4), rng.uniform(-0.4, 0.4), rng.uniform(0, 3)),
                 chamfer=s * 0.3, jitter=s * 0.18, rng=rng)

    return mb.build("RuinArch", [E.mat_vcol("RuinStone", rough=0.88)])


if __name__ == "__main__":
    E.reset()
    ob = build()
    E.export_glb(E.OUT_DIR / "ruin_arch.glb", [ob])
    E.render_preview(E.PREVIEW_DIR / "env_ruin_arch.png", [ob], view=(0.55, -1.4, 0.4),
                     ground_z=0.0)
