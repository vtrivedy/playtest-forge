# Carry verification — Tallow, 2026-11-01

Source: 8ca889aa2433ba2b8c3163bc651a2e2096187a44 on sw3-tallow.
Typecheck and Vite build pass. This is mechanical acceptance and an initial art
review, not an unfamiliar-player feel gate or a complete Keeping route clear.

Evidence: `/captures/tallow/carry-wired-03b/` contains five chase stills, one
explicitly staged front inspection lens, a WebM and `evidence.json` with opening
`__gameHooks` state. The probe uses real keyboard input and manual simulation
steps, with staged starts/reset positions disclosed in its report. Its WebM is
a stepped inspection recording; use the integrated chase route for animation
and uninterrupted action feel judgments.

Nine checks pass: holding E picks once; jump preserves Carry; airborne dash
both drops and dashes; coal remains at grounded height; pickup recovers it;
grounded E places; heat stays at one; position stays fixed; and carrying/empty
acceleration matches (2.099m/s after20 frames). Independent Rook reproduced the
same nine checks on pre-readability integration a1469fc (chat :69).

Visual review: centered muzzle coal was hidden behind the fox's head. Moving it
to the mouth corner exposes a warm charcoal silhouette beside the cheek while
preserving the ears, face, tail and authored gait. A lower final offset avoids a
coal beside the eye. The front inspection lens encounters existing shelf rocks,
so close contact still needs review in the authored route's clear space.

## Feel critique — 8ca889a
Verdict: NEEDS REVISION

Concrete remaining review gaps:
1. No full-speed continuous chase video of the new carried pose through turns.
2. Existing boulders constrain the source inspection lens; review final cradle.
3. E is a provisional third-action exception, explicitly documented in design;
   the two-action convention needs a final team/driver decision.

What works: pickup/place respond on the first frame, held input cannot repeat;
dash-drop never consumes or cools coal; movement parameters are unchanged.

| Item | Pass? |
|------|-------|
| Safe drop / recovery / persistent placed warmth | yes |
| No movement speed penalty | yes, numerical comparison |
| Coal readable from chase view | improved; route review pending |
| Feet plant / gait cycles | inherited; continuous route review pending |
| Body + tail follow-through on turns | inherited; route review pending |
| Jump / dash weight | action state verified; continuous review pending |
| Retained capture + __game state | yes, staged probe |
| Unfamiliar-player discovery and emotional read | not assessed |

Next: authored route capture, teammate before/after verdict, then honest human
feel-gate status. No extra content until Carry is acceptable.

## Final Carry offset retest — 4b2b797

Rook rated the initial fix MARGINALLY (chat80): the exposed coal was a sliver.
Final tuning uses lateral .27m, forward .18m, lower .07m and the original .115m
radius. A larger .13m trial hid part of the face from the contact lens and was
rejected. The final front still preserves both eyes and muzzle; the chase still
shows the charcoal body outside the cheek. Source cradle is now Moss's clear
(15.1,77.4) position. Rook verdict (chat118): CLEARLY BETTER vs8ca889a after reviewing both
chase and unobstructed contact stills; visual sign-off only, continuous route
completion remains pending.

`/captures/tallow/carry-final-06` passes10/10 assertions, adding held-jump glide
and actual W-key acceleration comparison. Both runs reach2.099m/s after20f.
Recorded held-jump/glide apex .792m, time-to-apex .317s, airtime .717s; ground
projection of the air dash2.0m. These describe the scripted staged probe, not
unfamiliar-player discovery or the uninterrupted Keeping route.

Modal quick on8bd34af342e206ca2e52ef57560487e525612606 completed71.64s,21 opening
stills with __game trace, no video. Job quick-8bd34af342-180820-166406. Inspecting
03-run confirms preserved opening style. Final integrated hero is still required.

Capture lesson: `/captures` is already remote-backed. Never download a Modal
volume into it to refresh a stale view: use an existing directory under `/tmp`.
An attempted download damaged only Tallow's own earlier quick8ca889a result;
it was replaced by the successful8bd34af capture above.

## Stair integration regression — f2fdac8

Merged Moss 5b028e5 (curb + reconnectSteam stair) into the approved Carry branch.
TypeScript and Vite production build pass. Live browser probe passes all ten
Carry checks, no page errors; actual W-key speed is 2.099 m/s both carrying and
empty-handed. Screenshots, video and window.__game snapshots retained under
`/captures/tallow/carry-stair-07/`. Reviewed 02-carried chase still: charcoal body
still clear beside cheek, fox silhouette preserved. Initial/per-comparison
teleports and the front inspection lens remain disclosed staging; this probe
checks Carry regression, not stair traversal or continuous route completion.
Rook owns stair ascent/descent verification; Flint owns full-route capture.

## Final stair + canopy regression — 551258f

Merged Moss c126b5e. Exact TypeScript and Vite production build pass.
Live Carry rerun `/captures/tallow/carry-final-stair-09/` passes all ten checks
with saved window.__game snapshots, screenshots and video. Earlier attempt08
ended signal143 before saving results and is not counted. Staging disclosures
remain the same; this is not a continuous-route or unfamiliar-player claim.

Reviewed `/captures/tallow/keeping-final-art-08/{root,bridge}.png`: CLEARLY BETTER
than the canopy-blocked exit. Trunk line and far-crag gap read clearly; bare
limbs and falling leaves preserve the autumn mood. Staged Keeping snapshot:
phase bridge, bridgeTop9.577, crownLobes0, stair open. The separate `across`
free-camera still catches a near-camera leaf card; normal root/bridge chase
views stay clear. Rook owns physical stairs, Flint full-route/hero evidence.

## Rim placement and muzzle contact — Kit337/348 follow-up

Bowl placement8b92dff: explicit E within1.6m on the same floor rolls the coal
into the steam/root bed over0.35s. Same-rim pickup reaches1.75m only for coal
in a bowl. Reviewed07-steam/root in `/captures/tallow/carry-bowl-rim-11`:
coal centred and fox outside the fire; spring pose upright at the staged1.4m
approach. All16 real-input checks pass, including existing ten Carry checks.

Compared lower-muzzle variants A(.09side/.13forward/.055lower/.085size) and
B(.045/.13/.065/.075) in `/captures/tallow/carry-mouth-variants-12`.
Selected B; actual final also follows animated head orientation. Placed size
stays.115 for basin readability. Final close-up shows jaw contact with both
eyes visible, replacing the detached cheek coal. Direct rear visibility is
reduced; continuous-route side/turn readability requires Flint's integration
review. Final `/captures/tallow/carry-mouth-final-13` passes16/16, no page
errors, with screenshots, webm and __game states. Staged starts/inspection lens
remain disclosed; no continuous-route or unfamiliar-human claim. No gait edit:
the spring's original hunched/post collision still needs route-context review.
