# Sprint 3: water and restoration

Scope: water shaders and color-mask composition only. Keep the fox, route, collision, water parcels, reactor timing, and input unchanged. Follow the supplied gentle animated-realism update and locked autumn art direction; no external assets or API keys.

Water should have a dark translucent body, warm sky reflection strongest at grazing angles, broad moving reflection shapes and restrained broken highlights. Pond depth is an authored basin approximation (elliptical shore to deeper center), explicitly not scene-depth refraction. Add soft shifting bed-light suggestion through the shallow water. Flowing falls should have transparent dark gaps and sparse ribbons of reflected light rather than an opaque cream sheet. Keep frozen/held sources readable before activation.

Restoration should feather over several metres with stationary world-space watercolor variation. Prevent stamp-quad clipping from turning noise into rectangles. Keep the permanent analytic regions and their leaf-mask stamps feathered, with all mask contributions bounded and soft. Restore front timing and CPU gameplay probes retain their current semantics; changes are visual only.

Validation: TypeScript and fox Vite build. Request matching GPU water and restore stills at baseline 2e0e614 and candidate pushed immutable SHA, plus water gameplay reports from window.__game. Inspect returned PNGs personally, document concrete defects, revise and request a second capture. Seek Opus critique of source and captured images; if unavailable, record limitation. No visual pass or main merge before evidence review.

Missing checkout references: sprint3/briefs/_style-update-1105.md, COMMON.md, sprint2/critic/STATUS.md, external sprint2 lessons. Supplied combined brief and local locked design docs are the available direction.

## R2 evidence coverage

The baseline water/stills suite lacks close mask-front evidence. Add a remote-only `restoration` capture group: fixed oblique meadow camera, idle aura, actual dash input with wake decay, then staged existing `lightSeedwells` event at expanding and settled times. Record window.__game and public state beside each PNG. The harness must label staged latches, retain the same lens, and never mutate read-only debug handles. This changes review coverage only, not gameplay.

Relay compatibility: run the restoration coverage as part of the already supported `water` shot group as well as the explicit `restoration` group, so the running relay requires no restart or whitelist change.

## R2 grotto outlet continuity

Baseline PNG water-pond-100 shows a dry gap. Independent raw-terrain probes (Sol and Opus) confirm the first ~2 m of the visual path is buried by up to 0.9 m. For `channel:false` only, lift the rendered ribbon to the maximum raw terrain across its visible width +0.08 m; retain original sample positions, arc distances, parcel path and collision. Use a non-increasing downstream visual grade. Tilt each cell to its neighbouring visual heights and stretch its local length by sec(pitch) so its horizontal footprint/overlap remains unchanged. End the flowing fall at the visual inlet height. Do not use highestAt (roof collider) or carve terrain. GPU review must check continuous dark flow, no stepped cracks, downhill-edge floating, unchanged __game lengths/arrival. Other water sources remain unchanged.

## R2 channel highlight correction

Personal matched GPU review of 894193c confirms the flowing channel still reads as a cream plastic strip despite darker instance tint. The PBR light/specular and bright synthetic sky dominate the dark body. Give channel water dielectric water IOR (1.333), restrained specular intensity and a local luminance shoulder before the approximate sky reflection; lower that reflection's radiance. Keep bright accents sparse in the existing flow foam shader. Do not alter global lighting, stone, simulation, or pond shader in this pass. Recapture the same water-120 and crossing-90 views; channel must show a dark body between small warm reflections, not a uniformly pale plank.

## R2 matched-image critique follow-up

Opus independently rejects candidate894193c: channel overlap/ripple grid, muddy pond with haze rim, falls too faint. Preserve tiny cell overlap for geometric continuity but raise channel opacity to0.92 to reduce double-blend contrast; reduce transverse normal amplitude and broaden side feather. For pond, use muted dark pine/slate body, stronger grazing sky response, less bed bleed and a narrow0.90–1 shoreline fade. These are water-local values, no global palette/lighting changes. Raise flowing fall alpha floor0.36→0.55 so falling water remains visible against stone. Review all four matched frames again; no acceptance from source review alone.

Opus source follow-up warns against compressing all radiance and reducing specular twice. Keep physical water IOR1.333 with specularIntensity1; apply a soft knee only to wet diffuse light above0.12, preserving real specular and dry cells. Add restrained foam radiance after the knee. This supersedes the initial all-light shoulder; it should retain small highlights rather than make a muddy ribbon.

