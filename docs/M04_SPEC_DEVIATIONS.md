# Module 4 — where the build departed from the spec

Written for Jon to carry into the Box copies of `m04_bilaterian_SCENE_SPEC.md` and, once it exists, `bilaterian_lab.md`. Nothing in Box was edited from this repo.

Every number here was measured, not chosen; the tuning probes that chose them are `src/sim/bilaterian/tune.probe.ts` and `grid.probe.ts`. The spec's §9 bands were written from the reading rather than from a running model, and this is the list of what a running model said back. Three things did not change and are worth saying first. **The animal does not compare left against right**: one sensor per channel, asserted structurally, and the comparison is now against a moment ago. **A modulator is a gain applied at simulation time, stored apart from every weight**: moving any modulator to either extreme leaves the circuit bit-identical, by test. **Nothing learns**: `setWiring` is the only code path that writes a weight, baseline, threshold or route, and a test walks the sim directory to say so.

---

## 1. The five non-negotiables, and how each came out

**The steering rule.** Klinokinesis, exactly as §4.3.3 describes it, and the seven-scenario suite runs on it. But the §9 band — *starting 180° from the source changes time-to-source by less than 15% across twenty seeds* — cannot hold for a klinokinetic animal, and the argument behind it is inverted. Facing the source from six units, the animal goes straight in: 2.4 s mean. Facing away it must first discover that things are getting worse, reverse, bend, and search: 27 s mean over twenty seeds, no seed failing, the worst about a minute. That is a ratio of eleven, not fifteen percent. What the rule buys is that facing away is *recoverable at all* — the test asserts arrival in every seed and a bounded search — whereas a Module 1 vehicle facing directly away reads the same on both sensors and drives on; in a walled dish it comes back off the wall, so the test compares the mechanism (a zero left–right difference) rather than a failure to arrive. Suggested rewording for §9: *facing away, the animal still arrives in every seed, within a bounded search, and never because its body told it the direction.*

**The symptom-identity test.** Met for W1, W3 and W4, on the healthy animal's own scale; not met for W2. Over ten seeds of eight minutes in the shipped dish: healthy 1.47 cues/min; W1 0.49, W3 0.45, W4 0.59 — 33%, 31% and 40% of healthy, spread over 0.14 cues/min against a fifth of the healthy rate (0.29). The test states the band that way — a gap of a fifth of what the healthy animal reaches — rather than as a ratio between the animals, because ratios explode near zero and say nothing a person watching could see (the Module 2 lesson). **W2 reaches 1.10, three quarters of healthy**, while reversing 45 times a minute against healthy's 19. The walk is robust to over-reversing: in a dish this size a random walk finds plumes at most of the healthy rate, and every mechanism that made W2 worse at finding food — a longer reversal, a bigger pulse into the reverse group — backed it tail-first into a bog, which is what Jon saw. W2 is the animal the spec's cut list names as expendable; it is kept, sortable by watching, and its test band says 80%. The handout should present it as the one whose *scorecard* says chemistry loudly while its wiring panel is healthy, not as one of the four that look alike.

**The ambiguous pair.** W1 and W3 differ by 0.04 cues/min at the shipped concentration, three percent of healthy. With one plume in the dish they are the same animal to the last bit: same seed, same trajectory, same meals, by test — a halved gain and a halved weight are the same arithmetic below the sensory cell's ceiling. At the top of the concentration control (2.5×) W3 reaches 1.58 and W1 0.13, a factor of twelve; W3 comes out *above* healthy (0.83 at 2.5×), because a halved gain de-saturates a cell that a strong cue would otherwise flatten. Both halves of the test hold.

**Modulator independence.** Holds by construction and by test.

**Nothing learns.** Holds by test, including a static walk for any assignment to a weight, baseline, threshold or route outside `setWiring`.

## 2. Where the model had to differ from the spec's picture

**The sensory cell is a ramp with a hard floor and ceiling** (`sensoryOutput`: gain × concentration, held in [0, 1], reaching 1 at 4 units of concentration). A soft ceiling was built first and had to go: the chapter's AND, weights 1 and 1 with threshold 2, fires only when both inputs are *exactly* 1, and a cell that approaches 1 asymptotically never gets there, so a truth table satisfied on paper never fed the animal in the dish. With the hard ceiling, "present" is the cell at its ceiling, the truth table's rows are what the dish delivers, and the arithmetic holds in the dish and not only on the panel. The panel calls it a ramp with a floor and a ceiling; §4.2.3's two named functions are the interneuron's.

**The diagnosis plumes read exactly the ceiling at their centre**, and plumes never overlap (their sum would pass the ceiling) and never appear inside a bog. That is what makes W1 and W3 the same animal at the shipped concentration. Part 2's plumes and regions are stronger (8 rather than 4) so that "present" holds over a patch the animal can stand in.

