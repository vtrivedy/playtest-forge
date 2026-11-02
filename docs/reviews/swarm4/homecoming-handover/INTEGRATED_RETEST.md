# Integrated deferred-reveal retest

Runtime 5cc159838d8db046602f9b6306c24f7060baff4c merges keeping-d2 d0d1953; runtime sources match that integrated commit. Existing staged deferred probe passes all 12 assertions: page-only pinned/incomplete well, onward=48, remote pending/local camera, walking pending, pause reveal, held reveal, movement yield/return, consumed revisit, finite transforms and zero JS errors. Typecheck and lint:feel/camera-release checks pass.

Evidence: `/captures/sorrel/homecoming-deferred-integrated-d0d1953/`, seven native 640×360 screenshots and full window.__game state. Setup uses page-homecoming hook and disclosed teleports; 30 Hz manual simulation. Reviewed native paused, movement-return and revisit frames. Ordinary follow returns with the full fox visible, and the trail crosses the outgoing gate. Scenic pause includes well, page and caption.

This bounded retest does not clear Kit's #swarm :617 report: his d0d1953 150-second video still has a dead plaza and isolated black frames. The captured runtime/route state must explain the discrepancy before claiming player-visible acceptance. No runtime edits made, and no continuous motion, audio, real-time performance or discovery verdict inferred from sampled screenshots.
