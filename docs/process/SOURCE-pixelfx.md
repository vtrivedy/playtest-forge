# Source: patch-gg/pixelfx (MIT)

We **did not** adopt the pixel-art library, painter API, sprite sheets, or the 232
effects as runtime code. Soft gentle animated realism (Ghibli / Ori / BotW warmth)
is the opposite of hard pixel ramps.

## What we took

The **draft → render contact sheet → look → fix worst defect → re-render** loop
from [pixelfx](https://github.com/patch-gg/pixelfx) (MIT, © 2026 Patch; method from
[Hugo Duprez](https://www.spritefusion.com/blog/how-to-make-good-pixel-art-effects-with-claude),
MIT). Also: seeded RNG for comparable sheets, separate body vs additive glow
control, and mechanical checks (one-shots end empty, loops seam-free, frame budget).

Adapted skill: `.claude/skills/vfx-lookdev-loop/`.

Judges (sprint 2 triage): Opus → `ADOPT_LOOP`; Sol → `ADOPT_LOOP_AND_TECHNIQUES`.
Reconciled: adopt the loop + those techniques; no pixelfx runtime dependency.

## License notice

If any pixelfx source is later copied (unlikely), keep the MIT notice and Hugo
Duprez attribution per their NOTICE.md. The skill text below is original for
playtest-forge and only credits the method.
