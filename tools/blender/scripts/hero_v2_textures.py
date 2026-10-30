"""Procedural textures for hero v2 (system python + PIL, deterministic).
Writes assets/hero/source/v2/{cards_col.png, cards_emit.png, tail_col.png, tail_emit.png, tail_core.png}
tail v = arc fraction along the tail (0 root .. 1 old tip); fur core is eroded into flame tongues over ~0.5..0.75, then the plume is fur-to-flame + flame cards.
cards atlas 1024: [0..512 x 0..1024] 4 silhouette flame-lick locks (rust L/R, cream L/R; 2x2 of 256x512)
                  [512..1024 x 0..512]  2 fur tufts (cream | rust), 256x512 each
                  [512..1024 x 512..1024] 4 maple leaves 256x256
(pixel coords, y down)."""
import math, random
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../../assets/hero/source/v2")
random.seed(7)
S = 1024
col = Image.new("RGBA", (S, S), (0, 0, 0, 0))
emi = Image.new("RGB", (S, S), (0, 0, 0))

def lerp(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))
def ramp(stops, t):
    t = max(0, min(1, t))
    for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
        if t <= t1: return lerp(c0, c1, (t - t0) / max(1e-6, t1 - t0))
    return stops[-1][1]

def lick(x0, y0, w, h, base, tip, seed, curl, strands=90):
    """Silhouette flame-lick lock: fur strands gathering into one tapered tongue that curls over at the tip
    (the concept's wispy ruff / ear / shoulder edges). Alpha-clipped fur, warmer tip, no glow."""
    rnd = random.Random(seed)
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
    for s_ in range(strands):
        u = rnd.uniform(-1, 1)
        L = h * (0.96 - 0.5 * abs(u) ** 1.1) * rnd.uniform(0.55, 1.0)
        bw = w * rnd.uniform(0.01, 0.022)
        pts_l, pts_r = [], []
        for i in range(30):
            t = i / 29
            spread = (1 - t) ** 1.3 * 0.34                       # gathers into a single licking point
            cx = w / 2 - curl * w * 0.1 + u * w * spread + curl * w * 0.26 * t ** 2.2 + w * 0.04 * math.sin(t * 5 + seed)
            cy = h - L * t
            ww = bw * (1 - t) ** 0.7 + 0.6
            pts_l.append((cx - ww, cy)); pts_r.append((cx + ww, cy))
        c = lerp(base, tip, min(1, max(0, L / h - 0.35) * 1.4) * rnd.uniform(0.6, 1.0))
        k_ = rnd.uniform(0.82, 1.08); c = tuple(min(255, int(v * k_)) for v in c)
        d.polygon(pts_l + pts_r[::-1], fill=c + (255,))
    col.alpha_composite(layer.filter(ImageFilter.GaussianBlur(0.7)), (x0, y0))

# [0..512 x 0..1024]: rust lick curling left / right, cream lick left / right (2x2 of 256x512)
lick(0, 0, 256, 512, (200, 104, 40), (236, 150, 70), 11, -1)
lick(256, 0, 256, 512, (200, 104, 40), (236, 150, 70), 12, 1)
lick(0, 512, 256, 512, (232, 206, 164), (248, 228, 190), 13, -1)
lick(256, 512, 256, 512, (232, 206, 164), (248, 228, 190), 14, 1)

def tuft(x0, y0, w, h, base, tip, seed, strands=110):
    """Soft fur lock: teardrop envelope filled with fine tapered strands that break up at the edge."""
    rnd = random.Random(seed)
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
    for s in range(strands):
        u = rnd.uniform(-1, 1)                                   # lateral slot in the lock
        L = h * (0.97 - 0.55 * abs(u) ** 1.2) * rnd.uniform(0.4, 1.0)
        bx = w / 2 + u * w * 0.30; by = h
        bw = w * rnd.uniform(0.012, 0.026)
        pts_l, pts_r = [], []
        for i in range(25):
            t = i / 24
            bulge = math.sin(min(1, t * 1.6) * math.pi * 0.5) * (1 - t) * 0.22  # widen then gather to the tip
            cx = bx + u * w * bulge + math.sin(t * 3 + s) * 2; cy = by - L * t
            ww = bw * (1 - t) ** 0.8 + 0.6
            pts_l.append((cx - ww, cy)); pts_r.append((cx + ww, cy))
        c = lerp(base, tip, min(1, 0.25 + 0.75 * rnd.uniform(0.6, 1.0)))
        k_ = rnd.uniform(0.78, 1.08); c = tuple(min(255, int(v * k_)) for v in c)
        d.polygon(pts_l + pts_r[::-1], fill=c + (255,))
    # root shading so layered locks read as depth, not flat paper
    grad = Image.new("L", (w, h)); gp = grad.load()
    for yy in range(h):
        for xx in range(w): gp[xx, yy] = int(255 * (0.84 + 0.16 * (1 - yy / h)))
    rgb = ImageChops.multiply(layer.convert("RGB"), Image.merge("RGB", (grad, grad, grad)))
    rgb.putalpha(layer.split()[3])
    col.alpha_composite(rgb.filter(ImageFilter.GaussianBlur(0.8)), (x0, y0))

tuft(512, 0, 256, 512, (232, 204, 160), (252, 240, 214), 3)        # warm cream lock (clean, no pink)
tuft(768, 0, 256, 512, (188, 94, 36), (210, 118, 48), 4)          # burnt-orange lock: body orange, barely warmer tips (no beige)

