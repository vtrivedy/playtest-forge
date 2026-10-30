# Autumn Fox — Game Design

> A Spyro-like creature platformer (original IP) in which a mysterious burnt-orange fox spirit crosses a sepia world. Its passing warms autumn back for a moment, and its real work restores autumn for good.
> **Feel > feature count.** Every number here is a tunable in lil-gui and is verified by playtest (`npm run playtest`, `window.__game`).

Companion docs: [`art-direction.md`](art-direction.md) (look), [`world-1.md`](world-1.md) (Lanternhollow + Russetvale layout), [`story.md`](story.md) (The Keeping).
**Terminology is shared with `world-1.md` and must not drift.** The glossary (§13) is canonical.

### Open questions (Vivek)

| # | Question | Proposal |
|---|----------|----------|
| G1 | Ember Burst, Pounce Slam and the JUMP + DASH chord are **deleted**: the dash is the brush (a 6 s strong color stroke). OK? | Yes. Honors "move + 2 actions" with no chord |
| G2 | Fall damage: drops over 6 m without gliding cost 1 wisp | Keep it. Glide always saves, which teaches the glide |
| G3 | No collectible economy at all in W1 (no embers, motes, seals, upgrade shards). Rewards are places, Lost Kits, pages, the gold wake | Yes. "Collecting little orbs is not cool" |
| G4 | Any one Seedwell opens a route up Wellspring Hill (no three-Seedwell gate) | Yes. The other two make the valley more alive and the hill easier |
| G5 | Restorations (latched Seedwells) are saved and can never be undone by enemies | Yes |

---

## 1. Pillars

| # | Pillar | Means | Kill test |
|---|--------|-------|-----------|
| 1 | **Powerful, graceful fox** | Run, jump, dash and glide feel fast, precise and animal. A combo chain (jump → air-dash → glide → updraft) is the core joy | If moving around an empty island isn't fun for 2 minutes, stop and tune |
| 2 | **Passing vs. caring** | The fox's color makes the world *breathe* (hearths burn, sails turn, water flows, roots grow) for seconds. A Seedwell, fed by an element, makes it breathe forever. The player feels the difference as routes | If a player can't explain why one hearth stays lit, the rules are unclear |
| 3 | **Quiet wonder** | Melancholic, beautiful, few words. Payoffs are vistas, not fanfares | No exclamation marks in text. No combo counters |
| 4 | **Systemic, not scripted** | Four elements obey one color rule; shrines are solved with those rules, and each element appears once outside a shrine first (`world-1.md` §1) | If a puzzle needs a trigger the rules don't explain, cut it. No orbs, no counters |

---

## 2. Core loop

```
 see a held-breath thing (cold hearth, still sails, glass waterfall, curled root)
   → touch it with color: run past (brief) or DASH through it (strong, 6 s)
   → it acts for seconds: updraft · wind current · flowing water · growing root
   → use that to move: glide up, ride the wind, cross, ascend
   → feed a Seedwell from an element for 2 s → it latches: that zone breathes forever
   → a permanent route + a moving landmark; a Shade drifts in at the new color's edge
   → any one Seedwell opens Wellspring Hill → the summit hearth feeds the Wellspring → FLOOD
```

Full rules: [`world-1.md`](world-1.md) §0–§1. Session targets for W1 realm: ≈ 10 min first time on the critical path, ≈ 20 min full clear.

---

## 3. Controls and movement

### 3.1 Controls

| Input | KB / mouse | Gamepad | Ground | Air |
|-------|-----------|---------|--------|-----|
| Move | WASD (camera-relative) | Left stick | Run (analog: walk → stalk → run) | Air control |
| Camera | Mouse | Right stick | Orbit | Orbit |
| **JUMP** | Space | A / ✕ | Jump. Releasing early gives a short hop | **Hold while falling = Glide** |
| **DASH** | Shift / LMB | X / □ | Ground dash. **The brush:** lays a 6 s strong color stroke | Air-dash (1 per airtime), same stroke |
| Pause / Album | Esc / Tab | Start | | |

Two action buttons, no chord. There is no attack button: the dash frees Shades and paints color.

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
| **Ember updraft** (lit hearth) | **≥ 7 m rise** within 1.6 s | Ø4.4 m column, 9 m tall; glide vy eases toward a 6.5 m/s rise (`world-1.md` §5) |
| Safe drop | ≤ 6 m with no glide | > 6 m = −1 wisp (§8) |
| Wall / ledge | Auto ledge-grab-up ≤ 0.6 m above feet | No wall jump in W1 |

**Combo grammar (most expressive chain):** jump → air-dash at apex → glide → updraft / wind current → air-dash is **not** refreshed by updrafts (one per airtime). That keeps distances designable.

### 3.3 Actions

