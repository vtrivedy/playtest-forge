# Windmill prelude — minimal implementation proposal

Read against `russetvale.ts` on sprint-2 branch, 30 Oct ~14:00 ET. This is an edit proposal, not measured playtest evidence. Keep the world geography and existing route exits intact.

## Decision

**Ship the real wind gap first.** Convert the existing upper-terrace gap into an honest 20 m wind crossing without moving the upper terraces or Kiln arrival. Keep H0 as a clearly identified optional heat ascent for this pass. Do not claim the seven-second dash-duration lesson is implemented by its current placement.

Options considered: (A) insert a new 20 m gap at y10, requiring splitting its continuous slab and relocating overlapping y14 terraces; (B) widen the existing y14 gap toward its approach (**recommended**); (C) move every terrace after the gap outward, which shifts the already tuned Kiln launch. B changes two terrace bounds, one mill site, a wind placement and a few route points. It deliberately differs from the spec's y10 height, while teaching the same horizontal-wind rule and retaining safer recovery.

## Current geometry audit

| Item | Current geometry | Consequence |
|---|---|---|
| H0 | `sp(26.2,8.5)`, base y6, column8 | Direct optional lift to y10; no delayed approach. Plain aura can work. |
| R3 | Stumps at s23/y7.5 and s25.5/y9, t−1 | Existing non-element route to terrace y10. Keep it. |
| y10 terrace | s28–82, width26 | Continuous lower recovery under the upper chasm. |
| R4 | s36.5, t−0.6/y10 → t−9.6/y14, width2.6 | Stair top's s footprint is35.2–37.8; current y14 slab starts38, leaving a small seam. |
| Upper chasm | s52–60.5, y14, width24 | 8.5 m is inside shipped jump+air-dash range; wind currently unnecessary. |
| Middle mill | `sp(48.6,−7.6)`, base y14 | Tower is on the slab that will be removed by widening the gap. Must move with the approach. |
| Later route | far slab60.5→82/y14, R5s62.3→y18, R6s66→y22, launchs80.8 | Preserve these. |

## Exact proposed edits: wind proof

1. Terrace array's first y14 entry: `{s0:38,s1:52,top:14,w:24}` → `{s0:36,s1:40.5,top:14,w:24}`. This joins R4 and creates a launch shelf4.5 m long. Leave far y14 entry `{s0:60.5,s1:T_END,...}` unchanged. The physical edge gap is exactly20 m.
2. Middle mill site `[48.6,−7.6,14]` → `[38.8,−7.6,14]`. It remains beyond R4's stair top in the lateral direction; tower radius2.4 leaves the approach lane around t−2 clear. Remove/relocate the decorative column at `[57,10,14]` because its base would float over the chasm. Relocate the arch `[44,6,14]` to `[38.5,6,14]`; do not leave floating ruins.
3. Add `wind-terrace-gap` to `windSpots`. Source = `sp(38.8,−2)` at y14.6; radius2.8. Path points, in terrace frame: `(38.8,−2,15.2)`, `(44,−2,15.4)`, `(51,−2,15.4)`, `(58,−2,15.2)`, `(62,−2,15.0)`. Convert each using `sp`. Existing push5 / hold0.8 / spinup1 apply; do not retune fox movement.
4. Source reads at the mill's reachable stone foot / wind-bell, not the hub ten metres above the fox. Provide a visible foot-to-sails moving connection. The source must remain within the player's aura on the launch shelf. The sail update currently probes the elevated mill position: sample its foot instead, or connect its visible spin to this wind reactor's actual heat. A still sail with an active current fails the lesson.
5. Replace route section after `WS(36.5,−8.8,14)` with `WS(38.2,−7.0,14)` → `WS(38.8,−2,14,{act:'dash',label:'wind-prime'})` → `WS(39.3,−2,14,{act:'glide',label:'wind-gap'})` → `WS(62,−2,14)` → existing R5 approach at`(62.3,1.2,14)`. **Input capture must actually jump then hold glide**; the route's action label alone is not evidence. Dash prime leaves time for spinup, unlike running past the probe too briefly. Do not dash off the launch edge before jumping.
6. Keep the continuous y10 slab beneath the gap. A miss drops4 m, then the player can run back under the launch and re-enter R4. Add a recovery waypoint `(s37,t−0.6,y10)` only to the retry segment, not as an alternate success condition. At7.8–9.2 m/s, the longest≈23 m lower return plus9 m stair is≈4–6 s before handling; verify ≤10 s.

### Range / timing hypotheses to measure

- 20 m edge gap vs documented unassisted maximum≈16 m gives≈4 m separation. Exact controller distance must be measured with **same takeoff/landing height**; landing on y10 recovery does not count as success.
- Wind top speed is roughly glide speed+5 m/s, sink roughly0.54 m/s at full heat. A≈22 m centre-to-centre crossing should take≈1.7–2.1 s and lose≈0.9–1.1 m after apex. A1.85 m jump apex provides margin. These are estimates, not acceptance results.
- A fresh dash stroke6 s plus hold3 s covers spinup and the crossing. Prime source on stable ground, wait for visible leaves, then jump. No special success script or midair dash refresh.
- Full-width y14 slabs ensure the player can approach from multiple lateral positions. Current width controls the successful lane; the rest fails safely onto y10. Preserve legitimate unassisted alternate routes if later discovered; report them instead of secretly increasing gravity.

## H0: what minimal work can honestly prove

The existing H0 arrangement proves transfer of the heat rule, **not** duration. Keep its location and R3 as the immediate low-risk option, route an actual capture past H0 and up to y10, and record wake vs dash heat timelines. This supports a playable prelude now without pretending a seven-second walk exists.

A strict §3.3 delayed-launch version requires local geometry work: a3 m-deep dry pond, a rim-lit H0, and a separated launch reached on a ≥7 s intended path. A route waypoint detour on open terrace is insufficient: the player can cut across it, remain in the aura, jump over turns or air-dash the stair. The current terraces are monolithic boxes over underlying terrain, so adding a negative-y pond mesh does not carve a real pond. It requires splitting the appropriate terrace collider and cap plus matching terrain/skirts.

If time permits this second pass, use a **side teaching pocket** attached to first terrace's outer rim, with its own matching collision/mesh and safe floor3 m below the rim. Do not delete R3 or require this pocket to reach Kiln. Author the delayed route first, then measure three runs with wake and three with dash, including sprint/dash shortcuts. Target intended traversal7–8 s, wake gutter by≈6.3 s, dash output still≥0.5 on arrival. Emergent shortcut solves are acceptable but must be reported. Exact pocket coordinates should follow collision greybox play, not be fabricated here as guaranteed seven-second geometry.

## GPU acceptance before claims

- Three unassisted20 m attempts land on recovery, then three wind-fed attempts land on far y14 slab; record start/end `fox.pos`, feet-height, wind heat, jump apex, airtime and dash count.
- Approach current from both sides; record at least one cold / spinning-up / moving-leaf / glide / recovered frame, plus gameplay video and `window.__game`.
- Retry from the farthest miss ≤10 s, ≤4 m drop; camera clears moved mill and arch. Confirm R5/R6 and original Kiln glide still work.
- Explicit status: wind-gap proof can pass separately; **H0 seven-second duration lesson remains NOT ASSESSED / unimplemented** until the local pocket exists and is played.
