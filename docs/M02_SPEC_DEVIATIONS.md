# Module 2 — where the build departed from the spec

Written for Jon to carry into the Box copies of `m02_evolution_SCENE_SPEC.md` and `evolution_lab.md`. Nothing in Box was edited from this repo.

Every number here was measured, not chosen. Where a spec figure turned out to be unreachable, the section says which measurement showed it and what replaced it.

Two things did not change and are worth saying first, because everything else is easier to read against them. **The genome is still six genes** — the same four connection strengths and bias the creature carried in Lab 1, plus one that does nothing. And **the wiring panel is still literally the Lab 1 component**: it moved to `components/WiringPanel` and both scenes render it, so Part 3 asks a student to open an instrument they have already used rather than a lookalike.

---

## 1. The largest change: generations became continuous

**Spec §3** specifies discrete generations — all N creatures run for a fixed length, are ranked by energy, and the top half each leave two offspring.

**What it is now.** Every creature carries an energy store and a lifespan. Energy rises while it feeds and falls while it lives and moves. When the store fills, it reproduces as soon as the pit has room; when its life runs out, it dies. Nothing resets and nothing is ranked. The pit supports a fixed number — 16 by default — and a creature is born only when a slot opens, which goes to whoever has the fullest store.

**Why.** Jon's judgement that students find discrete generations confusing, and it survived measurement: the continuous engine matches the generational one on every acceptance test and beats it on two.

**The one thing that made it work.** The first continuous attempt failed, and instructively. Removing the generational bottleneck removed two things at once, and only one was obvious. Selection got weak — but the decisive failure was that the effective population became large enough that lineages never coalesced, so the neutral gene stopped fixing and Q15/Q16 lost their subject. Colour fixation fell to 0.54–0.80 against the generational engine's 0.95, where the acceptance test needs 0.8 in eight seeds of ten. **The sweep in the discrete model is largely a consequence of its bottleneck** — half the population dying every 24 seconds drives coalescence, and hitchhiking rides on that. A hard carrying capacity restores it: reproduction becomes a queue ordered by energy, which is truncation selection in continuous time, and N is pinned so lineages coalesce in roughly 2N generations instead of never.

**Settled at:** 16 creatures, lifespan 60 ± 15 s, reproduce at 10 energy, born with 4, energy capped at 30.

**The reproduction threshold is the selection lever**, and this was not obvious. At 6 a creature reaches it comfortably in a normal life and almost everyone breeds; measured advantage over a same-seed drift control was +0.07. At 10, only good foragers reach the front of the queue: +0.28. At 12 the population starts dying out. (A hypothesis of mine was wrong and is worth recording so nobody re-tests it: I predicted creatures were saturating at the energy ceiling and tying in the queue. Ceilings of 12, 30 and 100 give identical results and the energy spread is 1.5–4.3, so nobody saturates.)

**Starvation almost never happens.** In every surviving configuration, essentially all deaths are old age. Selection works through *who gets to reproduce*, not who dies — which is literally the reading's "differential reproduction", but it is not the energy-bar-hits-bottom death the design imagined. Every setting that produced reliable starvation also killed the population.

**A population of 6 survives about half the time.** Jon's call was that this is a good lesson rather than a bug, so Part 2's small-population experiment will sometimes end with an empty pit and the handout should say why.

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

**The neutral trait is still there, and it is still the same gene.** It is worn as a **mark** — a bead above the body — rather than as the body. No new gene was added; only what gets drawn where changed.

**Why.** Lab 1 spent an hour teaching students that colour identifies the variety, and it was a perfectly reliable cue there. Making colour neutral in Lab 2 would have quietly punished exactly the habit Lab 1 taught — a student applying it would be confirmed within a run (colour and wiring sweep together) and only caught out across populations. Making colour diagnostic keeps the Lab 1 lesson honest and makes evolution watchable in the pit rather than only in a panel.

**Consequence for Part 3.** In the Lineages tab, body colour is hidden along with the wiring, because it would now give the wiring away. It appears on **Reveal wiring**.

**Consequence for the answer key.** The coincidence is no longer the body colour — it is the **mark**. W and X share a body colour because they genuinely are wired alike. What means nothing is that W, X and Z wear the same mark while Y, which actually shares Z's ancestry, wears one 95° away.

## 4. §10's acceptance tests: three restatements

Each is documented in the test that carries it.

**The adaptation test.** §10 asks for mean energy at generation 50 to be at least twice its value at generation 1, in nine seeds of ten. Measured, that criterion is unstable rather than demanding: generation 1's mean is a single noisy number the cost model can push through zero, and across the parameter sweep the configurations that passed it most often were the ones whose denominator happened to sit near zero. Replaced with a same-seed comparison against selection switched off — the lab's own Part 2 logic, with no denominator to blow up. (It is also now moot for a second reason: see §5 below.)

**The mutation-zero plateau.** §10 asks that mean energy at generation 30 be within 2% of generation 15. That is below the world's own noise floor — where food happens to be moves a generation's mean by about ±0.6, which is the size of the entire improvement, so a genetically frozen population drifted 38% between two single generations. Measured between five-generation windows and aggregated over ten seeds the shape is unmistakable: rise +0.61, then +0.01.

**The divergence test, and this one was forced by a conflict inside §10 itself.** It asks that at least two perturbations separate Y from W and X by a factor of two on **mean distance**. Across 240 candidate branches and 63 candidate Y runs under the generational engine, *no triple that passed the separability test achieved that on mean distance under any perturbation at all*. The reason is structural: mean distance is the statistic separability is defined on, precisely because every approacher ends up near the light whatever took it there. A statistic chosen to be blind to mechanism does not stop being blind when the world is perturbed. What separates them is **how they move rather than where they end up** — Y holds station, W and X keep swinging past — which is also what a student sees. Measured on within-vehicle variation in distance and on speed, the current fixtures separate by 5.42 and 3.16 on two perturbations, with a third at 1.97.

