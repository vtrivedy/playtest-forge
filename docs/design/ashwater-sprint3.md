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

Existing CC0 surface sources reused: Poly Haven bark_brown_02 (https://polyhaven.com/a/bark_brown_02), ambientCG Bricks085 and Rock035 (https://ambientcg.com/view?id=Bricks085 and https://ambientcg.com/view?id=Rock035). See assets/library/CREDITS.md. Additional procedural geometry/shader code is original repository work. Later passes also reuse the existing CC0 native dead-tree cores listed below; no generated image, API key or new download.

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

Opus coupled follow-up: the crossing patrol overlapped the ferry, so ground sampling carried the Shade upward and contributed to the aura solve. Keep its authored U-shaped route on fixed basin ground around the north of the ferry; verify the curve avoids all moving bodies and the Shade remains near y30 as water rises. A west-bank pass still cuts the flume, followed by a clear supply window. Strengthen the safety setup to a live0.6 fill so tail water reaches full retained height; assert source shutdown, seal0 and restoredfalse. Preserve other capture evidence if setup fails. Commit a portable CPU integration tool with Shade trajectory and event timing; distinguish it from real fox-controller/GPU play.

Fixed-ground follow-up validation: `npx tsx tools/reach-simulation.mjs` reproduces actual parcel/Shade/inlet logic with native GLBs, dummy images/supports and explicitly scripted fox coordinates. The U patrol stays at y30.3 over the 30s aura run; first arrival 2.23s, latch 6.67s. Safety now starts at observed .6 fill, reaches retained 1.0 after the source is cold with no arriving parcels, holds airborne at 1.0 with seal0/restoredfalse, and drains to0 on stable ground. This closes the lifted-Shade and vacuous partial-fill CPU findings; it does not replace GPU controller or visual evidence.

Chase clearance: patrol avoidance alone leaves a 4m chase leash able to reach a float. Widen the U to local x179/195.5, north z−109, south tips z−118. Sample the exact centripetal curve against all moving deck rectangles and require ≥4.2m clearance (4m leash plus step margin). Initial geometric sample minimum4.85m. Re-run coupled water timing and full retention before publishing this follow-up.

## Driver 00:10 atmosphere / drowned trunk follow-up
The r3 critic reviewed olde364e898 and rejected the sepia sky and blue-glass wall. Later slate/eroded-bank revisions remain unreviewed, so do not infer success. Add a Reach-only spatial mood after the existing hub mood: ash blue-grey sky, grey-green mist, neutral silver fill and restrained warm sunlight; a continuous14–16m transition replaces a hard region cut and resets exactly outside Reach. Preserve exposure and all controller/puzzle timing. Move one existing10m dead-tree core to local(193,30,-111), safely north/east of the ferry, so HIGH water submerges its lower5.8m and crowns remain above the water; LOW exposes its root. No new assets. Keep immutable4a2c048 capture useful for crossing/cycle evidence; request new mood candidate only after build/peer review. Hero and matched basin views must show water as the dominant surface rather than a side curtain.

Asset/code inspection also found the new bank collider boxes rotated tangent to the basin while `rockSlab` vertices stayed axis-aligned. Rotate each bank's newly appended position and normal range around its centre by that same yaw. This preserves all existing collision and fixes exposed/hidden corners; no shared kit change.

Opus mood review found no compositing blocker but flagged the first tree location only2.2m from a mooring pier and absent trunk collision. Move the drowned core to local(187,30,-110.5): about6.3m from either pier and4m north of the ferry edge. Return native trunk colliders from scenery using the kit's measured trunk radius (plus.15m), add them to Reach's existing collision before offsetting. Match the same single trunk path used by W1; canopy/twigs remain non-colliding. Re-run coupled timing because fixed obstacles may alter Shade travel. Reviewer coordinate concern was a frame mix-up: source is local174/world104, thus fully inside the cool grade (worldx≥80), not outside it.

## 4a2c048 GPU review — crossing bearing and water edge
Personally inspected matched HIGH/LOW, new main-ledge vista, route sheet, release and end PNGs fromd69c3236cb41. Safety passes at full retained water/source cold, airborne samefill/no seal, one grounded bank recovery2.30s. Aura latch6.7s. Real event order passes, but crossing stops atphase10: a northbound source dash overshootsz−116 to−112.2, then hits the north-west rock bank while ferry rises. Fix capture approach with a real waypoint west of source(local169,30,−116), then dash east through it toward the ferry; no physics/state changes. Visible slate is lighter and trees differentiated, but water side still reads as a tall glass cylinder. New mood/drowned-tree pass is already requested but does not itself close that water-edge failure. Seek Opus visual critique before replacing the edge treatment.

Opus personally reviewed pass4 and confirms glass-curtain failure. Replace the continuous translucent wall with broken pour columns (opaque streaks separated by clear gaps), subdued wet lip and foot foam; animate streak breakup downwards, no bright filled foam ellipse. Match spillway surface radius to curtain radius to remove the overhanging glass lid. Reduce broad pale ripple/reflection contrast, deepen teal and raise central opacity so submerged floor does not read as an aquarium. Keep all mechanics/geometry collision untouched. Tighten matched basin camera to(161,45,-107)→(188,33,-120); hero lens(220,44,-122)→(190,34,-119) keeps fox207,-123 and bell207,-119 clear of the tree210,-125. Recheck visually; these are proposed lens improvements, not approval.

Route peer follow-up: offset west staging/source gate toz−115 to avoid mesh-only flume posts onz−116. Source phase becomes a pass-through gate (x≥173, |z+115|<1.2, actual source heat observed) so dash momentum cannot skip an arbitrary target-radius condition. Keep supply/source activation recorded, re-arm an unsuccessful source dash. No post colliders/timing changes for this capture fix.

## Pour/route peer follow-up
Opus code review requests metre-based falling flow independent of fill height, downward breakup of strands, a spillway edge that ends at the falling face, and a broken shore band only against banks. Keep the open falling-water silhouette pending GPU review rather than reintroducing a continuous translucent wall. Aim the source waypoint beyond its observed crossing gate. Extend CPU diagnostic to print actual native trunk radii and measure patrol and boarding-route clearances; retain real coupled timing/safety verification. These checks do not approve appearance or controller traversal.

## Round 20 — preserve reversible-cycle failure evidence
The first crossing now records half-second supply and phase traces, but the
HIGH→LOW→HIGH controller run saves only its final state and four booleans. A
missed sluice dash, an unheated vent and a failed landing therefore produce the
same incomplete-cycle message with no timed evidence to distinguish them.
Record cycle waypoint, phase age, position/velocity/grounding, level/fill,
steam heat and dash/jump issuance every half-second, at phase transitions and
at termination. Save these beside the existing cycle verdict; preserve all
controls, timeout and acceptance predicates. This is diagnostic evidence only,
not proof of traversal or appearance. Request the pushed immutable candidate
through the GPU relay and personally review returned PNGs and game reports.

## Round 27 — distinguish absent capture completion from identity mismatch
Recovered rejected archive contains rendered PNGs but no run.json or report.json.
The relay's single generic identity message hides whether a completed capture
has wrong provenance or a capture stopped before writing its completion reports.
Report missing completion filenames and individual failed identity checks in
feedback, keeping every current acceptance requirement intact. Do not accept
partial frames or infer a current visual verdict. This diagnostic-only change
must pass Python syntax and synthetic missing/mismatched/matching identity cases;
request existing immutable game candidate without replacing in-flight work.

## Round 33 — rising-ferry support evidence
Opus round32 identified missing support evidence during the height wait. Add
raftHeight to each crossing sample and aggregate every captured wait frame:
count, grounded-and-ferry-supported count, longest unsupported interval, entry
and exit height. This diagnoses loss of support between half-second samples.
Preserve controller inputs, timeouts and acceptance gates; pending GPU footage
must decide whether boarding succeeds. No visual or gameplay approval from logs.
