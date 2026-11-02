# Keeping chase-camera release

Final selection: merge `671a290` using its complete Fern camera envelope and
release fixtures. The independent Sorrel solver and inline 0.8m measurement are
superseded. The probe uses the game's `foxScreenPx()` and shared fox-size gate,
retaining trace-based regional checks and required missed-jump coverage.

The results below archive the independent candidate. They are not claims about
the merged runtime; integrated replay results are recorded separately.

## Archived independent candidate

Runtime: `4626a72` on `sw4-sorrel`; baseline `ac3c711` inherits the camera from
Kit's reported `d03831b`. The normal opening boom remains 2.45m and the effective
body clearance remains 1.8m. No movement, animation, world or story-shot changes.

## Cause and correction

The rendered lens stayed at `(30.635,13.087,82.448)` behind the post at
`(30.2,81.6)` as the fox crossed the bridge. Its final range was 16.92m. Every
goal-centred escape ray converged into that post after the movement clamp, so
the fallback repeatedly reused the previous clear position.

When that search finds no candidate, search short local tangents around the
previous lens too. Retain the existing swept collision, body and floor checks.
A second defect appeared at 120Hz: the release sweep permits a 0.2m sphere, but
the escape endpoint demanded 0.35m, so a small step could not leave the gap
between those margins. Retain the swept 0.2m clearance while leaving that shell,
then recover the wider endpoint margin when room permits.

## Played Keeping evidence

`/captures/sorrel/keeping-camera-final480-4626a72/` retains the full 90-second
input route, `window.__game`, all 2,700 state frames, eight stills, and the
uninterrupted 40–60s payoff (`clip.webm`, 300 source frames). One disclosed initial
placement beside H-a; no later teleports, forced latches, camera overrides or
forced restoration. Offline 30Hz simulation, 480×270 at 15fps, without audio.
This is framing/progression evidence, not a real-time performance measurement.

Steam, root restoration, bridge and far-crag checks all pass; Crown is released,
one dash recorded, zero JS errors. All 2,700 fox positions and route beats match
the baseline exactly. The last jump includes the steam lift: 9.069m apex,
1.8s to apex and 5.467s air; these are not ordinary ground-jump measurements.

| Late window, 35–90s | Result |
| --- | ---: |
| Minimum lens/chest range | 2.546m |
| Minimum projected body proxy | 12.61% of viewport height |
| Maximum absolute pitch | 38.36° |
| Maximum lens step speed | 15.90m/s |

The route probe now fails its camera gate below 5% viewport height, using a
documented 0.8m vertical body proxy through the rendered camera. The original
envelope with this added measurement fails (4.999% by 55s). This measures framing,
not opaque-world visibility or the exact animated ears/tail outline.

## Visual review and retest

Reviewed every retained payoff frame across contact sheets, plus full-sized
35/42/45/50/55/60/70/89s stills. The camera follows around the bowl, onto the
bridge, and to the Crown. The orange fox remains readable with room for ears and
tail. The story leaf crosses the foreground near 58s; it no longer falls outside
a parked view. Existing white Crown values are bright, but the fox separates
from the bridge and the target remains visible ahead.

The first local-tangent candidate passed the full 30Hz route, then failed the
new 120Hz pole test. Corrected the margin mismatch and repeated the full route
on the pinned runtime above. CPU tests require eventual reacquisition and swept
clearance at 30/60/120Hz, alongside the existing ledge-release test. TypeScript,
`lint:feel`, and `tools/checks/camera.ts` pass.

The separate 36–42s recovery-onset clip in
`/captures/sorrel/keeping-camera-onset-4626a72-attempt2/` retains the initial
landing and post detour. All 90 recorded frames keep the complete skinned body
inside a 2% viewport margin; reviewed all frames on three sheets. Its independent
full 90-second route also passes progression and camera gates with zero errors.
The first close-up attempt stopped after two frames and is retained separately;
only `attempt2` is counted. Both runs use the same pinned runtime and settings.

## Rejected full-page regression attempt

`/captures/sorrel/camera-missed-pounce-4626a72/` did **not** reach the overlook
jump: its second-fold dash landed north of the newly raised leaf, then its
`back for the climb` walk stalled against that leaf's face. The camera-only gate
and silhouette check passed while stationary. Reject that run as missed-jump
evidence; `coverage-review.json` records this explicitly. It does not establish a
full-page clear or a missed-catch recovery.

Harness commits `e21e1bc` and `1f08984` now fail `--miss-overlook` unless the
requested jump beat, airborne departure and subsequent fall were observed.
They also supply a separate staged ruin ledge-drop route:
two setup placements and real dashes open both folds, then one recorded start
on the second leaf. No page catches, fold flags, restoration, or physics are
forced. This isolates camera collision after a genuine walk-off and jump retries;
it is not unassisted full-page progression. Game camera code remains `4626a72`.

The completed regional run is `/captures/sorrel/ruin-camera-drop-final/`, source
`1f08984`: first/second folds open, start on the 0.47m leaf, real airborne fall
to −0.84m, real jump retries, grounded below the leaf, and the expected final
beat all pass. All 180 recorded body frames fit the 2% viewport margin. Minimum
lens/chest range 1.851m, minimum body proxy 26.40%, maximum pitch 35.50° and
maximum lens speed 5.93m/s; zero errors. The complete 0–12s clip and every frame
were reviewed on three sheets. The lens stays outside the body during the drop
and the undercroft faces fade around the fox during retries. These are headless
480×270, 15fps recordings of a 30Hz simulation, without audio.

The longer 640×360 attempt terminated with SIGTERM after 243 payoff frames;
it remains at `/captures/sorrel/keeping-camera-final-4626a72/` and is not counted
as a completed run. Its overlapping camera frames match the complete 480×270
run exactly. Do not mix its partial checkpoint with the completed report.

Artifacts are also copied to
`playtest-output/fox-spirit/sorrel-keeping-camera-4626a72/` and uploaded to Modal
volume `keeping-swarm4-captures`, path `sorrel/keeping-camera-final480-4626a72/`.
Baseline and the negative screen-height check are on that volume under
`sorrel/keeping-camera-before-ac3c711/` and
`sorrel/keeping-camera-negative-screen-height.json`.
