"""
Color Fox — shared helpers for procedural environment kit (env_build_*.py).

Geometry is accumulated in a MeshBuilder (verts + per-corner vertex colors +
per-face material/smooth flags), then turned into one Blender object, exported
to GLB (COLOR_0 vertex colors, Y-up) and previewed with CPU Eevee @ 512px.

Palette is authored in sRGB hex; vertex colors are stored linear (glTF spec).
Colors keep a wide value range so assets still read when the game desaturates
the world to sepia.
"""
from __future__ import annotations

import math
import random
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector, noise

ROOT = Path(__file__).resolve().parents[3]
OUT_DIR = ROOT / "assets/env/procedural"
PREVIEW_DIR = ROOT / "assets/previews"
RES = 512

# ---------------------------------------------------------------- color utils


def _s2l(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexc(h: str) -> tuple:
    """sRGB hex -> linear RGB tuple."""
    h = h.lstrip("#")
    return tuple(_s2l(int(h[i:i + 2], 16) / 255.0) for i in (0, 2, 4))


def mix(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def mul(c, k):
    return tuple(max(0.0, x * k) for x in c)


def fbm(p, scale=1.0, octaves=3) -> float:
    """Blender noise in ~[-1, 1]."""
    return noise.fractal(Vector(p) * scale, 1.0, 2.0, octaves, noise_basis="PERLIN_ORIGINAL")


# Shared palettes (sRGB)
STONE = hexc("#88857f")
STONE_DARK = hexc("#4b4741")
STONE_GRIME = hexc("#5e5245")
MOSS_GOLD = hexc("#8c7a35")
BARK = hexc("#3a342f")
BARK_DARK = hexc("#1d1916")
BARK_RIDGE = hexc("#6e665c")
LEAF_COLORS = [hexc(h) for h in (
    "#8e1c16",  # crimson
    "#a82a18",  # deep red
    "#b9461c",  # rust
    "#cf5e24",  # burnt orange
    "#de7a2a",  # orange
    "#e39a3a",  # amber (sparse)
)]
LEAF_WEIGHTS = [3, 3, 4, 3, 2, 1]
LEAF_DRY = hexc("#7a4a2a")


def pick_leaf(rng: random.Random, dry: float = 0.0):
    c = rng.choices(LEAF_COLORS, LEAF_WEIGHTS)[0]
    c = mul(c, rng.uniform(0.85, 1.12))
    return mix(c, LEAF_DRY, dry * rng.random())


# ---------------------------------------------------------------- mesh builder


class MeshBuilder:
    def __init__(self):
        self.verts: list = []
        self.vcols: list = []
        self.faces: list = []
        self.fcols: list = []  # per-face list of corner colors
        self.fmat: list = []
        self.fsmooth: list = []

    def v(self, co, col=(1, 1, 1)) -> int:
        self.verts.append(tuple(co))
        self.vcols.append(tuple(col))
        return len(self.verts) - 1

    def f(self, idx, mat=0, smooth=False, cols=None):
        idx = list(idx)
        self.faces.append(idx)
        self.fcols.append(list(cols) if cols else [self.vcols[i] for i in idx])
        self.fmat.append(mat)
        self.fsmooth.append(smooth)

    def tri_count(self) -> int:
        return sum(len(f) - 2 for f in self.faces)

    def build(self, name: str, materials: list):
        me = bpy.data.meshes.new(name)
        me.from_pydata(self.verts, [], self.faces)
        me.update()
        me.polygons.foreach_set("material_index", self.fmat)
        me.polygons.foreach_set("use_smooth", self.fsmooth)
        attr = me.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
        flat = []
        for poly, cols in zip(me.polygons, self.fcols):
            assert poly.loop_total == len(cols)
            for c in cols:
                flat.extend((c[0], c[1], c[2], 1.0))
        attr.data.foreach_set("color", flat)
        me.color_attributes.active_color = attr
        me.color_attributes.render_color_index = 0
        for m in materials:
            me.materials.append(m)
        me.validate()
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        return ob

    # -------------------------------------------------------------- primitives

    def hull(self, pts, color_fn, mat=0, smooth=False):
        """Convex hull of points (chunky stones). color_fn(center, normal) -> rgb."""
        bm = bmesh.new()
        for p in pts:
            bm.verts.new(p)
        res = bmesh.ops.convex_hull(bm, input=bm.verts)
        bmesh.ops.delete(bm, geom=res["geom_interior"] + res["geom_unused"], context="VERTS")
        bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(1.0), verts=bm.verts, edges=bm.edges)
        bm.normal_update()
        bm.verts.index_update()
        base = len(self.verts)
        for bv in bm.verts:
            self.verts.append(tuple(bv.co))
            self.vcols.append((1, 1, 1))
        for face in bm.faces:
            # per-corner color (noise + grime gradient), face normal drives moss/underside
            cols = [color_fn(lv.co, face.normal) for lv in face.verts]
            self.f([base + lv.index for lv in face.verts], mat, smooth, cols)
        bm.free()

    def block(self, center, half, color_fn, rot=(0, 0, 0), chamfer=0.04, jitter=0.0,
              rng=None, mat=0, corners=None):
        """Chamfered hexahedron. `corners` (8 pts indexed by bits xyz) overrides box."""
        rng = rng or random.Random(0)
        if corners is None:
            hx, hy, hz = half
            corners = [Vector(((1 if i & 1 else -1) * hx, (1 if i & 2 else -1) * hy,
                               (1 if i & 4 else -1) * hz)) for i in range(8)]
            m = Matrix.Translation(Vector(center)) @ _euler(rot)
            corners = [m @ c for c in corners]
        corners = [Vector(c) + Vector((rng.uniform(-jitter, jitter) for _ in range(3)))
                   for c in corners]
        pts = []
        for i, c in enumerate(corners):
            for bit in (1, 2, 4):
                nb = corners[i ^ bit]
                d = nb - c
                pts.append(c + d.normalized() * min(chamfer * rng.uniform(0.6, 1.4), d.length * 0.45))
        self.hull(pts, color_fn, mat)

    def lathe(self, profile, sides, color_fn, center=(0, 0, 0), mat=0, smooth=True,
              cap_top=True, cap_bottom=False, rot=0.0, wobble=0.0, seed=0):
        """Revolve [(r, z), ...] around Z. color_fn(pos, t_along_profile)."""
        cx, cy, cz = center
        rings = []
        n = len(profile)
        for i, (r, z) in enumerate(profile):
            ring = []
            for j in range(sides):
                a = rot + 2 * math.pi * j / sides
                rr = r * (1 + wobble * fbm((math.cos(a) * 2, math.sin(a) * 2, z + seed), 1.3))
                p = (cx + math.cos(a) * rr, cy + math.sin(a) * rr, cz + z)
                ring.append(self.v(p, color_fn(p, i / max(1, n - 1))))
            rings.append(ring)
        for i in range(n - 1):
            a, b = rings[i], rings[i + 1]
            if profile[i][0] < 1e-5:
                for j in range(sides):
                    self.f([a[j], b[j], b[(j + 1) % sides]], mat, smooth)
            elif profile[i + 1][0] < 1e-5:
                for j in range(sides):
                    self.f([a[j], a[(j + 1) % sides], b[j]], mat, smooth)
            else:
                for j in range(sides):
                    self.f([a[j], a[(j + 1) % sides], b[(j + 1) % sides], b[j]], mat, smooth)
        if cap_top and profile[-1][0] > 1e-5:
            self.f(rings[-1], mat, False)
        if cap_bottom and profile[0][0] > 1e-5:
            self.f(list(reversed(rings[0])), mat, False)
        return rings

    def tube(self, pts, radii, sides, color_fn, mat=0, smooth=True, gnarl=0.0, seed=0.0,
             cap_end=True, twist=0.0):
        """Sweep a ring along a polyline (parallel transport). color_fn(pos, normal, t)."""
        pts = [Vector(p) for p in pts]
        n = len(pts)
        tangents = []
        for i in range(n):
            if i == 0:
                t = pts[1] - pts[0]
            elif i == n - 1:
                t = pts[-1] - pts[-2]
            else:
                t = pts[i + 1] - pts[i - 1]
            tangents.append(t.normalized())
        up = Vector((0, 0, 1)) if abs(tangents[0].z) < 0.9 else Vector((1, 0, 0))
        nrm = tangents[0].cross(up).normalized()
        rings = []
        for i in range(n):
            if i > 0:
                axis = tangents[i - 1].cross(tangents[i])
                if axis.length > 1e-6:
                    ang = tangents[i - 1].angle(tangents[i])
                    nrm = (Matrix.Rotation(ang, 3, axis.normalized()) @ nrm).normalized()
            bin_ = tangents[i].cross(nrm).normalized()
            ring = []
            for j in range(sides):
                a = 2 * math.pi * j / sides + twist * i
                d = nrm * math.cos(a) + bin_ * math.sin(a)
                r = radii[i]
                if gnarl:
                    q = pts[i] + d * r
                    r *= 1 + gnarl * fbm((q.x * 3 + seed, q.y * 3, q.z * 1.2), 1.0, 2)
                    # ridges running along the limb
                    r *= 1 + gnarl * 0.6 * math.sin(a * 3 + i * 0.7 + seed)
                p = pts[i] + d * r
                ring.append(self.v(p, color_fn(p, d, i / (n - 1))))
            rings.append(ring)
        for i in range(n - 1):
            a, b = rings[i], rings[i + 1]
            for j in range(sides):
                k = (j + 1) % sides
                self.f([a[j], a[k], b[k], b[j]], mat, smooth)
        if cap_end:
            tip = self.v(pts[-1] + tangents[-1] * radii[-1] * 0.6,
                         color_fn(pts[-1], tangents[-1], 1.0))
            last = rings[-1]
            for j in range(sides):
                self.f([last[j], last[(j + 1) % sides], tip], mat, smooth)
        return rings


def _euler(rot):
    from mathutils import Euler
    return Euler(rot, "XYZ").to_matrix().to_4x4()


# ---------------------------------------------------------------- maple leaf

# Maple outline, right half (x, y); stem at -Y, tip at +Y. Mirrored for the left.
_LEAF_HALF = [
    (0.20, 0.74), (0.15, 0.44), (0.52, 0.64), (0.94, 0.72), (0.64, 0.34),
    (0.30, 0.12), (0.58, -0.20), (0.12, -0.16),
]
_LEAF_OUTLINE = ([(0.0, 1.0)] + _LEAF_HALF + [(0.0, -0.30)]
                 + [(-x, y) for x, y in reversed(_LEAF_HALF)])
_LEAF_HUB = (0.0, 0.2)


def add_leaf(mb: MeshBuilder, center, normal, up, size, col, mat=0, fold=0.12, curl=0.0,
             vary: random.Random | None = None):
    """One maple-silhouette leaf card (18 tris), hub lifted for a fold crease.
    `center` is the leaf hub; size ~= hub-to-tip length."""
    n = Vector(normal).normalized()
    u = Vector(up)
    u = (u - n * u.dot(n))
    if u.length < 1e-4:
        u = n.orthogonal()
    u.normalize()
    r = n.cross(u).normalized()
    c = Vector(center)
    edge_col = mul(col, 1.08)
    mid_col = mul(col, 0.78)
    hub = mb.v(c + n * fold * size, mid_col)
    hx, hy = _LEAF_HUB
    ring = []
    for x, y in _LEAF_OUTLINE:
        x, y = (x - hx) * size, (y - hy) * size
        if vary:
            k = vary.uniform(0.92, 1.06)
            x, y = x * k, y * k
        lift = curl * (x * x + y * y) / max(size, 1e-4)
        ring.append(mb.v(c + r * x + u * y + n * lift, edge_col))
    k = len(ring)
    for j in range(k):
        mb.f([hub, ring[(j + 1) % k], ring[j]], mat, True)


# ---------------------------------------------------------------- materials


def mat_vcol(name, rough=0.85, double=False, spec=0.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    vc = nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "Col"
    nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Specular IOR Level"].default_value = spec
    m.use_backface_culling = not double
    return m


def mat_ember(name="EmberGlow", strength=1.0):
    """Carved inlay: dark char base, orange emissive (game animates emissiveIntensity)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*hexc("#3a1a10"), 1)
    bsdf.inputs["Roughness"].default_value = 0.7
    bsdf.inputs["Emission Color"].default_value = (*hexc("#ff6a1f"), 1)
    bsdf.inputs["Emission Strength"].default_value = strength
    return m


# ---------------------------------------------------------------- scene / io


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def export_glb(path: Path, objs):
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format="GLB", use_selection=True, export_apply=True,
        export_yup=True, export_vertex_color="MATERIAL", export_normals=True,
        export_texcoords=False, export_tangents=False, export_extras=False,
        export_cameras=False, export_lights=False, export_animations=False,
    )
    tris = sum(_tris(o) for o in objs)
    print(f"[env] exported {path.relative_to(ROOT)}  tris={tris}  "
          f"size={path.stat().st_size / 1024:.1f}KB")
    return tris


def _tris(o):
    me = o.data
    me.calc_loop_triangles()
    return len(me.loop_triangles)


def _bbox(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def render_preview(path: Path, objs, view=(1.0, -1.35, 0.55), lens=50, ground=True,
                   margin=0.92, ground_z=None, target_bias=(0, 0, 0)):
    """Warm autumn studio preview (CPU Eevee, 16 samples, 512px)."""
    scene = bpy.context.scene
    lo, hi = _bbox(objs)
    center = (lo + hi) / 2 + Vector(target_bias)
    radius = (hi - lo).length / 2

    # world: warm paper haze
    world = bpy.data.worlds.new("PreviewWorld")
    scene.world = world
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs["Color"].default_value = (*hexc("#b9b3a8"), 1)
    bg.inputs["Strength"].default_value = 0.85

    # key: low copper sun from front-left; rim: cool-ish back light
    def sun(name, rot, color, energy, angle=4):
        ld = bpy.data.lights.new(name, "SUN")
        ld.energy = energy
        ld.color = color
        ld.angle = math.radians(angle)
        ob = bpy.data.objects.new(name, ld)
        ob.rotation_euler = [math.radians(a) for a in rot]
        scene.collection.objects.link(ob)

    sun("Key", (52, 0, -38), hexc("#ffe2c2"), 3.6)
    sun("Rim", (60, 0, 150), hexc("#ffe7c7"), 1.6, 10)

    if ground:
        gz = lo.z if ground_z is None else ground_z
        bpy.ops.mesh.primitive_circle_add(vertices=48, radius=radius * 6, fill_type="NGON",
                                          location=(center.x, center.y, gz - 0.002))
        g = bpy.context.active_object
        gm = bpy.data.materials.new("PreviewGround")
        gm.use_nodes = True
        b = next(n for n in gm.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        b.inputs["Base Color"].default_value = (*hexc("#8f897d"), 1)
        b.inputs["Roughness"].default_value = 1.0
        g.data.materials.append(gm)

    cam_d = bpy.data.cameras.new("PreviewCam")
    cam_d.lens = lens
    cam_d.clip_end = 1000
    cam = bpy.data.objects.new("PreviewCam", cam_d)
    scene.collection.objects.link(cam)
    fov = 2 * math.atan(36 / (2 * lens))
    dist = radius / math.sin(fov / 2) * margin
    d = Vector(view).normalized()
    cam.location = center + d * dist
    cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam

    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = RES
    scene.render.resolution_y = RES
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.film_transparent = False
    ee = scene.eevee
    ee.taa_render_samples = 16
    if hasattr(ee, "use_raytracing"):
        ee.use_raytracing = False
    if hasattr(ee, "use_shadows"):
        ee.use_shadows = True
    scene.view_settings.view_transform = "AgX"
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass
    path.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    print(f"[env] preview {path.relative_to(ROOT)}")
    _desat_check(path)


def _desat_check(path: Path):
    """Write a luminance-only copy to /tmp/env_desat/ to eyeball sepia readability."""
    import numpy as np
    img = bpy.data.images.load(str(path))
    px = np.array(img.pixels[:], dtype=np.float32).reshape(-1, 4)
    y = px[:, 0] * 0.2126 + px[:, 1] * 0.7152 + px[:, 2] * 0.0722
    px[:, 0] = px[:, 1] = px[:, 2] = y
    out = Path("/tmp/env_desat") / path.name
    out.parent.mkdir(parents=True, exist_ok=True)
    img.pixels[:] = px.ravel().tolist()
    img.filepath_raw = str(out)
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)


def stone_color_fn(rng: random.Random, base=STONE, moss=0.35, grime_z=(0.0, 1.0),
                   tint=1.0):
    """Weathered stone: per-block value shift, grime toward bottom, gold moss on tops."""
    k = rng.uniform(0.82, 1.1) * tint
    hue_shift = rng.uniform(-0.04, 0.04)
    z0, z1 = grime_z

    def fn(p, n):
        c = mul(base, k)
        c = (c[0] * (1 + hue_shift), c[1], c[2] * (1 - hue_shift))
        nz = fbm((p[0] * 2.1, p[1] * 2.1, p[2] * 2.1), 1.0, 3)
        c = mul(c, 1 + 0.18 * nz)
        h = (p[2] - z0) / max(1e-3, (z1 - z0))
        c = mix(STONE_GRIME, c, 0.55 + 0.45 * max(0, min(1, h)))
        if n[2] < -0.3:
            c = mix(c, STONE_DARK, 0.5)
        if moss and n[2] > 0.55:
            m = 0.5 + 0.5 * fbm((p[0] * 1.3 + 7, p[1] * 1.3, p[2]), 1.0, 2)
            c = mix(c, MOSS_GOLD, moss * m * n[2] * 1.6)
        return c

    return fn
