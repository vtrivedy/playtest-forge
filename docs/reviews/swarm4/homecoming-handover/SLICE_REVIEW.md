# Natural page-only handover

Accepted on runtime e07e170870300cd8943ba7c752e83e0c28daf4b9, merging Fern 075662b into the prior reviewed tree. No runtime tuning by this review. TypeScript, production build and lint:feel/camera release fixtures pass; existing bundle-size warning remains.

Matched 150-second runs replay createSliceRoute at 60 Hz with only its initial wake teleport, no page/creature/Keeping dev release and no camera override. Each retains 150 window.__game/camera/path samples and ten 640×360 chase PNGs. The baseline 5a43cd3 reproduces Kit's dead-plaza report: three catches, page pinned, lit [page], all optional creatures pressed, full=false, onward=0 and no path throughout. Its original diagnostic wellFull/onward assertions correctly fail and remain in raw evidence.

On candidate e07e170, all ten revised acceptance checks pass. Page pin and onward=48 first appear in the 50 s sample. Arrival enters terminal homecoming in the 74 s sample; scenic path is present at 74–80 s and absent from 81 s through 150 s. The well remains incomplete and optional creatures remain pressed, proving neither gates the onward story now. All 150 fox-position samples match the baseline exactly. Last jump apex 0.792 m, time-to-apex 0.317 s, air time 0.633 s, dash 1.998 m and four dashes match. Both runs have finite sampled transforms and zero JS errors.

Reviewed both complete ten-image contact sheets, with native 75/80 s candidate views and baseline 75/80/130 s views. The candidate 75 s frame shows the caption, pinned page, warm lantern, well, gate and rising hearth column together. The scenic reveal crops the fox at the lower edge, consistent with the previously accepted scenic composition; it is not traversal framing approval. The 90 s view has returned to normal fox framing. Persistent onward state does not mean motes remain visible in every idle chase orientation: after handback the route can be offscreen. The one-shot scenic reveal is the visible improvement over the baseline.

The shared route deliberately ends with an infinite homecoming hold. These captures demonstrate guidance, not automatic Keeping/finale progression or unaided player discovery. One-second state sampling and ten stills do not establish motion stability, audio quality, real-time performance or resolve the separate GPU black-blink report. Fern's independent 100-frame continuous review is separate evidence, not attributed to this replay.

[Compact matched results](slice-verification.json). Local evidence: `/captures/sorrel/homecoming-natural-slice-5a43cd3/` and `/captures/sorrel/homecoming-natural-slice-fixed/`.

## Independent deferred-reveal retest

After reviewing the natural-route screenshots, a separate staged page-only run on the same runtime passes all 12 checks. It forces page homecoming at the root-hearth, waits eight simulated seconds remotely, teleports into the plaza while holding stick, pauses, then interrupts the reveal with full movement. Setup teleports are explicit; no optional creatures are released. Seven state/camera samples and seven native screenshots are retained.

Remote and plaza-walking samples have path=null; the remote camera stays 2.450 m horizontally from the fox. Pausing starts the reveal, the held sample remains active, full stick sets yielding=true, and the next sample is back in follow mode. Teleporting back to the plaza and waiting four seconds does not replay it. All samples remain page-only, well incomplete, onward=48, finite and free of JS errors.

Reviewed the full seven-image sheet and native movement-return/revisit images. Follow framing returns with the full fox visible and the trail clearly crossing toward the gate. The remote root-hearth setup sits beside a tree and does not approve traversal framing there; this test is about retaining the reveal and keeping the remote lens local. Staged arrivals and sampled screenshots do not prove natural discovery or continuous camera motion.

[Deferred results](deferred-verification.json). Full local evidence: `/captures/sorrel/homecoming-deferred-e07e170/`. Shared pack for all three runs: `keeping-swarm4-captures/sorrel/page-only-handover-independent.tgz`.
