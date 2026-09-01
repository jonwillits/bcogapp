# Module 2 — where the build departed from the spec

Written for Jon to carry into the Box copies of `m02_evolution_SCENE_SPEC.md` and `evolution_lab.md`. Nothing in Box was edited from this repo.

Every number here was measured, not chosen. Where a spec figure turned out to be unreachable, the section says which measurement showed it and what replaced it.

Two things did not change and are worth saying first, because everything else is easier to read against them. **The genome is still six genes** — the same four connection strengths and bias the creature carried in Lab 1, plus one that does nothing. And **the wiring panel is still literally the Lab 1 component**: it moved to `components/WiringPanel` and both scenes render it, so Part 3 asks a student to open an instrument they have already used rather than a lookalike.

---

## 1. The largest change: generations became continuous

**Spec §3** specifies discrete generations — all N creatures run for a fixed length, are ranked by energy, and the top half each leave two offspring.

**What it is now.** Every creature carries an energy store and a lifespan. Energy rises while it feeds and falls while it lives and moves. When the store fills, it reproduces as soon as the arena has room; when its life runs out, it dies. Nothing resets and nothing is ranked. The arena supports a fixed number — 16 by default — and a creature is born only when a slot opens, which goes to whoever has the fullest store.

**Why.** Jon's judgement that students find discrete generations confusing, and it survived measurement: the continuous engine matches the generational one on every acceptance test and beats it on two.

**The one thing that made it work.** The first continuous attempt failed, and instructively. Removing the generational bottleneck removed two things at once, and only one was obvious. Selection got weak — but the decisive failure was that the effective population became large enough that lineages never coalesced, so the neutral gene stopped fixing and Q15/Q16 lost their subject. Colour fixation fell to 0.54–0.80 against the generational engine's 0.95, where the acceptance test needs 0.8 in eight seeds of ten. **The sweep in the discrete model is largely a consequence of its bottleneck** — half the population dying every 24 seconds drives coalescence, and hitchhiking rides on that. A hard carrying capacity restores it: reproduction becomes a queue ordered by energy, which is truncation selection in continuous time, and N is pinned so lineages coalesce in roughly 2N generations instead of never.

**Settled at:** 16 creatures, lifespan 60 ± 15 s, reproduce at 10 energy, born with 4, energy capped at 30.

**The reproduction threshold is the selection lever**, and this was not obvious. At 6 a creature reaches it comfortably in a normal life and almost everyone breeds; measured advantage over a same-seed drift control was +0.07. At 10, only good foragers reach the front of the queue: +0.28. At 12 the population starts dying out. (A hypothesis of mine was wrong and is worth recording so nobody re-tests it: I predicted creatures were saturating at the energy ceiling and tying in the queue. Ceilings of 12, 30 and 100 give identical results and the energy spread is 1.5–4.3, so nobody saturates.)

**Starvation is a real rule that almost never fires at the defaults.** A creature dies if its energy reaches zero; measured over ten runs of the shipped world, that happened **zero times** against 309 deaths of old age, and the lowest energy anything reached was 2.54. The reason is a timescale: a newborn holds 4 energy and burns at least 0.05/s, so eating *nothing whatever* it would take 80 seconds to starve — against a mean lifespan of 60. Old age nearly always wins the race. So at the defaults, selection works through *who gets to reproduce* rather than who dies, which is literally the reading's "differential reproduction".

**It does fire once a student makes the world hard**, which is what the new settings are for. One patch instead of four: 3.4 starvation deaths a run. The biggest arena with one patch: 5.3. And switching the light to poison kills an adapted population almost entirely by starvation — see below.

**Starvation is switched off while Selection is off.** With selection off, energy gains are shuffled among the living so that nothing a creature does affects what it earns; starving them on a shuffled number would be death by lottery dressed as death by failure, and it would also make population regulation differ between the two conditions, which is the comparison Part 2 rests on.

**A population of 6 survives about half the time.** Jon's call was that this is a good lesson rather than a bug, so Part 2's small-population experiment will sometimes end with an empty arena and the handout should say why.

## 2. Food: a depleting store became drifting patches

**Spec §3.1** has each light carry a finite store that vehicles draw down; when it empties the light goes out and a new one appears elsewhere.

**What it is now.** Four patches, each delivering a steady flow of energy shared among whoever is feeding on it in proportion to how close each one is, drifting slowly and continuously across the floor at half a unit per second. Nothing depletes and nothing teleports.

