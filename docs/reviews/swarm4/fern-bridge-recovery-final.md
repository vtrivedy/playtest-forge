# Keeping camera recovery review

Runtime under review: `6b820d9` (camera recovery `6ffe34c`, integration `d03831b`). Source remained fixed for the sequential browser regression queue. The camera uses the existing single follow rig, control yaw, height1.15m and side bias0.35.

## Problem and change

The natural hearth → Carry → steam → root → released-tree bridge route completed, but the camera held an old clearance pose16.85m from the grounded fox. Minimum distance, pitch, speed and full-body viewport bounds all passed while the fox became a tiny speck. An isolated dev-release bridge start missed the approach history.

The solver now rejects an infeasible final candidate before bounding its next step. Recovery shares terrain lifting and swept clearance between direct and escape candidates, and searches eight local directions around the previous lens before holding. A small local tie preference follows existing side bias. No additional camera rig, control transform or locomotion tuning was introduced.

Free release, obstructed release, terrain ridge and convex-post fixtures pass at30/60/120Hz. The post includes actual visibility and a constant-visible proxy because collision geometry can extend beyond its drawn proxy. Earlier solvers fail the corresponding ridge/post fixtures. These bounded examples do not establish arbitrary pathfinding completeness. TLC recheck passes9distinct ordering states (`/captures/fern/recovery-order-model.log`); geometry/recovery remain outside that abstraction.

## Played evidence

Natural Keeping110s on the integrated runtime passes real steam/root completion, bridge crossing, crag arrival and terminal beat. Maximum grounded follow distance is2.799m, minimum chest clearance2.043m, maximum pitch29.13°, peak lens speed15.99m/s. Minimum projected feet-to-ears height is44px at640×360, with no interval below24px. All60bridge clip frames fit the body within the2% viewport margin and were visually reviewed: fox, walking surface and destination remain readable.

Evidence: `/captures/fern/recovery-final-keeping/` includes `evidence.json` (full `window.__game` state, trace, sourceSHA and staging), checks, four stills,60source frames, two reviewed contact sheets and `clip.webm`. `01-40.00s.png` shows the root hearth and bridge; `02-50.00s.png` shows the fox close to the destination. One initial placement near the first hearth; controller input thereafter, no forced release or paint.

Millbrook70s also passes all six chemistry/traversal/completion checks and its terminal beat. Minimum chest1.877m, pitch40.35°, peak12.03m/s, maximum grounded follow3.236m, minimum fox39.29px; no samples below24px. All60Weir drop frames fit the2% margin and were reviewed in order. The camera clears the ledge continuously, retains fox silhouette through the drop, and closes in again in the valley. Evidence: `/captures/fern/recovery-final-millbrook/`.

The legacy original-page run passes numeric camera checks but is **not accepted as a successful route**: after the second-fold dash it runs off the not-yet-open page, then stalls below it on the return-to-run-up beat (2catches). Its paired omit-overlook-jump run therefore cannot yet exercise the intended failed catch. The script must brake after dash contact rather than depend on the former collision guard stop. Actual final-catch and failed-catch camera cases require a retest with controller input.

Staged finale replay passes7/7live-input legs with0errors: crag→Press→ember placement→completed card→return to meadow. Minimum chest across legs1.944m, maximum pitch29.12°, peak15.89m/s. All45sampled handoff frames were reviewed in sequence: the fox walks out from the cradle with continuous close framing, readable silhouette and supporting floor; the former release snap is absent. Evidence `/captures/fern/recovery-final-finale/` contains `trace.json`, `game.json` (`window.__game`),7leg stills,45source frames,2sheets and encoded handoff. Setup intentionally forces the Keeping release and stages ember pickup/crag start; this does not establish discovery or natural full-game completion.

Hermitage80s uphill-facing route passes all three drying-line releases, paint, caption and terminal beat. Minimum chest1.842m, pitch37.78°, peak16.76m/s, grounded follow2.790m, minimum fox74.62px. `01-14.00s.png` shows book and caption comfortably above the fox. No errors. Evidence `/captures/fern/recovery-final-desk/`.

All four accepted place/finale checks are mirrored under `playtest-output/fox-spirit/fern-camera-recovery/`. The two legacy chase runs remain explicitly unaccepted until they exercise their intended outcomes. Recovery source was published as `6b820d9` before that separate harness/guard investigation concluded.

## Scope and limits

The probe now checks sustained grounded follow distance≤5m and projected hero height≥viewportHeight/15, failing when the latter remains small for more than1s outside authored shots. A deliberately excessive200px CLI floor independently fails the pixel guard; all other camera checks pass in that negative run (`/captures/fern/fox-pixel-negative/`). Projection is feet-to-ears0.6m through the rendered lens, not a visibility or occlusion proof. Visual review remains necessary.

Higher camera1.55m cropped more of the destination card; side bias0.6 faded the bridge beneath the feet. Both were rejected in favor of existing composition. Uphill Hermitage facing shows the book/quill and caption; deliberate backpedalling retains its existing heading and can put the desk at the edge. No forced turn was added.

All captures use deterministic offline SwiftShader rendering, without audio; encoded clips play sampled frames at15fps. This is camera regression evidence, not a realtime performance, audio, or full-game feel certification.
