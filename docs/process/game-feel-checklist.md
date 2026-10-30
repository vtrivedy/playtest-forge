# Game Feel Checklist (fox locomotion + actions)

> Adapted from Claude Code Game Studios GDD "Game Feel" guidance
> ([upstream](https://github.com/Donchitos/Claude-Code-Game-Studios), MIT).
> Engine-agnostic; fill for three.js + Rapier fox controller.

Use this **before** shipping a locomotion or action change. Pair with
`.claude/skills/playtest-feel-gate` and a retained video under
`playtest-output/` or `playtest-forge-artifacts/sprint2/`.

## Feel Reference

- **Target:** [exact game + moment], e.g. "BotW wolf Link trot — planted feet, body yaw lags turn, tail follows"
- **Anti-reference:** skating orb / rigid capsule / no leg motion / instantaneous yaw snap

## Input Responsiveness

| Action | Max input→response (ms) | Notes |
|--------|-------------------------|-------|
| Steer / turn start | ≤ 50 | Body yaw may lag; camera may lag more |
| Jump leave-ground | ≤ 66 (~4f @60) | Coyote + buffer still apply |
| Dash start | ≤ 50 | |
| Land / plant | visible within 2 frames | |

## Animation / gait targets

| Clip / state | Startup | Active | Recovery | Feel goal |
|--------------|---------|--------|----------|-----------|
| Walk / trot | — | loop | — | Feet plant; no moonwalk; hips bob |
| Run | — | loop | — | Longer stride; tail stream |
| Turn in place / arc | — | — | — | Body leans into turn; not tank steer |
| Jump | crouch | airborne | land squash | Anticipation + follow-through |
| Dash | — | short commit | recovery | Weight, not teleport |
| Glide | enter | hold | exit | Soft gravity; readable silhouette |

## Impact / juice moments

| Event | Duration | Effect | Tunable? |
|-------|----------|--------|----------|
| Land | 80–150ms | squash + soft camera dip | yes (lil-gui) |
| Dash | 100–200ms | FOV kick / ember burst | yes |
| Seedwell restore start | — | warm edge + chord | yes |

## Weight profile (answer in one line each)

- **Weight:** light-reactive fox, not heavy tank; still has mass on land/turn
- **Control:** high mid-air course-correct; committed during dash
- **Snap:** smooth analog steer; crisp binary on jump/dash edges
- **Accel model:** ramp (simulation), not instant arcade velocity
- **Failure texture:** missed jump feels fair (readable apex + coyote)

## Feel acceptance (FAIL if any checked box fails on video)

- [ ] Reviewer never says "skating", "sliding", "orb", "rigid", "T-pose run"
- [ ] Feet plant and cycle on ground move; body + tail have follow-through on turns
- [ ] Jump has anticipation and land squash; dash has weight
- [ ] Empty-island 60s loop stays fun (pillar 1 kill test in `docs/design/game-design.md`)
- [ ] Retained capture exists (webm or mp4 + ≥2 stills) for this change
