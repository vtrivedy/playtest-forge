# Independent Hermitage access review

**85a5cfa fails the authored north lane.** The production bundle boots without JavaScript errors and the first uphill bend completes. The next leg stalls at (-13.241, 1.270, 110.477), 4.233 m short of (-14.2, 114.6), despite 15 simulated seconds of movement input. No teleports occur after the staged start at (-9.7,102.3).

The screenshot shows the fox facing a rock in the trail. Source locates a root-step rock at (-13.6,111.2), with radius .55 m and cap height .475 m; it intersects the authored NORTH_LANE segment. Terrain-only `paths-walkable` passes because it does not include prop colliders. Bramble notified with exact coordinate and evidence; move the rock outside the trail rather than increasing controller step height.

Evidence: `/captures/sorrel/hermitage-access-85a5cfa/evidence.json` contains the full trace and `window.__game`; `north-lane-desk-lines-return.png` shows the blocker. [Compact baseline](baseline-85a5cfa.json). TypeScript, production build and lint:feel pass on this source. Those checks do not establish route access.

`tools/hermitage-access-probe.mjs` is the repeatable production input route. It visits the desk and three drying lines and returns through all lane bends. It requires every leg, finite coordinates, no JS errors, all lines freed, plateau painted, and the desk caption. Arrival and return screenshots must be reviewed after a fix. This is an access/interaction check, not a continuous motion or audio verdict.

## Proposed clearance fix — 2e5bdb0

Moving three root-step rocks aside clears all 20 input-driven legs through the lane, desk, three drying lines and return. All three lines free, the plateau paints, and the desk caption triggers. Coordinates remain finite and there are no JavaScript errors. [Compact evidence including exact tested source diff](rock-candidate.json); [patch](rock-clearance.patch). Runtime tested was production85a5cfa plus exactly this source diff; 2e5bdb0 commits it. Full evidence and screenshots: `/captures/sorrel/hermitage-access-rock-candidate-v2/`.

I reviewed desk arrival, released leaves and village return stills. The fox body is visible in the arrival/release samples, but the village return ends facing a cottage step that obscures its head. The desk arrival is visually weak: a faded foreground post crosses the frame, and the desk is outside the useful view. The line release sample clearly shows the fox but not a wide establishing view. This passes access and interaction state; camera composition still needs Fern's review and a continuous clip. Fix offered to Bramble as a single commit for integration; the integrated production tree must rerun this probe.
