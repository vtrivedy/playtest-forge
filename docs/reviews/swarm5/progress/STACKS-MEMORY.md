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
