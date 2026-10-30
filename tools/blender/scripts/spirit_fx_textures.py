"""Spirit-FX textures for the hero fox (system python + PIL + numpy, deterministic).
Writes assets/hero/source/v2/{spirit_fx.png, tail_glow.png}
spirit_fx 1024 RGBA atlas (pixel coords, y down; card base = bottom edge of each cell):
  [y 0..512]                 plume0..plume3, 256 wide each: translucent flame tongues that grow out of the
                             tail fur (alpha fades in from the base so cards melt into the plume), curl, thin out
  [y 512..1024, x 0..512]    curl0, curl1 (256x512): thin ember ribbons for the ear tips, curling back
  [y 512..768,  x 512..1024] flake0, flake1 (256x256): leaf-ember flakes that trail behind the motion path
  [y 768..1024, x 512..768]  flake2
  [y 768..1024, x 768..1024] shimmer: faint heat-ripple streaks (shoulder / neck wisps)
tail_glow 64x512 RGBA: u around, v along (row 0 = tip): inner ember glow mask for the tail glow shell.
Palette: burnt orange edges -> amber -> pale gold core. Never white (bloom would eat the silhouette)."""
import math, random
import numpy as np
from PIL import Image, ImageFilter
OUT = "/workspace/siyu/playtest-forge/assets/hero/source/v2"
rnd = random.Random(23)
S = 1024
atlas = np.zeros((S, S, 4), np.float32)

EMBER = np.array([(0.0, 168, 52, 14), (0.3, 222, 96, 24), (0.6, 244, 148, 44), (0.85, 252, 196, 104), (1.0, 252, 226, 168)], np.float32)
def ramp(x):
    x = np.clip(x, 0, 1); out = np.zeros(x.shape + (3,), np.float32)
    for c in range(3): out[..., c] = np.interp(x, EMBER[:, 0], EMBER[:, c + 1])
    return out / 255
def sstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)
def vnoise(w, h, cells_x, cells_y, seed):
    r = np.random.default_rng(seed).random((cells_y, cells_x)).astype(np.float32)
    return np.asarray(Image.fromarray((r * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC), np.float32) / 255
def put(x0, y0, rgb, a):
    h, w = a.shape
    atlas[y0:y0 + h, x0:x0 + w, :3] = rgb; atlas[y0:y0 + h, x0:x0 + w, 3] = np.clip(a, 0, 1)

def tongue(w, h, seed, curl, tongues=5, amax=0.85):
    """soft flame tongue: wide at the base, licking up and curling to one side, streaked, alpha fades in at the base"""
    rg = random.Random(seed)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    t = 1 - yy / (h - 1)                     # 0 = base (bottom), 1 = top
    u = xx / (w - 1) * 2 - 1                 # -1..1
    dens = np.zeros((h, w), np.float32); heat = np.zeros((h, w), np.float32)
    for k in range(tongues):
        L = rg.uniform(0.55, 0.98) if k else 0.95
        ph = rg.uniform(0, 6.3); amp = rg.uniform(0.08, 0.2); fr = rg.uniform(1.2, 2.4)
        x0 = rg.uniform(-0.18, 0.18) * (1 if k else 0.3)
        c = x0 + curl * 0.55 * (t / L) ** 1.6 + amp * np.sin(ph + t * fr * 6.28) * t
        prof = np.sin(np.clip(t / (0.32 * L), 0, 1) * math.pi / 2) * (1 - np.clip(t / L, 0, 1)) ** 0.85
        hw = rg.uniform(0.5, 0.72) * (1 if k == 0 else 0.62) * prof + 1e-3
        d = np.clip(1 - np.abs(u - c) / hw, 0, 1) ** 1.3
        dens = np.maximum(dens, d * (0.75 + 0.25 * (k == 0)))
        heat = np.maximum(heat, d ** 2 * (1 - np.clip(t / (0.6 * L), 0, 1)))
    # licking streaks: noise stretched along the flame, warped sideways so they curl with it
    n1 = vnoise(w, h, 7, 3, seed); n2 = vnoise(w, h, 18, 6, seed + 1)
    streak = 0.55 + 0.45 * np.sin((u * 7 + n1 * 5 + t * 3) * math.pi) * 0.5 + 0.45 * (n2 - 0.5)
    dens = dens * np.clip(streak + 0.5, 0.45, 1.15)
    base = sstep(0.0, 0.22, t)                # melt into the fur at the base
    a = np.clip(dens * 1.5, 0, 1) * base * amax
    a = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.2)), np.float32) / 255
    col = ramp(0.18 + 0.45 * dens + 0.45 * heat - 0.25 * t)
    return col, a

for i in range(4):
    rgb, a = tongue(256, 512, 101 + i, curl=(-0.55, 0.45, -0.25, 0.6)[i], tongues=(5, 4, 6, 4)[i])
    put(i * 256, 0, rgb, a)

