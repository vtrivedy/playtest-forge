# Canopy playground — proposal, not selected

Current direction: Kit #swarm:398 supersedes the Carry-only sprint scope.
Pitch/debate: Tallow:402/:407, Rook:405/:409. Await Moss/Flint pitches and shared
selection before runtime work. No FUN or BEAUTIFUL verdict is claimed.

## Player experience
See a broad leaf hammock above a safe clearing. Jump onto it, feel it bow under
weight, then hold jump as it springs the fox toward a higher leaf. Steer through
three forgiving landings. From the second leaf, spot a secluded roost and choose
a shorter dash/glide cut. The reward is a new viewpoint and a connected route.
No timer, cargo requirement, collectible quota, or repeated switch sequence.
Reference: Spyro flight-route mastery and Mario Odyssey optional movement routes;
borrow expressive route choice rather than specific characters or level art.

## Controls and failure
WASD + jump/hold-jump glide + dash. Landing gives a small rebound; holding jump
commits the strong spring. Walking across a leaf must remain possible without
an involuntary full launch. Misses land on walkable floor, with an obvious short
return to the first hammock. No fall may reset progression or require coal.

## Greybox decisions to test
Compare two launch profiles using the unchanged current controller baseline.
Target first-pass apex gains: gentle 2.5m and lively 3.5m above the hammock;
solve launch speed from current gravity rather than copying world-scale guesses.
Choose spacing from measured held-jump/glide reach with at least 30% landing
margin. Broad first landing, higher second landing, optional roost cut from second.
Exact anchors require the integrated candidate's safe ground and sightline survey.
Do not add an invisible launch volume that can fire through a platform underside.

## Module boundary (proposed)
Tallow owns a new opening/canopy.ts and a focused keyboard probe. Scene owner wires
one construction/update call and the existing surface registry. Any controller
launch hook is a small explicit shared contract agreed before editing lookdevPlay.
Do not write directly to fox transforms or create a parallel physics controller.
Expose launch profile in lil-gui. Telemetry under opening.canopy: leaf contacts,
launches, active profile, last apex gain, airtime, landing leaf, roost visit, retries.
Rook's hidden bud may permanently reveal an alternate first entry; it must use
this same route and spring interface. Discovery is optional and cannot gate play.

## Animation and visual gate
Leaf stem carries the loading motion: downward bow, asymmetric curl, quick release,
then damped settle. Fox uses its existing landing and jump poses with a readable
load/release beat; avoid sustained rigid stance or skating. Leaf has a broad matte
PBR top, legible curled rim and underside veins; warm highlights separate it from
cool tree silhouettes. Camera must show the next landing during the release.
Keep silhouette readable in the un-restored palette and through restored foliage.

## Retained evidence and kill tests
Real keyboard route for each profile, state trace/window.__game and screenshots
at first contact, maximum compression, launch apex, second landing and roost.
Staged starts are disclosed; no teleport counts as a chained clear. Retain ordinary
jump baseline. Review screenshots, fix worst issue, retest once. Need two teammates
independently judging FUN + BEAUTIFUL before landing, per Kit:398.
Cut or revise if holding jump obscures intent, repeated automatic bounces trap the
fox, the next landing stays offscreen, or the chain is less enjoyable than ordinary
jump/glide. A successful script alone cannot establish human fun.
