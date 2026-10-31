# Reach round36 — shoreline failure isolated

Verified evidence: pass31/evidence/reachview-high-basin.png at ab04f89,
with its matching HIGH fill1 / mood1 report. Personally inspected again at
07:08 UTC. Cool slate/daylight is visible, but the bank reads as a tank:
roughly equal circular rock tops form a repeated vertical wall above the lower
floor. This is a specific silhouette failure, independent of the pending
real-controller boarding correction.

Source: ashwaterReach.ts bank loop uses 24 angular samples, fixed top36.4,
bottom29.4, width2.2 and depth3.25. Its openings match reachScenery.ts spillway
shader. Randomly changing only bank heights would expose HIGH-water holes;
shrinking colliders independently would create invisible walls. Neither is a
safe isolated fix.

Next geometry pass: replace repeated bank faces with joined, sloping slate
buttresses behind the existing wet edge. Preserve the inside contact envelope,
HIGH water elevation36, west boarding gap, south LOW lane, bell approach and
existing stable-ground recovery. Use broad irregular outer slopes and shared
wet-edge elevations rather than isolated equal caps. Update visible geometry
and collision together if the playable envelope changes. Keep the current
water/spillway mask until a paired bank-edge proposal establishes continuity.
No new asset or license required. No additional tree mass to hide the failure.

Before implementation: other-model critique of bank/collision proposal. Then
root tsc and fox Vite; GPU matched HIGH/LOW basin plus west source and north hero
comparison, with per-shot window.__game and sampler-error check. Inspect all
PNGs, fix concrete defects, retest once. Current crossing capture remains first
priority and queued unchanged; no current visual or controller acceptance.

This round integrates current upstream and records the measured design failure;
it does not alter bank geometry while revised boarding evidence is outstanding.
