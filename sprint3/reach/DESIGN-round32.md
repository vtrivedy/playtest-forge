# Reach round32: controlled ferry boarding

Verified ab04f89 controller trace: release28.63s, source38.45s, arrival40.08s, no latch. Phase11 enters ferry at20m/s; phase12 drifts3.86m beyond centre, loses support and dies. Personally inspected crossing contact sheet: fox visible at sampled frames, approach architecture dominates view. No art acceptance.

Change capture controller only: preserve real source dash, walk to ferry centre with capped proportional input, advance boarding only when within0.3m, supported by ferry0 and below0.7m/s horizontal speed. Keep natural rising ferry, source, collision, death and event-order checks. No teleport or state assignment. Existing wait waypoint remains the real height gate.

Verify Node syntax and packaging; remote immutable pushed SHA crossing run must show no death, arrival then latch and stable ferry support. Game TypeScript/Vite rechecked after main integration. No local browser/render.

Timing review: source→arrival takes1.63s in failed trace. A walking approach can meet an already rising deck. Permit the existing jump/hold combo during boarding if deck is above feet and no ferry support is present, so the capture exercises an actual boarding jump rather than walking into a raised collider. No automatic game assistance.

Opus critique of191416b confirms support gate but rejects0.6 input cap: arrival outruns walking. Follow-up uses full input until within~1.54m, then proportional braking0.65×distance. Existing added jump handles raised edge. This remains a GPU-tested hypothesis, not an acceptance claim. Saved critique in persistent artifacts/opus-round32.txt.
