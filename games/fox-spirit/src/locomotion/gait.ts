import type { LegId } from './rig';

export type GaitName = 'walk' | 'trot' | 'gallop';
export const GAITS: GaitName[] = ['walk', 'trot', 'gallop'];

/**
 * Footfall phase offsets (fraction of a stride) — unwrapped so blending between neighbours moves each foot the
 * short way. Walk: lateral sequence LH→LF→RH→RF. Trot: diagonal pairs. Gallop: transverse — hinds then fores,
 * each pair split, with a gathered flight between hinds-off and fores-on.
 */
export const PHASE: Record<GaitName, Record<LegId, number>> = {
  walk: { LH: 0, LF: 0.25, RH: 0.5, RF: 0.75 },
  trot: { LH: 0, LF: 0.5, RH: 0.5, RF: 1.0 },
  gallop: { LH: 0, LF: 0.55, RH: 0.1, RF: 0.65 },
};

export type GaitTune = {
  /** Centre speed (u/s) of the gait band */
  speed: number;
  /** Strides per second at the centre speed */
  freq: number;
  /** Fraction of the stride a foot is on the ground */
  duty: number;
  /** Paw lift (u) */
  stepHeight: number;
  /** Body bob amplitude (u) */
  bob: number;
};

export const DEFAULT_GAITS: Record<GaitName, GaitTune> = {
  walk: { speed: 1.1, freq: 1.6, duty: 0.66, stepHeight: 0.05, bob: 0.012 },
  trot: { speed: 3.4, freq: 3.1, duty: 0.4, stepHeight: 0.075, bob: 0.024 },
  gallop: { speed: 7.5, freq: 3.8, duty: 0.24, stepHeight: 0.11, bob: 0.035 },
};

/** Smooth band weights for a speed (sum to 1). */
export function gaitWeights(speed: number, g: Record<GaitName, GaitTune>, out: Record<GaitName, number>) {
  const wt = smooth((speed - g.walk.speed) / (g.trot.speed - g.walk.speed));
  const tg = smooth((speed - (g.trot.speed + 0.6)) / (g.gallop.speed - g.trot.speed - 1.2));
  out.walk = 1 - wt;
  out.trot = wt * (1 - tg);
  out.gallop = wt * tg;
  return out;
}

function smooth(x: number) {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}
