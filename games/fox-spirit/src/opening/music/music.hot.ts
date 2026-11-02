/**
 * Per-frame side of Hearthsong (hot: no allocation). Blends the place colours (score.ts PLACES) by where the fox
 * is, gates layers on how much colour is back, and eases the worklet's params toward it.
 */
import { PLACES, WILD, themeOf } from './score';

// cold:begin (module constants)
const KEYS = ['harp', 'pad', 'bass', 'lead', 'bells', 'bright', 'shade'] as const;
/** how long the music takes to lean into a place (s, time constant) */
const LEAN = 1.6;
// cold:end

/** 0 → 1 smoothly as v goes a → b */
function ramp(v: number, a: number, b: number): number {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export type MusicDriver = ReturnType<typeof createMusicDriver>;

export function createMusicDriver(ac: BaseAudioContext, node: AudioWorkletNode) {
  // cold:begin (construction only)
  const params: AudioParam[] = KEYS.map((k) => node.parameters.get(k)!);
  const cueParam = node.parameters.get('cue')!;
  const kindParam = node.parameters.get('kind')!;
  const level = node.parameters.get('level')!;
  const themeParam = node.parameters.get('theme')!;
  const placeTheme = Int8Array.from(PLACES.map((p) => themeOf(p.id)));
  let theme = -1;
  const mix = new Float32Array(KEYS.length);
  const wild = new Float32Array(KEYS.map((k) => WILD[k]));
  const place = PLACES.map((p) => new Float32Array(KEYS.map((k) => p.c[k])));
  let started = false;
  /** the finale's first snow: 0 → 1, thins the song to pad, ocarina and bells */
  let snow = 0;
  let lifted = false;
  /** where the fox was and how long it has stood there (s): a resting fox lets the song thin out */
  let lastX = NaN;
  let lastZ = NaN;
  let still = 0;
  let lastT = -1;
  let lastSet = -1;
  // cold:end

  /** `now` defaults to the context clock; offline renders pass their own schedule time */
  function update(x: number, z: number, restored: number, now = ac.currentTime, glide = 0): void {
    if (!started) {
      started = true;
      level.setValueAtTime(0, now);
      level.setTargetAtTime(1, now, 2);
    }
    // ~10 Hz is plenty for a 1.6 s lean
    if (now - lastSet < 0.1) return;
    lastSet = now;
    const moved = Math.hypot(x - lastX, z - lastZ);
    still = moved > 0.3 || lastT < 0 ? 0 : still + (now - lastT);
    if (moved > 0.3 || Number.isNaN(lastX)) {
      lastX = x;
      lastZ = z;
    }
    lastT = now;
    // weights: 1 inside r, smooth to 0 at 2r; the wild meadow fills whatever is left
    let total = 0;
    let lead = -1;
    let leadW = 0.5;
    for (let k = 0; k < KEYS.length; k++) mix[k] = 0;
    for (let i = 0; i < PLACES.length; i++) {
      const p = PLACES[i]!;
      const d = Math.hypot(x - p.x, z - p.z);
      const t = Math.min(1, Math.max(0, (2 * p.r - d) / p.r));
      const w = t * t * (3 - 2 * t);
      if (w <= 0) continue;
      if (w > leadW) { leadW = w; lead = i; }
      total += w;
      const c = place[i]!;
      for (let k = 0; k < KEYS.length; k++) mix[k]! += c[k]! * w;
    }
    // a place with its own tune asks for it (taken at the next pass start, never mid-tune)
    const th = lead >= 0 ? placeTheme[lead]! : -1;
    if (th !== theme) {
      theme = th;
      themeParam.setValueAtTime(th, now);
    }
    const rest = Math.max(0, 1 - total);
    const norm = Math.max(1, total);
    for (let k = 0; k < KEYS.length; k++) mix[k] = (mix[k]! + wild[k]! * rest) / norm;
    // the story: a sepia world is a soft harp and pad; colour brings the bass, then the lead, and the light
    mix[0] = mix[0]! * (0.6 + 0.4 * ramp(restored, 0, 0.35));
    mix[1] = mix[1]! * (0.65 + 0.35 * ramp(restored, 0.02, 0.3));
    mix[2] = mix[2]! * ramp(restored, 0.15, 0.5);
    mix[3] = mix[3]! * ramp(restored, 0.15, 0.5);
    mix[5] = mix[5]! * (0.6 + 0.4 * ramp(restored, 0, 0.6));
    if (snow > 0) {
      mix[0] = mix[0]! * (1 - 0.6 * snow);
      mix[2] = mix[2]! * (1 - snow);
      mix[4] = Math.max(mix[4]!, 0.7 * snow);
      mix[5] = mix[5]! + (0.85 - mix[5]!) * snow;
      mix[6] = mix[6]! * (1 - snow);
    }
    // gliding lifts the song (A Short Hike's strings join flying): bells shimmer in, the light opens, quickly
    if (glide > 0) {
      mix[4] = Math.max(mix[4]!, 0.55);
      mix[5] = Math.min(1, mix[5]! + 0.25);
    }
    // standing still a while: the harp thins and the lead rests, so an idle game is quiet, not a loop playing at you
    const idle = ramp(still, 20, 40);
    mix[0] = mix[0]! * (1 - 0.55 * idle);
    mix[3] = mix[3]! * (1 - 0.8 * idle);
    mix[2] = mix[2]! * (1 - 0.5 * idle);
    const tc = glide > 0 || lifted ? 0.5 : LEAN;
    lifted = glide > 0;
    for (let k = 0; k < KEYS.length; k++) params[k]!.setTargetAtTime(mix[k]!, now, tc);
  }

  // cold:begin (built once)
  return {
    update,
    /** kind: 0 a moment, 1 a finale moment (sings inside the gap), 3 the end (coda, then rest) */
    cue(n: number, kind = 0, at = ac.currentTime): void {
      kindParam.setValueAtTime(kind, at);
      cueParam.setValueAtTime(n, at);
    },
    snow(): void {
      snow = 1;
    },
    levels: () => Object.fromEntries(KEYS.map((k, i) => [k, +mix[i]!.toFixed(2)])),
  };
  // cold:end
}
