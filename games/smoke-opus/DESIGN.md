# Ember Mesa: smoke-opus

Pip is a small fox-dragon. It runs across a sunset sky-mesa made of sandstone and autumn
trees, and floats on teal wing-flaps it can only hold open for a moment. The game is original IP
with a Spyro-like spirit. This is a smoke slice: it proves the move/jump/glide/dash loop feels
good. It does not try to be a full game.

| Field | Content |
| --- | --- |
| **Core verb** | **Leap.** A punchy jump that feeds into a glide or a dash-leap. |
| **Controls** | WASD = move (camera-relative) · **Space** = Jump · **Shift** = Dash · Q/E = orbit camera |
| **Combos** | Hold Space in air while falling = **glide** (wings spread). Tap Space = short hop (jump-cut). Dash then Jump = **dash-leap** (keeps dash momentum). Dash in air = **air dash** (one per airtime, small lift). Dash while gliding = glide boost. |
| **Win** | Collect all **5 gems**. Timer shown, and best time is the score. |
| **Lose** | None. Falling off respawns you on the mesa (deaths are counted, gems are kept). |
| **Difficulty ramp (first 60s)** | Gem 1 is on the ground in front of spawn. Gem 2 floats at jump height. Gem 3 is on the raised terrace. Gem 4 sits on a sandstone pillar that you can only reach from the terrace. Gem 5 is on a floating islet across a gap that needs a glide or a dash-leap. |
| **Feel targets (Punchy preset)** | Apex ≈ 2.2 m · time-to-apex ≈ 0.38 s · full-jump airtime ≈ 0.7 s · glide sink ≈ 3 m/s · dash 22 m/s for 0.18 s (≈ 4 m) · ground 0 to max in ≈ 0.15 s. The jump is snappy and the glide is generous. |
| **Feel variations** | `?feel=punchy` (default), `?feel=bouncy` (reference-like, softer), `?feel=floaty` (low gravity, long glide). These are switchable live in lil-gui. |
| **Visual references** | Sunset mesa: warm key light, violet sky, peach fog, banded sandstone underside, coral/amber trees, glowing lanterns. Pip is tangerine with a cream belly, teal wings and horns, and an ember tail-tip that blooms. Each gem is a different jewel colour. |
| **Story beat** | "The lanterns of Ember Mesa went dark when the sky-gems scattered. Pip is small, but Pip can *leap*." |

## Physics notes
- `accel` is m/s² (it is not a lerp rate). That lets dash momentum carry into a jump, so the dash-leap combo comes out of it naturally.
- `glideDrag` damps vertical fall speed while gliding (terminal ≈ g·glideGravityScale / glideDrag). Horizontal speed is preserved, so the glide feels powerful.
- Extra tunables: `fallGravityMul` (heavier fall), `jumpCut` (release-early multiplier), `glideSpeedMul`.
- Fixed 120 Hz substeps, so feel metrics stay honest under slow SwiftShader frames.