Pond geometry follow-up: Opus calculates that the authored basin waterline lies beyond normalized radius1. Add optional shoreRadius (default1) so Wen's pond can cover radius1.18 with matching enlarged plane and proportional edge feather, avoiding a bare underwater ring. Add remote low-angle pond and creek stills because shared water-shader changes affect the creek too. No terrain or collision edits.

## R2 Reed fog blanket and restore framing

Integrated GPU restoration frames expose an opaque-looking cream basin before and after latch. Source audit finds14 overlapping12–24m mist planes at material opacity0.55 (0.3 after latch), above the ink. Reduce plane span to8–16m and opacity to0.12 while active/0.04 after latch, retaining their count/random draws and slow drift so scene placement remains deterministic. Preserve ink hazard and terrain. This targets the visible fog blanket instead of darkening all ground materials.

Opus image review passes soft mask edges but rejects readability/framing. Move the staged fox to the safe Reed Seedwell island and use a southwest lens that includes origin and south front; tighten aura lens. Keep the same lens before/early/mid/settled. Do not adopt suggested green restore hues (ART LOCK forbids spring-green W1); judge the existing rust/gold wash after fog clears.

Opus follow-up finds a concrete mist clipping bug: tilt0.06 drops large planes through opaque ink, cutting horizontal stripes. Flatten mist to -PI/2; existing y=-1.32..-1.12 remains above ink=-1.45. Save photoBlocker sightline evidence for the staged restore lens to distinguish occlusion from weak colour progression in the next capture.

## R2 continuous transparent ribbon

Driver23:05 again rejects older integrated frames as opaque putty. Higher opacity only hides transparent-cell overlaps; it conflicts with translucent water. Replace the instanced overlapping cell planes with one non-overlapping ribbon mesh whose adjacent quads share exact boundary positions/tangents. Keep simulation samples/cell wet flags, path length, timing, beds and colliders. Duplicate vertices per cell only for binary wet/colour attributes; coincident boundaries do not overlap. A per-vertex arc-distance attribute drives continuous ripple displacement in the vertex shader, eliminating per-cell bob steps. Grotto visual bank grade is interpolated at common boundaries; no separate tilt/length compensation remains. Restore channel opacity~0.64, retain restrained PBR highlights and local wet-diffuse knee. One current rendering path only. Remote water crossing/reed reports must match baseline; GPU must show clear body without a ruled grid.

Continuous ribbon geometry gate caught a real inverted triangle at Reed's tight bend. Bound the inside-edge offset to45% of local curvature radius (sampled yaw change per arc distance), leaving the outside edge and simulation width unchanged. Test exact boundary continuity/normals, upward triangle winding, and the existing water timings before requesting GPU review. This prevents folded inner transparent geometry from recreating the overlap artifact.

Opus source review finds no blocking ribbon regression; preserve simulation path despite suggested rounding. Reduce over-conservative inner pinch by allowing65% of measured curvature radius, still below the fold radius and gated by actual upward-triangle checks. Initialize dry vertex colours before first update. Keep GPU attention on the tight Reed bend's slope/width; do not smooth the authored path and alter parcel length.

The85% candidate failed the upward-triangle gate on Reed;65% passes while exposing less bed than45%. Keep65% for remote judgment.

## Driver23:40: clean autumn restoration colour

Newest driver note explicitly passes front shape but rejects muddy rust, requesting gold/russet/green. This supersedes the earlier no-new-green interpretation: use restrained pine/olive accents, never lime/spring green. Author visible autumn colour on Reed land rather than increasing mask brightness. Raise existing leaf coverage in deterministic bank drifts (exclude submerged floor), blend some muted gold into the bank vertex colour, and give Reed-local leaf hue a gold/russet/tan mix with sparse pine. Reed blade palette becomes gold/copper/russet with one pine accent among eight tones. Preserve most damp umber gaps, global palette elsewhere, terrain/collision, RNG draw count and mask/front semantics. Existing mask reveals authored colours outward. Capture the same source-centred before/mid/settled lens; no new discs or fake wave overlay.

