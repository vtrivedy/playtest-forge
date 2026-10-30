# Design-flow lessons — Unreal Sensei “How to Make Games in Unreal Engine 5 with AI”

**Source:** [How to Make Games in Unreal Engine 5 with AI](https://youtu.be/R_HFCPd5eAw) by Unreal Sensei (~2h22m).  
**Local:** `playtest-forge-artifacts/sprint2/ref/design-ref.mp4`, captions `design-ref.en.srt`, cleaned transcript `design-ref-transcript.txt`, key frames in `ref/frames/`.  
**Method:** cleaned auto-captions into plain text, built a chaptered outline, then inspected ~30 frames at the moments the transcript names (prompts, feel polish, volumes/splines, grill-me, final play). This is transcript + targeted frame inspection, not a full watch.

Artifact copy (with frames/transcript): `/workspace/siyu/playtest-forge-artifacts/sprint2/design-flow-lessons.md`.

---

## 1. Short summary

Unreal Sensei builds a tower-defense prototype (**Blob Siege**) inside Epic’s Electric Dreams mountain/castle environment without writing the gameplay code by hand. Claude Opus (and sometimes GPT) drives Unreal through MCP + C++ generation. The human owns the vision: feature-by-feature prompts, play-in-editor after every change, expose tunables, then iterate feel (smoothing, delays, feedback). Assets lean on Fab / marketplace; he explicitly warns that AI is still weak at third-person locomotion and game feel, so he reuses Advanced Locomotion System / Game Animation Sample rather than regenerating a character controller. The loop is: long stream-of-consciousness prompt → compile → play → note what’s wrong → smaller fix prompt → optionally “grill me” when the design is fuzzy → expose a settings actor → sculpt the level to match the systems → polish UI last.

---

## 2. Chaptered outline (timestamps)

| Time | Chapter | What’s happening |
|------|---------|------------------|
| 0:00–2:50 | Hook + demos | AI-made Minecraft remake, procedural star system (“mini No Man’s Sky”), ninja 2D platformer; introduces Blob Siege as the tutorial build |
| 2:50–6:10 | Models + philosophy | Use top models (Opus / GPT). **Human makes gameplay decisions**; do not one-shot a whole game. Feature-by-feature, test every stage. Unreal’s editor keeps manual override |
| 6:10–15:00 | AI ↔ Unreal setup | Unreal MCP (watch the AI edit the level) vs C++ generation (where most gameplay lands). Point Claude/Codex at the project; enable plugins; install skills; migrate starter assets |
| 15:00–28:00 | Baseline playable + kitbash | First-person map, marketplace meshes for turrets, clean viewport workflow. Close editor when compiling C++ |
| 28:00–51:00 | First C++ feature (turret) | Long precise prompt for a turret class; expose properties; CLAUDE.md / project rules; handoffs between threads; live compile |
| 51:40–1:01:00 | **Feel iteration** | Stream-of-consciousness prompting as talking to a coworker. Scanning → lock-on → line-of-sight → **smooth dampening** (snap is “not realistic”) → lock-off delay → **debug FOV/range visualizers + 3D widgets** |
| 1:01–1:16 | Blueprints + variants | Child blueprint turrets (green rapid-fire, grenade); keep C++ as source of truth; UE6 direction toward AI-friendly graphs |
| 1:16–1:23 | Why learn the engine | Hand-coded fundamentals still matter; Steam AI-art vs AI-code distinction; Fab benefits |
| **1:23–1:27** | **Locomotion warning** | AI struggles with **character animation, locomotion, game feel**. Third-person AI games often look mechanically OK but animate terribly. Prefer ALS v4 / Game Animation Sample / Fab over regenerating locomotion |
| **1:26–1:34** | **Iteration = power** | Feature feedback loop: weeks → ~1 hour. Small prompts, rollback if bad. Blob enemy: screenshot references, squash & stretch, “feel alive,” impact flash + kickback + screech |
| 1:34–1:45 | Friendly switch + death VFX | Retarget turrets to blobs; Niagara disintegration with A/B toggle keeping old death |
| **1:38–1:45** | **Core loop in one prompt** | Spawn volume + attack volume + cash + shop + wave escalation + **wave-settings actor** with every tunable exposed. Playtest, tweak numbers |
| **1:45–1:52** | **Grill-me skill** | When the feature is fuzzy, force the AI to ask design questions (role, economy, spawn, readability, friendly fire, settings home) before coding |
| 1:52–1:58 | Placement UX + HUD | Hologram → place, cash, kill counter; refine slowly rather than dumping the whole game |
| **1:58–2:08** | **Level design for systems** | Spline enemy path with editable width; sculpt landscape + foliage to match the game (ramp to castle, cave spawn); collision fixes; duplicate level before big edits; alpha blob path-then-chase |
| 2:08–2:19 | Polish | Graphics settings, pause, AI-generated logos + start-screen camera, consistent UI language |
| 2:19–2:22 | Play + wrap | Full hectic round; “possibilities are limitless” but stop feature-rabbit-holes |

---

## 3. Concrete design-flow & AI-workflow lessons

### 3.1 Idea → playable

1. **Start from a rich environment, not an empty scene.** He drops systems into Electric Dreams rather than building art and gameplay at once.
2. **Establish a baseline pawn that already moves** (marketplace / template) before inventing systems.
3. **One system at a time**, playable after each: turret → feel → variants → enemy → wave loop → path → level sculpt → UI.
4. **Define space with volumes and actors the designer can drag**, not hard-coded coordinates buried in prompts.
5. **Core loop gets one long prompt once the pieces exist** (spawn, goal, fail, economy, escalation, settings hub).
6. **Level art bends to the systems last** (sculpt a ramp so blobs can reach the castle; move the cave closer for tutorial pacing).

### 3.2 How to prompt / iterate with AI

| Practice | Detail |
|----------|--------|
| Stream of consciousness | Talk like a coworker; long, detailed, stateful (“by default scanning… then lock on… when behind cover lock off… play this sound… expose these knobs”) |
| Screenshot the ask | Paste UI / prior prompt / reference photo; “run this prompt, make it look like photo 2” |
| New thread per big feature | Avoid polluted context; write a handoff when switching |
| Project rules file | CLAUDE.md-style: property grouping, descriptions, when to use MCP vs headless, effort level |
| Expose everything | Tunables + tooltips on a settings actor / details panel so balancing is play → tweak → play |
| Debug viz | FOV cones, ranges, paths — only when selected, never in game view |
| A/B toggles | Keep old behavior behind a flag when trying a new VFX/feel |
| Grill-me | Force clarifying Qs before coding fuzzy features |
| Brutal visual QA | Eyes too small, clipping, snap rotation, missing delay — name the failure, don’t say “make it better” |
| Non-determinism | Same prompt ≠ same result; teach the *workflow*, not a recipe to clone |

### 3.3 Gameplay loops

- Loop = **threat → player agency → resource → upgrade → harder threat**, with a clear fail state (“tower has fallen”).
- Escalation is data (wave count, health, size), not new code every wave.
- Inter-wave downtime (10 s setup) is designed, not accidental.
- Economy ties kills to placement options (turrets, friendly units).
- Special units break the pattern (alpha that peels off the path toward the player) so the loop stays readable but not robotic.

### 3.4 Level design

- **Author paths the AI/NPCs will use** (splines with width) so encounter shape is designable.
- **Playtest with exaggerated counts** (100 blobs) to stress gaps, cliffs, collision.
- Separate **art mesh** from **gameplay volumes** (TRIGGER_ATTACK, spawn boxes) — see frame `02-05-10_sculpted-level-path.jpg`.
- Duplicate the level before destructive sculpt.
- Collision must match visuals; regenerate or ask AI to fix named meshes.
- Pacing: shorten travel for tutorials; keep the long scenic route for the “real” game.

### 3.5 Character movement / animation / feel

- **Explicit admission (1:23–1:27):** locomotion + game feel are where AI-generated games fail; prefer a proven locomotion pack over regenerating walk cycles for months.
- Feel language that works in prompts: **squash & stretch, dampening/smoothing, lock-on delay, pushback, flash, sound on impact, “feel alive.”**
- Snap rotation / teleporting aim is called out as unrealistic; always request interpolation and expose the rates.
- Satisfaction comes from **readable feedback on every interaction** (flash + kickback + screech), not from more systems.

### 3.6 Playtesting

- Play in editor after every prompt.
- Headless capture / screenshots when the AI can verify VFX.
- Tune on exposed numbers, not re-prompts, once the behavior is correct.
- Kill features fast; iteration speed is the point.

---

## 4. Apply to the fox game (sprint 2)

Context: three.js + Rapier Spyro-style fox spirit (`vtrivedy/playtest-forge`). Vivek’s sprint-2 feedback: **(a)** fox movement rigid, slides in a line, no leg/body motion, physics unrealistic; **(b)** character design meh vs Zelda bar; **(c)** orb collecting is boring — need BotW-style systemic interest. Design docs already describe Seedwells / ember wake / Ash Warden; the *playable* still reads as mote pickup. Use the lessons below to close that gap.

### 4.1 Movement & physics (feedback a) — **highest priority**

| Lesson from video | Concrete sprint-2 action |
|-------------------|--------------------------|
| AI is bad at locomotion; steal a good system | Do **not** one-shot “make the fox run better.” Spec a real gait: plant feet (IK or authored contact frames), body pitch/roll from accel, tail lag, head look, turn lean. Prefer retargeting a known quadruped run (Mixamo/animal pack / custom Blender clips) over pure procedural generation |
| Snap = fails QA | Ban root-motion slides. Root follows capsule with spring; legs animate relative to velocity. Cap turn rate; add coyote/buffer already in `game-design.md` must be *visible* in the mesh |
| Dampening + exposed knobs | Expose in lil-gui / `__game`: foot plant stiffness, body lean, tail lag, jump squash, land compress, dash smear. Playtest video must show before/after |
| Feel words that work | Prompt Opus/Sol with: squash on land, stretch on jump apex, shoulder sway, weight shift on turn, “no skating,” “paws leave and return to ground,” ember wisps burst on footfall |
| Debug visualizers | Draw foot targets, velocity vector, grounded flag, capsule vs mesh offset — selected-only, like his FOV cones |
| Brutal judge | Reject any capture where legs are T-posed, sliding, or locked; Sol must list concrete failures (as we already learned mid-sprint 1) |

**Unreal→three.js map:** ALS / Game Animation Sample don’t port. Closest: authored GLB clips + AnimationMixer blend tree + simple foot IK (raycasts) + Rapier capsule that doesn’t fight the root. If after 2–3 days three.js still can’t hit “animal weight,” **argue for Unreal later for the character controller only** (or export better clips from Unreal/Blender and keep rendering in three.js).

### 4.2 Character design (feedback b)

| Lesson | Action |
|--------|--------|
| Don’t regenerate everything; use strong references | Keep concept turnaround as hard gate. Every fox candidate is screenshot-compared to `assets/concept/fox-turnaround.jpg` (as Sensei did blob vs prior blob) |
| AI art is OK if player-facing quality is judged harshly | Blender MCP rebuilds are fine; **Zelda bar = silhouette, material richness, readable face, grounded paws, spirit tells (embers, flame tail) without looking like a stock red fox** |
| Pick shapes the pipeline can win | Sensei chose a sphere because the engine already had spheres. For us: prefer refining the existing rigged fox over a new Hunyuan/Trellis mesh that won’t animate |
| Readable feedback on the body | Hit/land/dash should flash ember, compress the rig, scatter wisps — same “satisfying to hit” idea applied to *player verbs* |
| Honest non-fit | Photoreal Electric Dreams ≠ our painted autumn look. Steal *process* (reference → grill → iterate), not UE5 Lumen aesthetics |

Land `fox3-final-wip` only after side-by-side frames beat concept on: burnt-orange depth, no white leg glare, spirit silhouette, working run cycle.

### 4.3 Level design & systemic play (feedback c)

The docs already outline Seedwells, ghost-ink, Burst, Warden flood — **that is BotW-adjacent systemic design**. The failure is shipping a vertical slice that *plays* as orb collection. Sensei’s fix pattern: **encode the loop as volumes + settings + readable world reaction, then sculpt the space so the loop is forced.**

| Lesson | Action for Russetvale |
|--------|----------------------|
| Core loop in one explicit prompt | Rewrite the playable loop as: explore sepia → **tool verb** (Burst / wake / Seedwell light) → **world permanently changes** (bridge grows, updraft ignites, vine climb appears, mist clears) → new traversal → shrine/Warden. Embers become *breadcrumbs and thresholds*, not the goal |
| Volumes + settings actor | Author `RestoreVolume`, `UpdraftVolume`, `GhostInkBridge`, `Seedwell` as first-class objects with exposed radii/timings (three.js helpers + lil-gui), not one-off code in the meadow |
| Splines / authored paths | Use paths for ash-creature patrols, leaf-drift lines, and camera rails for the shrine restore — designer-editable, not baked coordinates |
| Level bends to systems | Sculpt/blockout so you **cannot** finish the meadow without lighting a Seedwell that *opens* the windmill cliff (BotW “chemistry” beat). Delete dead mote rings that don’t teach a verb |
| Grill-me before building the new loop | Opus vs Sol each propose a BotW-style verb set (fire/wind/growth/time analogs in autumn magic); grill-me questions lock: what restores, what is temporary wake vs permanent, what the player *does* at a shrine besides stand there |
| Stress test | Spawn exaggerated ash creatures / restore radius to find cliffs and soft locks (his 100-blob test) |
| Feature rabbit holes | Do **not** add barracks-style extras. Ship 3 systemic toys well: Seedwell restore, Burst-held platforms, updraft from restored braziers |

**BotW mapping (fox-flavored):**

- Chemistry → **ColorField restoration** as the element: restored grass grows climbable maple roots; restored waterwheel spins and lifts a platform; restored brazier makes an updraft for glide.
- Runes → **Burst / Pounce / Glide** as the three verbs that interact with those restored verbs.
- Shrines → Seedwells + the hill shrine as *puzzles that teach one interaction*, not mote vacuums.
- Sense of discovery → ghost-ink sketches that only appear in the ember wake (already designed; must be unmissable in play).

### 4.4 Process changes for sprint 2 (how we work)

1. **Human (Siyu / Vivek brief) owns design decisions;** Opus/Sol implement. No one-shot “make a Zelda game.”
2. **Feature → playtest video → Sol critique list → fix** every cycle (Sensei’s play-every-prompt, our sprint-1 Sol critiques).
3. **Grill-me** on the world redesign and on locomotion before coding.
4. **Expose tunables** for gait and restore radii; balance by playing, not re-prompting.
5. **Parallel streams OK**, but integration lead merges only after a capture that survives the kill tests in `game-design.md` pillars.
6. **Commit often** (Vivek t30u) so bad locomotion experiments can roll back in an hour, not a day.

### 4.5 Unreal-specific → three.js / later Unreal

| UE piece | Maps to three.js now? | Later Unreal? |
|----------|----------------------|---------------|
| MCP controlling the editor | Blender MCP + our Playwright harness (already) | Yes if we move |
| C++ gameplay classes | TypeScript modules in `games/fox-spirit` | N/A |
| Fab / ALS locomotion | **Gap.** Closest: Mixamo/quad packs + Blender, or write a small locomotion rig | **Strong argument to use Unreal for hero locomotion / cinematic quality** when Vivek’s “Unreal comes later” lands |
| Niagara | Custom three.js particles / GPU particles (we have ember wisps) | Nice-to-have |
| Landscape sculpt + foliage paint | Manual kit + instancing; no UE sculpt | Unreal wins for large realms |
| Details-panel settings actor | lil-gui + `window.__game` (already the design) | Keep the idea |
| Spline components | THREE.Curve / custom path helpers | Easy either engine |
| Electric Dreams fidelity | Not our art lock (painted autumn). Don’t chase Lumen | Optional for a realistic mode |

**Honest non-applications**

- First-person tower defense economy ≠ our quiet creature platformer — steal *structure* (volumes, settings, escalation, feel iteration), not turrets/cash.
- “Don’t generate locomotion, use Fab” is advice for UE; in three.js we must either build locomotion carefully or **import** high-quality clips. Pretending a single Blender prompt will yield Zelda-grade run cycles is exactly the failure he warns about.
- Marketplace megascans won’t match our sepia→autumn painted look.
- UE6 AI node-graph future is irrelevant to this sprint.

---

## 5. Top recommended changes for sprint 2 (ordered)

1. **Locomotion vertical slice first:** plant-footed run + turn lean + jump squash/land, captured on GPU, Sol-rejected until no skating.  
2. **Kill “orbs as gameplay”:** re-block Russetvale so each Seedwell permanently adds a traversal toy (root bridge, updraft, spinning lift); embers only gate cosmetics/thresholds.  
3. **Grill-me design duel:** Opus vs Sol BotW-style verb proposals → one locked one-pager in `docs/design/` before more scenery meshes.  
4. **Fox Zelda bar:** continue Blender pass against concept; land `fox3-final-wip` only with run clips that match the new locomotion.  
5. **Feel kit on every verb:** dash smear, Burst boom, Seedwell warm edge, land dust — flash/sound/pushback every time.  
6. **Debug + tunables:** foot IK targets and restore radii visible in playtest; balance in lil-gui.  
7. **Park Unreal migration talk** until three.js locomotion either passes the animal-weight bar or fails it twice — then pitch Unreal for the character controller / cinematics only.

---

## 6. Key frames inspected (under `ref/frames/`)

Philosophy & env: `00-05-30_…`, `00-07-45_…`  
Feel & debug: `00-55-15_…`, `00-56-40_…`, `00-59-58_…`  
Locomotion talk: `01-24-10_…`  
Alive enemy: `01-31-28_…`, `01-33-05_…`  
Grill-me: `01-47-40_…`  
Volumes / settings / spline / sculpted path: `01-39-20_…`, `01-42-55_…`, `02-01-45_…`, `02-02-55_…`, `02-05-10_…`  
Final loop: `02-09-40_…`, `02-19-50_…`, `02-20-40_…`
