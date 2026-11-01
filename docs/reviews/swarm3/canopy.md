# Canopy playground review — sw3-tallow WIP

Status: NOT READY TO LAND. Two independent FUN + BEAUTIFUL verdicts pending.

Design: `games/fox-spirit/DESIGN-canopy.md`, selected allocation from Flint #465.
Current entry/middle/high/roost centres: (-.2,71.5), (-.2,69.3), (.9,67.1),
(-1,64.7). No scenery moved or restore slot consumed.

## Mechanical evidence

`/captures/tallow/canopy-final-06/evidence.json`: 10/10 checks, no page errors.
Staged entry onto each test leaf is disclosed; flight uses real Space input,
and chained steering uses the existing world-stick interface. No position or
velocity writes during flight. All three chained landings pass from staged entry.
Released contact stays stable. Walking and dashing underneath never spring.
Launch profiles 8.66 and 10.25m/s produce apex gains 2.428m and 3.417m, with
.583s and .683s to apex respectively. Gentle retained as default.

## Visual review and revision

Inspected final06 contact/apex PNGs: fox silhouette remains readable, next leaf
visible, broad blade clearly supported by a stem. Raised dark veins at .035m
still failed to read, leaving a blank platform-like surface. Revised to .12m
and thicker branches for motion07. Motion07 reached high but was terminated before final JSON; incomplete, not counted.
Its middle-landing still shows raised veins now clearly readable.
Motion08 completes at480x270: route middle/high/roost + underside walk/dash
5/5 PASS, errors[]. Retained WebM and all three route PNGs reviewed through
video samples at10/30/50/70/90/110s; not a smooth real-time playback claim.

`/captures/tallow/carry-canopy-10/evidence.json`: 16/16 regression assertions PASS,
including both bowl-rim place/recovery checks. Inspected carried chase still;
fox silhouette and mouth-corner coal seating remain unchanged. Typecheck and
production build pass on the revised source.

## Feel critique — sw3-tallow WIP
Verdict: NEEDS REVISION

### Concrete failures
1. Motion08 sampled at10/30/50/70/90/110s: the fox becomes small at upper
   landings; canopy route needs a closer chase read before BEAUTIFUL approval.
2. Real-time WebM includes long screenshot/render stalls under SwiftShader.
   This limits cadence and anticipation judgement; no full gait approval.
3. Veins now read clearly, but their straight cylinder joins remain schematic.

### What works
- Both launch strengths have measured arcs; gentle completes the authored chain.
- Released input remains walkable; underside and dash contacts do not launch.

### Checklist
| Item | Pass? |
|------|-------|
| Feet plant / gait cycles | Limited by low-resolution sampled motion |
| Body + tail follow-through on turns | Limited by low-resolution sampled motion |
| Jump anticipation + land squash | Limited by low-resolution sampled motion |
| Dash has weight (not teleport) | Limited by low-resolution sampled motion |
| No skating / orb / rigid language fits | Limited by low-resolution sampled motion |
| Retained capture present | Complete motion08 WebM + route PNGs |

### Next patch
- Obtain independent play of full chain and safe retry.
- Review upper-route chase distance at normal resolution.
- Obtain two independent FUN + BEAUTIFUL verdicts before integration.

## Independent review — exact f2af9d5 (Rook, #swarm:555)

Normal-resolution chain 5/5 PASS; deliberate westward miss, grounded meadow
landing, walking return, ordinary held-jump re-entry and full chain retry 8/8
PASS with errors[]. No teleport occurs between miss and successful relaunch.
Independent retained evidence: captures volume
`/reviews/rook-canopy-f2af9d5-retry2/` (evidence.json, route-high.png,
retry-entry.png, other route/underside stills and WebM).
Tallow downloaded and inspected the actual JSON and high/retry PNGs, confirming
all eight checks and readable fox/veins at normal resolution.

Rook verdict: FUN MARGINALLY/provisional, BEAUTIFUL MARGINALLY. Rising rhythm,
steering and safe retry work; beige background flattens depth and entry underside
hides the fox on a failed approach. Initial retry attempt began too far away for
ordinary entry jump; corrected running approach succeeds. This is controlled
mechanical evidence, not unfamiliar-player discovery. Page endpoint and combined
route remain untested. Candidate still not ready to land; launch and anchors
unchanged. Camera/leaf occlusion ownership requested from Flint in #swarm:559.

### Lens-underside revision — 2026-11-01
Flint #567 assigned canopy-only visibility. Registered blade+ink+veins roots with
shared opening occlusion. First scan (`/captures/tallow/canopy-visibility-01`)
failed: a middle blade directly above the entry chase lens filled the upper edge
without intersecting the fox sight rays. Added a damped horizontal visual tuck
within 1.75m of the lens and .65m of blade height, restoring outside that band.
No controller, collider, spring, stem, anchor or scene change.

Retest `/captures/tallow/canopy-visibility-02`: 2/2 checks pass, errors[], actual
`window.__game.state()` retained. Inspected same entry/yaw PNG before/after:
overhead opaque band gone, fox silhouette unchanged, village now visible.
Normal-resolution route `/captures/tallow/canopy-occlusion-01` passed5/5 before
the tuck; final tuck route retest recorded separately as `canopy-occlusion-02`.
This is a bounded visibility improvement; full feature FUN/BEAUTIFUL remains
provisional pending integrated Page play. No new gait approval from stills.

Final tuck route02: 5/5 PASS/errors[], middle→high→roost plus underside walk/dash.
Inspected final high chase: leaf full width, veins and fox readable. tsc+vite PASS.
