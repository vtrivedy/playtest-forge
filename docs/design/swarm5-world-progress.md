# World progression and page-map design — Hazel, swarm5

Design contribution for `DESIGN-worlds.md`; proposal for team review during Phase A. The repointed `/swarm/seed/TASK.md` supersedes the old slice-size target. This document precedes implementation.

## Outcome

A player standing in Lanternhollow can see three distinct destinations, which places they have restored, and what their fox has learned. Solving a puzzle changes a usable route in the world and adds a colored illustration to the Album. Three unrelated quest counters would fail this goal.

Target first-play length is 30–45 minutes across three worlds. Breadth acceptance at the deadline is three reachable, visually distinct worlds with at least one actual puzzle and visible progress in each. We must state the measured playable length honestly; authored level names do not prove play time.

## Architecture choice

The production default is `opening/scene.ts` with `OpeningCtx`, `createPlay`, current fox, camera, audio, paint and discovery. `main.ts`'s Realm boot and `ashwaterReach.ts` use a different collider/runtime. Mine their authored scenery and water puzzle, but do not make that legacy boot a parallel game path.

Options considered:

1. Enlarge the existing contiguous terrain: good continuity, but requires modifying ground height, world mask, paint extent, every camera floor query, and lane baking together. High integration risk within this sprint.
2. Separate scene pages through hub arches: recommended if world builders need independent terrain. Keep the same creature controller, two actions, save schema and capture hooks. Enter by walking through an arch; no new interaction input.
3. Far-separated authored islands in one scene: can preserve the controller but must be deliberate about world bounds, terrain dispatch, light/sky palette changes, occlusion lists and paint budgets. Viable only with one scene integrator owning those contracts.

Final spatial choice belongs in shared `DESIGN-worlds.md`; progress does not depend on choosing 2 or 3.

## World and level proposal

These are design targets for debate, not claims of implemented content. Every world has a safe teaching place, a rule twist and a capstone combining its rule with existing movement. Ability names must reflect behavior that actually changes after earning them.

| World | Level | Puzzle and route change | New learning / completion evidence |
|---|---|---|---|
| Russetvale / autumn | Lanternhollow & Runaway Page | Existing chase, canopy bounce and ruin landing; return the page to the Album | Real kept page and real grounded overlook gate remain authoritative |
| Russetvale | Millbrook Kiln | Clear leaf obstruction, drive water to a kiln; its heat opens a high glide route | Water arrival / lit kiln, not proximity to the building |
| Russetvale | Hermitage | Release drying lines, expose a readable route clue, cross the newly freed path | Actual restored line / reachable landing |
| Russetvale | Hearthtree Keeping | Place warmth to reconnect steam, then root; ride the steam stair and cross the fallen tree | Settled Keeping plus player crossing restored route; earns Emberwake if its stronger ignition is new |
| Ashwater Reach / rain marsh | Ferryman's Landing | Dash a sluice LOW/HIGH; LOW exposes a passage, HIGH raises a ferry | Source feeds basin; rising float creates usable vertical route |
| Ashwater Reach | Drowned Orchard | Choose which channel receives water; one lane must drain to reach the second handle | Reversible route choice; no ticking countdown as the sole puzzle |
| Ashwater Reach | Reed Organ | Traverse a line of reed beds with dash and jump; restoration makes stepping roots permanent | Earn Reedstep here if it creates genuinely new reed footing |
| Ashwater Reach | Bell Cistern | Drain for lower handle, refill and board, cross reed footing to upper bell | Actual high-water inlet and grounded bell landing; all taught rules combined |
| Scribe's Press / winter ink | White Margin | Follow frozen page ribs, thaw first seal with learned warmth | Safe new rule lesson; first thaw changes collision |
| Scribe's Press | Folded Archive | Dash a fold hinge to alternate ramp / bridge, retain a route back | Reversible spatial reasoning, not collect three seals |
| Scribe's Press | Inkfall | Earn Inkbreak: air-dash cracks a suspended ink membrane, exposing a glide draft | Before/after ability produces distinct result from the same input |
| Scribe's Press | Wellspring Press | Combine warmth, route choice and air-dash/glide through a multi-height press | Ash Warden releases its hold; Wellspring restoration, not another arrival trigger |

Potential scope cut: three levels per world with capstone combining the first two lessons. Cut an unbuilt level before renaming a waypoint as a level. First breadth build should expose all three worlds with one real system puzzle each, then deepen.

## Progress is a consequence of puzzle state

Worlds have stable string IDs: `russetvale`, `ashwater`, `press`. Level IDs are typed and owned centrally once names are agreed. Each level is either unseen, visited, or restored. Restored is monotonic; entering a place only marks visited. An ability may be earned exactly once from its authored completion condition, not by entering the world's portal.

The world module owns its puzzle truth. It emits a completion event only after its physical mechanism and final landing are satisfied. The progress layer records the event, saves, and redraws presentation. It never grants puzzle completion from player coordinates alone, and it never substitutes `all levels visited` for a capstone completion. Re-entry must reconstruct completed world geometry from saved facts.

