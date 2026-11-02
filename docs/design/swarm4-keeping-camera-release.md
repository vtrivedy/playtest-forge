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
