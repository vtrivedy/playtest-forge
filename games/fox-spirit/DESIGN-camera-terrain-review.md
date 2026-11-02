# Hillside camera readability review

The historical blind seed2 frame at (-10.4613,57.9273) shows opaque meadow
terrain across the left of the view and part of the fox. The lens was above
terrain by 0.28 m, so point-floor clearance alone did not establish readable
composition. Current blind control follows a different path and does not
reproduce that exact pose; preserve that distinction.

First stage the known location on the current build, preserving fox facing and
the reported camera azimuth. Compare the existing 0.35 camera clearance with
0.55 and 0.8 through the existing runtime tunable. These are diagnostic camera
variants, not shipped movement changes. Retain full game/camera state and an
ordinary rendered screenshot for each. Do not hide terrain for an accepted view.

Only adopt a change if the staged baseline reproduces a material obstruction
and a candidate improves it. Prefer the smallest reserve that keeps the fox
readable without a high overhead view. A production change requires fresh
discovery including grounded landing/retry, free and obstructed release checks,
representative jumping/dashing motion, visual critique and one retest. Keep
camera body room, swept lens clearance, gradual recovery and authored cinematic
framing. Do not weaken landing gates or change controller movement to fix a view.

The staged baseline reproduces the occlusion, and both larger point-clearance
variants fail. Numeric sampling explains why: the centre belly-to-lens segment
is above the ground, while a lateral body segment intersects the shoulder. A
point-height tweak cannot fix this class reliably.

Candidate: an allocation-free analytic terrain query samples three narrow
body-to-lens segments. Use it to trigger the existing camera escape search and
score its candidates, without replacing mesh scenery occlusion, floor/volume
checks, swept travel or the existing speed limit. Preserve ordinary character
physics and authored shots. Expose the body reserve as a camera tunable and
compare small/medium/large widths on the staged hill before selecting one.
Add a synthetic cross-slope regression with a clear centre and obstructed side,
and require a clear endpoint and bounded recovery at 30/60/120 Hz.
