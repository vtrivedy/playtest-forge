#!/usr/bin/env python3
"""Reject even one near-black decoded video frame; retain a JSON evidence report.

python3 tools/check-black-frames.py clip.webm --out clip-blackcheck.json
Requires ffmpeg on PATH, --ffmpeg PATH, or optional imageio-ffmpeg installation.
Uses decoded pixels rather than container timestamps or blackdetect's duration
rounding so a single-frame flash cannot be hidden by a minimum-duration filter.
"""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
from pathlib import Path


def scan(video, ffmpeg, mean_limit=12, pixel_limit=16, fraction=0.98):
    # showinfo supplies each decoded frame's actual PTS, including VFR recordings.
    proc = subprocess.run([
        ffmpeg, '-hide_banner', '-i', str(video), '-map', '0:v:0', '-an',
        '-vf', 'scale=32:18:flags=area,format=gray,showinfo', '-fps_mode', 'passthrough',
        '-f', 'rawvideo', '-pix_fmt', 'gray', 'pipe:1',
    ], capture_output=True, check=True)
    frame_bytes = 32 * 18
    if len(proc.stdout) % frame_bytes:
        raise ValueError('Incomplete raw frame returned by decoder')
    times = [float(t) for t in re.findall(rb'\bn:\s*\d+\s+pts:\s*-?\d+\s+pts_time:([-+\d.eE]+)', proc.stderr)]
    count = len(proc.stdout) // frame_bytes
    if not count or len(times) != count:
        raise ValueError(f'Decoder returned {count} frames but {len(times)} timestamps')
    dark = []
    minimum = 255.0
    for index in range(count):
        data = proc.stdout[index * frame_bytes:(index + 1) * frame_bytes]
        mean = sum(data) / frame_bytes
        minimum = min(minimum, mean)
        black_fraction = sum(v <= pixel_limit for v in data) / frame_bytes
        if mean <= mean_limit and black_fraction >= fraction:
            dark.append({'frame': index, 'seconds': times[index], 'meanLuma': round(mean, 3),
                         'darkFraction': round(black_fraction, 4)})
    return {'video': str(video.resolve()), 'sha256': hashlib.file_digest(video.open('rb'), 'sha256').hexdigest(),
            'decodedFrames': count, 'firstPts': times[0], 'lastPts': times[-1],
            'minimumMeanLuma': round(minimum, 3), 'thresholds': {'meanLuma': mean_limit,
            'pixelLuma': pixel_limit, 'fraction': fraction}, 'darkFrameCount': len(dark),
            'darkFrames': dark, 'pass': not dark}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('video', type=Path)
    parser.add_argument('--out', type=Path)
    parser.add_argument('--ffmpeg', default=shutil.which('ffmpeg'))
    args = parser.parse_args()
    if not args.ffmpeg:
        try:
            import imageio_ffmpeg
            args.ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
        except ImportError:
            parser.error('ffmpeg missing: provide --ffmpeg or install imageio-ffmpeg')
    report = scan(args.video, args.ffmpeg)
    output = json.dumps(report, indent=2) + '\n'
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        temporary = args.out.with_suffix(args.out.suffix + '.tmp')
        temporary.write_text(output)
        temporary.replace(args.out)
    print(output, end='')
    raise SystemExit(0 if report['pass'] else 1)


if __name__ == '__main__':
    main()
