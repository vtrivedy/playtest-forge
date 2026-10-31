# Sprint 3 — Ember spirit look

Scope: foxLook.ts plus one main.ts telemetry note; preserve the authored Quaternius-derived skeleton, animation and controller contract. The creative target is a quiet burnt-orange hearth fox with broad soft coat values and a brush-like tail that releases floating heat. Concept: docs/design/img/fox-turnaround.jpg. No new third-party assets.

Priority pass:
1. Restore skinned nape/ear emitters and emit across tail bones 3–5. Use curved, softly faded additive wisps and buoyant world-space motes; preserve quiet idle and increase wake with speed. No static authored flame cards.
2. Narrow amber eye aperture with umber lid/tear boundary, dark pupil and one small catchlight. Remove inherited eye emission textures.
3. Broad low-frequency coat shading, softer texture sampling and reduced normal strength; remove stochastic frost from shell/rim/tip shaders. Preserve cream bib and dark socks.
4. Tail fringe fades smoothly into warm wisps; locomotion owns tail pose. Anatomical thickening/hover require captured evidence before touching authored geometry or ground contact.

Controls/feel remain move + jump + dash, hold-jump glide. No gameplay parameter changes; retain existing apex/air/dash telemetry.

Validation: npx tsc --noEmit and fox Vite build, then push immutable stream SHA. Request GPU turntable, fox close-up and chase/probe evidence with window.__game and console errors. Personally inspect returned PNGs against concept; request Opus critique, fix concrete failures and request a retest. No local browser/render and no main landing before capture review. Record missing inputs and pending evidence honestly.

Capture diagnostics: expose resolved wisp/source counts and live embers in actor userData and window.__game.notes, so missing emitters cannot masquerade as a visual pass.

## Round 2 — evidence-led readability correction

Personally reviewed GPU stills and run report at 8a975c2 (artifacts in fox-ember-r2). Machine reports no errors and 19 wisps/170 sources, yet ear/nape fire disappears in idle views. Tail reads as transparent laminated bands. Eyes lost white rings but baked socket remains too broad; coat lacks silhouette softness. No visual pass.

First correction isolates spirit readability: modestly enlarge ear/nape plumes; increase low-state wisp emission above the brown background; use warm ember cores with soft irregular smoke edges; retain sparse world-space motes. Keep tail core solid through the proximal two thirds and dissolve only the outer third; reduce tail shell opacity to avoid stacked bands. Tail geometry and pose remain owned by the authored asset/locomotion. Review before further anatomy or coat changes. Require matching remote stills and Opus visual verdict.

Opus visual critique independently confirms invisible wisps, transparent tail bands, black eye surround and over-smoothed coat (opus-visual-8a975c2.txt). Adopt its stronger tail fix: opaque brush core, terminal 18% cutoff with matching shadow, translucent fringe only. Add one extra wisp per ear (21 total) and lift roots 1.5cm from skin. First retest isolates plume/tail; eye/coat pass follows.

## Round 2B — eye and coat follow-up

Use Opus image critique: narrow the amber aperture, confine dark pigment to a fine lid boundary, blend the outer eye surface to coat rust. Do not remove geometry blindly. Restore moderate brush/normal detail and soft grazing fur coverage without stochastic frost; preserve the broad cream bib/socks. Existing CC0 source texture and geometry only, no new assets. Keep this a separate follow-up commit for review.

## Round 2C — restrained skinned coat fringe

Asset audit: there are four authored tail shells but no body shells. Moderate body normal/stroke tuning alone cannot break the silhouette. Add two thin surface-following coat layers sharing the FoxFur geometry, skeleton and bind matrices. Offset before skinning, about 0.8/1.6cm maximum at gameplay scale; shorten at feet/muzzle and vary length in broad combed clumps. Smooth grazing opacity, warm coat color, no random discard, no new shadows. This is a fur surface treatment, never a bone/proportion change. Expose fringe amount in existing look GUI and report layer count for capture auditing. Review against inflation/halo/seam regressions and retain only if remote evidence improves the concept read.

