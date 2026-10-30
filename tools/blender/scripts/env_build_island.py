"""
Color Fox — modular floating island chunk (keyart floating ruins).
Grassy autumn top (walkable, ~z=0), dirt band, faceted stratified rock underside.
Headless: blender --background --factory-startup --python tools/blender/scripts/env_build_island.py
Out: assets/env/procedural/island_chunk.glb, assets/previews/env_island_chunk.png
"""
import math
import random
import sys
from pathlib import Path

from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import env_common as E  # noqa: E402

SEED = 41
SEG = 40
R0 = 4.2

GRASS = E.hexc("#c39a3e")
GRASS_DRY = E.hexc("#9a8442")
GRASS_RUST = E.hexc("#9a4a1e")
DIRT = E.hexc("#5e3d26")
DIRT_DARK = E.hexc("#3f2a1c")
ROCK_A = E.hexc("#716960")
ROCK_B = E.hexc("#544d47")
ROCK_DARK = E.hexc("#38332f")


def outline(a):
    return R0 * (1 + 0.13 * E.fbm((math.cos(a) * 1.3, math.sin(a) * 1.3, 0.5), 1.0, 3))


def top_h(x, y):
    return 0.05 * E.fbm((x * 0.35, y * 0.35, 3.0), 1.0, 2)


def grass_col(x, y, edge=0.0):
    n1 = E.fbm((x * 0.22, y * 0.22, 9.0), 1.0, 3)
    n2 = E.fbm((x * 0.28 + 4, y * 0.28, 1.0), 1.0, 2)
    n3 = E.fbm((x * 1.7, y * 1.7, 5.0), 1.0, 2)
    c = E.mix(GRASS, GRASS_DRY, 0.45 + 1.4 * n1)
    c = E.mix(c, GRASS_RUST, max(0.0, n2 * 2.0 - 0.15) * 0.8)
    c = E.mul(c, 1 + 0.15 * n3)
    return E.mul(c, 1 - 0.3 * edge)


