# Sprint 3 camera — readable fox, gentle traversal

## Purpose and current contract

Keep the burnt-orange spirit fox readable at a restrained three-quarter chase angle, roughly quarter-screen height and in the lower third during grounded movement. Preserve steering yaw, gameplay physics, authored restoration paths and explicit photo cameras. No new assets or licenses.

- Query solid scenery double-sided without changing rendered materials. Keep moving/instanced geometry live, retain material-array groups, synchronize static query chunks, and skip hidden ancestors.
- Detect actual crown/leaf materials as well as coarse proxies, with chest plus a cycling silhouette sample, at most two foliage sight lines on tested frames. Stop on the first mesh hit.
- Initialize the fader after all world builders (water/growth/inlets included), wrapping their completed shader hooks. Fit cutout bounds after the final photo-camera override, once per rendered frame. Detection telemetry is not visual proof.
- Reactive celebrations only accept subjects within12m of the hero and yield on running. Keep their authored azimuth at steering yaw+.79rad independently of chase side bias. Authored restore paths retain their separate contract.
- Grounded chase distance blends3.8m idle toward3.0m at speed; compare3.0/3.3m CPU proxies. No run-FOV widening; sideBias.55rad. Aim-only framingHeight.65m places the chest lower without moving collision focus. GUI exposes both new tunables.
- Preserve body room against spring lag by expanding a copy of the rig to minDistance BEFORE the solid-scenery test. The existing scenery compression/fade then has final authority; do not push a compressed camera through a wall afterward. The spring state remains independent.
- Terrain fallback uses a2.6m minimum boom and explicit cutout signal instead of torso-only fixed-fraction compression. Reactive-shot sweeps opt out. Keep the final floor guarantee; report floorLift separately from the restrained.9m sweep lift. CPU pitch/ear/foot gates do not prove a smooth authored stair transition.
- Landing-preview crane lift shares the descent weight already used by landing aim: zero while rising, partial during shallow descent, full by-4m/s. The lift remains damped. Intermediate wind/glide sink weights are intentional and require remote landing/apex review.
- Reduce the extra composition offset only for sustained descending flight (airTime.75→1.5s), with its own damped weight and gentle release after touchdown. This keeps short hops from nodding the new grounded composition and prevents a velocity-reset snap in this framing offset at landing. Landing aim, glide distance and gameplay prediction remain unchanged.

## Captured failures and established evidence

Personally read shared fox8a975c2 and camera f5cc385 restored run/idle plus sepia run PNGs and report/window.__game. Restored run became an elevated panorama: camera≈28m from fox, shot=.24, path=null, photo=false; turn shot=.53. Sol/Opus agree that e5459df retest visibly fixes the panorama (shot0.00, readable run/turn), but motion fox is only17–18%height near NDCy-.10, short of the director composition target. This is partial proof, not route acceptance.

Camera70df617 route:1800 frames/30s, no deaths/assists, whole-realm budget failure at wp23/84. All-frame crops plus original critical-frame review identify unreadable grotto silhouette771–799 (wholly absent780–794), cropped head/ears1094–1139, fog-obscured lower body around630–700, and overhead updraft arcs180–420/1300–1400. The frame780 blocker is createWater's grotto roof, originally built after the fader patch. Positive ascent velocities at180/1320/1380 establish the inappropriate ascent crane lift. These failures motivated the later fixes; they have not all been visually accepted.

## R2 route prerequisite for an honest camera proof

e5459df also returned a genuine wp12 stall: fox(-54.834,2,41.957), terrace frame(s12,t1.89,y2), against the y6 terrace wall. R2 flight ends(s10.5,t2,y6), while the upper terrace starts at s12. Old waypoint11 at t2.6 is consumed before the stair top, allowing a turn into unsupported space past the ramp end. The stair itself extends to s11.8, so the literal transverse slot is.2m, not1.5m.

Final supported landing: centre(s10.6,t.4), width3.2 across t, length2.8 along s, top6/bottom1.5, roughness.3 using the existing slab/material system. It spans s9.2..12.0 and t-1.2..2.0, meeting stair and terrace without a coplanar terrace overlap. Move waypoint11 to(s10.5,t.5,y6), putting its entire.9m consumption disk on the apron. Onward support is continuous to waypoint12. Production CollisionWorld line sampling reports38/101 samples below y6 before, zero after. Opus source review confirms geometry/orientation; GPU still must check momentum through the turn and edge clearance.

Changing this waypoint changes route-length-driven litter counts and later seeded dressing. Do not represent foliage as pixel-matched camera-only evidence, and do not retain a legacy route for decoration. No teleport, assist, progression, physics or verb change.

## Validation and remaining acceptance

