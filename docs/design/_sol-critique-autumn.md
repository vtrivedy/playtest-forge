## Verdict

**Blocking: the autumn pivot is locked in `ART_LOCK.md`, but the supplied design set has not caught up.** `docs/design/art-direction.md` still specifies the cream-and-rainbow fox and green restoration fantasy.

Three requested documents are missing: `docs/design/story.md`, `docs/design/game-design.md`, and `docs/design/world-1.md`. Their story, progression, collectible arithmetic, and W1 naming cannot be reviewed. This is an incomplete review package, not evidence those areas are consistent.

## Must-fix (blocking)

- **`docs/design/art-direction.md` → “Fox”:** Change “cream / off-white body,” “plush readable silhouette,” “rainbow wispy tail,” and “golden chest emblem” → **lean burnt-orange quadruped, umber legs, cream chest, narrow amber eyes, ember-and-leaf dissolution at ears and tail**. Remove the unsupported emblem and head-flame tuft.
- **Same file → “Mood” and “Palette”:** Change “living prism,” “lush saturated greens,” and magenta/cyan wildflowers → **living hearth; rust/crimson foliage, golden grass, copper light, falling leaves**. The current instructions would reproduce the rejected direction.
- **Same file → “Monochrome”:** Change cool charcoal grayscale → **faded photographic sepia with warm paper lights and restrained brown shadows**. Specify the starting state separately from restored autumn.
- **Missing `story.md`, `game-design.md`, `world-1.md`:** Supply the actual revised documents before approving narrative or progression. A visual retint cannot establish that the Spyro-like exploration structure survives.
- **`art-direction.md` → “Color restoration”:** Change the effect-only list → **explicit temporary/permanent state rules**: aura radius, trail lifetime, shrine region boundaries, persistence, and activation condition. The emotional payoff depends on players understanding what they have saved.

## Should-fix

- **`art-direction.md` → “Lighting & post”:** Change “concept is misty, not harsh golden hour” → **warm diffuse amber illumination through cream haze, with restrained shrine/ember bloom**. The replacement key art contains pronounced warm light; the current cool-fill prescription fights it.
- **Same file → “Color restoration”:** Change “optional flower flecks” → **leaf litter stirring, drifting maple leaves, and sparse embers**. Tie restoration to autumn’s material identity.
- **Same file → “Mood”:** Change “paper grain everywhere” → **subtle grain that preserves distant landing silhouettes and the fox’s outline**. Texture density must serve traversal readability.
- **`games/fox-spirit/DESIGN.md` → “Feel target”:** Change unqualified “landing squash / takeoff stretch” → **restrained anatomical compression, shoulder motion, and tail follow-through**. Broad mascot deformation would undermine the locked fox.
- **Same file → “Core verb”:** Change “Stalk” → **specify quiet idle/exploration posture alongside responsive running, jumping, dashing, and gliding**. Mystery should come from performance and pacing, without making traversal sluggish.
- **Future `world-1.md` → restoration reveal:** Define a composed before/after vista and a traversal route that revisits it. Permanent color needs a memorable spatial consequence, beyond a shader transition.

## Consistency bugs (names, gem→ember math, W1 Verdant leftovers, cute tone leftovers, ability name collisions Ember vs Kindle)

| File + section | Change X → Y |
|---|---|
| `art-direction.md` → title; `ART_LOCK.md` → title | “Color Fox” → one agreed working title; `docs/vision.md` already uses “Autumn Fox.” |
| `art-direction.md` → “Primary refs” | `playtest-forge-artifacts/concept/...` → existing `assets/concept/...` paths. |
| Requested image references | Missing `docs/design/img/*.jpg` → existing `assets/concept/*.jpg`. |
| `games/fox-spirit/DESIGN.md` → “Win” | “Gems optional path juice” → “Ember/leaf motes guide optional exploration,” with explicit collection behavior. |
| `art-direction.md` → “Fox” | “plush,” rainbow energy, cream body → natural proportions, rust fur, quiet expression. |
| `art-direction.md` → “Palette” | Green ground and magenta/cyan/violet spirit colors → locked autumn palette. |

**Gem→ember math:** No collectible totals, denominations, costs, or completion thresholds are present in the available requested documents. Cannot certify conversion consistency.

**W1 Verdant leftovers:** Cannot check; `world-1.md` is absent.

**Ember vs Kindle:** Cannot check the intended ability taxonomy; the gameplay/story documents are absent. Reserve distinct terms for collectibles and abilities, and document each term’s meaning before propagation.

## Concept art alignment (ART_LOCK + images)

Both current images exist and were visually inspected under `assets/concept/`.

- **`ART_LOCK.md` → “Hero”: strong alignment.** The turnaround shows a slender quadruped, long muzzle, dark legs, restrained amber eyes, rust fur, and a dissolving flame tail. **`art-direction.md` must be rewritten to describe this image.**
- **`ART_LOCK.md` → “World”: strong alignment.** The key art supports cream atmospheric depth, ruined arches, twisted autumn trees, leaf-covered ground, and a warm fox against faded distant islands.
- **`art-direction.md` → “Color restoration”: unresolved visual specification.** The key art shows a richly colored foreground and faded distance, but cannot establish whether that boundary represents temporary aura, permanent restoration, or atmospheric perspective. Add a matched before/after specification.
- **`ART_LOCK.md` → “World”: add gameplay readability requirements.** The key art’s dense foliage and broken terrain are evocative, but do not demonstrate readable landing surfaces, glide distances, or route hierarchy. Translate the composition into playable geometry deliberately.
- **`ART_LOCK.md` → “Hero”: clarify effects restraint.** Change unrestricted ember wisps → **low-intensity idle smoke/leaves, stronger motion accents**. A continuously blazing silhouette could overpower the quiet, melancholic tone.

[Fox turnaround](assets/concept/fox-turnaround.jpg) · [World key art](assets/concept/world-keyart.jpg)

## Strongest ideas to keep

- **Temporary color versus permanent restoration:** a clear emotional distinction between passing through a place and caring for it.
- **A fully colored fox in faded sepia:** immediate identity and a readable visual promise.
- **Autumn as renewal:** more distinctive and melancholic than default green regrowth.
- **Floating ruins and distant silhouettes:** strong foundations for Spyro-like vistas, secrets, and return routes.
- **Natural fox anatomy with a supernatural tail:** enough magic to establish identity while preserving dignity.
- **Move, jump, dash, hold-jump glide:** a compact control vocabulary that leaves room to prioritize feel.
