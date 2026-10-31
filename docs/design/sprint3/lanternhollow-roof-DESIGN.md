# Next visible house failure — roof shape options

Investigation only while dusk capture8e04a92 is pending; no roof code has changed in this investigation. Personally inspected1ab6d10 west/east/arrival frames: the barrel profile is still read as a shed/loaf. Driver22:35 asks believable houses. Current clustering and lighting may improve the perception, so inspect their returned evidence before replacing the profile.

| Option | Benefit | Cost |
| --- | --- | --- |
| Keep current cos profile/courses | No new mesh/collider changes; strongest continuity with pending capture | Rounded barrel silhouette remains |
| Rounded pitched profile (recommended if silhouette still fails) | Reads as a timber cottage with a gently softened ridge; same eave/ridge heights and original IP | Needs exact mesh/collider profile update and recapture |
| Layered thatch | Thick organic silhouette and autumn craft | Mesh/noise/draw complexity, risks busy shaggy roofs |

Candidate rounded-pitch formula: let t=abs(z)/halfD and r=.12; normalized rise=1-(sqrt(t*t+r*r)-r)/(sqrt(1+r*r)-r). At t0/.25/.5/.75/1, normalized heights≈1/.823/.551/.277/0 versus current1/.924/.707/.383/0. Same eave/ridge heights, modestly straighter slopes, rounded ridge about.3m wide. Use the single existing height function for mesh strips,gables,wall plates and collider tops; no dual modes. Fascia slope offset follows the resulting sampled strip. Existing building footprint and route stay fixed.

Decision gate: Opus roof-only visual judgment of rendered1ab6d10 now, then final decision from8e04a92 dusk images. Never call a source curve a visual improvement without GPU evidence.

Opus roof-only visual critique agrees the current barrel silhouette cancels the cottage cues. Proceed with the rounded-pitched single profile now, retaining eave/ridge heights, footprints and overhang. No thatch, taller ridge or extra overhang in this bounded pass. Hold visual approval and self-merge until matching east/west GPU images. The pending8e04a92 remains a valid before-profile baseline.
