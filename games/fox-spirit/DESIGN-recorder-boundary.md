# Recorder boundary — Reed, swarm5

The review of b4fa63a has 21 isolated black frames in live GPU MediaRecorder clips,
while offline rendered walks have none. Prior software staging tests did not
reproduce the failure. First reproduce on the same GPU runner; do not infer a
render fix from a different capture path.

Compare native WebGL captureStream with a persistent 2D staging canvas copied
synchronously after render. Record simultaneous streams and periodic independent
browser screenshots, render/copy luminance, source SHA, errors, and __game state.
A canvas read at an unrelated timer may see an already-discarded framebuffer.
Only publish a staging frame following a completed copy from a fresh render.

Check capture lifecycle in tla/RecorderBoundary.tla before implementation: fresh
render -> synchronous copy -> publication, asynchronous discard cannot invalidate
persistent copied pixels; stopped capture never publishes. A deliberately broken
copy must fail. This model covers ordering only, not browser/GPU pixel correctness.

Acceptance: reproduce native black frames; independent GPU screenshots and staged
frames stay bright in the same scene; decode both clips with blackdetect and
report frame counts/duration. If native does not reproduce, retain the result as
inconclusive and extend the matched run. Fix the actual runner, add a regression
gate that rejects dark flashes, repeat on a named pushed commit. Gameplay and
movement tuning remain outside this change.

Formal check: `tlc -workers 2 -config RecorderBoundary.cfg games/fox-spirit/tla/RecorderBoundary.tla`
passes 11 distinct states. Replacing cfg with RecorderBoundaryBad.cfg must fail
NoBlackPublication at Render -> Discard -> Copy -> Publish. This negative control
is intentional; generated TLC traces are temporary and should not be committed.
