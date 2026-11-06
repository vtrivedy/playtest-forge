"""Pair every still in a folder with the world's bible frame (left: bible, right: game) -> <folder>/pairs.png."""
import sys, pathlib
from PIL import Image
d = pathlib.Path(sys.argv[1]); bible = Image.open(sys.argv[2]).convert('RGB').resize((480, 270))
shots = sorted(p for p in d.glob('*.png') if p.name != 'pairs.png')
sheet = Image.new('RGB', (960, 270 * len(shots)), 'white')
for i, p in enumerate(shots):
    sheet.paste(bible, (0, 270 * i)); sheet.paste(Image.open(p).convert('RGB').resize((480, 270)), (480, 270 * i))
sheet.save(d / 'pairs.png'); print(d / 'pairs.png')
