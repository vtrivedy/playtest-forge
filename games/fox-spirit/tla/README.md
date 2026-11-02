# TLA+ models (The Keeping)

| Spec | System | Check | Last synced |
|---|---|---|---|
| `Finale.tla` | Scribe's Press finale (`src/opening/finale.hot.ts`, DESIGN-finale.md) | `tlc -workers 2 -config Finale.cfg Finale.tla` → 366 distinct states, no error | sw4-wren first finale commit |

Proven able to fail: dropping `settled` from `Kindle` violates `Safe`; making `Advance` wait on the ember violates `EndsOnce`.
Code mapping: TLA `phase` = `PHASES[rig.s.phase]`; TLA kit `trotting` covers code `drifting` + `trotting`; `card` hidden/showing/done = `rig.s.card` 0/1/2.
