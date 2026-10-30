import GUI from 'lil-gui';

export type FeelParams = {
  moveSpeed: number;
  accel: number;
  turnRate: number;
  jumpVelocity: number;
  gravity: number;
  airControl: number;
  glideGravityScale: number;
  glideDrag: number;
  dashSpeed: number;
  dashDuration: number;
  coyoteTime: number;
  jumpBuffer: number;
};

export const DEFAULT_FEEL: FeelParams = {
  moveSpeed: 8,
  accel: 28,
  turnRate: 10,
  jumpVelocity: 9.5,
  gravity: 22,
  airControl: 0.55,
  glideGravityScale: 0.28,
  glideDrag: 1.8,
  dashSpeed: 18,
  dashDuration: 0.22,
  coyoteTime: 0.1,
  jumpBuffer: 0.12,
};

export type FeelMetrics = {
  lastJumpApex: number;
  lastTimeToApex: number;
  lastAirTime: number;
  dashesUsed: number;
  gemsCollected: number;
};

export function createFeelPanel(
  params: FeelParams,
  onChange?: () => void,
): GUI {
  const gui = new GUI({ title: 'Character Feel' });
  gui.add(params, 'moveSpeed', 2, 20, 0.1).onChange(onChange);
  gui.add(params, 'accel', 5, 60, 0.5).onChange(onChange);
  gui.add(params, 'turnRate', 1, 20, 0.1).onChange(onChange);
  gui.add(params, 'jumpVelocity', 4, 18, 0.1).onChange(onChange);
  gui.add(params, 'gravity', 8, 40, 0.5).onChange(onChange);
  gui.add(params, 'airControl', 0, 1, 0.01).onChange(onChange);
  gui.add(params, 'glideGravityScale', 0.05, 1, 0.01).onChange(onChange);
  gui.add(params, 'glideDrag', 0, 6, 0.05).onChange(onChange);
  gui.add(params, 'dashSpeed', 8, 40, 0.5).onChange(onChange);
  gui.add(params, 'dashDuration', 0.05, 0.6, 0.01).onChange(onChange);
  gui.add(params, 'coyoteTime', 0, 0.25, 0.01).onChange(onChange);
  gui.add(params, 'jumpBuffer', 0, 0.25, 0.01).onChange(onChange);
  return gui;
}
