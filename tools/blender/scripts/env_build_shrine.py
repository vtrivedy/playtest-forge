"""
Color Fox — stone shrine on short steps (keyart, right-hand ruins).
Headless: blender --background --factory-startup --python tools/blender/scripts/env_build_shrine.py
Out: assets/env/procedural/shrine.glb, assets/previews/env_shrine.png
Front (niche + ember carving) faces Blender -Y  ==  glTF/three +Z.
"""
import math
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import env_common as E  # noqa: E402

SEED = 7


def build():
    rng = random.Random(SEED)
    mb = E.MeshBuilder()
    S, EMB = 0, 1  # material slots
    top = 3.4

    def stone(tint=1.0, moss=0.35):
        return E.stone_color_fn(rng, moss=moss, grime_z=(0.0, top), tint=tint)

    # --- three square steps (each step = 1 slab, slightly skewed, chipped corners)
    z = 0.0
    step_h = 0.2
    for i, w in enumerate((1.55, 1.3, 1.05)):
        # each step = 3 slabs side by side, uneven heights/tints -> visible joints
        edges = [-w, -w / 3 + rng.uniform(-0.12, 0.12), w / 3 + rng.uniform(-0.12, 0.12), w]
        for a, b in zip(edges, edges[1:]):
            h = step_h / 2 + rng.uniform(-0.012, 0.012)
            mb.block(((a + b) / 2, 0, z + h), ((b - a) / 2 - 0.006, w, h),
                     stone(rng.uniform(0.85, 1.0), 0.3), rot=(0, 0, rng.uniform(-0.015, 0.015)),
                     chamfer=0.05, jitter=0.02, rng=rng, mat=S)
        z += step_h
    base_z = z  # 0.6

    # --- plinth molding + body
    mb.block((0, 0, base_z + 0.09), (0.86, 0.86, 0.09), stone(1.0), chamfer=0.05,
             jitter=0.012, rng=rng, mat=S)
    body_z0 = base_z + 0.18
    body_h = 1.25
    hw = 0.66  # body half width
    # back + side walls as one core block set back so the front reads as a niche
    mb.block((0, 0.12, body_z0 + body_h / 2), (hw - 0.04, hw - 0.16, body_h / 2), stone(),
             chamfer=0.03, jitter=0.01, rng=rng, mat=S)
    # front frame: jambs, sill, lintel around a recessed niche
    nf = -hw + 0.02  # front plane y
    for sx in (-1, 1):
        mb.block((sx * 0.46, nf + 0.09, body_z0 + body_h / 2), (0.16, 0.11, body_h / 2),
                 stone(1.05), chamfer=0.035, jitter=0.012, rng=rng, mat=S)
    mb.block((0, nf + 0.09, body_z0 + 0.12), (0.32, 0.11, 0.12), stone(1.0), chamfer=0.03,
             jitter=0.01, rng=rng, mat=S)
    mb.block((0, nf + 0.08, body_z0 + body_h - 0.14), (0.62, 0.13, 0.14), stone(1.08),
             chamfer=0.035, jitter=0.012, rng=rng, mat=S)
    # corner pilasters
    for sx in (-1, 1):
        for sy in (-1, 1):
            mb.block((sx * (hw - 0.02), sy * (hw - 0.02), body_z0 + body_h / 2),
                     (0.11, 0.11, body_h / 2 + 0.02), stone(1.1), chamfer=0.03,
                     jitter=0.01, rng=rng, mat=S)

    # --- ember carving: maple-leaf inlay in niche + smaller ones on 3 other faces
    niche_back = 0.12 - (hw - 0.16) - 0.004
    E.add_leaf(mb, (0, niche_back, body_z0 + 0.66), (0, -1, 0), (0, 0, 1), 0.26,
               (1, 1, 1), mat=EMB, fold=0.06)
    # ember bowl on the sill
    mb.lathe([(0.0, 0.0), (0.07, 0.0), (0.13, 0.06), (0.14, 0.1), (0.0, 0.07)], 8,
             lambda p, t: E.mul(E.STONE_DARK, 0.9), center=(0, nf + 0.06, body_z0 + 0.24),
             mat=S, smooth=False, cap_top=False)
    mb.lathe([(0.11, 0.0), (0.0, 0.03)], 8, lambda p, t: (1, 1, 1),
             center=(0, nf + 0.06, body_z0 + 0.32), mat=EMB, smooth=False, cap_top=False)
    side_y = 0.12 + (hw - 0.16) + 0.004
    E.add_leaf(mb, (0, side_y, body_z0 + 0.66), (0, 1, 0), (0, 0, 1), 0.17, (1, 1, 1),
               mat=EMB, fold=0.02)
    for sx in (-1, 1):
        E.add_leaf(mb, (sx * (hw - 0.04 + 0.004), 0.12, body_z0 + 0.66), (sx, 0, 0),
                   (0, 0, 1), 0.17, (1, 1, 1), mat=EMB, fold=0.02)

    # --- cornice (two stepped slabs)
    cz = body_z0 + body_h
    mb.block((0, 0, cz + 0.07), (0.86, 0.86, 0.07), stone(1.12), chamfer=0.04,
             jitter=0.015, rng=rng, mat=S)
    mb.block((0, 0, cz + 0.19), (0.76, 0.76, 0.05), stone(1.05), chamfer=0.03,
             jitter=0.012, rng=rng, mat=S)

    # --- roof: square stepped tiers, then onion dome + finial
    rz = cz + 0.24
    for w, h in ((0.66, 0.12), (0.52, 0.11), (0.4, 0.1)):
        mb.block((0, 0, rz + h / 2), (w, w, h / 2), stone(1.0, 0.5), chamfer=0.035,
                 jitter=0.01, rng=rng, mat=S)
        rz += h
    dome_fn = stone(1.05, 0.3)
    mb.lathe([(0.34, 0.0), (0.36, 0.08), (0.33, 0.2), (0.24, 0.32), (0.12, 0.4),
              (0.06, 0.46), (0.07, 0.52), (0.04, 0.6), (0.06, 0.66), (0.0, 0.76)], 10,
             lambda p, t: dome_fn(p, (0, 0, 1 - t)), center=(0, 0, rz), mat=S, smooth=True,
             cap_top=False, wobble=0.04, seed=3)

    # --- a few loose / fallen stones at the base
    for (x, y, s) in ((1.75, -0.9, 0.16), (-1.7, 0.6, 0.12), (1.2, 1.75, 0.1)):
        mb.block((x, y, s * 0.7), (s * 1.3, s, s * 0.8), stone(0.9, 0.6),
                 rot=(rng.uniform(-0.3, 0.3), rng.uniform(-0.3, 0.3), rng.uniform(0, 3)),
                 chamfer=s * 0.3, jitter=s * 0.15, rng=rng, mat=S)

    mats = [E.mat_vcol("ShrineStone", rough=0.88), E.mat_ember("EmberGlow", 1.0)]
    return mb.build("Shrine", mats)


if __name__ == "__main__":
    E.reset()
    ob = build()
    E.export_glb(E.OUT_DIR / "shrine.glb", [ob])
    E.render_preview(E.PREVIEW_DIR / "env_shrine.png", [ob], view=(0.75, -1.3, 0.5))
