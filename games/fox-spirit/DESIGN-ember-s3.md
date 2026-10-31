# Ember spirit fox — sprint 3 current design

The fox should read as a gentle burnt-orange ember spirit at chase distance. Preserve the original Quaternius-derived CC0 rig, animations, actor fitting and controller. Use warm sepia, broad painted values, restrained fire and believable physical volume. The creative director's remaining blockers are the ordinary red body, oversized eye, plastic coat and cuffed tail root.

This document describes the current implementation and the next review gates. Earlier experiments and their reasoning remain in git history and the stream artifacts. No current visual PASS is claimed.

## Coat and buried warmth

Keep one opaque body with two opaque, depth-writing, front-facing cutout fringes. Cutoffs are .28 and .46. Unresolved coverage filters below each cutoff, so the layers cannot become a solid inflated distant silhouette. Fringe geometry follows the original skin. Long coverage belongs only to the forward lower throat and outer rear cheeks; short jaw fuzz stays below 1 cm. Do not restore the continuous translucent ghost wrap or whole-neck collar.

The body and cutout fringes share pigment grading and ear/back warmth. Only the nearest opaque fragment contributes. The core alone receives broad PBR normal relief, eye recovery, subtle chest-border warmth and limb heat. Fringe and eye geometry are excluded from the GTAO override; the real body remains in AO and shadow passes.

Broad fur relief uses physical 3.5 cm cross-flow / 16 cm along-flow cells, nominal 1.2 mm peak-to-trough at amount 1, default .75, and a 10-degree normal limit. Filter derivative slopes before any procedural discard. Protect cream, eyes and paws. Use the original normal for artistic rim and ember facing. GPU review must reject pebbles, engraved skin, crawling detail and a visible collar.

Native ear heat is 2.8; dorsal heat is .40 and extends through the pelvis toward the tail. Keep the deep orange below white clipping. Sparse hair-aligned orange streaks use approximately 2 × 2.5 × 22 cm cells, a 30 cm broad gate and 1.2 cm/s flow. Cap their mask at 1 and radiance at .90, with a slow pulse below 10%. Clear the streak mask toward the head/nape. Filter fine features from footprint .12 to .35 toward a quiet mean. There is no dark crack halo and no cream emission. Cream chest warmth is a subtle lit peach tint; the bib/rust boundary receives restrained orange warmth using the same ungraded pigment classification.

`bodyEmber`, `emberSeams`, `brushRelief` and `furFringe` remain independent lil-gui controls, available through `window.__gameHooks.foxLook`. Report their live values through `window.__game` spirit diagnostics.

## Limb warmth

The embedded coat map transitions from dark stocking to rust around bind Y .26–.30 m on the front legs and .24–.28 m on the hind legs. These are absolute bind coordinates, while the heat band uses each paw's own pad floor. Actual pad floors are approximately -.0198 m front / -.0627 m hind.

Associate forearm and front-paw vertices with their front paw floor; associate shin, hind-foot and hind-paw vertices with their hind paw floor. Use skin weights for the association. The band eases in .31→.35 m and out .39→.45 m above the pad. Add .02 m to the front-leg sample coordinate, placing its band 2 cm lower. Full plateaus therefore sit at absolute bind Y .310–.350 m front / .287–.327 m hind, centred roughly 5 cm above the stocking transition.

Feather the outer and rear-facing surfaces so the patch remains visible from chase without wrapping into a bright ring. Core radiance is .50, gated by the ungraded linear rust pigment. The source texture's display RGB ratios cannot be compared directly with this linear shader gate. CPU sampling confirms weighted gate values around .995–1.0 in the active band.

Stocking darkening uses height and source luminance independently of the heat mask. Soles and eye regions remain unheated. Derive the reported front/hind band centres from the same constants used to create the mask. GPU review must reject hot toes, bright stripes or glowing stockings.

## Face

Recover the old baked dark eye paint and amber footprint to rust while preserving cream pigment. Full recovery extends to two socket apertures and feathers to 3.2; the original socket coordinates remain independent of the visible eye shape.

