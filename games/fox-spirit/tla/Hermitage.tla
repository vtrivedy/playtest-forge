---------------------------- MODULE Hermitage ----------------------------
(* The Hermitage's drying lines (src/opening/hermitage.hot.ts): running under a pegged line frees it   *)
(* (idempotent); when every line is free the plateau paints, once. The desk caption shows once.      *)
EXTENDS Naturals, FiniteSets
CONSTANTS Lines
VARIABLES freed, painted, captioned
vars == <<freed, painted, captioned>>

Init == freed = {} /\ painted = FALSE /\ captioned = FALSE
\* the fox runs under line l (already-free lines do nothing)
Free(l) == /\ l \notin freed /\ freed' = freed \cup {l}
           /\ painted' = (freed' = Lines)
           /\ UNCHANGED captioned
\* the fox reaches the desk
Desk == /\ ~captioned /\ captioned' = TRUE /\ UNCHANGED <<freed, painted>>
Idle == UNCHANGED vars
Next == (\E l \in Lines : Free(l)) \/ Desk \/ Idle
Spec == Init /\ [][Next]_vars /\ \A l \in Lines : WF_vars(Free(l))

Inv ==
  /\ freed \subseteq Lines
  /\ (painted <=> freed = Lines)          \* paint exactly when the last line goes
\* freeing and painting never undo; caption never retracts
Monotone == [][/\ freed \subseteq freed' /\ (painted => painted') /\ (captioned => captioned')]_vars
\* if the fox keeps running the lines, the plateau paints
Paints == <>painted
=============================================================================