| Action | Effect | Teaches |
|--------|--------|---------|
| **Ember wake** (passive) | Aura 2.6 m + trail ≈ 2.5 s. Wakes elements briefly (they hold 3 s after color leaves) | Meadow 0:00–0:40 |
| **Dash stroke** | Every dash stamps a 4 m stroke of strength 1.5 that lasts 6 s. Beats a Shade's drain. Reactors struck by it flare | Meadow hearth H0 (`world-1.md` §3.3) |

### 3.4 Resources

| Resource | Max | Gain | Shown as |
|----------|-----|------|----------|
| **Wisps** (health) | 3 | Full at checkpoints and on each Seedwell latch. A freed Shade drops a falling leaf that heals +1 (35 %) | The 3 tongues of tail flame. At 1 wisp the tail gutters to smoke |

There is no fuel, no currency and no score. Spark and embers are deleted.

---

## 4. Temporary vs. restored color

Canonical rules live in [`world-1.md`](world-1.md) §1. Summary:

| | **Aura + trail** | **Dash stroke** | **Restored** (Seedwell / flood) |
|-|------------------|-----------------|--------------------------------|
| Strength / lasts | ≤ 1 / trail ≈ 2.5 s | 1.5 / 6 s | 1 / forever (saved) |
| Wakes elements | Yes; they hold 3 s, then gutter 0.8 s | Yes, with a flare | Yes; they never gutter |
| Survives a Shade | No | Yes | Yes |
| Latches a Seedwell | **Never** (Seedwells latch only from an element's output for 2 s) | Never | — |

**Readability rules**
1. Every element shows its own timer on its body (embers thin, sails slow, water frosts, root leaves brown). No HUD timers.
2. Every latch shows a **landmark consequence**: the mills turn (SW1), the marsh washes clear (SW2), the root bridge grows (SW3), the valley floods (Wellspring).
3. Temporary supports warn ≥ 0.8 s before they go and never vanish under planted paws.

---

## 5. Progression and hue order

The year turns as the game progresses: **Ember → Frost → Pine → Night.** Restoring a season lets it *pass* (see `story.md` §3).

| World | Hue (realm) | Realm (working) | Ability gained at flood | Ability's backtrack use | Hub portal seal |
|-------|-------------|-----------------|-------------------------|------------------------|-----------------|
| **W1** | **Ember**: rust, crimson, gold | **Russetvale** | None yet. W1's elements (heat, wind, water, growth) work everywhere after the flood. Next-world ability TBD | — | Opens after the hub tutorial |
| W2 | Frost: frost-blue, slate, rime | TBD | Rime Step: glide over cold air vents leaves a short frost bridge (proposal) | W1 marsh sunken ruin depths | Frost glyph (52, −30) |
| W3 | Pine: deep pine, lichen gold | TBD | Rootcall: root knots grow climb walls anywhere (proposal) | W1 Amberwood under-roots | Pine glyph (50, 22) |
| W4 | Night: violet, indigo, starlight | TBD | Starward: glide stars refresh air-dash (proposal) | Hub cloud-sea islets | Night glyph (−52, −30) |

**Hub progression:** each Wellspring restored warms one leaf of the Great Well's stone maple crest **and** one quarter of Lanternhollow. Portal *N+1* opens when Wellspring *N* is restored.

---

## 6. Rewards (no collectibles)

Ember motes, leaf motes, ash motes, maple seals and the ember counter are **deleted**. Exploration pays in:

| Reward | What | W1 count |
|--------|------|----------|
| **Places** | Islets, vistas, the sunset seat, the inside of the hollow maple | — |
| **Lost Kit** | Sleeping ember kit; follows to the hub leaf-drift | 3 |
| **Pressed page** | Torn Album page; Hollin reads it at the library | 2 |
| **Old fox shrine** | Gold wake tint (cosmetic) | 1 |

Secrets are found by knowledge of the rules, sound, silhouettes and moving leaves, never by glints or pickup trails (`world-1.md` §3.8).

---

## 7. Encounters: Shades

Shades are animals and things caught mid-motion by The Keeping, hollowed into wavering ink (`story.md` §3). They read as **sad, not evil**. Freeing one: it falls apart into leaves that colorize as they fall.

| Enemy | Behavior | Threat | Counter |
|-------|----------|--------|---------|
| **Shade** | Drifts on an authored spline (2.2 m/s). **3 m drain**: temporary color → 0, unrestored elements in it gutter | Contact −1 wisp, 1.0 s invulnerability, 3 m knockback. Snuffs the element you need | Dash through it (frees it, no respawn), or time your use of the element between passes |
| *Blight* (later) | Ink roots creep from a blight heart at a restored edge | Re-sepias unrestored ground | Break the heart with an element (burn, flood, root) |
| *Ash Warden* (later) | Guards the summit hearth | Pounce, ink pools | Use each restored element in the arena, then dash it while colored |

---

## 8. Fail states and respawn

There are no lives and no game-over screen. Failing costs time, never restoration.

| Failure | Result | Respawn point | Transition |
|---------|--------|---------------|------------|
| Hit by an ash creature or blot | −1 wisp, invulnerable 1.0 s | — | Smoke flicker |
| Hard landing (> 6 m drop with no glide) | −1 wisp | In place | Heavy landing, 0.3 s recover |
| **Fall off the island edge into the cloud sea** | −1 wisp | **Last safe ground** (sampled every 0.5 s while grounded on stable, non-temporary ground ≥ 2 m from an edge) | 0.8 s fade to paper, fox reforms from embers |
| Sink in an ink pool | −1 wisp | Last safe ground | 0.6 s ink swallow, then fade |
| Temporary support (root, lily pad) ends | Never while occupied. Falls to recovery ground ≤ 6 m below | — | ≥ 0.8 s warning first |
| **0 wisps: "the ember gutters"** | Restorations kept. Wisps refilled to 3 | **Last lit checkpoint lantern** or lit Seedwell | 1.5 s: tail goes to smoke, paper page turns, fox rises from a leaf-drift |
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
| Collision | 0.25 m spherecast. Foliage cards and updraft columns ignored, fading at < 1 m | |
| Framing aid | During the glide-line approach, camera yaw biases 15° toward the authored glide target | `world-1.md` landmarks |
| Cinematics | Seedwell latch 2 s beat framing the permanent route, flood 6.5 s rail (skippable after first view) | Input returns at exactly the moment the camera does |

---

## 10. Accessibility

| Area | Feature |
|------|---------|
| **Color** | The game is about color, so every color state has a **value + motion** twin: lit elements *move* (embers rise, sails turn, water runs, roots grow), cold ones are frozen. Restored regions carry hue patterns (W1 leaf veins). Shades are distinguished by silhouette and value, never by hue alone |
| Colorblind | Simulated protan/deutan/tritan screenshots in every visual review. Wake vs. restore differ in **saturation and value**, not hue |
| Motion | Reduce-motion option: no camera FOV punch, a gentler flood camera, hit-stop capped at 30 ms, and particle density at 50 % |
| Flicker | No strobing. Ember flicker is under 3 Hz, and a "steady fire" option disables it |
| Input | Full remap. **Toggle glide** (tap jump in air to glide, tap again to drop) |
| Difficulty | "Gentle ember": no fall damage, invulnerability 2 s, element hold time 2× |
| HUD | Optional minimal HUD (wisps, element timers) for players who can't read the diegetic tail and element bodies |
| Text / audio | Subtitles on by default with speaker name, 3 sizes, a background plate. Every audio cue has a visual twin (hearth ignite = flare) |
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
| Updraft rise (gliding, from column entry) | ≥ 7.0 m in ≤ 1.6 s | — | — | Measure (`__game.chem.lastRide`) |
| Hearth hold after color leaves | 3.0 s | ±0.1 | — | Measure |
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
  zone: 'meadow' | 'windmill' | 'reedmarsh' | 'amberwood' | 'wellspring',
  wisps: number,
  seedwells: { id: 'SW1'|'SW2'|'SW3', lit: boolean, seal: number /* 0..1 latch fill */ }[],
  restored: boolean,            // Ember Wellspring flood complete
  chem: { reactors: { id, kind, heat, restored }[], updraft: Tunables, lastRide: { entryY, peakY, riseTime } },
  fox: { pos: [x, y, z], state: 'idle'|'run'|'jump'|'dash'|'glide' },
  metrics: { apex, riseTime, airTime, jumpDist, glideRatio, dashDist, fps },
};
```

Required playtest captures: sepia start · wake trail fading · hearth lit by wake vs. by dash · glide ride up an updraft (video) · each Seedwell latch · flood (video) · portal-arrival before and after vista.

---

## 13. Glossary (canonical)

| Term | Meaning |
|------|---------|
| **Ember wake** | Passive aura + trail. Temporary color |
| **Dash stroke** | The 6 s strong color stroke every dash lays. "The brush" |
| **Reactor / element** | An object that acts while colored: hearth (heat), windmill (wind), glass waterfall (water), root knot / lily pad (growth) |
| **Updraft** | A lit hearth's ember column; lifts a gliding fox |
| **Wind current / wind river** | A spline volume that pushes a glider; the wind river is SW1's permanent one |
| **Latch** | A Seedwell lighting after 2 s of continuous element feed |
| **Restored** | Inside a latched Seedwell's radius or after the flood; never switches off |
| **Wisps** | Health (3) |
| **Seedwell** | Local permanent restore point (3 per realm), fed by an element |
| **Ember Wellspring** | Realm restore point, fed by the summit hearth. Triggers the flood |
| **Shade** | Ink silhouette that drains temporary color; freed by a dash |
| **Lanternhollow** | Hub village |
| **Russetvale** | W1 realm: Arrival Meadow, Windmill Rise, Reedmarsh, Amberwood, Wellspring Hill |
| **Ember / Frost / Pine / Night** | World hues, in order |
