# Page-only homecoming handover — 075662b

The main path now reveals the next story step without requiring the optional
creature homecomings. The pinned page starts the existing well-to-ember stream;
the one-shot camera reveal waits until the fox pauses within the 9 m plaza.
A remote page completion leaves the reveal pending. Actual finale progression
still requires settling the Keeping and placing the ember in the Press cradle.

The clean 11f4cfc baseline reproduced the blocker with the kept-page hook and
initial endpoint placement: pinned=true, lit=[page], full=false, onward=0 after
15 seconds. The five-lantern full-bucket predicate was gating the main path.

On exact 075662b4af6ef3fa3f3d5ed542a789eb755a5d54, the shared createSliceRoute
reaches home in 73.267 simulated seconds. Only the initial wake position was
staged; every subsequent step uses controller input. No page, creature or
Keeping hooks were used. All three catches and the homeward fold complete.
The well has only its page lantern, full=false, and the onward stream has 48
motes. Journey samples retain shot=0; the final pause reaches shot=1 and returns
to shot=0. Ten corrected acceptance checks pass, with finite cameras and zero
JavaScript errors. Full window.__game state and route snapshots are retained.

Reviewed every one of the 100 rendered final-hold frames on four contact sheets,
plus native frames 9 and 29. The well, gate and hearth column read together;
caption and orange trail identify the onward direction. The scenic reveal
crops the fox before returning to readable follow framing. It has no observed
single-frame jump at this capture cadence. No camera tuning or locomotion
parameters changed. This is a guidance correction, not a new feel approval.

The first natural-run assertion assumed camera.shot, but the runtime exposes
shot weight in camera.boom. The raw false result is preserved; acceptance.json
parses the actual API and verifies the rendered reveal. A separate staged
remote-start return test walks all five homeward legs with input and confirms
that the reveal waits for a pause. Its first movement check used half stick
and sampled at two seconds while speed had only just reached 1.591 m/s: the
existing 1.5 m/s camera yield had begun, but shot weight was still 0.45. That
bounded false assertion is retained separately from the full-input follow-up.
That follow-up on the same SHA passes all eight checks: all five walking legs,
remote shot=0 with 48 motes, no shot during walking, shot=1 after the pause,
and shot=0 after three seconds of full input. Reviewed its three native PNGs;
the final frame has ordinary fox follow framing. No source correction was
needed after visual review.

Evidence lives in /captures/fern/page-only-natural (probe, full state, trace,
100 frames, four sheets and homecoming.mp4), page-only-handover (baseline), and
page-only-return (first staged follow-up), and page-only-return-full-input
(successful movement retest). The natural run uses 60 Hz offline
simulation, beat snapshots and a final 10 seconds at 10 fps, 640×360 SwiftShader,
without audio. It does not establish unfamiliar-player discovery, real-time
performance, audio quality, or stability between captured frames.

Typecheck, lint:feel with camera-release fixtures, and production build pass.
The slice capture route intentionally finishes with hold(homecoming, Infinity);
this fix exposes the next player task rather than autoplaying the finale.

Shared archive (downloaded and SHA-256 compared):
`keeping-swarm4-captures/fern/page-only-handover-075662b.tgz`.
SHA-256: `6d504bc2aa80f0f3bed4925200a9b98136efd4645f8339513b9113b155a60418`.
Local deliverable: playtest-output/fox-spirit/homecoming-page-only-075662b/.

## Durable regression command

`node tools/page-only-handover-probe.mjs OUT` now retains the natural slice
probe in the repository. It writes beat screenshots, 100 final-hold frames and
full state/trace evidence, and exits nonzero for any of the ten acceptance
failures. `node tools/page-only-handover-probe.mjs --check-evidence
OUT/evidence.json` rechecks the saved evidence without launching a browser.
The assertion evaluator passes the retained 075662b run and fails a negative
control with its onward count set to zero. This changes no game behavior.

## Integrated build recheck — d0d1953

Replayed the same natural shared slice on integrated `d0d1953d18ef113033b71d5834592bc442e287e8`:
arrival 73.267 simulated seconds, pinned page only, full=false, onward=48;
all ten checks pass. No reveal during the journey, reveal weight reaches 1,
and returns to 0. Camera coordinates remain finite and no JS errors occur.
All 100 final-hold frames reviewed on four sheets, plus native ruin and reveal
stills. The well/gate/hearth route is visible; scenic fox cropping is unchanged;
follow framing returns with the full fox visible. No runtime correction needed.

Evidence: `/captures/fern/integrated-d0d1953/`, including `homecoming.mp4`,
`evidence.json`, `acceptance.json`, 100 frames and all-frame sheets. The captured
script still had the old raw diagnostic assertion; corrected acceptance and
the new repository evaluator both pass the actual documented camera state.
The new evaluator also rejects a missing-onward negative control. TypeScript,
feel lint/camera release checks and production build pass. Offline 640×360
SwiftShader, final hold 10 fps, silent; no realtime or audio verdict.

## Recorder setup parity — cbadec6, runtime d0d1953

Kit's live GPU capture still reportedly lacks the reveal and has isolated black
frames (#swarm :617); the offline checks do not clear that failure. A focused
replay on cbadec6 changes two setup differences: normal `/` boot instead of
`?manual=1`, and one initial simulation step instead of 60. Runtime sources
remain identical to d0d1953. The route again arrives in 73.267 simulated seconds
with the page pinned, only the page lantern lit, full=false and onward=48.
All ten checks pass, including the reveal, follow-camera return and zero errors.

Reviewed all 100 final-hold frames on four sheets and native reveal/ruin frames.
The caption and hearthward stream render, the scenic lens crops the fox, and
the readable fox follow framing returns. No additional runtime change follows
from this test. Evidence: `/captures/fern/capture-parity-d0d1953/` (probe copy,
state, acceptance, route stills, 100 hold frames and four sheets); compact
acceptance is retained as `fern-capture-parity-d0d1953.json` beside this review.
This remains silent 640×360 SwiftShader, 60 Hz simulation and 10 fps hold capture.

Requested the actual GPU recorder module and endpoint state from Kit. One
unverified driver hypothesis is stopping simulation on the shared route's
`complete` flag (four seconds into homecoming) while recording continues.
Neither that hypothesis nor a GPU/runtime or recording-buffer fault has been
established by this setup-parity replay.
