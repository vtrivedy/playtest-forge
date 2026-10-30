"""Spirit-FX textures for the hero fox (system python + PIL, deterministic).
Writes assets/hero/source/v2/{spirit_fx.png, tail_glow.png}
spirit_fx 512 RGBA (pixel coords, y down):
  [0..256   x 0..512]   translucent flame sheet (wide soft tongue, streaked, alpha <= ~0.8)
  [256..512 x 0..256]   single spark (amber core + soft halo, short upward trail)
  [256..512 x 256..512] drifting spark cluster (3-5 small embers)
tail_glow 64x512 RGBA: u around, v along (row 0 = tip): inner ember glow mask for the tail glow shell.
Colours stay amber/orange — no white-hot cores (bloom would blow the silhouette)."""
import math, random
from PIL import Image, ImageDraw, ImageFilter
OUT = "/workspace/siyu/playtest-forge/assets/hero/source/v2"
rnd = random.Random(23)
S = 512
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))

def lerp(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))
def ramp(stops, t):
    t = max(0, min(1, t))
    for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
        if t <= t1: return lerp(c0, c1, (t - t0) / max(1e-6, t1 - t0))
    return stops[-1][1]
EMBER = [(0, (150, 40, 8)), (0.35, (220, 84, 18)), (0.7, (246, 144, 40)), (1, (255, 196, 100))]

def colorize(acc, hot, amax):
    A, H = acc.load(), hot.load(); w, h = acc.size
    lay = Image.new("RGBA", (w, h)); L = lay.load()
    for y in range(h):
        for x in range(w):
            a, k = A[x, y] / 255, H[x, y] / 255
            L[x, y] = ramp(EMBER, 0.1 + 0.55 * a + 0.35 * k) + (int(255 * min(amax, a * 1.25)),)
    return lay

# --- flame sheet: several soft tongues from a common base, curling up, streaked
w, h = 256, 512
acc = Image.new("L", (w, h), 0); hot = Image.new("L", (w, h), 0)
da, dh = ImageDraw.Draw(acc), ImageDraw.Draw(hot)
for k in range(7):
    ph = rnd.uniform(0, 6.3); amp = rnd.uniform(0.12, 0.26); fr = rnd.uniform(0.9, 1.7)
    x0 = w * (0.5 + rnd.uniform(-0.18, 0.18)); L = rnd.uniform(0.45, 0.95); r0 = w * rnd.uniform(0.12, 0.2)
    for i in range(120):
        t = i / 120
        if t > L: break
        cx = x0 + w * amp * math.sin(ph + t * fr * 6.28) * (0.4 + t) + (w * 0.5 - x0) * 0.2 * t
        cy = h * (0.97 - t * 0.95)
        r = r0 * (1 - t / L) ** 1.1 + 1
        da.ellipse([cx - r, cy - r, cx + r, cy + r], fill=int(150 * (1 - t / L) ** 0.5))
        if t < L * 0.35:
            rr = r * 0.4; dh.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=int(200 * (1 - t / (L * 0.35))))
acc = acc.filter(ImageFilter.GaussianBlur(6)); hot = hot.filter(ImageFilter.GaussianBlur(8))
# vertical streaks so it reads as licking flame, not a smooth blob
st = Image.new("L", (w, h), 0); ds = ImageDraw.Draw(st)
for s in range(40):
    x = rnd.uniform(0, w); y = rnd.uniform(0.2, 1.0) * h; L = rnd.uniform(40, 200)
    ds.line([(x, y), (x + rnd.uniform(-10, 10), y - L)], fill=rnd.randint(60, 200), width=rnd.choice([3, 5, 7]))
st = st.filter(ImageFilter.GaussianBlur(4))
from PIL import ImageChops
acc = ImageChops.multiply(acc, st.point(lambda v: 165 + v * 90 // 255))
acc = acc.point(lambda v: min(255, int(v * 1.9)))
img.alpha_composite(colorize(acc, hot, 0.8), (0, 0))

# --- single spark: soft halo + amber core + short trail
def spark(cx, cy, r, trail=0.0, size=(256, 256)):
    a = Image.new("L", size, 0); hh = Image.new("L", size, 0)
    d1, d2 = ImageDraw.Draw(a), ImageDraw.Draw(hh)
    d1.ellipse([cx - r * 2.6, cy - r * 2.6, cx + r * 2.6, cy + r * 2.6], fill=70)
    d1.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    if trail: d1.line([(cx, cy), (cx + trail * 0.2, cy + trail)], fill=150, width=max(1, int(r * 0.9)))
    d2.ellipse([cx - r * 0.55, cy - r * 0.55, cx + r * 0.55, cy + r * 0.55], fill=255)
    return a, hh
a, hh = spark(128, 100, 20, trail=70)
a = a.filter(ImageFilter.GaussianBlur(10)); hh = hh.filter(ImageFilter.GaussianBlur(6))
img.alpha_composite(colorize(a.point(lambda v: min(255, v * 2)), hh, 1.0), (256, 0))

# --- spark cluster
ca = Image.new("L", (256, 256), 0); ch = Image.new("L", (256, 256), 0)
for k in range(5):
    sa, sh_ = spark(rnd.uniform(40, 216), rnd.uniform(40, 216), rnd.uniform(6, 13), trail=rnd.uniform(10, 40))
    ca = ImageChops.lighter(ca, sa); ch = ImageChops.lighter(ch, sh_)
ca = ca.filter(ImageFilter.GaussianBlur(4)); ch = ch.filter(ImageFilter.GaussianBlur(3))
img.alpha_composite(colorize(ca.point(lambda v: min(255, v * 2)), ch, 1.0), (256, 256))

# dilate colour under transparent texels (no dark mip fringes)
rgb = img.convert("RGB"); al = img.split()[3]
fill = Image.composite(rgb, rgb.filter(ImageFilter.MaxFilter(9)), al)
fill.putalpha(al); fill.save(f"{OUT}/spirit_fx.png", optimize=True)

# --- tail glow: none at the root, builds through the plume, flickering streaks along v
TW, TH = 64, 512
tg = Image.new("RGBA", (TW, TH)); P = tg.load()
noise = [[0.0] * TW for _ in range(TH)]
cols_ph = [rnd.uniform(0, 6.3) for _ in range(TW)]
for y in range(TH):
    v = 1 - y / (TH - 1)
    base = max(0.0, min(1.0, (v - 0.25) / 0.45)) ** 1.5
    for x in range(TW):
        fl = 0.55 + 0.45 * math.sin(cols_ph[x] + v * 23 + math.sin(x * 0.7) * 2)
        fl *= 0.7 + 0.3 * math.sin(x * 2 * math.pi / TW * 5 + v * 9)
        aa = base * max(0.0, fl)
        P[x, y] = ramp(EMBER, 0.2 + 0.6 * v * aa) + (int(255 * min(0.85, aa)),)
tg = tg.filter(ImageFilter.GaussianBlur(1.2))
tg.save(f"{OUT}/tail_glow.png", optimize=True)
print("spirit fx textures ok")
