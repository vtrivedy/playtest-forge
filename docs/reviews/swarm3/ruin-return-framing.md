# Ruin return framing — 2026-11-02

Runtime: b6b5c82939a08287eff49bbed16d87f37b8632f6. The recurring late overhead close-up is fixed in the tested input route. Camera and movement tuning are unchanged.

The original5e07e9e110s capture spent about61s stationary at the ruin. Its camera trace was clear. The first extended route (db277f7, landed by Kit as ca7bafe before its failed replay was reported) instead dashed off the overlook east edge and then walked into the raised terrace from below indefinitely. That reproduced the player-eye complaint: late lens-to-chest angle69.106°,2937/3000 frames blocked. A clean trace from the older route did not clear this new failure.

The final route uses the overlook's diagonal runway, waits for the actual return latch, walks down the existing steps and returns to the well. The standard harness stops after four seconds at homecoming. The maple moves north to clear the entry and part of the overlook sightline; decorative arch remnants move to the far east edge so they leave room around the fox. Platform dimensions/colliders, jump, dash and camera behavior retain their values.

## Played evidence

Clean exact-SHA full replay:4651frames/77.517s with explicit window.__game state,58 chase stills, nine passing acceptance checks and no PAGEERROR/CONSERR log hits. Three catches/zero skips; all three folds open; return1; diagonal dash grounded throughout at1.02m; final grounded at(-7.175,0,88); page pinned. Late maximum lens-to-chest angle27.596°, floorLift0, minimum boomT0.63 at the gate. Four dashes; final dash1.998m. Retained ground jump apex0.792m, time-to-apex0.317s, airtime0.667s.

A second full-input replay supplies the bounded continuous exit clip:6s/180frames/30fps/640×360, starting at the return dash and ending after ground departure. All180 retained frames were inspected in six consecutive30-frame sheets. Dash travel, turn, tail/body motion, descent and ground departure remain readable; no stuck-underfloor interval appears. The encoded VP9 clip decodes completely (exit0). This is frame-sheet motion/framing review, not a claim of real-time playback, unfamiliar-player discovery or fresh global locomotion certification.

A staged shared-route diagnostic also passes5/5, but stages initial overlook position and is supplementary, not the full-route acceptance evidence.

## Visual review and limits

The first tree-only variation was MARGINALLY better: it exposed ground but another crown remained. After review, the arch was moved to the far edge and the route was corrected, then both were replayed. Tallow independently rates the final return/steps CLEARLY BETTER versus the failed return and arch framing MARGINALLY better. Final well view keeps the fox comfortable, but the pinned page remains offleft. The tree/rim horizon is still close; no whole-scene BEAUTIFUL or universal camera-fix claim follows from this patch. Tallow also inspected all180 consecutive exit frames and independently accepts the bounded return-route correction as CLEARLY BETTER; this remains a frame-sheet review, not real-time playback or a fresh global gait/camera approval.

## Artifacts and reproduction

Modal volume keeping-swarm3-captures:

- `/reviews/rook-ruin-before-5e07e9e/`: original65s baseline.
- `/reviews/rook-ruin-tree-north-5603cf7/`: matched tree-only variation.
- `/reviews/rook-ruin-homecoming-b6b5c82/`: full-route trace, summary, acceptance,58 PNGs.
- `/reviews/rook-ruin-exit-b6b5c82-motion/`: clip.webm, clip-manifest.json, evidence.json,180 JPEGs and review sheets.

Local full/clip evidence is also linked under playtest-output/fox-spirit/.

```
node tools/lookdev-play-smoke.mjs --hero --route slice --route-seconds 110 --port 5194 --out OUT
node tools/camera-drop-probe.mjs OUT 0.07 63 5193 --clip --clip-beat 'unfold the way home' --clip-seconds 6 --size 640x360
node tools/ruin-return-probe.mjs OUT
```

Exact runtime TypeScript and Vite build passed. The configurable camera-probe extension is capture tooling; its default canopy-drop mode retains its settings. Original code-authored geometry only; no new art/audio asset or license change.
