"""
Color Fox — soft mound of maple leaf cards (dash-through / pounce prop).
Headless: blender --background --factory-startup --python tools/blender/scripts/env_build_leaf_pile.py
Out: assets/env/procedural/leaf_pile.glb, assets/previews/env_leaf_pile.png
"""
import math
import random
import sys
from pathlib import Path

from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import env_common as E  # noqa: E402

SEED = 31
R, H = 0.9, 0.45


def surface(r):
    return H * max(0.0, 1 - (r / R) ** 2) ** 0.85


def build():
    rng = random.Random(SEED)
    mb = E.MeshBuilder()
    under = E.hexc("#6a2a14")
    # filler mound under the cards so gaps read as deep shadowed leaves, not holes
    mb.lathe([(R * 0.8, 0.0), (R * 0.62, H * 0.42), (R * 0.36, H * 0.72), (0.0, H * 0.84)],
             12, lambda p, t: E.mul(under, (0.6 + 0.5 * t) * (1 + 0.25 * E.fbm(p, 4.0))), mat=0, smooth=True,
             cap_top=False, wobble=0.08, seed=2)

    def leaf(pos, nrm, size, shade, dry):
        up = Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1)))
        col = E.mul(E.pick_leaf(rng, dry), shade)
        E.add_leaf(mb, pos, nrm, up, size, col, mat=1, fold=0.2, curl=0.18, vary=rng)

    for _ in range(230):
        r = R * 0.97 * math.sqrt(rng.random())
        a = rng.uniform(0, math.tau)
        z = surface(r) + rng.uniform(0.0, 0.035)
        # analytic slope -> surface normal, then tumble
        eps = 0.01
        dz = (surface(r + eps) - surface(r)) / eps
        n = Vector((-dz * math.cos(a), -dz * math.sin(a), 1)).normalized()
        n = (n + Vector((rng.gauss(0, 0.45), rng.gauss(0, 0.45), rng.gauss(0, 0.2)))).normalized()
        shade = 0.62 + 0.5 * (z / H)
        leaf((math.cos(a) * r, math.sin(a) * r, z), n, rng.uniform(0.1, 0.16), shade, 0.55)

    # strays blown off the pile
    for _ in range(26):
        r = rng.uniform(R * 0.95, R * 1.5)
        a = rng.uniform(0, math.tau)
        n = Vector((rng.gauss(0, 0.15), rng.gauss(0, 0.15), 1))
        leaf((math.cos(a) * r, math.sin(a) * r, 0.012), n, rng.uniform(0.08, 0.12), 0.85, 0.7)

    mats = [E.mat_vcol("LeafPileBase", rough=0.95), E.mat_vcol("MapleLeaf", rough=0.7, double=True)]
    return mb.build("LeafPile", mats)


if __name__ == "__main__":
    E.reset()
    ob = build()
    E.export_glb(E.OUT_DIR / "leaf_pile.glb", [ob])
    E.render_preview(E.PREVIEW_DIR / "env_leaf_pile.png", [ob], view=(0.6, -1.3, 0.7),
                     ground_z=0.0, margin=0.62)
