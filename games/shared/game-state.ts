/** Games must expose this on window so the playtest harness can read metrics. */
export type FeelSnapshot = {
  lastJumpApex: number;
  lastTimeToApex: number;
  lastAirTime: number;
  dashesUsed: number;
  jumps: number;
  grounded: boolean;
  gliding: boolean;
  /** Game-specific feel readouts (jump distance, landing impact, anim, preset …) */
  extra?: Record<string, number | string | boolean>;
};

export type GameState = {
  title: string;
  status: 'playing' | 'won' | 'lost' | 'ready';
  score: number;
  lives: number;
  elapsedSec: number;
  deaths: number;
  backend?: string;
  winCondition?: string;
  loseCondition?: string;
  notes?: string[];
  feel?: FeelSnapshot;
  shades?: { wisps: number; hits: number; frees: number; invulnerable: number; knockbackTravel: number; tun?: Record<string, number | boolean>; actors: Array<{ id: string; pos: number[]; freed: boolean }> };
  /** Game-specific systemic state (e.g. fox-spirit colour chemistry) */
  chem?: unknown;
  reach?: unknown;
  /** Fox-spirit persistent paint trail: blooms laid, painted ground (m²), painted fraction round the fox. */
  paint?: { laid: number; areaM2: number; local: number; wet: number; grade: number };
  /** Fox-spirit summit extension: shrine seal and permanent return route. */
  crown?: { restored: boolean; seal: number; fed: boolean; bowl: number[]; hearths: string[]; returnWind: string };
};

declare global {
  interface Window {
    __game?: GameState;
  }
}

export function publishGame(state: GameState): void {
  window.__game = { ...state, feel: state.feel ? { ...state.feel } : undefined };
}