Proposed interface (settle exact naming with the scene owner before code):

- `visit(world, level)` — marks discovery only.
- `restore(world, level)` — idempotent successful puzzle event; returns whether progress changed.
- `earn(ability)` — idempotent, called by the ability-granting puzzle.
- `setWorld(world)` — records active destination, no grant.
- `snapshot()` — serializable canonical state for map and `window.__game`.
- `subscribe(fn)` — redraw/save on change; no polling redraw each frame.

Typed definitions prevent unknown levels, abilities belonging to the wrong world, and impossible counts. Save parsing accepts only known IDs and well-formed values; corrupted storage resets safely. Save changes use a new versioned key and preserve existing opening hooks. `?fresh` clears the new save once at initial boot, not on every portal trip. Portal navigation must not propagate a reset that erases the run.

Do not persist world positions every tick. Keep canonical completed puzzle facts and ability unlocks; safe checkpoint positions are authored per world. Losing a jump may reset position but never erase restoration. No Date/random dependency in puzzle progression; events are deterministic and replayable.

## Hub and Album presentation

Three arches ring the existing well plaza, each showing its world's silhouette and palette: russet canopy, rain-blue willow/cistern, white ink spires. Their names are readable in-frame. Return arches exist beside arrival checkpoints so a player can come home before completing a world. An arch never requires a dev URL or hidden key.

Kiln, Reed and Maple are physical Seedwells in the hub. Assign one world to each in shared design and keep that mapping in typed data. Each restored level adds a visible band of color/water; a capstone fills its well and animates its associated landmark. No need to add an orb currency. The wells remain legible when the player returns from another world.

The page map is a small illustrated Album panel, readable near the well and available through Tab (navigation/UI, not a third gameplay action). It shows three connected world illustrations, named level nodes, empty ink outlines for unseen places, an outlined colored wash for visited places, solid color for restored places, and an earned ability mark. A short current task names the next unfinished puzzle. It must distinguish visited from solved at a glance.

Render the map inside the game's canvas so screenshots and MediaRecorder contain progress. Use an event-drawn CanvasTexture on a camera-fixed plane, with the existing lettering fitting conventions. Redraw only on progress change or open/close, never per frame. Keep per-frame fitting/fade in `*.hot.ts`; no allocations there. Capture tests must include small viewport legibility and ensure the panel does not compete with teach/caption lines. When closed, a compact current-world/level identifier may remain only if it does not obscure the fox or existing hints.

## Acceptance and failure probes

1. New player boots default `/`, reaches hub arches, enters each world through real movement and returns. Capture each transition and full `window.__game`.
2. Visiting each puzzle does not mark it restored; idle beside the objective does not solve it. Test wrong action, correct action, repeated action, and re-entry.
3. Each completion visibly changes usable geometry and map/well state. A world with only a palette change fails.
4. Save/reload preserves solved geometry and earned abilities. Fresh boot clears once; travelling through an arch does not clear. Corrupt/unknown save fields cannot create a full clear.
5. At least one puzzle in each world requires a movement/ability choice, with safe recovery after failure. Demonstrate the capstone prerequisite rules; visiting an end marker cannot bypass them.
6. Record actual first-play route duration separately from deterministic speedrun duration. Do not infer 30–45 minutes from level count.
7. Run tsc, build, lint:feel; capture screenshots plus state and perform one visual review/fix/retest. Original cue/discovery, painted corridors, village stuck budget, ending composition and zero-black-frame evidence remain separate regression bars.

## Ownership proposal

Hazel: progress IDs/schema, monotonic event store/save, Album map and progress evidence. One scene integrator owns portal routing and calls the store; world owners author their puzzle conditions and earned ability behavior. Do not split changes inside `opening/scene.ts` among all builders. Reed can independently review portal/progress captures if available. Final team assignment is recorded in `DESIGN-worlds.md`.

## Source audit: existing autumn completion signals

`opening/scene.ts` builds the whole autumn slice before creating the controller. `ctx.onUpdate` registers callbacks; `state()` methods allocate snapshot objects and must not be polled each tick by a new progress adapter. Add event callbacks at the mechanism's transition or expose cheap primitive predicates. Existing authoring seeds must stay unchanged so regression input tapes remain comparable.

- `millrace.hot.ts`: dam burst is only an intermediate event; downstream water arrival / wheel running is the physical payoff.
- `millWeir.hot.ts`: `lit`, `rode`, `reached` are distinct. Current `reached` tests height and xz but does not itself require `lit`/`rode`; a capstone completion must require its intended prerequisite and a grounded landing. Do not silently promote this marker into a fully solved level.
- `hermitage.hot.ts`: `freeCount`/`painted` prove released lines. Current behavior mostly releases leaves and repaints; a claimed traversal puzzle needs an actual newly usable stair/bridge/route.
- `keeping.ts`: the `bridge` phase and `onSettled` callback are useful authoritative physical events. A new progress listener must not overwrite an existing callback; support multiple subscribers or invoke progress in the existing scene callback.
- `homecoming.ts`: `isPinned` proves the page was physically returned. Preserve the existing discovery real landing gate and the retained cue-recovery proof.

