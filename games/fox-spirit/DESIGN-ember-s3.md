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

Opus visual critique independently confirms invisible wisps, transparent tail bands, black eye surround and over-smoothed coat (opus-visual-8a975c2.txt). Adopt its stronger tail fix: opaque brush core, terminal 18% cutoff with matching shadow, translucent fringe only. Add one extra wisp per ear (22 total) and lift roots 1.5cm from skin. First retest isolates plume/tail; eye/coat pass follows.

## Round 2B — eye and coat follow-up

Use Opus image critique: narrow the amber aperture, confine dark pigment to a fine lid boundary, blend the outer eye surface to coat rust. Do not remove geometry blindly. Restore moderate brush/normal detail and soft grazing fur coverage without stochastic frost; preserve the broad cream bib/socks. Existing CC0 source texture and geometry only, no new assets. Keep this a separate follow-up commit for review.

## Round 2C — restrained skinned coat fringe

Asset audit: there are four authored tail shells but no body shells. Moderate body normal/stroke tuning alone cannot break the silhouette. Add two thin surface-following coat layers sharing the FoxFur geometry, skeleton and bind matrices. Offset before skinning, about 0.8/1.6cm maximum at gameplay scale; shorten at feet/muzzle and vary length in broad combed clumps. Smooth grazing opacity, warm coat color, no random discard, no new shadows. This is a fur surface treatment, never a bone/proportion change. Expose fringe amount in existing look GUI and report layer count for capture auditing. Review against inflation/halo/seam regressions and retain only if remote evidence improves the concept read.

Opus asset/code critique (opus-fringe-design.txt) found tail_col RGBA strand alpha perforating the intended opaque core; local pixel audit confirms 52% nearly transparent pixels. Core and shadow must ignore map alpha and use terminal mask alone (fade 70–90%, cut near 81%). Keep alpha only on fringe. Fringe masks move to smooth named-bone skin weights, excluding eyes/inner ears/tail stub/paws, with coarse tuft coverage, no normal map or repeated rim emission. Opus confirms head closed beneath eyes: safely discard outer eye disc beyond almond aperture instead of painting rust patches.
