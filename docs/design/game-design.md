# Autumn Fox — Game Design

> A Spyro-like creature platformer (original IP) in which a mysterious burnt-orange fox spirit crosses a sepia world. Its passing warms autumn back for a moment, and its real work restores autumn for good.
> **Feel > feature count.** Every number here is a tunable in lil-gui and is verified by playtest (`npm run playtest`, `window.__game`).

Companion docs: [`art-direction.md`](art-direction.md) (look), [`world-1.md`](world-1.md) (Lanternhollow + Russetvale layout), [`story.md`](story.md) (The Keeping).
**Terminology is shared with `world-1.md` and must not drift.** The glossary (§13) is canonical.

### Open questions (Vivek)

| # | Question | Proposal |
|---|----------|----------|
| G1 | Ember Burst and Pounce Slam share the **JUMP + DASH chord** (ground vs air). Is that OK, or should they get a dedicated third button? | Keep the chord. It honors "move + 2 actions" |
| G2 | Fall damage: drops over 6 m without gliding cost 1 wisp (`world-1.md` §2.9) | Keep it. Glide always saves, which teaches the glide |
| G3 | Embers are a **threshold**, never spent (Spyro-style). OK? | Yes. Nothing is ever taken from the player |
| G4 | Restored ground does **not** refill Spark, so Burst is fed by sepia ground and ash creatures | Keep it. Restoring makes the world gentler and the fox slightly less powerful, a quiet trade |
| G5 | Lit hearth sockets (Kindle) stay lit permanently | Yes. Saved |

---

## 1. Pillars

| # | Pillar | Means | Kill test |
|---|--------|-------|-----------|
| 1 | **Powerful, graceful fox** | Run, jump, dash and glide feel fast, precise and animal. A combo chain (jump → air-dash → glide → updraft) is the core joy | If moving around an empty island isn't fun for 2 minutes, stop and tune |
| 2 | **Passing vs. caring** | The *ember wake* is temporary color, gone in seconds. *Seedwells* restore color permanently. The player feels the difference | If players can't explain why one place stays colored, the rules are unclear |
| 3 | **Quiet wonder** | Melancholic, beautiful, few words. Payoffs are vistas, not fanfares | No exclamation marks in text. No combo counters |
| 4 | **Spyro-like structure** | Hub → realms, collectibles leading off the path, secrets, a guardian, backtracking with new abilities | Every realm has ≥ 55 % of embers near the critical path and ≥ 7 secrets |

---

## 2. Core loop

```
 ┌─ explore sepia realm ─▶ ember wake reveals ghost-ink paths, ash motes, sleeping NPCs
 │        │
 │        ▼
 │   collect embers / leaf motes / maple seals  ── thresholds ─▶ Pockets' doors, cosmetics
 │        │
 │        ▼
 │   light 3 Seedwells (permanent local autumn + checkpoint + root-bridge shortcut)
 │        │
 │        ▼
 │   Ash Warden ─▶ Ember Wellspring FLOOD (whole realm restored, new hue, new ability)
 │        │
 └── return to Lanternhollow ─▶ the hub warms one season ─▶ next portal + backtrack secrets
```

Session targets for W1: hub 3 min + realm 9 min on the critical path (≈ 12 min). Full clear ≈ 20 min.

---

## 3. Controls and movement

### 3.1 Controls

| Input | KB / mouse | Gamepad | Ground | Air |
|-------|-----------|---------|--------|-----|
| Move | WASD (camera-relative) | Left stick | Run (analog: walk → stalk → run) | Air control |
| Camera | Mouse | Right stick | Orbit | Orbit |
| **JUMP** | Space | A / ✕ | Jump. Releasing early gives a short hop | **Hold while falling = Glide** |
| **DASH** | Shift / LMB | X / □ | Ground dash | Air-dash (1 per airtime) |
| JUMP + DASH (within 80 ms) | Space + Shift | A + X | **Ember Burst** (costs 40 Spark) | **Pounce Slam** |
| Pause / Album | Esc / Tab | Start | | |

