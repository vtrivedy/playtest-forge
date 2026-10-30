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
};

declare global {
  interface Window {
    __game?: GameState;
  }
}

export function publishGame(state: GameState): void {
  window.__game = { ...state, feel: state.feel ? { ...state.feel } : undefined };
}
