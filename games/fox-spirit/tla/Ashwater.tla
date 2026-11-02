------------------------------- MODULE Ashwater -------------------------------
(***************************************************************************
 Ashwater Reach (src/opening/ashwater*.ts, DESIGN-ashwater.md): world II.
 Regions: landing -> reed -> mill (-> islet) -> weir -> punt -> ledge.
   Low Sluice  (teach):   dash dam A -> channel drains; reaching Reed Island
                          completes teach and earns Reedskim.
   Reed Pond   (develop): reed mats exist only with Reedskim (and sink under a
                          lingering fox: a fall is a reset to the bank, i.e. a
                          stay); reaching the Mill Shore completes develop.
   Weir Heart  (combine): the islet dam drains the cistern -> its steps reach
                          the weir; the weir's reed gate FLOODS the cistern for
                          a while (steps under water, punt raised) -> walk onto
                          the punt -> shelf -> Seedwell ledge. The flood
                          recedes on its own and the gate re-forms.
 Nothing reaches the ledge except the raised punt (no glide from the weir).
 ***************************************************************************)
EXTENDS Naturals

Regions == {"landing", "bedW", "reed", "mill", "islet", "weir", "punt", "ledge"}
Levels == {"teach", "develop", "combine"}
\* hold: moves the flood still has before it can wash out (the game holds 45 s; weir -> punt -> ledge is ~5 s)
CONSTANT Hold
VARIABLES at, damA, damA2, damB, flood, reedskim, done, mode, hold
vars == <<at, damA, damA2, damB, flood, reedskim, done, mode, hold>>
w == <<damA, damA2, damB, flood, reedskim, done, mode>>

Init == at = "landing" /\ damA = FALSE /\ damA2 = FALSE /\ damB = FALSE /\ flood = FALSE /\ reedskim = FALSE /\ done = {} /\ mode = "free" /\ hold = 0

Move(a, b) == at = a /\ at' = b /\ hold' = (IF hold > 0 THEN hold - 1 ELSE 0) /\ UNCHANGED w
BurstA == at = "landing" /\ ~damA /\ damA' = TRUE /\ UNCHANGED <<at, damA2, damB, flood, reedskim, done, mode, hold>>
BurstB == at = "islet" /\ ~damB /\ damB' = TRUE /\ UNCHANGED <<at, damA, damA2, flood, reedskim, done, mode, hold>>
Flood  == at = "weir" /\ ~flood /\ flood' = TRUE /\ hold' = Hold /\ UNCHANGED <<at, damA, damA2, damB, reedskim, done, mode>>
\* the flood washes out by itself; a fox on the falling punt comes down with it (to the cistern floor = mill)
Recede == flood /\ hold = 0 /\ flood' = FALSE /\ at' = (IF at = "punt" THEN "mill" ELSE at) /\ UNCHANGED <<damA, damA2, damB, reedskim, done, mode, hold>>

\* Low Sluice in two reaches: the bank sluice opens the west bed (north bank a thicket); from the bed, the sill's
\* culvert drains the east reach, whose bank climbs to Reed Island
BurstA2 == at = "bedW" /\ damA /\ ~damA2 /\ damA2' = TRUE /\ UNCHANGED <<at, damA, damB, flood, reedskim, done, mode, hold>>
CrossChannel == (damA /\ (Move("landing", "bedW") \/ Move("bedW", "landing"))) \/ (damA2 /\ (Move("bedW", "reed") \/ Move("reed", "bedW") \/ Move("landing", "reed") \/ Move("reed", "landing")))
CrossPond    == reedskim /\ (Move("reed", "mill") \/ Move("mill", "reed"))
ToIslet      == reedskim /\ (Move("reed", "islet") \/ Move("islet", "reed") \/ Move("mill", "islet") \/ Move("islet", "mill"))
Climb        == damB /\ ~flood /\ Move("mill", "weir")
Board        == flood /\ Move("weir", "punt")
ToLedge      == flood /\ Move("punt", "ledge")
DropDown     == Move("weir", "mill") \/ Move("ledge", "mill") \/ Move("punt", "weir")

