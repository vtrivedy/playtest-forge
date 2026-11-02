/**
 * Hearthsong synth + conductor, inside an AudioWorklet (DESIGN-music-ember.md; conductor = tla/Hearthsong.tla).
 * Owns the clock: every eighth-note slot is decided here, sample-exact, from the compiled score (score.ts) and nine
 * k-rate params the main thread moves (music.hot.ts). Hot file: nothing below the constructor allocates.
 *
 * Voices: Karplus-Strong harp (pool), additive pad (two sets of three, crossfaded per bar), sine bass, breathy
 * ocarina lead (one, legato), FM bells (pool). Stereo out; the reverb is a convolver on the main thread.
 */
export {};

declare const sampleRate: number;
declare function registerProcessor(name: string, ctor: unknown): void;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor(options?: unknown);
}

// cold:begin (types and constants)
type Song = {
  bpm: number; slots: number; key: number; bars: number; tunes: number; breathBars: number;
  tune: number[]; chords: number[]; shadeChords: number[];
  swell: { bars: number; fade: number; gap: number };
};

const TAU = Math.PI * 2;
const HARPS = 12;
const KS_LEN = 4096;
const BELLS = 4;
const PADS = 6;
// conductor states (tla/Hearthsong.tla `swell`)
const IDLE = 0;
const ARMED = 1;
const SINGING = 2;
const FADING = 3;
// the ending (tla `ending`)
const PLAYING = 0;
const REQUESTED = 1;
const CODA = 2;
const DONE = 3;
/** cue kinds (param `kind`, set with the cue) */
const CUE_FORCE = 1;
const CUE_REST = 3;
/** finale moments that may sing inside the gap, per game (tla MaxForce) */
const MAX_FORCE = 2;
/** the coda sings the tune's last line (tla CodaFrom = bars - 4) */
const CODA_BARS = 4;