Opus bank-source follow-up: preserve worn approaches by multiplying new CPU drift weight by(1-pathK*0.9)*(1-hubWear). Existing Reed peat crowns intentionally share local leaf hues (land includes these playable tussocks); raised stone platforms do not use groundBlend. Sparse pine appears in both local leaf mix and reed clumps as requested by newest driver; dark/tan gaps remain for restraint. No blanket recolouring of paths.

## GPU abe0f35: scene-based water, not more tint tuning

Personal PNG review: grid removed and outlet connected, but pond remains flat green putty; channel has stylized chevrons. Crossing still passes0 deaths/no GPU errors. Restore sightline is concretely blocked by Reed recovery geometry. Scalar colour/alpha changes alone do not supply water's missing visual cue.

Add one shared scene-colour sampler per scene: copy the active opaque framebuffer once per renderer render-frame before transparent water, matching target dimensions/type; sample it with small animated normal distortion for refraction-like bed visibility. No extra scene render for this sampler. Correct direct-canvas sRGB decoding; composer targets remain linear. Register all water skins with this helper.

Wen pond additionally uses the existing three.js Reflector helper at512px/no MSAA, hidden from scene and with all water skins temporarily hidden during its one reflection render to prevent recursion/feedback. Restore visibility in finally. Genuine tower/tree/sky reflections are Fresnel-weighted, gently distorted, with restrained depth tint and shoreline. Creek uses screen refraction without a reflection pass. Channel PBR retains small real highlights and lighter foam, but now shows sampled/distorted bed instead of a uniformly tinted plank. Deterministic manual-clock ripple motion only; no assets/API keys. Preserve simulation/collision and scene lights.

This is a renderer-material pass requiring GPU shader/error/performance checks; source/build success cannot validate framebuffer format/copy or reflected-camera behavior.

Opus scene-water design corrections applied: use an explicit shared postStack pre-pass, not renderer.info.frame. Prepare updates matrices, renders the visible pond reflection with skins hidden, then arms exactly one copy in RenderPass; GTAO scene renders cannot capture or render a second reflection. Only the forge single-sample HDR composer path is supported (no direct-canvas decoding/double tone mapping). Capture texture matches target format/type/size. Fade distortion at screen edges. Save capture diagnostics (copy count, target type/size, first GL error) and fail remote evidence if the copy has a GL error.

Restoration framing now tests safe Reed island/tussock positions against candidate lenses with photoBlocker; uses the first clear sightline, saves all attempts, and keeps that same lens across before/front/settled. A frame cannot silently claim an unobstructed fox if every candidate is blocked.

Creek evidence correction: the abe low lens looked through the south bank into its root knot rather than the water. Raise that lens to y12 above the bank, preserving the creek target. Remove unused direct-canvas sizing fallback from the composer-only sampler.

Scene-water source critique fixes: distort by normal perturbation only, not the whole upward view normal; wet channel alpha becomes1 apart from shore feather because the background is already embedded. Hide screen-sized Points from the512 mirror to avoid oversized reflected sprites. Preserve shadow needsUpdate as well as autoUpdate across reflection; sync reflection-camera layers. Unsupported targets record diagnostics and return, never throw inside a renderer callback. Remote pond-specific counter snapshots require actual copies/reflection attempts, half-float matching buffer dimensions, and isolated GL error checks. Clear stale comments about tint-only reflection.

Final source follow-up: perturbation-only refraction needs a larger scale to remain visible; use0.06 pond/0.055 channel with both screen-edge and shoreline-margin fade, and mildly stronger mirror distortion. Pond validation resets current error fields while preserving boot-copy diagnostics, and gates on completed reflection renders rather than attempts alone. This is still a GPU-tuned visual parameter, not accepted by source review.

Main4e6290c supplies forgeSkipAO exclusions for shader-shaped meshes. Mark registered water skins to skip GTAO's override-material geometry pass so the opaque bed supplies AO instead of a false solid water sheet. Keep color-pass visibility and PBR shadows. Driver00:10 reports an identity-invalid capture; issue the next request at a fresh pushed immutable ref after this main merge.

## GPU GL1282 root cause and repair

GPU b807005/5d403d3 show lost opaque geometry plus repeated shadow sampler/type mismatch warnings. Copy itself is valid; Opus traces this to r186's removed PCFSoftShadowMap: the first mirror renders with shadow updates disabled before three's PCFSoft→PCF conversion, caching BASIC/plain-sampler programs that later receive PCF compare textures. Use supported PCF from renderer construction and remove the obsolete softShadows setting from renderer options/quality presets/caller. Defer mirror renders until visible shadow-casting lights have allocated maps through a main render, avoiding r186's uninitialized shadow-array placeholder. Keep the single-copy path; no extra scene-color render pass is needed. GPU must restore opaque geometry and have zero sampler mismatch/GL errors before art judgment.

