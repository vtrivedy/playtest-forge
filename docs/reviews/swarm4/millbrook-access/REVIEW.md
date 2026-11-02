# Production Millbrook access — 628d1b7

Final bounded verdict: corrected-tape production access PASS (36/36 beats, no stuck spans, zero errors). Original shortcut tape FAIL retained below. Runtime is unchanged 628d1b7.

The existing walk tape visited all 35 beats over 88.3 simulated seconds, but the west-cottages leg timed out at (-25.56, 0, 87.60), short of (-29.2, 87.6). The original interrupted run and completed persistent-terminal rerun reproduced this stop. The runner previously advanced past timed-out legs without distinguishing them from arrival; it now records `arrived`, preserves atomic beat checkpoints, records completion and source SHA, supports production preview, and fails its process when access checks fail.

The remaining route used real stick/dash/hold-jump inputs after a single staged village start. Final state: millrace burst, turning and painted; lookout painted; kiln lit, ridden and weir reached. No console or page errors. The bridge was crossed and the lookout reached. These results do not erase the failed cottage leg.

Source inspection: the authored path has a bend at (-24, 88.3), while the tape shortcuts directly from (-18.7,87.4) toward (-29.2,87.6). The house at (-28.5,84.4) also has a padded box collider extending to z=87.15 before player radius. Both route alignment and endpoint clearance deserve a focused input retest before changing scenery. No runtime edit made here.

Reviewed sampled screenshots at cottage stall, dam dash, kiln flight, bridge crossing and lookout. Fox readable in those frames. Dam framing is steep and the lookout uses a low rear-side view; no full camera beauty verdict. The weir target was not reached precisely by the glide tape, but runtime `millWeir.reached` is true. This sparse 1 fps capture cannot establish motion stability, audio quality, or real-time performance.

Evidence: `/captures/sorrel/millbrook-production-628d1b7-retest/` contains route.json, 89 sampled frames and clip.mp4 (1 fps, silent). The earlier `/captures/sorrel/millbrook-production-628d1b7/` run was terminated at the valley and is incomplete. Production tsc, Vite build and lint:feel passed before play. The preview adaptation changes capture tooling only; runtime is exact 628d1b7.

## Focused diagnosis and final retest

The focused authored-bend probe passed both (-24,88.3) and (-29.2,87.5) with a tighter 0.55 m arrival radius. The wider south-clearance alternative also passed all four legs. Thus the reproduced stall was a shortcut in the tape, not evidence of an impassable authored lane. Both final screenshots were reviewed; the staged camera can remain close to the house, so no camera verdict follows.

Corrected the existing tape with the missing (-24,88.3) bend. Named start beats now resolve by name so this insertion cannot silently shift the lane/mill/kiln starts. Full production replay then passed 36/36 beats in 76 simulated seconds: no stuck spans, finite final position, zero console/page errors, same complete millrace/weir/lookout state. Process exited 0. Final route checks are saved in fixed-tape-628d1b7.json; focused window.__game evidence is in cottage-diagnosis-628d1b7.json.

Final evidence: `/captures/sorrel/millbrook-production-fixed-tape-628d1b7/` (26 sparse frames, route.json, silent clip.mp4 at one frame per three seconds). Reviewed cottage, kiln, bridge and lookout images after the correction. Cottage and bridge fox silhouette readable; kiln rim and caption obscure the lower body during the waiting moment. Camera concern stays bounded to that still and should be reviewed on Fern's pending camera integration. No claim of motion or audio quality. No runtime geometry was changed.
