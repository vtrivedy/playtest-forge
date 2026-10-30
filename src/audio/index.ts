import { ambience, breath, cue, noiseBuffer, random } from './synthesis';
import type { Surface } from './surfaces';
export { surfaceOf } from './surfaces';
import type { Cue, VoiceOptions } from './synthesis';

export const audioSettings = { volume: 0.55, muted: false };
export type GameAudio = ReturnType<typeof createGameAudio>;
export function createGameAudio() {
  try {
    const saved = JSON.parse(localStorage.getItem('fox-audio') ?? 'null');
    if (saved && Number.isFinite(saved.volume)) audioSettings.volume = Math.max(0, Math.min(1, saved.volume));
    if (saved && typeof saved.muted === 'boolean') audioSettings.muted = saved.muted;
  } catch { /* Storage may be disabled. */ }
  let savedSettings = JSON.stringify(audioSettings);
  let ctx: AudioContext | undefined, master: GainNode, compressor: DynamicsCompressorNode;
  let noise: AudioBuffer, pressed: ReturnType<typeof ambience>, warm: ReturnType<typeof ambience>, glide: GainNode;
  let enabled = false, restored = 0, stepClock = 0, natureClock = 4, leafClock = 1;
  let fireClock = 0.5;
  let lastPickup = -10, streak = 0, shrineAt = -10, pendingShrine = false;
  const rng = random(901);
  let activeVoices: { until: number; cost: number }[] = [];
  const log: { cue: Cue; at: number; surface?: Surface }[] = [];
  const surfaceCounts = { leaf: 0, stone: 0, wood: 0 };
  const costs: Record<Cue, number> = { jump: 2, dash: 9, footstep: 2, land: 3, shrine: 26, ember: 3, bird: 2, cricket: 9, bridge: 3, checkpoint: 2, hazard: 1, respawn: 1, glide: 1, fire: 2 };
  function reserve(cost: number, duration: number) {
    if (!ctx) return false;
    activeVoices = activeVoices.filter(v => v.until > ctx!.currentTime);
    if (activeVoices.reduce((sum, v) => sum + v.cost, 0) + cost > 128) return false;
    activeVoices.push({ until: ctx.currentTime + duration, cost }); return true;
  }
  const counts: Partial<Record<Cue, number>> = {};
  let disposed = false, wasGliding = false;
  let queued: { name: Cue; opts: VoiceOptions } | undefined;
  let airFilter: BiquadFilterNode;
  let airSource: AudioBufferSourceNode | undefined;
  const visible = () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend();
    else if (enabled) void ctx.resume().catch(() => {});
  };
  const key = (e: KeyboardEvent) => {
    if (e.code === 'KeyM' && !e.repeat && !(e.target as HTMLElement)?.closest?.('input,textarea,[contenteditable]')) {
      audioSettings.muted = !audioSettings.muted;
      syncSettings();
    }
  };
  document.addEventListener('visibilitychange', visible);
  window.addEventListener('keydown', key);
  function syncSettings() {
    const serialized = JSON.stringify(audioSettings);
    if (serialized !== savedSettings) {
      savedSettings = serialized;
      try { localStorage.setItem('fox-audio', serialized); } catch { /* Storage may be disabled. */ }
    }
    if (!ctx) return;
    const volume = Number.isFinite(audioSettings.volume) ? Math.max(0, Math.min(1, audioSettings.volume)) : 0;
    master.gain.setTargetAtTime(audioSettings.muted ? 0 : volume, ctx.currentTime, 0.035);
  }
  function play(name: Cue, opts: VoiceOptions = {}) {
    if (disposed) return;
    if (!ctx || ctx.state !== 'running') { if (ctx && ctx.state !== 'closed' && !document.hidden) queued = { name, opts }; return; }
    const t = ctx.currentTime;
    if (name === 'shrine') { pendingShrine = true; return; }
    if (name === 'footstep' && stepClock > 0) return;
    if (!reserve(costs[name], name === 'bridge' ? 3.5 : 1.6)) return;
    if (name === 'ember') { streak = t - lastPickup < 1.5 ? Math.min(7, streak + 1) : 0; lastPickup = t; opts = { ...opts, streak }; }
    cue(ctx, master, noise, name, t, opts); counts[name] = (counts[name] ?? 0) + 1;
    log.push({ cue: name, at: t, surface: opts.surface }); if (log.length > 40) log.shift();
    if (name === 'footstep') surfaceCounts[opts.surface ?? 'leaf']++;
    if (name === 'footstep' || name === 'land') stepClock = 0.22;
  }
  function swell(duration = 4.5) {
    duration = Number.isFinite(duration) ? Math.max(1, Math.min(8, duration)) : 4.5;
    pendingShrine = false;
    if (!ctx || ctx.state !== 'running' || ctx.currentTime - shrineAt < 0.5) return;
    if (!reserve(costs.shrine, Math.max(1, Math.min(8, duration)) * 1.5 + 0.5)) return;
    shrineAt = ctx.currentTime;
    log.push({ cue: 'shrine', at: shrineAt }); if (log.length > 40) log.shift();
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
        air.connect(filter).connect(glide); air.start(); airFilter = filter;
        air.onended = () => { air.disconnect(); filter.disconnect(); };
        airSource = air;
      }
      await ctx.resume();
      if (queued) { const q = queued; queued = undefined; play(q.name, q.opts); }
    },
    play, swell,
    setAmbient(on: boolean) { enabled = on; },
    update(dt: number, moving: boolean, grounded: boolean, gliding: boolean, localRestore = 0, surface: Surface = 'leaf', speed = 6, dashing = false) {
      const step = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.1)) : 0;
      stepClock = Math.max(0, stepClock - step);
      restored += (Math.max(0, Math.min(1, localRestore)) - restored) * (1 - Math.exp(-step / 2));
      if (!ctx || ctx.state !== 'running') return;
      const t = ctx.currentTime;
      syncSettings();
      pressed.gain.setTargetAtTime(enabled ? Math.cos(restored * Math.PI / 2) : 0, t, 0.4);
      warm.gain.setTargetAtTime(enabled ? Math.sin(restored * Math.PI / 2) : 0, t, 0.4);
      const glideOn = gliding && !grounded;
      if (glideOn && !wasGliding) play('glide');
      wasGliding = glideOn;
      glide.gain.setTargetAtTime(glideOn ? 0.04 + Math.min(16, speed) * 0.004 : 0, t, 0.09);
      airFilter.frequency.setTargetAtTime(900 + Math.min(16, speed) * 85, t, 0.15);
      if (pendingShrine) swell();
      if (moving && grounded && !dashing && stepClock <= 0) {
        play('footstep', { surface }); stepClock = Math.max(0.16, 1.9 / Math.max(2, speed)) * (0.92 + rng() * 0.16);
      }
      if (enabled) {
        fireClock -= step;
        if (fireClock <= 0) { play('fire', { strength: Math.min(1, 0.2 + speed / 14) }); fireClock = 0.3 + rng() * 1.1; }
        leafClock -= step; natureClock -= step;
        if (leafClock <= 0) {
          if (restored > 0.02 && reserve(1, 2)) breath(ctx, master, noise, t, 0.8 + rng(), 2100, 0.018 * restored, 700, 0.25);
          leafClock = 2 + rng() * 4;
        }
        if (natureClock <= 0) { if (restored > 0.3) play(rng() > 0.5 ? 'bird' : 'cricket'); natureClock = 6 + rng() * 10; }
      }
    },
    debug() { return { state: ctx?.state ?? 'locked', masterGain: ctx ? master.gain.value : 0, pressedGain: ctx ? pressed.gain.value : 0, warmGain: ctx ? warm.gain.value : 0, glideGain: ctx ? glide.gain.value : 0, restored, enabled, ...audioSettings, counts: { ...counts }, voices: activeVoices.filter(v => v.until > (ctx?.currentTime ?? 0)).reduce((sum, v) => sum + v.cost, 0), surfaceCounts: { ...surfaceCounts }, log: [...log] }; },
    dispose() {
      disposed = true; document.removeEventListener('visibilitychange', visible); window.removeEventListener('keydown', key);
      if (ctx) { pressed.stop(); warm.stop(); airSource?.stop(); void ctx.close(); }
    },
  };
}
