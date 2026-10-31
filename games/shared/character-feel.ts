export type FeelParams = {
  moveSpeed: number;
  accel: number;
  turnRate: number;
  jumpVelocity: number;
  /** Multiply upward velocity once when jump is released early (variable height). */
  jumpCut: number;
  gravity: number;
  airControl: number;
  glideGravityScale: number;
  glideDrag: number;
  dashSpeed: number;
  dashDuration: number;
  coyoteTime: number;
  jumpBuffer: number;
};

/** Sol REVIEW: spring beat brisk for readable hang (~2u apex / ~0.43s rise). */
export const PRESET_SPRING: FeelParams = {
  moveSpeed: 7.5,
  accel: 30,
  turnRate: 11,
  jumpVelocity: 10.2,
  jumpCut: 0.42,
  gravity: 22,
  airControl: 0.55,
  glideGravityScale: 0.28,
  glideDrag: 1.8,
  dashSpeed: 18,
  dashDuration: 0.22,
  coyoteTime: 0.1,
  jumpBuffer: 0.12,
};

export const PRESET_BRISK: FeelParams = {
  moveSpeed: 8.5,
  accel: 34,
  turnRate: 12,
  jumpVelocity: 9,
  jumpCut: 0.4,
  gravity: 26,
  airControl: 0.5,
  glideGravityScale: 0.32,
  glideDrag: 2.0,
  dashSpeed: 20,
  dashDuration: 0.18,
  coyoteTime: 0.08,
  jumpBuffer: 0.1,
};

export type FeelMetrics = {
  lastJumpApex: number;
  lastTimeToApex: number;
  lastAirTime: number;
  dashesUsed: number;
  gemsCollected: number;
  jumps: number;
};

export function emptyFeelMetrics(): FeelMetrics {
  return {
    lastJumpApex: 0,
    lastTimeToApex: 0,
    lastAirTime: 0,
    dashesUsed: 0,
    gemsCollected: 0,
    jumps: 0,
  };
}

/** Edge-triggered jump buffer + coyote + one-shot variable cut + apex tracking. */
export class JumpFeel {
  buffer = 0;
  coyote = 0;
  apex = 0;
  timeToApex = 0;
  airTime = 0;
  cutThisJump = false;

  private spaceWasDown = false;
  private jumpStartY = 0;
  private jumpClock = 0;
  private rising = false;
  private airClock = 0;
  private cutApplied = false;
  /** Space held after takeoff — required before variable-cut may fire. */
  private heldAfterTakeoff = false;

  sampleJumpEdge(spaceDown: boolean, dt: number, bufferWindow: number): void {
    if (spaceDown && !this.spaceWasDown) this.buffer = bufferWindow;
    else this.buffer = Math.max(0, this.buffer - dt);
    this.spaceWasDown = spaceDown;
  }

  onGrounded(coyoteWindow: number): void {
    this.coyote = coyoteWindow;
    if (this.rising || this.airClock > 0) {
      this.airTime = this.airClock;
      this.rising = false;
      this.airClock = 0;
    }
  }

  tickAir(dt: number, y: number, velY: number): void {
    this.coyote = Math.max(0, this.coyote - dt);
    this.airClock += dt;
    if (this.rising) {
      this.jumpClock += dt;
      const h = y - this.jumpStartY;
      if (h > this.apex) {
        this.apex = h;
        this.timeToApex = this.jumpClock;
      }
      if (velY <= 0) this.rising = false;
    }
  }

  tryJump(jumpVelocity: number, startY: number): number | null {
    if (this.buffer <= 0 || this.coyote <= 0) return null;
    this.buffer = 0;
    this.coyote = 0;
    this.jumpStartY = startY;
    this.jumpClock = 0;
    this.apex = 0;
    this.timeToApex = 0;
    this.rising = true;
    this.airClock = 0;
    this.cutApplied = false;
    this.cutThisJump = false;
    this.heldAfterTakeoff = false;
    return jumpVelocity;
  }

  /**
   * One-shot cut when Space is released after a hold during this jump.
   * Buffered jumps with no hold keep full height (no same-frame cut).
   */
  applyCut(spaceDown: boolean, velY: number, cut: number): number {
    if (spaceDown) this.heldAfterTakeoff = true;
    if (
      this.rising &&
      this.heldAfterTakeoff &&
      !spaceDown &&
      velY > 0 &&
      !this.cutApplied
    ) {
      this.cutApplied = true;
      this.cutThisJump = true;
      return velY * cut;
    }
    return velY;
  }
}
