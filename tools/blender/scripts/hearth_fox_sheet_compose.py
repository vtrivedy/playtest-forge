"""Compose hearth_fox_sheet.py frames into one PNG per clip: rows = views, columns = frames.

python3 hearth_fox_sheet_compose.py <dir> <out.png>
"""
import sys, glob, os, re
from PIL import Image, ImageDraw

d, out = sys.argv[1:3]
rows = {}
for p in sorted(glob.glob(f"{d}/*_*_*.png")):
    m = re.match(r"(.+)_(side|q)_(\d+)\.png$", os.path.basename(p))
    if m:
        rows.setdefault((m[1], m[2]), []).append((int(m[3]), p))
W, H = 240, 180
ncol = max(len(v) for v in rows.values())
sheet = Image.new("RGB", (W * ncol, H * len(rows)), (28, 24, 20))
dr = ImageDraw.Draw(sheet)
for r, ((clip, view), fr) in enumerate(sorted(rows.items())):
    for c, (f, p) in enumerate(fr):
        sheet.paste(Image.open(p).convert("RGB").resize((W, H)), (c * W, r * H))
        dr.text((c * W + 4, r * H + 4), f"{clip} {view} f{f}", fill=(255, 230, 190))
sheet.save(out)
print(out, sheet.size)
