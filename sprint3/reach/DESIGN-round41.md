# Reach round41 — radial shoulder decision

Current relay remains 8148db0 (HIGH fill1, surface35.8, raft36, mood1).
Personally inspected pass38 HIGH-basin again: circular equal-height columns
and unsupported curved glass edge remain failures. Horizon/timber 77fc824
still awaits GPU evidence; preserve that request for an isolated comparison.

An outer shoulder can preserve the current inner wet edge and bank collision
while replacing the exposed outer vertical face with broad slate slopes.
For each retained bank sample angle a, outward unit vector is (cos(a),sin(a)).
The ramp's local +Z must point outward, so yaw=atan2(cos(a),sin(a)); this differs
from the existing bank yaw=-a by pi/2. Inner endpoint must sit inside the
existing bank footprint, top36.4; outer endpoint must meet supporting shelf30.
Use the same planar top vertices and endpoints for mesh and boxCollider top/top1.
Do not use talus() unmodified: it intentionally adds nonlinear height noise,
changes run per lateral sample, and has no matching collision representation.
Do not use stairFlight(): masonry stairs would replace one repeated motif
with another rather than read as an eroded marsh shore.

A shoulder patch may overlap adjacent patches. Both the render and collision
must resolve the same upper envelope; inspect joins at the HIGH waterline and
LOW walking view. Existing west/south omissions apply to the entire shoulder
footprint, not only the centre angle: a broad ramp must not close those gaps.
The north/east bell shelf and south causeway are explicit overlap hazards.
Before implementation choose dimensions after other-model critique and a
CPU footprint probe of source approach, LOW lane and bell landing. If safe
shoulders cannot fit, implement a shared polygonal surface/collider together;
do not quietly widen invisible boxes or dress a fall-through bank.

GPU acceptance remains matched HIGH/LOW, west arrival, north hero and real
ferry ride with PNGs plus window.__game, zero shader errors; root tsc and fox
Vite required. No visual acceptance from this design or numerical checks.
