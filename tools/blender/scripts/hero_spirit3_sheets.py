"""Compose pass-3 review sheets (concept / Blender studio / in-game; in-game chase grid).
python3 hero_spirit3_sheets.py <studio_prefix> <ingame_dir> <out_dir>"""
import sys
from PIL import Image, ImageDraw
studio, ig, out = sys.argv[1:4]
import os
REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../.."))
concept = Image.open(f"{REPO}/assets/concept/fox-turnaround.jpg").convert("RGB")
CROPS = {"front": (40, 20, 260, 400), "side": (260, 20, 700, 400), "three_q": (680, 20, 1010, 400),
         "back": (1000, 20, 1270, 400), "dash": (420, 420, 900, 660)}
W, H = 400, 300
BG = (30, 26, 22)

def fit(im, w=W, h=H):
    im = im.copy(); im.thumbnail((w, h)); c = Image.new("RGB", (w, h), BG)
    c.paste(im, ((w - im.width) // 2, (h - im.height) // 2)); return c

def label(im, txt):
    d = ImageDraw.Draw(im); d.rectangle((0, 0, 8 + 6 * len(txt), 16), fill=BG); d.text((4, 2), txt, fill=(236, 214, 180)); return im

def crop_fox(path, box):
    return Image.open(path).convert("RGB").crop(box)

# --- vs concept: concept | Blender studio | in-game (same view family per column)
cols = [("front", "front", None), ("side", "side", ("side_run_1", None)), ("three_q", "three_q", ("sepia_near_3q", None)),
        ("back", "back", ("sepia_near_back", None)), ("dash", None, ("restored_near_back", None))]
rows = 3
sheet = Image.new("RGB", (W * len(cols), H * rows + 22), BG)
for i, (cv, sv, igv) in enumerate(cols):
    sheet.paste(label(fit(concept.crop(CROPS[cv])), f"concept {cv}"), (i * W, 0))
    if sv:
        sheet.paste(label(fit(Image.open(f"{studio}_{sv}.png").convert("RGB")), f"blender studio {sv}"), (i * W, H))
    if igv:
        im = Image.open(f"{ig}/{igv[0]}.png").convert("RGB")
        im = im.crop((240, 60, 1040, 660))
        sheet.paste(label(fit(im), f"in-game {igv[0]}"), (i * W, 2 * H))
ImageDraw.Draw(sheet).text((8, H * rows + 5), "spirit fox pass 3 vs concept - top: concept turnaround, mid: Blender studio (rest), bottom: in-engine Russetvale (sepia / restored grade)", fill=(230, 210, 180))
sheet.save(f"{out}/fox_spirit3_vs_concept.png"); print("wrote vs_concept")

# --- in-game chase frames
items = [("sepia_idle", "sepia chase idle"), ("sepia_run_1", "sepia chase run f1"), ("sepia_run_4", "sepia chase run f4"),
         ("side_run_0", "run side f0"), ("side_run_1", "run side f1"), ("side_run_3", "run side f3"),
         ("restored_idle", "restored chase idle"), ("restored_run_1", "restored chase run f1"), ("restored_run_3", "restored chase run f3"),
         ("sepia_near_back", "sepia near-chase back"), ("restored_near_back", "restored near-chase back"), ("restored_near_3q", "restored near 3/4")]
CW, CH = 640, 360
g = Image.new("RGB", (CW * 3, CH * 4 + 22), BG)
for k, (n, t) in enumerate(items):
    try: im = Image.open(f"{ig}/{n}.png").convert("RGB").resize((CW, CH))
    except FileNotFoundError: continue
    g.paste(label(im, t), ((k % 3) * CW, (k // 3) * CH))
ImageDraw.Draw(g).text((8, CH * 4 + 5), "spirit fox pass 3 in-game (SwiftShader, manual sim clock, real chase cam unless 'side'/'near'); run frames 4 sim-frames apart", fill=(230, 210, 180))
g.save(f"{out}/fox_spirit3_ingame.png"); print("wrote ingame")
