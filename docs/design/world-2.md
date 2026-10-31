# World 2 — Ashwater Reach

Status: playable graybox / reversible-water revision, visual review in progress. Owner: levels-sol, sprint 2.

## Quick reference

- Region: beyond the Wellspring's east causeway; cool slate drowned orchard and broken aqueducts in warm mist.
- Type: exploration / environmental puzzle / waterborne traversal.
- Play time: first slice 3–4 min; full realm target 12–15 min. Difficulty 4/10.
- Prerequisite: World 1 Wellspring flood; existing move, jump/hold glide, dash. No extra input.
- Art: still dark teal-umber mirror water, low mist, sparse half-submerged alder and willow silhouettes, cool shadow and warm copper rim light. This continues the locked autumn palette; the earlier Frost realm proposal remains deferred.

## Questions answered and choice

Player fantasy: make a stranded landscape start carrying the fox. Already shipped: color-fed heat, wind, water fronts, growth and Shade drain. New slice must recombine these without waiting for new fox animation.

Options: (1) a frost realm adds art/thermodynamic scope too early; (2) a bigger wind canyon repeats World 1's lift/glide; (3) **Ashwater Reach, recommended**, makes water change elevation through buoyancy. The same rule now moves a landing beneath the paws. The player can wait on the raft or use the growing height for a shorter glide; no scripted launch trigger.

## Narrative / mood

The orchard was flooded when its aqueduct stopped breathing. Ferrymen's stone bowls sit above motionless copper water. A high bell-tower holds one bent willow. Bringing water back raises an old ferry and lets the player see the drowned lanes below. Emotional arc: cautious approach → rising perspective → quiet release.

## Layout

World coordinates: +x east, −z north. First slice centered (120,−118), floor y30. The causeway is66m with a LOW-only lower fork beside the basin. Wellspring summit is (0,−89), y38.

```
W1 summit [S] == east causeway == [G] flood-open arch
                                   |
                            arrival shelf y38 [!]
                                   | permanent stair
                         [H] cold spout — flume >>> [F] basin / raft y30→36
                                   |                    |
                        [?] dry listening tunnel      [W] bell shrine y36
                                                        |
                                      [B] permanent raised ferry → orchard [E]
```

### Critical path, first slice

1. After the valley flood, an east-facing arch opens onto a broad causeway. The bell tower and its suspended ferry are visible through it. Continuous permanent collision connects back to W1; no scene reload or teleport.
2. Arrival shelf previews a raft resting on its dry cradle 6 m below the shrine ledge. Descend a permanent stair to the spout. A visible stone flume joins source to basin.
3. Color the frozen source by running beside it or dashing through it. A front travels along the flume; only arriving water fills the basin. Water raises three timber bodies together by6m in2.5s after arrival. Dash supplies the source long enough to board; running the bank and timing the returning front remain valid.
4. Board the ferry from its cradle. Ride the height, then step/jump to the shrine ledge. Misses land on basin stone, not an invisible hazard.
5. The basin's water level feeds the bell shrine for2s at the upper notch. It latches: the source flows forever. Dash a linked sluice handle on either bank or bell ledge to switch LOW/HIGH at any time; restoration preserves this choice. HIGH connects floating timbers; LOW reveals the sunken lane and steam shortcut. The shrine is fed by water, never by fox proximity.

### Optional paths / reasons to explore

| Path | Access | Reward | Spatial hint |
|---|---|---|---|
| Dry tunnel behind source | Before or after restore, side opening above water | Listening niche and view into the moving flume | Water sound behind a broken grate; no pickup glint |
| Ferry at half height | Time a jump/glide during the rise | Side balcony with an old orchard map relief | A copper-leaf willow glimpsed through an arch |
| High return | After shrine | Glide from bell ledge to arrival shelf | Streaming leaves point back; walking stair remains |
| Drowned orchard (later) | Permanent high ferry | Next puzzle about choosing between two basin destinations | Two broken aqueduct silhouettes, distinct bells |

## Restoration systems

| ID | Location | Pre-restore | Permanent verb | Traversal | Teach ≤30 s? |
|---|---|---|---|---|---|
| Reach bell | Basin upper notch | Frozen source, grounded ferry | Source remains supplied; sluice controls whether basin fills or drains | Choosing LOW/HIGH alternates a sunken route and a floating route | Target: source/front/raft visible in one frame |

**Twist: buoyancy.** Fill is stored output, not a new color source. The basin receives the water front and its tail using existing water timing. If supply ends, warn for ≥0.8 s before draining. If occupied, retain the ferry at its current height until the fox lands on stable ground; retained height never fills the shrine seal. Do not add elemental conduction or let a retained platform simulate active water.

## Encounter

One Shade drinks from the basin on an authored patrol. While present it opposes filling; dash through it frees the animal. A boarding dash can both reach the timber and free it. No kill or extra attack input is required; timing supply around its pass is valid. Water already in transit continues arriving.

