# Module 5 as built — notes for the session that writes the handout

Written 2026-09-20 by the session that built `m05-learning`, from the shipped code and from measurements, for whoever writes `learning_lab.md`. **The handout was drafted from these notes on 2026-09-21**, after Jon's walk-through (§6): `intro_to_bcs/learning_and_plasticity/learning_lab/learning_lab.md`, 29 questions, with `build_report.py` generating `learning_lab_report.docx` beside it. **Live since 2026-09-21**: merged to `main` at `c120ccb`, deployed, and the handout, report and generator pushed to `intro_to_bcs` at `ec3680a`. The one file this session wrote into Box is the walk-through, `LAB_5_WALKTHROUGH.md`, at Jon's request.

**Every number here was measured, not predicted.** Unless a line says otherwise: six seeds (1000 to 1005), the scenario exactly as it loads, and times in simulated seconds, which are wall-clock seconds at 1× speed. The probe that produced them is `src/sim/bilaterian/learning/crib.probe.ts`, and `npm run closeout m05-learning` prints them. A handout that quotes a number should quote one from §3, and should say "about".

**The handout may assert what the close-out's claim list says and nothing it cannot find there.** Thirty-four claims about what a student will see each name the test that goes red if it stops being true (`scripts/labs.config.mjs`, entry `m05-learning`). Two have no test and are marked: the run-started mark on the weight trace, and the Lab button's not-yet-published message.

---

## 1. Every control, as it shipped

Four tabs: **World**, **Circuit**, **Learning**, **Chemistry**. The transport bar at the bottom is Lab 4's (play/pause, step, reset, **speed 0.25× to 8×**, where Lab 4 stopped at 3×), with two buttons beside it that are on screen on every tab: **Skip ahead 1 min** and **Skip ahead 3 min**. Presses add up, they work while paused, and a badge over the dish reads *Skipped ahead 3 minutes — run time is now 182 s* for about a second afterward.

### World tab (left panel, "The world")

| Name on screen | Range | Default | Where it appears |
|---|---|---|---|
| **Scenario** | six entries, lettered because two share Part 1 and two share Part 2: *Part 1a — Let the weights change*, *Part 1b — Salt, then food*, *Part 2a — Blocking*, *Part 2b — Four signals, one problem*, *Part 3 — The corridor*, *Closer — Extinction* | Let the weights change | always |
| **Go to phase 1 / 2 / 3** (buttons, under *The phases*), with **Now in** printing the phase's label | — | phase 1 | `blocking` (three), `extinction` (two) |
| **Wait**, **Move to the second dish** (becomes **Move back to the first dish**), **Deliver one outcome** (under *The three returns*) | — | — | `extinction` only |
| **Interval between the touch and the food** | 0 to 10 s, step 0.5 | 0.0 s | `pairing` only |
| **A second cue, almond odor, at every site** (toggle) | — | off | `pairing` only |
| **Almond odor marks the food (off: salt does)** (toggle) | — | off | `four-signals` only |
| **Cue concentration (the plumes)** | 0.25× to 2.5× | 1.00× | always; it scales plumes that come and go, which in this lab means `hand-over`'s food plumes and nothing else |
| **Source to place on a click** | the scenario's cues, **without food odor wherever food is delivered at sites** (everywhere but `hand-over`) | the first cue listed: food odor in `hand-over`, salt elsewhere | always; a placed source is a cue by itself and carries nothing, which is how a student tests whether a cue alone now draws the animal |
| **Reset**, **New seed**, run seed printed | — | random seed | always |


**Reset behaves differently from Lab 4 and the handout must say so.** It starts the run again with every control where the student left it and **the weights back where the run started**. A weight set by hand on the Circuit tab counts as a new start. Changing phase, flipping a toggle or moving the interval does not reset anything.

Right panel, "This world": **What the world does** (one line per rule of the dish, rewritten when a phase, toggle or interval changes), **What is in the dish** (legend), and the scorecard: *Meals per minute — over the last minute*, *Meals — total count*, *Harm*, *Run time*, and where the scenario has sites, *Sites touched* and *Touched and found nothing*; in `extinction`, *Response to salt alone, here and now*.

### Circuit tab

Lab 4's, unchanged, with the wiring section retitled **Wiring — yours to set, and now the rule's to change** and one section added at the top of the right panel:

