# Independent Hermitage access review

**85a5cfa fails the authored north lane.** The production bundle boots without JavaScript errors and the first uphill bend completes. The next leg stalls at (-13.241, 1.270, 110.477), 4.233 m short of (-14.2, 114.6), despite 15 simulated seconds of movement input. No teleports occur after the staged start at (-9.7,102.3).

The screenshot shows the fox facing a rock in the trail. Source locates a root-step rock at (-13.6,111.2), with radius .55 m and cap height .475 m; it intersects the authored NORTH_LANE segment. Terrain-only `paths-walkable` passes because it does not include prop colliders. Bramble notified with exact coordinate and evidence; move the rock outside the trail rather than increasing controller step height.

Evidence: `/captures/sorrel/hermitage-access-85a5cfa/evidence.json` contains the full trace and `window.__game`; `north-lane-desk-lines-return.png` shows the blocker. [Compact baseline](baseline-85a5cfa.json). TypeScript, production build and lint:feel pass on this source. Those checks do not establish route access.

`tools/hermitage-access-probe.mjs` is the repeatable production input route. It visits the desk and three drying lines and returns through all lane bends. It requires every leg, finite coordinates, no JS errors, all lines freed, plateau painted, and the desk caption. Arrival and return screenshots must be reviewed after a fix. This is an access/interaction check, not a continuous motion or audio verdict.
