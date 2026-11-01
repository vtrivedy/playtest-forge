# Pop-up ruin — WIP play review

Current candidate: df1382a (sw3-rook), not approved for integration.

First two physical greybox attempts are NOT YET. Evidence in `/captures/rook/ruin-greybox-055` and `ruin-greybox-055-r2`; these are failures, not completion clips. Controller inputs used real keyboard Space/Shift and world-relative movement stick, manual60Hz; entry staged only. R1 was invalidated late by editing under Vite HMR; retain observations only. R2 ran through all samples: first trigger opened, later traversal failed. Real held jump measured apex0.792m, time-to-apex0.317s, air1.1s after missed landing.

Fixes before R3: lower tops0.16m to account for lower approach floor; compare running approaches instead of a reversed stationary takeoff; keep dash outside sweep with a retracting spindle housing; defer collider addition under occupied feet; split camera fading by architectural leaf rather than fading the whole ruin. Retry route passes south of tree(−31,79) through z81; no scenery moves.

R3 and0.9s comparison pending. Current mesh is a traversal greybox, with two slate/paper folds and a broken overlook; beauty, readable spatial puzzle, and FUN require two independent teammate verdicts. No controller/rig/camera tuning or new action key.

## Feel critique — df1382a
Verdict: NEEDS REVISION

### Concrete failures
1. R2 first unfold — collider lifted fox from under its leaf — added physical dash stop and clear-feet completion guard; R3 must prove it.
2. R2 first jump — reversed stationary approach failed landing — test the intended run-up and judge whether it is naturally readable.
3. R1/R2 entry still — whole-ruin fade hid the spatial target — split fade units; R3 must show the folding leaves clearly.

### What works
- Existing held-jump apex/time measurements are consistent; no movement retune.
- Permanent unfold state is externally readable through `__game.state().opening.popUpRuin`.

### Checklist
| Item | Pass? |
|------|-------|
| Feet plant / gait cycles | Prior Keeping approved; ruin route review pending |
| Body + tail follow-through on turns | Ruin route review pending |
| Jump anticipation + land squash | Landing failed R2; pending correction |
| Dash has weight | Spindle stop pending R3 |
| No skating / rigid language fits | Ruin clip pending review |
| Retained capture present | Failed R1/R2 PNG, JSON, webm retained |

### Next patch
- Prove physical route with running takeoffs and a safe deliberate miss.
- Compare0.55/0.9s fold response.
- Review visual target/readability before any decoration.
