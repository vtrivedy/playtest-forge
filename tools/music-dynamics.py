#!/usr/bin/env python3
"""Loudness dynamics of a music render: integrated LUFS, EBU R128 loudness range (LRA), and how far the sung
moments (swells) stand above the bed. Needs numpy + pyloudnorm (pip install pyloudnorm).

  python3 tools/music-dynamics.py hearthsong.wav [--marks marks.json]

LRA: short-term loudness (3 s window, 0.1 s hop, K-weighted), absolute gate -70 LUFS, relative gate -20 LU,
LRA = 95th - 10th percentile (EBU Tech 3342). Moment lift: mean short-term loudness while the conductor reports
`singing` minus the mean while idle (from the render's trace.json, if present beside the wav: tools/hearthsong-render.mjs).
"""
import argparse, json, math, os, sys, wave
import numpy as np
import pyloudnorm as pyln


def read(path):
    with wave.open(path) as w:
        sr, ch, n = w.getframerate(), w.getnchannels(), w.getnframes()
        x = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float64) / 32768
    return sr, x.reshape(-1, ch)


def short_term(sr, x, win=3.0, hop=0.1):
    meter = pyln.Meter(sr)
    # K-weight once, then mean-square per window (equivalent to the meter on each window, much faster)
    y = x.copy()
    for f in meter._filters.values():
        y = f.apply_filter(y)
    ms = (y ** 2).sum(axis=1)
    c = np.concatenate([[0], np.cumsum(ms)])
    w, h = int(win * sr), int(hop * sr)
    t, L = [], []
    for s in range(0, len(ms) - w, h):
        m = (c[s + w] - c[s]) / w
        t.append((s + w / 2) / sr)
        L.append(-0.691 + 10 * math.log10(m) if m > 0 else -120)
    return np.array(t), np.array(L)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('wav')
    ap.add_argument('--trace', default=None)
    a = ap.parse_args()
    sr, x = read(a.wav)
    meter = pyln.Meter(sr)
    integ = meter.integrated_loudness(x)
    t, L = short_term(sr, x)
    g = L[L > -70]
    g = g[g > (10 * math.log10(np.mean(10 ** (g / 10))) - 20)] if len(g) else g
    lra = float(np.percentile(g, 95) - np.percentile(g, 10)) if len(g) else 0.0
    peak = float(np.abs(x).max())
    out = {'seconds': round(len(x) / sr, 1), 'lufs': round(integ, 2), 'lra': round(lra, 2),
           'st_p10': round(float(np.percentile(g, 10)), 2), 'st_p95': round(float(np.percentile(g, 95)), 2),
           'peak_dbfs': round(20 * math.log10(peak), 2) if peak > 0 else None}
    tr = a.trace or os.path.join(os.path.dirname(a.wav), 'trace.json')
    if os.path.exists(tr):
        trace = json.load(open(tr))
        # trace rows: one conductor report per bar line (render.ts): [bar, breath, swell, pass, since, ...];
        # swell 2 = singing, 0 = idle. Bars are evenly spaced to within the rubato, so time ≈ index × mean bar.
        rows = [r for r in trace if isinstance(r, list) and len(r) > 3]
        if rows:
            bar_s = (len(x) / sr) / len(rows)
            def state_at(tt):
                return rows[min(len(rows) - 1, int(tt / bar_s))][2]
            st = np.array([state_at(tt) for tt in t])
            sing, idle = L[(st == 2) & (L > -70)], L[(st == 0) & (L > -70)]
            if len(sing) and len(idle):
                out['sing_mean'] = round(float(sing.mean()), 2)
                out['idle_mean'] = round(float(idle.mean()), 2)
                out['moment_lift_lu'] = round(float(sing.mean() - idle.mean()), 2)
                out['sing_peak_st'] = round(float(sing.max()), 2)
    print(json.dumps(out))


if __name__ == '__main__':
    main()