That is two action buttons plus one chord. There is no attack button: the dash *is* the attack.

### 3.2 Movement limits (design-space numbers; `world-1.md` builds to these)

| Move | Value | Derivation (tunable defaults) |
|------|-------|-------------------------------|
| Run speed | **7.8 m/s** (walk < 30 % stick 2.0 m/s, stalk 30–60 % 4.0 m/s) | accel 60 m/s², decel 45 m/s², turn 720°/s |
| **Full jump** | **1.8 m rise, 6 m horizontal** | v₀ 8.6 m/s, rise gravity 20.4 m/s² (rise 0.42 s), fall gravity ×1.4 (fall 0.36 s), air ≈ 0.78 s |
| Short hop (tap) | 0.8 m rise, ≈ 3.5 m | jump-cut: vy × 0.45 on release before apex (one-shot, only after 60 ms) |
| Coyote / buffer | 0.10 s / 0.12 s | |
| **Ground dash** | 4.0 m in 0.25 s | 16 m/s, cooldown 0.45 s. Breaks ash creatures |
| **Air-dash** | +4.0 m horizontal, no height loss | 18 m/s for 0.22 s, gravity off during dash, 1 per airtime |
| **Jump + air-dash** | **10 m** horizontal, 1.8 m rise | 6 m + 4 m |
| **Glide** | **3 : 1** (horizontal : drop) | forward 7.5 m/s, sink 2.5 m/s, turn 120°/s. Starts 0.1 s after hold while vy < 0 |
| Glide from y 30 → y 20 | 30 m | `world-1.md` B: mill-3 apex → SW1 (29 m) |
| **Ember updraft** (Kindle) | **+6 m rise** above entry height | 6 m/s for 1.0 s while gliding in a Ø3 m column, then glide resumes |
| Crown pad (Amberwood) | 1.3× jump = 2.34 m rise | soft-bounce leaf mat |
| Pounce Slam | straight down at 22 m/s | 0.12 s hang at start, 3 m impact ring, 80 ms hit-stop |
| Safe drop | ≤ 6 m with no glide | > 6 m = −1 wisp (§8) |
| Wall / ledge | Auto ledge-grab-up ≤ 0.6 m above feet | No wall jump in W1 |

**Combo grammar (most expressive chain):** jump → air-dash at apex → glide → updraft → air-dash is **not** refreshed by updrafts (one per airtime). That keeps distances designable.

### 3.3 Actions

| Action | Effect | Cost | Teaches |
|--------|--------|------|---------|
| **Ember wake** (passive) | Aura 3.0 m + trail (§4) | — | Hub 0:00–0:40 |
| **Ember Burst** | 6 m ring of full color held **6 s**. Solidifies ghost-ink, wakes ash motes and sepia NPCs, cracks seals, strips **inked** enemies (§7) | 40 Spark | Hub gate (1:30–2:30) |
| **Pounce Slam** | Plunge + 3 m color ring (2 s). 1 damage to colored enemies. Breaks sealed caps (hub well H1, post-W1) | free | Russetvale meadow Ashlings, then the Warden |
| **Kindle** (earned at W1 flood) | Burst on a **hearth socket** lights a permanent ember updraft | **Free** on a socket (the socket supplies the fire) | Wellspring spiral preview; S7 backtrack |

### 3.4 Resources

| Resource | Max | Gain | Shown as |
|----------|-----|------|----------|
| **Wisps** (health) | 3 | Falling-leaf heal from defeated ash creatures (+1, 35 % drop), full at lantern checkpoints and lit Seedwells | The 3 tongues of tail flame. At 1 wisp the tail gutters to smoke |
| **Spark** (Burst fuel) | 100 | **+1 per meter** run or glided over **unrestored** ground. +20 per ash creature defeated. Restored ground gives 0. Passing a lit lantern or Seedwell tops up to 40 | Brightness of the tail's ember core plus a soft pulse at ≥ 40 |
| **Embers** (score) | — | Collectibles (§6) | Ensō counter (fades in after a pickup) |

