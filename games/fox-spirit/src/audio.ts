export type GameAudio = {
  resume: () => Promise<void>;
  play: (name: 'jump' | 'dash' | 'footstep' | 'shrine' | 'ember') => void;
  setAmbient: (on: boolean) => void;
  swell: (durationS?: number) => void;
  update: (dt: number, moving: boolean, grounded: boolean, gliding: boolean) => void;
};

export function createGameAudio(): GameAudio {
  const make = (path: string, volume: number, loop = false) => {
    const audio = new Audio(`/assets/audio/${path}.wav`);
    audio.preload = 'auto';
    audio.volume = volume;
    audio.loop = loop;
    return audio;
  };
  const files = { jump: 'jump', dash: 'dash', footstep: 'footstep', shrine: 'shrine_restore', ember: 'ember_pickup' };
  const volumes = { jump: 0.42, dash: 0.48, footstep: 0.18, shrine: 0.65, ember: 0.35 };
  type Sound = keyof typeof files;
  // Bounded voices allow overlapping pickups without allocating on every trigger.
  const voices = Object.fromEntries(Object.entries(files).map(([name, file]) =>
    [name, Array.from({ length: name === 'ember' ? 4 : 2 }, () => make(`sfx/${file}`, volumes[name as Sound]))],
  )) as Record<Sound, HTMLAudioElement[]>;
  const ambient = make('music/autumn_ambient_loop', 0, true);
  const glide = make('sfx/glide_whoosh', 0, true);
  let unlocked = false;
  let ambientOn = false;
  let glideOn = false;
  let stepCooldown = 0;
  let swellTime = 0;
  let swellDuration = 4;
  const start = (audio: HTMLAudioElement) => {
    if (unlocked && audio.paused && !audio.error) void audio.play().catch(() => { /* Missing assets and autoplay fail silently. */ });
  };
  const play = (name: Sound) => {
    if (!unlocked || (name === 'footstep' && stepCooldown > 0)) return;
    const pool = voices[name];
    const voice = pool.find(a => a.paused || a.ended) ?? pool[0]!;
    if (voice.error) return;
    voice.currentTime = 0;
    start(voice);
    if (name === 'footstep') stepCooldown = 0.32;
  };
  return {
    async resume() {
      unlocked = true;
      // Invoke playback within the caller's user gesture; callers may safely await this.
      const attempts: Promise<void>[] = [];
      if (ambientOn && !ambient.error) attempts.push(ambient.play().catch(() => {}));
      if (glideOn && !glide.error) attempts.push(glide.play().catch(() => {}));
      await Promise.all(attempts);
    },
    play,
    setAmbient(on) { ambientOn = on; if (on) start(ambient); },
    swell(durationS = 4) {
      swellDuration = Number.isFinite(durationS) ? Math.max(0.1, durationS) : 4;
      swellTime = swellDuration;
    },
    update(dt, moving, grounded, gliding) {
      const step = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.1)) : 0;
      stepCooldown = Math.max(0, stepCooldown - step);
      if (moving && grounded) play('footstep');
      swellTime = Math.max(0, swellTime - step);
      const swellGain = Math.sin(Math.PI * (1 - swellTime / swellDuration)) * 0.28;
      const blend = 1 - Math.exp(-4 * step);
      ambient.volume += ((ambientOn ? 0.24 + swellGain : 0) - ambient.volume) * blend;
      glideOn = gliding && !grounded;
      glide.volume += ((glideOn ? 0.12 : 0) - glide.volume) * blend;
      if (ambientOn) start(ambient);
      else if (ambient.volume < 0.001) ambient.pause();
      if (glideOn) start(glide);
      else if (glide.volume < 0.001) glide.pause();
    },
  };
}
