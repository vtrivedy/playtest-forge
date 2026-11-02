#!/usr/bin/env python3
"""Offline level/brightness check of the opening's creature/homecoming/ruin/canopy SFX (DESIGN-audio-moss.md).

Each event is measured exactly as played into the sfx bus (sample x gain, resampled by playback rate, x MIX.sfx),
before 3D distance attenuation (so this is the loudest it can be, at 3 m). Reported per event: peak and RMS (dBFS,
RMS over the active part), crest (dB), spectral centroid (Hz, the 'brightness'), duration. The music bed is
measured the same way (x MIX.music) for comparison. Analysis only; it is not a listening verdict.
  python3 tools/sfx-analyze.py [--json out.json]
"""
import json, math, subprocess, sys
import numpy as np
import imageio_ffmpeg

SFX = 'games/fox-spirit/src/opening/sfx/'
MIX_SFX, MIX_MUSIC = 0.9, 0.75
SR = 44100
# event: (sample, gain, rate) as in the code
EVENTS = {
    'creature pop (paper)': ('soft-paper', 0.22, 0.8),
    'heron wingbeat (x3 max)': ('soft-wing', 0.2, 0.7),
    'canopy leaf touch (entry)': ('soft-leaf', 0.12, 0.8),
    'canopy leaf touch (roost)': ('soft-leaf', 0.12, 0.95),
    'ruin fold unfold': ('soft-unfold', 0.3, 0.7),
    'page pinned': ('soft-pin', 0.06, 0.85),
}
# synth voices: (label, [(Hz, amp)], attack s, decay s, low-pass Hz) as in the code
SYNTH = {
    'creature pop note (heron 392 Hz)': ([(392, 0.03)], 0.12, 1.65, 1400),
    'lantern bell (1st)': ([(392, 0.028), (784, 0.006)], 0.04, 2.56, 1600),
    'lantern bell (5th)': ([(653.3, 0.028), (1306.7, 0.006)], 0.04, 2.56, 1600),
    'well-fill swell (5 voices)': ([(130.8, 0.018), (196, 0.018), (261.6, 0.018), (329.6, 0.018), (392, 0.018)], 2.4, 4.1, 20000),
}


def decode(name):
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    raw = subprocess.run([ff, '-v', 'error', '-i', SFX + name + '.ogg', '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def at_rate(x, rate):
    n = int(len(x) / rate)
    return np.interp(np.arange(n) * rate, np.arange(len(x)), x)


def measure(x):
    peak = float(np.max(np.abs(x))) if len(x) else 0.0
    # active = 50 ms windows within 30 dB of the loudest window
    w = int(0.05 * SR)
    wins = [x[i:i + w] for i in range(0, max(1, len(x) - w + 1), w)] or [x]
    rms_w = np.array([math.sqrt(float(np.mean(v * v))) for v in wins])
    act = rms_w[rms_w > rms_w.max() * 10 ** (-30 / 20)]
    rms = float(math.sqrt(np.mean(act ** 2)))
    spec = np.abs(np.fft.rfft(x * np.hanning(len(x))))
    f = np.fft.rfftfreq(len(x), 1 / SR)
    centroid = float(np.sum(f * spec) / np.sum(spec))
    db = lambda v: round(20 * math.log10(v), 1) if v > 0 else None
    return {'peak_dBFS': db(peak), 'rms_dBFS': db(rms), 'crest_dB': round(db(peak) - db(rms), 1), 'centroid_Hz': round(centroid), 'secs': round(len(x) / SR, 2)}


def main():
    out = {}
    for ev, (name, gain, rate) in EVENTS.items():
        out[ev] = {'sample': name, 'gain': gain, 'rate': round(rate, 3), **measure(at_rate(decode(name), rate) * gain * MIX_SFX)}
    for ev, (parts, a, d, lp) in SYNTH.items():
        t = np.arange(int((a + d) * SR)) / SR
        env = np.where(t < a, t / a, np.exp(np.log(1e-4) * (t - a) / d))
        x = sum(amp * np.sin(2 * np.pi * hz * t) for hz, amp in parts if hz <= lp * 1.5) * env * MIX_SFX
        out[ev] = {'sample': 'synth', 'gain': None, 'rate': None, **measure(x)}
    m = decode('music-hush-hamlet') * MIX_MUSIC
    out['music bed (hush-hamlet, full)'] = {'sample': 'music-hush-hamlet', 'gain': MIX_MUSIC, 'rate': 1, **measure(m[: SR * 60])}
    w = max(len(k) for k in out)
    print(f"{'event':<{w}}  peak  rms  crest  centroid  secs")
    for k, v in out.items():
        print(f"{k:<{w}}  {v['peak_dBFS']:>5} {v['rms_dBFS']:>5} {v['crest_dB']:>5} {v['centroid_Hz']:>7} {v['secs']:>6}")
    if '--json' in sys.argv:
        json.dump(out, open(sys.argv[sys.argv.index('--json') + 1], 'w'), indent=2)


main()
