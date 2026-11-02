# Independent Hermitage access review

**85a5cfa fails the authored north lane.** The production bundle boots without JavaScript errors and the first uphill bend completes. The next leg stalls at (-13.241, 1.270, 110.477), 4.233 m short of (-14.2, 114.6), despite 15 simulated seconds of movement input. No teleports occur after the staged start at (-9.7,102.3).

The screenshot shows the fox facing a rock in the trail. Source locates a root-step rock at (-13.6,111.2), with radius .55 m and cap height .475 m; it intersects the authored NORTH_LANE segment. Terrain-only `paths-walkable` passes because it does not include prop colliders. Bramble notified with exact coordinate and evidence; move the rock outside the trail rather than increasing controller step height.

Evidence: `/captures/sorrel/hermitage-access-85a5cfa/evidence.json` contains the full trace and `window.__game`; `north-lane-desk-lines-return.png` shows the blocker. [Compact baseline](baseline-85a5cfa.json). TypeScript, production build and lint:feel pass on this source. Those checks do not establish route access.

`tools/hermitage-access-probe.mjs` is the repeatable production input route. It visits the desk and three drying lines and returns through all lane bends. It requires every leg, finite coordinates, no JS errors, all lines freed, plateau painted, and the desk caption. Arrival and return screenshots must be reviewed after a fix. This is an access/interaction check, not a continuous motion or audio verdict.

## Proposed clearance fix — 2e5bdb0

Moving three root-step rocks aside clears all 20 input-driven legs through the lane, desk, three drying lines and return. All three lines free, the plateau paints, and the desk caption triggers. Coordinates remain finite and there are no JavaScript errors. [Compact evidence including exact tested source diff](rock-candidate.json); [patch](rock-clearance.patch). Runtime tested was production85a5cfa plus exactly this source diff; 2e5bdb0 commits it. Full evidence and screenshots: `/captures/sorrel/hermitage-access-rock-candidate-v2/`.

I reviewed desk arrival, released leaves and village return stills. The fox body is visible in the arrival/release samples, but the village return ends facing a cottage step that obscures its head. The desk arrival is visually weak: a faded foreground post crosses the frame, and the desk is outside the useful view. The line release sample clearly shows the fox but not a wide establishing view. This passes access and interaction state; camera composition still needs Fern's review and a continuous clip. Fix offered to Bramble as a single commit for integration; the integrated production tree must rerun this probe.

## Independent production retest — 027f0d1

Bramble's own clearance fix passes the original 20-leg probe in an isolated production build. No source diff; initial staged start only, then movement input throughout. All 20 legs complete, all three lines free, plateau paints, desk caption triggers, transforms remain finite, and no JavaScript errors occur. [Saved state and route results](retest-027f0d1.json). Full trace and three screenshots: `/captures/sorrel/hermitage-access-027f0d1/`. Production build passes with the existing chunk-size warning. This supersedes the proposed clearance patch; do not cherry-pick it.

Reviewed all three screenshots. Desk arrival still has a large translucent foreground post across the frame and does not show the desk usefully. The released-line image shows the fox clearly on the slope; the return image hides its head behind the cottage step. Access and interaction pass; camera composition remains a separate concern. These stills do not establish continuous animation quality or audio quality.

## Desk-post production retest — 1ee10b8

All 20 original input-driven route legs and six state/error checks pass again, with no runtime source diff. [Saved state and route results](desk-retest-1ee10b8.json). Full evidence and three reviewed screenshots: `/captures/sorrel/hermitage-desk-1ee10b8/`. Production build passes with the existing chunk-size warning.

The desk-arrival screenshot confirms the foreground post no longer crosses the frame. This particular approach still crops most of the desk off the left edge, so it does not verify readable book/inkpot/quill composition. The release and return framing retain the previous limitations; village return still hides the fox head behind the cottage step. This is a bounded composition improvement and an access/interaction pass, not a motion or audio verdict. Bramble notified. The reported restoration-capacity commit 443f6fa was not available on the remote branch during this test and is not covered.

## Capacity-change production retest — 443f6fa

All 20 original input-driven route legs and six state/error checks pass on this exact production source. TypeScript, build and lint:feel pass. [Saved state and route results](capacity-retest-443f6fa.json). Full trace and three reviewed screenshots: `/captures/sorrel/hermitage-capacity-443f6fa/`. This checks Hermitage restoration, not a fully occupied 24-slot budget.

Ancestry matters: this commit does **not** contain the separately tested desk-post fix 1ee10b8. Its arrival screenshot has the old translucent post across the frame; integration must retain both changes. Release shows a visible fox on the slope; village return still hides the head behind the cottage step. These are access/state passes with the same bounded visual limitations, not a motion/audio verdict. Bramble notified.

## Integrated production retest — 628d1b7

Merged keeping-d2 into sw4-sorrel as fe96d47; runtime source matches integration, with no source diff. TypeScript, production build and lint:feel pass. All 20 movement legs and six state/error checks pass: lines free, plateau painted, desk caption present, finite transforms, no JS errors. [Compact results and window.__game](integrated-628d1b7.json). Full trace and three reviewed PNGs: `/captures/sorrel/hermitage-integrated-628d1b7/`.

The desk foreground post fix survives integration. The same approach still crops the desk at left; release shows the fox on the slope; village return still obscures its head with the cottage step. Fern owns the camera review. This is access/interaction evidence, not continuous motion or audio approval. Bramble's integrated replacement rock positions supersede 2e5bdb0: do not merge the obsolete sw4-sorrel-hermitage-fix branch.
