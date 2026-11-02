# Ruin pounce framing — Fern

Runtime: `4ef7d747f53a70da66f2f9a8da6f93fc2527cc2b`.
Verdict: **APPROVED for this camera regression**. Whole-game feel is not certified.

The inherited camera already prevents head penetration. Increase its opening
minimum horizontal body clearance from1.2m to1.5m; retain the2.45m normal follow
boom and existing movement/spring.1.8m also passed, but1.5m leaves the fox larger
in tight views with sufficient pounce margin. Body clearance is now in the camera
GUI. Candidate search closures/working vectors are created once; collider sphere
queries reuse their footprint. Third-party raycasts retain internal hit allocations.

## Played evidence

Initial route placement is staged once; subsequent traversal is real controller
input. Both90s replays use30Hz simulation. Clips are offline640×360,15fps timeline,
without audio; they establish motion/framing, not real-time render performance.
`--miss-overlook` walks off the second page before genuine pounce retries.

| Late60–90s | Seed1.2m miss | Final1.5m miss | Final successful route |
|---|---:|---:|---:|
| Minimum lens/chest range |1.233m|1.559m|2.013m|
| Maximum absolute pitch |59.10°|48.77°|24.66°|
| Maximum lens speed |10.80m/s|10.75m/s|19.00m/s|
| JS errors |0|0|0|
| Skinned-body clip framing |visual review|60/60 frames pass|90/90 frames pass|

Final success: three catches/zero skips, page pinned home; four dashes,
last dash2.132m. Last jump .750m apex/.300s to apex/.633s air. Failed-input route
intentionally retains two catches and retries below the overlook; it is not a clear.
All projected vertices of the animated skinned meshes stay inside a2% viewport
margin during the clips. Shader flames and opaque-world visibility are excluded
from that numeric check; actual source frames were reviewed for those.

Evidence directories:
- `/captures/fern/final-success-4ef7d74/`:42–48s `drop.webm`,90 source frames,
  eight timed stills, full trace, `window.__game`, camera checks, all-frame sheet.
- `/captures/fern/final-miss-4ef7d74/`:64–68s `drop.webm`,60 source frames,
  five timed stills, full trace, `window.__game`, camera checks, all-frame sheet.
- Local retained copy: `playtest-output/fox-spirit/fern-camera-4ef7d74/`.

## Visual and feel critique

The complete fox remains readable through the overlook leap and close retry.
No body tip crosses the viewport during retained motion. The camera stays outside
the fox and eases continuously below the platform; extra clearance gives the tail
and head room. Village arch approach, return-page still and descent retain a clear
animal and route. Source frames show authored leg/body/tail changes through jump
and landing; this camera patch changes no animation and does not recertify skating
or the60s empty-island fun gate.

The successful catch's giant page still leaves the top of the view; Sorrel owns
that reveal-scale correction. The failed-catch gap remains plain and geometrically
tight. No special page-follow shot or ruin collider change is introduced here.

## Recheck

```sh
node tools/camera-drop-probe.mjs OUT .07 90 5198 \
  --dt 0.03333333333333333 --size 640x360 --check-camera \
  --sparse-stills --clip --clip-from 42 --clip-seconds 6 --check-silhouette
# Add --miss-overlook --clip-from 64 --clip-seconds 4 for the failure case.
tlc -workers 2 -config games/fox-spirit/tla/CameraEnvelope.cfg games/fox-spirit/tla/CameraEnvelope.tla
npm run lint:feel
```

TLC:9distinct states, publication follows the final envelope check; deliberate
removed-call/guard variant fails FollowChecked at state5. It verifies ordering,
not geometry. TypeScript and Vite build pass (existing chunk-size warning).
Sorrel's shared AST hot-path lint passes both camera modules. One linter crash on
external scalar callbacks was fixed with a positive regression fixture.
Vite-served gameplay was played here; Sorrel separately owns the existing static
production asset-path packaging defect.
