# Independent optional-memory reloads

Runtime source `5964c2e8`; `tools/world-memory-reload.mjs` injects four saved
fixtures: neither memory, Stacks only, Loft only, and both. Each fixture reloads
the actual scene twice and opens both optional Album spreads using native Tab
and bracket keys. Canvas text instrumentation checks earned-title visibility
and the missing-page placeholder, independently on both spreads. Full
`window.__game` states are retained at boot and after closing the Album.

This verifies save reconstruction and native UI integration. It does not prove
physical acquisition of either page, blind discovery, or portal reachability.
No game source, progression binding, geometry, or feel tuning changed.

The initial probe cleared its text capture after the key event and therefore
missed the cached Album drawing. That harness assertion failed; it was corrected
to reopen the current spread using native Tab. No product defect was inferred
from that failed instrumentation attempt.

Final source-frozen replay PASS: all four fixtures, two loads each, zero page
errors; each spread reveals only its own earned memory. No level completion,
ability, or Seedwell gain in any fixture. Evidence:
`/captures/hazel/memory-reload-four-fixtures-retest/evidence.json` plus sixteen
Album PNGs. Personally inspected the second-load Stacks-only and Loft-only
frames: each title and full paragraph fits, controls remain visible.
TypeScript, world-progress checks, tool syntax, and diff whitespace pass.

Integrated retest on `fdfa4388` (includes `keeping-d3` `4901c674`) also
PASS: all four fixtures × two loads, zero page errors. Full states and sixteen
frames: `/captures/hazel/memory-reload-integrated-retest/`. Personally inspected
both second-load earned spreads: [Stacks](optional-memory-reload/stacks.png),
[Loft](optional-memory-reload/loft.png). Their text fits; body and controls remain
faint at smaller resolutions, as Reed independently noted. Reed owns a focused
contrast follow-up; this diagnostic does not claim that readability issue fixed.
TypeScript and progress checks pass after merge. Saved-autumn mechanism mapping
and reconstruction remain explicitly outside this successful optional-memory test.

## Four-secret integration — 81cf2be3

Merged Maple `0a4201aa`, Cedar `b53e3dee` and Reed `60d78bfe`, including the
two Ashwater memories and Reed's darker Album typography. The harness derives
page count from `SECRET_IDS`, then checks six fixtures: none, each of the four
secrets alone, and all four together. These are six selected fixtures, not all
sixteen possible subsets.

`/captures/hazel/memory-reload-four-secrets-integrated/evidence.json` PASS:
twelve real scene reloads, forty-eight native-key Album screenshots, zero page
or console errors. Every spread reveals only its own earned title; other
unearned titles and missing-page placeholders behave correctly. Saved roof and
mooring facts also reconstruct their independent physical Ashwater bit flags.
No fixture grants level completion, an ability or Seedwell fill.

Offline paragraph checks against the captured canvas text confirm all sixteen
earned views contain their complete authored paragraph. They additionally check
every closed-Album snapshot: secrets persist and all worlds still have zero
completion/fill and no ability. Results are retained as `paragraph-checks.json`
beside the runtime evidence. This checks text content; actual visual fit was
reviewed separately in the four second-load singleton frames:
[Stacks](four-secret-reload/stacks.png), [Loft](four-secret-reload/loft.png),
[roof](four-secret-reload/roof.png), [mooring](four-secret-reload/mooring.png).
The paragraphs and controls fit and remain readable at 960×540.

The older component preview's hard-coded two-secret wrap assumption was a
harness error, not a game-wrap defect. It now uses the declared secret count and
requires all three Seedwell labels before naming a screenshot `map-return`.
`/captures/hazel/map-preview-four-secrets/component-checks.json` PASS:
native real-key Tab, component close/open, `secretCount:4`, `wrappedToMap:true`,
zero page errors. This preview deliberately uses injected component facts;
physical acquisition and portal reachability remain outside its claim.

After merging landed `keeping-d3` `69da5af0` (game sources identical to this
tested integration), the full saved-prefix diagnostic repeats successfully at
`/captures/hazel/world-save-four-secrets-integrated/evidence.json`: autumn,
Ashwater and Press reconstruction, saved opening and quiet arches all PASS for
teach/develop/full; zero page or console errors. The autumn fix and fresh
physical/production-opening evidence remain in [AUTUMN-SAVE-FIX.md](AUTUMN-SAVE-FIX.md).
TypeScript, Vite build, feel/camera/world lint, progress checks, harness syntax
and whitespace checks pass. No production changes accompany these diagnostics.
