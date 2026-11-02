# Saved autumn mechanism audit

Runtime `6a97a81a`, staged three-snapshot replay:
`/captures/hazel/saved-autumn-audit/evidence.json`. Each fixture injects the
same prerequisite-valid restored prefix into all worlds. This diagnoses load
reconstruction; it does not prove earning facts or physical portal traversal.
The tool uses native Tab and records full `window.__game` plus screenshots.

All three fixtures pass existing saved opening, quiet arch, Ashwater and Press
checks with zero JavaScript errors. Autumn does not reconstruct its later
physical states:

| Saved autumn prefix | Keeping | Bridge | Chemistry complete | Old finale |
| --- | --- | --- | --- | --- |
| teach | arrested | absent | false | sealed, zero kindles |
| teach, develop | arrested | absent | false | sealed, zero kindles |
| teach, develop, combine | arrested | absent | false | sealed, zero kindles |

The teach fixture is correct. Develop and full fixtures disagree with current
scene completion bindings: Keeping settled writes develop; old finale kindle
writes combine. Inspected `full-album.png`: the Album visibly checks all three
autumn levels and fills the Kiln Seedwell despite those absent physical states.

There is also a mapping discrepancy to resolve before implementing load state:
the catalogue and earned memories call develop **Millbrook Kiln** (mill ledger)
and combine **Hearthtree Keeping** (Hearthtree page). They do not name the old
autumn finale. Restoring the currently wired mechanism without resolving this
would preserve the map/story disagreement. Maple was notified in swarm604.

`tools/world-save-runtime.mjs` now reports `autumnMatchesSave` per case and
`autumnReconstructionCompleted` separately. Existing
`worldReconstructionCompleted` remains the bounded Ashwater/Press result; its
success must not be cited as all-world reconstruction. The diagnostic makes no
gameplay, geometry, save-schema, or controller changes.

Any eventual reconstruction should derive from the canonical saved facts,
rebuild walkable colliders before camera proxies bake, and suppress fall/impact,
kindle, story, camera and title celebrations on load. Fresh play must retain its
actual mechanism/ground-contact gates. Review both partial and full saves, then
rerun fresh discovery and a physical autumn route on the final bindings.

The updated diagnostic replay is retained at
`/captures/hazel/saved-autumn-audit-assertions/evidence.json`: existing gates pass,
zero JS errors, `autumnReconstructionCompleted:false`, per-case results
`true,false,false`. Inspected the new full hub frame (whole fox visible, no
new-arch announcement) and retained its Album comparison in this directory as
`saved-autumn-full-hub.png` and `saved-autumn-full-album.png`. TypeScript,
progress prerequisites/persistence tests, tool syntax and diff checks pass.