**Why, in two steps.**

First, depleting food had to go because its influx depends on consumption, which depends on population, which depends on influx. That feedback loop made every parameter sweep cliff-edged — populations exploded or died with almost nothing between. A patch delivering a fixed flow gives influx = `patches × flow`, independent of how many mouths there are. Across 22 configurations of that model there were **zero extinctions** and strategy parity stayed within 0.97–1.03 regardless of the parameters; depleting food ranged 0.79–1.45 and went extinct across whole regions.

Second, the intermediate version had patches *vanish and reappear elsewhere on a timer*, and Jon's objection was right: food that teleports undoes much of the realism the continuous life cycle buys. Three models, measured against a same-seed no-selection control over ten seeds:

| model | advantage over drift |
|---|---|
| **drifting** | **+0.28** |
| teleporting | +0.23 |
| regrowing in place | ~0.00 |

**Regrowing in place was the obvious candidate and it fails**, which is the most useful thing in this section. It survives beautifully — zero extinctions, mark fixation ten of ten, parity 1.00 — but selection stops working entirely. Food that recovers steadily beneath you means camping one patch pays as well as foraging. Spreading the same influx across 6, 8, 12 and 16 patches did not rescue it. What was doing the work in the teleporting model was not the food's *newness* but its *going away*; drifting keeps that and turns it from a search that restarts from nothing into a tracking problem, which is what a Braitenberg creature's wiring is good or bad at.

**One deliberate departure inside the food model.** Intake is decoupled from a patch's *sensed* strength. The spec has energy accumulate in proportion to sensed intensity, which ties together two knobs the acceptance tests pull in opposite directions: sensed strength sets how far away the gradient is steep enough to steer by, while intake sets how much food the world contains. Coupled, no setting satisfies both the adaptation test and the strategy-parity test. Split, both are reachable.

## 3. Colour changed meaning, and a debt from Lab 1 is settled

**Spec §2** makes `hue` the body colour and a gene that affects nothing.

**What it is now.** **Body colour is read off the wiring genes** — red for the straight connections, green for the crossed, blue for resting drive. Two creatures the same colour are wired the same way, and a population converging in colour is a population whose wiring is converging.

**The neutral trait is still there, and it is still the same gene.** It is worn as a **mark** — a bead on the creature's tail — rather than as the body. No new gene was added; only what gets drawn where changed.

**Why.** Lab 1 spent an hour teaching students that colour identifies the variety, and it was a perfectly reliable cue there. Making colour neutral in Lab 2 would have quietly punished exactly the habit Lab 1 taught — a student applying it would be confirmed within a run (colour and wiring sweep together) and only caught out across populations. Making colour diagnostic keeps the Lab 1 lesson honest and makes evolution watchable in the arena rather than only in a panel.

**Consequence for Part 3.** In the Lineages tab, body colour is hidden along with the wiring, because it would now give the wiring away. It appears on **Reveal wiring**.

**Consequence for the answer key.** The coincidence is no longer the body colour — it is the **mark**. W and X share a body colour because they genuinely are wired alike. What means nothing is that W, X and Z wear the same mark while Y, which actually shares Z's ancestry, wears one 95° away.

## 4. §10's acceptance tests: three restatements

Each is documented in the test that carries it.

**The adaptation test.** §10 asks for mean energy at generation 50 to be at least twice its value at generation 1, in nine seeds of ten. Measured, that criterion is unstable rather than demanding: generation 1's mean is a single noisy number the cost model can push through zero, and across the parameter sweep the configurations that passed it most often were the ones whose denominator happened to sit near zero. Replaced with a same-seed comparison against selection switched off — the lab's own Part 2 logic, with no denominator to blow up. (It is also now moot for a second reason: see §5 below.)

**The mutation-zero plateau.** §10 asks that mean energy at generation 30 be within 2% of generation 15. That is below the world's own noise floor — where food happens to be moves a generation's mean by about ±0.6, which is the size of the entire improvement, so a genetically frozen population drifted 38% between two single generations. Measured between five-generation windows and aggregated over ten seeds the shape is unmistakable: rise +0.61, then +0.01.

**The divergence test, and this one was forced by a conflict inside §10 itself, then restated a second time.** It asks that at least two perturbations separate Y from W and X by a factor of two on **mean distance**. Across 240 candidate branches and 63 candidate Y runs under the generational engine, *no triple that passed the separability test achieved that on mean distance under any perturbation at all*. The reason is structural: mean distance is the statistic separability is defined on, precisely because every approacher ends up near the light whatever took it there. A statistic chosen to be blind to mechanism does not stop being blind when the world is perturbed. What separates them is **how they move rather than where they end up** — Y holds station, W and X keep swinging past — which is also what a student sees.

