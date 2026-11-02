# Finale subtitle contrast — Reed

Kit's review of the 417c558 native title frame correctly identified broken-looking subtitle readability. The camera-fixed lettering has depthTest disabled; the visible loss is cream lettering crossing the bright open Album beside the dark timber, rather than geometric occlusion.

Change 34c8b32b adds an optional warm-dark rounded outline to lettering lines and applies it only to “and the year turned.” Subtitle alpha rises from .9 to .95. The title, family framing and gameplay are unchanged. DESIGN-finale.md records the correction before implementation.

Verified with a new full 280-wall-second production T4/EGL journey at 1280×720, 30 Hz authored input. One initial wake placement; no later teleports or forced progression. 7815 simulation ticks / 260.5 simulation seconds. All 11 canonical journey checks pass; zero JavaScript errors. Final runtime state: snow; three curled kits; card done, shown once; hero↔nearest-kit 1.14 m. TypeScript, Vite production build and lint:feel/camera gates pass.

| Capture | Black / decoded frames |
| --- | --- |
| Native | 0 / 7126 |
| Staged | 0 / 7815 |
| Compositor | 0 / 2605 |

Visual review of native snow+15 seconds: the complete subtitle remains readable across the bright Album and dark post; the outlined cream lettering keeps the existing serif treatment. Hero and all three kits remain separated and uncropped. Native snow+1 confirms the family is framed beneath “Let the year turn.” The Press still occupies a substantial backdrop, as in the accepted composition. This is a bounded still-frame visual verdict and authored-route regression, not blind discovery or uninterrupted motion-quality proof.

Evidence volume: keeping-swarm5-captures/reed/boundary-baseline-34c8b32b13-175227-7a0838 (all three videos, report.json runtime telemetry, run.json black-frame audits). Local same path under /captures contains native.webm, report.json, run.json, card.png and snow-plus1.png. Previous comparison: /captures/reed/boundary-baseline-417c558749-174006-de3e61/card.png.

An initial local software replay was stopped after the shelf/coal beat once the hardware run was progressing; no completion claim is based on that partial capture.
