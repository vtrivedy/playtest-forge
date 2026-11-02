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
pass. Full traversal result is recorded below when the replay finishes.
