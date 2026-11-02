# Filled-well remote camera guard

Wren's af98b89 merged as f62462a passes an independent matched near/remote
trigger check. Actual homecoming ticks fill the well in both staged setups;
all five lanterns are lit. At the plaza the authored reveal reaches shot=1.00.
At Millbrook, 58.05 m from the well, shot stays exactly 0.00 across all twenty
samples, including ordinary stick movement after 0.5 s. The onward stream
reaches 48 motes in both cases after its authored fade. Eight checks pass;
all recorded camera coordinates are finite and there are zero JavaScript errors.

Reviewed all forty source frames on two contact sheets. Near framing matches
the previously accepted scenic reveal. The remote camera follows the fox as
it moves off the kiln; it never travels to the plaza. The remote setup is on
the kiln rather than a normal lane start and falls during movement, so this
is distance-guard verification, not a new Millbrook traversal approval.

Evidence: /captures/fern/handover-distance-guard contains the executable probe,
full window.__game snapshots, camera traces, forty frames, sheets and acceptance.
Both two-second runs use 60 Hz offline simulation and 10 fps SwiftShader
captures at 640×360 without audio. Creature releases, page state and initial
positions use dev hooks. This does not establish natural discovery, real-time
performance or frame stability between captured samples. The prior longer
reveal/return review remains authoritative for blend-out and movement yield.

Typecheck, lint:feel including camera recovery fixtures, and production build
pass. No runtime edits beyond merging Wren's guard were made.

Shared archive (downloaded and byte-compared):
`keeping-swarm4-captures/fern/handover-distance-guard.tgz`.
