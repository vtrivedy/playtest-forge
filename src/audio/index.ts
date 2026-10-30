import { ambience, breath, cue, noiseBuffer, random } from './synthesis';
import type { Cue, VoiceOptions } from './synthesis';

export const audioSettings = { volume: 0.55, muted: false };
export type GameAudio = ReturnType<typeof createGameAudio>;
export function createGameAudio() {
  let ctx: AudioContext | undefined, master: GainNode, compressor: DynamicsCompressorNode;
  let noise: AudioBuffer, pressed: ReturnType<typeof ambience>, warm: ReturnType<typeof ambience>, glide: GainNode;
  let enabled = false, restored = 0, stepClock = 0, natureClock = 4, leafClock = 1;
  let lastPickup = -10, streak = 0, shrineAt = -10, pendingShrine = false;
  const rng = random(901), activeUntil: number[] = [];
  const counts: Partial<Record<Cue, number>> = {};
  let disposed = false;
  let airSource: AudioBufferSourceNode | undefined;
  const visible = () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend();
    else if (enabled) void ctx.resume().catch(() => {});
  };
  const key = (e: KeyboardEvent) => {
    if (e.code === 'KeyM' && !e.repeat && !(e.target as HTMLElement)?.closest('input,textarea,[contenteditable]')) {
      audioSettings.muted = !audioSettings.muted;
      syncSettings();
    }
  };
  document.addEventListener('visibilitychange', visible);
  window.addEventListener('keydown', key);
  function syncSettings() {
    if (!ctx) return;
    const volume = Number.isFinite(audioSettings.volume) ? Math.max(0, Math.min(1, audioSettings.volume)) : 0;
    master.gain.setTargetAtTime(audioSettings.muted ? 0 : volume, ctx.currentTime, 0.035);
  }
  function play(name: Cue, opts: VoiceOptions = {}) {
    if (!ctx || ctx.state !== 'running' || disposed) return;
    const t = ctx.currentTime;
    if (name === 'shrine') { pendingShrine = true; return; }
    if (name === 'footstep' && stepClock > 0) return;
    while (activeUntil.length && activeUntil[0]! < t) activeUntil.shift();
    if (activeUntil.length >= 24) return;
    if (name === 'ember') { streak = t - lastPickup < 1.5 ? Math.min(7, streak + 1) : 0; lastPickup = t; opts = { ...opts, streak }; }
    cue(ctx, master, noise, name, t, opts); counts[name] = (counts[name] ?? 0) + 1;
    activeUntil.push(t + 1.5); // conservative budget; synthesis cleans its nodes on end
    if (name === 'footstep') stepClock = 0.28;
  }
  function swell(duration = 4.5) {
    pendingShrine = false;
    if (!ctx || ctx.state !== 'running' || ctx.currentTime - shrineAt < 0.5) return;
    shrineAt = ctx.currentTime;
    cue(ctx, master, noise, 'shrine', shrineAt, { duration }); counts.shrine = (counts.shrine ?? 0) + 1;
  }
  return {
    settings: audioSettings,
    syncSettings,
    async resume() {
      if (disposed) return;
      if (!ctx) {
        ctx = new AudioContext(); master = ctx.createGain(); master.gain.value = 0;
        compressor = ctx.createDynamicsCompressor(); compressor.threshold.value = -18; compressor.knee.value = 12;
        compressor.ratio.value = 3; compressor.attack.value = 0.008; compressor.release.value = 0.25;
        master.connect(compressor).connect(ctx.destination);
        noise = noiseBuffer(ctx, 8);
        pressed = ambience(ctx, master, noise, false); warm = ambience(ctx, master, noise, true);
        glide = ctx.createGain(); glide.gain.value = 0; glide.connect(master);
        // Long-lived filtered air, independently faded from ambience.
        const air = ctx.createBufferSource(), filter = ctx.createBiquadFilter();
        air.buffer = noise; air.loop = true; filter.type = 'bandpass'; filter.frequency.value = 1500; filter.Q.value = 0.5;
        air.connect(filter).connect(glide); air.start();
        air.onended = () => { air.disconnect(); filter.disconnect(); };
        airSource = air;
      }
      await ctx.resume();
    },
    play, swell,
    setAmbient(on: boolean) { enabled = on; },
    update(dt: number, moving: boolean, grounded: boolean, gliding: boolean, localRestore = 0, stone = false, speed = 6) {
      const step = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.1)) : 0;
      stepClock = Math.max(0, stepClock - step);
      restored += (Math.max(0, Math.min(1, localRestore)) - restored) * (1 - Math.exp(-step / 2));
      if (!ctx || ctx.state !== 'running') return;
      const t = ctx.currentTime;
      syncSettings();
      pressed.gain.setTargetAtTime(enabled ? Math.cos(restored * Math.PI / 2) : 0, t, 0.4);
      warm.gain.setTargetAtTime(enabled ? Math.sin(restored * Math.PI / 2) : 0, t, 0.4);
      glide.gain.setTargetAtTime(gliding && !grounded ? 0.075 : 0, t, 0.09);
      if (pendingShrine) swell();
      if (moving && grounded && stepClock <= 0) {
        play('footstep', { stone }); stepClock = Math.max(0.16, 1.9 / Math.max(2, speed)) * (0.92 + rng() * 0.16);
      }
      if (enabled) {
        leafClock -= step; natureClock -= step;
        if (leafClock <= 0) {
          breath(ctx, master, noise, t, 0.8 + rng(), 2100, 0.018 * restored, 700, 0.25);
          leafClock = 2 + rng() * 4;
        }
        if (natureClock <= 0) { if (restored > 0.3) play(rng() > 0.5 ? 'bird' : 'cricket'); natureClock = 6 + rng() * 10; }
      }
    },
    debug() { return { state: ctx?.state ?? 'locked', masterGain: ctx ? master.gain.value : 0, glideGain: ctx ? glide.gain.value : 0, restored, enabled, ...audioSettings, counts: { ...counts }, voices: activeUntil.length }; },
    dispose() {
      disposed = true; document.removeEventListener('visibilitychange', visible); window.removeEventListener('keydown', key);
      if (ctx) { pressed.stop(); warm.stop(); airSource?.stop(); void ctx.close(); }
    },
  };
}
