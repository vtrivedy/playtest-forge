# Reach round34 — boarding transition evidence

Latest relay remains the verified ab04f89 failure, not the current walking/jump controller. Personally reopened pass32 reach-end.png and acceptance summary: checkpoint fox visible, source and arrival recorded, no latch; no current visual/controller acceptance. Existing half-second supply samples can skip the instant support is lost, and aggregate ferryWait counts cannot reconstruct trajectory.

Capture-only change: record every boarding and ferry-wait frame using the existing crossingSample schema (time, position/velocity, grounded/support, deck height, source and fill). Save as boardingTrace in reach-acceptance.json. Bound naturally by the existing 12-second phase timeout and 65-second video; do not change controls, game simulation, verdict, camera or source timing. This permits the next remote failure to distinguish late arrival, overshoot and support loss without another telemetry round.

Verify Node syntax and capture-module packaging. Retain the queued immutable round33 request to avoid restarting pending GPU work; new telemetry is available on the pushed branch for the next capture. No game code changes, new assets or local rendering. Existing round33 TypeScript/fox Vite checks apply to unchanged game code.