Complete(l) ==
  /\ l \notin done
  /\ \/ l = "teach" /\ at = "reed"
     \/ l = "develop" /\ at = "mill" /\ "teach" \in done
     \/ l = "combine" /\ at = "ledge" /\ {"teach", "develop"} \subseteq done
  /\ done' = done \cup {l}
  /\ reedskim' = (reedskim \/ l = "teach")
  /\ UNCHANGED <<at, damA, damA2, damB, flood, mode, hold>>

Player == BurstA \/ BurstA2 \/ BurstB \/ Flood \/ CrossChannel \/ CrossPond \/ ToIslet \/ Climb \/ Board \/ ToLedge \/ DropDown
Free == mode = "free" /\ (Player \/ \E l \in Levels : Complete(l))
Commit == mode = "free" /\ mode' = "goal" /\ UNCHANGED <<at, damA, damA2, damB, flood, reedskim, done, hold>>
\* the goal-directed policy: one obvious next step from wherever the fox is
GoalStep == mode = "goal" /\
  \/ at = "landing" /\ ~damA /\ BurstA
  \/ at = "landing" /\ damA /\ ~damA2 /\ Move("landing", "bedW")
  \/ at = "landing" /\ damA2 /\ Move("landing", "reed")
  \/ at = "bedW" /\ ~damA2 /\ BurstA2
  \/ at = "bedW" /\ damA2 /\ Move("bedW", "reed")
  \/ at = "reed" /\ "teach" \notin done /\ Complete("teach")
  \/ at = "reed" /\ "teach" \in done /\ ~damB /\ reedskim /\ Move("reed", "islet")
  \/ at = "reed" /\ "teach" \in done /\ damB /\ reedskim /\ Move("reed", "mill")
  \/ at = "islet" /\ ~damB /\ BurstB
  \/ at = "islet" /\ damB /\ reedskim /\ Move("islet", "mill")
  \/ at = "mill" /\ "develop" \notin done /\ Complete("develop")
  \/ at = "mill" /\ "develop" \in done /\ ~damB /\ reedskim /\ Move("mill", "islet")
  \/ at = "mill" /\ "develop" \in done /\ damB /\ ~flood /\ Climb
  \/ at = "weir" /\ ~flood /\ Flood
  \/ at = "weir" /\ flood /\ Board
  \/ at = "punt" /\ flood /\ ToLedge
  \/ at = "ledge" /\ "develop" \in done /\ "combine" \notin done /\ Complete("combine")
  \/ at = "ledge" /\ "develop" \notin done /\ Move("ledge", "mill")
\* time passes while the player is not mid-route (free, or waiting with no step to take): the 45 s hold always
\* outlasts a weir -> punt -> ledge walk, so it never runs out between two of the policy's steps
Tick == hold > 0 /\ (mode = "free" \/ ~ENABLED GoalStep) /\ hold' = hold - 1 /\ UNCHANGED <<at, damA, damA2, damB, flood, reedskim, done, mode>>
Next == Free \/ Commit \/ GoalStep \/ Recede \/ Tick
\* the flood always recedes eventually; a player heading for the Seedwell keeps trying each enabled step
\* (strong: the flood may come and go, but boarding/climbing is enabled again and again)
Spec == Init /\ [][Next]_vars /\ WF_vars(Recede) /\ WF_vars(Tick) /\ SF_vars(GoalStep)

TypeOK == hold \in 0..Hold /\ at \in Regions /\ done \subseteq Levels /\ mode \in {"free", "goal"}
Gates ==
  /\ (at # "landing" => damA)
  /\ (at \notin {"landing", "bedW"} => damA2)
  /\ (at \in {"mill", "islet", "weir", "punt", "ledge"} => reedskim)
  /\ (at \in {"weir", "punt", "ledge"} => damB)
  /\ (at = "punt" => flood)
  /\ (reedskim <=> "teach" \in done)
  /\ ("combine" \in done => "develop" \in done)
Monotone == [][done \subseteq done' /\ (damA => damA') /\ (damA2 => damA2') /\ (damB => damB') /\ (reedskim => reedskim')]_vars
\* no softlock: from any reachable state, heading for the Seedwell always restores it
Finishes == (mode = "goal") ~> ("combine" \in done)
==============================================================================
