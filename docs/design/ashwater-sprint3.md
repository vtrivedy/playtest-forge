# Ashwater Reach — sprint 3 identity pass

Branch: s3-reach. Original procedural scenery; no new licensed downloads or APIs.

## Intent
A drowned alder wetland held between pale aqueduct ribs. Cool slate, dark teal water and grey willow silhouettes distinguish Reach from Russetvale; copper bells and sparse reed heads retain autumn warmth. Soft animated realism, restrained painterly surfaces, no neon or photoreal noise.

## Play
Keep move, jump/hold glide and dash. Existing source → water transit → six metre buoyant ferry → water-fed bell remains the critical path. HIGH floats three timber bodies; LOW exposes the ferryman lane. No orb loop, no new ability or input. Keep warning/occupied retention/no-false-latch semantics. Add measured water surface and buoyant support telemetry so screenshots cannot substitute for play evidence.

## Build scope
- Replace W1 maple placement with original bare alder/willow trunks and drooping branches, restrained copper reed beds, wet shoreline stones and waterline stains.
- Local cool-grey masonry/cliffs rather than changing the shared Russetvale kit.
- A Reach-only water surface: deep teal body, broad soft sky reflection, low travelling ripples, shoreline breakup. Avoid a white foam ellipse or opaque salmon quad. Fine contact wakes at the floating hulls communicate displacement.
- Timber ferry gets dark pontoons and pale worn deck rims; visible fixed moorings/high-water marks make six metre motion legible.
- Frame the existing reachable bell islet through a broken aqueduct and sparse willow silhouettes for a payoff vista. Decorative meshes stay outside movement lanes.
- Preserve collisions and existing timing unless code review or GPU evidence identifies a defect. No changes to fox movement, rig, world 1 or shared water shader.

## Verification
Run npx tsc --noEmit and fox Vite production build. Push immutable branch SHA, request reachview,reach,reachsafe remote GPU shots and window.__game reports. Compare baseline and after from matching views. Inspect actual PNGs personally; solicit Opus critique, fix concrete failures, request one retest. Never merge until visual and telemetry evidence reviewed. Source setup/photo cameras are disclosed staged views; route/cycle use real controller inputs.

Missing checkout references: sprint3/briefs/_style-update-1105.md, COMMON.md, sprint2/critic/STATUS.md and external sprint2 lessons/concept path. Supplied brief and docs/design/art-direction.md govern until driver supplies them.


## Pass 1 Opus response
Code critique: avoid floating water-sheet edges, rigid elevator motion, W1 maple silhouettes and warm restored masonry. Replaced the main mist disc with small bank patches; added partial cistern banks while preserving west boarding and south LOW-lane spillways. Unoccupied visual hull heave stays under 2 cm; occupied motion eases to zero without changing collision. Added support index, actual fill derivative, water surface and freeboard to Reach state. Willow/reed tips use anchored, low-amplitude breeze; bark uses existing CC0 scan with original tint.

