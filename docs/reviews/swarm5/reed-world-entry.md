# Independent Ashwater entry acceptance

This review uses a fresh default boot, the rendered paper-invitation follower, physical homeward fold and walking
through the hub arch. Inside Ashwater it reuses Cedar's stick/jump/dash waypoints. No teleport, save-unlock fixture,
progress setter or forced puzzle completion is used. Screenshots retain complete hook and `window.__game` states.

## Findings and correction

The immutable GPU run on `8f966c9a` physically completed discovery and homecoming and crossed the hub arch. Its
foreign-world state and frame retained “Follow the warm light home”. The source was the finale's onward guidance,
separate from Hazel's discovery invitation. `52936a55` scopes the hint, mote trail and pending homecoming caption to
Russetvale. Hazel's discovery scoping and camera-relocation changes are also integrated on this review branch.

The first harness continued steering toward a hub waypoint after teleportation, walking to x=654.38 before its entry
screenshot. That frame **does not prove a spawn-camera defect**. `490d4747` stops steering on world change and releases
the stick. Earlier runs are partial diagnostics, not full puzzle-route acceptance.

## Validation scope

TypeScript, `lint:feel` (camera release/terrain/post controls and 160 world anchors), production Vite build and patch
whitespace checks pass. The runtime correction does not change character parameters.

The final immutable route passed on `490d474751685d06f01392cfaf658e9ca302ac66`, Tesla T4/EGL, 640×360.
No claim of blind discovery,
three-world completion, return/re-entry/save coverage, continuous-video quality, black-frame stability or 30–45 minutes
of authored play follows from this narrow test.


## Final hardware result

- Fresh rendered-invitation discovery → physical homecoming → hub arch → all three Ashwater levels: **PASS**, zero JS errors.
- Entry `[700, 0, 34]`, world `ashwater`, travels `1`, foreign teach line `null`. The correct landing frame is clear of the willow.
- Both dams burst, channel and pool at −1.25, reed mats up, `teach/develop/combine` restored, Reedskim earned, Reed Seedwell fill/glow 1.
- Nine splash recoveries; slips remain part of this scripted route. Final position `[725.81, 2.6, 120.48]`.
- Recorded last jump: apex 0.792 m, time-to-apex 0.317 s, airborne 1.750 s (the final glide); last dash 1.999 m, six dashes total.
  These are route metrics, not a new feel preset comparison. Capture wall time 147.102 s is **not** measured player session duration.
- Visual review: entry fox silhouette clear, rain/mist and cool greens distinguish the marsh from autumn. Filled Seedwell and caption visibly confirm completion.
  Terrain remains fairly flat in shading; a foreground reed crosses the fox in the Seedwell still. No continuous-motion or UHQ sign-off is implied.

[Corrected entry frame](reed-world-entry/entry.png) · [Filled Seedwell](reed-world-entry/seedwell.png).

All beat PNGs, complete hook/`window.__game` states (`log.json`), renderer and beat timing (`stdout.log`) are retained in
`/captures/reed/world-entry-review-490d4747/` locally and `reed/world-entry-490d474751/` on `keeping-swarm5-captures`.
The earlier `8f966c9a` and `52936a55` runs were stopped after finding the harness steering defect; no full-route pass is claimed for them.