Boot reflection starts disabled until its first valid render; readiness ignores hidden/out-of-layer shadow lights. Capture treats sampler/type mismatch warnings as errors and records/requires shadowMap.type=PCF(1), making the formerly silent dropped-draw failure explicit.

Opus confirms PCF/startup repair but tightens proof: record shadow type at the first prepare (before any mirror/main draw can normalize it) and require1; also fail on preserved bootPriorGlError so the original1282 cannot be hidden by pond-scope reset. End-of-sequence shadow type alone is insufficient.

## After valid d99 GPU: Reed payoff and clean restored value

Fresh d99/0e8333ed passes renderer/runtime gates and personal inspection proves the pond now reflects scenery and reveals shallows. Remaining concrete defects: flat channel chevrons, cleared Reed basin is bare dark mud, restored colour still muddy. Opus quota resets06:40UTC; Sol CLI image attachments were unavailable, so its provisional output is not counted as visual approval.

Remove the authored sine-foam chevrons from channel shading; physical specular, refracted bed and ripple normals supply flow cues. Put a shallow clear Reed water skin at floor+0.18 under the existing sinking ink. It is hidden while inkActive, appears after the existing latch/flood clears the hazard, and does not alter ink state, sink timing, collisions, pads or route. Reuse the tested scene-water shader/reflection path; use a restrained dark teal depth tint. Limit mirror distance per surface to avoid distant duplicate scene renders. Add a dedicated restored-Reed water vista and record warm-render performance.

For permanent restoration, preserve authored hue while compensating the sepia wash's lifted black floor: make restored midtone luminance about18% above its washed equivalent, bounded to1.65x gain; deep shadow stays deep. No new radial overlay, saturation wall or change to CPU mask probes. This supports gold/green/russet returning instead of a darker rust stain. The same already-soft mask controls its transition. Review before/mid/settled at the same unobstructed lens, and retain dark wet gaps/fox saturation priority.

The scanned litter texture already carries orange/brown chroma; multiplying it by clean authored hues doubles that bias. In Reed land only, neutralize85% of the source texture chroma before applying the existing gold/russet/pine palette. Keep its value/detail, alpha, leaf placement and other regions unchanged.

## Transient dash wake follow-up

The d99 wake is still a dark stain because value compensation only covers permanent restoration; transient RT/aura masks expose the unlifted dark source material. Extend the same bounded hue-preserving value compensation to temporary masks too, at a gentler12% target versus18% permanent. Use the final brushed mask for the output blend as before; avoid adding a ground decal or a new bright disc. Retain the1.65 gain cap and existing trail lifetime/CPU probes. Review dash/wake/decayed in the next immutable capture.

Sol source critique catches double attenuation: scaling the gain by cm and then blending by brushed can leave a decaying wake below washed value. Apply the bounded1.18 target to the chroma endpoint once and let the existing brushed mix handle all fade strength. Use the same endpoint target for permanent and transient masks, avoiding a darker permanent feather. Unmasked pixels remain exactly washed because their final blend is0; gain cap still preserves deep shadows.

## Flowing falls: same real scene-water path

Personally inspected d99 Reed falls remain pale straight curtains. Reuse the validated shared scene sampler for flowing waterfall sheets, while preserving frozen gate appearance/cast shadow and reactor warning colours. Composite a softly distorted bank once at flowing alpha1 inside existing ragged margins, retaining PBR Fresnel/specular and restrained moving streaks. Register falls as skins so mirror rendering excludes their screen-space sampling; no new render targets, physics, timing or waterfall footprint changes. GPU review must show readable moving water without making a closed gate visually vanish.

Flow can still be in its last holding-warning interval. Pass the existing warning scalar to the fall shader and taper refraction back to the original PBR warning colour as warning reaches1, so the brightening safety cue survives the new composition. This consumes existing reactor state only.

## Pond reflection restraint after independent Sol image review