Spark starts at 0. The hub cobbles before the gate give > 40 m of sepia, so the first Burst is guaranteed. The Warden arena keeps a 40 m unrestored loop, so a Burst is always one lap away.

---

## 4. Trail vs. restore (the color rules)

| | **Temporary: ember wake** | **Temporary: Burst / Slam** | **Permanent: Seedwell** | **Permanent: Ember Wellspring** |
|-|---------------------------|-----------------------------|-------------------------|--------------------------------|
| Source | Fox aura + trail stains | Chord action | Lit Seedwell | Flood after the Warden |
| Radius | Aura **3.0 m**. Stain 0.5 → 1.6 m, sampled every 0.4 m, 64-sample ring | **6 m** / 3 m | **30–40 m** (`world-1.md` §2.4) | Whole realm (front 40 m/s, ≈ 4 s) |
| Duration | Stain decays **3.5 s**, edges first | **6 s** / 2 s | Forever (saved) | Forever (saved) |
| Ghost-ink solid? | Yes, while mask > 0.5 at the platform center. Flashes at < 0.6 s left | Yes, for 6 s | Ghost-ink becomes real geometry | Same |
| Ash motes / NPCs | Wake while colored | Wake | Wake permanently | All wake |
| Spark refill | Ground still counts as unrestored | — | **No** | **No** |
| Ash creatures | Colored = vulnerable (§7) | Strips ink shrouds | Zone enemies crumble (SW2: Blotters) | Remaining ash creatures crumble. Post-flood, lanterns top Spark up to 40, so Burst stays usable |

**Readability rules**
1. Anything that matters to traversal **only while colored** is ghost-ink: a sketched outline, never invisible.
2. Permanent restoration always shows a **landmark consequence**: windmills turn (SW1), the marsh dries (SW2), branch bridges grow (SW3), and a color river runs toward the Wellspring.
3. At 3.5 s trail decay and 7.8 m/s, the trail behind a running fox is ≈ 27 m long. Ghost-ink stepping stones are therefore 4–6 m apart, so a moving fox always has the next stone colored.
4. Stopping is a choice. The trail decays under an idle fox in 3.5 s, but the 3 m aura keeps the stone it stands on solid.

---

## 5. Progression and hue order

The year turns as the game progresses: **Ember → Frost → Pine → Night.** Restoring a season lets it *pass* (see `story.md` §3).

| World | Hue (realm) | Realm (working) | Ability gained at flood | Ability's backtrack use | Hub portal seal |
|-------|-------------|-----------------|-------------------------|------------------------|-----------------|
| **W1** | **Ember**: rust, crimson, gold | **Russetvale** | **Kindle**: Burst lights hearth sockets → ember updrafts (+6 m) | Hub belltower ledge, Russetvale S7 | Opens after the hub tutorial |
| W2 | Frost: frost-blue, slate, rime | TBD | Rime Step: glide over cold air vents leaves a short frost bridge (proposal) | W1 marsh sunken ruin depths | Frost glyph (52, −30) |
| W3 | Pine: deep pine, lichen gold | TBD | Rootcall: slam on root knots grows a climb root (proposal) | W1 Amberwood under-roots | Pine glyph (50, 22) |
| W4 | Night: violet, indigo, starlight | TBD | Starward: glide stars refresh air-dash (proposal) | Hub cloud-sea islets | Night glyph (−52, −30) |

**Hub progression:** each Wellspring restored warms one leaf of the Great Well's stone maple crest **and** one quarter of Lanternhollow. Portal *N+1* opens when Wellspring *N* is restored. Ember totals never gate the main path.

