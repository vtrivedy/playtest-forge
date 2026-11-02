# Independent Ashwater payoff retest

Final runtime **`2d56efb3a356144af1d742a29d04c6e3e994e04b`**, November 2, 2026. Fresh Chromium/Tesla T4/EGL at 640×360. Cedar's `f7bc0e0d` beam correction is included. TypeScript, production Vite build, feel/camera/world lint and whitespace checks pass; Vite retains its existing large-chunk warning.

**Physical route PASS, zero page/console errors. Visual verdict: NEEDS REVISION.** The stone no longer crosses the muzzle and captions no longer repeat the same line. The roof still does not read at its trigger. The close-up Seedwell beam remains a large pale column, even after narrowing and correcting its source fade; this view does not show the top or establish a satisfying world-ending composition.

## Played evidence

Fresh rendered invitation → page home → physical Ashwater arch → independent west sluice → roof detour → east culvert → deliberate sinking-mat reset → mooring/islet → drained cistern → weir flood → punt → shelf → Seedwell → native Tab Album. No teleport or progress setters. All three local/canonical levels, both canonical side memories, Reedskim and Reed fill 1 are earned; three splashes. Authored inputs test solvability, not unfamiliar-player insight.

Ashwater takes **180.183 simulated seconds**, including deliberate failure, waits, side places and the six-second walking capture. Opening takes 135.017 s. Final movement metrics: eight cumulative dashes; last jump apex 0 / air 0.05 / time-to-apex 0 is a step-down record, not a tuned jump. No controller/audio changes or feel-tuning claim.

Full hook/`window.__game` snapshots, PNGs and logs are retained in `keeping-swarm5-captures/reed/world-entry-2d56efb3a3/`; local downloaded copy `/tmp/reed-artifacts/world-entry-2d56efb3a3/`. Selected complete snapshots accompany this report; the authored inputs are in the pinned `tools/world-ashwater-acceptance.mjs`. Earlier matched route `53725b6b` also passed identically; its evidence establishes the stone/caption fixes before the beam revision.

## Personally inspected comparisons

- [Old Seedwell](../reed-integrated-440f7d47/ashwater-seedwell.png) → [stone/caption fix](seedwell-53725b6b.png) → [narrow beam before ramp correction](seedwell-cd4ce79a.png) → [final](seedwell-2d56efb3.png). The muzzle is clear; the revelation toast and place caption differ. Beam appearance improves over the broad cylinder but still dominates the close-up. Source-channel correction is established separately, not inferred from this cropped view.
- [Final shelf](shelf-2d56efb3.png): whole fox and muzzle remain clear; previous pier correction holds.
- [Final roof trigger](roof-2d56efb3.png): pale near-camera plane and translucent fox remain, visually matching the earlier failure. Registering the roof/chimney did not fix this exact view. Root cause is not established here; Cedar explicitly retains it as open.

The ramp bug was found during review: Three samples the alphaMap's green channel. White with varying alpha leaves green near 255. [Chromium pixel evidence](alphaMap-pixels.json) reproduces the fault and corrected opaque grayscale channel ramp. Cedar supplied the source fix; Reed integrated and independently replayed it.

The retained six-second, offline 12fps [walking movie](marsh-walk-2d56efb3.mp4) has [zero black frames among all 72 decoded frames](walk-blackcheck-2d56efb3.json). The [all-frame sheet](walk-all-72-final.jpg) was personally inspected. This supports bounded movement/scenery review, not real-time performance or whole-route camera/black-frame safety. The fox stays readable through the turn; peat, rain, standing water and reeds distinguish the marsh. Pools remain geometric and the landscape sparse. Requested 10–15-minute worlds, 30–45-minute game duration, blind puzzle insight and overall visual-quality approval remain unproved.
