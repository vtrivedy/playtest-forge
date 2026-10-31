# Lanternhollow — twelve festoon lanterns

Driver22:14 and23:05 requested12+paper/iron lanterns on strings. Current9d71da3 has four festoon pendants, although porch/well/checkpoint lamps add other lights. This explicit count can be satisfied while preserving the pending geometry preview as a before image.

Keep the existing four-pendant plaza cord and its two posts. Add two short cords, four pendants each, using original hanging-lamp geometry and existing emissive material. A: Bramble east roof-end ridge(-14.95,92) to the existing west plaza post(-12,86.4). B: Archive east roof-end ridge(-25.25,84.4) to pond-cottage west roof-end ridge(-20.55,84.6). All roof endpoints are on the actual roof edge, with a timber mounting hook from ridge to endpoint. No extra ground posts, colliders, lights, house moves or route changes.

Each roof hook rises .45m from its actual ridge. Quadratic sag is modest (.35m control-point drop = .175m midpoint sag). Pendants are .75 scale, hanger .48; four at t=.2,.4,.6,.8. Before accepting geometry, sample every cord/pendant against ground and houses, ensure lantern bottom>=3m ground clearance, and ensure cords do not cross a roof interior. If a sag/hanger cannot meet clearance without an unsupported roof endpoint, reject that cord rather than raising an entire invisible support. Existing post top can rise only if required by shared supported endpoint geometry; prefer unchanged post.

Reuse separate decor-only buckets/materials and cameraDecoration flags so strings do not pull in the chase camera. Preserve precise solid house/post blockers. Expose all three cord endpoints/pendants in userData for GPU review and CPU tests. No fake pool discs; four existing real PointLights remain unchanged until GPU evidence judges their coverage.

Sol fallback design/source review required because Opus quota unavailable until06:40UTC. Run tsc, fox Vite build, hub geometry/dusk and camera tests. Request exactSHA GPU stills/chase/arrival/orbit; compare four versus twelve actual lanterns personally and seek Opus visual agreement before self-landing. No quality claim from count/source checks.