Opus asset/code critique (opus-fringe-design.txt) found tail_col RGBA strand alpha perforating the intended opaque core; local pixel audit confirms 52% nearly transparent pixels. Core and shadow must ignore map alpha and use terminal mask alone (fade 70–90%, cut near 81%). Keep alpha only on fringe. Fringe masks move to smooth named-bone skin weights, excluding eyes/inner ears/tail stub/paws, with coarse tuft coverage, no normal map or repeated rim emission. Opus confirms head closed beneath eyes: safely discard outer eye disc beyond almond aperture instead of painting rust patches.

Final code review: Three r186 overwrites custom depth material alphaTest/map from the source material each shadow pass. Match the terminal shadow with an explicit UV-based discard independent of material alphaTest. Also reset tail-core map alpha immediately after the color sample so the broken rim cannot reintroduce fine texture-alpha speckle. Other reviewed shader/skinning/mask items pass the code gate; GPU gate remains open.

## Round 3 — idle crest placement

015d6ce GPU stills show visible tail fire and no dapples, but ear/nape wisps disappear at idle and remain pale isolated curls at run. Source audit: ear_04 vertices span 2.3cm in world Y and random picks can put the visible flame below the silhouette. Current nape uses neck_01 at withers height rather than upper neck. Place ear wicks at the highest skinned tip points; nape at upper neck02/03 high-facing points. Retain random source points for free motes. Keep the smaller tail idle scale, but avoid shrinking the crest wisps by35% at rest. Preserve warm quiet breath and actual animation, no static glow stickers. Expected21wisps=3nape+12tail+6ear,170sources.

Opus visual verdict on015d6ce: FAIL;52130f1 fixes core/fringe but not flame shape. Next correction follows the posed tail chain (each source bone→next bone) with slight lift and gentle velocity drag, instead of actor-back+up. Use8 narrower/longer strokes around tail04–07 (0.13m wide,0.58m long before state scale), warm fur handoff from50–80% and deeper orange coverage to avoid pale bloom blob. Ear wicks move to actual tips, narrow and trail back; nape moves to upper neck. Thin lid band to0.76–0.82 and tilt almond aperture subtly upward at rear. Expected15wisps=3nape+8tail+4ear,170sources; source count unchanged. Capture still must show continuous brush and crest identity; no acceptance inferred from code.

Round3 code critique: no runtime blockers; straight long chords and unstratified roots risk fans/gaps/end-on collapse. Follow-up stays in the same instanced wisp path: stratify8roots across tail05–07 after55% tail length; use current and downstream posed bone directions as a quadratic centerline, with moderate terminal lift. Width remains soft and tapered, side axis follows the curve tangent. No new particle system. Primary source audit confirms7dominant vertices per ear_04, upper-neck90up-facing candidates, model→worldscale~0.354; expect all15sources to resolve.

## Next isolated pass — planted limb mass (not enabled in7555611)

Opus design critique supports a small rest-surface correction but requires its own0/1A/B after the current brush capture. Target+15–20% cannon radius,~15% paw mass, with no bone/clip/controller changes. Measure mid-bone radial sections first; AABB extents of angled limbs are not radii. Candidate offsets in asset units: haunch0.014, upperforeleg0.010, cannon0.016, paw0.020 with strong paw-weight gate so wrists/hocks stay lean. Bias medial displacement down to45%; suppress body-joint creases and preserve the CPU-sampled sole band. Smooth scalar weights over neighbouring vertices before building one rest-offset attribute.

If adopted, one shared displacement function must run before skinning in coat, fringe and custom shadow depth. GUI amount0/1 supports same-pose A/B. CPUgetVertexPosition and IK remain raw; therefore sampled soles must have exactly zero offset. Verify low side/front/chase images, thicker matching shadow, no inner-leg clipping or sole lip, unchanged plant/slide metrics. This is mass only; it cannot shorten the long-leg proportions. Do not include it in the pending brush request.

Mass prototype refinement: prefer a CPU rest-geometry sculpt from a fixed baseline, updated only when GUI amount changes. This gives coat, shared fringe, depth and CPU skinning the same positions, avoiding a second shadow shader. Freeze the entire1.5cm world sole sample band (about0.043asset), not just its lowest edge; no changes to ear-height scale or root bounds. Offline prototype will measure offsets and exact protected-band invariance before any game integration. Pending brush candidate remains unchanged.

