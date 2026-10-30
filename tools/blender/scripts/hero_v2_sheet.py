"""Compose concept-crop (top) vs render (bottom) review sheet.
python3 hero_v2_sheet.py out.png prefix [suffix] [label]
Columns: front | side | three_q | back (concept crops from fox-turnaround.jpg)."""
import sys
from PIL import Image, ImageDraw
import os
CONCEPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../../assets/concept/fox-turnaround.jpg")
CROPS = {"front": (40, 20, 260, 400), "side": (260, 20, 700, 400),
         "three_q": (680, 20, 1010, 400), "back": (1000, 20, 1270, 400),
         "run": (30, 430, 400, 660), "dash": (420, 420, 900, 660), "trot": (930, 430, 1260, 660)}
out, prefix = sys.argv[1], sys.argv[2]
suffix = sys.argv[3] if len(sys.argv) > 3 else ""
label = sys.argv[4] if len(sys.argv) > 4 else ""
views = sys.argv[5].split(",") if len(sys.argv) > 5 else ["front", "side", "three_q", "back"]
crops = sys.argv[6].split(",") if len(sys.argv) > 6 else views
cimg = Image.open(CONCEPT).convert("RGB")
W, H = 400, 300
sheet = Image.new("RGB", (W * len(views), H * 2 + 24), (30, 26, 22))
for i, (v, cv) in enumerate(zip(views, crops)):
    c = cimg.crop(CROPS[cv]); c.thumbnail((W, H))
    sheet.paste(c, (i * W + (W - c.width) // 2, (H - c.height) // 2))
    r = Image.open(f"{prefix}_{v}{suffix}.png").convert("RGB"); r.thumbnail((W, H))
    sheet.paste(r, (i * W + (W - r.width) // 2, H + (H - r.height) // 2))
ImageDraw.Draw(sheet).text((8, H * 2 + 6), label or out, fill=(230, 210, 180))
sheet.save(out); print("sheet", out)