CPU probes cover back-face solids/crowns, exact material restoration/groups, moving props, hidden ancestors, shader-hook composition, local/remote celebration and run yield, terrain2.2/2.6/3m variants, ascent/wind/glide/full-descent lift, grounded composition and backpedal/off-axis motion. Run tsc and fox Vite build for game changes. No local browser/game rendering; offline decoding of remote video is permitted review preparation only.

Push immutable candidate and request remote natural-start route through upper Windmill (exclusive waypoint24,60s budget) plus restored/sepia fox run/turn. Verify actual duration>=30s, zero deaths/assists and endpoint reached; a whole-realm time-budget failure is different from a reported stall. Short<=60s route captures retain every frame's state plus bounded shader/matrix PNG diagnostics. Personally inspect images/video and window.__game; annotate readable frames/total with exact failures, not merely NDC/detection flags. Target>=95% readability, no torso clipping, porthole view, top-down turn or disruptive floor/apex/landing pop. Get Opus image critique, fix and retest before self-landing. Request exact2e0e614 baseline separately; relay baseline_ref metadata does not execute that comparison. All critiques and capture annotations remain in persistent stream artifacts.

Driver23:40 prioritizes a passing scripted chase segment while route evidence is pending. Use the existing `feel`60s live-input loop plus fox run/turn shots at30fps to match the exact2e0e614 baseline now returned by capture stream. One staged start, no photo override during movement; this is not the natural hub-to-Windmill proof. Preserve its input function unchanged and add per-frame trace retention for exact image audit. The `showcase` harness is excluded from follow-camera proof because it applies an afterStep tracking-photo override despite its camera label. Keep the separate natural0..24/60s-budget route request ready after this composition comparison.

## Follow-up from personally inspected 24dd capture

The R2 apron is traversed without an assist or death. The run/turn composition and grotto visibility improve, but Opus rejects final acceptance: the cutout removes supporting terrain beneath the fox, and updraft frames remain overhead. Preserve floor fragments at/below the fox's feet while still fading raised walls/roof: reconstruct fragment world height from view-space position, and ramp cutout eligibility between feet+.02m and feet+.20m. Store feet height in the existing shared uniform's fourth component; no material-name exceptions or second render path.

The main loop separately raises ride-camera height by2.4m, overriding the restrained camera implementation. Reduce that bonus to.4m while retaining full vertical tracking and existing damping/distance behavior. This needs an actual updraft image comparison; source geometry is insufficient.

The latest honest route stalls at waypoint21 after circling at1.10m with a.9m acceptance radius. Apply analog ground approach braking inside3m for ordinary running, preserving full airborne and queued-dash input. Keep waypoint tolerance, physics, geometry, assist accounting and the matched feel-loop inputs unchanged. This is harness navigation, not a camera quality claim. Remote natural-route completion remains the validation.

The three ride-modulated camera controls (height, jump tracking, glide distance) currently bind to values overwritten every frame. Bind their GUI controls to the persistent base values, captured before GUI creation, so tuning survives the ride blend. Keep effective values damped in the existing update path.

Opus source review rejects blanket distance braking: it changes speed on straight route segments and risks action takeoffs. All action waypoints are now exempt. Refine the remaining approach cap using target bearing and the same maximum ground yaw rate as locomotion; blend in only for meaningful heading error, with a turn-radius safety margin. Straight travel retains full stick. This changes bot inputs, not player turn physics. Observe wp21→wind-gap takeoff speed in the next trace.

Opus also flags near-camera stair treads above paws: extend floor protection using the existing unperturbed surface normal, transformed back to world Y. Preserve upward-facing fragments within the controller's .6m step-height neighbourhood, tapering .45→.65m; taller surfaces/roofs remain eligible to fade. Insert the cutout after standard normal initialization to support both flat-shaded and smooth/instanced meshes, before normal-map perturbation. Remote stair/slope review remains required; this bounded guard cannot establish arbitrary-terrain acceptance from source alone.

## Crown scenery query coverage

Source inspection while147c5f9 awaits capture finds a concrete coverage gap: camera snapshots solid meshes under world.group, but Listening Crown builds its group directly under scene. Its decorative arches/bowl/seat have no matching solid colliders and cannot trigger boom clearance; the shared fader alone does not discover these decorative solids. Ashwater Reach already nests under world.group.

Nest Listening Crown under the same realm root before camera construction, preserving identity transform/materials/geometry/progression. Retain the scene argument used by its inlet builder. No scene-wide camera query (which could include the fox/VFX), duplicate roots or extra render path. Existing canopy detection remains scene-wide. Request a separate Crown live-camera roundtrip/walking capture on the pushed follow-up; hub route/feel capture147c5f9 remains useful because this changes only the far Crown region. Opus source review and tsc/fox build required; Crown image approval remains separate and pending.