Offline prototype result:890sole-band vertices have exactly zero offset; maximum world displacement7.08mm; actor height delta0. Whole-fox bounding center shifts2.38mm in X because the curved tail sets one side of the original box. Therefore any eventual CPU sculpt must apply after initial actor sizing/centering and pad setup, while preserving those sampled vertices; geometry may then update only on amount changes. No mass code enabled yet.

## Next identity layer — quiet spine heat

Driver23:05 note explicitly asks spine licks and inner ember warmth. Keep this separate from the pending brush capture. Upgrade the existing zero-wisp back emitter to two low trailing furls, stratified on spine02/03, not upright candles. Add a broad, continuous under-coat warmth driven by spine/neck skin weights and upward rest normals; low linear intensity~0.08, slow breathing, no fine noise or symbols. Exclude head/ears/legs and do not repeat emission on fringe layers. Keep the existing restrained grazing rim. This is a warm living-coal body with a stronger tail/crest silhouette, not a body covered in flames. Expected17wisps after this layer (15existing+2spine),170sources,2fur layers. Capture A/B against held brush candidate after its result arrives.

Opus spine-heat review refinement: append a dedicated independently seeded spine row with zero mote anchors, preserving all pending tail/ear anchors, seeds and mote patterns. Two0.14×0.06m strokes, lean0.4;~37°up at rest,≥28°at run, alternating lateral tilt; mild slow spine-only height flicker. Deep-orange under-rim starts0.06linear (GUIcap0.10), broad facing falloff1.3, normal and saturation feather in fragment, shared flame clock≤20%breath. Mask uses only spine/neck weight; no head/legs/pelvis and no repeated fringe glow. GUIspineHeat and innerHeat support an exact0/1identity A/B without changing the brush. Expected17wisps/170mote sources.

## Eye paint, auxiliary depth and HDR correction

Primary texture audit:85% of sampled coat pixels immediately outside the iris aperture are dark (meanRGB61/34/17). Cropping the separate iris cannot remove this baked socket ring. Share the eye rest centres/radius with the coat shader; feather a local socket mask, recover only low-luminance paint toward dark rust before normal coat/PBR grading, preserve cream and highlights and the actual thin lid. Provide an eyeSocketLift A/B control. Eye cap stops casting an oversized full-disc shadow; head volume remains shadowed normally.

Scope extends to src/render/postStack.ts for a proven auxiliary-pass mismatch: GTAOPass overrides mesh materials and ignores custom eye/tail cuts and wisp transforms. Mark shader-shaped character meshes (eye, tail, fur fringe, wisps) with a targeted AO opt-out, hide them only during public AO rendering, and restore visibility in finally. Underlying opaque head/body/legs retain AO and physical shadow grounding. Verify restoration on normal and throwing paths with CPU scene objects; GPU beauty still required.

Current warm wisp output is mostly below0.9luminance bloom threshold. Add a narrow HDR hot core inside the existing tapered soft shape, leaving rust edges restrained. Existing post highlight compression keeps hue (knee1.4/cap2.4). Local fireRadiance controls core and drifting mote radiance; do not alter global post bloom. Spine cores remain quieter than ear/nape/tail. Raise iris-only emission slightly for soft amber, no white ring. Latest-only GPU request per driver23:40; no held stale baseline.

## Blocking tail topology replacement — d4ef285 visual review

Personally inspected23PNGs+12decodedframes and full side/back/run/face atd4ef285. Tail attaches and chaseframes work; no errors,17wisps/170anchors/698heatvertices/2fringe. Sol+Opus NEEDS REVISION: rear tail is a hollow cupped/petalled shell. Primary topology audit finds10components inFoxTailFur (one1138tri component plusnine124tri locks),20boundary edges, front-sided. This is blocking geometry, not a lighting polish. cfdHDR/socket work remains queued but cannot fix this silhouette.