## Pacing

| Minute | Beat | Wonder / challenge |
|---|---|---|
| 0–1 | Causeway, tower silhouette, see ferry beneath shrine | 2 / 1 |
| 1–2 | Color source, front reaches basin, first ride | 4 / 4 |
| 2–3 | Sustain water / time boarding, reach bell ledge | 5 / 6 |
| 3–4 | Permanent raised route; optional niche or return vista | 6 / 2 |

## Leading elements and recolor

The bell tower is a single tall silhouette in a horizontal wetland. Lighter flume walls point from spout to dark basin. The raft's pale timber rim separates from umber water; a carved notch shows its destination. Restore reveals copper reflections, rust reeds and sparse copper leaves. Warm leaf drift replaces glitter. The fox remains the strongest saturation cluster.

## Scope and acceptance

First slice only: causeway + flood gate, source/front, one rising ferry, one water-fed shrine, safe return and one niche. Reversible LOW/HIGH, three timber bodies, the basin Shade, and the low-water steam shortcut are part of this slice. Full two-basin routing and larger orchard expansion remain later work.

- [ ] DESIGN.md updated before game code.
- [ ] Real input from W1 summit reaches first slice with no teleport.
- [ ] First 30 s after arrival shows source → moving front → rising landing.
- [ ] Record water arrival, fill, raft height, occupied retention, seal and latch on `__game.reach`.
- [ ] Water ends: visible warning, occupied platform retained, no false latch.
- [ ] Shrine unlocks a permanent movement route; zero orb or shrine-count gate.
- [ ] GPU video + stills inspected; fix concrete failures and retest.
- [ ] Opus critique after ~15:30; no visual-quality approval from build alone.

Kill tests: color stays because arriving water sustained the upper basin notch; restoration changes the route and ferry height. The player can solve by sustained aura or a dash stroke and choose when to board. Falling costs seconds, not an irreversible puzzle state.

## Revision after Opus critique15:35 — reversible water is the world state

This supersedes the one-way ferry ending above. The shrine makes the source permanent; it does **not** lock water HIGH. A visible sluice with linked handles on the source bank and bell ledge toggles LOW/HIGH when dashed, using the existing brush action. It can always be reversed.

- **HIGH:** three timber bodies float by the same fill fraction. Ferry + two timber stepping stones connect to the bell. The high arrival view shows the submerged lane and its low doorway beneath the water, plus a second bell islet that is jump/glide/air-dash reachable.
- **LOW:** timber settles on permanent cradles, and the sunken lane / ferryman's niche becomes accessible. The niche is deliberately under the high-water line: drain after filling to discover it. A dash-fed steam vent in the shallow low-water puddle provides a short updraft back toward the bell ledge, a traversal payoff and return shortcut. It uses existing updraft/glide; high water suppresses the vent.
- **Tension:** one Shade crosses the basin and drinks its fill down while present. Free it with dash, time the refill between passes, or keep the source supplied. Restoration protects permanent access; it does not erase the low/high choice.
- **Timing:** fill the6m basin in≤3s once water arrives. The choice, boarding, changing routes and draining for the secret are the play; waiting is not the centerpiece.
- **Identity:** still dark teal-umber water, warm copper rims, cool shaded surfaces, low mist over the water and half-submerged willow silhouettes. No cyan or neon. Pale fixed basin piers and high-water marks make motion legible.
- **Reveal:** the bell ledge looks across a second aqueduct to a lower orchard islet; the first slice ends in a reachable place with another view, not a door to future content.

Acceptance now includes one arrival frame showing source, bell and a low-only destination; three visible buoyant bodies rising; `__game.reach.level`; HIGH→LOW→HIGH real dash input, a low-lane traversal / shortcut, and a recovery checkpoint within10s of a boarding miss. Retaining an occupied float never counts as water at the shrine inlet.

Closing the sluice for HIGH sends water down the short flume again: a1.8s transit delay before the2.5s rise gives the fox time to board after restoration. LOW drains in1.67s after its1s warning. This keeps the ferry re-boardable after a fall; the source-bank checkpoint avoids replaying the long causeway.

Spatial revision16:45: shortened causeway136→66m, basin shifted70m toward the summit; a lower fork joins the sunken lane when LOW. Four orchard trunks and a timber roofline cross the waterline. Reach-only water supplies deep teal depth, soft sky reflection and a broken tide edge. Local cistern banks meet HIGH water; the west boarding gap and south LOW lane remain broken spillways. Sparse original willow/alder geometry, reeds and grey wet masonry replace the W1 maple kit. Visual-only hull heave leaves deterministic collision unchanged. HUD names Ashwater Reach and shows LOW/HIGH.


Sprint 3 scoped design and acceptance: [ashwater-sprint3.md](ashwater-sprint3.md). Cool slate and sparse willow silhouettes supersede earlier rust-maple identity prose. Copper remains an accent, with the fox the strongest saturation cluster.
