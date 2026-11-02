# Millbrook colour baseline — 15df7e5

PASS for the existing local mill release; no runtime change made. Runtime is merged keeping-d2 93ae360 plus Sorrel's route-tool-only e096d03 (`15df7e5`).

A single staged start at (-71.6,101.6) followed by 24 frames of real westward stick + Shift bursts the dam. After two simulated seconds the wheel is turning and painted is true. By the next two seconds the 26 m restore has almost settled; four seconds later its radius is exactly 26. Zero console/page errors. The probe stores window.__game metadata and the complete hook state at all five observations, plus all restore centres/radii.

Reviewed held, wash and settled PNGs at the same fixed camera: the mill changes from paper line art to warm plaster and golden thatch; nearby trees and the kiln also gain colour. The distant valley remains sepia. This disproves a blanket failure of the existing mill material restoration, while supporting Bramble's separately owned decision to widen the payoff. It does not establish what Kit's interrupted grand-route clip showed, nor an unfamiliar player's understanding of the dam.

Evidence: `/captures/sorrel/millbrook-colour-payoff-93ae360/` (five 800×450 PNGs and report.json). The directory name describes its integration baseline; report.json records exact SHA 15df7e5. The free camera deliberately frames the mill rather than the fox, and these sparse samples do not prove motion, chase-camera feel or audio quality. Inputs use fixed 1/60 simulation and SwiftShader; audio suspended.

Reproduce: `node tools/millbrook-colour-probe.mjs --out /tmp/millbrook-colour`. The earlier world-stills diagnostic at `/captures/sorrel/millbrook-colour-before/` is pre-release composition reference only.

Validation: `node --check tools/millbrook-colour-probe.mjs`, `git diff --check`, and the actual browser probe (exit 0). No renderer, controller or gameplay state machine was changed.