**The second restatement dropped speed from it.** The first version measured within-vehicle variation in distance *and* speed. Speed is signed now, so a ratio across a sign flip is meaningless — W at +0.67 against Y at −1.05 scores 33, and the test would pass without any perturbation doing anything. Worse, the speed difference is visible in the *default* world, so counting it would let divergence pass on something the student can already see, when the whole point of Q14 is to design a world that shows them something they cannot. Divergence is now **within-vehicle spread of distance alone** — station-keeping, which is the mechanism evidence Q14 asks for. Measured against the shipped fixtures, continuous / discrete engine: a far-floor light 3.9 / 3.3, a rim light 3.4 / 3.2, two lights far apart 2.7 / 3.3. Three clear the bar; the test asks for two.

**The perturbations themselves needed tuning, which the spec does not mention, and one of them described a world nobody could build.** `a light up on the rim` was `[0, 1.7, 7.5]`: height 1.7 implies a ground height of 1, and z = 7.5 is *inside* the arena where the floor is flat at 0. The arena floor sits at ground height 0 and the plateau outside it at `RIM_HEIGHT` = 2, with the cliff walls deliberately not pointer targets, so the only heights a student can ever create are **0.7 inside the bounds and 2.7 outside them**. It was the strongest of the four divergence perturbations and unreachable. The set is now entirely placeable: the rim light moved to `[0, 2.7, 10]`, two lights moved from ±7.5 to ±8.8 (at ±7.5 it scores 1.97 on the continuous engine and misses; at ±4.5 both populations commit to one light and it does nothing), and **a light at the far edge of the floor** added — the strongest placeable option, and the easiest for a student to stumble on. **Sensor noise does not separate them at any level from 0.05 to 0.6**, and neither does removing the light, and both are kept deliberately — Q14 asks a student what they tried that failed.

## 5. Numbers, controls and panels

**Fitness is no longer measured in energy.** Under a continuous life cycle energy is *homeostatic*: it climbs to the reproduction threshold, drops back, and climbs again, so a well-adapted creature does not sit at higher energy than a poor one — it cycles faster. Averaged over a population it is nearly flat whatever is happening. The readout is now **births per minute**, plus population and total born.

**Neutral and poison worlds have grazing; the food world does not.** In the food world the patches *are* dinner, so there is nothing else to eat. Left that way, switching the light to neutral does not mean "the light has no effect" — it means famine: measured, every population died within 45 seconds, and under poison within 17. That is not the control condition Part 2 asks for, and it gives Q7 a population to look at for a quarter of a minute. With ambient food available in the non-food regimes, the words mean what they say. Neutral now leaves the population intact (15.4 → 15.8 over five minutes) while selection on light-seeking simply relaxes. Poison still wipes out a light-seeking population — but now **by starvation, because their inherited behaviour drives them into the hazard**, which is a far better answer to Q7 than "there was nothing to eat". It also means a student switching to poison is looking at the same kind of world population Z evolved in, rather than a different one that happens to share the name.

**What the world sliders actually do**, measured over ten runs each, because a student will find the edges. Enlarging the arena without adding patches is fatal — at the largest setting with the default four patches, nine runs in ten went extinct within about two and a half minutes. **Adding patches compensates exactly as expected**, which makes it a real experiment rather than a trap:

| arena | 4 patches | 6 | 8 | 10 |
|---|---|---|---|---|
| 9 (default) | survives 10/10 | 10/10 | 10/10 | 10/10 |
| 11 | 6/10 | 10/10 | 10/10 | 10/10 |
| 14 (largest) | 1/10 | 7/10 | 10/10 | 10/10 |

Patch *size* is much gentler — the smallest setting alone costs almost nothing (1 extinction in 10), because it changes how far away food can be sensed rather than how much there is. Stationary patches (drift 0) are also survivable, and worth a student trying: it is the condition under which selection largely stops.

**Controls that changed.** "Population size" is now the arena's carrying capacity, which is the same quantity doing a more honest job. "Step generation" is gone, there being no generations. Added, at Jon's suggestion and asked for by nothing in the handout: **size of the arena, size of a food patch, how many patches**, and two **camera view buttons** — a student who does not know the camera tilts has no way to discover it from a drag gesture.