The visible cap has a narrow almond aperture: width .70, lower height .26, upper height .32, and approximately 10 degrees of outer-corner rise. Keep a short .07 × .15 pupil, a fine umber lid, tear corner and small catchlight. Eye emission is .04. The head supplies real occlusion. Do not add a white eye ring or enlarge the black socket to hide the original paint.

## Tail root checkpoint

Replace the imported hollow petal surfaces with one closed spindle and two cutout fringes on the existing eight tail bones. The centreline is a uniform cubic B-spline with mirrored end controls. It approximates the bone heads within approximately 1.7 cm and reduces the root bend from about 15.65 to 6.63 per metre without moving any joint.

Use a 9.5 cm buried root extension, 45 arc-spaced body segments and 12 radial sides. The profile has one approximately 15 cm maximum at 40% arc. Root height begins at 8 cm; width/height grows from .75 to .80. Build separate upper and lower safe envelopes. Release the upper curvature clamp only where the measured bend lies within 25 degrees of down in the same transported frame used by the mesh. Keep the inward side bounded. Limit profile slopes and smooth conservatively.

Locate skin blends from the closest point on the original bind-pose bone polyline and force that coordinate to increase. Blend the root into the existing pelvis over a broad window; narrower windows demonstrably folded during burst. Each ring uses at most three existing bone influences. Share width across the upper/lower ellipse halves, use consistent seam normals, and account for changing horizontal and vertical radii in the longitudinal normal.

Two shrinking terminal rings and an axial point replace the visible flat tip cap. Fringe layers have distinct closing lengths. The root cap remains buried. Current geometry is 626 vertices / 1,152 triangles per surface, with 48 rings including the closure.

CPU gates: closed manifold topology, zero degenerate or reversed faces, finite normalized weights, all 14 authored clips with zero flipped faces, all 14 controller-driven states with root containment, and unchanged paw/actor fitting. Current results meet these checks: 1,820 root samples remain inside. Extreme burst underside spacing is positive but approximately .9 mm, below the proposed 3 mm target; this remains a recorded limitation, not a hidden PASS.

The next shape gate is GPU side, rear and three-quarter review for root pinch, sausage shape, collar bands, flat caps and an exposed shaft. Five to seven tapered closed fur locks are an offline design option for a feathery tip, not an enabled second tail. Bake geometry/AO/flow normals only after shape approval. The existing bake and limb-mass prototypes remain offline.

## Fire and contact

Keep 17 skin-anchored wisps and 170 ember source anchors. Tail roots follow actual posed skin; wisps drift in world space. Core wisp radiance is 2.4 and tail radiance .8. Three nape wisps sit lower on neck/spine and are shortened to .14 m. Their bases must remain seated in warm native coat, not float like candles. Tail fire is deep orange, filled and soft; reject a white comet or neon wire.

Preserve the soft contact shadow and original animation/controller behavior. Exclude the transparent contact card from the opaque AO override. No rig, gait or new input changes belong to this pass.

## Verification and delivery

Run root `npx tsc --noEmit` and `npx vite build --config games/fox-spirit/vite.config.ts` after game changes. Rendering occurs only on the Modal GPU relay. Push immutable refs, request short fox captures first and a separate turntable on the same stable ref. Inspect every returned still, decoded motion frames and `window.__game` personally; obtain an Opus critique, fix concrete failures and retest. Build success alone does not establish visual quality.

Current reviewed GPU evidence is still a873351: all 22 stills and all 240 run-video frames inspected, with zero capture errors. It fails the art lock. The newer coat/eye candidate 836e5eb is queued; the root checkpoint and limb placement require later capture too. Do not claim current beauty approval or land game changes on that basis. Keep status and capture requests in `/streams/fox-ember-r2/`; stop at 09:40 UTC / 05:40 ET.

No external assets, API keys or paid services were added. The fox scaffold remains Quaternius-derived CC0; procedural surfaces and shaders are original project work.