| Ember threshold (cumulative) | Unlock |
|------------------------------|--------|
| 150 held | Pockets' low door (Russetvale S4, Lost Kit #3) |
| 300 | After W1, Pockets moves to the hub cart. He sells nothing and gives the **russet wake tint** (cosmetic) |
| 500 (W1 100 %) | Album page "Russetvale, kept" (art page) |

---

## 6. Collectibles

There are no gems and no pigment: everything is ember, leaf or maple.

| Item | Value | Look (see `art-direction.md` §8) | Behavior | W1 count |
|------|-------|----------------------------------|----------|----------|
| **Ember mote** | 1 | Floating coal of light, 0.08 m bob | Magnet radius 1.5 m. Breadcrumbs guide routes | Hub 55 + realm 165 |
| **Leaf mote** | 5 | Glowing maple leaf, turning | Magnet 2 m. Marks tops, ends of routes, chimney caps | Hub 4 + realm 18 |
| **Maple seal** | 25 | Bronze leaf-relief disc | No magnet. Must be touched. Always in a secret or at a hard route's end | Hub 1 + realm 4 |
| **Ash mote** | 5 | Dull gray cracked cinder | **Inert until colored** (aura or Burst). Then it wakes into a leaf mote and drifts 1 m toward the fox | Realm 9 |
| **Lost Kit** | — | Sleeping ember kit | Story collectible. Follows to the hub leaf-drift | 3 (H2, S2, S4) |
| **Pressed page** | — | Torn Album page | Lore. Hollin reads it at the library | 2 (H1 post-W1, S3) |

**W1 totals:** hub **100** + Russetvale **400** = **500 embers** (arithmetic in `world-1.md` §1.4 and §2.6). 100 % W1 = 500 embers + 3 Lost Kits + 2 pressed pages + S7 old fox shrine.

Pickup feel: 0.05 s pull-in, soft chime pitched up a semitone per mote in a chain (resets after 1.5 s), and tail core flicker. No screen pop-ups.

---

## 7. Enemies: ash creatures

Ash creatures are animals and things caught mid-motion by The Keeping, hollowed into ash and dried ink (`story.md` §3). They read as **sad, not evil**. Defeating one *frees* it: it crumbles, a leaf falls, and sometimes that leaf heals.

**Core rule: an ash creature can be hurt only while it is colored** (mask > 0.5 at its center). The aura usually handles this for small ones. **Inked** enemies carry a 1.5 m shroud that forces the mask to 0 until it is broken by an Ember Burst.

| Enemy | HP | Behavior | Threat | Counter | Zones |
|-------|----|----------|--------|---------|-------|
| **Ashling** | 1 | Small ash fox-cub or hare shape. Wanders 6 m, lunges 3 m when the fox is within 5 m (0.5 s telegraph) | Contact −1 wisp | Dash or slam. The aura colors it on approach | Meadow, terraces, marsh, Amberwood floor |
| **Dust Moth** | 1 | Flies a sine path (amplitude 2 m, period 3 s) along glide lines | Knocks the fox out of glide (no damage, cancels glide 0.4 s) | Air-dash through it | Windmill glide line, Amberwood trunks |
| **Blotter** | 2 | Squat ink toad in ink pools. Spits a blot every 3.5 s, range 10 m | Blot = −1 wisp and paints a 2 m ink stain that **erases trail color** for 4 s | Approach between spits, dash ×2 | Reedmarsh |
| **Quill Knight** | 3 | **Inked.** Stalks with a quill lance, thrust 4 m (0.6 s telegraph), armored front | −1 wisp | Burst to strip the shroud (6 s), then dash its back or slam | Reedmarsh SW2 guard |
| **Ash Warden** (guardian) | 3 slams | 6 m hound of ash and ink. Phases in `world-1.md` §2.8 | Pounce −1 wisp, ink pools −1 | Burst after its landing (colored 4 s) → Pounce Slam | Wellspring Hill arena |

Contact damage: −1 wisp, 1.0 s invulnerability (the fox flickers to smoke), 3 m knockback. Ash creatures never chase beyond 12 m of their home.

