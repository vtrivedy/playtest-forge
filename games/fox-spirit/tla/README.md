# TLA+ models (The Keeping)

| Spec | System | Check | Last synced |
|---|---|---|---|
| `Finale.tla` | Scribe's Press finale (`src/opening/finale.hot.ts`, DESIGN-finale.md) | `tlc -workers 2 -config Finale.cfg Finale.tla` → 540 distinct states, no error (incl. hero lying/getting-up and NeverStuck: a held controller is always released; dropping WF(StoodUp) violates it) | sw4-wren first finale commit |

Proven able to fail: dropping `settled` from `Kindle` violates `Safe`; making `Advance` wait on the ember violates `EndsOnce`.
Code mapping: TLA `phase` = `PHASES[rig.s.phase]`; TLA kit `trotting` covers code `drifting` + `trotting`; `card` hidden/showing/done = `rig.s.card` 0/1/2.
| `Press.tla` | Scribe's Press, three levels incl. the Unpressed Stair (`src/opening/press.hot.ts`, DESIGN-sumiro-play.md) | `tlc -workers 2 -config Press.cfg Press.tla` → 54 distinct states, no error (TypeOK, Caused, Monotone, Finishes) | agent/sumiro-play |

Press negative control: `PressNoWarmRide.cfg` (warmth lost on the short draft ride) violates `Finishes` — the combine
cannot be solved without carrying warmth up the Inkstep draft.