Reed's design contribution `acb5ec8e` strengthens the recommendation: earn each contextual ability in level one, develop it in level two, combine in level three. This supersedes the earlier table's capstone-only earn timing. Proposed names Hearthbound / Reedskim / Inkstep remain unapproved until the shared design settles. Prefer new contextual target behavior over changing global jump/dash physics.

## Save and event invariants to verify

- At most nine restored puzzle facts for a three-by-three design; no duplicate restored entries or duplicate earned abilities.
- A visited node never increments a Seedwell fill segment.
- A restored capstone must have its prerequisites; malformed saved capstones cannot skip unlearned mechanics.
- Load is normalization, not a gameplay completion event: no repeated celebration or duplicated geometry on reload.
- Save failures (private browsing / quota) leave current-session progression working.
- Unsubscribe/dispose removes UI listeners and texture resources if worlds reload in one page.
- Opening Tab ignores repeated keydown, prevents browser focus hopping, and does not consume jump/dash input.
- Fresh reset belongs to boot/session management, not to the shared save reader called by each world.

## Proposed minimal integration contract (Phase A)

To avoid waiting on level display-name debate, stable level keys can be `teach`, `develop`, `combine`, scoped by one of the three world IDs. The catalogue supplies the real authored place names. The store should expose primitive `isRestored(world, level)` reads without allocation. A world builder registers exactly three display definitions before map creation; duplicate keys fail at build time through a typed tuple or record.

Recommended public calls:

```ts
// Design sketch, not an implementation or final approved names.
type WorldId = 'russetvale' | 'ashwater' | 'press';
type LevelId = 'teach' | 'develop' | 'combine';
progress.enterWorld(world);                 // current place; no solve
progress.visit(world, level);               // discover only
progress.complete(world, level);            // true on first valid mechanism completion
progress.isRestored(world, level);          // primitive read, no snapshot allocation
progress.hasAbility(world);                 // first puzzle earned its world's contextual verb
progress.snapshot();                        // capture/UI only, not per-tick
```

Earning from the teach puzzle rather than a free public `earn` call gives each ability one provenance. Completing develop requires teach; completing combine requires teach + develop. If the canonical design supports branching prerequisite order, encode that in the catalogue rather than scattering ad-hoc tests in world modules. World owners remain responsible for applying new contextual ability behavior before the store marks it earned.

Snapshot includes `activeWorld`, discovered/restored state for all named levels, earned ability names, three Seedwell fill fractions and revision. Hub presence should be explicit (`activeWorld: 'hub'`) even though its physical space is in the autumn scene. Saved data contains completed mechanism facts and known visited nodes; current active world can remain session-only so a reload starts safely in the hub unless the integrator deliberately supports checkpoints.

Progress map opening/closing is presentation state and does not write a gameplay save. Every snapshot field must be derived from one canonical set of facts so ability/Seedwell/map cannot disagree. The map renders only the store's catalogue and facts; a level module never sends freeform HUD strings every frame.

Source-linked portal constraints (Reed's Phase A audit): original world-bounds mask covers only x[-140,90], z[-10,170]; active world ground and bounds dispatch must be explicit. `createPlay` caches camera sight proxies from initial colliders, so dynamic / later-built solids need a camera rebuild or prebuilt proxies. `teleport` resets motion but not held keys/stick; scene transition must neutralize inputs and prevent reciprocal portal bounce until the fox leaves the arrival trigger.

## Narrow autumn ability extension — Hearthbound proposal

Source audit correction: `carry.ts` already has persistent placement, pickup and bowl-held warmth. Those cannot count as the world's new reward. Proposed measurable addition: after the first physical autumn puzzle completion, the fox can **dash while carrying warmth**. Before learning, `beforeDash` sets the ember on the last safe ground; after learning it stays in the animated mouth. This preserves jump + dash controls, makes an earned action combination, and changes neither global dash tuning nor the original movement routes. No new collectible economy.

Implementation boundary: carry accepts an optional primitive `canDashCarry` predicate; absence retains baseline drop behavior. Scene integrator supplies `() => progress.hasAbility('russetvale')`. Stats expose successful retained dashes for replay proof. A fixture must run the identical pickup → dash action sequence locked and unlocked, proving drop vs retention and unchanged source location/recovery behavior. Final real-input proof still needs scene integration and the ability-granting physical completion event. Proposed autumn completion ordering: kept runaway page (teach), physically lit/ridden/reached Millbrook route (develop), restored/crossed Hearthtree bridge (combine). These bindings are not implemented claims; canonical scene owner decides them and save reconstruction.
