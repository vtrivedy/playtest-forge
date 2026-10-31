# Reach round37 — timber fixed to the buoyant hull

Driver03:05 requests a textured raft. Existing Reach timber already samples a
CC0 bark scan, but worldSurfaces projects from world coordinates. A ferry moving
6m vertically slides its side texture through that scan, and the diagonal
world-space board pattern cuts across the nine real lengthwise deck planks.

Scope: add an opt-in local-timber projection to weatheredSurface and use it only
for Reach's shared timber material. Preserve existing callers. Project from
local vertices/normals, stretch top grain along local z (the actual plank axis),
and keep seam boundaries in the existing geometric planks instead of painting
extra diagonal boards. Use the existing licensed scan; no new asset, physics,
water timing, controller or collision changes. The shared timber material also
serves floating stepping timbers and fixed Reach architecture; every mesh uses
its own baked local frame. Separate shader cache variant is mandatory.

Verify root tsc and fox Vite. Request matched HIGH/LOW, ferry ride and hero PNGs
on immutable pushed SHA. Inspect actual PNGs/window.__game before accepting or
merging any game change. This fixes a concrete material-coordinate defect; it
does not claim the still-open tank silhouette/horizon failures are solved.