Replace only the tail render geometry, retaining original8bones, skeleton indices, bind matrices, poses andclips. Closed, outward-normal, single-sided spindle tube:~0.07m root, peak0.15m aroundhalf-length, taper to0.02–0.03m tip; ellipticalheight:width1:0.85. About4rings per segment,12sides; linearly blend adjacentbone weights. Sinkroot insidebody. V1root→0tip. Two alpha-tested strand fringe shells at1.08/1.16radius; remove all old shell meshes, no dual path.

Critical closure detail: do not fragment-cut a thick tube at81% (that would recreate a visible open cup). Keep a capped, thin incandescent core through the tip; dissolve only fringe into wisps. Its actual closed geometry supplies shadows and GTAO, removing the earlier opaque-tail AO trade-off and oldcustom-depth cutoff. Preserve authored pre-look bounds for actor scale/centering so restyling the tail cannot move the body/collider contract.

Validate closed/manifold outward topology, finite attributes, normalizedweights/tail-only joint indices, source actorbounds/footpad invariants with CPU math; remote back3/4, side, idle/run andturntable plus__game/Opus visual gate. Bodyfur/legs are polish perOpus; no leg-length change.

## Crest attachment follow-up — cfd08d1 full face inspection

Warm crests now survive bloom, but their luminous root starts above the actual ear silhouette. Current code lifts every source1.5cm and the fragment then fades fromzero over12%height, creating an additional visible gap. Seat ear/nape roots2cm into the skin, retain a modest warm root envelope atUV0, and suppress billboard lateral sway at the buried root. Tail retains its surface offset/terminal flow; spine keeps its quiet existing placement. Expose attached-crest counts in diagnostics and verify source overlap with CPU projected axial luminance, then GPU face/run. Do not enlarge flames or globally raise bloom. Opus recheck unavailable: five-hour quota resets06:40UTC; Sol fallback with explicit pending Opus visual gate.

## Driver00:40 / Opus00:12 — filled flame and whole-tail warmth

The cfd08d1 critique identifies narrow white-gold wire rather than filled flame, and a charred root. Preserve the new closed brush/rig. Replace inherited tail colour samples (authored for removed petal UVs) with one broad continuous burnt-orange→warm-orange value gradient with slow coarse strokes; native PBR remains. Add restrained deep-orange internal heat across core length, increasing toward tip, never pale spots. Keep procedural fringe coverage and tip dissolution. Broaden luminous shape from exponent2.5 to1.0 and deepen its core chroma, keeping radiance/bloom unchanged initially; the existing soft envelope remains. No global bloom changes. This directly fixes source causes instead of adding emitters. Eye/fur remain separately reviewable after this capture; no claim of GPU pass.

## Localized ruff experiment — cfd08d1 silhouette failure

Reference has a ragged throat/cheek ruff, while current body-fringe maximum is only~2cm and head mask cuts off most cheek coverage. Keep two existing skeleton-shared fringe layers; add one smooth named-weight ruff mask for neck01–03 and rear/lower cheeks only, feathering out before eyes, muzzle, ears and torso. Increase offset only there to~4/6cm with a downward/backward comb. Coarse tuft opacity gains a distinct silhouette without fine hair noise, added geometry paths or bright rim. Existing furFringe0 disables every offset and fragment. Expose affected-vertex count in diagnostics. Original opaque body supplies shadows/AO; fringe stays excluded from GTAO. GPU face/front/side/run must reject collar tubes, pale jaw seam, halo, eye intersection or plush inflation. Do not claim improved fur before capture.

Root attachment audit follow-up: actual-controller CPU ray tests show root-cap centre stays inside body in idle/run/glide/turns, but8of120sampled root-ring vertices emerge during run. Extend only the hidden root burial from7cm to10cm and reduce root radius7cm→6cm, retaining15cm brush maximum. Recheck posed root coverage and all-clip folding before a new immutable capture ref. No body/bone/clip changes.

Root audit outcome: deeper curve resampling introduced folded faces at ring11, so reject that variation. Final fix keeps original7cm burial/curve and narrows only root radius to5cm. Actual-controller root-ring/cap containment now passes650samples acrossidle/run/glide/left/rightturn (0outside), and all14clips retain0foldedfaces. This is the selected current state; no deeper-burial path remains.