def build():
    rng = random.Random(SEED)
    mb = E.MeshBuilder()
    G, F = 0, 1  # ground (single-sided) / foliage (double-sided)

    # (radius fraction, z, kind) — top rings smooth, then lip, dirt, rock strata
    top_rings = [0.25, 0.5, 0.72, 0.9, 1.0]
    side_rings = [(1.015, -0.14, "lip"), (0.99, -0.4, "dirt"), (0.94, -0.8, "dirt"),
                  (0.9, -1.35, "rock"), (0.8, -1.95, "rock"), (0.66, -2.6, "rock"),
                  (0.48, -3.3, "rock"), (0.28, -4.0, "rock")]
    angles = [math.tau * j / SEG for j in range(SEG)]
    rad = [outline(a) for a in angles]

    center = mb.v((0, 0, top_h(0, 0)), grass_col(0, 0))
    rings = []
    for f in top_rings:
        ring = []
        for a, r in zip(angles, rad):
            x, y = math.cos(a) * r * f, math.sin(a) * r * f
            z = top_h(x, y) - (0.06 if f == 1.0 else 0.0)
            ring.append(mb.v((x, y, z), grass_col(x, y, edge=max(0, f - 0.85) * 2)))
        rings.append(ring)
    for j in range(SEG):
        mb.f([center, rings[0][j], rings[0][(j + 1) % SEG]], G, True)
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        for j in range(SEG):
            k = (j + 1) % SEG
            mb.f([a[j], b[j], b[k], a[k]], G, True)

    prev = rings[-1]
    prev_kind = "top"
    for si, (f, z, kind) in enumerate(side_rings):
        ring = []
        for j, (a, r) in enumerate(zip(angles, rad)):
            jag = 0.0
            zj = 0.0
            if kind == "rock":
                jag = 0.16 * E.fbm((math.cos(a) * 3, math.sin(a) * 3, z * 0.7), 1.0, 2)
                zj = rng.uniform(-0.18, 0.18)
            elif kind == "dirt":  # ragged dirt band: roots / crumbled soil
                jag = 0.05 * E.fbm((math.cos(a) * 5, math.sin(a) * 5, z), 1.0, 2)
                zj = rng.uniform(-0.12, 0.12) * (si - 0.5)
            rr = r * f * (1 + jag)
            x, y = math.cos(a) * rr, math.sin(a) * rr
            if kind == "lip":
                c = E.mul(grass_col(x, y), 0.62)
            elif kind == "dirt":
                c = E.mix(DIRT, DIRT_DARK, si / 3 + 0.2 * E.fbm((x, y, z), 1.5))
            else:
                band = ROCK_A if si % 2 else ROCK_B
                depth = (-z - 1.3) / 2.8
                c = E.mix(band, ROCK_DARK, depth * 0.8 + 0.25 * E.fbm((x, y, z), 1.2))
            ring.append(mb.v((x, y, z + zj), c))
        smooth = kind != "rock"
        for j in range(SEG):
            k = (j + 1) % SEG
            mb.f([prev[j], ring[j], ring[k], prev[k]], G, smooth)
        prev, prev_kind = ring, kind
    tip = mb.v((0.3, -0.2, -4.9), ROCK_DARK)
    for j in range(SEG):
        mb.f([prev[j], tip, prev[(j + 1) % SEG]], G, False)

    # chunky rock outcrops breaking the underside silhouette
    for k in range(7):
        a = rng.uniform(0, math.tau)
        zc = rng.uniform(-3.2, -1.2)
        rr = outline(a) * (0.9 + (zc + 1.2) * 0.22)
        s = rng.uniform(0.4, 0.62)
        fn = E.stone_color_fn(rng, base=ROCK_A, moss=0.0, grime_z=(-4.5, 0), tint=0.95)
        mb.block((math.cos(a) * rr, math.sin(a) * rr, zc), (s, s * 0.8, s * 1.3), fn,
                 rot=(rng.uniform(-0.4, 0.4), rng.uniform(-0.4, 0.4), a), chamfer=s * 0.25,
                 jitter=s * 0.25, rng=rng, mat=G)

    # a couple of mossy boulders on the rim (top stays clear for play)
    for k in range(3):
        a = rng.uniform(0, math.tau)
        r = outline(a) * rng.uniform(0.8, 0.9)
        s = rng.uniform(0.22, 0.38)
        x, y = math.cos(a) * r, math.sin(a) * r
        fn = E.stone_color_fn(rng, moss=0.6, grime_z=(0, s * 2))
        mb.block((x, y, top_h(x, y) + s * 0.45), (s * 1.2, s, s * 0.8), fn,
                 rot=(0, 0, rng.uniform(0, 3)), chamfer=s * 0.3, jitter=s * 0.2, rng=rng, mat=G)

    # golden grass tufts (blade triangles), denser toward the rim
    tip_gold = E.hexc("#e6bb5c")
    for _ in range(110):
        a = rng.uniform(0, math.tau)
        f = math.sqrt(rng.uniform(0.15, 1.0)) * 0.95
        r = outline(a) * f
        cx, cy = math.cos(a) * r, math.sin(a) * r
        cz = top_h(cx, cy) - (0.05 if f > 0.97 else 0.0)
        base = E.mul(grass_col(cx, cy), 0.7)
        tipc = E.mix(tip_gold, GRASS_RUST, rng.random() * 0.6)
        for b in range(4):
            ba = rng.uniform(0, math.tau)
            h = rng.uniform(0.25, 0.5)
            lean = Vector((math.cos(ba), math.sin(ba), 0)) * rng.uniform(0.05, 0.16)
            side = Vector((-math.sin(ba), math.cos(ba), 0)) * 0.05
            p = Vector((cx, cy, cz)) + Vector((rng.gauss(0, 0.05), rng.gauss(0, 0.05), 0))
            i0 = mb.v(p - side, base)
            i1 = mb.v(p + side, base)
            i2 = mb.v(p + lean + Vector((0, 0, h)), tipc)
            mb.f([i0, i1, i2], F, True)

    # fallen maple leaves resting on the turf
    for _ in range(36):
        a = rng.uniform(0, math.tau)
        r = outline(a) * math.sqrt(rng.random()) * 0.92
        x, y = math.cos(a) * r, math.sin(a) * r
        n = Vector((rng.gauss(0, 0.12), rng.gauss(0, 0.12), 1))
        up = Vector((rng.gauss(0, 1), rng.gauss(0, 1), 0))
        E.add_leaf(mb, (x, y, top_h(x, y) + 0.015), n, up, rng.uniform(0.1, 0.15),
                   E.pick_leaf(rng, 0.3), mat=F, fold=0.15, curl=0.12, vary=rng)

    mats = [E.mat_vcol("IslandGround", rough=0.95), E.mat_vcol("IslandFoliage", rough=0.75,
                                                              double=True)]
    return mb.build("IslandChunk", mats)


if __name__ == "__main__":
    E.reset()
    ob = build()
    E.export_glb(E.OUT_DIR / "island_chunk.glb", [ob])
    E.render_preview(E.PREVIEW_DIR / "env_island_chunk.png", [ob], view=(0.7, -1.3, 0.62),
                     ground=False)
