# Audio: creatures, homecoming, ruin, canopy (Moss)

Part of the opening audio pass (Kit :963; split Flint :987). Flint owns the shared graph (one AudioContext,
master bus, music bed + ducking, 3D panner util). These events play through that bus, placed in 3D at their
source. All samples are CC0 (Kenney RPG Audio / Impact Sounds / Interface Sounds; credited in CREDITS.md),
stored in `src/opening/sfx/`, imported with `?url` so the build bundles them.

## Events

| event | where | sample(s) | treatment |
|---|---|---|---|
| creature pop | the drawing | `paper-peel` + `paper-flick` | pitch by creature (hedgehog high, heron low); the peel, then the flick as it inflates |
| hare bound | hare | `thump-1/2` | soft, alternating, every 2nd bound while it leads; quiet at range |
| heron wings | heron | `wing-1/2` | on each downstroke of the hop down and the homecoming wheel |
| canopy leaf | each leaf landing | `leaf-bounce` + `thump` low | pitch rises up the canopy (entry → roost) |
| ruin unfold | each fold | `unfold` + `creak` | slowed a touch, low |
| page pinned | well post | `page-pin` + `tack` | |
| lantern kindle | each lantern | `kindle` then `chime` | chime pitched up a step per lantern (5 steps of a major pentatonic) |
| well fills | the well | synth pad swell (Web Audio) | 3 s swell on all five lit; music ducks under it |

Rules: nothing above −6 dBFS at the bus; each event has a cooldown so a repeat can't machine-gun; the
drawings' breath shimmer stays a quiet synth voice (no sample).
