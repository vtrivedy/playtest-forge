"""Procedural textures for hero v2 (system python + PIL, deterministic).
Writes assets/hero/source/v2/{cards_col.png, cards_emit.png, tail_col.png, tail_emit.png}
cards atlas 1024: [0..512 x 0..1024] 4 flame wisps (128x1024 each... laid as 2x2 of 256x512)
                  [512..1024 x 0..512]  2 fur tufts (cream | rust), 256x512 each
                  [512..1024 x 512..1024] 4 maple leaves 256x256
(pixel coords, y down)."""
import math, random
from PIL import Image, ImageDraw, ImageFilter, ImageChops
OUT = "/workspace/siyu/playtest-forge/assets/hero/source/v2"
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

FLAME = [(0, (140, 34, 6)), (0.4, (225, 82, 16)), (0.75, (250, 150, 40)), (1, (255, 205, 110))]

def flame(x0, y0, w, h, seed):
    """Wispy ember tendrils (smoke-fire ribbons): base at bottom, curling and thinning upward,
    soft alpha falloff (rendered with alpha BLEND + emissive + bloom)."""
    rnd = random.Random(seed)
    acc = Image.new("L", (w, h), 0); hot = Image.new("L", (w, h), 0)
    da, dh = ImageDraw.Draw(acc), ImageDraw.Draw(hot)
    for k in range(rnd.randint(5, 7)):
        ph = rnd.uniform(0, 6.3); amp = rnd.uniform(0.08, 0.22); fr = rnd.uniform(0.8, 1.8)
        x = w * (0.5 + rnd.uniform(-0.12, 0.12)); L = rnd.uniform(0.55, 0.98); r0 = w * rnd.uniform(0.05, 0.11)
        N = 90
        for i in range(N):
            t = i / N
            if t > L: break
            cx = x + w * amp * math.sin(ph + t * fr * 6.28) * (0.3 + t) + w * 0.12 * math.sin(ph * 2 + t * 2) * t
            cy = h * (0.98 - t * 0.96)
            r = r0 * (1 - t / L) ** 0.7 + 1
            val = int(255 * (1 - (t / L)) ** 0.6)
            da.ellipse([cx - r, cy - r, cx + r, cy + r], fill=max(val, 0) if val > 0 else 0)
            if t < L * 0.45:
                rr = r * 0.45
                dh.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=int(255 * (1 - t / (L * 0.45))))
    for k in range(10):  # ember flecks
        fx, fy, fr_ = rnd.uniform(0.1, 0.9) * w, rnd.uniform(0.05, 0.6) * h, rnd.uniform(2, 5)
        da.ellipse([fx - fr_, fy - fr_, fx + fr_, fy + fr_], fill=230); dh.ellipse([fx - fr_, fy - fr_, fx + fr_, fy + fr_], fill=200)
    acc = acc.filter(ImageFilter.GaussianBlur(3)); hot = hot.filter(ImageFilter.GaussianBlur(5))
    A, Hh = acc.load(), hot.load()
    layer = Image.new("RGBA", (w, h)); el = Image.new("RGB", (w, h))
    L_, E_ = layer.load(), el.load()
    for yy in range(h):
        for xx in range(w):
            a_, h_ = A[xx, yy] / 255, Hh[xx, yy] / 255
            c = ramp(FLAME, 0.15 + 0.6 * a_ + 0.35 * h_)
            L_[xx, yy] = c + (int(255 * min(1, a_ * 1.4)),)
            E_[xx, yy] = lerp((0, 0, 0), c, min(1, 0.35 + 0.65 * a_))
    col.alpha_composite(layer, (x0, y0)); emi.paste(el, (x0, y0), layer.split()[3])

for i in range(4):
    flame((i % 2) * 256, (i // 2) * 512, 256, 512, 11 + i)

def tuft(x0, y0, w, h, base, tip, seed, strands=26):
    """Fur tuft: tapered strands fanning from bottom-center to the top."""
    rnd = random.Random(seed)
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
    for s in range(strands):
        a = rnd.uniform(-0.45, 0.45); L = h * rnd.uniform(0.6, 0.97); bw = w * rnd.uniform(0.05, 0.09)
        bx = w / 2 + rnd.uniform(-0.18, 0.18) * w; by = h
        curl = rnd.uniform(-0.3, 0.3)
        pts_l, pts_r = [], []
        for i in range(21):
            t = i / 20
            ang = a + curl * t * t
            cx = bx + math.sin(ang) * L * t; cy = by - math.cos(ang) * L * t
            ww = bw * (1 - t) ** 0.9
            pts_l.append((cx - ww, cy)); pts_r.append((cx + ww, cy))
        shade = rnd.uniform(0.85, 1.1)
        c = tuple(min(255, int(v * shade)) for v in lerp(base, tip, rnd.uniform(0.3, 1)))
        d.polygon(pts_l + pts_r[::-1], fill=c + (255,))
    col.alpha_composite(layer.filter(ImageFilter.GaussianBlur(1.2)), (x0, y0))

tuft(512, 0, 256, 512, (176, 128, 86), (222, 200, 166), 3)       # cream ruff
tuft(768, 0, 256, 512, (110, 42, 14), (190, 86, 30), 4)          # rust scruff

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
TAIL = [(0, (150, 58, 22)), (0.3, (196, 86, 30)), (0.55, (232, 120, 34)), (0.78, (250, 170, 60)), (1, (255, 222, 140))]
pc, pe = tc.load(), te.load()
for y in range(TH):
    v = 1 - y / (TH - 1)
    for x in range(TW):
        pc[x, y] = ramp(TAIL, v)
        e = max(0, (v - 0.5) / 0.5) ** 1.5
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
tc.save(f"{OUT}/tail_col.png", optimize=True); te.save(f"{OUT}/tail_emit.png", optimize=True)
print("textures ok")
