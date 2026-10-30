---
name: game-design-playtest
description: Design a Spyro-inspired UHQ three.js creature platformer prototype, tune character FEEL, playtest with Playwright, critique screenshots/video, iterate.
---

# Game design + playtest (UHQ creature platformer)

**Creative direction:** beautiful stylized 3D open-world platformer (original IP, Spyro-like spirit — not a clone). Human is creative director; you realize the vision. Iterate hardest on **character feel** (satisfying, powerful). Keep controls simple: **move + 2 action buttons** that combine into abilities. Try several variations of each mechanic.

Inspiration pattern (Thariq): ship small playable slices fast; feel > content breadth.

## 0. Design doc (`games/<name>/DESIGN.md`)

| Field | Content |
| --- | --- |
| Core verb | e.g. Bound / Glide / Charge |
| Controls | Move + Jump + Dash (Jump-hold in air = glide). Document combos. |
| Win / lose | Short session goal (gems, reach shrine…) |
| Difficulty ramp | First 30–60s |
| Feel targets | Jump apex height, time-to-apex, air control, dash snappiness |
| Visual references | Stylized island, readable creature silhouette |
| Story beat | One sentence of mood/lore (optional for smoke) |

## 1. Build — UHQ three.js bar

Use `games/shared/`:

- `createForgeRenderer()` — WebGL2 default (SwiftShader-safe); WebGPU only with `preferWebGPU:true`
- `applyStylizedIslandLights` / HDRI when network allows
- PBR materials, soft shadows, bloom + SMAA + ACES
- `Juice` for hits/collects
- Third-person camera follow with damping
- Floating island (or small playground), collectibles

**Never** call `canvas.getContext` after three.js owns the canvas (breaks WebGL).

## 2. Character feel (mandatory)

Expose tunables via **lil-gui** (`createFeelPanel` in `games/shared/character-feel.ts`):

- moveSpeed, accel, turnRate
- jumpVelocity, gravity, airControl
- glideGravityScale, glideDrag
- dashSpeed, dashDuration
- coyoteTime, jumpBuffer

Publish feel metrics on `window.__game.notes` or fields:

- lastJumpApex, lastTimeToApex, lastAirTime, dashesUsed, gemsCollected

**Process:** pick one mechanic → build 2–3 param variations → playtest each → keep the most satisfying. Do not tune ten things at once.

## 3. Playtest (must actually play)

```bash
npm run playtest -- --game <name> --seconds 25
# or Playwright MCP: start vite, navigate, real keyboard, screenshot, video
```

Harness uses `--use-gl=angle --use-angle=swiftshader`. Read `window.__game` after playing.

## 4. Visual-quality review

From screenshots/video:

- [ ] Creature silhouette readable
- [ ] Island reads as a place (color, light, shadow)
- [ ] Jump/glide/dash *look* powerful
- [ ] Camera framing comfortable
- [ ] Bloom/juice tasteful

Fix the worst issues; re-playtest once.

## 5. Done criteria

DESIGN.md + runs in harness + `__game` metrics + screenshots/video under `playtest-output/<name>/` + short REVIEW.md (feel + visuals).

## Unreal

Later only. See `docs/unreal/SCOPING.md`. Do not install UE.

## Color fantasy (see docs/vision.md)

Hero = tiny wispy **multicolored fox spirit** (always saturated).
World starts **monochrome**; fox leaves temporary color aura/trail; **shrines** permanently restore region color.
Use `games/shared/color-mask.ts`. Capture shrine payoff on playtest video.
