# Hillside body visibility — Hazel

The historical meadow shoulder obscures much of the fox even with the lens
above terrain. The current blind seed follows a different path, so it does not
reproduce the historical twenty-second pose. The labeled staged-location probe
does reproduce the obstruction on current game source `7d4c0fba`, preserving
the known fox position and camera azimuth, then settling for one second.
Evidence: `/captures/hazel/terrain-clearance-7d4c0fba/`.

Point-clearance variants .35/.55/.8 all fail the visual review. A clear centre
segment misses the terrain across a lateral body segment. Candidate `6b7c83b2`
adds a pooled, allocation-free analytic body-width query to the existing camera
envelope. It scores both the bounded next step and its intended destination;
the projected body-room correction also respects the existing travel cap.
The active controller supplies its actual terrain function. Authored shots,
movement parameters, collision geometry and terrain materials are unchanged.

The experimental body-width comparison at
`/captures/hazel/terrain-body-candidate/` selects .28: .18 leaves the obstruction,
.28 reveals the body with a smaller orbit, and .38 rotates farther. These are
experimental working-tree captures before the final solver corrections, not
relabeled final-source evidence. The new reserve is exposed in the camera GUI.

## Structural and opening checks

- TypeScript, production build and `lint:feel` pass on integrated `d3c42308`
  (includes landed `keeping-d3` `905f73ac`). The lint guards both terrain-query
  bindings and includes the new synthetic cross-slope recovery/release check.
- The synthetic case has a clear centre and masked body side. Recovery and
  release pass at 30/60/120 Hz with body/floor clearance and bounded travel.
  Omitting the query fails `body remained hidden by terrain shoulder`.
  Existing free, ledge, ridge and local-post checks continue passing.
- Discovery TLC:112 generated/38 distinct; TeachOrder:4/4; no errors.
  Removing only Finish's ground guard fails DoneAfterLanding with a five-state
  counterexample; early Publish fails LatestOfferWins. Final intended negative
  logs are `envelope-fixed.log`, `discovery-fixed.log` and `teach-order.log` in
  `/tmp/hazel-camera-negative/`. Earlier import/parse setup failures there are
  not counted as negative controls.
- `/captures/hazel/discovery-terrain-camera/evidence.json`: fresh production,
  ninety seconds, 1.5-second idle, ordinary cue-following inputs, all thirteen
  checks pass, real grounded finish55.95s, zero JavaScript errors. Source
  `8e4e25f6` differs from `6b7c83b2` only in capture tools. This replay retains
  a final still and state; it is not continuous opening-motion proof or a
  blind-wander success.

## Capture-route correction

The first full-route candidate replay, `/captures/hazel/camera-terrain-complete/`,
passes the unchanged camera gate: minimum chest distance1.976m, maximum
pitch46.884°, maximum step speed12.964m/s, maximum grounded follow distance3.265m,
minimum follow silhouette40.47px at640×360 (24px minimum). It fails gameplay:
the old route assumes a dash drops the ember. Earned Hearthbound instead retains
it, so the unconditional recovery E puts it down before the steam spring.
The saved trace records `carriedDashes:1`, `dashDrops:0` and the misplaced coal.

`8e4e25f6` corrects the single canonical route to interact only when the desired
carry state is unmet. The carry verifier requires the actual three placements,
and three pickups when the earned dash retained warmth (four when it dropped).
It does not force heat, chemistry, bridge, story or finale state. The first
failed replay remains negative evidence; the corrected complete-route replay
and rendered recovery are separate captures.

## Corrected integrated route and retained open gate

On unchanged integrated `d3c42308`,
`/captures/hazel/camera-terrain-complete-retained/` completes 240 simulation
seconds at30Hz with one initial wake placement and no further staging. All
eleven physical checks pass: real page home, steam, Keeping, bridge, carry,
cradle, snow, curled kits and completed title. Three real pickups and three
placements, one retained dash, zero page errors. Five timed stills retain
opening, shelf, bridge and ending views; the final ending still was inspected.

The unchanged strict all-frame camera gate is **false**, retained as such in
`camera-check.json`: two finale authored-path replacements produce281.605m/s
and114.081m/s pops. Thistle independently identified the same pre-existing
handover bug on the keeping-d3 baseline at19:45 (281.73m/s), confirmed in direct
message35 at22:35. These are unintended baseline pops, not acceptable new camera
motion or an intentional-cut exemption. No gate was weakened. Thistle approved
evaluating this candidate by absence of new spikes while retaining this defect
as open; repairing the authored-path handover is outside this terrain correction.

`transition-analysis.json` retains every step above24m/s: all eight occur during
those authored replacements. Steps with two neighboring serialized zero-shot
weights have maximum12.964m/s. Minimum chest distance1.976m, maximum pitch46.884°, maximum
grounded follow distance3.323m and minimum follow size36.90px meet the unchanged
limits. Passing gameplay does not turn the failed all-frame gate into a pass.

## Final rendered recovery and feel review

`/captures/hazel/terrain-camera-motion-d3c42308/` contains full per-frame
`window.__game` states, the exact probe, `terrain-recovery.mp4` and96 frames:
6.4 simulation seconds,15fps, fixed60Hz simulation,640×360, silent. The first
second deliberately disables the reserve as a negative control; it is not
presented as the fixed game. Enabling the shipped .28 reserve recovers the
view before ordinary Space jump and Shift dash with world-stick movement.
The numeric body view rises from2/3 to1; maximum capture-step speed14.748m/s;
zero page or console errors. These are offline capture metrics, not real-time FPS.

All96 frames and full-size control, recovered and movement frames were inspected.
The control masks the fox; the corrected view reveals the body and remains
readable through the jump, glide and dash. The existing angular hillside still
dominates the background; this is a camera correction, not new landscape art.
Recorded jump apex .792m, air .817s, time-to-apex .317s; one dash travels1.996m
in this sloped segment. No movement values were tuned.

Feel-critic role review: **APPROVED for this bounded terrain-recovery segment**.
The fox's jump/dash poses read and the recovery does not visibly snap. This is
not global camera/steering or full-game feel approval; the baseline finale pop,
unfamiliar-player steering after an orbit, duration and campaign story order
remain separate gaps. The earlier failed clearance variants and solver tests
were corrected before this final rendered retest.

Integrated production deliberate-miss replay also passes all13 checks on
`d3c42308`: `/captures/hazel/discovery-terrain-camera-integrated-retry/` retains
complete state/trace and the inspected final still. Ninety fixed-step seconds,
1.5-second idle, `--mistake ruin`, real grounded recovery and zero JavaScript
errors. It does not force a catch, landing or completion. This is an additional
state recovery check with a final screenshot, not continuous opening footage.

Retained review artifacts: [control](evidence/control.jpg),
[recovered body](evidence/recovered.jpg), [dash](evidence/dash.jpg),
[all96 frames](evidence/all-96-frames.jpg), [movie](evidence/terrain-recovery.mp4),
[ending](evidence/ending.png), [gameplay checks](evidence/state-check.json),
[strict camera gate](evidence/camera-check.json),
[transition analysis](evidence/transition-analysis.json).
