# Sprint 3: water and restoration

Scope: water shaders and color-mask composition only. Keep the fox, route, collision, water parcels, reactor timing, and input unchanged. Follow the supplied gentle animated-realism update and locked autumn art direction; no external assets or API keys.

Water should have a dark translucent body, warm sky reflection strongest at grazing angles, broad moving reflection shapes and restrained broken highlights. Pond depth is an authored basin approximation (elliptical shore to deeper center), explicitly not scene-depth refraction. Add soft shifting bed-light suggestion through the shallow water. Flowing falls should have transparent dark gaps and sparse ribbons of reflected light rather than an opaque cream sheet. Keep frozen/held sources readable before activation.

Restoration should feather over several metres with stationary world-space watercolor variation. Prevent stamp-quad clipping from turning noise into rectangles. Keep the permanent analytic regions and their leaf-mask stamps feathered, with all mask contributions bounded and soft. Restore front timing and CPU gameplay probes retain their current semantics; changes are visual only.

Validation: TypeScript and fox Vite build. Request matching GPU water and restore stills at baseline 2e0e614 and candidate pushed immutable SHA, plus water gameplay reports from window.__game. Inspect returned PNGs personally, document concrete defects, revise and request a second capture. Seek Opus critique of source and captured images; if unavailable, record limitation. No visual pass or main merge before evidence review.

Missing checkout references: sprint3/briefs/_style-update-1105.md, COMMON.md, sprint2/critic/STATUS.md, external sprint2 lessons. Supplied combined brief and local locked design docs are the available direction.

## R2 evidence coverage

The baseline water/stills suite lacks close mask-front evidence. Add a remote-only `restoration` capture group: fixed oblique meadow camera, idle aura, actual dash input with wake decay, then staged existing `lightSeedwells` event at expanding and settled times. Record window.__game and public state beside each PNG. The harness must label staged latches, retain the same lens, and never mutate read-only debug handles. This changes review coverage only, not gameplay.

Relay compatibility: run the restoration coverage as part of the already supported `water` shot group as well as the explicit `restoration` group, so the running relay requires no restart or whitelist change.