Ruff code-review safety refinement: the lower/rear cheek mask can overlap the iris's rest-space ellipse (eye centreY2.702,Z1.385). Explicitly feather ruff tozero inside1.4× shared eye aperture, reaching full coverage only beyond2.8×. This prevents the longer coat layer entering the amber eye independent of viewpoint. Verify zero mask for every source vertex inside the protected ellipse; no eye material/appearance change.

## Contact-shadow auxiliary-pass correction

Read hub-shadow-handoff.md and personally inspected hub87d0732 hub-arrival-close.png. Current contact plane uses a radial-alpha canvas and MeshBasicMaterial, but still enters GTAO's normal override as a solid rectangle. Mark only that plane forgeSkipAO, using the existing visibility-safe guard. Keep its soft colour opacity, actual opaque fox/terrain AO and native shadows. This is a grounded-contact fix in scope, not a global AO/shadow change. New GPU capture must check no hard dark disc/rectangle and stable foot contact; old hub evidence is context, not current proof.

## Driver01:05 — spirit coat and calm eye

Personally inspected main9773d70 capture3b8f77f0:23PNGs+24decodedframes and __game report0errors/failures. It contains older pre-spindle/pre-ruff fox source; do not mistake it for current geometry proof. Agree face is too open-eyed and rust socket remains broad; body has no visible inner heat at gameplay distance. Driver explicitly permits self-review while Opus quota resets02:40ET/06:40UTC.

Eye pass: narrow visible aperture fromellipse1×0.5 to0.9×0.38, preserving tiny amber iris/slit/glint. Keep baked-socket recovery extent at original1×0.5 so narrowing the visible eye does not leave dark paint untreated. Recover source rust towardlinear(0.30,0.085,0.020) rather than(0.18,0.055,0.016), preserving original value detail and feather. No larger glow or white ring.

Coat pass: add broad smooth skin-weight masks for terminal ears, nape/spine and upper paws. Warm inner emission belongs to opaque coat only, strongest in thin ear tips; deep ember-orange at spine and paws, softly view-feathered,≤15%slow breathing. Lift jet-black stockings subtly toward warm charcoal, and give lower saturated flank a restrained cooler charcoal undercoat; preserve cream bib/muzzle and burnt-orange saddle. No symbols, narrow glowing bands, spot noise, extra emitters or repeated fringe glow. One bodyEmber GUIamount supports0/1comparison; report affected regions in __game. Existing fur relief proposal remains deferred. Bound heat and colour terms; verify protected eyes/sole and symmetry via CPU masks, then GPU closeface/8view/chase and independent Sol fallback code critique. No visual approval until personally inspected new capture.

## 9603850 GPU retest — continuous brush, no pale rings

Personally inspected23PNGs+24decodedframes plus fullface/back3q/run;__game confirms newbrush and0renderer errors/failures. Hollow cup and dark pigment islands gone; attached tail now visible chase/run. Still NEEDS REVISION: pale collar rings/segmented volume and overbright runflare. Radius audit finds3.67cm at16%arc jumping9.42cm at19%, caused by tight bind-curvature bounds. Generic pale rim also repeats on opaque tail fringe, unlike the old thin transparent fringe.

Suppress generic rim on all tail surfaces and all shell layers; tail keeps its own deep warm emission. Retain curvature-safe raw radii but derive one conservative monotone spindle envelope (increase to one peak, decrease to tip), limit radius slope~0.42m/m, then reduce-only smooth neighbours. Never increase above tested curvature cap. Central-difference normals on this smooth radius field. Root stays insidebody, original skeleton/weights/positions/actorfit unchanged. Re-run all14clip fold/containment checks. Reduce tail hot-core radiance3→1.5 to keep broad filled flame orange instead of clipping towhite; ear/native coat heat separate. GPU8view/rearrun must reject deflated stalk, banding, collar, overbright comet or rootgap. Bake remains deferred until shape approval.

