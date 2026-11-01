# Canopy playground — selected greybox

Current direction: Kit #swarm:398 supersedes the Carry-only sprint scope.
Selected by Flint #swarm:465: Tallow owns south-central x=-4..8/z=62..73.
No FUN or BEAUTIFUL verdict is claimed. Greybox first; route anchors provisional.

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

### Ground survey constraints (allocated; anchors provisional)
South-central meadow x=-4..8/z=62..73 is allocated, not a certified clear floor.
Existing meadow.ts rocks at (2.4,70.5), (3.6,69.3), (8.2,71) have cap collider
radii .825/.495/.605m and heights .713/.428/.523m above ground. Include fox
body clearance and missed-landing drift around those caps; testing only groundH
would incorrectly certify the retry floor. Do not silently remove scenery.
Prefer the western part of this envelope for an initial survey, keeping the
existing village-to-meadow path traversable. H-a (5.6,74.2) and its live updraft,
the east shelf/Keeping and western grove are separate occupied spaces. Leaf
footprints, missed-landing corridors and chase-camera swing need an actual
integrated scene playtest before any anchors or safe-floor claim are accepted.

## Module boundary
Tallow owns a new opening/canopy.ts and a focused keyboard probe. Scene owner wires
one construction/update call and the existing surface registry. Any controller
launch hook is a small explicit shared contract agreed before editing lookdevPlay.
Do not write directly to fox transforms or create a parallel physics controller.
Expose launch profile in lil-gui. Telemetry under opening.canopy: leaf contacts,
launches, active profile, last apex gain, airtime, landing leaf, roost visit, retries.
Rook's hidden bud may permanently reveal an alternate first entry; it must use
this same route and spring interface. Discovery is optional and cannot gate play.

### Controller contract
The controller asks onGroundContact only after ordinary top support succeeds.
Supply grounded contact position, vertical arrival speed, jump-held input and dt.
The module resolves leaf ID and allows a 0.12s load dwell before returning a
vertical launch speed; only the controller changes velocity, grounded state,
jump animation and jump/apex telemetry. Preserve horizontal velocity, air steering,
dash-drop and camera behavior. Do not inject lift into the updraft system.

Leaf boxes are one-way top surfaces: rising/underneath traversal never blocks
or lands. Collision stays at the authored top while the visual leaf bows.
Use a contact latch per leaf: one release per arrival, rearmed only after leaving
that leaf's top footprint and contact-height band. Compression is visual; collision
stays on a stable authored surface during the first greybox. A held-jump arrival
may request the strong release; a walking contact must remain walkable. Test this
against the proposed small passive rebound and remove the passive rebound if it
causes repeated hops or makes walking unreliable. Underside/side contacts never
launch. A dash crossing must not trigger without a valid top landing.

Current lookdevPlay gravity is 15m/s²: ballistic starting speeds are 8.66m/s for
2.5m gain and 10.25m/s for 3.5m gain (sqrt(2*g*h)). These are starting candidates,
not measured results: held-jump glide, jump-cut and updraft overlap affect the arc.
Measure actual apex/reach with spring leaves outside existing updraft volumes
before choosing anchors. Include held/released jump, stationary walk-on, underside
jump, repeated landing and dash-through in the focused probe.

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

## Greybox measurements (2026-11-01; still under review)
Staged entry, real Space input, unchanged gravity15: launch8.66 gives2.428m apex
at.583s; launch10.25 gives3.417m at.683s. Released jump remains stationary/walkable;
under-leaf walk does not launch. /captures/tallow/canopy-greybox-01 passed5/5;
02 passed those plus underside but FAILED the first chained landing from rest.
The 2.8m centre gap was too tight with current low-speed air steering. Revised
centres entry(-.2,71.5),middle(-.2,69.3),high(.9,67.1),roost(-1,64.7) shorten
first gaps; rise values .42/1.9/3/3.5 above existing ground are unchanged.
No passive rebound is implemented: a released arrival stays stable, while held
jump loads for.12s then springs. No scenery moves and no permanent-restore slot.
03 tests the revised chain and underside dash plus pointed/curl/ink blade fix.
No human fun or final visual approval is inferred from mechanical passes.