Sol actually inspected d99 via view_image (not unavailable attachments): pond PASS improvement versus baseline, final readability FAIL because sharp brown mirror shapes merge with bank. Soften scenery reflection with a compact five-tap kernel at512 (centre0.4, four axial neighbours0.15, radius1.5texels), retaining genuine scene content and Fresnel. Cool only the existing pond depth tint slightly (deep0x294f47/shallow0x708d7d, absorption.18); preserve transparent shallow bed, geometry, warm sky and Reed settings. No foam ring or broad white highlight. Validate dark clear water rather than putty, reflection cost via existing warmperf and same pond vista/grazing pair.

## Dash evidence lens cleanup

The d99 dash/wake frames contain a large white H-a shelf arc at the right/bottom edge. Keep the meadow stage and real input sequence, shift only the fixed review lens from(5,y+6,79) to(-6,y+6,79), on the clear west side. Match every dash/wake frame at that lens; this changes capture composition only.

## Remote harness import repair (391499c GPU startup failure)

The integrated capture script statically imports new water-wade-capture.mjs, but the existing Modal image does not package that file. GPU68fa397eaf49 fails at Node module resolution before any render/report, so it is not game/exposure evidence. Load the optional wade helper from the immutable fetched repo tools directory inside its existing water-coverage branch. This avoids a stale image dependency and binds the helper to the requested commit. No browser run locally; node syntax check only, then fresh remote request.

## Fresh-scene wading capture validation

Independent Sol audit of ebffd87 finds that the new wade helper boots three fresh scenes after the existing pond GL gate, but checks only deaths. Add per-view evidence and assertions for scene-colour copy progress, supported first/current PCF, matching half-float composer dimensions, and zero GL/invalid-target errors. Rearm copy diagnostics before each video frame to check later copies too; preserve boot errors rather than clearing them. Record reflection counters but do not require a mirror from a below-surface/culled lens. Save each view's renderer summary before a failure throws. No game renderer, camera path, collision or appearance changes. Keep the already pending ebffd87 request immutable; apply the stronger evidence gate to the next requested ref.

## Main integration ac86a80

Merge current main as requested by driver01:35. Preserve the deferred immutable-repo water-wade import in the single capture conflict. Main adds a projected-visibility helper whose static import has the same stale Modal-image risk; load it from the immutable repo immediately before route-only use. Preserve main's camera, fox, shade and route changes. Required tsc/fox build and capture syntax checks before backup push. Appearance remains gated on fresh combined-ref GPU review.

## 7240f4c actual-image follow-up: continuous reveal and broad wash

All47 captured PNGs personally scanned on four sheets, with pond/settled/Reed vista full-size. Independent Sol actual-image critique agrees PASS improvement vs baseline, FAIL final: near-circular restore sector, disconnected teal water ovals at mid, heavy murky reflection. Opus still rate-limited until06:40UTC. Renderer report is clean PCF1/HDR1016/copy/mirror/GL0; no current white-out.

The disconnected ovals occur while the globally sinking opaque ink intersects the +/-0.043m water ripple. Keep restored water hidden until ink is below its trough, then fade water uniformly from0 to1 over the next0.3m of existing sink travel. Do not change sink rate, hazard, pad/collision, latch or water level. A shader uniform defaults1 for other skins. Add a restrained world-space shoreline variation (<=0.55m) within the existing feather so lake edges are not mathematically perfect ellipses.

Restore contour: add a stationary broad13m-scale noise octave, bounded +/-1.5 feather widths, to both analytic and RT permanent fronts. Retain existing finer brush octaves and soft transition. Expand permanent stamp support to radius+3.1edge so the broader bleed never clips into rectangles. CPU gameplay sampling and restore timing stay untouched; leaves and terrain still use matched fronts. No extra rings, particles or discs.

Capture perf bug: water fixed-clock boot overrides performance.now, so perf(6) reports0ms. Preserve a native bound clock before overriding, make the override configurable, and temporarily restore native performance.now only inside synchronous render-only perf hooks, then restore fixed time in finally. Record warmed median samples for the Reed vista and reject nonpositive timings. No game-time/simulation changes or local render. Request combined-ref retest after required builds and independent source check.

Sol source follow-up catches outward shoreline perturbation at the plane's axis intercepts. Keep all shoreline displacement inward (0..0.016 normalized radius) so original outer-boundary alpha is exactly zero; no exposed square support. Other reveal/noise/support/clock changes pass source review, not visual acceptance.
