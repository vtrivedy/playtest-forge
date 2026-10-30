# Vision — Color Fox (working title)

**Creative director:** Vivek · **Realize:** Siyu + agents  
**Lane:** Ultra-high-quality three.js (Unreal later)  
**Inspiration feel:** Spyro-like creature platforming (original IP — not a clone) + Thariq’s human-as-CD / AI-as-hands loop

## Hero

A **tiny, wispy, multicolored fox spirit**. Soft body, glowing fringes, particle wisps. Fully saturated at all times — a living paintbrush in a gray world.

## World fantasy

1. **The world begins black and white** — ink / charcoal / monochrome. Beautiful shapes, no chroma.
2. **Where the fox moves, color wakes** — a temporary aura and a fading trail of saturation behind it (splash → decay back to gray).
3. **The fox’s real work** is to **bring color back for good**: restore color sources / shrines that **permanently flood a region** with lasting color.
4. Payoff fantasy: crest a shrine → the island (then later, whole biomes) blooms into color and stays that way.

## Prototype (prove it)

Island smoke that must show on video:

- Monochrome island at start
- Fox leaves a **temporary color trail/aura** that fades
- One **restorable shrine**; activating it **permanently** saturates the island
- Capture the shrine moment on playtest video

### Suggested implementation

World materials (or a full-screen pass) desaturate via a **world-space color mask**:

- Temporary: radius around fox + decaying trail samples (ring buffer of world positions + life)
- Permanent: restored regions (SDF list or low-res render-target mask)
- Fox / wisps / UI stay fully saturated (bypass the mask)

Start simple (uniform list + `onBeforeCompile` or custom `ShaderMaterial`). Graduate to a mask RT if trail quality needs it.

## Feel (non-negotiable)

Simple controls: **move + jump + dash**; hold jump in air = **glide**. Iterate hardest on character feel (lil-gui tunables, 2–3 variations per mechanic). Satisfying and powerful beats content breadth.

## What this is not

- Not a Spyro clone / not using Spyro IP
- Not Unreal-first (scoped only; box cannot host UE today)
- Not a giant open world on day one — **gorgeous little islands** that prove feel + color fantasy
