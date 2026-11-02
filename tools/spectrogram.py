#!/usr/bin/env python3
"""A spectrogram you can look at: log-frequency (50 Hz–16 kHz), dB colour, with a loudness lane underneath and
optional event marks. For reviewing a capture by eye (brightness, transients, density, repetition).
  python3 tools/spectrogram.py <audio> <out.png> [--marks evidence.json] [--from s] [--to s]
"""
import json, math, subprocess, sys
import numpy as np
import imageio_ffmpeg
from PIL import Image, ImageDraw

SR = 32000
args = sys.argv[1:]
src, out = args[0], args[1]
opt = lambda k, d=None: args[args.index(k) + 1] if k in args else d
ff = imageio_ffmpeg.get_ffmpeg_exe()
cmd = [ff, '-v', 'error']
if opt('--from'): cmd += ['-ss', opt('--from')]
if opt('--to'): cmd += ['-to', opt('--to')]
raw = subprocess.run(cmd + ['-i', src, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
x = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
N, HOP = 2048, 320  # 10 ms hop
frames = max(1, (len(x) - N) // HOP)
win = np.hanning(N)
S = np.stack([np.abs(np.fft.rfft(x[i * HOP:i * HOP + N] * win)) for i in range(frames)], axis=1)
f = np.fft.rfftfreq(N, 1 / SR)
H = 256
edges = np.geomspace(50, 16000, H + 1)
rows = np.zeros((H, frames))
for r in range(H):
    m = (f >= edges[r]) & (f < edges[r + 1])
    rows[r] = S[m].max(axis=0) if m.any() else S[np.argmin(abs(f - edges[r]))]
db = 20 * np.log10(rows / (N / 4) + 1e-9)
v = np.clip((db + 90) / 90, 0, 1)[::-1]
# colour: dark → amber → white
img = np.stack([np.clip(v * 2.2, 0, 1), np.clip(v * 1.6 - 0.3, 0, 1), np.clip(v * 2 - 1.2, 0, 1)], axis=-1)
W = frames
lane = 80
canvas = Image.new('RGB', (W + 60, H + lane + 20), (16, 12, 10))
canvas.paste(Image.fromarray((img * 255).astype(np.uint8)), (60, 0))
d = ImageDraw.Draw(canvas)
for hz in (100, 250, 500, 1000, 2000, 4000, 8000):
    yy = int(H - (math.log(hz / 50) / math.log(16000 / 50)) * H)
    d.line([(55, yy), (60, yy)], fill=(200, 200, 200))
    d.text((2, yy - 6), f'{hz if hz < 1000 else str(hz // 1000) + "k"}', fill=(200, 200, 200))
# loudness lane: 50 ms peak (grey) and RMS (amber), −60..0 dBFS
w50 = int(0.05 * SR)
for i in range(0, len(x) - w50, w50):
    seg = x[i:i + w50]
    pk = 20 * math.log10(max(1e-9, float(np.max(np.abs(seg)))))
    rm = 20 * math.log10(max(1e-9, float(np.sqrt(np.mean(seg * seg)))))
    col = 60 + int(i / HOP)
    for val, c in ((pk, (150, 150, 150)), (rm, (255, 170, 60))):
        yy = H + lane - int(max(0, val + 60) / 60 * lane)
        d.line([(col, H + lane), (col, yy)], fill=c)
for dbv in (-12, -24, -36, -48):
    yy = H + lane - int((dbv + 60) / 60 * lane)
    d.text((2, yy - 6), str(dbv), fill=(200, 200, 200))
for s in range(0, int(len(x) / SR) + 1, 5):
    d.text((60 + s * 100, H + lane + 4), f'{s}s', fill=(200, 200, 200))
if opt('--marks'):
    off = float(opt('--from', 0))
    for m in json.load(open(opt('--marks'))).get('marks', []):
        col = 60 + int((m['t'] - off) * 100)
        d.line([(col, 0), (col, H)], fill=(90, 200, 255))
        d.text((col + 2, 2), m['what'][:18], fill=(90, 200, 255))
canvas.save(out)
print(out, f'{len(x) / SR:.1f}s')
