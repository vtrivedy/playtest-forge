"""
Color Fox — gnarled autumn maple (keyart right-hand tree) + bare variant.
Headless: blender --background --factory-startup --python tools/blender/scripts/env_build_maple.py
Out: assets/env/procedural/maple_tree.glb, maple_tree_bare.glb
     assets/previews/env_maple_tree.png, env_maple_tree_bare.png
Both share one skeleton (same seed) so they can swap in place when a zone is restored.
"""
import math
import random
import sys
from pathlib import Path

from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import env_common as E  # noqa: E402

SEED = 11
# per depth: sides, segments, gnarl, twist
LIMB = {0: (12, 8, 0.15, 0.3), 1: (8, 6, 0.08, 0.12), 2: (6, 4, 0.05, 0.0),
        3: (5, 3, 0.0, 0.0), 4: (4, 2, 0.0, 0.0)}


def skeleton(rng: random.Random):
    """Returns (tubes, roots, clusters). tube = (pts, radii, depth)."""
    tubes, clusters = [], []

    def grow(p0, d, length, r0, r1, depth):
        sides, segs, gnarl, twist = LIMB[depth]
        pts, radii = [Vector(p0)], []
        p, d = Vector(p0), Vector(d).normalized()
        kink = (0.22, 0.3, 0.35, 0.3, 0.25)[depth]
        for k in range(segs):
            jitter = Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 0.5))) * kink
            d = (d + jitter + Vector((0, 0, 0.08 if depth else 0.0))).normalized()
            p = p + d * (length / segs)
            pts.append(p.copy())
        n = len(pts)
        radii = [r0 + (r1 - r0) * (i / (n - 1)) ** 0.8 for i in range(n)]
        if depth == 0:  # root flare
            radii[0] *= 1.5
            radii[1] *= 1.15
        tubes.append((pts, radii, depth))
        end_d = (pts[-1] - pts[-2]).normalized()
        if depth == 4:
            clusters.append((pts[-1].copy(), 0.24, 11))
            return
        if depth == 3:
            clusters.append((pts[-1].copy(), 0.34, 5))
        n_child = {0: 3, 1: 3, 2: rng.choice((2, 3)), 3: 2}[depth]
        spread = {0: 1.0, 1: 0.75, 2: 0.7, 3: 0.65}[depth]
        az0 = rng.uniform(0, math.tau)
        side = end_d.orthogonal().normalized()
        for c in range(n_child):
            az = az0 + math.tau * c / n_child + rng.uniform(-0.4, 0.4)
            axis = Matrix.Rotation(az, 3, end_d) @ side
            cd = Matrix.Rotation(spread * rng.uniform(0.75, 1.2), 3, axis) @ end_d
            if depth >= 1:  # umbrella canopy: push outward, flatten climb, no diving
                cd.z = min(max(cd.z, -0.1), 0.5)
                cd.normalize()
            ln = {0: 2.2, 1: 1.3, 2: 0.8, 3: 0.5}[depth] * rng.uniform(0.8, 1.2)
            cr0 = r1 * rng.uniform(0.8, 0.95)
            grow(pts[-1] - end_d * cr0 * 0.6, cd, ln, cr0, cr0 * 0.45, depth + 1)
        # one lateral side branch on main limbs adds asymmetry
        if depth == 1:
            mid = pts[len(pts) // 2]
            ax = Vector((rng.gauss(0, 1), rng.gauss(0, 1), 0)).normalized()
            cd = Matrix.Rotation(1.0, 3, ax) @ end_d
            cd.z = max(cd.z, 0.0)
            grow(mid, cd, 1.0, radii[n // 2] * 0.55, radii[n // 2] * 0.25, 3)

    # trunk leans toward +X with an S-curve
    grow((0, 0, 0), (0.42, 0.08, 1.0), 2.0, 0.38, 0.25, 0)

    roots = []
    for k in range(5):
        a = math.tau * k / 5 + rng.uniform(-0.35, 0.35)
        d = Vector((math.cos(a), math.sin(a), 0))
        ln = rng.uniform(0.7, 1.15)
        p0 = Vector((0, 0, 0.45)) + d * 0.12
        pts = [p0 + d * (ln * t) + Vector((0, 0, -0.42 * math.sin(t * 1.2) - 0.25 * t * t))
               for t in (0, 0.3, 0.6, 1.0)]
        roots.append((pts, [0.22, 0.15, 0.09, 0.05]))
    return tubes, roots, clusters


def bark_fn(p, d, t):
    s = E.fbm((p.x * 3.0, p.y * 3.0, p.z * 0.7), 1.0, 3)
    c = E.mix(E.BARK, E.BARK_RIDGE, 0.5 + 0.9 * s)
    if d.z < -0.2:  # undersides darker
        c = E.mix(c, E.BARK_DARK, min(1, -d.z))
    if p.z < 0.6:  # grounded base
        c = E.mix(E.BARK_DARK, c, max(0.0, p.z / 0.6) * 0.7 + 0.3)
    return c


def build(with_leaves: bool):
    rng = random.Random(SEED)
    tubes, roots, clusters = skeleton(rng)
    mb = E.MeshBuilder()
    for i, (pts, radii, depth) in enumerate(tubes):
        sides, _, gnarl, twist = LIMB[depth]
        mb.tube(pts, radii, sides, bark_fn, mat=0, smooth=True, gnarl=gnarl, seed=i * 1.7,
                twist=twist, cap_end=True)
    for i, (pts, radii) in enumerate(roots):
        mb.tube(pts, radii, 7, bark_fn, mat=0, smooth=True, gnarl=0.08, seed=50 + i)
    if with_leaves:
        lr = random.Random(SEED + 100)
        for c, spread, count in clusters:
            # per-cluster hue bias gives the clumpy crimson / orange patches of the keyart
            bias = E.LEAF_COLORS[lr.choice((0, 1, 3))]
            for _ in range(count):
                off = Vector((lr.gauss(0, spread), lr.gauss(0, spread), lr.gauss(0.1, spread * 0.45)))
                pos = c + off
                out = (off + Vector((0, 0, 0.35))).normalized()
                nrm = out + Vector((lr.gauss(0, 0.6), lr.gauss(0, 0.6), lr.gauss(0, 0.6)))
                up = Vector((lr.gauss(0, 1), lr.gauss(0, 1), -0.6))
                col = E.mix(E.pick_leaf(lr), bias, 0.3)
                # fake canopy AO: low + inward leaves darker, top leaves catch light
                shade = 0.7 + 0.25 * min(1.0, off.length / (spread * 1.5)) + 0.1 * (pos.z - 3.5)
                E.add_leaf(mb, pos, nrm, up, lr.uniform(0.22, 0.32), E.mul(col, max(0.5, min(1.15, shade))),
                           mat=1, fold=0.18, curl=0.15, vary=lr)
    mats = [E.mat_vcol("MapleBark", rough=0.92)]
    if with_leaves:
        mats.append(E.mat_vcol("MapleLeaf", rough=0.7, double=True))
    return mb.build("MapleTree" if with_leaves else "MapleTreeBare", mats)


if __name__ == "__main__":
    for leaves, name in ((True, "maple_tree"), (False, "maple_tree_bare")):
        E.reset()
        ob = build(leaves)
        E.export_glb(E.OUT_DIR / f"{name}.glb", [ob])
        E.render_preview(E.PREVIEW_DIR / f"env_{name}.png", [ob], view=(0.1, -1.4, 0.3), ground_z=0.0)
