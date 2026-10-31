# Lanternhollow dusk — historical pre-festoon design

Historical design record for pass8e04a92. Current implementation is specified in lanternhollow-DESIGN.md and lanternhollow-lantern-village-DESIGN.md; the later festoon pass supersedes the two-light count below.

Before-code scope. Driver landed cabe639 and requests lit lanterns at dusk, denser autumn dressing, believable houses and a hub orbit. Prior hub correction b791be5 awaits remote review; no personal visual approval is inferred from driver landing. Current s3-hub has fast-forwarded origin/main9840f7b.

## Mood
Keep one continuous world. Blend a restrained dusk lighting state over the southern arrival basin, using position with a smooth boundary (full at z88+, gone by z68; attenuate beyond |x|45). The realm beyond keeps its authored light values. Hub dusk lowers key2.5→1.45, hemi.65→.48, rim1.55→.9 and sky brightness to~.78 of existing warm colors, without a hue shift or exposure override. Warm horizon remains readable; sun bloom falls.22→.10 and god rays.4→.2. Fog/distant haze follows the same sky mist. No scene/time-of-day switch or hard border.

Allow exactly two low-range warm practical PointLights at the well and Bramble porch, no shadows, radius4.5–5m, modest intensity3–4. Existing .5 emissive apertures remain. This supersedes the earlier no-new-PointLights implementation choice because the driver explicitly requests a warm light pool. Pools come from real lighting, not additive hard ground discs or fake restored color. Lighting changes gradually with player position; capture state must expose the local blend for review.

## Believable houses / autumn density
Preserve all current cottage centers, route/colliders and sampled roof tops. Add short side-wall diagonal timber braces and a worn doorstep at each doorway, within the existing wall footing/collider envelope. Thicken roof fascia downwards only; move edge-beam centers down to keep beam tops at the roof surface. No new building footprint or spurious enterable door.

Place curated low autumn fern/grass clusters around cottage back/side corners, plus sparse leaf piles away from paths if existing alpha cards prove clean in returned evidence. Reuse existing CC0 nature kit; muted brown/rust, height≤.25m, no solid obstruction, no foliage in the well apron or primary route. Keep central negative space for the fox; density comes from coherent domestic edge groups rather than uniform scatter.

## Capture
Keep hub matched views and close/chase views. Add an18s low, slow village orbit framing the fox/well/cottage crescent without overriding fox poses. Include state before/after, contact sheet, camera lens labels. Hub-only preview first, plus photography regression if required. Request immutable pushed SHA remotely, personally inspect PNGs/state and obtain Opus critique before self-landing. Do not use driver merge as visual acceptance.

Domestic prop detail: one visible stack of five short logs behind each cottage's east rear corner, centered at(x+w/2+.35,z-d/2-.7), at most.6m tall. Give each stack a matching small box collider; include it in the hub path checks. This replaces the earlier buried decorative stack with an intentionally solid visible prop. Doorstep stays within the existing footing. Group low CC0 fern/grass clumps around the other rear/side corners, skip any sample within1.3m of hub trails. No scattered props across the plaza.

Opus design response applied: saved base sky clones avoid compounding; fog color follows mist while density remains untouched; position-only smoothstep weight with override and dusk targets in lil-gui. Camera hooks expose dusk values and window.__game notes retain them. Light origins moved .85m out from porch/well surfaces and flicker/fade on the realm clock without changing light count. Bramble is explicitly HUB_HOUSES[0]. Curated ferns skip trail distance<2.3m and well radius3.4m. Doorstep omitted to avoid a pass-through prop. Roof edge center shifts down to keep the enlarged fascia below its old top.

Opus source correction: orbit uses a wider30×24m context ellipse, with one fixed height selected from clearance probes and every frame logged/checked; blocked frames fail orbit acceptance. This intentionally trades the proposed low orbit for smooth context coverage; low close/chase shots remain separate. Foliage skips front corners and the solid store corner. Edge beam vertical offset now accounts for strip slope and maximum radius. Log-store collider depth reduced to.72m and lower logs sink4cm. Hub practical state reports actual well/porch intensities; a single visual updater is called by both normal and turntable render paths. All dusk targets are exposed in lil-gui.

Orbit-facing lantern correction: source review finds the existing lantern mesh has glass on only +z and +x. Complete matching panes on -z and -x so a hanging well lantern remains visibly lit from the full context orbit. Keep pane dimensions, material, emission and light count unchanged; no extra brightness or effects.

Context-orbit source audit: focal point(-7,90) lies roughly2m from a tall portal column. A ray through that column remains below its top even at the14m ceiling, so a blocked arc is likely regardless of camera footprint clearance. Move the context focal point to(-10,88),2m above sampled terrain, farther from portal stones, with a focal height above the nearby bench seat. Extend fixed-height candidates through18/22/26m. Keep the same wide ellipse,one selected height,per-frame hit records and failed acceptance on residual blockers. Low arrival/chase shots remain the player-scale evidence; the orbit is explicitly context coverage. No gameplay camera changes.

The orbit report separately records whether the coarse height search found a clear option. Full per-frame blockers remain the acceptance check.
