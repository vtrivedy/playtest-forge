# Independent world integration replay plan

Design-phase contribution, November 2. No worlds or tests below are claimed to
exist or pass. Execute against an immutable integrated commit after the shared
world/progress contract lands. Reed owns the independent replay and frame review.

## Evidence and route boundaries

The primary run starts fresh at the real opening spawn and reaches the hub using
ordinary movement. It enters all three visible world doors, solves each available
first puzzle, and returns through its arch. No teleport, forced puzzle latch,
forced ability, fixed review camera, or query-only destination counts in this run.
Keep a continuous gameplay-camera clip, entry/solution/return screenshots, full
`window.__game.state()` snapshots, input trace, source SHA and browser errors.
Label manual-clock simulation time separately from captured wall time.

Separate diagnostic runs may stage a start or malformed save. List every staged
operation in their reports; they cannot replace the continuous connectivity run.
Before a world is wired, report BLOCKED with the missing interface, not PASS.

## Acceptance cases

| Case | Action | Required observation |
|---|---|---|
| Hub connectivity | Walk into each visible named door, then its return arch | World ID changes once per crossing; destination is supported ground; all three real entrances are reachable |
| Return stability | Release controls on return and idle ten seconds | No immediate reentry, falling, residual dash, or camera excursion; useful view of next destination |
| Input transition | Cross while moving, then separately while holding jump/dash | No stale simulated key/stick; physical held-key policy is explicit and consistent; no automatic repeat transition |
| Mechanism negative | Reach finish before operating prerequisite | No level completion, ability grant, Seedwell increment or map paint |
| Real solve | Use the taught action on the physical mechanism | Visible geometry changes and collision support agree; completion emitted once |
| Earned verb | Repeat same input/target before and after reward | Previously impossible authored action becomes possible; no diagnostic ability setter |
| Failure recovery | Miss a required jump or temporary support | Safe bank/respawn within ten seconds; solved latches remain; retry is reachable |
| Temporary ledge | Stay planted until its timer would expire | Occupied collision persists or authored safe recovery works; visible warning precedes expiry |
| Reentry | Complete, return to hub, enter same world | Solved geometry and map agree; no duplicate reward; next puzzle remains available |
| Progress map | Open map before/after each solve | In-canvas names, current world and earned ability legible at gameplay resolution; only completed cells color in |
| Pause/map | Remain in menu beside an unfinished mechanism | Puzzle time and state obey explicit pause policy; menu alone never completes puzzle |
| Save reload | Reload after genuine completion | Supported spawn, solved geometry, abilities, wells and map restore consistently |
| Malformed save | Boot with invalid JSON, unknown IDs, wrong version and wrong value types | Defined safe fallback; finite spawn; no arbitrary ability/completion grants or boot exception |
| Fresh reset | Start fresh after completions in multiple worlds | All world progress resets together according to canonical reset policy |
| Scenery shift | Capture each entry with gameplay camera at equal resolution | Autumn canopy, rain marsh and winter architecture distinguish worlds without relying on HUD labels |

Unknown save key/version and map input must come from Hazel's canonical contract.
Unknown portal coordinates, world IDs and supported spawns must come from the
scene owner. Avoid inventing a competing interface in the test harness.

## Source integration hazards to retest

- `opening/worldBounds.ts` currently bakes a fixed autumn mask over
  x = [-140, 90], z = [-10, 170]. Separate spaces need explicit active-world
  ground/bounds routing; adding a visible remote island alone leaves an invisible
  movement barrier. Include new region anchors in the bounds release check.
- `lookdevPlay.ts` builds camera `sightProxies` once from initial colliders.
  Surface and lens-volume checks consult the collider array live. New or moved
  puzzle solids therefore need a deliberate camera-occluder strategy; walking
  collision success alone does not establish a clear gameplay camera.
- Controller `teleport()` resets velocity, dash and camera but does not clear
  keys/stick. Portal code must define input clearing rather than assume the
  existing diagnostic teleport is a complete world-transition API.
- `opening/scene.ts` updates all registered callbacks every tick, plus opening
  audio, paint and sky grade. Hiding an inactive world does not automatically
  suspend its puzzles, sounds or global grading. Test progression isolation and
  visual identity after returning, not just the first entry frame.
- `keeping.onSettled` has one listener slot. A new progress listener must not
  replace the existing scene callback. Consume physical transitions/primitive
  predicates without allocating complete diagnostic snapshots each tick.

## Baseline and reporting

Run existing discovery/real landing, village stuck, painted-corridor and ending
checks on integrated source. Retain GPU zero-black-frame analysis on the landing
clip. Existing baseline failures stay visible in the ledger; a new map cannot
close the blind-overlook failure or the known title-onset camera excursion.

Inspect motion as well as selected stills. Fix the worst visible problem and
retest the changed path once before calling that path accepted. Report each case
as PASS, FAIL, or BLOCKED with exact commit and artifact, and distinguish a
first-puzzle/world deadline floor from the full nine-level design target.

## Input-only probe scaffold

`tools/world-input-probe.mjs --plan route.json --out /tmp/world-route` starts the
real default opening with a fresh browser context. A plan contains `steps` with
`name`, `frames`, `stick: [x,z]`, `keys`, and optional `expect` predicates (`path`
within hooks state by default, or `source: "game"` for `window.__game.state()`,
with `equals` or `finite: true`). A step with `reload: true` reloads the same
browser context before applying its inputs, retaining genuine browser saves.
A step may also contain `press: ["Tab"]` (or Escape/KeyM) for real browser
menu key events before simulation advances. This is needed because Album DOM
listeners do not consume the controller hook key set. Menu key events never
write progress. Reload checks remain separate from continuous route evidence. It exposes no arbitrary
script, teleport or puzzle-state setter. Every step saves a gameplay screenshot,
full hook/game state, assertion results and requested simulation duration; the
report includes source commit, working-tree status, original input plan and
browser errors. This is screenshot evidence, not a continuous video recorder.

Scaffold smoke on source `7772d2bc`: one second idle then one second ordinary
stick movement. Four finite-coordinate checks passed, no browser errors; fox
moved from (-5.2, 0, 92.5) to (-4.462, 0.008, 92.468). Both 960×540 frames inspected:
fox readable, normal follow view, page teaching visible. Local artifact:
`/tmp/reed-world-smoke/report.json` and adjacent PNGs. This only validates the
probe on the current opening; it establishes no new world, progress or save PASS.
Canonical portal coordinates and state fields remain required for route plans.

Reload/game-state assertion smoke: source `5d036441` plus the probe-only change
in this commit. Fresh boot and same-context reload each advanced one fixed step;
four finite-position checks passed across hook and game snapshots, zero browser
errors. Inspected both 960×540 frames: identical supported spawn, readable fox,
normal village follow composition. `/tmp/reed-reload-smoke/report.json` records
the exact dirty-tree provenance; adjacent `0-fresh.png` and `1-reload.png` are the
reviewed frames. This validates reload plumbing only, not persistence of puzzle
progress (that runtime does not yet exist in this branch).

Menu-event smoke on `8dd37b8c` plus this probe-only change: two real Tab
presses before first snapshot, then same-context reload. Four finite hook/game
position checks passed, zero JavaScript errors. Both 960×540 screenshots inspected:
matching supported village spawn and readable fox. Evidence:
`/tmp/reed-menu-smoke/report.json`, `0-fresh.png`, `1-reload.png`. The Album is
not integrated on this source: this validates event dispatch and reload plumbing,
not map rendering, toggling, puzzle pause policy or persistence.
