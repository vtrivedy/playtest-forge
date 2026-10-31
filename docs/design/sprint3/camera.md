# Sprint 3 camera — reliable sight lines

Preserve the warm, restrained three-quarter chase composition and existing debug/photo cameras. The existing hybrid solver contracts a long boom around solid props, then opens a local screen-space dither cutout when contracting further would bury the fox.

This pass makes query geometry double-sided without modifying rendered material state, detects actual foliage materials in addition to authored canopy proxies, and samples the animal's width as well as its chest/head. Respect hidden ancestors so restored/replaced geometry cannot trigger ghost cutouts. Cover transient solid blockers immediately while keeping a gentle release. Expose cutout detection telemetry for remote route review.

Validation: CPU regression probes for a single-sided wall and a hidden parent; TypeScript and fox Vite build. Request immutable-SHA remote route/orbit captures, 30-second continuous hub-to-Windmill segment, matched baseline 2e0e614. Inspect PNGs and window.__game reports before claiming readability or landing. Measure visible fox frames / total sampled route frames; target >=95%, with detection telemetry reported separately rather than called visual proof. No local browser or render.

No new art assets or license dependencies. Locomotion, gameplay input, and authored cinematic paths remain owned by their existing systems.

Code review follow-up: photo framing is applied in draw(), after the old simulation-time cutout update. Move cutout projection/detection into draw after the photo override, so the shader uses the actual rendered lens and updates once per rendered frame. Photo views bypass the traversal boom blocked flag.

Opus code critique follow-up: use live small/instanced meshes with a synchronous try/finally query-material swap; synchronize chunk transforms on query. Limit canopy work to chest plus one cycling silhouette sample, and return on the first intersecting mesh. Add moving-prop regression coverage. Double-sided interior hits and cutout onset remain remote-review questions.
