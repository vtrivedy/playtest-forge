"""Place the unchanged source crop beside every Blender view."""
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw
ROOT=Path(__file__).resolve().parents[2]
PREV=ROOT/'assets/previews/review'
ref=Image.open(ROOT/'assets/hero/candidates/sol/concept_crop.png').convert('RGB')
import sys
model=sys.argv[1] if len(sys.argv)>1 else 'trellis'
for view in ['front','side','3q','back']:
    render=Image.open(PREV/f'hero_sol_{model}_{view}_render.png').convert('RGB')
    sheet=Image.new('RGB',(1240,850),(37,32,28)); draw=ImageDraw.Draw(sheet)
    crop=ImageOps.contain(ref,(410,750))
    sheet.paste(crop,((430-crop.width)//2,60+(750-crop.height)//2))
    sheet.paste(render,(440,45))
    draw.text((20,18),'LOCKED CONCEPT | standing three-quarter crop',fill=(239,221,185))
    draw.text((460,18),f'SOL / {model.upper()} seed 42 / {view.upper()} / unrigged candidate',fill=(239,221,185))
    sheet.save(PREV/f'hero_sol_{model}_{view}.png')
