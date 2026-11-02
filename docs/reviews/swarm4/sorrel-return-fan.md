# Folded return fan visibility

Source `6b2cbf2`; independent audit of Fern's `aeaa2f1` miss capture found that
frames 58–59 passed body bounds while the folded southern return fan hid the
fox. The return pivot was absent from the opening occlusion registry. Register
it alongside the other ruin leaves; the existing fade handles treads and ink.

Played the original 90-second miss route at 30Hz, 640×360, with a continuous
60-frame offline clip. Actual miss coverage, expected final beat, camera size
and clearance, and all 60 body-margin frames pass; zero JS errors. Every one
of the 2700 rounded fox position/velocity, grounded, page and camera snapshots
matches Fern's baseline. Final state remains two catches, page perched/winded.
This changes visibility only.

Direct review of full-size frames 58 and 59 confirms the formerly opaque fan
now fades and the fox remains visible. Geometry bounds alone had missed this
defect. `npm run lint:feel` passes, including 30/60/120Hz release fixtures.

Evidence: `/captures/sorrel/return-fan-miss/` contains `evidence.json` with
window.__game, camera/route/miss checks, source frames and `clip.webm`.
No audio or real-time performance claim.