**The perturbations themselves needed tuning, which the spec does not mention.** Two lights separate the populations at ±7.5 units and not at all at ±4.5; a light must be removed at 5 seconds, not mid-run, or both populations have already settled into the same end state. **Sensor noise does not separate them at any level from 0.05 to 0.5**, and is kept deliberately — Q14 asks a student what they tried that failed.

## 5. Numbers, controls and panels

**Fitness is no longer measured in energy.** Under a continuous life cycle energy is *homeostatic*: it climbs to the reproduction threshold, drops back, and climbs again, so a well-adapted creature does not sit at higher energy than a poor one — it cycles faster. Averaged over a population it is nearly flat whatever is happening. The readout is now **births per minute**, plus population and total born.

**Controls that changed.** "Population size" is now the pit's carrying capacity, which is the same quantity doing a more honest job. "Step generation" is gone, there being no generations. Added, at Jon's suggestion and asked for by nothing in the handout: **size of the pit, size of a food patch, how many patches**, and two **camera view buttons** — a student who does not know the camera tilts has no way to discover it from a drag gesture.

**Speed.** The scene used to scale the *size* of a physics step, so turning speed up coarsened the simulation. Steps are now fixed and speed takes more of them, which allowed the cap to go from 3× to 20×. This matters: at the old cap, what the handout budgets one or two minutes for took nearly seven.

**The lineage tree** has real time on its axis instead of generation columns, and a dendrogram layout. Lines are drawn in each creature's mark, not its body colour, because the tree's job is to show ancestry independently of wiring.

**Other figures that moved from §8:** hue mutation σ from 4 to 2 (at 4 the fixation test passes in four seeds of ten, because a lineage keeps diversifying after it has swept); founder weights drawn at ±1.6 rather than the full ±3 (at full range too many founders are competent by luck and there is nowhere to improve to); §10's "pit radius" read as the pit's half-width, 9 units, since the pit is square.

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

---

# What the handout needs

Ordered by how badly it is currently wrong.

**"Pit" is now "arena" throughout the app.** One line in the Lab 2 handout says pit — Part 1 step 1, *"place three or four lights around the floor of the pit"* — and that sentence is being rewritten anyway (see below). Worth knowing that **Lab 1's handout says "pit" three times** (lines 8, 29 and 65 of `vehicles_lab.md`): the app and that handout now disagree, so either Lab 1's wording follows, or Lab 2 introduces the new word explicitly. Lab 1's uses are load-bearing — they explain the steep walls and the rim — so they cannot simply be dropped.

**Part 0 — the four "what's new" bullets all need rewriting.**
- Food is not "a light you sit in". It is a patch that **drifts**, delivers a steady flow **shared among whoever is feeding on it**, and never runs out. Crowding costs.
- There are **no generations**. Creatures are born when there is room and die of old age; the pit holds a fixed number.
- **Colour now tells you the wiring** — say so explicitly, because Lab 1 taught them colour was a label and this is a different promise. The **mark** is the inherited trait that isn't about behaviour.
- Right-click removes food; this is load-bearing for Q14 and was undiscoverable.

**Part 1 — Q1 and Q2.**
- "Run for 50 generations" needs to become a duration or a birth count.
- Q2 asks for "the average energy at generation 1 and at generation 50". Energy is homeostatic now; the number that tracks adaptation is **births per minute**, which the panel prints.
- Q2's "body colour of most of the population" becomes **the mark**.
- The "place three or four lights" instruction: they are food patches, and the interesting thing is what adding them does to the birth rate.

**Part 2 — all five experiments.**
- "Run each for about 30 generations" → a duration.
- The small-population experiment can now genuinely end in extinction. Jon wants that kept; it needs a sentence so a dead pit reads as a result rather than a crash.
- "Population size" is now the pit's capacity.

**Part 3.**
- **Q13 asks for a resemblance that Q9 and Q10 never let the student identify.** It wants three answers — homology, analogy, and *neither* — but Q9 scopes the groupings to behaviour, so the student arrives holding W~X, W~Y and X~Y, which are homology, analogy and analogy. The "neither" is the shared *mark*, and nothing in Part 3 points at it. Suggested fix: one sub-question at Step 2, before they commit — *"Is there anything other than how they behave that makes any two of these look like they belong together? Say whether you think it means anything."* That arms the trap without giving it away and makes Q13's "what misled you" land.
- Q14's list of things they can change is right, and worth adding that lights in this tab stay put and never run out — which is what makes a designed test repeatable.

**Part 4.**
- Q15 and Q16 are about **the mark**, not body colour. The mechanism is unchanged; the noun is not.
- Q18: Z's world has food everywhere and dangerous lights. One clause.
- Q20 still owes its two run logs in the report document, and they should come from real runs — I can generate them once the handout's other numbers are settled.

---

# What needs your decision

1. **Q13's unarmed trap** — the sub-question above, or drop the third slot and give the coincidence its own question after Reveal tree.
2. **Whether starvation matters to you.** It essentially never fires. If you want visible death-by-starvation the lever is the starvation threshold rather than the maintenance cost, which kills every population when raised — but I have not found a setting that gives both starvation and survival.
3. **Part 3's separability wants your eye, not only my numbers.** The tests say W, X and Y match to 9.9% on arrival and 0.25 on distance. The question that matters is whether *you* can sort them by watching. If you can, that is much better found now than by a student.