// cold:end
function hz(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

class Hearthsong extends AudioWorkletProcessor {
  // cold:begin (construction only)
  static get parameterDescriptors() {
    const k = (name: string, d: number) => ({ name, defaultValue: d, minValue: 0, maxValue: 1000, automationRate: 'k-rate' });
    return [k('harp', 0.5), k('pad', 0), k('bass', 0), k('lead', 0), k('bells', 0), k('bright', 0.5), k('shade', 0), k('cue', 0), k('kind', 0), k('level', 0)];
  }

  s: Song;
  rng: number;
  slotLen: number;
  toSlot = 0;
  // conductor
  bar = -1;
  slot = 0;
  breath = false;
  pass = 0;
  swell = IDLE;
  left = 0;
  since: number;
  lastCue = 0;
  shaded = false;
  ending = PLAYING;
  forced = false;
  forces = MAX_FORCE;
  doneSlots = 0;
  chord = 0;
  // smoothed layer levels
  lv = new Float32Array(9);
  // harp (Karplus-Strong)
  hBuf: Float32Array[] = [];
  hLen = new Int32Array(HARPS);
  hPos = new Int32Array(HARPS);
  hPrev = new Float32Array(HARPS);
  hApC = new Float32Array(HARPS);
  hApX = new Float32Array(HARPS);
  hApY = new Float32Array(HARPS);
  hDecay = new Float32Array(HARPS);
  hL = new Float32Array(HARPS);
  hR = new Float32Array(HARPS);
  hAge = new Float32Array(HARPS);
  /** samples until a plucked string sounds (humanized onsets) */
  hWait = new Int32Array(HARPS);
  hNext = 0;
  hLpL = 0;
  hLpR = 0;
  // pad
  pPh = new Float64Array(PADS * 3);
  pInc = new Float64Array(PADS * 3);
  pAmp = new Float32Array(PADS);
  pTo = new Float32Array(PADS);
  pSet = 0;
  pLp1 = 0;
  pLp2 = 0;
  pLp3 = 0;
  pLp4 = 0;
  pLfo = 0;
  // bass
  bPh = 0;
  bInc = 0;
  bAmp = 0;
  bAtk = 0;
  // lead
  lPh = 0;
  lInc = 0;
  lIncTo = 0;
  lAmp = 0;
  lGate = 0;
  lAge = 0;
  lVib = 0;
  lNoise = 0;
  // bells
  ePh = new Float64Array(BELLS);
  eMod = new Float64Array(BELLS);
  eInc = new Float64Array(BELLS);
  eAmp = new Float32Array(BELLS);
  eIdx = new Float32Array(BELLS);
  eL = new Float32Array(BELLS);
  eR = new Float32Array(BELLS);
  eNext = 0;
  report = new Float64Array(8);

  constructor(options: { processorOptions: { song: Song; seed: number } }) {
    super(options);
    this.s = options.processorOptions.song;
    this.rng = options.processorOptions.seed >>> 0 || 1;
    this.slotLen = (sampleRate * 60) / this.s.bpm / 2;
    this.since = this.s.swell.gap;
    for (let i = 0; i < HARPS; i++) this.hBuf.push(new Float32Array(KS_LEN));
  }
  // cold:end

  /** mulberry32: deterministic humanizing */
  rand(): number {
    let t = (this.rng = (this.rng + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  pan(i: number, p: number, l: Float32Array, r: Float32Array): void {
    const a = ((Math.max(-1, Math.min(1, p)) + 1) * Math.PI) / 4;
    l[i] = Math.cos(a);
    r[i] = Math.sin(a);
  }

  /** late: max humanizing delay in seconds (a played harp is never on the grid) */
  pluck(midi: number, vel: number, late = 0): void {
    const i = this.hNext;
    this.hNext = (i + 1) % HARPS;
    const f = hz(midi);
    const period = sampleRate / f - 0.5;
    const d = Math.max(2, Math.min(KS_LEN - 1, Math.floor(period)));
    const frac = period - d;
    this.hLen[i] = d;
    this.hPos[i] = 0;
    this.hPrev[i] = 0;
    this.hApC[i] = (1 - frac) / (1 + frac);
    this.hApX[i] = 0;
    this.hApY[i] = 0;
    // brighter pluck with the place's light; low strings ring longer
    const t60 = 2.4 + 2.2 * Math.max(0, (72 - midi) / 24);
    this.hDecay[i] = Math.pow(0.001, 1 / (f * t60));
    const buf = this.hBuf[i]!;
    const soft = 0.25 + 0.5 * (1 - this.lv[5]!);
    let lp = 0;
    let mean = 0;
    for (let n = 0; n < d; n++) {
      lp += (this.rand() * 2 - 1 - lp) * (1 - soft);
      buf[n] = lp;
      mean += lp;
    }
    mean /= d;
    // pluck position ~1/5 along the string: a soft comb on the excitation
    const pp = Math.max(1, Math.floor(d / 5));
    for (let n = d - 1; n >= pp; n--) buf[n] = (buf[n]! - mean - (buf[n - pp]! - mean) * 0.6) * vel;
    for (let n = 0; n < pp; n++) buf[n] = (buf[n]! - mean) * vel * 0.4;
    this.pan(i, (midi - 64) / 30, this.hL, this.hR);
    this.hAge[i] = 0;
    this.hWait[i] = Math.floor(this.rand() * late * sampleRate);
  }

  bell(midi: number, vel: number): void {
    const i = this.eNext;
    this.eNext = (i + 1) % BELLS;
    this.eInc[i] = (TAU * hz(midi)) / sampleRate;
    this.ePh[i] = 0;
    this.eMod[i] = 0;
    this.eAmp[i] = vel;
    this.eIdx[i] = 1.6;
    this.pan(i, this.rand() * 1.2 - 0.6, this.eL, this.eR);
  }

  padChord(c: number[], base: number): void {
    // fade the sounding set, bring in the other set on this chord (voiced C3..B4, root kept low)
    const from = this.pSet * 3;
    for (let v = 0; v < 3; v++) this.pTo[from + v] = 0;
    this.pSet ^= 1;
    const to = this.pSet * 3;
    for (let v = 0; v < 3; v++) {
      const m = this.s.key - 12 + c[base + v]! + (v === 0 ? 0 : 12 * (c[base + v]! < 5 ? 1 : 0));
      const f = hz(m);
      const k = to + v;
      this.pInc[k * 3] = (TAU * f) / sampleRate;
      this.pInc[k * 3 + 1] = (TAU * f * 1.0035) / sampleRate;
      this.pInc[k * 3 + 2] = (TAU * f * 0.9968) / sampleRate;
      this.pTo[k] = v === 0 ? 0.9 : 0.7;
    }
  }

  /** a bar line: tla/Hearthsong.tla `Bar` */
  barLine(): void {
    const s = this.s;
    const swell = s.swell;
    const tick = this.since < swell.gap ? this.since + 1 : this.since;
    if (this.ending === REQUESTED) {
      // asked to end: jump to the last line and let the lead sing it home
      this.bar = s.bars - CODA_BARS;
      this.breath = false;
      this.swell = SINGING;
      this.left = CODA_BARS;
      this.since = 0;
      this.forced = false;
      this.ending = CODA;
      this.reportState();
      return;
    }
    if (this.ending === CODA) {
      if (this.bar + 1 < s.bars) { this.bar++; this.left--; this.since = tick; }
      else { this.ending = DONE; this.swell = IDLE; this.left = 0; this.since = tick; }
      this.reportState();
      return;
    }
    if (this.ending === DONE) return;
    this.bar++;
    if (!this.breath && this.bar >= s.bars) { this.bar = 0; this.breath = true; }
    else if (this.breath && this.bar >= s.breathBars) { this.bar = 0; this.breath = false; this.pass++; }
    if (this.swell === ARMED && !this.breath) { this.swell = SINGING; this.left = swell.bars; this.since = 0; this.forced = false; }
    else if (this.swell === SINGING && (this.left <= 1 || this.breath)) { this.swell = FADING; this.left = swell.fade; this.since = tick; }
    else if (this.swell === SINGING) { this.left--; this.since = tick; }
    else if (this.swell === FADING && this.left <= 1) { this.swell = IDLE; this.left = 0; this.since = tick; }
    else if (this.swell === FADING) { this.left--; this.since = tick; }
    else this.since = tick;
    // the hollow places borrow the shade chords (latched per bar, with hysteresis)
    const sh = this.lv[6]!;
    if (sh > 0.6) this.shaded = true;
    else if (sh < 0.4) this.shaded = false;
    this.reportState();
  }

  reportState(): void {
    const r = this.report;
    r[0] = this.bar;
    r[1] = this.breath ? 1 : 0;
    r[2] = this.swell;
    r[3] = this.pass;
    r[4] = this.since;
    r[5] = this.shaded ? 1 : 0;
    r[6] = this.ending;
    r[7] = this.forces;
    this.port.postMessage(r); // lint-feel: ok once per bar (2.5 s): state for window.__game
  }

  /** after the coda: roll the home chord once over a bar, let the pad hold it two more, then rest for good */
  final(): void {
    const s = this.s;
    const k = this.doneSlots++;
    if (k === 0) {
      this.lGate = 0;
      this.bInc = (TAU * hz(s.key - 24)) / sampleRate;
      this.bAtk = 1;
    }
    if (k < 6) this.pluck(s.key - 12 + (k === 0 ? 0 : k === 1 ? 7 : k === 2 ? 12 : k === 3 ? 16 : k === 4 ? 19 : 24), 0.42 - k * 0.03);
    if (k === 18) for (let v = 0; v < PADS; v++) this.pTo[v] = 0;
  }

  /** rubato: each 4-bar phrase leans back into its last bar; the coda's last bar slows more */
  stretch(): number {
    const k = (this.slot === 0 ? this.s.slots : this.slot) / this.s.slots;
    if (this.breath) return 1.04;
    if (this.ending === CODA && this.bar === this.s.bars - 1) return 1 + 0.25 * k * k;
    return this.bar % 4 === 3 ? 1 + 0.09 * k * k : 1;
  }

  /** one eighth-note slot: decide what plays */
  doSlot(): void {
    const s = this.s;
    if (this.slot === 0) this.barLine();
    const lv = this.lv;
    const slot = this.slot;
    if (this.ending === DONE) {
      this.slot = (slot + 1) % s.slots;
      this.final();
      return;
    }
    const chords = this.shaded ? s.shadeChords : s.chords;
    // which tune this pass plays (a breath belongs to the tune it follows)
    const tb = (this.pass % s.tunes) * s.bars;
    const cb = (tb + (this.breath ? s.bars - 1 : this.bar)) * 3;
    const root = chords[cb]!;
    const singing = this.swell === SINGING;
    const human = 0.85 + this.rand() * 0.3;
    if (this.breath) {
      // a breath: the pad rests on the last chord; one high harp note to lead back in
      if (slot === 0 && this.bar === 0) this.padChord(chords, cb);
      if (slot === 0 && this.bar === s.breathBars - 1 && lv[0]! > 0.2) this.pluck(s.key + 12 + chords[cb + 2]!, 0.25 * human);
    } else {
      if (slot === 0) {
        this.padChord(chords, cb);
        if (lv[2]! > 0.01) {
          this.bInc = (TAU * hz(s.key - 24 + root)) / sampleRate;
          this.bAtk = 1;
        }
      }
      // broken chord: root, fifth, third, octave, third, fifth — sparser when the place (or the sepia world) is quiet
      const dens = lv[0]!;
      const play = slot === 0 ? dens > 0.02 : slot === 2 || slot === 4 ? dens > 0.4 : dens > 0.75;
      if (play) {
        const pick = slot === 0 ? 0 : slot === 1 || slot === 5 ? 2 : slot === 3 ? 0 : 1;
        const oct = slot === 0 ? -12 : slot === 3 ? 12 : 0;
        this.pluck(s.key + chords[cb + pick]! + oct, (slot === 0 ? 0.55 : 0.32) * human, slot === 0 ? 0.004 : 0.018);
      }
      // the tune: the lead sings it in a swell (or every other pass once it's allowed); otherwise the harp carries it
      const n = s.tune[(tb + this.bar) * s.slots + slot]!;
      const leadOn = singing || (this.pass % 2 === 1 && lv[3]! > 0.15);
      if (leadOn) {
        if (n >= 0) {
          this.lIncTo = (TAU * hz(n)) / sampleRate;
          if (this.lGate === 0) this.lInc = this.lIncTo;
          this.lGate = 1;
          this.lAge = 0;
        } else if (n === -2) this.lGate = 0;
      } else {
        this.lGate = 0;
        const hint = this.pass % 4 === 2;
        if (n >= 0 && (!hint || slot === 0)) this.pluck(n + 12, 0.5 * human, 0.025);
      }
      if (singing && lv[4]! > 0.02 && (slot === 0 || slot === 3) && this.rand() < 0.7) {
        this.bell(s.key + 24 + chords[cb + Math.floor(this.rand() * 3)]!, 0.5 * human);
      }
    }
    this.slot = (slot + 1) % s.slots;
  }

  process(_in: Float32Array[][], outputs: Float32Array[][], p: Record<string, Float32Array>): boolean {
    const out = outputs[0]!;
    const L = out[0]!;
    const R = out[1] ?? out[0]!;
    const n = L.length;
    const lv = this.lv;
    // k-rate params, eased per block (the main thread already ramps them)
    lv[0]! += (p.harp![0]! - lv[0]!) * 0.05;
    lv[1]! += (p.pad![0]! - lv[1]!) * 0.05;
    lv[2]! += (p.bass![0]! - lv[2]!) * 0.05;
    lv[3]! += (p.lead![0]! - lv[3]!) * 0.05;
    lv[4]! += (p.bells![0]! - lv[4]!) * 0.05;
    lv[5]! += (p.bright![0]! - lv[5]!) * 0.05;
    lv[6]! += (p.shade![0]! - lv[6]!) * 0.05;
    lv[8]! += (p.level![0]! - lv[8]!) * 0.02;
    // a cue: tla/Hearthsong.tla `Cue` / `ForceCue` / `RestCue` (a plain cue sings only when idle and rested; else dropped)
    const cue = p.cue![0]!;
    if (cue !== this.lastCue) {
      const kind = p.kind![0]!;
      if (this.ending !== PLAYING) { /* the song is ending: nothing new */ }
      else if (kind === CUE_REST) this.ending = REQUESTED;
      else if (kind === CUE_FORCE) {
        // tla ForceCue: a finale moment sings even inside the gap (re-arms a fading swell)
        if ((this.swell === IDLE || this.swell === FADING) && this.forces > 0) { this.swell = ARMED; this.forced = true; this.forces--; }
      } else if (this.swell === IDLE && this.since >= this.s.swell.gap) this.swell = ARMED;
      this.lastCue = cue;
    }
    const singing = this.swell === SINGING;
    const swellGain = singing ? 1 : this.swell === FADING ? 0.5 : 0;
    const harpG = 0.32 * Math.min(1, 0.4 + lv[0]!);
    const padG = 0.035 * lv[1]! * (1 + 0.3 * swellGain);
    const bassG = 0.11 * lv[2]!;
    const leadG = 0.1 * Math.max(lv[3]!, singing ? 0.85 : 0);
    const bellG = 0.07 * Math.max(lv[4]!, swellGain * 0.6);
    const master = lv[8]!;
    const bright = lv[5]!;
    const harpLp = 1 - Math.exp((-TAU * (1800 + 4200 * bright)) / sampleRate);
    const padLp = 1 - Math.exp((-TAU * (500 + 1300 * bright)) / sampleRate);
    const padAtk = 1 / (sampleRate * 1.4);
    const padRel = 1 / (sampleRate * 2.2);
    const bassDec = Math.pow(0.001, 1 / (sampleRate * 1.6));
    const bassAtk = 1 - Math.exp(-1 / (sampleRate * 0.02));
    const leadAtk = 1 - Math.exp(-1 / (sampleRate * 0.07));
    const leadRel = 1 - Math.exp(-1 / (sampleRate * 0.35));
    const glide = 1 - Math.exp(-1 / (sampleRate * 0.03));
    const bellDec = Math.pow(0.001, 1 / (sampleRate * 2.6));
    const idxDec = Math.pow(0.001, 1 / (sampleRate * 0.9));
    const vibHz = (TAU * 5.1) / sampleRate;
    const padLfo = (TAU * 0.07) / sampleRate;
    for (let i = 0; i < n; i++) {
      if (this.toSlot <= 0) {
        this.doSlot();
        this.toSlot += this.slotLen * this.stretch();
      }
      this.toSlot--;
      let l = 0;
      let r = 0;
      // harp
      let hl = 0;
      let hr = 0;
      for (let v = 0; v < HARPS; v++) {
        const d = this.hLen[v]!;
        if (d === 0) continue;
        if (this.hWait[v]! > 0) { this.hWait[v]--; continue; }
        const buf = this.hBuf[v]!;
        const pos = this.hPos[v]!;
        const x = buf[pos]!;
        const avg = 0.5 * (x + this.hPrev[v]!);
        this.hPrev[v] = x;
        const c = this.hApC[v]!;
        const y = c * avg + this.hApX[v]! - c * this.hApY[v]!;
        this.hApX[v] = avg;
        this.hApY[v] = y;
        buf[pos] = y * this.hDecay[v]!;
        this.hPos[v] = pos + 1 >= d ? 0 : pos + 1;
        hl += x * this.hL[v]!;
        hr += x * this.hR[v]!;
      }
      this.hLpL += (hl - this.hLpL) * harpLp;
      this.hLpR += (hr - this.hLpR) * harpLp;
      l += this.hLpL * harpG;
      r += this.hLpR * harpG;
      // pad
      let pl = 0;
      let pr = 0;
      for (let v = 0; v < PADS; v++) {
        const to = this.pTo[v]!;
        let a = this.pAmp[v]!;
        if (a < to) a = Math.min(to, a + padAtk);
        else if (a > to) a = Math.max(to, a - padRel);
        this.pAmp[v] = a;
        if (a <= 0) continue;
        let w = 0;
        for (let o = 0; o < 3; o++) {
          const k = v * 3 + o;
          let ph = this.pPh[k]! + this.pInc[k]!;
          if (ph > TAU) ph -= TAU;
          this.pPh[k] = ph;
          w += Math.sin(ph) + 0.35 * Math.sin(2 * ph) + 0.12 * Math.sin(3 * ph);
        }
        w *= a;
        if (v % 2 === 0) { pl += w; pr += w * 0.6; } else { pr += w; pl += w * 0.6; }
      }
      this.pLfo += padLfo;
      if (this.pLfo > TAU) this.pLfo -= TAU;
      const breathe = 1 + 0.18 * Math.sin(this.pLfo);
      pl *= breathe;
      pr *= 2 - breathe;
      this.pLp1 += (pl - this.pLp1) * padLp;
      this.pLp2 += (this.pLp1 - this.pLp2) * padLp;
      this.pLp3 += (pr - this.pLp3) * padLp;
      this.pLp4 += (this.pLp3 - this.pLp4) * padLp;
      l += this.pLp2 * padG;
      r += this.pLp4 * padG;
      // bass
      if (this.bAtk > 0) {
        this.bAmp += (1 - this.bAmp) * bassAtk;
        if (this.bAmp > 0.97) this.bAtk = 0;
      } else this.bAmp *= bassDec;
      if (this.bAmp > 1e-5) {
        this.bPh += this.bInc;
        if (this.bPh > TAU) this.bPh -= TAU;
        const b = (Math.sin(this.bPh) + 0.18 * Math.sin(2 * this.bPh)) * this.bAmp * bassG;
        l += b;
        r += b;
      }
      // lead: a breathy ocarina, legato with a short glide; vibrato grows into held notes
      this.lAmp += ((this.lGate ? 1 : 0) - this.lAmp) * (this.lGate ? leadAtk : leadRel);
      if (this.lAmp > 1e-5) {
        this.lInc += (this.lIncTo - this.lInc) * glide;
        this.lAge += 1 / sampleRate;
        this.lVib += vibHz;
        if (this.lVib > TAU) this.lVib -= TAU;
        const depth = 0.006 * Math.min(1, Math.max(0, (this.lAge - 0.25) * 2));
        this.lPh += this.lInc * (1 + depth * Math.sin(this.lVib));
        if (this.lPh > TAU) this.lPh -= TAU;
        this.lNoise += (this.rand() * 2 - 1 - this.lNoise) * 0.18;
        const v = (Math.sin(this.lPh) + 0.09 * Math.sin(2 * this.lPh) + 0.03 * Math.sin(3 * this.lPh) + this.lNoise * 0.05) * this.lAmp * leadG;
        l += v * 0.9;
        r += v;
      }
      // bells (FM, ratio 3.5: glassy)
      for (let v = 0; v < BELLS; v++) {
        const a = this.eAmp[v]!;
        if (a < 1e-5) continue;
        this.ePh[v] = this.ePh[v]! + this.eInc[v]!;
        this.eMod[v] = this.eMod[v]! + this.eInc[v]! * 3.5;
        const e = Math.sin(this.ePh[v]! + this.eIdx[v]! * Math.sin(this.eMod[v]!)) * a * bellG;
        this.eAmp[v] = a * bellDec;
        this.eIdx[v] = this.eIdx[v]! * idxDec;
        l += e * this.eL[v]!;
        r += e * this.eR[v]!;
      }
      L[i] = l * master;
      R[i] = r * master;
    }
    return true;
  }
}

registerProcessor('hearthsong', Hearthsong);
