# Optional Stacks memory

Hazel source `37ac2e37`; integrated Maple side climb `45b21754` in `af559797`.
The version-one save now accepts an optional typed `secrets` array. Finding
`press-stacks` persists an Album memory independently of restored levels. It
cannot fill a Seedwell or unlock an ability. Unknown and duplicate saved ids
normalize, old saves remain valid, and repeat discoveries are quiet.

The fifth Album spread is “Unpressed pages.” Before discovery it shows an empty
binding without the family memory; discovery stages a short returned-page line
and Tab opens the earned spread. Known secrets initialize without a notice.

Component evidence: `/captures/hazel/album-stacks-component/`, including full
`window.__game` and fixture progress in `state.json`, native Tab check, three
world spoiler checks, missing-secret frame, returned-page frame, earned-memory
frame, and five-spread navigation back to the map. Zero JavaScript errors.
The fixture stages facts; it is not proof of reaching or earning the secret.

Visual review: inspected `secret-memory-960.png` and `secret-returned-960.png`.
The prose fits its card and is readable; the returned notice leaves the fox
visible. This remains a prose memory, not a staged family scene. No controller
or movement parameter changed.

`tools/world-progress-check.ts` passes secret-only save/reload, idempotence,
normalization, reset, and no-ability/no-Seedwell assertions alongside existing
prerequisite gates. TypeScript, lint:feel and diff checks pass on the initial
source. Physical callback/reload verification follows after the Stacks owner
wires the new store callbacks; no earned-secret claim until that replay passes.

## Integrated earned-memory replay

Source `22b73a2b` connects the physical stand to the canonical store. The stand
initializes from `isSecretFound`, and `onFound` reports the first arrival. The
Album owns the returned-page notice, avoiding a duplicate caption of the same
words at the bottom of the screen.

`node tools/press-stacks-probe.mjs /captures/hazel/stacks-secret-integrated`
completed with zero JS errors and `completed:true`. After a labeled developer
travel/staged starting position, actual stick and jump inputs reach all eight
stacks and the stand (`k:9`). The recorded full runtime state contains only
`secrets:["press-stacks"]`; every world has zero fill and no ability. Native Tab
opens the earned-memory spread. Reload retains the secret, and a staged visit
to the stand does not replay the discovery caption or returned-page notice.

Inspected `climb.png`, `earned-memory.png`, and `revisited-stand.png`. The fox
and returned-page notice are readable and separate; the memory fits the Album.
The 640px capture is a bounded integration check, not Press art acceptance or
an uninterrupted hub route. Existing slab-like geometry remains in this source
and is being replaced by the world owners. Component fixture at 960px above
provides the closer typography review. No movement parameters changed.

Final integration retest on `6a01987e` (Thistle `eb4abb29` Scribe/Press art,
Maple `c4aae0bd`): `/captures/hazel/stacks-secret-art-retest/`, PASS9/9 climb,
secret-only progression, native Album, reload and quiet revisit; zero JS errors.
Added `reloaded-memory.png` proving the persisted memory can be opened again.
Inspected that frame plus `climb.png`; no duplicate discovery caption and fox
silhouette remains clear. Retained movement telemetry: last jump apex .750 m,
air .700 s, time to apex .300 s, zero dashes; no feel tuning in this change.
TypeScript, lint:feel (160 anchors), progress checks and diff check pass.
