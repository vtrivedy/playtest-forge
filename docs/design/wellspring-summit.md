# Wellspring: The Listening Crown

Status: design / proposed playable extension. Sprint 2, levels-sol.

## Quick reference

- Region: beyond Russetvale's Wellspring, on its north-west back cliff.
- Type: traversal / restoration puzzle / quiet encounter.
- Play time: 3–5 minutes; difficulty 4/10.
- Inputs: existing move, jump/hold glide, dash. No new ability or resource.
- Fantasy: find where the valley's breath went, then bring it home.

## Choice and constraints

The existing brief allows either a second biome or the summit. Three candidates:

1. Frost realm: strongest long-term contrast, but adds a new palette, thermodynamics and hub transition before World 1 has a working finale.
2. Ash Warden arena: powerful climax, but animation, boss readability and reset logic exceed this stream's safe scope.
3. **Listening Crown (recommended):** a compact ruin reached by a visible descending stair from the summit; recombine existing heat and wind into a return flight. It remains autumn, uses the shipped controller, and makes a destination beyond the current final platform.

The extension must not take ownership of World 1 growth or replace the other level stream's summit repair. Its entrance is always physically reachable from the summit; finishing it must not be required for World 1's flood. No entrance keyed to three shrine counts.

## Narrative / mood

An empty bell hangs inside a split stone crown. The Keeping froze its breath. A single curled maple beside it still faces the valley. Restore the crown and wind carries leaves back toward the Wellspring. Quiet recognition, no victory counter.

## Layout

Coordinates use the World 1 frame (+x east, −z north). Heights are feet heights.

```
                    N
           [?] listening seat
                 |  y38
        [W] crown bowl y34 ---- [B] return wind ----> summit y38 [E]
                 |
       [!] split crown / hearth y29
                 |
         [U] lower hearth y24
                 |
       [S] descending stair from summit's west arch y38
```

A compact terrace chain bends west from the summit (-8,-88), then north to a crown outside the main island rim. Broad permanent rock shelves sit below the playable flight. The crown must be visible from the summit arch before a player descends. Flight surfaces use light tops against dark undersides; foliage frames the edge.

### Critical path

1. From the summit arch, see the split crown and stationary leaf curl. Walk down a permanent 3 m wide stair to the lower shelf.
2. Brush a cold hearth. Jump and hold to ride its column to the crown's middle shelf, 5 m above. A safe lower shelf catches misses.
3. A second hearth sits below the crown bowl. Light it with aura or dash; heat reaches the bowl for 2 s and latches it. Do not require the fox to stand inside a shrine trigger.
4. The latched crown permanently lights its hearths and wakes an inward wind stream. Glide back to the summit, arriving above the west arch; walk back down if preferred.

### Optional routes

| Path | Access | Reward | Hint |
|---|---|---|---|
| Outside stair | Always | Safe return, ability to inspect columns from their side | Lighter stone treads, continuous hand-height ruin fragments |
| Crown's back shoulder | After upper lift | A listening seat looking across Russetvale | One dry maple moving only after restoration |
| Low catch shelf | Missed glide | Recovery in <10 s | Broad lit top; same hearth visible above |

## Restoration systems

| ID | Location | Before | After / verb | Change | Teach ≤30 s |
|---|---|---|---|---|---|
| Crown | Upper bowl | Ash bowl, frozen leaf curl, silent wind | Existing heat feeds bowl for 2 s; restore makes heat and inward wind permanent | Return glide gains horizontal support and a higher arrival | Yes: light hearth; watch lifted leaves reach bowl |

Twist: World 1's elements now make a round trip. The descent previews the return current's endpoints. Heat gets the fox high; restored wind gives it distance. No new button or reactor-to-reactor conduction rule. The shrine's latch explicitly enables its named wind current, as SW1 does.

## Encounter

One Shade patrols the upper hearth shelf. Its drain threatens temporary heat. Dash through the hearth to paint a strong stroke, or free the Shade then take time. Keep the shelf wide enough to circle its 3 m drain. No combat arena wall, score or forced kill. Reuse the encounter module rather than new enemy behavior.

## Pacing

| Time | Beat | Intensity |
|---|---|---|
| 0:00–0:30 | Crown framed through the summit arch; descend | 2 |
| 0:30–1:10 | First upward ride, safe catch | 4 |
| 1:10–2:00 | Upper heat + Shade, shrine latch | 6 |
| 2:00–2:40 | Return flight above the path just walked | 5 |
| 2:40–3:30 | Optional seat / valley vista | 1 |

## Color and leading elements

Sepia limestone and umber roots, burnt copper bowl, muted rust maple. Restoration warms the crown's leaf canopy and sends copper leaves along the wind path. The fox remains the most saturated cluster. Avoid green growth, blue magic, excessive gold bloom and floating goal markers. Stone crown silhouette pulls outward; streaming leaves pull home.

## Safety and acceptance

- Permanent stair back from every shelf; no one-way pit.
- Temporary heat never removes collision. All permanent landing surfaces are 3 m or wider.
- Every column miss catches ground ≤6 m below the launch and returns in ≤10 s.
- Shrine seal reads only its named hearth output, never fox proximity.
- Shrine saves its latch; reload keeps the new return route.
- Telemetry: `__game.crown` reports seal/fed/restored, hearth IDs and return current heat.
- GPU keyboard/stick capture: walk from summit into extension, ride both columns, latch from real supply, return to World 1; retain video, two stills and state.
- Inspect visuals, patch the worst failure, capture a second time. No approval claim from design or build alone.

Kill tests: color stays because the bowl received sustained heat. Restoration adds a permanent return flight. No collectible gate. The critical visual relationship is hearth → lifted leaves → bowl, then bowl → wind → home.

### Flood boundary

The Crown is a separate color region beyond the valley's reach. It shares the fox's temporary aura, trail and dash strokes, but only its own inlet restores its masonry and reactors. Russetvale's global flood must not solve this next space remotely. Its small region mask uses the same ColorField implementation. This is a region boundary, not a new immunity rule for objects in Russetvale. The entry landing stays level until it clears the hill's nested collision boxes; only then does the stair descend.
