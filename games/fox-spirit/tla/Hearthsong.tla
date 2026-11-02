---------------------------- MODULE Hearthsong ----------------------------
\* Conductor of the synthesized score (src/opening/music/hearthsong.worklet.hot.ts, `barLine` + cue handling).
\* Granularity: one Bar step = one bar line. Cues arrive between bar lines.
\* The song never resets: `bar` walks the tune (0..TuneBars-1) then a breath (BreathBars), forever -
\* until the story's last moment asks it to end: it jumps to the tune's last line (CodaFrom), the lead sings
\* that cadence home, and the music rests for good.
\* A swell (the lead singing the tune from wherever it is) may only start on a bar line inside the tune,
\* never overlaps another, needs GapBars since the last start (unless forced by a finale moment), and always ends.
EXTENDS Naturals

CONSTANTS TuneBars, BreathBars, SingBars, FadeBars, GapBars, CodaFrom, MaxForce

VARIABLES bar, section, swell, left, since, startedOk, ending, forced, forces

vars == <<bar, section, swell, left, since, startedOk, ending, forced, forces>>
Swells == {"idle", "armed", "singing", "fading"}
Endings == {"none", "requested", "coda", "done"}

Init ==
  /\ bar = 0 /\ section = "tune"
  /\ swell = "idle" /\ left = 0
  /\ since = GapBars        \* the first moment may sing at once
  /\ startedOk = TRUE
  /\ ending = "none"
  /\ forced = FALSE
  /\ forces = MaxForce

\* a moment (hearth lit, page caught, ...): accepted only when the music has rested; otherwise dropped (no backlog)
Cue ==
  /\ ending = "none" /\ swell = "idle" /\ since >= GapBars
  /\ swell' = "armed"
  /\ UNCHANGED <<bar, section, left, since, startedOk, ending, forced, forces>>

\* a finale moment: sings even inside the gap (re-arms a fading swell); only MaxForce per game
ForceCue ==
  /\ ending = "none" /\ swell \in {"idle", "fading"} /\ forces > 0
  /\ swell' = "armed" /\ forced' = TRUE /\ forces' = forces - 1
  /\ UNCHANGED <<bar, section, left, since, startedOk, ending>>

\* the end card: finish the song
RestCue ==
  /\ ending = "none"
  /\ ending' = "requested"
  /\ UNCHANGED <<bar, section, swell, left, since, startedOk, forced, forces>>

NextPos ==
  IF section = "tune"
  THEN IF bar + 1 < TuneBars THEN <<bar + 1, "tune">> ELSE <<0, "breath">>
  ELSE IF bar + 1 < BreathBars THEN <<bar + 1, "breath">> ELSE <<0, "tune">>

Tick == IF since < GapBars THEN since + 1 ELSE since

\* the swell state machine on an ordinary bar line, given where the song goes next (p)
SwellStep(p) ==
  CASE swell = "armed" /\ p[2] = "tune" ->
         /\ swell' = "singing" /\ left' = SingBars
         /\ startedOk' = (startedOk /\ (since >= GapBars \/ forced))
         /\ since' = 0 /\ forced' = FALSE
    [] swell = "singing" /\ (left <= 1 \/ p[2] = "breath") ->
         /\ swell' = "fading" /\ left' = FadeBars /\ since' = Tick /\ UNCHANGED <<startedOk, forced>>
    [] swell = "singing" ->
         /\ swell' = "singing" /\ left' = left - 1 /\ since' = Tick /\ UNCHANGED <<startedOk, forced>>
    [] swell = "fading" /\ left <= 1 ->
         /\ swell' = "idle" /\ left' = 0 /\ since' = Tick /\ UNCHANGED <<startedOk, forced>>
    [] swell = "fading" ->
         /\ swell' = "fading" /\ left' = left - 1 /\ since' = Tick /\ UNCHANGED <<startedOk, forced>>
    [] OTHER -> UNCHANGED <<swell, left, startedOk, forced>> /\ since' = Tick

Bar ==
  \/ /\ ending = "none"
     /\ LET p == NextPos IN /\ bar' = p[1] /\ section' = p[2] /\ SwellStep(p)
     /\ UNCHANGED ending
  \* the end is asked for: jump to the last line and let the lead sing it home
  \/ /\ ending = "requested"
     /\ bar' = CodaFrom /\ section' = "tune"
     /\ swell' = "singing" /\ left' = TuneBars - CodaFrom
     /\ since' = 0 /\ forced' = FALSE /\ UNCHANGED startedOk
     /\ ending' = "coda"
  \/ /\ ending = "coda" /\ bar + 1 < TuneBars
     /\ bar' = bar + 1 /\ left' = left - 1 /\ since' = Tick
     /\ UNCHANGED <<section, swell, startedOk, ending, forced>>
  \/ /\ ending = "coda" /\ bar + 1 >= TuneBars
     /\ ending' = "done" /\ swell' = "idle" /\ left' = 0 /\ since' = Tick
     /\ UNCHANGED <<bar, section, startedOk, forced>>

BarStep == ending # "done" /\ Bar /\ UNCHANGED forces

Next == Cue \/ ForceCue \/ RestCue \/ BarStep

Spec == Init /\ [][Next]_vars /\ WF_vars(BarStep)

TypeOK ==
  /\ section \in {"tune", "breath"}
  /\ bar \in 0..(TuneBars - 1)
  /\ (section = "breath" => bar < BreathBars)
  /\ swell \in Swells
  /\ left \in 0..TuneBars
  /\ since \in 0..GapBars
  /\ ending \in Endings
  /\ forced \in BOOLEAN
  /\ forces \in 0..MaxForce

Safe ==
  /\ TypeOK
  \* the lead only sings inside the tune (there is nothing to sing in a breath)
  /\ (swell = "singing" => section = "tune")
  \* every swell that ever started respected the gap or was a finale moment
  /\ startedOk
  \* an unforced swell (sing + fade) is over before the next may be accepted
  /\ (swell \in {"singing", "fading"} /\ ending = "none" => since < GapBars)
  \* the coda only ever plays the tune's last line, and once done nothing sings again
  /\ (ending = "coda" => bar >= CodaFrom /\ swell = "singing")
  /\ (ending = "done" => swell = "idle")

ArmedSings == (swell = "armed" /\ ending = "none") ~> (swell = "singing" \/ ending # "none")
SwellRests == (swell # "idle") ~> (swell = "idle")
\* the song keeps going until it is asked to end
SongContinues == []<>((section = "tune" /\ bar = 0) \/ ending # "none")
\* asked to end, it ends
EndingEnds == (ending = "requested") ~> (ending = "done")
DoneStays == [](ending = "done" => [](ending = "done"))
=============================================================================
