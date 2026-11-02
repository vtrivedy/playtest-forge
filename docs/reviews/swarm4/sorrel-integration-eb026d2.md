# Integrated camera recheck

`eb026d2` merges keeping-d2 `eca465e` into sw4-sorrel without conflicts. Compared
with that integration, cameraEnvelope.hot.ts and the camera release fixtures
are unchanged. The branch retains the verified 1.9m opening body clearance,
shared fox-size gate, real-miss coverage, and return-fan occluder registration.
Fern owns the structural fold-factory follow-up. TypeScript and lint:feel pass.

## Played evidence

- **Integrated Millbrook (`eca465e`, actual 1.8m default):** 150 simulated seconds,
  one lane-mouth start placement, then ordinary controller inputs. Dam turning,
  permanent paint, kiln lit, updraft ridden, Weir reached, and lookout paint all
  pass; final route is complete. Zero JavaScript errors. Minimum fox projection
  39.47px at 360p; maximum sustained grounded follow range 3.238m. All 90 captured
  animated-body frames pass the unchanged 2% screen margin.
- **Merged ledge (`eb026d2`, default 1.9m):** 14 simulated seconds. Disclosed
  setup placements and real dashes open two folds; then the ordinary controller
  walks off the leaf and retries jumps. Seven actual-state/coverage checks pass,
  final beat matches, zero errors. Minimum fox 50.18px at 270p; maximum sustained
  grounded range 2.714m. This short confirmation has five stills, not a new
  continuous body-margin capture; the earlier 90-frame 1.9m acceptance remains
  separately documented in sorrel-keeping-camera-release.md.

Reviewed the Millbrook drop across all 90 frames on two sheets, with full-size
checks at the cliff, kiln and landing. The cliff fades while the fox falls; the
kiln briefly overlaps its upper body but its face remains visible. There is no
full disappearance. The actual 4.53s and 4.60s ledge stills on the merged build
retain tail room and show the fox through the faded return fan. No camera
retuning was warranted. Paint warmth remains Ember's active visual task.

Both runs use offline 30Hz simulation; the Millbrook clip is 15fps at 640×360,
without audio. They do not measure real-time rendering performance. The
Millbrook run uses the integration's older projection implementation; the
merged ledge uses the game's shared foxScreenPx hook and shared size gate.

Evidence: `/captures/sorrel/integration-camera-eb026d2/{millbrook,ledge}/` has
stills, window.__game, traces and checks; Millbrook also has clip.webm and all
source frames. Copied to `playtest-output/fox-spirit/sorrel-integration-eb026d2/`.
Shared archive: `keeping-swarm4-captures/sorrel/integration-camera-eb026d2.tgz`.
