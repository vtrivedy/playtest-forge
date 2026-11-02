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
