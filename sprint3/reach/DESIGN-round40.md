# Reach round40 — shoreline replacement constraints

Re-read relay feedback at 07:26 UTC. It still reports 8148db0, not the
queued 77fc824 horizon/timber candidate. Personally inspected pass38's
HIGH-basin PNG and its stored state summary: HIGH fill1, water surface35.8,
raft36, mood1. Equal-height narrow slabs form a circular fence; this remains
a rejected silhouette. No current visual or controller approval.

The round36 proposal needs a collision decision before implementation.
Existing bank boxes have local X width2.2, local Z depth3.25 and yaw=-angle.
Their long local Z axis is approximately tangential, not radial. A ramp that
uses top1 along local Z therefore slopes around the circumference rather than
away from the water. Do not apply top1 to those existing frames as an outer
bank slope. The water mask and omitted samples preserve west boarding and
south LOW passage; keep those openings connected.

A replacement must keep a continuous inner wet edge above water35.8, then
transition to broad outer slate shoulders. If the shoulders are reachable,
visible surface and ground height must agree. Decorative noncolliding slopes
cannot be presented as an accessible bank. Updating collider width alone
would create invisible walls; adding geometry alone can create fall-through
ground. A proper radial ramp uses a separately oriented frame with its local
Z pointing radially and explicit shared endpoints, or requires a polygonal
ground representation. Neither is an incidental material adjustment.

Request other-model critique before choosing the geometry. Preserve the
queued77fc824 capture for an isolated horizon/timber comparison. After bank
implementation require matched HIGH/LOW, source/LOW-lane continuity, north
hero, real ferry ride and recovery evidence, root TypeScript and fox Vite.
No local rendering, new asset or license. Do not merge game changes on code
review alone.
