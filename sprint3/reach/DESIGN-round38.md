# Reach round38 — marsh horizon beneath the cistern

Personally inspected 8148db0 HIGH-basin and hero-clear PNGs in pass38, plus
per-shot acceptance (HIGH fill1, LOW fill0, mood1, matches true). The water
still reads as a circular tank above white void. Bell visible in basin shot;
hero-clear remains dominated by two foreground pillars. No visual acceptance.

Add a separate distant marsh-water sheet at y24, six metres below the safe
LOW floor. It is scenery, never the buoyancy surface: ferry, local water,
colliders, drains, recovery and input remain unchanged. Use a broad horizontal
plane reaching fog distance, dark grey-blue shallow reflection, sparse broad
ripple bands, and distance haze via the existing scene fog. Avoid a bright
edge, circular perimeter, opaque vertical curtain or new bitmap asset.

Constrain it to the east of Reach local x156, feathering fully in by x170;
World1 west of this edge stays clear. Existing group offset applies once.
Use local coordinates for boundary and world coordinates for continuous ripple
and view response. Keep a fixed elevation: the marsh is the receiving water,
not an apparent second ferry puzzle. Depth test prevents covering terrain;
no collision because the existing authored route and fall recovery remain.

Known limitation: circular cistern banks and pillars remain. This pass addresses
the void and horizon only, pending a separately reviewed bank replacement.
Root tsc and fox Vite required. Remote reachview HIGH/LOW/hero plus actual reach
ride and window.__game; inspect PNGs and shader errors before any main merge.
No new asset/license dependency. Other-model critique required.
