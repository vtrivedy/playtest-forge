# Hermitage chase recheck

Pinned runtime `bd48cbd`, merging keeping-d2 `eca465e` with the accepted 1.9m
clearance and ruin return-fan visibility fix. No runtime edits during capture.
TypeScript and lint:feel (including camera release regressions) pass.

100 simulated seconds at 30Hz, 640×360, one disclosed lane-mouth teleport,
then ordinary controller input. All drying lines freed, plateau painted,
desk caption present and complete return route pass. Zero JavaScript errors.
Camera gates pass: minimum chest range 1.940m, maximum absolute pitch 35.25°,
maximum sustained grounded range 2.790m, minimum fox projection 74.63px;
no samples below the shared 24px floor.

Reviewed timed stills at 1,8,16,24,32,40,48,56,64,72,80,90,99 seconds.
Desk and caption are visible at16s; the fox is legible on the approach and
return. At32s, a foreground trunk clips the left tail while face and torso
remain visible. Its lens reports unresolved at fox(-12.315,5.173,138.730),
camera(-12.060,6.522,136.343). Sent the exact still and position to Bramble;
this is a bounded composition caveat, not a full character disappearance.
No camera tuning is warranted by these stills. The pending ridge-tree fix and
paint-wake change are absent from this named runtime and are not covered.

Evidence: `/captures/sorrel/hermitage-bd48cbd/` has window.__game, all3000
trace samples, checks and13 timed PNGs. This is access/state and sampled
composition evidence; it does not claim continuous motion, audio quality,
real-time performance, or unfamiliar-player discovery.

## Matched pole-registration retest — fd98352

Merged Bramble2f8f8a7 (including ca30642) and replayed the identical route for
50 simulated seconds. All three state checks, complete route, camera gates,
and60/60 captured animated-body screen margins pass. No JS errors; TypeScript
and lint:feel pass. Camera extrema match the baseline values above.

Reviewed every frame of the30–34s window across two contact sheets and exact
32s PNG. Pole registration alone does **not** remove the foreground upright:
it remains opaque beside the lens while the fox is standing, clips the tail,
then exits the view as the fox turns and returns. Face and torso stay visible.
This is not a visual-fix acceptance. Shared opening occlusion samples lateral
rays at−0.42/0/+0.42m; narrow near-lens geometry can lie between those samples.
Sent that source hypothesis and matched evidence to Bramble and Fern rather
than altering the shared fader during concurrent reviews.

Retest evidence: `/captures/sorrel/hermitage-pole-retest/`, including60 raw
frames, four-second15fps clip, seven PNGs, window.__game and all1500 samples.
The capture is offline30Hz640×360 without audio. The source remains frozen.

## Matched moved-pole retest — e8d2e51

Bramble700ec62 changes line three's endpoints, including moving its south pole
north along the lens-to-fox axis. The identical50s replay still passes all3
state checks, complete route,60/60 strict animated-body viewport margins,
and camera gates with zero JS errors. TypeScript, lint:feel and production
build pass (existing large-chunk warning).

Visual verdict: **NOT YET**. Reviewed every frame of30–34s in two contact
sheets and the exact32s PNG. The opaque pole now crosses the torso rather than
only clipping the tail. It continues obstructing during the hold and clears
as the fox turns away. Numeric body-margin checks establish screen bounds,
not scenery visibility. Shared camera/fader settings remain unchanged.
Recommended a lateral endpoint move to the geometry owner, keeping the common
layout source for rendered pole, collider and interaction line.

Evidence: `/captures/sorrel/hermitage-pole-moved/`:60raw frames,4s15fps clip,
7timed PNGs, window.__game,1500trace samples and state/route/camera checks.
Offline30Hz640×360, staged lane-mouth start, ordinary controller thereafter;
no audio or real-time-performance verdict.
