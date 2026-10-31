# Packed plaza floor — proposal awaiting paint/hearth review

Opus06:40 critique accepts visible village improvement but final gate fails: dark unorganized ground occupies40–50percent of the lower view. It explicitly rejects more density, noise, emissives and shader exemptions. It requests one slightly lighter, warmer worn packed plaza floor, with soft falloff, connecting spawn/well/cottage thresholds. DO NOT EDIT FLOOR CODE until own+Opus review of the existing paint/hearth candidate; this document is preparation.

Proposed footprint: a broad soft core around(-8,88), approximate radii12m/10m, smoothly joined to the existing hub lane distance within the hub. No authored route, collider, terrain height, pond, stepping stones or house footprint change. No new geometry overlay/disc, cobble grid, texture noise, scatter, prop or permanent color stamp.

Use the existing ground material/soil atlas. Modest original-albedo value lift (initial target18percent maximum), a small warm bias, and roughness toward.90 from.95. Retain all ColorField restoration/sepia behavior; untouched realm must remain exact. This is physical worn earth, not a restored zone or a lamp pool.

Keep one CPU spatial-weight function/config. If roughness needs spatial input, carry that authored mask as a terrain vertex attribute into groundBlend; initialize zero on every other geometry sharing the ground material, rather than relying on WebGL default attribute state. PBR, texture frequency, normal/shadow geometry and exposure remain unchanged. No second ground rendering path.

Named sample goals: spawn(-6,92), well(-8,85), lane junction(-12.5,89.5) receive a coherent floor; cottage thresholds transition softly; pond(-18,70), central realm and far village outskirts are unaffected. Existing stepping stones should sit naturally in the floor. Coarse terrain interpolation and over-bright footprint edge are GPU risks.

After existing candidates are reviewed: get Opus design critique, implement only the bounded floor variable, roottsc/foxbuild plus scope/outside invariants, immutable pushedSHA remote capture. Compare natural spawn, same hero, well and arrival-close against reviewed before at fixed2.5 lighting/paint/hearth. Require allPNG/window.__game, no black footage, no new player silhouette obstruction, then final Opus review. Current capture request remains85428fa; no floor code or approval is implied.