def maple(x0, y0, w, seed):
    rnd = random.Random(seed)
    layer = Image.new("RGBA", (w, w), (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
    cx, cy, R = w / 2, w * 0.55, w * 0.42
    pts = []
    lobes = [(-90, 1.0), (-35, 0.85), (20, 0.62), (160, 0.62), (215, 0.85)]
    for k in range(200):
        ang = -math.pi / 2 + k / 200 * 2 * math.pi
        deg = (math.degrees(ang) + 360) % 360
        r = 0.32
        for c, s in lobes:
            dd = min(abs(deg - (c % 360)), 360 - abs(deg - (c % 360)))
            r = max(r, s * max(0, 1 - dd / 30) ** 1.4)
        r *= 1 + 0.08 * math.sin(k * 0.9)
        pts.append((cx + math.cos(ang) * R * r, cy + math.sin(ang) * R * r))
    base = rnd.choice([(200, 60, 20), (225, 120, 30), (180, 40, 25), (235, 160, 50)])
    d.polygon(pts, fill=base + (255,))
    d.line([(cx, cy), (cx, cy + R * 0.7)], fill=lerp(base, (80, 30, 10), 0.6) + (255,), width=4)
    for c, s in lobes:
        a = math.radians(c); d.line([(cx, cy), (cx + math.cos(a) * R * s * 0.85, cy + math.sin(a) * R * s * 0.85)], fill=lerp(base, (255, 210, 120), 0.4) + (255,), width=2)
    col.alpha_composite(layer, (x0, y0))
    emi.paste(Image.new("RGB", (w, w), lerp((0, 0, 0), base, 0.35)), (x0, y0), layer.split()[3])

for i in range(4):
    maple(512 + (i % 2) * 256, 512 + (i // 2) * 256, 256, 30 + i)

# dilate colour under transparent texels to avoid dark fringes with mipmaps
rgb = col.convert("RGB"); a = col.split()[3]
bg = rgb.filter(ImageFilter.MaxFilter(9))
fill = Image.composite(rgb, bg, a)
out = fill.copy(); out.putalpha(a)
out.save(f"{OUT}/cards_col.png", optimize=True); emi.save(f"{OUT}/cards_emit.png", optimize=True)

# ---------------- tail strip: u around, v along (row 0 = image top = tip in Blender v=1)
TW, TH = 256, 1024
tc = Image.new("RGB", (TW, TH)); te = Image.new("RGB", (TW, TH))
# the body's *rendered* burnt orange (its bake is darkened by streaks + AO; an unbaked match reads pale beige)
TAIL = [(0, (178, 88, 34)), (0.4, (184, 92, 36)), (0.6, (192, 100, 40)), (0.78, (206, 116, 50)), (1, (216, 134, 66))]
pc, pe = tc.load(), te.load()
for y in range(TH):
    v = 1 - y / (TH - 1)
    for x in range(TW):
        under = max(0.0, -math.sin(x / TW * 2 * math.pi))  # underside a touch lighter: it sits in shadow
        pc[x, y] = tuple(min(255, int(ch * (1 + 0.12 * under))) for ch in ramp(TAIL, v))
        e = 0.5 * max(0, (v - 0.8) / 0.2) ** 2  # faint ember warmth at the very tip only
        pe[x, y] = lerp((0, 0, 0), ramp(TAIL, v), e)
d = ImageDraw.Draw(tc); de = ImageDraw.Draw(te)
rnd = random.Random(99)
for s in range(900):  # long strands along v
    x = rnd.uniform(0, TW); y = rnd.uniform(0, TH); L = rnd.uniform(40, 160)
    v = 1 - y / TH
    k = rnd.uniform(0.7, 1.25)
    c = tuple(min(255, int(ch * k)) for ch in ramp(TAIL, v))
    for dx in (0, TW, -TW):
        d.line([(x + dx, y), (x + dx + rnd.uniform(-6, 6), y + L)], fill=c, width=rnd.choice([1, 2, 2, 3]))
tc = tc.filter(ImageFilter.GaussianBlur(0.8))
# alpha = long strand mask along v (used by the tail fur shells with alpha-clip; core ignores alpha)
am = Image.new("L", (TW, TH), 0); da = ImageDraw.Draw(am)
for s in range(2600):
    x = rnd.uniform(0, TW); y = rnd.uniform(0, TH); L = rnd.uniform(30, 110); val = rnd.uniform(0.35, 1.0)
    for i in range(8):  # taper: bright root -> fading tip (tip toward higher v = image top)
        t0, t1 = i / 8, (i + 1) / 8
        for dx in (0, TW, -TW):
            da.line([(x + dx, y - L * t0), (x + dx + 1.5 * t1, y - L * t1)], fill=int(255 * val * (1 - t0) ** 0.7), width=2)
# fur dissolves into flame: alpha envelope eaten from the tip in flame-tongue shapes (core = MASK clip 0.5)
env = Image.new("L", (TW, TH)); ep = env.load()
ph = [rnd.uniform(0, 6.3) for _ in range(3)]
for x in range(TW):
    th = x / TW * 2 * math.pi
    edge = 0.62 + 0.06 * math.sin(3 * th + ph[0]) + 0.05 * math.sin(7 * th + ph[1]) + 0.03 * math.sin(13 * th + ph[2])
    for y in range(TH):
        v = 1 - y / (TH - 1)
        ep[x, y] = int(255 * max(0.0, min(1.0, (edge + 0.13 - v) / 0.26)))
env = env.filter(ImageFilter.GaussianBlur(2))
core = tc.copy(); core.putalpha(env); core.save(f"{OUT}/tail_core.png", optimize=True)
tc.putalpha(ImageChops.multiply(am, env))
tc.save(f"{OUT}/tail_col.png", optimize=True); te.save(f"{OUT}/tail_emit.png", optimize=True)
print("textures ok")
