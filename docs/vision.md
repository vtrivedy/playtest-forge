# Vision — Autumn Fox (working title)

**Creative director:** Vivek · **Realize:** Siyu + agents  
**Lane:** Ultra-high-quality three.js (Unreal later)  
**Inspiration feel:** Spyro-like creature platforming (original IP — not a clone) + Thariq’s human-as-CD / AI-as-hands loop

## Art direction (locked)

- **Palette:** fall / autumn — burnt orange, rust, amber, cream fog, sepia ink.
- **Hero tone:** grounded and mysterious, **not cute**. Lean red-fox anatomy with spirit fire.
- **Refs:** `assets/concept/fox-turnaround.jpg`, `assets/concept/world-keyart.jpg` (ignore `old/`).

## Hero

A **burnt-orange fox spirit** — naturalistic proportions, cream chest, charcoal socks, amber eyes.  
Spirit tells: **ember wisps** at ears/scruff and a **large bushy tail that becomes flame + swirling autumn leaves**.  
Fully chromatic at all times — a living hearth in a sepia world.

## World fantasy

1. **The world begins in sepia** — warm ink / parchment / faded autumn photograph. Beautiful shapes, starved of living chroma.
2. **Where the fox moves, autumn wakes** — a temporary aura and fading trail of **rich fall color** (rust foliage, amber light) that decays back to sepia.
3. **The fox’s real work** is to **bring autumn back for good**: restore shrines that **permanently flood a region** with lasting color.
4. Payoff: crest a shrine → the island blooms into deep autumn and stays that way. Particles: **embers + falling maple leaves**.

## Prototype (prove it)

Island smoke that must show on video:

- Sepia island at start
- Fox leaves a **temporary autumn color trail/aura** that fades
- Embers / leaves around the fox (not rainbow wisps)
- One **restorable shrine**; activating it **permanently** saturates the island into rich autumn
- Capture the shrine moment on playtest video

### Suggested implementation

World materials desaturate toward **warm sepia** via a world-space color mask:

- Temporary: radius around fox + decaying trail samples
- Permanent: restored shrine regions
- Fox / embers / leaves / UI stay fully saturated (bypass the mask)

## Feel (non-negotiable)

Simple controls: **move + jump + dash**; hold jump in air = **glide**. Iterate hardest on character feel (lil-gui tunables, 2–3 variations per mechanic). Satisfying and powerful beats content breadth.

## What this is not

- Not a Spyro clone / not using Spyro IP
- Not a cute chibi mascot — mysterious burnt-orange spirit fox
- Not Unreal-first (scoped only; box cannot host UE today)
- Not a giant open world on day one — **gorgeous little autumn islands** that prove feel + color fantasy