Ruff retest outcome:9603850 fullface shows a smooth collar behind the jaw, so reject long fringe around the whole neck. Keep long coverage only on forward-facing lower throat (neck01/02) and outward rearcheeks, excluding nape tube/underjaw. Existing short coat fringe remains elsewhere. Suppress generic pale rim on cream pigment (matte bib/muzzle in art lock); retain warm rust rim and native inner ember heat. Recheck eye/ear/sole masks and GPUfront/face/side before approving fur.

## Remote capture packaging guard —6bee9cf transport failure

Returned archive3b21c1c9b8eb contains noPNG/game report: Node exits beforebrowser startup because /opt/browser/water-wade-capture.mjs was not packaged. This is not game shader evidence. Mainac86a80 includes the missingmount; merged it. Add a CPU-only static modulegraph check that every relative .mjs dependency of tools/gpu-capture.mjs is mounted into the Modal browser image. This protects required GPUverification from futurehelper drift, without importingPlaywright/Modal, readingcredentials/env, launchingbrowser or rendering. Check transitive static/dynamicliteral imports and preserve immutable capture refs.

Preflight also catches newly imported projected-visibility-capture.mjs missing from the current Modalimage manifest. Package that helper too; otherwise the water-helper fix merely exposes the next startup failure. Standalone modulegraph check and CAPTURE.md command are CPU-only and do not import the ModalSDK or browser.

## Interrupted a873 visual triage — fur relief, socket and warm flare

Partialcapture5004d385 contains23PNGs+2completedrunclips, personallyinspected16decodedframes/fullface. Externallycancelledmidturntable, nofinalreport/identity, so NOTacceptance evidence. It shows smoothcontinuousattachedtail, warmernativeears andnarroweriris; remainingblacksocket, darkjawmargin, flatclaycoat, yellow-white runflare. FOXONLY thenTURNtableONLYsameSHArequested for completeverification.

JawUVaudit ofcurrentembeddedcolour:300brightinterioredges,0belowhalfluma, medianedge/interior0.9999. Reject UVbleedhypothesis; do noteditUVs. Add onlyshort lower-jaw fuzz (≤1cm) to soften anatomicaloutline, not whole-neck collar.

Expand bakedeyepigment recovery fullcoverage to2.0apertures, feather to3.2; current1.05→2.15 maskleaves outerpaint dark. Setlift1.0 andrustdetailfloor0.85 (current0.45 retainsblackloop). Keepproceduraliris/lid/tearseparate andnarrow.

Tailfireonly: deepen envelope root/tip toorange(1,.12,.015)/(1,.24,.035),hotcore(1,.18,.025),radiance0.8. Counts/anchors/shape/crestcolour unchanged; reducewhiteoverlapwithoutlosingfilledvolume.

Try one bounded broadfur-relief pass on opaque rustcoat only: physicalnoise-cell3.5cmacross/16cmalong,1.2mmpeak-to-trough atamount1, default0.75,max10deg normaltilt. Separatelyfilteredslopes per octave/body-throatflow, relativeconditioning/grazingfade. Masks afterderivativesexcludeeyes/cream/paws; preserveunperturbednormal forrim/emberfacing. No geometry/contact changes, finefrost or extraemission. Existingpreparedprototype/Solreview corrections applied. GUIbrushRelief0/1; GPU mustrejectpebbles/engravedskin/creambands/crawl. Currentcapturecompletionstillrequired; Opusretreset06:40UTC.

Socketcleanup also removes saturated bakedamber pixels immediately around the old iris footprint while protecting cream byitsblue/greenratio. Narrowing only the procedural cap can otherwise reveal a second painted iris underneath. Keep one renderedeye representation: actualcap suppliesamber/slit/tear, coat suppliesrust/cream and realshading.

Verifieda873fox-only capture67a9072 nowcompletes:22PNGs+16decodedframes personallyread,fullface,__gameprofile/masks,0errors/failures. Fur stillhas plastic-wrap ghostedges; low-opacitycontinuous shells fail thefurbar. Switch existing2bodyfringe layers to opaque noise-cut coverage atsilhouette (no extra layers), no rim/emission copies. Lateexplicitcutoffs0.28/0.46,depthwrite,trueFrontSide. Filter unresolvedcoverage towardmean0.5 usingfootprint toavoidcrawlingfur/frost atchase. Longruffremainsonly530throat/cheeks, shortjawfuzz≤1cm. UnderlyingcorestillgroundsAO/shadow; bodyfringeexcludedfromGTAO. Reject solidcollartubes/plates/plushinflation; preservebodyEmber/brushReliefcomparisons. Modecutout reportedforcapture.

