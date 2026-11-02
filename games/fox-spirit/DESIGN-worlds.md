# Russet Vale — three worlds (swarm5 repoint, canonical)

Vivek, Nov 2: "multiple worlds, interesting levels and puzzles, different shifts in scenery and clear markers of
progress." Target 30–45 min; deadline floor: hub → 3 worlds reachable in the real build, each looking different in
frames, ≥1 real puzzle + visible progress per world, baseline five fixes not regressed.
Contributions folded in: Hazel `docs/design/swarm5-world-progress.md` (progress contract, 3×4 puzzle table),
Reed `docs/design/worlds/reed-design-pass.md` (teach / develop / combine, real geometry changes, acceptance).

## Architecture (Maple, scene integrator)
One scene, one fox / controller / camera / paint / save — no second runtime (legacy `main.ts` Realm and
`ashwaterReach.ts` are mined for ideas only). The other worlds are **islands far along x**:

| id | world | season / look | origin | file |
|---|---|---|---|---|
| `russetvale` | Russetvale | autumn, sepia → painted (today's slice) | the Great Well (−8, 85) | existing |
| `ashwater` | Ashwater Reach | rain marsh: slate sky, dense grey fog, rain, pools, reeds | (700, 85) | `ashwaterLayout` in `worlds.ts` + builder |
| `press` | the Scribe's Press | winter ink: pale sky, snowfall, snowfield, ink spires, page slabs | (−700, 85) | `pressLayout` in `worlds.ts` + builder |

- `opening/worlds.ts`: registry (`WORLDS`, `WorldId`, spawn, look) + pure terrain `ashwaterH/E`, `pressH/E`.
  `layout.groundH` dispatches on `|x| > WORLD_SPLIT (350)`; `worldBounds.inside()` includes each island
  (`E < 1`) so the controller's world mask and the `lint:feel` anchor check cover new worlds automatically.
- `opening/worldsScene.ts`: island ground + set dressing, **hub arches** north of the Great Well (Ashwater at
  (−2, 91), Press at (−10.5, 92.6)), a **return arch** behind each island spawn, per-world sky / fog / key light /
  rain|snow eased by the fox's x. Walking through an open arch (crossing its plane between the posts) teleports to
  the destination spawn and captions the world name. `state().opening.worlds = { active, travels }`.
- Islands are painted in their own colours from the first frame (patchPaint: `paint = 1` for `|x| > 350`).
- Arches open once the runaway page is home (homecoming pinned) — the existing chase stays the first hook (baseline
  discovery bar). Dev hook `__gameHooks.travel(id)` exists for captures only; players walk.

## Story (Vivek 3:25 PM: "a real story" — characters + turns; every beat works text-off, Album pages carry words)
**Premise.** The Scribe loved one autumn so much that they pressed the world flat into the Album so it would never
end. Pressing stops time: things that are pressed can't finish (the tree can't fall, the brook can't run, the year
can't turn). The last hearth-fox wakes in the sepia, and every place it helps *finish its moment* gets its colour back.

| world | someone to meet | revelation (Album page earned on the combine level) | reason to go on |
|---|---|---|---|
| Russetvale (autumn) | the runaway **page** (it is a page of the Album trying to get home) and the four pressed creatures; at the Keeping, the **Ash Warden**'s silhouette watches from the far crag | page 1 *"Here the Scribe kept every autumn"*: the Album is real and the valley is one of its pages | the Warden leaves its ink footprints toward the **marsh arch** — something was pressed there first |
| Ashwater Reach (rain) | the **Ferrykeeper** — a heron pressed mid-wade who has held the last ferry for years; the Warden is the one who froze the sluices | page 2 *"The Scribe pressed the rain first"*: the marsh was the Scribe's home; they pressed the flood that took their house, then could not stop pressing | the Ferrykeeper's lantern points to the **winter arch**: the Scribe went to the Press to press the last season, winter, so the year could never turn |
| The Scribe's Press (winter ink) | the **Scribe** at last, small and old at the Press; the Ash Warden turns out to be the Scribe's own shadow — the ink of every pressed moment | page 3 (the turn) *"I kept autumn because it was the last season we were all here"*: the Scribe pressed the world to keep the people they lost; the fox sets warmth in the Press and the Scribe chooses to let the year turn | the ending already built: snow, the kits, *"and the year turned"*; the hub's three Seedwells full |

No dialogue system: the page words are ≤ 12 words each, staged as Album pages (Hazel) at the moment of the
revelation; characters act (the heron poles the ferry once the water is right; the Scribe lifts the Press lever).

## Worlds, levels, puzzles (teach → develop → combine; no caption tells the answer)
Rules for every level: one distinct world system + the world's ability; the combine level needs the *insight* that
two earlier rules interact; a cue-following bot must not finish it from captions alone (captions name the place
and the feeling, never the action). Each level is a place with a landmark you walk to, a side path and a secret.

**Russetvale — autumn (ability: Hearthbound — the dash keeps a carried ember)**
1. *Lanternhollow* — the runaway page chase through canopy and ruin (exists). Secret: glyph shrine.
2. *Millbrook Kiln* — leaf dam → brook → wheel → kiln updraft to the lookout (exists).
3. *Hearthtree Keeping* — carry the coal to steam, then root; the tree falls into a bridge (exists); with
   Hearthbound the coal survives a dash across the steam stair — the faster route.

**Ashwater Reach — rain marsh (system: water levels; ability: Reedskim — reed mats hold you)** (Cedar)
1. *Low Sluice* — the marsh is too deep to wade; burst the right dam and the channel drains to expose footing.
   Insight: which dam drains *which* pool (water runs downhill along visible channels).
2. *Reed Pond* — reed mats only bear weight once Reedskim is earned; chain jumps, then drain the islet pool from
   above (the second dam is only reachable from the mats).
3. *Weir Heart* — the weir steps are under water until BOTH pools are drained *in the right order* (draining the
   pond first floods the channel again); the Ferrykeeper poles across once the weir shows → Reed Seedwell.

**The Scribe's Press — winter ink (system: warmth melts ink, ink freezes; ability: Inkstep — an air-dash breaks a
frozen membrane into a glide draft)** (Thistle)
1. *White Margin* — the seal in the ink ridge melts only to warmth carried from the brazier before it fades (11 s):
   route-finding against a clock you can see (the ember dims).
