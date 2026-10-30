"""Compose a fox review sheet: Blender concept-plane renders (fox_review.py) for two labels + in-game GPU
stills (gpu-capture.mjs --shots fox) for two capture dirs.

python3 fox_review_sheet.py <render_dir> <labelA> <labelB> <captureA> <captureB> <out.png> [title]
"""
import sys
from PIL import Image, ImageDraw

rdir, la, lb, ca, cb, out = sys.argv[1:7]
title = sys.argv[7] if len(sys.argv) > 7 else ""
BG, FG = (28, 24, 20), (236, 214, 180)
VIEWS = ["side", "three_q", "front", "back"]
GAME = ["fox-restored-three_q", "fox-restored-side", "fox-restored-face", "fox-sepia-chase-run", "fox-restored-chase-idle"]
CW = 3000


def label(im, txt):
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, 10 + 7 * len(txt), 18), fill=BG)
    d.text((5, 3), txt, fill=FG)
    return im


def row(images, h):
    ims = [i.resize((int(i.width * h / i.height), h)) for i in images]
    r = Image.new("RGB", (sum(i.width for i in ims) + 8 * (len(ims) - 1), h), BG)
    x = 0
    for i in ims:
        r.paste(i, (x, 0)); x += i.width + 8
    return r


rows = []
for lab in (la, lb):
    ims = [label(Image.open(f"{rdir}/{lab}_{v}.png").convert("RGB"), f"{lab} {v} (left: concept plane)") for v in VIEWS]
    rows.append(row(ims, 360))
for cap, lab in ((ca, la), (cb, lb)):
    ims = [label(Image.open(f"{cap}/{g}.png").convert("RGB").resize((640, 360)), f"{lab} in-game {g[4:]}") for g in GAME]
    rows.append(row(ims, 360))
W = max(r.width for r in rows)
sheet = Image.new("RGB", (W, sum(r.height + 10 for r in rows) + 30), BG)
y = 30
ImageDraw.Draw(sheet).text((8, 8), title, fill=FG)
for r in rows:
    sheet.paste(r, (0, y)); y += r.height + 10
if sheet.width > CW:
    sheet = sheet.resize((CW, int(sheet.height * CW / sheet.width)))
sheet.save(out)
print("SHEET", out, sheet.size)
