# Recorder continuation discriminator

Keep the integrated gameplay unchanged. Replay the shared natural slice from its single initial wake placement, call the route on every simulation frame through 90 seconds, and retain the first `complete=true` frame plus one-second state samples. Render native screenshots at arrival, completion, and after completion. Check whether onward48 and the authored reveal precede route completion, whether finale time advances after completion, and whether the camera returns to follow. This isolates the semantics of the route completion flag; it cannot prove what Kit's external GPU recorder does. No movement tuning, forced page state, or mid-route teleports.

## Result — c731f88, 2026-11-02

`node tools/recorder-continuation-probe.mjs /captures/fern/recorder-continuation-c731f88` passed 9/9 checks. Normal boot, 60 Hz input-only shared slice, one initial placement; no page/creature/Keeping hooks. Every route input is followed by an advance even after completion. Arrival is 73.2667 s, first completion 77.2667 s. Onward48 exists at72 s. At74 s shot=0.98; at77 s and first completion shot=1.00. At82/90 s shot=0.00 and finale clock continues to90.07. Only page lantern lit, optional bucket incomplete, finite positions, zero JS errors.

Reviewed all five native screenshots (72/74/78/82/90 s): readable fox on arrival and handback, caption and hearth/updraft visible, camera has scenic well/gate view at78 s and returns naturally. No new visual defect requiring a runtime fix. This supports continuing simulation after completion, but **stopping on this completion flag cannot by itself explain a pre-reveal frozen plaza**: it would freeze shot1 with caption/stream already shown. A freeze around72 s requires another stop condition, a stale route/build, or another capture divergence. Kit's exact external GPU loop and endpoint state remain necessary. This offline SwiftShader test is silent and does not clear live GPU black frames or performance.

Artifacts: `keeping-swarm4-captures/fern/recorder-continuation-c731f88.tgz` (five PNGs and full state samples). Tool has no runtime changes.