def ribbon(w, h, seed, side):
    """ear ember: two thin ribbons rising off the tip and curling back over (back-swept wisp, not a candle)"""
    rg = random.Random(seed)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    t = 1 - yy / (h - 1); u = xx / (w - 1) * 2 - 1
    acc = np.zeros((h, w), np.float32)
    for k in range(3):
        L = (0.95, 0.7, 0.5)[k]; ph = rg.uniform(0, 1)
        c = side * (0.55 * np.sin(np.clip(t / L, 0, 1) * math.pi * 0.9) * (t / L) + 0.1 * np.sin(t * 9 + ph * 6)) - side * 0.15 + rg.uniform(-0.08, 0.08)
        hw = (0.2 - 0.05 * k) * (1 - np.clip(t / L, 0, 1)) ** 0.9 * sstep(0, 0.12, t) + 1e-3
        acc = np.maximum(acc, np.clip(1 - np.abs(u - c) / hw, 0, 1) ** 1.2 * (1 - 0.25 * k))
    a = np.clip(acc * 1.4, 0, 0.9)
    a = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.0)), np.float32) / 255
    return ramp(0.35 + 0.55 * acc - 0.3 * t), a

for i in range(2):
    rgb, a = ribbon(256, 512, 201 + i, (1, -1)[i]); put(i * 256, 512, rgb, a)

def flake(w, seed):
    """leaf-ember flake: pointed lens with a hot core and a thin glow rim, slightly bent"""
    rg = random.Random(seed)
    yy, xx = np.mgrid[0:w, 0:w].astype(np.float32)
    x = xx / (w - 1) * 2 - 1; y = yy / (w - 1) * 2 - 1
    ang = rg.uniform(-0.6, 0.6); ca, sa = math.cos(ang), math.sin(ang)
    px, py = x * ca - y * sa, x * sa + y * ca
    px = px + 0.18 * py * py * rg.choice((-1, 1))          # bend
    lens = (py / 0.82) ** 2 + (px / (0.36 * (1 - np.clip(np.abs(py) / 0.82, 0, 1) ** 1.6) + 1e-3)) ** 2
    body = np.clip(1 - lens, 0, 1)
    halo = np.clip(1 - np.sqrt(x * x + y * y), 0, 1) ** 3 * 0.35
    a = np.clip(body * 2.2, 0, 1) * 0.95 + halo
    a = np.asarray(Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5)), np.float32) / 255
    return ramp(0.12 + 0.68 * body ** 0.8), a

for (x0, y0), sd in zip(((512, 512), (768, 512), (512, 768)), (301, 302, 303)):
    rgb, a = flake(256, sd); put(x0, y0, rgb, a)

# shimmer: faint wavy streaks lying back (shoulder/neck heat ripple)
yy, xx = np.mgrid[0:256, 0:256].astype(np.float32)
t = 1 - yy / 255; u = xx / 255 * 2 - 1
n = vnoise(256, 256, 5, 4, 401)
wav = np.clip(1 - np.abs(np.sin((u * 1.3 + 0.25 * np.sin(t * 5 + n * 3)) * math.pi)) * 1.6, 0, 1)
env = sstep(0, 0.25, t) * (1 - sstep(0.55, 1.0, t)) * (1 - np.clip(np.abs(u), 0, 1) ** 2)
wav = np.asarray(Image.fromarray((wav * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(5)), np.float32) / 255
put(768, 768, ramp(0.35 + 0.4 * wav), wav * env * 0.42)

# dilate colour under transparent texels (no dark mip fringes)
img = Image.fromarray((np.clip(atlas, 0, 1) * 255).astype(np.uint8), "RGBA")
rgb = img.convert("RGB"); al = img.split()[3]
fill = Image.composite(rgb, rgb.filter(ImageFilter.MaxFilter(9)), al.point(lambda v: 255 if v > 8 else 0))
fill.putalpha(al); fill.save(f"{OUT}/spirit_fx.png", optimize=True)

# --- tail glow: none at the fur root, builds where the plume turns to flame, flickering streaks along v
TW, TH = 64, 512
yy, xx = np.mgrid[0:TH, 0:TW].astype(np.float32)
v = 1 - yy / (TH - 1)
ph = np.array([rnd.uniform(0, 6.3) for _ in range(TW)], np.float32)[None, :]
base = np.clip((v - 0.3) / 0.3, 0, 1) ** 1.5
fl = (0.55 + 0.45 * np.sin(ph + v * 23 + np.sin(xx * 0.7) * 2)) * (0.7 + 0.3 * np.sin(xx * 2 * math.pi / TW * 5 + v * 9))
aa = base * np.clip(fl, 0, None)
tg = np.concatenate([ramp(0.25 + 0.55 * v * aa), np.clip(aa * 0.7, 0, 0.6)[..., None]], axis=2)
Image.fromarray((tg * 255).astype(np.uint8), "RGBA").filter(ImageFilter.GaussianBlur(1.2)).save(f"{OUT}/tail_glow.png", optimize=True)
print("spirit fx textures ok")
