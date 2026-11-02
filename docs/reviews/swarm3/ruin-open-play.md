# Ruin open play — 2026-11-02

Runtime candidate: `5a52adf57ea8a0a5fae21bb44980757d69ff25e5`. The ruin landing now stays open around the creature during the reproduced off-route orbit. This follows Kit1391's game-first direction; no filmed-route extension or new capture tooling belongs to this patch.

Two equally tall piers and their six arch blocks became unequal broken remnants with three smaller shoulders at the far edge. Each support, pier, shoulder, foot and guard housing participates individually in the existing sight-blocker cutout. The undercroft uses lighter cool weathered stone. The overlook reuses the original illustrated paper print instead of a blank top; the print belongs to the terrace so both fade together. Every collider, route surface, movement value and fold timing is unchanged. No shared camera source edit was needed.

## Played checks and visual review

The existing real-input local route stages its initial entry only, then uses the actual jump/dash controller. Baseline, first variation and final exact-SHA retest all pass10/10: first/second fold, both landings, deliberate miss and recovery, overlook reached, return open, meadow ground and retry entry, no JavaScript errors. Final held jumps retain0.792m apex,0.317s time to apex and0.483–0.683s airtime across the original attempt and retry; three dashes are used, with the final dash measuring2.0m. The route's last drop is0.4s; it is not a held-jump measurement. These are unchanged mechanics, not a fresh global gait or human fun certification.

Baseline06-overlook puts huge post walls at both screen edges. Final matched06 exposes the fox, inked landing, other leaves and meadow. The floor illustration stays quieter than the creature. After the first replay, the print was parented to its slab to prevent a floating ink overlay during fading, then the full local route was replayed. Entry, second unfolding, overlook and return screenshots were inspected.

Tallow independently reproduced the original failure by orbiting off-route: the overlook3 view was nearly all pier wall, with the fox hidden despite camera collision reporting clear. On exact5a52adf he repeated48 matched states at four positions and individually reviewed16 stills. His verdict is **CLEARLY BETTER** for the reproduced ruin visibility failure; the fox remains readable in all16 inspected stills. Positions are identical, minimum camera-to-feet range2.502m and maximum lens-to-feet elevation46.703° are unchanged, and errors0. Those range/collision numbers alone do not prove visibility. The diagnostic's under-terrace start actually lands atop; no genuine undercroft or global camera claim follows.

Exact TypeScript and Vite production build pass. Vite retains its existing large-chunk warning.

## Reproduction and retained checks

```
node tools/pop-up-ruin-probe.mjs /captures/rook/ruin-play-open-final
```

Local final screenshots/controller state are linked under `playtest-output/fox-spirit/ruin-play-open-final/`. Shared volume `keeping-swarm3-captures`: `/reviews/rook-ruin-open-review/{before,first-variation,final-5a52adf}/`. The first variation was an uncommitted intermediate runtime; only `final-5a52adf` is the exact named candidate. Tallow's independent orbit artifacts: `/captures/tallow/ruin-camera-orbit-5a52adf/`.

No new asset/license, audio, camera override, puzzle, reward or movement change. Original code-authored illustration and kit geometry only.

## Full slice context and separate open camera report

The existing slice input route on exact5a52adf retains4651frames/77.517s, three catches/zero skips, all folds open, return1 and the page pinned at the well, final grounded. The saved summary explicitly reads window.__game mode/state. All58 chase stills plus the complete controller/camera trace survive; no PAGEERROR/CONSERR log hits. Restored44-meadow view was inspected: both broken shoulders sit beyond the fox, the printed page is legible and warm, and the meadow is exposed. Gate/well late views are comfortable. Four dashes, last1.998m; last jump0.792m apex/0.317s time/0.667s air. The process reports143 after writing the final summary/end log; clean teardown is not claimed.

This replay does **not** reproduce Kit1445's separate72s wall close-up. Here60s is already the homeward grove;72s is beside the well with boomT1/floorLift0/blockedfalse. Maximum late lens-to-chest angle28.697°,33 blocked frames in the gate interval. Same route/camera/ruin source as integrationd21c48c. Tallow is investigating the actual reported input/state; the geometry pass is accepted for its reproduced obstruction, not as universal post-catch camera clearance. Full local check: `/captures/rook/ruin-open-slice-5a52adf/`.
