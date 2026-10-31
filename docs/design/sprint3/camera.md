# Sprint 3 camera — reliable sight lines

Preserve the warm, restrained three-quarter chase composition and existing debug/photo cameras. The existing hybrid solver contracts a long boom around solid props, then opens a local screen-space dither cutout when contracting further would bury the fox.

This pass makes query geometry double-sided without modifying rendered material state, detects actual foliage materials in addition to authored canopy proxies, and samples the animal's width as well as its chest/head. Respect hidden ancestors so restored/replaced geometry cannot trigger ghost cutouts. Cover transient solid blockers immediately while keeping a gentle release. Expose cutout detection telemetry for remote route review.

Validation: CPU regression probes for a single-sided wall and a hidden parent; TypeScript and fox Vite build. Request immutable-SHA remote route/orbit captures, 30-second continuous hub-to-Windmill segment, matched baseline 2e0e614. Inspect PNGs and window.__game reports before claiming readability or landing. Measure visible fox frames / total sampled route frames; target >=95%, with detection telemetry reported separately rather than called visual proof. No local browser or render.

No new art assets or license dependencies. Locomotion, gameplay input, and authored cinematic paths remain owned by their existing systems.

Code review follow-up: photo framing is applied in draw(), after the old simulation-time cutout update. Move cutout projection/detection into draw after the photo override, so the shader uses the actual rendered lens and updates once per rendered frame. Photo views bypass the traversal boom blocked flag.

Opus code critique follow-up: use live small/instanced meshes with a synchronous try/finally query-material swap; synchronize chunk transforms on query. Limit canopy work to chest plus one cycling silhouette sample, and return on the first intersecting mesh. Add moving-prop regression coverage. Double-sided interior hits and cutout onset remain remote-review questions.

Round camera-r2: canopy sight queries must also detect back faces. A single-sided leaf plane viewed from below/behind currently escapes detection, unlike solid boom probes. Use a reusable DoubleSide query material only during synchronous raycast, restoring the source in finally; rendering remains unchanged. Add a CPU regression with a back-facing crown and verify source material identity/side survives. Alpha-card holes remain a known conservative detection limitation requiring GPU inspection. Reissue baseline/candidate capture via camera-r2 and do not accept based on these CPU probes.

Opus r2 follow-up: retain material-array shape during double-sided queries in both solid and canopy paths. Three.js uses that shape to apply geometry groups; replacing it with a scalar material unintentionally tests triangles outside rendered groups. Cache reusable query arrays keyed by rendered array, and regression-test ungrouped multi-material triangles. This is query correctness, not an artistic acceptance claim.

## Captured failure: remote celebration steals traversal

Personally inspected fox-restored-chase-run.png and paired report from shared fox capture 8a975c20d087327182e94cb9276547bb7a7b3a21. Sepia run is readable; restored run is an elevated panorama with the fox reduced to a tiny orange dot. Restored idle is normal. Report: run target [0,-0.076,59.697], lens [18.892,17.487,70.541], shot=0.24, path=null, photo=false. During the turn shot rises to 0.53. This is a celebration two-shot, not boom compression or an active restore path. Global restoration can light a remote seedwell after the fox has moved away.

Fix the camera contract: short reactive two-subject shots are local only (all subjects within 12 m of hero), and running yields them using the existing blend-out. Keep authored restore paths and explicit photo views intact. Add CPU regression for a remote subject and running with a local celebration; verify ordinary stopped/local shots still work. Retest the same restored idle/run/turn PNGs remotely plus continuous route. No visual pass until returned captures are personally read.