- **The weight trace** — every stored weight over **the last five minutes** on one axis from −3 to 3, with the time axis labeled in minutes and seconds of run time. It grows from the left and then scrolls; it is never squeezed to fit a longer run, so the **run started** mark leaves the left edge after five minutes (Jon's call: squeezing makes changes harder to see). A zero line, a dotted line at each weight's starting value, and a row per weight reading *at the start 1.00 · now 1.82*. An innate connection is drawn dashed and labeled *(innate: the rule cannot move it)*.

The weight sliders stay live in every scenario for every connection the rule can move. The food-odor weight is locked (printed, not slid) in the five scenarios where it is the innate outcome pathway; in `hand-over` it is the one plastic weight and is a slider.

### Learning tab (left panel, "The learning rule")

| Name on screen | Range | Default | Locked where |
|---|---|---|---|
| **Learning on** (toggle) | — | on | never |
| **The rule — what supplies Φ**: four radio cards, **Coincidence Φ = y**, **Prediction Φ = a − p**, **Teacher Φ = t − o**, **Verdict Φ = δ**, each with its section numbers and a *Needs:* line | — | per scenario | held at Coincidence in `hand-over` and `pairing`, at Verdict in `corridor`, at Prediction in `extinction`; all four offered in `blocking` and `four-signals`. Locked cards are greyed. |
| **learning rate η** | 0.01 to 1, log scale | 0.3 | never |
| **eligibility trace window** | 0 to 10 s, step 0.5 | 3 s where shown (0 elsewhere) | shown in `blocking`, `four-signals`, `corridor` |
| **discount γ, per second of delay** | 0.50 to 0.99 | 0.90 | shown in `blocking`, `four-signals`, `corridor`; the note under it prints γ¹⁰ live (0.35 at 0.9, the chapter's "about a third") |
| **Weakening (long-term depression) — §5.3.2** (toggle) | — | **off** | held off in `hand-over`, `corridor`, `extinction` |
| **Competition — §5.3.5** (toggle) | — | **off** | same |

Right panel, "What the rule is doing": **The arithmetic** (one line per connection, `Δb₂ = η · x₂ · Φ = 0.30 · 1.00 · 1.00 = 0.30 per second`, plus **One occasion, by hand**: two number boxes for x and y, pre-filled 40 and 40, multiplied by the η on the slider — at η = 1 it reads 1600, at 0.01 it reads 16); **One algorithm, written down twice** (`blocking` and `extinction`: Rescorla–Wagner over the delta rule with λ = t, V = o, αβ = η and the error filled in while something is arriving, and "—" between arrivals); **The signal trace** (Φ over the last minute in yellow, the verdict dashed in blue, *Φ now*, *Where Φ comes from*, and under Teacher the line **The target is supplied by the scenario. Nothing inside the animal holds it.**; under Prediction, *The held prediction p* with how long ago it was made); **Credit** (`corridor`, and any scenario while Verdict is selected: the tier-four line, the trial-by-trial chain grid (the last forty trials, oldest at the top, scrolling, so trial 1 is still readable after a thirty-trial run), an eligibility bar per connection, the critic's value estimate, the broadcast signal δ, what the critic holds each cue to be worth, and the actor/critic paragraph).

### Chemistry tab

Lab 4's four sliders, unchanged and still named for what they do. Added under them: **dopamine — the broadcast signal**, which is not a control, with a paragraph saying so. Added on the right: a **Dopamine** section plotting dopamine (δ, pink) and the value estimate (teal) over the last minute, both numbers, and the line *The recordings that established this were made in vertebrates, and largely in primates. How far down the tree the arrangement extends is a separate question.*

**The dopamine trace runs under every setting.** The critic learns whenever learning is on; only the Verdict setting lets its signal move a weight on the Circuit tab. Under Coincidence in `hand-over` the student can watch dopamine dip at every poisoned meal while the rule ignores it — which is a question worth asking.

---

## 2. Every scenario, as it shipped

All six use Lab 4's animal and 16-unit dish. All load with learning on, η = 0.3, both bounds off.

| Key | Menu title | Cells (x₁…) | Loads with | What the world does | Rule | Sections |
|---|---|---|---|---|---|---|
| `hand-over` | Let the weights change | food odor | b₁ = 1, θ = 0.35, forward, threshold function — Lab 4's `reversal` exactly, three food plumes | food odor marks a toxin: eating harms | Coincidence, locked; bounds held off | arithmetic, signal trace |
| `pairing` | Salt, then food | food odor (innate, 1), salt (0), almond odor (0) | two salt-marked sites | touching a site brings food after the interval; its cues dissolve 1.5 s after the touch | Coincidence, locked; **bounds unlocked** | same |
| `blocking` | Blocking | same three | phase 1: two salt sites with food. Phase 2: both cues at each site, same food. Phase 3: almond alone, nothing | as the phase says | all four; loads at Coincidence | + two equations, trace, discount |
| `four-signals` | Four signals, one problem | same three | two salt sites and two almond sites; one kind holds food, the other nothing; the toggle flips which | as the toggle says | all four; loads at Coincidence; trace window 3 s | + trace, discount, Credit under Verdict |
| `corridor` | The corridor | food odor (innate), the marker, the turn, the approach, a passing vibration | a walled lane 2.6 wide along the dish; zones at x = −6 to −3.5, −1.5 to 1, 3 to 5.5; food at 6.5; animal starts at −7 facing along it | food nourishes; after each meal the animal is put back at the start 2.5 s later; the vibration comes on for 1.5 s at a random moment 0.5 to 3 s into each trial | Verdict, locked; bounds held off; window 3 s, γ 0.9 | Credit open, with the tier-four line; the line is also on the World tab |
| `extinction` | Extinction | food odor (innate), salt, dish one, dish two, session one, session two | two salt sites. Phase 1 food, phase 2 nothing. **sigmoid function**, so the response is graded | as the phase says, plus where and when the animal is | Prediction, locked; bounds held off | two equations |

**A site** is the one world mechanism this lab added. It is a place marked by narrow cue plumes (present, an input of exactly 1, within reach; about 0.04 at the next site over). When the animal's head comes within 1 unit, the site is *touched*: its cues linger 1.5 s and dissolve, and what it holds arrives after the interval — food appears there with its own odor, or nothing does — **whatever the animal's verdict says**. A site nobody finds moves after 45 s; delivered food waits 20 s. The naive animal finds sites by blundering into them, about two a minute; once a cue has weight it climbs to them.

**What the handout should not say.** Salt and almond odor are "cues this animal ignores", not "neutral stimuli" as a technical term the scene never uses. The four settings are *Coincidence, Prediction, Teacher, Verdict* — not "Hebb's rule setting". The cells in `corridor` are stretches of floor the animal is on, not plumes. "Response" in `extinction` is a printed number on the World tab, *Response to salt alone, here and now*; the animal keeps *approaching* salt after extinction, because approach steers on the salt weight and the context connections do not steer — what extinguishes is the verdict.

---

## 3. Every number a student will read off the screen

### Part 1

- **`hand-over`.** The weight climbs from 1.00 in steps, one per approach, and reaches **3.00 after 13 to 38 s (mean 23)**. It never goes down. Harm is **3.0 to 4.2 per minute (mean 3.5)** with the rule on and 3.4 to 4.6 (mean 4.0) with learning off: 15 to 20 in five minutes either way, and no minute is free of it. At η = 0.01 the weight after five minutes is 1.72 to 2.02.
- **`pairing`, interval 0.** Salt rises from 0.00 by about η per meal (0.3), passes the threshold 0.35 on the second meal, then takes off, because it now fires the verdict by itself on every approach: **3.00 after 62 to 150 s (mean 113)**. Sites touched in five minutes: 11 to 18. The food-odor weight stays at 1.00 throughout.
- **Learning rate.** Gain per meal at η = 1 is about 0.7 (one meal is enough to cross the threshold); at η = 0.01 it is **0.010 to 0.013**. The by-hand box reads 1600 and 16.
- **Second cue.** Both weights rise together and are identical to the last digit. At η = 0.05 after two minutes: 0.10 to 0.48, equal.
- **Interval.** At 10 s, salt after five minutes is **0.02 to 0.05**. At 3 s, 0.04 to 0.11, and **one seed in six does take off inside five minutes**: each meal still coincides with a trace of salt from the other site, and a weight that creeps past 0.35 runs away. The handout should use 10 s and say "almost nothing", not "nothing".
- **Bounds.** Both off, η = 1, second cue on: at the ceiling 98% of the time after the first minute, verdict on 75% of the time. **Weakening on**: salt ends between 2.03 and 2.92 at η = 0.3, *goes down as well as up*, is at the ceiling under 6% of the time, verdict on about 30%. **Competition on**: salt flat at **2.00** alone, or **1.00 and 1.00** with the second cue.

### Part 2

- **`blocking`, Coincidence.** Salt stops climbing at 3.00 after 62 to 150 s. After four minutes of phase 2: **salt 3.00, almond 3.00**.
- **`blocking`, Prediction.** Salt stops climbing **at 0.95 to 1.00 after 141 to 284 s (mean 205)**. After four minutes of phase 2: **salt 0.98 to 1.00, almond 0.00 to 0.02**. In phase 3 the animal seeks almond out under Coincidence and not under Prediction (sites touched in four minutes differ by more than 20%).
- **The condition is real.** At η = 0.1 four minutes of phase 1 leaves salt at 0.4 to 0.7, and almond then picks up 0.15 to 0.32. "Train until the weight stops climbing" has to be in the instructions.
- **`four-signals`**, five minutes, then the flip, then five more; means over six seeds:

| Setting | Salt, almond before | Salt, almond after the flip | What it fails at |
|---|---|---|---|
| Coincidence | 3.00, 3.00 | 3.00, 3.00 | cannot tell the cue that marks food from the one that marks nothing; unlearns neither |
| Prediction | 0.99, −0.02 | 0.07, 0.91 | anything the world does not reveal. Seen once in an earlier build and not in these six seeds: almond dips negative after the flip, the animal avoids it, and never finds out |
| Teacher | 0.67, 0.09 | 0.28, 0.64 | nothing — and the panel says where the target came from. It stops the moment the verdict is right (0.7, not 1) and takes salt down only to just under firing |
| Verdict | 1.63, 0.18 | 0.44, 1.40 | the least exact: weights overshoot 1 and wander, and the old cue is left holding more |

### Part 3

- Value over 0.30 appears at **the approach on trial 2, the turn on trials 3 to 6, the marker on trials 6 to 8**. On trial 1 the surprise at the food is 1.00 and every value is under 0.3. By trial 30 the marker holds 1.83 to 1.92 and the surprise at the food is **0.38 to 0.43**.
- **Values settle above 1** (about 1.7 to 1.9), because a zone is present for a little more than one step of delay and the estimate averages over the step. The handout should ask about order and direction, not about magnitudes.
- **Trace window 0:** nothing in the chain ever gains, on the grid or on the weight trace, and the surprise at the food stays at 1.00. **Window 10:** the marker crosses 0.30 on trials 2 to 6 instead of 6 to 8. **The passing vibration gains almost nothing at any window** (−0.5 to 0.4 against a marker near 1.9).
- **Discount** (three seeds, twenty trials): at γ = 0.5 the marker holds 0.07 to 0.10 and the turn 0.19 to 0.30, with the approach still at 0.8 to 1.3 — value does not reach the start of the chain. At γ = 0.99 the marker holds 2.3 to 2.7, more than the approach.
- The actor's weights and the critic's values for a cue are the same numbers here. Both receive the same broadcast on the same marks. See §5.

### The closer

- After four minutes of acquisition: salt **0.93 to 1.00**, response **0.98**.
- In phase 2 the response falls under 0.20 within 3 to 70 s (two or three touches). Then: **salt 0.65 to 0.72**, dish one −0.33 to −0.36, session one −0.33 to −0.36, response **0.09**.
- **Wait → 0.46 to 0.52. Move → 0.46 to 0.52. Both → 0.88 to 0.92. One unpaired meal → 0.91 to 0.95.** Move back and the response is 0.09 again. Wait and Move change no weight; the meal drives both context connections back to 0 and leaves salt where it was.
- The delivered meal waits until the salt cell reads under 0.2, which can take up to half a minute.

---

## 4. Timing, in wall-clock minutes

**The lab does not ask a student to sit through its runs.** The World tab has **Skip ahead 1 minute** and **Skip ahead 3 minutes**, which run the dish forward without drawing it. Measured in the browser on the development Mac: three simulated minutes in **54 ms** of wall-clock time, React updates included. It is paid down on a timer rather than in the frame loop, thirty simulated seconds a slice, so it does not depend on how fast a machine can draw, and a Chromebook twenty times slower takes about a second. Nothing is left out by a skip: the weight trace, the signal traces and every counter record straight through it, and a test asserts that a sliced skip is the same run as one paid at once.

Jon's ruling (2026-09-21): five minutes of watching per question is too long even at 8×, and the speed control's top end cannot be assumed on a Chromebook, where drawing and not simulation is the limit. So **the handout should give every run as "Reset, then Skip ahead N minutes"**, and keep live watching for the places where watching is the point: the first minute of `hand-over`, the first approach to salt in `pairing`, and a few corridor trials.

Simulated minutes each part needs, which is what the handout writes after "Skip ahead". Shortening these does not work: the limit is how often the animal touches a site (two to three a minute), and below three minutes a half `four-signals` stops separating the rules reliably (Teacher shows its signature in 3 of 8 seeds at two minutes a half, 8 of 8 at three).

| Part | Runs | Simulated minutes | Wall-clock cost of the running itself |
|---|---|---|---|
| 1 | `hand-over` 3, and 3 more at η = 0.01; `pairing` to the ceiling 3; η = 1 and 0.01, 3; second cue 2; interval 10 s, 5; weakening 5; competition 3 | 27 | watch the first minute of `hand-over` live (1 min); the rest is about a dozen clicks |
| 2 | `blocking`: phase 1 until flat (3 under Coincidence, 5 under Prediction), phase 2 for 4, phase 3 for 2, twice; `four-signals`: four settings × (3 + 3) | 20 + 24 | under ten seconds of skipping in all |
| 3 | thirty trials 5; window 0, 3; window 10, 3; one γ, 3 | 14 | watch three or four trials live (about 40 s), skip the rest |
| Closer | acquisition 4, extinction 2, then Move → Move back → Wait → Deliver from the one animal | 6 | the buttons are instant; the delivered meal can take up to 30 s to land, or one more skip |

So the time a part takes is now reading, setting controls and writing, which is the handout's to budget and not the simulation's. The speed control still runs 0.25× to 8× for anyone who wants to watch a run at pace. Nothing on any click path costs more than 0.05 ms (`timing.probe.ts`), and a 30-second slice of a skip is about 2 ms.

## 5. Where the build departed from the spec, and where the spec's numbers were wrong

1. **The outcome needed a pathway of its own, and the world needed sites.** With food odor among the cues, food odor predicts food perfectly and blocks every other cue from trial one under Prediction; with every cue weight at 0, nothing fires the unit under Coincidence. So in five scenarios the food-odor connection is innate and outside the prediction, and food is *delivered* at a touched site whatever the verdict says. `hand-over` is the exception: it is Lab 4's dish unchanged, and its one weight is plastic.
2. **Φ under Verdict is δ alone; the eligibility stands where xᵢ stands.** The spec's table gives Φ = δ·eᵢ, which with Δbᵢ = η·xᵢ·Φ multiplies by the input twice and cannot bridge a delay, since xᵢ is zero by the time the news arrives. As built the rule is Δbᵢ = η·(mark on connection i)·Φ for all four settings, and the mark is the live input when the trace window is zero.
3. **The broadcast signal lands on the marks as they stood when the step it is news about ended.** Landing it on the live marks credits a cue with its own arrival, and value climbed without limit (2.6 and rising). This is the only place a setting differs beyond Φ, and `learner.ts` says why.
4. **Weakening slides, and stops at zero.** Against a fixed level it bounds nothing: a unit that has run away is never quiet, so the condition for weakening is never met again. The level is twice the unit's average output over the last 20 s. And at η = 1 it overshot through zero into inhibition, which in `hand-over` read as coincidence learning to avoid the toxin — so weakening cannot take a connection past nothing, and `hand-over` holds both bounds off. The chapter's sentence (a sending cell active while the receiving cell is quiet weakens the connection) is still literally what happens.
5. **The trace-window test at the wide end is inverted, not met.** The spec expected the widest window to credit the bystander as much as the action that mattered. It does not, at any window, because a rule built on changes in the value estimate takes that credit back when nothing follows — which is what §5.2.8 says of grooming. What a wide window does is carry value back sooner. The proposal's sentence ("set too wide, and everything that happened along the way gains as much as the action that mattered") describes SNARC's rule, not temporal-difference learning, and the handout should not ask students to find it.
6. **The backward-propagation test is on first crossings.** "The index of the earliest point carrying more than a threshold decreases monotonically" is asserted as: the approach crosses 0.30 no later than the turn, and the turn no later than the marker, in every seed. "The first action carries more than the food" is asserted against the *surprise left at the food*, the broadcast signal when the meal lands, since the food itself has no value to hold.
7. **The corridor is straight, its zones do not steer, and "the turn" is a stretch of floor.** A klinokinetic animal hovers at any cue it has learned to value, so a chain of plumes would have stalled at the first. The zones are reported by cells that never trigger a reversal. Learning therefore changes no path in `corridor`; what the student reads is the Credit section. That is cut 4 of the spec's §8 taken halfway: the instruments are all there and manipulable, and the animal is a demonstration.
8. **The actor and the critic hold the same numbers.** Both receive one broadcast on the same marks, so the salt weight on the Circuit tab and the value of salt on the Credit section move together. The two are named and drawn as two parts, but a question that depends on them coming apart cannot be answered from this scene.
9. **Extinction's context connections can only become inhibitory** (Jon agreed, 2026-09-20). Acquisition therefore loads the cue alone, extinction splits its decrement three ways, and all three returns fall out with no decay anywhere. The margins the spec left open came out at: weight after extinction 0.65 to 0.72 against 0 before acquisition; each single return +0.37 to +0.43 on the response; reinstatement +0.82 to +0.86.
10. **The delay test passes with two sites, not three**, 7 apart with narrow markers. With three broad ones every meal coincided with the faint salt of the others and a 10 s interval ran away regardless. It is 0.04 of the zero-interval gain per touch at 10 s, and 0.07 at 3 s.
11. **The runaway's "fires on essentially every input combination"** is 75% of the time in the dish with the second cue on (98% of the time at the ceiling), against 30 to 35% with either bound. On a bare integrator it is 94%.
12. **`hand-over` and `pairing` hold the selector at Coincidence** (Jon agreed). Under Prediction or Verdict `hand-over` would repair the animal; nothing in the scene offers that.
13. **Reset restores the weights.** Lab 4's Reset keeps everything; here a run that kept what it learned could not be compared with the one before.
14. **Skip-ahead buttons, and speed to 8×**, for the reason in §4. Neither is in the spec.
15. **Lab 4's files changed, inertly.** `worm.ts`, `dishWorld.ts`, `fields.ts`, `scenarios.ts` and `circuit.ts` gained hooks (a source may carry its own consequence; reaching one may deliver nothing; a cell may be driven from inside the animal and then does not steer; a lane; per-step news), and Lab 4's three tab components gained four optional slots. `lab4Regression.test.ts` holds all seven scenarios and six animals to the trajectory they ran at `9ebfc77`, to the last bit.

## 6. Jon's walk-through, 2026-09-21, and what it leaves for the handout

Jon walked `LAB_5_WALKTHROUGH.md` (beside the scene spec in the course folder) and every prediction held. Changed in the app as a result: Skip ahead moved beside the transport bar (at a large font size it sat below the fold on the World tab) and its badge now stays a second; the weight trace got a fixed five-minute window and a labeled time axis; the scenario menu is lettered; food odor can no longer be placed by a click where food is delivered at sites (a placed one could not be eaten and read as a bug); and Lab 4's *Held by the reverse group's loop* row no longer changes height as it updates.

**Rulings the handout has to carry:**

- **Warn against a very low or negative starting weight in `hand-over`.** The change is η·x·y and y only fires once b₁x passes 0.35, so at b₁ = 0.1 almost nothing happens, and at a negative b₁ nothing ever does: the animal never approaches, the unit never fires, and the rule has nothing to multiply. That is §5.2.1's limitation exactly, and worth a question of its own, but a student who wanders into it by accident in the opening minutes will think the scene is broken. Tell them to leave b₁ at 1.00 for the first run.
- **Ask about the dopamine trace dipping at each poisoned meal in `hand-over`** while nothing uses it. Jon: worth asking.
- **Say in the handout that the two traces in `pairing` with the second cue lie exactly on top of each other**, since only one line is visible.
- **`four-signals`: three minutes before the flip and three after**, and a heads-up — without giving the result away — that at 1× this is slow and Skip ahead is what to use. The scenario's own blurb now says so too.
- **`blocking`: "until the weight stops climbing"**, not a fixed time. Interval: use 10 s in `pairing`.
- **Do not ask students to find the bystander gaining credit at a wide trace window**; it does not.
- **Explain, rather than change:** that the animal keeps approaching salt after extinction (approach steers on the salt weight; what extinguishes is the verdict), and that context connections can only become inhibitory.
- The delivered meal in `extinction` can take half a minute to land at 1×; say so, and that it can be sped up.
- The actor's weights and the critic's values being the same numbers: Jon is unsure and thinks it is acceptable. No question should depend on them coming apart.

## 7. Not verifiable from the scripted session

The in-app browser does animate this scene (the traces moved during the check), but motion was not judged. For Jon at `localhost:5173/#/m05-learning`, with the crib from `npm run closeout m05-learning`: the lane's walls and three colored strips, and that a strip brightens when the animal is on it; the pink wash when the vibration passes; the violet tint of the second dish; that a touched site's cue visibly dissolves before food appears at a 10 s interval; that the animal visibly climbs to salt once salt has weight; the run-started mark and dotted start lines on the weight trace; and that six sensory cells fit on the circuit diagram in `extinction`.