**Speed.** The scene used to scale the *size* of a physics step, so turning speed up coarsened the simulation. Steps are now fixed and speed takes more of them, which allowed the cap to go from 3× to 20×. This matters: at the old cap, what the handout budgets one or two minutes for took nearly seven.

**The lineage tree** has real time on its axis instead of generation columns, and a dendrogram layout. Lines are drawn in each creature's mark, not its body colour, because the tree's job is to show ancestry independently of wiring.

**Other figures that moved from §8:** hue mutation σ from 4 to 2 (at 4 the fixation test passes in four seeds of ten, because a lineage keeps diversifying after it has swept); founder weights drawn at ±1.6 rather than the full ±3 (at full range too many founders are competent by luck and there is nowhere to improve to); §10's "pit radius" read as the arena's half-width, 9 units, since the arena is square.

## 6. The four saved lineages

Two departures from **§9**, both forced.

**They did not all evolve for the same length of time.** Pool P amplifies a trait it already has; pool Q's route to 3a must flip its straight weights through zero, which is a fitness valley, so it reaches comparable behaviour far later. At equal durations the two are five times apart on time-to-arrival and **all 2238 candidate triples died on that criterion alone**. W and X ran 2400 seconds, Y 4800. Nothing requires them to match — they are populations somebody else evolved.

**Z's world has ambient food.** Every attempt at Z went extinct in every seed, within about a minute. Once energy drives reproduction, a world whose only feature is harmful is one where nothing can ever breed — invisible from the discrete model, where energy was only a score. So Z's world has grazing everywhere and dangerous lights, while W's has lights that are dinner. Those are two different worlds, which is what Q7 and Q18 are about.

| | provenance | wiring | arrival | mean distance |
|---|---|---|---|---|
| **W** | pool P, food, seed 7, split at 1800 s, branch 101, 2400 s | 2b, 81% | 9.45 | 1.62 |
| **X** | same run, branch 103 | 2b, 100% | 8.96 | 1.40 |
| **Y** | pool Q, food, seed 2, 4800 s | 3a, 100% | 9.85 | 1.37 |
| **Z** | pool Q, poison + ambient food, seed 4, 4800 s | 2a, 94% | never | 4.41 |

Separability 9.9% on arrival and 0.25 on distance, against bounds of 15% and 0.90. `continuousLineages.test.ts` regenerates all four from their recipes and compares, so the claim that the history is real is checked rather than asserted.

> **§6 was retired rather than met, and this set is unchanged.** Y drives backwards where W and X drive forwards, which is plainly visible and which the separability test was blind to. **§6 is unsatisfiable in this engine** — an inhibitory approacher reverses whenever sensed intensity exceeds `bias / |w|` and steers by `|w| ×` the intensity *difference*, the same scale, so any light bright enough to steer by is bright enough to reverse in; and of the six varieties only 2b and 3a approach at all, so with W and X sharing wiring and Y differing it is always two-against-one. Reversal is *how* a 3a approaches. Part 3 now asks which populations do the same **job** rather than asking a student to sort them, and the lineages did **not** need regenerating. Full argument, all 108 measured configurations, and the four criteria that replaced it: [`M02_SEPARABILITY_PROBLEM.md`](M02_SEPARABILITY_PROBLEM.md).

---

# What the handout needs

Ordered by how badly it is currently wrong.

**"Pit" is now "arena" throughout the app.** One line in the Lab 2 handout says pit — Part 1 step 1, *"place three or four lights around the floor of the pit"* — and that sentence is being rewritten anyway (see below). Worth knowing that **Lab 1's handout says "pit" three times** (lines 8, 29 and 65 of `vehicles_lab.md`): the app and that handout now disagree, so either Lab 1's wording follows, or Lab 2 introduces the new word explicitly. Lab 1's uses are load-bearing — they explain the steep walls and the rim — so they cannot simply be dropped.

**Part 0 — the four "what's new" bullets all need rewriting.**
- Food is not "a light you sit in". It is a patch that **drifts**, delivers a steady flow **shared among whoever is feeding on it**, and never runs out. Crowding costs.
- There are **no generations**. Creatures are born when there is room and die of old age; the arena holds a fixed number.
- **Colour now tells you the wiring** — say so explicitly, because Lab 1 taught them colour was a label and this is a different promise. The **mark** is the inherited trait that isn't about behaviour.
- Right-click removes food; this is load-bearing for Q14 and was undiscoverable.

