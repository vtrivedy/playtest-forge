# First Keeping — Carry

Source of truth: `/swarm/seed/DESIGN.md` v1 and locked sprint TASK.md.

One ember coal supports the first Keeping. It never cools in ambient air, never
slows the fox, never disappears, and continues burning when set down. Existing
jump, glide, dash, gait and camera tuning stay fixed. Pickup/place uses a
contextual E press (provisional exception to the two-action convention;
team control review pending); Space and Shift keep their
shipped behavior. Placement is grounded. Within 1.6 m of an authored steam/root bowl on the
same floor, the coal rolls from the fox into its bed over 0.35 s; elsewhere it
stays at the feet. The fox can care for the bowl from its rim without entering
the fire. Bowl placement remains recoverable from the same rim (1.75 m pickup
reach only for coal in a bowl). Chemistry reads the settled bowl position. Pickup works within a short,
forgiving radius. Holding a button never repeatedly toggles the coal.

Before an accepted dash, a carried coal is placed at the most recent safe
grounded feet position, then dash proceeds normally. Jumps do not drop it.
Recovery relocates an unreachable placed coal alongside the fox; normal walking
away never recalls it. No quest text or objective prose is introduced: a short
contextual pickup/place glyph, persistent ember glow, and a small settling spark
communicate the action. Warm amber with a charcoal crust fits the paper/cel art.
The coal rides beside the muzzle without hiding the face or authored gait.

Runtime lives in opening/carry.ts. Controller exposes onInteract/onDash/onRecover
callbacks plus surfaceAt, so scene wiring remains owned by integration. Chemistry
reads heatSource(): {position, carried, heat}. Its placed-coal reactions are owned
by chemistry.ts; Carry does not implement a reactor or Keeping latch.

Verification: live input pickup/place/hold/dash/jump/glide; compare carried vs
empty movement metrics; midair dash drops to last grounded spot; placed coal
stays lit and recoverable. Retain __game state, stills, and video; review chase
silhouette and fix the worst issue before a second capture. No claim of human
feel-gate success without unfamiliar player observations.