---

## 8. Fail states and respawn

There are no lives and no game-over screen. Failing costs time, never collectibles.

| Failure | Result | Respawn point | Transition |
|---------|--------|---------------|------------|
| Hit by an ash creature or blot | −1 wisp, invulnerable 1.0 s | — | Smoke flicker |
| Hard landing (> 6 m drop with no glide) | −1 wisp | In place | Heavy landing, 0.3 s recover |
| **Fall off the island edge into the cloud sea** | −1 wisp | **Last safe ground** (sampled every 0.5 s while grounded on stable, non-ghost-ink ground ≥ 2 m from an edge) | 0.8 s fade to paper, fox reforms from embers |
| Sink in an ink pool | −1 wisp | Last safe ground | 0.6 s ink swallow, then fade |
| Ghost-ink fades underfoot | Falls (then falls into the cases above) | — | 0.6 s warning flash beforehand |
| **0 wisps: "the ember gutters"** | All collected items kept. Spark set to 40. Wisps refilled to 3 | **Last lit checkpoint lantern** or lit Seedwell | 1.5 s: tail goes to smoke, paper page turns, fox rises from a leaf-drift |
| Warden fight lost | As above. Warden resets to its current phase start (no full reset after phase 1) | Lantern at (0, −44) | — |

---

## 9. Camera

Third-person, Spyro-follow with modern smoothing. Every value is a lil-gui tunable.

| Parameter | Default | Notes |
|-----------|---------|-------|
| Distance / height | 5.5 m / 1.6 m above the fox root | Glide: 7.0 m |
| Pitch | 15° down (range −10° to 60°) | |
| FOV | 60° | Run +4°, dash +6° punch (0.15 s), glide 72° |
| Follow lag | Position 0.12 s, yaw 0.25 s | Critically damped spring |
| Look-ahead | 1.2 m along velocity | |
| Vertical tracking | Locks to the last ground height, follows y on landing. Tracks immediately when > 2 m below the lock or while gliding | Avoids jump-bob |
| Auto-recenter | After 1.2 s without camera input, at 90°/s behind the fox's heading | Off during manual orbit |
| Collision | 0.25 m spherecast. Foliage cards and ghost-ink ignored, fading at < 1 m | |
| Framing aid | During the glide-line approach, camera yaw biases 15° toward the authored glide target | `world-1.md` landmarks |
| Cinematics | Seedwell 2.5 s orbit, flood 6 s rail (skippable after first view) | Input returns at exactly the moment the camera does |

---

## 10. Accessibility

| Area | Feature |
|------|---------|
| **Color** | The game is about color, so every color state has a **value + pattern** twin: restored regions carry hue patterns (W1 leaf veins, Frost crystals, Pine needles, Night stars). Ghost-ink solidity also shows as a solid outline. Ash creatures are distinguished by silhouette and value, never by hue alone |
| Colorblind | Simulated protan/deutan/tritan screenshots in every visual review. Wake vs. restore differ in **saturation and value**, not hue |
| Motion | Reduce-motion option: no camera FOV punch, a gentler flood camera, hit-stop capped at 30 ms, and particle density at 50 % |
| Flicker | No strobing. Ember flicker is under 3 Hz, and a "steady fire" option disables it |
| Input | Full remap. **Toggle glide** (tap jump in air to glide, tap again to drop). The chord window is adjustable 50–150 ms, or the chord can be bound to a separate button |
| Difficulty | "Gentle ember": no fall damage, invulnerability 2 s, ghost-ink lasts 2×, Spark never below 40. Collectibles are unaffected |
| HUD | Optional minimal HUD (wisps, Spark, ember count) for players who can't read the diegetic tail |
| Text / audio | Subtitles on by default with speaker name, 3 sizes, a background plate. Every audio cue has a visual twin (the Burst-ready pulse) |
| Camera | Sensitivity, invert X/Y, auto-recenter on/off |

