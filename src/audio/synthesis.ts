/** Shared by the live graph and OfflineAudioContext review renderer. */
import type { Surface } from './surfaces';
export type Cue = 'jump' | 'dash' | 'footstep' | 'land' | 'shrine' | 'ember' | 'bird' | 'cricket' | 'bridge' | 'checkpoint' | 'hazard' | 'respawn' | 'glide';
export type VoiceOptions = { stone?: boolean; surface?: Surface; strength?: number; streak?: number; duration?: number };
export function random(seed = 173) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
}
export function noiseBuffer(ctx: BaseAudioContext, seconds = 4, seed = 173) {
  const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const a = b.getChannelData(0), rng = random(seed);
  // Seamless at endpoints after filtering; a long loop avoids a mechanical short repeat.
  for (let i = 0; i < a.length; i++) a[i] = rng() * 2 - 1;
  return b;
}
export function tone(ctx: BaseAudioContext, out: AudioNode, t: number, hz: number, duration: number, gain: number, endHz = hz, attack = 0.012) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(hz, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(15, endHz), t + duration);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + Math.min(attack, duration * 0.4));
  g.gain.exponentialRampToValueAtTime(0.00001, t + duration);
  o.connect(g).connect(out); o.start(t); o.stop(t + duration + 0.02);
  o.onended = () => { o.disconnect(); g.disconnect(); };
}
export function breath(ctx: BaseAudioContext, out: AudioNode, noise: AudioBuffer, t: number, duration: number, hz: number, gain: number, endHz = hz, attack = 0.015) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noise; s.loop = true; f.type = 'bandpass'; f.Q.value = 0.65;
  f.frequency.setValueAtTime(hz, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, endHz), t + duration);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + Math.min(attack, duration * 0.4));
  g.gain.exponentialRampToValueAtTime(0.00001, t + duration);
  s.connect(f).connect(g).connect(out); s.start(t, (t * 0.731) % 2); s.stop(t + duration + 0.02);
  s.onended = () => { s.disconnect(); f.disconnect(); g.disconnect(); };
}
export function cue(ctx: BaseAudioContext, out: AudioNode, noise: AudioBuffer, name: Cue, t: number, opts: VoiceOptions = {}) {
  const stone = opts.surface === 'stone' || opts.stone, wood = opts.surface === 'wood';
  const strength = Math.max(0.15, Math.min(1, opts.strength ?? 0.6));
  switch (name) {
    case 'footstep':
      breath(ctx, out, noise, t, stone ? 0.085 : 0.17, stone ? 1200 : 2600, stone ? 0.10 : 0.15, 650);
      tone(ctx, out, t, wood ? 290 : stone ? 210 : 115, wood ? 0.15 : 0.09, 0.065, wood ? 210 : 65); break;
    case 'land':
      tone(ctx, out, t, 105, 0.28, 0.18 * strength, 42);
      tone(ctx, out, t, 210, 0.20, 0.07 * strength, 125);
      breath(ctx, out, noise, t, 0.34, stone ? 1100 : 1800, 0.20 * strength, 260); break;
    case 'jump':
      breath(ctx, out, noise, t, 0.25, 400, 0.28, 1900);
      tone(ctx, out, t, 180, 0.15, 0.075, 270); break;
    case 'glide': breath(ctx, out, noise, t, 0.6, 700, 0.13, 1800, 0.06); break;
    case 'dash':
      breath(ctx, out, noise, t, 0.35, 700, 0.22, 2400);
      for (let i = 0; i < 7; i++) breath(ctx, out, noise, t + i * 0.035, 0.045, 1900 + i * 190, 0.11);
      break;
    case 'ember': {
      const hz = 261.63 * Math.pow(2, [0, 2, 4, 7, 9, 12, 14, 16][Math.min(7, opts.streak ?? 0)]! / 12);
      breath(ctx, out, noise, t, 0.06, 2900, 0.065);
      tone(ctx, out, t, hz, 0.65, 0.11, hz * 1.015);
      tone(ctx, out, t + 0.055, hz * 1.5, 0.85, 0.048); break;
    }
    case 'shrine': {
      const d = Math.max(1, Math.min(8, opts.duration ?? 4.5)), bloom = t + d * 0.38;
      breath(ctx, out, noise, t, d * 0.8, 70, 0.38, 400, d * 0.32);
      tone(ctx, out, t, 48, d, 0.16, 65, d * 0.32);
      tone(ctx, out, t, 144, d, 0.09, 195, d * 0.32);
      tone(ctx, out, t, 240, d * 0.8, 0.035, 325, d * 0.32);
      for (let i = 0; i < 18; i++) breath(ctx, out, noise, t + i * d * 0.035, 0.10, 1600 + (i % 5) * 350, 0.075);
      for (const [i, hz] of [130.81, 196, 293.66, 329.63].entries()) tone(ctx, out, bloom + i * 0.07, hz, d, 0.10 / (1 + i * 0.25), hz, 0.45);
      break;
    }
    case 'bridge':
      breath(ctx, out, noise, t, 2.5, 260, 0.19, 700, 0.6);
      tone(ctx, out, t, 185, 2.2, 0.10, 245, 0.5);
      tone(ctx, out, t + 0.8, 392, 2.4, 0.065, 392, 0.3); break;
    case 'checkpoint':
      tone(ctx, out, t, 196, 1.1, 0.075); tone(ctx, out, t + 0.12, 293.66, 1, 0.045); break;
    case 'hazard':
      breath(ctx, out, noise, t, 0.6, 1100, 0.16, 130, 0.04); break;
    case 'respawn':
      tone(ctx, out, t + 0.25, 196, 1, 0.07, 261.63, 0.18); break;
    case 'bird':
      tone(ctx, out, t, 1800, 0.22, 0.027, 2350, 0.035);
      tone(ctx, out, t + 0.3, 2100, 0.26, 0.019, 1650, 0.04); break;
    case 'cricket':
      for (let i = 0; i < 9; i++) tone(ctx, out, t + i * 0.033, 4300, 0.022, 0.018, 4200, 0.004); break;
  }
}
/** Continuous beds use independent, slowly breathing oscillators, never frame-rate noise. */
export function ambience(ctx: BaseAudioContext, out: AudioNode, noise: AudioBuffer, restored: boolean) {
  const bus = ctx.createGain(); bus.gain.value = 0; bus.connect(out);
  const nodes: AudioNode[] = [bus]; const sources: (OscillatorNode | AudioBufferSourceNode)[] = [];
  const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), wind = ctx.createGain();
  n.buffer = noise; n.loop = true; f.type = 'bandpass'; f.frequency.value = restored ? 560 : 1050; f.Q.value = 0.45;
  wind.gain.value = restored ? 0.09 : 0.055; n.connect(f).connect(wind).connect(bus); n.start(0, restored ? 3.17 : 0.43);
  nodes.push(n, f, wind); sources.push(n);
  const gust = ctx.createOscillator(), gustGain = ctx.createGain(), gustFilter = ctx.createGain();
  gust.frequency.value = restored ? 0.053 : 0.037; gustGain.gain.value = 0.023; gustFilter.gain.value = 180;
  gust.connect(gustGain).connect(wind.gain); gust.connect(gustFilter).connect(f.frequency); gust.start();
  sources.push(gust); nodes.push(gust, gustGain, gustFilter);
  for (const [i, hz] of (restored ? [130.81, 196, 293.66] : [65.405, 98.0]).entries()) {
    const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), depth = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = hz; o.detune.value = i * 2 - 2; g.gain.value = restored ? 0.026 : 0.018;
    lfo.frequency.value = 0.07 + i * 0.023; depth.gain.value = 0.007;
    lfo.connect(depth).connect(g.gain); o.connect(g).connect(bus); o.start(); lfo.start();
    sources.push(o, lfo); nodes.push(o, g, lfo, depth);
  }
  return { gain: bus.gain, stop() { for (const s of sources) s.stop(); for (const n of nodes) n.disconnect(); } };
}