2. *Folded Archive* — the membrane over the shelf is solid; Inkstep (jump + air-dash) breaks it into a draft;
   ride it onto the 4.4 m Archive shelf.
3. *Wellspring Press* — the iced membrane must first be warmed (Press brazier) AND then broken with Inkstep while
   gliding — warmth and ink together; the Scribe lifts the lever → Maple Seedwell, the ending.

**Hub** — Lanternhollow's well: three Seedwells fill, arches light as worlds open, Album (Tab) shows pages earned.

## Honest scope for 6 PM
All nine levels exist as playable code (Russetvale 3 shipped; Ashwater 3 and Press 3 pushed with input-only
probes). Bigger *walkable area* (10–15 min per world) and the story pages/characters are the next work, in that
order: characters + pages (Hazel: Album pages; Cedar: Ferrykeeper; Thistle: Scribe at the Press; Maple: Ash Warden
footprints across worlds + hub), then side paths/secrets per world. Placeholder art (disc mats, flat lawn, glass
tubes) is not done — each builder replaces theirs before calling a level shipped.

## Progress (Hazel)
Typed ids `russetvale|ashwater|press` × `teach|develop|combine`; monotonic `visit / restore / earn` store, versioned
save, canvas Album page-map (Tab) and the three hub Seedwells (Kiln = Russetvale, Reed = Ashwater, Maple = Press).
Completion only from physical puzzle truth, never from coordinates. The scene calls `setWorld` on travel.

