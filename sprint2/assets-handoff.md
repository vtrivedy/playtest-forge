# Assets stream handoff — fox base pick (sprint 2)

**For:** fox, loco, loco-sol streams. Read before next restart.
**Previews:** `/workspace/siyu/playtest-forge-artifacts/sprint2/assets/previews/`
**Library:** `assets/library/` (CREDITS.md there)

## Recommended base: Quaternius Fox (CC0)

| | |
|--|--|
| **File** | `assets/library/fox/quaternius_fox.glb` (= `assets/hero/source/fox_quaternius_raw.glb`) |
| **License** | CC0 1.0 — https://quaternius.com/packs/ultimateanimatedanimals.html |
| **Why** | Only CC0 candidate with a full game gait set + a bone layout that already matches sprint-1 `spirit_fox.glb` / loco code. Khronos is lower quality + CC-BY. BlenderKit free foxes are cute/chibi (art-lock fail). |
| **Honest quality bar** | Low-poly / flat-shaded — **not** Zelda-tier as shipped. Use it as the **rig + clip scaffold**; restyle mesh/materials/FX to the ember spirit (concept: `artifacts/concept/fox-turnaround.jpg`). Do **not** hand-model a new quadruped from scratch (@sorenxet rule). |

### Rig — `AnimalArmature` (51 bones)
Roles for RIG-CONTRACT / retarget:

- **Spine:** `Body` → `Back` → `Torso` → `Torso2` → `Torso3`
- **Neck/Head:** `Neck1` → `Neck2` → `Neck3` → `Head`
- **Ears:** `Ear1..4.L/R`
- **Front legs:** `FrontShoulder.*` → `FrontUpperLeg.*` → `FrontLowerLeg.*` (+ IK `IKFrontLeg.*`, pole `PoleTarget.*`, foot `FF.*`)
- **Back legs:** `BackShoulder.*` → `BackLeg.*` → `BackUpperLeg.*` → `BackLowerLeg.*` (+ IK `IKBackLeg.*`, pole `PoleTargetBack.*`, foot `FFB.*`)
- **Tail:** `Tail1` … `Tail8` (8 bones — good for ember plume)

### Animation clips (Action names as in GLB)
| Clip | Name | Use |
|------|------|-----|
| Walk | `Walk_AnimalArmature` | Locomotion walk |
| Gallop | `Gallop_AnimalArmature` | Run |
| Gallop jump | `Gallop_Jump_AnimalArmature` | Jump while moving |
| Jump → idle | `Jump_ToIdle_AnimalArmature` | Land |
| Idle | `Idle_AnimalArmature`, `Idle_2_*`, `Idle_2_HeadLow_*` | Stand / look |
| Hit | `Idle_HitReact1/2_AnimalArmature` | Damage |
| Attack / Eat / Death | `Attack_*`, `Eating_*`, `Death_*` | Optional |

**Missing for loco-sol ideal set:** explicit **Trot**, **Turn-in-place**, **Skid**. Author those on this armature (or procedural IK) — don't switch bases just for that.

### Preview evidence (480p)
- Turntable: `quaternius_turn_{000,090,180,270}.png`
- Walk / run frames: `quaternius_walk_*.png`, `quaternius_run_*.png`
- vs concept: `quaternius_vs_concept.png`
- Rejects: `khronos_vs_concept.png`, `bk_sunset_vs_concept.png` (chibi)

### How to restyle into the ember spirit (fox stream)
1. Keep `AnimalArmature` bone names/roles — loco streams already bind to them.
2. Sculpt / remesh body toward concept silhouette (longer legs, deeper chest, bushier cheek fur) **or** start from sprint-1 `assets/hero/spirit_fox.glb` (same bone family) and continue that restyle.
3. Materials: deeper burnt orange (not yellow), dark socks, cream muzzle/chest, amber emissive eyes, painterly fur (stylized, not photoreal).
4. Tail: `Tail1–8` → translucent flame plume + ember particle sockets at tip bones.
5. Embers: emit from spine/tail tips; scatter on gallop (already partially in spirit_fox).
6. **Do not** pull a cute BlenderKit free fox. For a higher-poly realistic base, need **Vivek's BlenderKit login** (paid animal packs) — then retarget clips onto Quaternius bone roles or re-export matching names.

### Fallbacks
- **Khronos Fox** (`fox/khronos_fox.glb`, CC-BY 4.0): 24 bones, Survey/Walk/Run only — emergency only; must credit.
- **BlenderKit free:** reference only; art-lock reject.

### World library for design / scenery streams
Autumn HDRIs, leaf/bark/rock/ground textures, nature GLBs, Kenney kit — see `assets/library/README.md` + `CREDITS.md`. Orchestrate scenes from these; don't burn tokens modeling chairs/rocks.

### Needs from Vivek (optional, not blocking)
BlenderKit account/API key if we want a realistic paid fox mesh to retarget onto this rig.

## Sol critique (gpt-6.1-sol)
Full text: `sprint2/sol-fox-pick-critique.md` and artifacts `sprint2/assets/sol-fox-pick-critique.md`.

**Verdict:** Approve Quaternius as scaffold; reject current appearance. Loco streams bind to `AnimalArmature` **now** — do not wait for a new mesh. Next gate is a recognizable grounded ember fox on this skeleton, not another candidate hunt.
