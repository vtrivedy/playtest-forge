# Keeping camera reacquisition

Kit's d03831b route review reports the chase lens remaining at the terrace hearth
from roughly 42 seconds through the bridge and Crown payoff. Preserve the existing
route, controls, normal boom, collision clearance and pounce framing.

Reproduce with the natural Keeping route (one disclosed initial placement, then
real controller input). Inspect rendered lens and fox positions across the release.
A traversal camera must return to useful follow range after escaping an obstacle;
collision safety alone is insufficient if the lens remains parked behind the player.

Use a bounded continuous escape/release where possible. Any recovery must retain
body room and avoid ending inside world geometry. Keep authored story shots separate.
Add route acceptance for projected fox height, using a documented 0.8m body-height
proxy and a 5% viewport-height floor outside the initial settling second. Preserve
full state, screenshots and a continuous payoff clip. Recheck the failed-catch
regression and review the worst frames, then replay once after correction.

The inherited full-page route currently stalls at `back for the climb`, before
the overlook jump. Reject it as missed-jump coverage even if camera math passes.
Require the requested jump beat to be observed when using `--miss-overlook`.
Use a separate disclosed ledge-drop probe: two real dash actions open the ruin
folds during staged setup, then place the fox once on the second leaf and walk
off toward the overlook without jumping. Record the fall and jump retries with
normal follow camera; never force page catches, physics, folds or restoration.
This is a regional collision/framing test, not a full-page completion claim.

Integration selects Fern's camera envelope and release fixtures from `671a290`,
superseding the independent Sorrel solver. Use the game's shared
`__gameHooks.foxScreenPx()` and `tools/lib/fox-size.mjs` gate; remove the candidate's
separate 0.8m projection. Retain trace-based regional checks and explicit
missed-overlook coverage. Recheck natural Keeping and the staged ledge drop on
the merged source, including the controller correction for the old route stall.

Final padding selection is 1.9m minimum body clearance. The integrated 1.8m
regional replay fails two strict-margin frames (bottom NDC −0.976); the matched
1.9m replay passes all 90 recorded frames and all seven actual-state checks.
Original missed-overlook coverage on Wren's post-only slide correction also
passes all 60 recorded body frames at 1.9m. Keep the normal 2.45m boom and the
2% screen-margin gate unchanged; adopt the tested minimum as the default.