Saved-game acceptance also checks the opening invitation: once the page is already home, reload must not
restart its chase or display its old instructions. Keep the complete boot state and screenshot alongside
the foreign-world reconstruction checks; a clear travel camera does not establish a clear initial lens.
The saved-page contract is pinned homecoming plus inactive discovery, independently of later world facts.

## Who builds what
- **Maple** — scene integration: worlds registry, terrain dispatch, mask, arches, travel, per-world look/weather,
  island ground/dressing; then hub arch gating via Hazel's store; then Press level 1 if free.
- **Cedar** — Ashwater levels (sluice/ferry first), inside `opening/ashwater*.ts`, using `WORLDS.ashwater.origin`.
- **Thistle** — Press levels (thaw seal first), inside `opening/press*.ts`, using `WORLDS.press.origin`.
- **Hazel** — progress store / save / Album map / Seedwells; hub arch open-state from the store.
- **Reed** — independent real-input acceptance: hub → each world → back, re-entry, save, GPU frames, baselines.
Builders: register colliders/occluders through `ctx`; add new walkable shapes to the island `E` or `worldBounds`
(the lint fails otherwise); never draw `ctx.rand` (own `rng(seed)`); per-frame code in `*.hot.ts`.

## Acceptance
Real build `/`: chase → page home → walk through each hub arch → island (frames differ: rain marsh vs winter ink vs
autumn) → solve ≥1 puzzle → progress visible (Album / Seedwell) → return arch home. Baselines: cue discovery,
corridor colour (`tools/corridor-colour.mjs`), ending, `check:stuck`, 0 black frames. Honest duration measured.

### Independent Ashwater acceptance harness (Reed)
`tools/world-ashwater-acceptance.mjs` starts fresh, follows the rendered discovery invitation with ordinary stick/jump/dash,
walks the kept page home and crosses the hub arch before replaying the Ashwater movement route. It records full hook
and `window.__game` states at each beat. No teleport, progress setters or saved-unlock fixture count as route proof.
A failure is retained with the last position; later stages may not mask a failed entry.

Entry review found the finale's homeward guidance continuing in Ashwater after discovery had finished. Scope both its
hint and mote trail to Russetvale; defer a pending homecoming caption until returning there. Foreign-world puzzle
hints retain the shared teach panel. Verify via the fresh route's foreign-world screenshot/state after the change.

### Independent portal circuit (Reed)
Extend the fresh-boot acceptance with an optional entry-tour: after physical Ashwater entry, walk back through its
return arch, cross the Press arch from the hub, return home, then re-enter Ashwater. Assert every active-world and
travel-count transition and retain screenshots plus complete `window.__game`. This isolates portal reachability and
re-entry from the evolving puzzle routes; it does not claim puzzle completion or blind discovery.

Measure breadth from the same baked one-metre movement mask used by the controller. Report permitted footprint and
bounds per world; these include water, obstacles and disconnected cells, so are not a reachable-area or duration
claim. Record immutable commit in the JSON report. Use actual route simulation time separately from capture wall time.

Portal-circuit visual review on 053e9e0c found both home-return lenses almost wholly blocked despite camera
`blocked:false`. Diagnose with staged world travel and centre-screen mesh intersections; compare return landing
positions without changing the opening spawn. Fix the landing or missing occluder, then repeat physical circuit.

Extend the physical portal circuit with optional Press puzzle-route acceptance. Reuse Thistle's documented movement
sequence through a dedicated input helper after real hub entry; assert all three physical completion facts and earned
Inkstep, then walk home. This proves solvability from the hub, not blind insight. Retain all intermediate frames.

Update independent Ashwater acceptance for the Weir Heart cistern: retain the physical fresh-boot entry, then test
that standing on a reed mat sinks it and returns the fox to dry footing. After draining the mill pool, enter the
cistern, climb the weir and dash its third reed gate. Assert a risen pool and active flood before using the punt
and east wall to reach the Seedwell. Retain full states at the drained, flooded and completed beats; this is
solvability evidence, not blind puzzle discovery or a duration target.