---

## 11. Feel metrics (playtest targets)

These are recorded by `tools/playtest.ts` feel-probe into `playtest-output/*/metrics.json` and exposed on `window.__game.metrics`.

| Metric | Target | Tolerance | Last measured (fox-spirit PRESET_SPRING) | Action |
|--------|--------|-----------|------------------------------------------|--------|
| Full-hold apex (rise) | **1.80 m** | ±0.10 | 2.00 u | Retune v₀ to 8.6 m/s, scale 1 u = 1 m |
| Time to apex | 0.42 s | ±0.04 | 0.38 s | Lower rise gravity |
| Full-jump airtime | 0.78 s | ±0.06 | 0.77 s | OK |
| Full-jump horizontal | 6.0 m | ±0.3 | — | Measure |
| Short-hop apex | 0.80 m | ±0.10 | "clearly shorter" | Measure |
| Jump + air-dash distance | 10.0 m | ±0.5 | — | Measure |
| Glide ratio | 3.0 : 1 | ±0.2 | — | Measure |
| Updraft rise | 6.0 m | ±0.3 | — | Measure (W1 post-flood) |
| Run top speed / time to top | 7.8 m/s / 0.13 s | ±0.3 / ±0.03 | — | Measure |
| Dash distance | 4.0 m | ±0.2 | — | Measure |
| Input → takeoff latency | ≤ 1 frame (16.7 ms) | — | — | Measure |
| Frame rate (laptop GPU, 720p) | 60 fps, 1 % low ≥ 50 | — | SwiftShader only | Real-GPU run needed |

**Variation rule:** each mechanic keeps **3 presets** in lil-gui (`spring` default / `brisk` / `float`). Record metrics for all three before Vivek picks one. Change one variable at a time.

---

## 12. Verification contract

Nothing is "done" without screenshots + `window.__game`.

```ts
window.__game = {
  zone: 'hub' | 'meadow' | 'windmill' | 'reedmarsh' | 'amberwood' | 'wellspring',
  embers: number,               // was `gems`; rename when code is touched
  spark: number, wisps: number,
  seedwells: { id: 'SW1'|'SW2'|'SW3', lit: boolean }[],
  restored: boolean,            // Ember Wellspring flood complete
  abilities: { kindle: boolean },
  fox: { pos: [x, y, z], state: 'idle'|'run'|'jump'|'dash'|'glide'|'slam'|'burst' },
  metrics: { apex, riseTime, airTime, jumpDist, glideRatio, dashDist, fps },
};
```

Required playtest captures: sepia start · wake trail fading · Burst on ghost-ink · each Seedwell · flood (video) · Portal-arrival before and after vista.

---

## 13. Glossary (canonical)

| Term | Meaning |
|------|---------|
| **Ember wake** | Passive aura + trail. Temporary color |
| **Ember Burst** | Ground JUMP + DASH. 6 m, 6 s, 40 Spark |
| **Pounce Slam** | Air JUMP + DASH. Plunge + 3 m ring |
| **Kindle** | W1 ability. Burst lights hearth sockets → ember updrafts |
| **Spark** | Burst fuel (0–100) |
| **Wisps** | Health (3) |
| **Embers** | Score total from motes and seals |
| **Ember / leaf / ash mote, maple seal** | Collectibles worth 1 / 5 / 5 / 25 |
| **Seedwell** | Local permanent restore point (3 per realm) |
| **Ember Wellspring** | Realm restore point. Triggers the flood |
| **Ghost-ink** | Sketched object, solid only while colored |
| **Ash creatures** | Enemies: Ashling, Dust Moth, Blotter, Quill Knight, Ash Warden |
| **Lanternhollow** | Hub village |
| **Russetvale** | W1 realm: Arrival Meadow, Windmill Rise, Reedmarsh, Amberwood, Wellspring Hill |
| **Ember / Frost / Pine / Night** | World hues, in order |
