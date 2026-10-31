> **Superseded (sprint 5).** The current locomotion design is [`DESIGN-loco-clips.md`](DESIGN-loco-clips.md):
> authored clips in a speed-driven blend tree with stride-matched playback, light foot IK and subtle additives.
> The procedural layers described below (per-leg clip split + hermite swing warp, swing lift / carpal flick / hock fold,
> body bob/roll/sway, gallop flex, air pose) were deleted from `locomotion.ts`. Only the runtime carpus
> (`foxLimbRig.ts`) survives, as the fore IK chain joint. Kept for history only.

# Natural fox gait — kill the stilts (sprint 4, loco-nat)

Vivek (Oct 31): legs read "rigid and weird like on 4 stilts". The flowing cadence stays: walk/trot/run
≈ 1.8 / 2.1 / 2.4 Hz. Glide stays as it is.

## What the probe found (`npx tsx tools/loco-natural-metrics.ts`, main 8d5a601)
| | walk | trot | run |
|---|---|---|---|
| hind paw lift / leg length | **0.02** | **0.05** | 0.55 |
| fore paw lift / leg length | 0.22 | 0.32 | 0.6–1.1 |
| spine flex (pelvis–mid–chest angle) | **179° (straight)** | **179°** | 173–180° |
| pelvis bob | 0.6 cm | 1.1 cm | 8 cm |

Rig root causes:
1. **No carpus.** `forearm_*` runs from the elbow (0.40 m) straight to `front_paw_*` at 0.04 m. The front leg is
   one straight 37 cm segment with no visible wrist, and the curl only rotates a 5 cm toe bone.
2. **Hind paws shuffle.** In walk and trot the hind pads lift only 2–5 % of leg length, so they slide along the
   ground like stilts.
3. **Board-flat body.** In walk and trot the back stays dead straight and barely bobs. The glide pass flattened the
   clips' own flexion and bob.
4. **Thin limbs.** Forearm radius 4.6 cm and metatarsus radius 3.4 cm, against a 15 cm chest radius, inside dark socks.

## Design (one locomotion path, layered on the authored clips)
- **Runtime carpus bone** (`foxLimbRig.ts`, applied at load before the look). Inserts `carpus_l/r` into each
  forearm about 11 cm above the pad. Forearm skin below it is reweighted with a soft blend, and `front_paw`
  is reparented under it. The front leg becomes elbow → carpus → metacarpus → toes, the same shape as the hind
  leg (stifle → hock → metatarsus). Clips don't key the bone, so the authored pose is unchanged until locomotion
  bends it.
- **Limb mass.** Bind-space radial thickening of the forearm, shin and metatarsus (feathered by skin weight)
  plus slightly wider paws, so the legs read as soft furred legs instead of sticks. Same file, same load step.
- **Four-leg IK, three joints each.** Fore and hind both solve shoulder/hip → elbow/stifle → carpus/hock, with an
  anatomical pole (elbow back, stifle forward). The distal segment keeps its own orientation layer.
- **Swing layer (per foot, every gait).** Uses the swing progress `sw` from the per-leg warp:
  - Paw lift `bell(sw) · lift[gait] · legHeight`, applied through IK so the elbow and stifle fold naturally.
    Lift is about 0.14 / 0.22 / authored × leg height (walk / trot / run).
  - Fore carpal flick: carpus flexes up to about 70° early to mid swing, then unfolds and reaches before
    contact. Hind hock flexes as the paw comes forward.
  - Stance: carpus dorsiflexes slightly under load, so the pastern gives instead of reading as a straight post.
- **Body layer.**
  - Vertical bob locked to footfalls: 2 per stride in trot, 2 softer ones in walk. Lowest just after
    touchdown.
  - Lateral spine wave (yaw) with pelvis/shoulder counter-rotation, plus a roll weight-shift onto the stance side.
  - Walk/trot spine flexion breathing with the stride. More of the clip's own flex is kept.
  - The head stays stabilised by the existing carriage springs.
- **Idle.** Slow breathing: chest rise and spine pitch at 0.25 Hz, with tiny weight shifts.
- **Turns.** Bank, spine C-curve and head lead into the turn get stronger. Feet stay planted through the existing
  turn-plant prediction.
- **Jump.**
  - Standing windup 8 frames (0.13 s). Running windup gets a small gather instead of none.
  - Air pose layer: forelegs tuck with carpi folded and hind legs stream back on the rise, the body stretches at
    the apex, and the forelegs reach down on the fall.
  - Landing envelope: chest drops 10–15 % of body height over about 5 frames, then eases out over about 0.3 s.
    Elbows and hocks compress through IK.
- **Tail flame.** The tail spring chain gets more lag and stays attached. Spirit-FX wisp anchors resolve after the
  actor's final transform.

## Metrics / done-bar
The probe reports per gait: cadence Hz, maxSlideMS, elbow/carpal/stifle/hock ranges, paw lift / leg length,
bob, spine flex range, and the landing drop.

Targets:
- Hind and fore lift in walk ≥ 0.12 and in trot ≥ 0.2.
- Carpal range ≥ 50°.
- Spine flex range ≥ 4° in walk/trot.
- maxSlideMS ≤ 1 (no skate).
- Landing chest drop 10–15 %, lasting 4–6 frames below half depth.

GPU `worldgait` before (8d5a601) vs after, judged from the PNGs and video sheets. Results go in
`/streams/loco-nat/artifacts/BEFORE-AFTER.md`.

## Assets
No new external assets. Procedural over the existing original GLB (repo-authored, project-owned).
