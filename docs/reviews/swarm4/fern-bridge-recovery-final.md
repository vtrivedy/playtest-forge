# Camera recovery and ruin visibility — final review

Approved for the recorded camera and visibility cases. The broad replay uses
`aeaa2f1` (1.9 m opening clearance, single recovery solver, Wren's post-only slide).
The final return-fold registration and typed constructor are verified on `653492e`.
The original input route is unchanged; both experimental route workarounds were
withdrawn after the controller correction.

The natural Keeping approach previously stranded the lens 16.85 m from the
walking fox. Recovery validates complete destinations before bounding their next
step, shares swept terrain/collider clearance, and tries local detours before
holding. The accepted natural route now peaks at 2.810 m grounded follow distance,
with a minimum 44 px hero at 640×360. The bridge, walking surface and destination
remain readable throughout its reviewed clip.

## Played results

Every listed outcome and camera gate passes, with zero page/console errors.
The [acceptance manifest](fern-camera-acceptance.json) records each source and check.
Minimum hero height is measured over each whole run after its initial 1 s settle.

| Route | Verified outcome | Min hero px | Reviewed frames | Evidence directory |
| --- | --- | ---: | ---: | --- |
| Regional ledge drop | 7 real setup/fall/retry checks | 66.91 | 150 | `final-posts-regional-drop` |
| Original chase | 3 catches, 0 skips, kept and pinned home | 40.50 | 60 | `final-posts-ruin-success` |
| Missed overlook jump | Required jump beat, airborne departure and fall | 40.50 | 120 | `registered-fold-miss` |
| Natural Keeping | Steam, root heat, bridge and crag | 44.00 | 60 | `final-posts-natural-keeping` |
| Millbrook | Dam, kiln, Weir and lookout completed | 39.48 | 60 | `final-posts-millbrook` |
| Finale handoff | 7 staged live-input legs completed | — | 45 | `final-posts-finale` |
| Homeward stairs | 3 catches, return unfolded, home pinned | 40.50 | 90 | `registered-fold-home` |
| Hermitage desk | 3 lines freed, paint and caption | 74.63 | 3 stills | `final-posts-desk` |

There are 585 reviewed continuous frames: 540/540 animated-body samples retain
the strict 2% viewport margin, plus 45 visually reviewed finale handoff frames.
The desk uses three timed stills and explicit completion state. After settling, all camera-drop
runs remain above the 24 px hero floor, with no sustained small-hero interval.
The regional drop stages real dashes and placements to open the folds; the
finale stages release, ember pickup and crag arrival. Their recorded movement is
real input, but these starts do not establish discovery or an uninterrupted
whole-game completion.

The Hermitage visual verdict covers its timed desk views and verified route
outcomes. Independent 30–34 s review found a thin drying pole overlapping the
tail at the release pause while the face and torso remain visible; registering
that pole alone did not clear the overlap. Bramble’s lateral pole correction `74ce756` closes this separate angle in
Sorrel’s replay `16e91bc`; the bounded evidence review is recorded below.

## Clearance and world occlusion

Matched 1.8/1.9 m trials isolate the compressed ruin landing. At 1.8 m two frames
remain inside the screen but miss the 2% bottom padding (NDC y −0.976). At 1.9 m
all 15 matched frames pass (minimum y −0.849, about 27 px bottom room at 360 px
high); the full 150-frame drop then passes. The fox remains close and readable.
The normal boom is 2.45 m. Sorrel independently reproduced the old two-frame
failure and confirmed the 1.9 m result without relaxing the margin.

Actual miss pixels exposed a separate failure despite passing every numeric
gate: the upright return stair fan completely hid the fox at 48.43 s. Sorrel's
registration fix is incorporated with attribution. All fold pivots now come from
one constructor that registers their camera cutout, and `Fold` requires that
constructor's type. A deliberate plain `THREE.Group` substitution fails TS2322;
the restored source typechecks. The new 120-frame failed-approach clip keeps the
fox visible through the fan; all 90 homeward frames retain a readable walking
surface. The 2,700 miss and 3,300 success trace samples exactly match the previous
player/camera snapshots. Registration changes visibility, not movement or framing.

Direct comparison: `/captures/fern/registered-fold-miss/before-after.png`.
Trace comparison: `/captures/fern/registered-fold-comparison.json`.
The earlier 60-frame miss clip is rejected for visual approval and superseded by
the repaired 120-frame clip. Older stalled chase runs are also rejected; the
current miss guard requires the actual jump beat, airborne departure and fall.

## Checks and evidence

Typecheck, feel lint, production build and free/ledge/ridge/post recovery fixtures
pass; the fixtures cover 30/60/120 Hz, including collision geometry beyond its
visibility proxy. TLC passes nine ordering states. That abstraction checks
publication order, not geometric search completeness. The excessive 200 px floor
negative independently fails the shared pixel gate while other camera checks
pass (`shared-pixel-negative`, source `3ee5343`). The fold type negative is in
`/captures/fern/fold-type-negative.log`.

The successful chase records a 0.75 m jump apex, 0.30 s to apex, 0.633 s airtime,
four dashes and 2.132 m for its last dash. These are route measurements, not a
whole-game feel verdict. The cutout follow-up preserves all 6,000 compared trace
samples. No movement tuning was introduced by this camera/registration work.

All directories above are under `/captures/fern/`, mirrored under
`playtest-output/fox-spirit/fern-camera-recovery/`, and verified on the shared
`keeping-swarm4-captures/fern/` volume. They retain named source, full
`window.__game`, trace, checks, stills and source frames. Videos play the sampled
frames at 15 fps, rendered offline with SwiftShader and no audio. They establish
this bounded camera/visibility review, not real-time performance or audio quality.

## Integrated world and paint recheck

On `834881d` (clean merge of integrated `9b977fb`), the unchanged natural
Keeping route again completes steam, root heat, bridge opening and crag arrival.
All 60 crossing frames were visually reviewed: the fox and walking surface remain
readable, and all skinned-body samples retain the 2% viewport margin. Maximum
sustained grounded follow distance is 2.810 m; minimum hero height is 44.00 px at
640×360, with no interval below the 24 px floor. There are no console/page errors.
Typecheck, feel checks and production build pass. No additional camera tuning is
needed for the integrated warm paint and occluder roots.

Evidence: `/captures/fern/integrated-9b977fb-keeping/`, including the complete
110-second simulation trace and `window.__game`, four timed stills, all 60 source
frames, contact sheets and a four-second crossing clip. One initial placement
beside the hearth precedes controller input and actual chemistry progression;
there is no forced bridge release. The clip is offline 15 fps, silent SwiftShader
capture. The separate Hermitage pole resolution is recorded below.


## Hermitage pole resolution — independent evidence review

Bramble’s `74ce756` moves the third south pole laterally and retains thin
0.1 m colliders. Sorrel replayed it on `16e91bc` for 50 simulated seconds:
all three Hermitage state checks pass, all 60 body samples during 30–34 s
retain the strict viewport margin, and there are no JavaScript errors.
Minimum follow hero height is 74.63 px at 640×360; maximum grounded follow
distance is 2.790 m. This closes the pole caveat, without shared camera changes.

Fern downloaded the verified archive and independently reviewed both contact
sheets containing every one of those 60 frames, plus the native 32 s still.
The pole clears the tail and torso through the release hold and subsequent turn;
the full fox remains visible. This is review of Sorrel’s played evidence, not a
new Fern replay. The route uses one initial teleport followed by controller
input, so it does not establish unfamiliar-player discovery.

Evidence: `keeping-swarm4-captures/sorrel/hermitage-pole-lateral-thin.tgz`,
locally extracted to `/captures/fern/pole-independent/hermitage-pole-lateral-thin/`.
It includes the 1,500-sample trace, `window.__game`, state/camera checks, seven
stills, 60 source frames and clip. The raw checkpoint has `complete: false`;
acceptance uses the final `evidence.json` and successful state checks, consistent
with Sorrel’s completed-run report. No runtime code changed in this follow-up.
