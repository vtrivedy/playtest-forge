# Filled-well handover camera

Wren's `c212345`, merged with integrated `cf538fa` as `e553200`, passes the
bounded reveal and movement-return review. No additional runtime edits were made.

The well, gate and rising trail toward the hearth/shelf read clearly in the wide
view. The authored camera deliberately crops and then excludes the fox during
that view. It is suitable as a brief cinematic cue; this is not an always-visible
traversal-camera verdict. With no input the fox is fully readable again around
7.5 seconds. With controller movement starting at 0.5 seconds, the camera begins
its early return after the 1.5-second minimum hold and the full fox is readable
again around 2.8 seconds. Both final camera states report `shot=0.00`.

Fern reviewed every rendered frame: 100 frames over ten seconds without input,
then 40 frames over four seconds with movement. All five lanterns and the full
well are recorded in both setups. Eight state/source/completion checks pass,
camera coordinates remain finite, and there are no recorded JavaScript errors.
Typecheck, feel lint, camera recovery fixtures and production build pass; Vite
retains its existing large-chunk warning.

Evidence under `/captures/fern/handover-camera/` and
`/captures/fern/handover-camera-interrupt/` includes exact source, full hook-state
snapshots, camera trace, source frames, contact sheets, probes and silent clips.
Both run at 60 Hz simulation with 10 fps offline SwiftShader captures at 640×360.
This does not establish single-frame stability at 60 fps, real-time performance,
audio quality or unfamiliar-player discovery. The recorded interval begins at
the well-full tick, rather than including the planned one-second pre-roll.

Creature releases, page completion and initial plaza position are staged with
dev hooks; subsequent well filling uses ordinary homecoming ticks and movement
uses controller input. The first long two-case process was interrupted after
the no-input case completed; its partial movement case is retained as diagnostic
evidence. The completed four-second rerun is authoritative for movement return.

Shared archive: `keeping-swarm4-captures/fern/handover-camera-review.tgz`.
Machine-readable results: [acceptance](fern-handover-camera-acceptance.json).
