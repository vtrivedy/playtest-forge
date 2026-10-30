# Color Fox — Art Direction (working title)

> North star: **a faded autumn photograph that a quiet ember of a fox slowly warms back to life.**
> Every frame should work as a still. Sepia is never dull: it is *old paper, pressed leaves and dust in late light, deliberately composed*.
> Mood: melancholic, beautiful, hushed. Think a held breath at the end of a season, not a party.

**Canonical concept art: LOCKED (Vivek t24u). It is the source of truth and overrides any hex or prose below if they disagree.** Ignore everything in `assets/concept/old/` (the cute cream/rainbow draft is retired).

| Key art: sepia floating ruins, one maple still burning | Fox turnaround: burnt-orange ember spirit |
|---|---|
| ![world key art](img/world-keyart.jpg) | ![fox turnaround](img/fox-turnaround.jpg) |

Mirrors: `assets/concept/` (plus `ART_LOCK.md`) and `/workspace/siyu/playtest-forge-artifacts/concept/`.

**Lookdev owner:** `src/render/` (ColorField aura/trail/flood, painted sky, post stack, water, wind grass, wisps). Showcase: `games/lookdev/`. This doc extends the original lookdev brief (commit `9fd8f5e`). The *structure* of that brief stays; the palette moves from cool ink-blue to warm sepia.