**Meals are graded by the verdict.** An animal eats at the rate its verdict fires, slows in proportion while it does, and remembers a half-eaten meal for eight seconds after wandering off. With a step gate on consumption a halved weight was all-or-nothing, so W1 could only ever equal W3 at zero. The diagnosis animals therefore ship with the sigmoid; Part 1 and Part 2 ship with the threshold function, which is the chapter's logic.

**Pursuit reaches the food-odor cell; satiety reaches the carbon-dioxide cell.** Declared per channel as biology (`pursuitDrives`, `hungerSilences`), which receptor cells carry which modulator receptors, and not as a valence: whether the animal approaches or flees a cue is still decided by the wiring alone, and a student can route the food-odor cell to reverse and watch pursuit make the avoidance more vigorous. With pursuit on every cell, halving it also halved the carbon-dioxide aversion, and W1 and W3 came apart in a two-cue dish. Arousal is a gain on the rule that triggers a reversal, and on the pulse that runs one; relief adds rest after a meal and quiets the animal's own restlessness. §5.2 says a modulator acts on the sensory cell's own output; that is true of the two the ambiguous pair rests on.

**The routing switch sits on the interneuron's output.** With one interneuron receiving every sensory cell, per-cell routing and convergence cannot both hold. The labeled-line scenario locks the interneuron to a pass-through (weight 1, baseline 0), so the sensory cell's own output is what the switch routes, and flipping it changes nothing about the cell.

**Steering differs by route.** A verdict routed forward steers on the change in the *net input* — the animal climbs concentration, as the chapter's worm does. A verdict routed to reverse steers on the change in the *verdict itself*, and the animal runs while the verdict fires. This was forced by the OR world: steering on the net input kept the animal out of every hazard whatever the threshold said, so an animal wired for AND and one wired for OR took the same harm and Part 2's middle step was invisible. Steering on the verdict, an animal wired for AND walks into single shadows (27 harm in two minutes) and one wired for OR does not. A flee built as reversals was tried twice — a jitter that never left the shadow, then a blind run into the next one — and an animal with no verdict at all did better than either; fleeing is running.

**Harm only startles.** Reaching a harmful source kicks arousal by 0.1, not more. A bigger kick made a poisoned animal too jittery to feed after a few minutes, which read as recovery, and the closer depends on the animal being unable to fix itself.

## 3. The animals, as shipped

| | Change | Cues/min at 1× | At 2.5× | Reversals/min | What gives it away |
|---|---|---|---|---|---|
| healthy | — | 1.47 | 0.83 | 19 | — |
| W0 | route → reverse | 0.00 | 0.00 | 2 | flees food, is drawn into the bogs; visible on the diagram |
| W1 | food weight 1 → 0.5 | 0.49 | 0.13 | 21 | only against W3, only at high concentration |
| W2 | arousal 1 → 8 | 1.10 | 0.96 | **45** | reversals per minute, and a wild bend after each |
| W3 | pursuit 1 → 0.5 | 0.45 | **1.58** | 22 | recovers at high concentration |
| W4 | satiety 1 → 0 | 0.59 | 0.50 | **5** | goes into the bogs and crawls |

Four notes on the table. **W2 is arousal at the control's maximum**, and arousal does three things: it scales the rule that triggers a reversal, it makes the bend after a reversal wilder (a less faithful return the way things were better), and it lengthens that bend a little. It does *not* lengthen the reversal itself: that was built and removed twice, because a longer reversal backed the animal tail-first into a bog it could not sense and it looked like W4. **W4's carbon-dioxide cell is fully silenced** (satiety 0), and the bogs are thick going in two steps — speed × 0.15 where carbon dioxide exceeds 1.0 and × 0.03 where it exceeds 1.8 — so an animal that backs into the edge of one can still get out, and one that walks into the middle cannot; W4 spends about 80% of its time in them against under 10% for the healthy animal, and its reversals per minute are a quarter of healthy's because it crawls. A student who reads the scorecard closely can pick W2 and W4 out by that column, which the spec's "not sortable by watching" did not anticipate. **W0 crawls in the bogs too**, and that is correct: a flipped switch inverts the whole verdict, so it flees food and is drawn into the carbon dioxide a healthy animal avoids; the reveal says so. **W1 and W3 both climb to the food and eat it slowly and seldom** at the shipped concentration — the same slow, interrupted meals — which is the visible symptom the ambiguous pair shares; the healthy animal's aversion to carbon dioxide is −2.5, and the single-cue verdict threshold 0.35, because a stronger aversion or a higher threshold starved the pair to nothing and a weaker or lower one let W1 recover at high concentration.

## 4. The seven scenarios