Existing CC0 surface sources reused: Poly Haven bark_brown_02 (https://polyhaven.com/a/bark_brown_02), ambientCG Bricks085 and Rock035 (https://ambientcg.com/view?id=Bricks085 and https://ambientcg.com/view?id=Rock035). See assets/library/CREDITS.md. All added geometry/shader code is original repository work; no external model, generated image, API key or new download.

## Safety follow-up
Code inspection found that occupied retention was lost on the first airborne frame, contrary to world-2.md and W1 §1.5: a jump from a retained float could start draining the route before landing. Track the last float dependency until grounded on stable ground; retained height still never feeds the bell. Verify with a synthetic-arrival CPU invariant now and request the same case on the GPU relay. Also replace a reversed-edge GLSL smoothstep with the defined complementary form before GPU shader compilation.

## Baseline GPU review and correction
Personally inspected baseline HIGH/LOW, recovery PNG and retention sheet from 6dee8758. Water is a floating pale sheet; the floor remains a brown slab with W1 maples. Baseline recovery report proves the miss respawns in Reedmarsh (63.4,-1.97,12.6), not Reach. W1 element latches may select a distant checkpoint after the Reach bank visit. Reach now owns a visited-bank recovery fallback while the fox is in its region; main's respawn selection asks this region before the generic realm checkpoint. Expose recovery activation/point. Do not alter W1 latch or locomotion behavior.

Opus follow-up fixes: move trees/reeds off bank/shelf intersections, keep water opaque where it intersects banks and apply fog, use broken faint displacement wakes with ordered transparency, remove any occupied hull heave/dip so planted paws stay on the deck. Root knees taper away from trunks. Water rise uses the same tunable as collision. Added state fields are derived diagnostics, never proof of play by themselves.

Pass3 cross-critique: activate regional recovery on any first grounded arrival after W1 flood (north approach included), not solely within the bank radius. The remote retention test stages the north approach, not the checkpoint itself. Added root-clearance rejection for reeds, closed-bank water masking and fixed curtain-before-surface transparency order. Hull motion damps toward rest on occupation. No visual acceptance inferred from these code fixes.
Reach geometry belongs under the realm group so the existing camera scenery solver sees its solid banks and arches. Water/mist remain excluded by the solver's existing material rules. This is a scene-ownership correction, with no camera tuning or controller change.

## Pass2 GPU visual correction
Personally inspected actual 47f1bb2 HIGH/LOW matched views, vista, route sheet and end PNG. Reject: crushed stone values, circular brick tank, stick-like willow crowns, vista pointing away from the wetland. The remap multiplied linear slate by source luma, crushing floor luminance to roughly a third; preserve source luminance while changing hue. Replace tall brick bank segments with irregular cool rock buttresses (same collision footprint) and reserve brick texture for architecture. Keep broad open spillways. Replace procedural straight trunk/root cores with CC0 dead-tree variants, retaining sparse animated weeping twigs; scatter existing CC0 fallen-log accents only if needed after review. New model placement must preserve root/route clearance.

Actual traversal reached the bell ledge grounded, zero deaths, but failed the water-fed bell latch. Arrival was interrupted at fill .953–.98; the drinking Shade remains alive off the boarding line and cuts the flume. Move its patrol onto the final flume / boarding dash line so releasing it is legible and a boarding dash reliably intersects it. Do not force the bell, water or Shade state in the harness. Retest real input.

CC0 dead-tree cores reuse Quaternius Stylized Nature MegaKit dead_1/dead_2, Poly Pizza IDs Mcd2zYqyww and MlmK5488ou, https://quaternius.com/packs/stylizednaturemegakit.html (CC0 1.0), already packed in assets/env/quaternius/nature.glb. Source/license: assets/library/CREDITS.md. Willow leaves reduced from oversized half-metre pieces to roughly 13 cm. No new downloads.

## Native tree attachment correction
CPU triangle-surface inspection of the actual CC0 dead-tree bodies found 21 twig roots outside the bark beyond their 9 cm radius, with gaps up to 40 cm. The idealized straight-trunk anchor no longer applies to branched asset cores. Place all native bodies first, then project each procedural twig root to the nearest actual bark triangle before building its curve. Anchored wind weight remains zero at the root. This is a geometry attachment fix, not a visual-quality claim; include it in the final GPU retest. Pending b634b9c capture remains useful for water/palette/safety but predates this correction.

Opus attachment follow-up: seal each open twig root with a small closed bark joint centred on the native bark, and derive its curve/leaf positions from that corrected root. Restrict attachment search to native Bark meshes, retain a ±0.5m height neighborhood, and skip distant mesh bounds. Verify actual generated root-ring centres against the native bark, rather than reusing the pre-fix idealized anchor check. Measure CPU assembly time; do not infer GPU frame rate or visual acceptance.

Post-geometry check caught over-embedding through thin upper trunks with the old 9cm twig radius. Use a physically smaller 2.5cm willow twig radius and a 3.125cm closed joint at the native surface instead of inward seating; verify generated root-ring centres meet native bark and each open end has a closed joint. This also removes the overly heavy curtain-arm silhouette.

## Capture integrity correction
The reversible-cycle driver accepted any Y above a waypoint and consumed its one Shift attempt even when airborne outside a sluice's vertical interaction range. This could mislabel a flyover as LOW-lane traversal or falsely fail a healthy sluice. Advance handle phases only after observing the requested actual level; require grounded matching-height contact at the LOW vent and handles; provide a nonzero dash direction at zero-distance targets. Require an observed steam-assisted rise above ordinary jump height. All actions still use real stick/Space/Shift; never assign water, latch or Shade state.

## GPU-confirmed vista correction
Personally inspected e364e89's new vista: the lower-islet lens places a pillar across the fox and looks at the spillway wall rather than the water surface. Preserve that view only as labelled lower-islet context. Frame the payoff from the main bell ledge instead: fox(207,36,-123), camera(216,42,-134), look(184,34,-115), FOV52. The eye is above HIGH water and the fox stands in front of the arch. This is a staged photo lens, not gameplay camera or traversal proof; inspect the resulting PNG before accepting it.
Keep the original HIGH/LOW arrival lens for exact baseline comparison. Also capture a tighter matched basin pair at camera(151,49,-103), look(188,33,-120), with the staged fox on the ferry at its simulated HIGH/LOW deck heights. This removes the oversized foreground arrival slab from the establishing pair while keeping identical lenses and actual simulated water states. Photo teleports are disclosed and do not replace route proof.

## Restore the aura solution and observe stress setup
A coupled CPU run using the actual Water parcels, Shade controller and Reach inlet found that the tight boarding-line patrol never lets a held source aura latch the bell in15s. Preserve both intended solutions: the patrol crosses the boarding line, then travels far enough along the east basin to open a real supply window. The route driver may explicitly free it first with real movement/dash, then return to the source bank before starting the ferry. The isolated safety setup must observe real arrival and a partial rise before injecting its disclosed supply-loss predicate; fixed setup delays are not proof. HIGH/LOW photo setups must assert their actual fill/state instead of trusting shot names.
