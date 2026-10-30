/** Games must expose this on window so the playtest harness can read metrics. */
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
};

declare global {
  interface Window {
    __game?: GameState;
  }
}

export function publishGame(state: GameState): void {
  window.__game = { ...state };
}