- `labeled-line`: 1.75 cues/min routed forward, 0 routed to reverse.
- `trade-off`: the copper strip is twenty-seven weak sources of strength 0.7 along z = 0, a burn (half a harm per second) on its centre line; the food plume sits four units beyond it and is broad (scale 3), so its rise across the strip is real and the crossing is a contest between two graded quantities rather than a wall. What decides crossings is how food is weighed against copper, not either weight alone: equal weights cross rarely whether at 1 or at 3 (0.3 a minute), food 3 against copper −2 crosses about once every two minutes, food 3 against copper −1 about twice a minute. So a student can set both weights high, with food the higher, and watch the animal cross while still flinching from copper — Jon's point, and the version the test asserts. Harm ticks up whenever the animal touches the strip, crossing or not; that is the burn, and it is what the wary animal pays for testing the strip. "Cool water" is the AND scenario's second cue, so that *the water is not too warm* is a cue present rather than a cue absent.
- `target-and` ships with weights 1 and 0, threshold 0.5 — it feeds wherever there is food — and harms itself 6.8 times in two minutes. The chapter's 1, 1, 2 feeds only in cool water and takes no harm, by test.
- `target-or` keeps the interneuron's numbers from `target-and` and routes the verdict to reverse. Wired for AND it takes 27 harm in two minutes; the one-number change to OR cuts that by more than 30%, by test.
- `target-and-not` ships with the AND wiring; weights 1 and −1 with threshold 0.5 feed and are never eaten, by test.
- `diagnosis`: two-cue dish (food odor, carbon dioxide), three bogs no plume appears in, three plumes. Two plumes were tried, to make steering matter more against a random walk, and starved the ambiguous pair to a sixth of healthy.
- `reversal`: healthy weights, food odor from the toxin; harm rises monotonically and does not slow within five minutes; flipping the routing switch gives zero harm in five minutes.

## 5. Smaller things

- **The concentration control scales the plumes only**, not a dish's fixed features (a bog, a strip, a patch of cool water), and tops out at 2.5×, not 5×: past that the far field itself saturates and the healthy animal's climbing signal disappears.
- **The dish is 16 units across** (`DISH_BOUNDS` 8; Module 3 used 9), square, with the Modules 1–3 rim reused unchanged.
- **A World tab** holds the scenario, the cue concentration, source placement and the run seed; the Circuit tab holds only the animal's wiring. Opening the Worms tab loads the healthy animal into the diagnosis dish; loading an animal keeps the concentration the student set. A **Restore** button puts the wiring back to what the scenario started with.
- **Meals are marked** with a ring, and a plume fades over its last five seconds rather than vanishing, so a plume dissipating never looks like a plume being eaten.
- **The Chemistry tab plots the four levels** over the last eight seconds and draws the dot's recent path on the plane, so a state decaying is a line drifting back and not a number changing.
- **W1–W4 hide every number**: on the Circuit tab the diagram keeps its structure (routes are healthy on all four) and the arithmetic, table, boundary and sensory traces are withheld; the verdict and reversal-rate traces stay, because those are identical for W1 and W3 and the sensory traces are not (W3's food cell reads half of W1's). On the Chemistry tab the sliders and the dot are withheld. §5.2 and §5.3 do not say what the panels show for a hidden animal; the ambiguity test could not survive them showing everything.
- **Consequences live in the scenario**, not on the channel: what reaching a source does is a rule of the dish, which is what the closer changes.
- **The valence–arousal dot** is computed from the four levels in the directions of §4.3.6's table, plus a nudge from the running verdict; the map is a design choice, not from the reading.
- **The recurrent loop** the persistence readout names is the reverse group's connection onto itself, which holds a reversal for about 1.4 s after the pulse that started it.
- **Sections open per scenario** by remounting, so loading `target-and` opens the table and the boundary as §5.1 asks.
- **The Reset button keeps the student's settings**, as Labs 2 and 3 do.

## 6. What the handout and the close-out still need

- The handout does not exist yet. The registry points the Lab pane at `intro_to_bcs/neural_circuits_affect_and_valence/bilaterian_lab/bilaterian_lab.md` and the report at `bilaterian_lab_report.docx` beside it; the pane degrades to a link until they land.
- `scripts/labs.config.mjs` has no `m04-bilaterian` entry yet, because `npm run closeout` checks every lab and would fail on the missing handout. When the handout lands, add the entry with the claims in `scenarios.test.ts` and `animals.test.ts` as its `claims`, and `tune.probe.ts` (`animals`) as its crib.
- Not verifiable from the scripted session: the undulatory wave, the deep bend, the reversal tint, the cue-field discs, the live dot. Predictions for Jon to check at `localhost:5173` are in `docs/BUILD_STATUS.md`.