**Part 1 — Q1 and Q2.**
- "Run for 50 generations" needs to become a duration or a birth count.
- Q2 asks for "the average energy at generation 1 and at generation 50". Energy is homeostatic now; the number that tracks adaptation is **births per minute**, which the panel prints.
- Q2's "body colour of most of the population" becomes **the mark**.
- The "place three or four lights" instruction: they are food patches, and the interesting thing is what adding them does to the birth rate.

**Part 2 — all five experiments.**
- "Run each for about 30 generations" → a duration.
- The small-population experiment can now genuinely end in extinction. Jon wants that kept; it needs a sentence so an empty arena reads as a result rather than a crash.
- "Population size" is now the arena's capacity.

**Part 3 — the largest handout change in the lab, and it is structural.**

- **Q9 and Q10 stop asking students to sort the populations, and ask which do the same job instead.** The old arc was: watch three populations you cannot tell apart, commit to a guess, then design a test that separates them. §6 required the three to be indistinguishable and that is unsatisfiable — Y drives backwards, visibly, and reversal is *how* an inhibitory approacher approaches. So the premise goes. What replaces it is a question the scene genuinely supports: **W, X and Y all reach the light and stay there; Z does not. Which of these four are doing the same job?** Y approaching backwards is still Y approaching — same function, different machinery, which is precisely the analogy Q12 is about, and a student who notices the reversal has noticed something true and useful rather than something that spoils the exercise.
- **The commit-then-test arc survives, re-aimed.** A student can see *that* Y differs; they cannot see *why*, and nothing about driving backwards tells them Y is inhibitory rather than, say, a differently-tuned version of W. Q14's designed perturbation is now what reveals the mechanism: under a far light, a rim light, or two lights far apart, **Y holds station while W and X keep swinging past**. That is the ipsilateral-inhibitory signature — it comes to rest at the source — and it is not visible in the default world. So the student still commits, still designs, and still learns something the watching could not give them.
- **Q11 and Q12 are unaffected.** The wiring reveal still shows W and X contralateral excitatory and Y ipsilateral inhibitory, and the tree still shows Y and Z as cousins.
- **One sentence is owed to Part 3's opening**, saying that the four populations are not presented as a puzzle to be sorted by eye — otherwise a student who spots Y's reversal in the first ten seconds will think they have broken the exercise.
- **Q13 asks for a resemblance that Q9 and Q10 never let the student identify, and Jon has approved the fix.** Q13 wants three answers — homology, analogy, and *neither* — but Q9 scopes the groupings to behaviour, so a student arrives holding W~X, W~Y and X~Y, which are homology, analogy and analogy. There is no "neither" among them. The intended one is the shared *mark*, and nothing between Q9 and Q13 points at it, so the trap is never armed and *"what misled you on the ones you got wrong"* has no referent either. Add one sub-question at **Step 2, before they commit**:

  > **Q10b.** Is there anything *other* than how they behave that makes any two of these four look like they belong together? Write down what you notice, and say whether you think it means anything.

  That arms the trap without giving it away, keeps the commitment structure intact, and costs nothing if a student answers "no" — that is a legitimate answer they can be shown to have been right about for the wrong reason.
- Q14's list of things they can change is right, and worth adding that lights in this tab stay put and never run out — which is what makes a designed test repeatable.

**Part 4.**
- Q15 and Q16 are about **the mark**, not body colour. The mechanism is unchanged; the noun is not.
- Q18: Z's world has food everywhere and dangerous lights. One clause.
- Q20 still owes its two run logs in the report document, and they should come from real runs — I can generate them once the handout's other numbers are settled.

---

# What needs your decision

1. ~~**Q13's unarmed trap.**~~ Settled — the Q10b wording above is approved and needs adding to the handout.
2. ~~**Whether starvation matters.**~~ Settled — it stays as it is. It fires when a student makes the world hard, which is where it belongs.
3. ~~**Part 3's separability wants your eye.**~~ **Settled.** Jon sorted Y from W and X on sight; the speed metric took an absolute value and could not see it. §6 turned out to be unsatisfiable in this engine rather than merely unmet, so it was retired and Part 3 re-aimed at "which of these do the same job". Nothing was regenerated. Verified by eye at `localhost:5173` on 2026-09-01. [`M02_SEPARABILITY_PROBLEM.md`](M02_SEPARABILITY_PROBLEM.md).
