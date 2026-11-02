---------------------------- MODULE Millrace ----------------------------
(* Millbrook's race (src/opening/millrace.hot.ts): a leaf dam holds the brook; a dash near it      *)
(* bursts it; the water front then runs down the dry bed; once it reaches the wheel the wheel       *)
(* turns and the valley paints once. Nothing un-flows, un-turns or paints twice.                    *)
(* front is the water front in brook sections: 0..D is the pond held behind the dam at D.           *)
EXTENDS Naturals
CONSTANTS D, W, N        \* dam section, wheel section, last section (D < W < N)
VARIABLES dam, front, turning, painted, kiln, reached
vars == <<dam, front, turning, painted, kiln, reached>>

Init == dam = "held" /\ front = D /\ turning = FALSE /\ painted = FALSE /\ kiln = "cold" /\ reached = FALSE

\* the fox dashes through the dam (any number of times; idempotent once burst)
Dash == /\ dam' = "burst" /\ UNCHANGED <<front, turning, painted, kiln, reached>>
\* the front runs on down the bed (automatic)
Flow == /\ dam = "burst" /\ front < N /\ front' = front + 1 /\ UNCHANGED <<dam, turning, painted, kiln, reached>>
\* water at the wheel: it turns and the valley paints, in one step (the same frame in code)
Turn == /\ front >= W /\ ~turning /\ turning' = TRUE /\ painted' = TRUE /\ UNCHANGED <<dam, front, kiln, reached>>
\* the bellows (worked by the turning wheel, millWeir.hot.ts) bring the kiln up; once lit it stays lit
Kindle == /\ turning /\ kiln = "cold" /\ kiln' = "lit" /\ UNCHANGED <<dam, front, turning, painted, reached>>
\* the fox rides the kiln's warm air onto the Weir (only a lit kiln lifts that high)
Reach == /\ kiln = "lit" /\ ~reached /\ reached' = TRUE /\ UNCHANGED <<dam, front, turning, painted, kiln>>
\* the fox wanders; nothing changes
Idle == UNCHANGED vars

Next == Dash \/ Flow \/ Turn \/ Kindle \/ Reach \/ Idle
Spec == Init /\ [][Next]_vars /\ WF_vars(Flow) /\ WF_vars(Turn) /\ WF_vars(Kindle)

TypeOK == dam \in {"held", "burst"} /\ front \in D..N /\ turning \in BOOLEAN /\ painted \in BOOLEAN
          /\ kiln \in {"cold", "lit"} /\ reached \in BOOLEAN
Inv ==
  /\ TypeOK
  /\ (dam = "held" => front = D)          \* no water past the dam while it holds
  /\ (turning => front >= W)              \* the wheel only turns with water at it
  /\ (painted <=> turning)                \* the paint comes with the wheel, exactly once
  /\ (kiln = "lit" => turning)            \* no warm air without the bellows
  /\ (reached => kiln = "lit")            \* the Weir is reached only by the kiln's lift

\* once burst, the brook eventually runs its whole length and the wheel turns
Restores == (dam = "burst") ~> (front = N /\ turning /\ kiln = "lit")
\* nothing goes back
Monotone == [][/\ front' >= front /\ (turning => turning') /\ (dam = "burst" => dam' = "burst")
              /\ (kiln = "lit" => kiln' = "lit") /\ (reached => reached')]_vars
=============================================================================
