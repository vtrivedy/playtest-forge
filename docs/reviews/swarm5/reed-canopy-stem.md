# Canopy descent visibility

Hazel's production discovery capture on 66dac775 revealed an opaque stem
crossing the chase lens during the descent after catch two. At 15 seconds its
ink face nearly filled the image while the hint still rendered normally. This
is scene occlusion, distinct from the recorder boundary investigation.

The leaf blades already use the opening sight-blocker fade. Their stems were
separate scene objects outside that system. The fix registers each complete
stem mesh, including its ink child, with that same fade. The support colliders,
spring values, camera tuning and discovery progression are unchanged.

The working-tree candidate was played using `tools/discovery-probe.mjs`, real
stick/jump/dash inputs chosen from projected fragment geometry and shown words,
50 seconds with 1.5 seconds initial idle and quarter-second screenshots. Its
source identity is retained in `source.json`: base HEAD, tested-file SHA256s and
the exact diff. The tool's `evidence.commit` names the base HEAD because this
capture preceded the fix commit.

Visual comparison at 13–16 seconds: the previously opaque stem fades, the fox
remains visible, and the scenery recovers after the lens clears it. Retained
before/after descent sheets are in the captures volume under
`reed/discovery-stem-quartersec/`. TypeScript, production build and `lint:feel`
pass.

Full 50-second development capture result: 3 catches and page kept, zero JS
errors, but the final overlook landing fails and guidance correctly remains
active. The fox misses the support after catch three. The state-only development
90-second and production 60-second controls also remain at `jump1`; their full
simulation traces and final game state were saved before stopping the expensive
final SwiftShader snapshot. These controls have no completed-capture claim.
Hazel independently reproduced the landing miss without the stem fix on current
source and is isolating the controller changes. This patch does not claim to
repair discovery or reproduce the older 66dac775 successful landing.

Follow-up isolation reported by Hazel: rebuilt current source e3f785b1 with
only `lookdevPlay.ts` restored from 66dac775 passes all 13 checks in a production
state-only run, completing on ground at 44.5167 seconds, matching the original
successful capture. Current-controller source instead remains at `jump1` through
90 seconds. Hazel retained the isolation at
`/captures/hazel/recheck-current-old-controller/{evidence.json,control.json}`.
This is Hazel's execution evidence, not a new independent Reed run. Thistle owns
the controller correction; current-source discovery remains an open gate until
the corrected controller is played and its landing footage reviewed.

A focused 15fps production attempt was stopped during slow SwiftShader rendering
before its first retained descent frame; it supplies no visual verdict. The
positive visibility verdict comes from the completed quarter-second development
capture and its before/after descent sheets. Its later ruin retry sheet remains
readable. Evidence also includes source hashes, the exact tested patch, all 200
frames, the 50-second movie, final screenshot and `window.__game` in evidence.json.

Subsequent diagnosis and independent replay: Hazel's onward-teaching gate
`f8442a9d` allows recovery with the current controller. The independent production
T4 replay on `c0eb9d41` passes all 13 checks and completes grounded at 55.95 s
after four misses. The controller isolation above is retained as experiment
history, not evidence that a rollback is necessary. See
`reed-discovery-priority.md` for source review and captured recovery evidence.

Combined production retest on `314a0492` is now complete: T4/EGL 70 seconds,
15 fps, all 13 discovery checks true, zero JS errors, grounded completion 55.95 s.
Every captured descent frame from 13–16 s was inspected at 15 fps; the stem
fades and the fox remains visible. Its 303 sampled positions match the
priority-only replay. Evidence volume `reed/discovery-integrated-314a0492`.
