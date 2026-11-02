---------------------------- MODULE RunawayPage ----------------------------
(***************************************************************************
 Spec of The Keeping's Runaway Page state machine
 (games/fox-spirit/src/opening/page.hot.ts).

 Real phases: perched | fleeing | flung | kept
 Real rule: three catches (one per stage 0..2) → kept.

 Abstractions (honest about scope):
  - Continuous space, winded timers, hop perches, and dash/pounce geometry
    are collapsed to discrete player actions.
  - "Fling after catch of stage 0 or 1" is the post-catch throw-to-next-stage.
  - Stage advances only on a successful catch while fleeing or perched.

 Properties we care about for Keeping:
  - TypeInvariant: phase/stage/catches stay in legal sets
  - CatchesMatchStage: catches always equals stage until kept
  - KeptOnlyAfterThree: phase = kept ⇒ catches = 3
  - EventuallyKept (liveness under WF of Catch): a player who keeps
    catching eventually keeps the page
  - KeptStable: once kept, stays kept
 ***************************************************************************)
EXTENDS Integers, TLC

CONSTANTS MaxStage  \* 2 in the game (stages 0,1,2 → 3 catches)

Phases == {"perched", "fleeing", "flung", "kept"}

VARIABLES phase, stage, catches

vars == <<phase, stage, catches>>

TypeInvariant ==
  /\ phase \in Phases
  /\ stage \in 0..MaxStage
  /\ catches \in 0..(MaxStage + 1)

\* In the code, after each catch: catches++; stage = catches (until kept).
CatchesMatchStage ==
  /\ (phase = "kept" => catches = MaxStage + 1)
  /\ (phase # "kept" => catches = stage)

KeptOnlyAfterThree ==
  phase = "kept" => catches = MaxStage + 1

Init ==
  /\ phase = "perched"
  /\ stage = 0
  /\ catches = 0

\* Fox approaches → page bolts
Spook ==
  /\ phase = "perched"
  /\ phase' = "fleeing"
  /\ UNCHANGED <<stage, catches>>

\* Fox backs off → page settles on a perch
Settle ==
  /\ phase = "fleeing"
  /\ phase' = "perched"
  /\ UNCHANGED <<stage, catches>>

\* Successful catch (dash/pounce contact). If last stage → kept; else flung toward next.
Catch ==
  /\ phase \in {"perched", "fleeing"}
  /\ catches < MaxStage + 1
  /\ catches' = catches + 1
  /\ IF catches' = MaxStage + 1
     THEN /\ phase' = "kept"
          /\ stage' = stage          \* stage stays at MaxStage once kept
     ELSE /\ phase' = "flung"
          /\ stage' = catches'       \* code: stage = catches after catch

\* Post-catch fling lands on the next stage's perch
LandFling ==
  /\ phase = "flung"
  /\ phase' = "perched"
  /\ UNCHANGED <<stage, catches>>

\* Stutter once kept (or anytime) — TLA+ specs are stutter-invariant
Stutter ==
  UNCHANGED vars

Next ==
  \/ Spook
  \/ Settle
  \/ Catch
  \/ LandFling
  \/ Stutter

\* Weak fairness on Catch: a player who can catch and never permanently refuses, does.
Spec == Init /\ [][Next]_vars /\ WF_vars(Catch) /\ WF_vars(LandFling)

Inv == TypeInvariant /\ CatchesMatchStage /\ KeptOnlyAfterThree

EventuallyKept == <> (phase = "kept")

KeptStable == [] (phase = "kept" => [] (phase = "kept"))

=============================================================================