## Driver02:07 — proposed ember-furl warmth refinement (Opusreview next)

Director stillcallsbodyordinaryfox ona873 images; askswarmchest/paws/underfurgradient andcoalcrack/emberfleckpattern. Currentbackheat.18/paw.22 isquiet; chestfront receivesalmostnoheatbecausebackmaskrequiresupnormals. Propose back.65,paw.75, front-chestgradient1.5×undercoatmask withmodelZfrontfeather; retainear2.8. Extendbackmaskoverpelvis forcontinuouswarmhandofftotail.

Propose broad, soft deeporange ember-furl contours inside rustcoat (physicalcell5.5×12×22cm,neckflowrotated), notwhite/darkfreckles, hardrunes orpaintedstickers. Staticadvectedbodyfield with≤12%slowbreath; footprintfiltertowardstablemeanatdistance. Corepeak~2linearradiance, cream/eyeexcludedfrompattern; chestcreamgetsonlysubtlewarmgradient. ExistingbodyEmber0/1 andnewemberSeams0/1 isolatebaseheat/pattern.

Opaque-cutout refinement: coreand2bodyfringe can sharewarmgrade/emission becauseonlynearestsurvivingfragmentcontributes (depthwrite,trueopaqueoverwrite). Oldtransparentlayerswouldadddoubleglow, butthatconditionwasremoved. Preserve noemissiverimcopies; reliefnormalremainsoncoreonly. SharedsamevRest/skinmaskkeepsfurclumpheatcoherent andpreventsouterfurhidinginnerwarmth. NeedOpusdesignreview,thenGPU; thissectionisnotyetimplemented.

## Opus06:44 review — selected corrections

a873FAIL; attachedtail/earwarmth improved butsmoothfur/goggle/decorativewhiteflames stillblock. c2unseen codeblockers: farcoverage0.5 passesbothcutoffs (plushband), opaqueunheatedfringe hidescoreheat; throatflow affectsentirehead; tuftcut blobs. Correctfarmean to0.7×cutoff withcoverageamountclamped≤1, ventral/belowjawflowgate, combedtuftfreq30,30,4. Sharegradefullyacrossopaquefur; shareemissiononlydorsal/ear/tailjoin,no grazingboostonfringe. Core-onlyrelief retained; testitsvisibility beforeincreasingheight.

WarmthproposalREVISED: back.40withpelvis; limb.50softband4–6cmABOVE rust/darksockboundary, nottoes. Creammax10%warmcolour/emission≤.1; heatatbib-rustborder/underruff. Sparsehair-aligned18–25cmlong/1.5–2.5cmacrossstreaks gated~30cm,≤20%rust; lowerflankscalm. Radiance.8–1.0,edge(.85,.22,.03)/centre(1,.35,.06),base×.7halo~1cm. ≤10%breath,very slow1–2cm/sflow; distantmean×.6. Noisocontourloops/tigerstripes/lavasocks. Addeyeupwardoutertilt/lowerlidcalm. Implementinreviewablepasses.

Tailbake remainsblocked onrootpinch/sausage: ellipserootshapedtopelvis/blendpelvis-tail0, singlepeak35–45%,outertipfeatherlocks5–7insteadbluntclosedmass. Keepthinundercoatcoreclosedtoavoidoldcup; outerlocksopenvisually. Geometrychangesneednewdesign/audits/GPUbeforebake.

FirstOpusfixpassimplementsfarcutoff/flow/strandshape,back.4+pelvis,sharedopaquegradeanddorsal/ear-onlyfringeheatwithoutgrazingboost. Existingquiettoeheat.22kepttemporarily; revisedlimbplacementandstreakpatternfollowinaseparatepass. Nochestlamp/isocontourpatternadded.