**OPEN QUESTIONS (Vivek):**
1. **How much fire on the fox?** The turnaround puts wisps on the ear tips, the tail, and a light fringe on the chest and hocks. Proposed: wisps stay **subtle at rest and grow with speed** (idle = smoulder, sprint/dash = trailing flame). Confirm.
2. **Scale vs. natural proportions.** The fox now has real fox proportions (slender legs, long muzzle). That costs more animation than a chibi, and reads smaller on screen. Proposed: keep it natural, 0.55 m to the ear tips, and solve readability with the camera and the ember rim (§1.3). Confirm.
3. Outline approach: post-process edge vs. inverted hull (§6.3). *(Carried over.)*
4. Restored color: **painterly** (watercolor bleed, leaf-litter splotches, as in the key art's foreground) or clean? Painterly is proposed.

---

## 1. Palette rules

### 1.1 Sepia world (pre-restore): "the pressed autumn"

Not grayscale and not cool ink. The drained world is an **old sepia photograph**: warm paper highlights, ochre-brown mid-tones, umber shadow. The world still *is* autumn, only drained of chroma, like a leaf pressed in a book for a hundred years.

| Token | Hex | Approx L* | Use |
|-------|-----|-----------|-----|
| `paper-hi` | `#EADFC8` | 89 | Lit paper, highlights, mist bright (max world value; **never pure white**) |
| `haze` | `#D8C8A6` → `#B9A47E` | 81 → 68 | Sky billows, cloud sea, distance haze (warm, dusty) |
| `ochre-wash` | `#A08B6A` | 58 | Mid-ground stone, ruins, dried grass |
| `umber-mid` | `#6E5A44` | 39 | Shaded faces, trunks, bark |
| `sepia-dark` | `#3A2E24` | 20 | Island undersides, deep shade, hatching |
| `sepia-ink` | `#1F1914` | 9 | Ash creatures, outlines, ink pools (min world value; **never pure black**) |

Rules:
- **Chroma cap: world saturation ≤ 15%** (HSL) pre-restore, all hues pulled toward the sepia hue (~35°). This is not optional: the fox is orange too, and it only reads because it is the *saturated* orange in a desaturated orange world.
- **Value range L* 9–89.** Distance fog pushes toward `haze` (atmospheric perspective): far = pale and warm, near = darker umber.
- **Value grouping:** foreground 25–55, mid 50–70, far 68–89. Silhouettes must read in a 3-value thumbnail.
- The world mask desaturates to **sepia-toned luma** (a warm toning curve, with faint paper foxing and grain in the shadows) instead of the old cool split-tone. Implemented in `src/render/colorField.ts` (retint needed: see §6.1).
- **Ash creatures stay at `sepia-ink` value even in restored areas.** They never take on color while alive.

### 1.2 Hue per restored region

Restoration brings back **rich autumn**, not rainbow primaries. The series follows the season as it turns: autumn → first frost → evergreen → long night.

| Region | Primary | Secondary | Accent | Sky (restored) | Pattern (a11y) |
|--------|---------|-----------|--------|----------------|----------------|
| **W1 Ember: Russetvale** | Russet `#A8441F`, maple red `#B8321F` | Golden grass `#C9A04A`, amber `#E08A2B` | Deep pine `#2F4A3A` (the evergreens that frame the warmth), copper leaf glints `#D8813A` | Amber haze `#F0CE96`, low sun breaking through warm cloud | Leaf veins |
| W2 Frost | Frost-blue `#7FA3B8` | Slate `#3E5A6E` | Rime white `#E8EEF0`, last-leaf rust | Blue dusk `#B7C4D0` → peach horizon `#E7B58C` | Ice crystals |
| W3 Pine | Deep pine `#2F5A43` | Moss-black `#1C3328` | Lichen gold `#C9A35A` | Cold clear `#D7DFD3` | Needles |
| W4 Night | Night violet `#4B3B78` | Indigo `#221A3D` | Warm starlight `#E9D9A6` | `#1E1836` → `#7A5C8E` | Stars |
| Hub (cumulative) | Each world lights one leaf of the Great Well's stone maple crest, and one quarter of the hub takes its season | | | | |

**70/20/10 rule.** 70% of a restored region in muted primary/secondary (saturation 40–55%), 20% in the sepia paper tones that stay, and 10% in **accent** (single maples in full flame, banners, maple seals) at high saturation. Autumn is beautiful because the color is *scattered* through brown and gold, never wall-to-wall. The fox stays the most saturated thing on screen.

### 1.3 Fox: burnt-orange ember spirit (per the turnaround)

**Grounded, quiet, mysterious.** Natural fox anatomy, calm posture, narrow eyes. It never smiles or mugs to camera, and emotion lives in the ears, tail and gait. It feels like something you glimpsed at the edge of a wood at dusk.

The fox **bypasses the world mask**, along with its wisps and the UI.

| Part | Color | Material |
|------|-------|----------|
| Body fur | Burnt orange `#C25A1F`, darker along the spine `#9A3F16` | Soft fur (shell fringe), wrap lighting, warm rim. **Not plush**: the texture is real, slightly wild fur |
| Chest / cheeks / muzzle | Warm cream `#E9D6B8` | Matte, soft |
| Legs / paws | Umber `#3B2418` stockings | Matte |
| Ear backs | Dark umber `#2A1A12` | Matte |
| Eyes | **Narrow amber** `#E0A030`, dark pupil, one small glint | Glossy, slight emission 0.3 so they catch in shade |
| **Ear-tip wisps** | Ember `#F08A2A` → gold `#FFC35A` | Emissive flame cards, slow flicker, sheds sparks |
| **Tail (spirit)** | Fur at the root, dissolving into **ember wisps, smoke and falling leaf flakes** | Emissive 1.2–2.0, additive edges, ember particles (`src/render/wisps.ts`) |
| Chest / hock fringe | Faint ember edge | Emissive 0.4. Only visible in shade |

```
 TAIL EMBER RAMP (root → tip), 256×1 texture
 #7A2A0E ─▶ #B4471E ─▶ #D2561A ─▶ #F08A2A ─▶ #FFC35A
 deep rust   rust        burnt orange  ember     gold (tip, brightest)
```

- **The trail inherits the ember ramp.** It reads as a warm wake of embers and drifting leaves (russet, amber, gold), never as a rainbow.
- **Ability states on the spirit:** glide spreads the tail wisps into a long, smoke-like fan. Ember Burst is a slow radial flare that lifts every wisp at once. Embers (Spark) and leaves (health) show as tail-tip glows.
- **Silhouette:** natural proportions, tall pointed ears, slender legs, a tail about **1.0× body length in fur plus up to 0.4× in wisps**. Total height **0.55 m** to the ear tips. The fox is small and the world is big.
- **Readability rule:** the fox separates from the sepia world by **saturation + emissive rim**, not by hue. Check this in every review screenshot.

---

## 2. Shape language

| Element | Shapes | Rules |
|---------|--------|-------|
| Fox | Long S-curves, tapering wisps, narrow wedge head | No cartoon roundness. Silhouette reads at 32 px |
| Floating islands, trees | Soft weathered masses with **dry-brush edges**, gnarled twisted trunks (key art maple) | Big-medium-small mass grouping (60/30/10) |
| Islands | Flat-topped plateaus with **crumbling, root-hung sepia undersides** (key art) | Top = soft leaf litter and walkable, underside = eroded stone and roots |
| Architecture | Ancient weathered **stone ruins, arches and a domed shrine** (key art), plus timber-and-stone village houses (hub) | Nothing perfectly vertical (1–4° lean). Moss and leaves in every crack |
| Foliage | Maple crowns built from **leaf-card clusters**, bare twisted branches, leaf piles | Russet/amber leaves, never pastel |
| Ash creatures | **Drained, hollow figures of ash and dried ink**: brittle, cracked, shedding flakes | The only hard, jagged shapes in the world, so sharp = danger |
| Shrines | Perfect circles (**ensō**), carved maple-leaf seals, spirals | Geometric purity = sacred |
| Ghost-ink platforms | Faint sepia-ink sketch outlines, wavering like heat haze | Read as "a memory, not yet real" |

Walkable rocks are worn and smooth. Island undersides and the Scribe's ink-stone are crisp and faceted, so sharpness lives *below* the play surface and on enemies.

---

## 3. References

| Reference | Why | Link |
|-----------|-----|------|
| *Journey* (thatgamecompany) | **Primary tone reference.** Wordless storytelling, quiet companionship, flowing trail, light-flood climax | https://store.steampowered.com/app/638230/Journey/ |
| *Ōkami* (Clover/Capcom) | A wolf god restoring color to a cursed land. **Closest precedent: study it and differentiate** (we're motion-driven, not brush-input, and quieter) | https://store.steampowered.com/app/587620/OKAMI_HD__/ |
| *GRIS* (Nomada Studio) | Color returning as emotional progression, one hue per chapter | https://store.steampowered.com/app/683320/GRIS/ |
| *Whisper of the Heart* (Studio Ghibli) | Late-afternoon light, wistful quiet, warm interiors at golden hour | https://en.wikipedia.org/wiki/Whisper_of_the_Heart |
| *My Neighbor Totoro* (Studio Ghibli) | Rural hush, the sacred old tree, spirits glimpsed sideways. *Note: the film is set in summer. We borrow its stillness, not its season* | https://en.wikipedia.org/wiki/My_Neighbor_Totoro |
| *Shadow of the Colossus* (Team Ico) | Quietude, vast empty ruins, a small figure in a big world, sorrow in victory | https://en.wikipedia.org/wiki/Shadow_of_the_Colossus |
| *Ori and the Blind Forest* (Moon Studios) | A glowing spirit hero against a muted world; emissive fringe | https://store.steampowered.com/app/387290/Ori_and_the_Blind_Forest_Definitive_Edition/ |
| Kitsunebi (Japanese folklore) | "Fox-fire": the ember wisps. Use it as inspiration only, the fox is our own creature | https://en.wikipedia.org/wiki/Kitsunebi |
| Isaac Levitan (autumn landscapes) | Russian autumn painting: gold, rust, birch, melancholy light | https://en.wikipedia.org/wiki/Isaac_Levitan |
| Kawase Hasui (shin-hanga prints) | Autumn temples and quiet light in a limited, warm palette | https://en.wikipedia.org/wiki/Hasui_Kawase |
| Andrew Wyeth | Sepia/ochre tempera, faded fields, loneliness as beauty: **the drained world's value key** | https://en.wikipedia.org/wiki/Andrew_Wyeth |
| Hasegawa Tōhaku, *Pine Trees* screen | Mist, negative space, trees dissolving into paper | https://en.wikipedia.org/wiki/Pine_Trees_screen |
| *de Blob* | Coloring a drained world as core gameplay (mechanic reference only) | https://en.wikipedia.org/wiki/De_Blob |
| three.js postprocessing (pmndrs) | Bloom, SMAA, tone mapping stack | https://github.com/pmndrs/postprocessing |

Dropped from the earlier draft: Hollow Knight (too dark-ink), Song of the Sea (too cozy-cartoon), Pleasantville (wrong era/register).

---

## 4. Lighting moods

Before: overcast autumn mist, low contrast, light coming from nowhere. After: **warm late-afternoon autumn sun**, long shadows, leaves backlit like stained glass.

| Parameter | **Pre-restore ("Pressed")** | **Post-restore ("Late Light")** |
|-----------|-------------------------------|-----------------------------------|
| Key light | Diffuse overcast, warm-neutral `#E6DCC8`, intensity 1.5, elevation 55° | Low autumn sun, **3900 K** `#FFC98A`, intensity 2.6, **elevation 22°** (long shadows) |
| Fill / hemi | Sky `#D8C8A6` / ground `#3A2E24`, 0.9 | Sky `#F0CE96` / ground `#5A3A22`, 0.7 |
| Environment | Painted sepia sky (`src/render/sky.ts`), envIntensity 0.55 | Same sky with amber breaks and pale gold gaps, envIntensity 0.9 |
| Shadows | Very soft (radius 6), opacity 0.4, umber | Soft but directional (radius 3), opacity 0.6, cool contrast `#3A3350` against the warm key |
| Fog (height + distance) | `#D8C8A6`, density 0.013. A dusty cloud sea fills the void | `#F0D9AE`, density 0.008, sun-shafted. Distant islands still fade |
| Bloom | Threshold 0.9, strength 0.3 (only the fox and shrines glow) | Threshold 0.8, strength 0.5, **rust-tinted bloom edges** |
| Exposure (ACES) | 0.92 | 1.05 |
| Atmosphere | Slow-drifting dust and paper flecks; leaves hang still in the air | Falling leaves, ember motes, a few birds heading south |
| Vignette | 0.4 (paper-edge texture, foxing spots) | 0.2 |

The contrast between these columns *is* the payoff. **Transition:** all of these lerp over the flood's 6 s, keyed to the flood-front radius (local) and then globally. The sun visibly *sinks* toward its post-restore elevation during the flood.

---

## 5. VFX language

Restrained and warm. Every effect is either **ember** (light, heat, sparks), **leaf** (falling, drifting maple leaves), or **wash** (watercolor bleed of autumn color). No rainbow trails, pollen parties, confetti, or sparkle stars.

### 5.1 Fox aura and trail (temporary): the ember wake
- **Aura:** 3.0 m radius in the world mask with a **noise-broken watercolor edge** (FBM threshold, 0.4 m feather). Inside it, albedo returns to authored autumn color at 80% saturation.
- **Trail ribbon:** camera-facing ribbon, 0.35 m wide, 2.5 s life, tapering, smoke-and-ember alpha texture. Colored by the ember ramp, from rust at the tail to gold where it's fresh.
- **Ground stain:** trail samples write into the mask (64-sample ring buffer). Each stain warms outward from 0.5 → 1.6 m over 0.25 s and decays over 3.5 s. Decay reads as **color fading back to sepia from the edges, like a photograph aging** (noise-eroded), not a uniform fade.
- **Motes:** 20 ember particles/s while moving, 2× during dash, plus 2 leaf cards/s kicked up from the ground. Additive embers, 0.8 s life, rising slowly.
- **Dash:** a heat-shimmer smear plus a 2-frame ember afterimage.

### 5.2 Ember Burst
- 0.0 s: the fox's wisps flare gold (2 frames), hit-stop 50 ms.
- 0.05–0.3 s: a ring of warm light expands to 6 m with a **watercolor-bleed edge** and a ring of leaves lifted off the ground. Inside it, color returns at 100%.
- Holds 6 s, then fades back to sepia from the edge inward.
- Ghost-ink objects in range "ink in": sketched outlines fill solid in 0.15 s.

### 5.3 Seedwell (local)
- The stone seal cracks and warm light leaks through (emissive lines).
- An 8 m column of embers and leaves, then a **flood front** expanding to 30–40 m at 25 m/s.
- The front edge is a 2 m band: **warm light** leading (`#FFC98A`, emissive 1.2), saturated autumn behind it, and a curtain of leaves finally *falling* (they hung still before).
- Leaves a permanent **color river** (2 m wide, UV-scrolled amber ribbon of floating leaves) running toward the main Wellspring.

### 5.4 Wellspring flood (main)
| t | Event |
|---|-------|
| 0.0 | Silence. The seal shatters into sepia-ink shards that turn into maple leaves mid-air |
| 0.3 | 60 m column of warm light, god rays through the haze (screen-space, 0.5 strength) |
| 0.5–4.5 | Flood front at **40 m/s** from (0, −85) across the realm, with the band from §5.3 scaled to 4 m |
| 0.5–6.0 | Lighting lerps pre → post (§4). The sun drops to 22°. Bloom swells by +0.25 at the 2 s peak |
| 1.0–5.0 | Events triggered by radius: grass turns gold and bends, windmills begin to turn, every held leaf in the realm starts falling, birds lift off and head south (80 boids, slower, in a long V) |
| 6.0 | Settles to a steady leaf-fall. Restored mask written to the save |

---

## 6. Materials (three.js notes)

### 6.1 Approach: **soft PBR with stylized lighting** (not hard toon)
- Base: `MeshStandardMaterial` / `MeshPhysicalMaterial`, extended with `onBeforeCompile` chunks:
  1. **World color mask** from `ColorField` (`src/render/colorField.ts`): aura + trail samples (`TrailSample`) + `restore(center, radius)` regions → saturation factor. **Retint task:** swap the cool ink split-tone for a sepia toning curve (luma → `sepia-ink … paper-hi` gradient map) and add a 15% chroma cap.
  2. **Wrap diffuse + soft 3-band ramp** (`smoothstep` bands with 0.15 softness) for a painted look while keeping PBR spec and env response.
  3. **Paper grain + foxing:** triplanar paper-fiber texture modulating albedo ±4%, and sparse age spots in the sepia state only.
  4. **Sepia-wash shading:** in shade, blend albedo toward `sepia-dark` with an FBM noise mask (blotchy brushwork) at 25%.
- Roughness 0.65–0.9 for nature, 0.4 for wet/shrine stone. Metalness 0 everywhere except shrine bronze and maple seals (0.8).

### 6.2 Special materials
| Material | Notes |
|----------|-------|
| **Fox** | Body: burnt-orange fur (shell fringe, 8 shells), wrap 0.5, warm rim `#F08A2A` at 0.35. Spirit (ear tips, tail wisps, fringe): additive emissive flame cards sampling the ember ramp, flow-noise UV scroll, embers and leaf flakes from `wisps.ts`. **Everything bypasses the mask** |
| **Ash creature** | Matte-to-satin sepia-black (roughness 0.5), cracked surface with faint inner ember-less hollowness (dark interior, no glow), flakes shedding as vertex-animated cards, pale paper eyes (emissive 0.6) |
| **Ink pool** | Planar glossy sepia-black, slow ripple normals, faint paper reflection, a few dead leaves floating on it |
| **Ghost-ink** | Unlit sketched sepia outline (screen-space dash on the edge mesh) when inactive; fills to standard material when colored |
| **Shrine stone** | Pale weathered ruin-stone (key art arches and dome) with an emissive crack mask; ensō carving with a **copper maple-leaf inlay** that lights at activation |
| **Foliage cards** | Alpha-to-coverage + SMAA. Pre-restore leaves are **frozen** (sway 0.02 m: the world is pressed); post-restore sway 0.15 m and leaves detach and fall |

### 6.3 Outlines
- Proposed: **post-process ink edges** (depth + normal Sobel), 1.5 px at 1080p, color `sepia-ink`, with **line weight varying by depth** (thicker near, thinner and paler far, like a brush).
- In restored zones outlines **tint toward the region's secondary hue** at 60% (W1: deep russet), so lines go from "sepia ink" to "colored pencil."
- The fox has no outline (its ember rim separates it).

### 6.4 Renderer stack
WebGL2 · `ACESFilmicToneMapping` · sRGB output · soft shadows (PCFSoft or VSM, 2048 map) · height fog · post stack in `src/render/postStack.ts` (SMAA, bloom on fox/shrine, ACES, vignette, paper overlay, plus a **sepia grade LUT** and ink edge to add). SSAO optional. **Target 60 fps on a laptop at 1280×720** (lookdev brief), with a fallback that drops the edge pass and halves bloom resolution. SwiftShader is for visual review only, not perf numbers.

---

## 7. UI, collectible and shrine motifs

Quiet, sparse, diegetic. Hand-lettered on paper; nothing bouncy.

| Element | Motif | Spec |
|---------|-------|------|
| HUD frame | **None.** Diegetic first | Embers (Spark) and leaves (health) are tail-tip glows on the fox |
| Ember counter | Brush-stroke ensō with a single ember inside. Appears 3 s after pickup, then fades | Bottom-left, 44 px, number in a hand-lettered serif |
| **Ember mote (1)** | A small floating coal of light with a faint ash halo | Ember ramp, slow drift (bob 0.08 m), soft flicker; no spin |
| **Leaf mote (5)** | A single glowing maple leaf, turning slowly in the air | Russet → gold, rotates 45°/s, sheds a spark now and then |
| **Maple seal (25)** | A palm-sized bronze disc with a maple-leaf relief, like a wax seal | Copper metal + ember glow in the relief. Hums quietly |
| **Ash mote (sleeping, 5)** | A dull gray cinder with a hairline crack | Wakes into a leaf mote inside the aura |
| **Seedwell icon** | Ensō circle with a maple seed (samara) | Sepia = unlit, amber-filled = lit |
| **Wellspring icon** | Double ensō with a spiral | Map and pause screen |
| Lost Kit icon | Tiny fox silhouette in sepia ink | Filled with the ember ramp when found |
| Checkpoint lantern | Paper lantern with an ink-brush glyph (original, non-linguistic) | Lights with a single warm flame |
| Pause / map | **The Scribe's Album**: hand-drawn sepia map pages with pressed leaves. Restored regions are painted in autumn watercolor | Page-turn transition 0.5 s |
| Prompts | Brush-written glyphs in an ink circle | Fade in 0.25 s, never more than 1 on screen |
| Fonts | Quiet humanist serif (title) + clean humanist sans (body) | Title letters in sepia ink with an ember underglow |

---

## 8. Quality bar checklist (visual review)

- [ ] 3-value thumbnail test passes for every checkpoint vista
- [ ] The fox (body + wisps) is the most saturated pixel cluster in every pre-restore frame, **and** reads against an orange-brown background
- [ ] Side-by-side with `img/world-keyart.jpg`: warm haze, paper grain, sepia ruins and crumbling undersides match
- [ ] Side-by-side with `img/fox-turnaround.jpg`: proportions, narrow amber eyes, umber legs, ember tail match. No smile, no chibi
- [ ] Ember wake is visible and beautiful at 30 m camera distance
- [ ] No pure `#000` or `#FFF` in world albedo. Pre-restore world chroma ≤ 15%
- [ ] No rainbow, cyan, magenta or pastel anywhere in W1
- [ ] The flood reads as "autumn coming back" (warm wash, falling leaves, sinking sun) and not "fade" (uniform lerp)
- [ ] Restored frame passes the 70/20/10 saturation rule
- [ ] Ash creatures are readable by silhouette alone in both moods
- [ ] The frame feels **quiet**: would it work as a still on a wall?
