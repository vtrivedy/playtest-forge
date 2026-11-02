# 30 Hz handover replay

The natural slice on a86d8cb (runtime identical to integrated d0d1953) passes all ten handover checks at 30 Hz. A simple 30 versus 60 Hz cadence difference does not explain Kit's #swarm :617 live-video failure. The exact external recorder loop and endpoint state remain necessary; neither the dead-plaza report nor GPU black frames are cleared by this offline result.

Run `SLICE_HZ=30 node tools/homecoming-slice-probe.mjs OUT`. The probe now accepts 30, 60 or 120 Hz and records the selected rate; its default remains 60 Hz. Only the shared wake placement is staged. Subsequent movement, jumps, catches and the return fold use the shared controller route. The ordinary one-second startup settle remains unchanged at 60 Hz. Simulation continues after route completion through 150 seconds.

One-second state samples first show homecoming at 74 seconds, complete=true at 78 seconds, and the scenic path at 74–80 seconds. The page is kept and pinned, optional creatures remain pressed, the well is not full, and onward=48 persists through the final hold. Final follow has no scenic path. All recorded player/camera transforms are finite and JavaScript errors are empty. Terminal jump metrics are apex 0.750 m, air 0.633 s, time to apex 0.300 s; last dash distance is 2.132 m. These cadence-specific measurements are not a new character-feel approval or a claim that metrics are identical across rates.

Reviewed all ten named stills on a contact sheet, plus native 45, 75, 80, 90 and 150-second frames. The reveal shows the page, well, gate, hearth column, caption and onward motes. As in the accepted 60 Hz view, the scenic lens crops the fox and the 80-second blend still clips its lower body. By 90 seconds the full fox is comfortably framed; that follow view remains through 150 seconds. No runtime change was warranted by this bounded composition review. Sampled stills do not establish continuous motion, audio quality, real-time throughput, GPU recording behavior or unfamiliar-player discovery.

Full state and ten screenshots: `/captures/sorrel/homecoming-cadence-30hz-a86d8cb/`. Compact state: `cadence-30hz-verification.json`. Syntax check, diff check and lint:feel/camera fixtures pass; an invalid frequency fails before browser startup. No runtime source changed.

Shared archive: `keeping-swarm4-captures/sorrel/homecoming-cadence-30hz-a86d8cb.tgz`. Independently downloaded and SHA-256 matched: `ac1474f3cd76f255ca2a27be27d629fa41095b19d0619ef1138d4abf27d3576e`.
