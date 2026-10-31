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

Implementation also feathers out from local z-96 to-78, matching the Reach
mood's northern realm boundary so the sheet does not extend under the W1 south.

Opus critique (artifacts/opus-round38.txt): far fog is too weak to hide a sheet
edge; W1 can see east despite object clipping; straight feather and distant
ripples risk seams/shimmer. Follow-up: camera-region visibility gate in world
coordinates, noisy local west boundary, explicit450–720m distance alpha fade
inside geometry extent, ripple/normal detail fading80–240m. Forced renderOrder-2
precedes basin/curtain/wakes. Accepted risks pending GPU: perched cistern and
unshadowed distant water, fall-through scenery outside the safe route. No claim
that this fixes the bank wall or hero framing. z-boundary was added before
critique returned. Local coordinates are explicitly passed by the baked plane.
