# First Keeping: placed warmth chemistry

Source of truth: `/swarm/seed/DESIGN.md` v1 and `/swarm/seed/TASK.md`.

Rook owns the coal heat → steam → root-hearth chemistry in the shipped opening.
The existing `chem/Reactor` and `chem/createUpdrafts` remain the simulation;
no parallel reactor, new verbs, inventory economy, cooling clock, or physics collapse.
The existing H-a teach and locomotion tuning remain intact.

## Rules

- One external coal provides concentrated heat only when placed. Aura remains
  temporary color and still lights the original H-a.
- A coal placed in the shallow water warms the existing reactor and raises a
  readable pale parchment steam column. The column uses the shipped updraft
  lift, allowing jump-hold glide without a new movement mode.
- Steam reconnection latches a safe walking route. Picking up the same coal
  afterwards cannot soft-lock the player. The route persists without fuel upkeep.
- Placing warmth at the dark root-hearth ignites it permanently and emits one
  Keeping completion event. The place module authors the tree settle and bridge;
  the integration module authors the distant Crown response.
- Setting coal down keeps it burning; chemistry never consumes or destroys it.
  Existing lit hearth positions are available for rewarm feedback, with no
  ambient cooling during this sprint.

## Interfaces and ownership

`opening/chemistry.ts` will accept scene, authored steam/root targets, a placed
coal heat provider, and event callbacks. Expose state with reactor heat,
steam latch, root latch, reaction progress, and counters through `__game`.
Reuse a shared UpdraftSystem with original H-a so the controller has one lift
query. Place target coordinates and reconnection callbacks are agreed with Moss;
coal position/heat/carried contract with Tallow; runtime wiring with Flint.

## Verification

Typecheck and build exact pushed SHA. Play placement → visible steam → glide →
recover coal → root ignition; verify no repeat release and no aura-only latch.
Retain screenshots + state, review chase readability against baseline, fix worst
visual fault and retest. At least one teammate verdict before integration land.

## Authored bowl visual correction

The shared hearth defaults to a raised brazier ash bed 0.92 m above its ground.
The Keeping spring and root bowls are ground-level art. Give HearthSpot an optional
bedOffset (default 0.92) and author these two at 0.03 m, so disk, fire, vapor and
lift agree with the actual bowl. Keep spot.y as the placement floor. Steam uses
slightly lighter, stronger paper vapor for readability against the ochre cliff.

## Retire the first heat teach

After H-a records its first successful elevated landing, retire its tutorial HUD
permanently. The landing is the handoff to Carry; a completed-hearth message must
not overlap the nearby coal interaction prompt. Keep incomplete hearth guidance
and the existing successful-ride telemetry unchanged.
