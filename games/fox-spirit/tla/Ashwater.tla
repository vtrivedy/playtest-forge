------------------------------- MODULE Ashwater -------------------------------
(***************************************************************************
 Ashwater Reach (src/opening/ashwater*.ts, DESIGN-ashwater.md): world II.
 Regions run landing -> reed -> mill -> (islet) -> plateau -> ledge.
   Low Sluice  (teach):   dash dam A on the landing bank -> channel drains;
                          crossing to Reed Island completes teach and earns Reedskim.
   Reed Pond   (develop): reed mats exist only with Reedskim; crossing to the
                          Mill Shore completes develop.
   Weir Heart  (combine): mats to the islet, dash dam B -> pool drains -> steps
                          to the plateau -> glide to the Seedwell ledge.
 Falling in water returns the fox to the bank it left (wading reset).
 Abstractions: positions are regions; a move is a whole crossing.
 ***************************************************************************)
EXTENDS Naturals

Regions == {"landing", "reed", "mill", "islet", "plateau", "ledge"}
VARIABLES at, damA, damB, reedskim, done, mode
vars == <<at, damA, damB, reedskim, done, mode>>
Levels == {"teach", "develop", "combine"}

Init == at = "landing" /\ damA = FALSE /\ damB = FALSE /\ reedskim = FALSE /\ done = {} /\ mode = "free"

Move(a, b) == at = a /\ at' = b /\ UNCHANGED <<damA, damB, reedskim, done>>
BurstA == at = "landing" /\ ~damA /\ damA' = TRUE /\ UNCHANGED <<at, damB, reedskim, done>>
BurstB == at = "islet" /\ ~damB /\ damB' = TRUE /\ UNCHANGED <<at, damA, reedskim, done>>
\* crossings, each gated by the physical state that makes it possible
CrossChannel == damA /\ (Move("landing", "reed") \/ Move("reed", "landing"))
CrossPond    == reedskim /\ (Move("reed", "mill") \/ Move("mill", "reed"))
ToIslet      == reedskim /\ (Move("reed", "islet") \/ Move("islet", "reed") \/ Move("mill", "islet") \/ Move("islet", "mill"))
Climb        == damB /\ Move("mill", "plateau")
DropDown     == Move("plateau", "mill") \/ Move("ledge", "mill")
Glide        == Move("plateau", "ledge")
\* the store: completion is idempotent and gated by prerequisites (Hazel progress.ts)
Complete(l) ==
  /\ l \notin done
  /\ \/ l = "teach" /\ at = "reed"
     \/ l = "develop" /\ at = "mill" /\ "teach" \in done
     \/ l = "combine" /\ at = "ledge" /\ {"teach", "develop"} \subseteq done
  /\ done' = done \cup {l}
  /\ reedskim' = (reedskim \/ l = "teach")
  /\ UNCHANGED <<at, damA, damB>>

Player == BurstA \/ BurstB \/ CrossChannel \/ CrossPond \/ ToIslet \/ Climb \/ DropDown \/ Glide
Free == mode = "free" /\ (Player \/ \E l \in Levels : Complete(l)) /\ UNCHANGED mode
\* at any moment the player may start heading for the Seedwell (no-softlock check from every reachable state)
Commit == mode = "free" /\ mode' = "goal" /\ UNCHANGED <<at, damA, damB, reedskim, done>>
\* the goal-directed policy: one obvious next step from wherever the fox is
GoalStep == mode = "goal" /\ UNCHANGED mode /\
  \/ at = "landing" /\ ~damA /\ BurstA
  \/ at = "landing" /\ damA /\ Move("landing", "reed")
  \/ at = "reed" /\ "teach" \notin done /\ Complete("teach")
  \/ at = "reed" /\ "teach" \in done /\ ~damB /\ ToIslet /\ at' = "islet"
  \/ at = "reed" /\ "teach" \in done /\ damB /\ CrossPond /\ at' = "mill"
  \/ at = "islet" /\ ~damB /\ BurstB
  \/ at = "islet" /\ damB /\ ToIslet /\ at' = "mill"
  \/ at = "mill" /\ "develop" \notin done /\ Complete("develop")
  \/ at = "mill" /\ "develop" \in done /\ ~damB /\ ToIslet /\ at' = "islet"
  \/ at = "mill" /\ "develop" \in done /\ damB /\ Climb
  \/ at = "plateau" /\ Glide
  \/ at = "ledge" /\ "develop" \in done /\ "combine" \notin done /\ Complete("combine")
  \* (the store refuses combine before develop: back down to the Mill Shore, which completes it on arrival)
  \/ at = "ledge" /\ "develop" \notin done /\ Move("ledge", "mill")
Next == Free \/ Commit \/ GoalStep
Spec == Init /\ [][Next]_vars /\ WF_vars(GoalStep)

TypeOK == at \in Regions /\ done \subseteq Levels /\ mode \in {"free", "goal"}
\* gates: nobody stands past a crossing whose physical gate is shut
Gates ==
  /\ (at # "landing" => damA)
  /\ (at \in {"mill", "islet", "plateau", "ledge"} => reedskim)
  /\ (at \in {"plateau", "ledge"} => damB)
  /\ (reedskim <=> "teach" \in done)
  /\ ("combine" \in done => "develop" \in done)
Monotone == [][done \subseteq done' /\ (damA => damA') /\ (damB => damB') /\ (reedskim => reedskim')]_vars
\* no softlock: from any reachable state, heading for the Seedwell always restores it
Finishes == (mode = "goal") ~> ("combine" \in done)
==============================================================================
