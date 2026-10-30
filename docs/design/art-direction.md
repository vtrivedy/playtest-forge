# Art direction — Color Fox (lookdev)

**Lane:** Ultra-high-quality three.js · Spyro-adjacent spirit (original IP)  
**Owner stream:** lookdev / `src/render/`  
**Primary refs:** `playtest-forge-artifacts/concept/world-keyart.jpg`, `fox-turnaround.jpg`

## Mood (from key art)

Floating charcoal islands in a **misty gray ink-wash sky**. Paper grain everywhere. The fox is a living prism; its path blooms into **lush saturated greens + wildflower splatters** with **painterly ink-bleed edges** — not hard circles. Ruins / arches read as ancient gray stone. Distant islands fade into fog.

## Fox (from turnaround)

- Soft **cream / off-white** body, plush readable silhouette, large ears
- **Rainbow wispy tail** (pink / purple / cyan / gold) — emissive, particle embers
- Spirit flame tuft on head; small **golden chest emblem**
- Always fully saturated; body stays warm-white, spirit energy is chroma

## Palette

| Role | Notes |
| --- | --- |
| Mono paper | warm ivory lights `#e8e2d6`, cool charcoal `#2a2c30`, mid ink `#6a7380` |
| Mist sky | gray billows `#9aa3ad` → `#c5cad0`, cool haze |
| Restored ground | lush green `#3ecf7a` + flower accents magenta/cyan/gold |
| Fox body | cream `#fff4e8` |
| Fox spirit | magenta `#ff4fd8`, cyan `#4ff0ff`, gold `#ffd56a`, violet `#a78bfa` |
| Shrine | warm emissive gold |

## Monochrome

Ink-wash (cool shadows / warm paper lights) + paper grain + light cross-hatch in deep shadow. **Not** flat grayscale.

## Color restoration

1. Aura ~2–3m soft around fox  
2. Wide decaying trail — lush chroma, ink-bleed edge, optional flower flecks  
3. Shrine flood — noise-edged wavefront, permanent  

## Lighting & post

Soft overcast key (concept is misty, not harsh golden hour) + cool fill. Soft shadows, bloom on fox/shrine, SMAA, ACES, vignette, height fog. SSAO optional.

## Perf

60fps laptop target @ 1280×720; SwiftShader for visual review only.
