#!/usr/bin/env python3
"""Measure decoded delivery audio; no normalization and no artistic pass/fail."""
import argparse
import array
import csv
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys


def db(value):
    return 20 * math.log10(value) if value > 0 else None


def levels(values):
    peak = max((abs(x) for x in values), default=0)
    rms = math.sqrt(sum(x * x for x in values) / len(values)) if values else 0
    return peak, rms


def audio_state(state):
    if not isinstance(state, dict):
        return None
    if isinstance(state.get('audio'), dict) and 'counts' in state['audio']:
        return state['audio']
    for child in state.values():
        found = audio_state(child)
        if found is not None:
            return found
    return None


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('input', type=Path)
    p.add_argument('--out', type=Path, required=True)
    p.add_argument('--evidence', type=Path)
    p.add_argument('--ffmpeg', default=os.environ.get('FFMPEG') or shutil.which('ffmpeg'))
    args = p.parse_args()
    if not args.ffmpeg:
        try:
            import imageio_ffmpeg
            args.ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
        except ImportError:
            p.error('Provide --ffmpeg, install ffmpeg, or install imageio-ffmpeg')
    args.out.mkdir(parents=True, exist_ok=True)
    base = [args.ffmpeg, '-hide_banner', '-nostdin', '-i', str(args.input), '-map', '0:a:0', '-vn']
    decode = base + ['-ac', '2', '-ar', '48000', '-c:a', 'pcm_f32le', '-f', 'f32le', 'pipe:1']
    raw = subprocess.run(decode, check=True, capture_output=True).stdout
    pcm = array.array('f')
    pcm.frombytes(raw)
    if sys.byteorder != 'little':
        pcm.byteswap()
    if not pcm or len(pcm) % 2 or any(not math.isfinite(x) for x in pcm):
        raise ValueError('Empty, incomplete, or non-finite PCM')
    frames = len(pcm) // 2
    duration = frames / 48000
    rows = []
    for start in range(0, frames, 2400):
        end = min(frames, start + 2400)
        block = pcm[2 * start:2 * end]
        peak, rms = levels(block)
        lp, lr = levels(block[::2])
        rp, rr = levels(block[1::2])
        rows.append(dict(start_s=start / 48000, end_s=end / 48000,
                         peak_dbfs=db(peak), rms_dbfs=db(rms),
                         crest_db=db(peak / rms) if rms else None,
                         left_peak_dbfs=db(lp), left_rms_dbfs=db(lr),
                         right_peak_dbfs=db(rp), right_rms_dbfs=db(rr)))
    peak, rms = levels(pcm)
    # Non-silent threshold is a reporting convention, not a perceptual audibility claim.
    active = [r for r in rows if r['rms_dbfs'] is not None and r['rms_dbfs'] > -60]
    crest = sorted(r['crest_db'] for r in active)
    loudness_command = base + ['-af', 'ebur128=peak=true', '-f', 'null', '-']
    loudness = subprocess.run(loudness_command, check=True, capture_output=True, text=True).stderr
    (args.out / 'loudness.txt').write_text(loudness)
    summary_text = loudness.rsplit('Summary:', 1)[-1]
    def metric(pattern):
        match = re.search(pattern, summary_text)
        if not match:
            return None
        value = float(match.group(1))
        return value if math.isfinite(value) else None
    report = dict(input=str(args.input.resolve()), sha256=hashlib.sha256(args.input.read_bytes()).hexdigest(),
                  ffmpeg_version=subprocess.run([args.ffmpeg, '-version'], capture_output=True, text=True, check=True).stdout.splitlines()[0],
                  decode_command=decode, loudness_command=loudness_command,
                  label='Decoded delivery; exact contiguous 50 ms PCM windows. RMS is not LUFS.',
                  sample_rate=48000, channels=2, frames=frames, duration_s=duration, windows=len(rows),
                  sample_peak_dbfs=db(peak), program_rms_dbfs=db(rms),
                  program_crest_db=db(peak / rms) if rms else None,
                  active_threshold_rms_dbfs=-60, active_windows=len(active),
                  active_window_crest_median_db=crest[len(crest)//2] if crest else None,
                  below_minus60_seconds=sum(r['end_s']-r['start_s'] for r in rows if r['rms_dbfs'] is None or r['rms_dbfs'] <= -60),
                  digital_silence=peak == 0,
                  integrated_lufs=metric(r'I:\s+(-?[\d.]+|-inf) LUFS') if peak else None,
                  loudness_range_lu=metric(r'LRA:\s+([\d.]+) LU'),
                  true_peak_dbtp=metric(r'Peak:\s+(-?[\d.]+|-inf) dBFS'),
                  event_rates=None)
    if args.evidence:
        evidence = json.loads(args.evidence.read_text())
        before, after = audio_state(evidence.get('before')), audio_state(evidence.get('after'))
        if before is not None and after is not None:
            deltas = {k: after['counts'].get(k, 0)-before['counts'].get(k, 0)
                      for k in set(before['counts']) | set(after['counts'])}
            if any(v < 0 for v in deltas.values()):
                raise ValueError('Audio counters reset; cannot derive event rates')
            report['event_rates'] = dict(label='Instrumented sample starts only; excludes uncounted synths/loops. Counter interval may differ from recording.',
                                        counts=deltas, per_minute={k: v * 60 / duration for k, v in deltas.items()})
    with (args.out / 'meter-50ms.csv').open('w') as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    (args.out / 'meter-50ms.json').write_text(json.dumps(rows, indent=2, allow_nan=False))
    (args.out / 'summary.json').write_text(json.dumps(report, indent=2, allow_nan=False))
    print(json.dumps(report, indent=2, allow_nan=False))


if __name__ == '__main__':
    main()
