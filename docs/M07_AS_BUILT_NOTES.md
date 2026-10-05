# Module 7 as built — notes for the session that writes the handout

Written 2026-10-04 by the session that built `m07-fish`, from the code on branch `m07-fish` and from measurements, for whoever writes `fish_lab.md`. **The handout does not exist yet.** It is written after Jon's walk-through (`LAB_7_WALKTHROUGH.md`, beside the scene spec in the course folder), from these notes as that walk corrects them. The scene is not merged and not deployed.

**Every number here was measured, not predicted.** Unless a line says otherwise: six seeds (1000 to 1005), the scenario exactly as it loads with *Learning on* switched on, and accuracy on the scenario's test set. "Of 20" means seeds 1000 to 1019. The probe that produced them is `src/sim/fish/crib.probe.ts`, and `npm run closeout m07-fish` prints them. A handout that quotes a number should quote one from §3, and should say "about", because the scene opens on a random seed and a student's numbers will fall inside these ranges, not on their means.

**The handout may assert what the close-out's claim list says and nothing it cannot find there.** Sixty-three claims about what the scene makes true (`scripts/labs.config.mjs`, entry `m07-fish`); sixty-two name the test that goes red if it stops being true. One has no test: what the fish visibly does (turns, darts, is struck or fed), which only a person can see.

---

## 1. Every control, as it shipped

Five tabs: **World**, **Network**, **Learning**, **Decision**, **Fish**. The stream is always on screen. The transport bar at the bottom is Lab 5's (play/pause, step, reset, speed 0.25× to 8×). **Step** runs one whole encounter. Beside it, on every tab: **Skip ahead 100 encounters** and **Skip ahead 1,000 encounters**. Presses add up, they work while paused, and a badge reads *Skipped ahead 1,000 encounters — 3,000 so far*, adding *learning is off, so no weight changed* when that is the case.

A badge at the top of the stream is always on screen: *Encounter 124 — smell A 0.72, B 0.41 · evidence 0.31 against criterion 0.00 → dart to cover*, and once the outcome arrives, a sentence saying what happened and which of the four outcomes it was, for example *An eel lunged at empty water. The fish had darted to cover. (Hit)*.

**The stream view, as revised 2026-10-04 after Jon first opened the scene.** All of it is drawing (`meshes.tsx`); the verdict is still at 1.0 s and the outcome at 1.6 s, and no number in §3 moved. **An encounter is now 4.0 s at 1×, not 2.5**: the outcome plays out in about a second and then the water is still for a second and a half, with the fish back in its place, before the next smell (Jon, 2026-10-05: at 2.5 s the stream looked frantic).

- **A smell is a loose cloud of specks, not an object**: pink specks for receptor A's response and green for receptor B's, up to 30 of each, the number of each in proportion to that response (an eel at 0.75, 0.45 is about 22 pink and 14 green; a far smell has a third as many). It is carried at the water's speed (7.5 units a second), reaches the fish's nose as the verdict is taken, and washes on past it, fading. The same two colors mark receptors A and B on the diagram and the two axes of the feature space, and a line on the World tab's right panel says what they mean.
- **The current** is specks hanging in the water at several depths, moving at the same speed as the smell. The bed and its stones do not move.
- **Each animal has its own shape**, a chain of beads like the fish's body: the eel long, thin and winding, olive; the pike a straight spear with a broad tail, green; the sucker stout, tan; the chub short and deep, pale brass. None is the feature space's blue or orange. **Each animal comes from where its smell came from.** An eel or pike lunges head first, straight down the line its smell took, to where the fish was, and backs away along it. A sucker or chub is carried down from the same place and past the fish on that side, at about the water's speed, and is gone before the next smell.
- **A fruit** falls in upstream with a ripple and drifts down behind its smell as a dim shape, coming to rest in front of the fish as the outcome arrives. Once tasted it shows what it was: cherry red and yellow for the two ripe kinds, a squashed brown one for rotting, a brown stick for a twig, and one plum color for every fruit in Part 4. Eaten, it is gone.
- **Cover** is the large pale rock at the right with weed in its lee. The fish ends behind it, clear of the rock, whole body in view, facing upstream.

### World tab (left panel, "The world")

| Name on screen | Range | Default | Where it appears |
|---|---|---|---|
| **Scenario** | seven entries: *Part 1 — One line will do*, *Part 2 — Jumpy or blind?*, *Part 3 — Ripe or rotting*, *Part 4 — Built in, wired at random, or learned*, *Part 5a — The eels it has met*, *Part 5b — Downstream*, *Closer — A new predator* | Part 1 | always |
| **Go to phase 1**, **Go to phase 2**, **Go to phase 3: An eel comes back**, with **Now in** printing the phase | — | phase 1 | Closer |
| **Eels and suckers stay around** (toggle) | — | off | Closer |
| **Go downstream** (becomes **Go back upstream**) | — | upstream (near) | Part 5b |
| **Learn from every distance** (toggle) | — | off | Part 5b |
| **Proportion of A (a built-in receptor)** (toggle), and under it once on, **Proportion only (receptors A and B disconnected)** | — | off | Part 5b |
| **Where the encounters come from** | *a small pool* / *a stream* | pool in 5a, stream elsewhere | a menu in Part 5a; printed elsewhere |
| **How many individuals live here** | 6 to 60, step 2 | 12 | Part 5a, while the source is a pool |
| **How much smells vary** | 0.04 to 0.20, step 0.01 | 0.06 (0.15 in Parts 2 and 5a) | a slider in Parts 1, 3, 5a; printed and locked in 2, 5b and the Closer; absent in Part 4 |
| **Reset**, **New seed**, **Run seed** printed | — | random seed | always |

**Reset** starts the run again from the same seed with every control where it was left and **the weights back where the run started** (Lab 5's rule). A weight set by hand counts as where the run started. In the Closer it also returns to phase 1. **New seed** gives a different stream and different test sets and, where starting weights are drawn at random, different starting weights. Changing the number of hidden units, the hidden-layer setting, a built-in receptor, the pool size or the source of encounters starts the run again with a new network.

Right panel, "This world": **What the world does** (one line per kind of thing now in the stream, then *The outcome arrives on every encounter, whatever the fish did*, where the encounters come from, the distance in 5b, and *The verdict goes to: dart to cover (locked)* or *eat (locked)*); the murky-water line and the orienting line; **What is in the stream** (each kind with its typical smell); **Scorecard**: *Encounters*, *Harm taken*, *Meals*, *Percent of verdicts right*, and in a pool *Meetings per individual, on average*.

Harm and meals: with the verdict routed to *dart to cover*, the fish is harmed when it stays and an eel or pike was there, and gets a meal when it stays and nothing dangerous was. Routed to *eat*, a meal is a nourishing fruit eaten, and harm is a rotting or wrong-strength fruit eaten.

### Network tab (left panel, "The network")

| Name on screen | Range | Default | Locked where |
|---|---|---|---|
| **Number of hidden units** | 0 to 8 | per scenario | unlocked in Parts 3, 4, 5a; printed elsewhere. Under *Fixed at random* it is set on the Learning tab instead |
| **activation function** | *threshold function (a hard step)* / *sigmoid function (an S-shaped curve)* | sigmoid | unlocked in Parts 3 and 4 |
| **Built-in receptors**: **Both together: x₁ · x₂**, **Distance from the ideal strength: 2 · [(x₁ − 0.5)² + (x₂ − 0.5)²]**, **Proportion of A: x₁ / (x₁ + x₂ + 0.02)** (toggles, each with a *Responds to…* line) | — | all off | shown in Parts 3 and 4 only |
| **The output unit**: **weight b₁ — from receptor A** and so on (from each receptor, or from each hidden unit when there are any), **baseline b₀**; its **criterion (its threshold θ)** is printed here and set on the Decision tab | weights and baseline −6 to 6, step 0.1 | 0 | sliders in Parts 1, 3, 4; printed elsewhere |
| **Hidden unit 1** … **Hidden unit 8** (a collapsed section each): a weight from each receptor, **baseline b₀**, **threshold θ** | −6 to 6, step 0.1 | 0 by hand; drawn at random otherwise | sliders in Parts 3 and 4 unless the layer is *Fixed at random* |
| **Restore the wiring this scenario started with** | — | — | always |

The sliders stay live and move by themselves while the rule is changing them.

Right panel, "What the network is doing":

- **The feature space** — receptor A across, receptor B up, 0 to 1. Filled dots are the last 300 encounters, blue where the outcome happened and orange where it did not. The shading is the output unit's prediction for every smell. **The white line is the decision boundary**, drawn where the evidence equals the effective criterion. The smell now in front of the fish is ringed. Switches: **Show the test set** (hollow dots) and **Show each kind’s average (its prototype)** (two large crosses). The dots line is printed under it.
- **The diagram** — receptors on the left (A and B round; a built-in receptor a dashed square labeled *(built in)*), hidden units each drawn as a square showing that unit's own output over the smell space, the output unit, the routing switch, and the verdict. Green lines excitatory, red inhibitory, thickness by strength. **Pointing at a hidden unit** shades the feature space with that unit's output instead, and prints that unit's arithmetic on the Learning tab. With more than eight units, eight are drawn with *and 192 more*, and under *Fixed at random* a line reads *For the smell now, 36 of 200 hidden units are active*.
- **The hidden-activity space** — shown with two or more hidden units. Each recent encounter at its position in the output of two hidden units, with each kind's typical smell as a large labeled marker. With exactly two hidden units the output unit's line is drawn. With more, two menus (**across**, **up**) choose the pair and no line is drawn, with a sentence saying why.
- **The learning curve** — percent wrong against encounters: one line for recent training encounters (the last 300, as the fish met them) and one for each test set, with each line's present value printed.

### Learning tab (left panel, "The learning rule")

| Name on screen | Range | Default | Locked where |
|---|---|---|---|
| **Learning on** (toggle) | — | **off in every scenario** | printed and locked off in Part 2 |
| **learning rate η** | 0.01 to 1, log scale, two significant figures | 0.2 | locked in Part 2 |
| **Who sets the hidden weights?** — three cards: **By hand** (§7.2.6), **Pass the error back** (§7.2.7, backpropagation), **Fixed at random** (§7.2.7, dimensionality expansion and sparse coding), each with *A hidden weight’s change depends on:* and the line under the setting | — | By hand in Parts 1 to 4 and 5b; Pass the error back in 5a and the Closer | selectable in Parts 3 and 4 only |
| **Number of hidden units, fixed at random** | 2 to 200, log scale | — | shown under *Fixed at random* |
| **Sparse: about one unit in ten active at once** (toggle) | — | off | shown under *Fixed at random* |
| **Start from new random weights** | — | — | shown in Parts 3 and 4 under *Pass the error back* or *Fixed at random* |

Selecting **Pass the error back** keeps a hidden layer that was set by hand, so a hand-built network can be handed to the rule. If the hidden layer is blank (every weight zero), it is given small random starting weights instead, because units that start alike stay alike. **Start from new random weights** draws a fresh start. The backpropagation line and the Lab 5 reminder are at the foot of the panel.

Right panel, "What the rule is doing": **The arithmetic**, for the last encounter. Under *The output unit*: *a — what arrived*, *p — the prediction, made before and held*, *Φ = a − p*, the target line, and one line per connection, `Δb₁ = η · h₁ · Φ = 0.2 · 0.93 · 0.013 = 0.002`, plus the baseline's. Under *Hidden unit 1* (or whichever unit is pointed at on the diagram): *its slope, f′(net)*, *the weight from it to the output*, *the output unit’s Φ*, *Φ = slope · weight · output’s Φ*, a paragraph naming where this Φ comes from, and the unit's own lines. Under *By hand* or *Fixed at random* it says the rule does not reach this unit. Then **The learning curve** again, with *Encounters so far* and, in a pool, *Meetings per individual, on average*.

### Decision tab (left panel, "The decision")

| Name on screen | Range | Default | Locked where |
|---|---|---|---|
| **criterion** | −3 to 3, step 0.05, on the evidence axis | 0 | a slider in Parts 1, 2, 3, 4; printed elsewhere |
| **arousal and vigilance** | 0 to 3 | 1 | sliders in Part 2 only |
| **satiety and tone** | 0 to 1 | 1 | sliders in Part 2 only |
| *moved by arousal and vigilance*, *moved by satiety and tone*, **effective criterion** (printed) | — | 0, 0, 0 | always shown |
| **How often an eel is upstream** | 10% to 90%, step 5 | 50% | Part 2 only |
| **What each outcome is worth**: a menu with **The fish’s stakes** and **The reading’s example**, and four boxes: *a hit is worth*, *a miss is worth*, *a false alarm is worth*, *a correct rejection is worth* | any number | The fish’s stakes: 0, −20, 0, +1 | Part 2 only |
| **Score this criterion** | — | — | Part 2 only |

Each unit of arousal above 1 lowers the effective criterion by 0.25; each tenth of satiety below 1 raises it by 0.1. *The reading’s example* is hit 0, miss −1, false alarm −15, correct rejection 0. Typing into a box makes the menu read *Your own numbers*.

Right panel, "Signal detection": **The evidence** (two histograms of the output unit's evidence on the test set, the criterion as a white line, the bars beyond it bright, the two means dashed, and **d′** printed between them); **The scorecard** (the four counts in the chapter's table layout, named Hit, Miss, False alarm, Correct rejection, then *hit rate*, *false-alarm rate*, *percent correct* and **Energy per 100 encounters**, all on the test set at the criterion now in force); **Energy against criterion** (one point per press of *Score this criterion*, the best white; cleared when the stakes or the base rate change); **By hand** (four boxes for counts, opening on 42, 8, 8, 42, and below them the hit rate, the false-alarm rate, *d′ = z(hit rate) − z(false-alarm rate)*, the criterion's position with the word *liberal*, *neutral* or *conservative*, and percent correct).

### Fish tab

Buttons **Healthy**, **F1**, **F2**, **F3**, **F4**. Loading one switches the scenario to Part 2 and puts that fish in it at the same seed, so all five face the same test set. For F1 to F4: **Reveal** (becomes *Hide again*), and for F4 a toggle **This fish’s stream**. Right panel: **The four counts** for the loaded fish, **Revealed** (the one change, where it lives, what gives it away) once revealed, and the **By hand** box again.

**Until Reveal, F1 to F4 hide every number**: the Network tab keeps the diagram's structure and the dots on the feature space but withholds the shading, the boundary line, the thumbnails and every slider; the Learning tab and the Decision tab's left panel are withheld; the evidence histograms, rates and energy are withheld. What stays: the stream, the World tab's scorecard, the four counts, and the By hand box.

---

## 2. Every scenario, as it shipped

Every scenario loads with **learning off**, η = 0.2, the criterion at 0, both modulators at 1, the base rate at 50%, and a random seed. Every two-way problem is drawn half one outcome and half the other.

| Key | Menu title | In the stream | Outcome | Loads with | Unlocked | Test sets |
|---|---|---|---|---|---|---|
| `one-line` | Part 1 — One line will do | eel (0.75, 0.45), sucker (0.45, 0.60); stream; spread 0.06 | eel lunges; sucker drifts past | no hidden units; weights 0, 0; baseline 0; sigmoid; verdict to *dart to cover* | output weights, baseline, criterion, spread, Learning on, rate | 200 |
| `diagnosis` | Part 2 — Jumpy or blind? | the same two; spread 0.15 | the same | no hidden units; the healthy fish: weights 2.9, −1.6, baseline −0.9 | criterion, both modulators, stakes, base rate. Nothing on the network; learning locked off | **2,000** |
| `fruit` | Part 3 — Ripe or rotting | twig or leaf (0.15, 0.15), ripe fruit first kind (0.85, 0.15), ripe fruit second kind (0.15, 0.85), rotting fruit (0.85, 0.85); spread 0.06 | ripe nourishes; rotting sickens; a twig is nothing to eat | no hidden units; verdict to *eat* | everything on the Network and Learning tabs, the three built-in receptors, criterion, spread | 200 |
| `island` | Part 4 — Built in, wired at random, or learned | fruit anywhere in the square, half inside the disk and half outside | nourishes within 0.25 of (0.5, 0.5); sickens outside | no hidden units; verdict to *eat* | the same as Part 3, without spread | 200 |
| `pool` | Part 5a — The eels it has met | eel and sucker; **a pool of 12 individuals** (6 and 6), spread 0.15 | as Part 1 | 8 hidden units, *Pass the error back* | number of hidden units, spread, source, pool size, Learning on, rate | 200 |
| `downstream` | Part 5b — Downstream | eel and sucker; stream; spread 0.06; near | as Part 1 | no hidden units | Learning on, rate, and the four Distance controls | **near** 200 and **far** 200 |
| `new-predator` | Closer — A new predator | phase 1 eel and sucker; phase 2 pike (0.15, 0.90) and chub (0.95, 0.10); phase 3 an eel next, then all four | eel and pike lunge; sucker and chub drift past | 6 hidden units, *Pass the error back*; spread 0.06 | Learning on, rate, the phase buttons, *Eels and suckers stay around* | **eel and sucker** 200, **pike and chub** 200 |

**The smell of one encounter** is the individual's own smell (its kind's typical smell moved by *How much smells vary*) plus a small jitter on every sniff (0.02), held in 0 to 1. **Far** multiplies the individual's smell by 0.3 and leaves the jitter as it is. In a **pool**, each individual's own smell is drawn once and only the jitter varies between meetings.

**What the handout should not say.** *Epoch* and *loss* are not on screen: the scene counts encounters, and in a pool meetings per individual; the curve plots percent wrong. The hidden layer's settings are *By hand*, *Pass the error back* and *Fixed at random*; *Competition* was not built. There is no *Morph* switch. The hidden units have no names; the handout can call the two in the chapter's network the OR unit and the NOT-AND unit, but the scene calls them hidden unit 1 and hidden unit 2.

---

## 3. Every number a student will read off the screen

### Part 1 — `one-line`

- **Learning on, then Skip ahead.** The test set reaches 95% after **50 to 200 encounters (median 150)**. After 100 encounters it is at 44 to 99% (mean 76), so one press of *Skip ahead 100* is often not enough; after 300 it is 96 to 100%. **The handout should say three presses.**
- **The weights it arrives at.** After 300: from A 2.04 to 2.22, from B −1.38 to −1.56, baseline −0.46 to −0.67. After 1,000: from A 3.67 to 3.83, from B −2.29 to −2.56, baseline −0.72 to −1.05. They keep growing slowly, because two clouds a line separates cleanly can always be separated a little more confidently.
- **By hand.** Weights 3 and −1.5 with baseline −1 score 100% on the test set. Many settings do.
- **Raising *How much smells vary*** (learning on, 1,000 encounters): 0.06 → 96 to 100%; 0.10 → 75 to 96% (mean 89); 0.15 → 64 to 86% (mean 80); 0.20 → 60 to 80% (mean 73).

### Part 2 — `diagnosis`

The test set is 2,000 encounters, about 1,000 with an eel and 1,000 without. Counts vary by a few tens from seed to seed.

| | Hits | Misses | False alarms | Correct rejections | Hit rate | False-alarm rate | Percent correct | d′ on the panel | d′ by hand | Energy per 100, fish’s stakes |
|---|---|---|---|---|---|---|---|---|---|---|
| Healthy | 838–875 | 127–163 | 109–145 | 849–889 | 0.84–0.87 | 0.11–0.15 | 85.4–88.2 | 2.13–2.34 | 2.11–2.37 | −120 to −83 |
| F1 | 977–999 | 15–22 | 448–471 | 521–546 | 0.98–0.99 | 0.45–0.47 | 75.5–76.5 | the healthy fish’s | 2.14–2.28 | +5 to +12 |
| F2 | 430–468 | 540–571 | 8–15 | 966–994 | 0.43–0.46 | 0.01–0.02 | 70.7–72.5 | the healthy fish’s | 1.99–2.30 | −522 to −491 |
| F3 | 707–738 | 270–303 | 264–289 | 703–733 | 0.70–0.73 | 0.27–0.29 | 71.0–73.3 | **1.10–1.24** | 1.10–1.24 | −268 to −234 |
| F4 | 988–1004 | 5–15 | 522–543 | 449–473 | 0.99–1.00 | 0.53–0.55 | 72.5–73.2 | the healthy fish’s | 2.09–2.47 | +8 to +18 |

- **F2 and F3 are the pair**: 71.8 and 72.0 percent correct on average, and a false-alarm rate of 0.01 against 0.28.
- **The one change in each**: F1, *arousal and vigilance* at 3 (effective criterion −0.50). F2, *satiety and tone* at 0.4 (effective criterion +0.60). F3, weights 0.3 and −3.3 with baseline 1.55, the same length as the healthy fish's 2.9 and −1.6, and the evidence still zero midway between the typical eel and the typical sucker. F4, criterion −0.60.
- **Weight direction, not size.** Scaling the healthy fish's weights and baseline by 0.5 or by 2 changes d′ by less than 0.05. F3's d′ is about 52% of the healthy fish's.
- **The best criterion** (the one earning most on the 2,000, swept in steps of 0.05):

| Stakes | Eels 20% | Eels 50% | Eels 80% |
|---|---|---|---|
| The fish’s stakes | −0.55 to −0.30, earning 33 to 50 | **−0.75 to −0.60**, earning 9 to 18 (at a criterion of 0: −120 to −83) | −1.15 to −0.80, earning 1 to 5 |
| The reading’s example | 0.85 to 1.05, earning −18 to −15 | **0.50 to 0.70**, earning −38 to −32 (at 0: −116 to −88) | 0.20 to 0.40, earning −40 to −29 |

- **F4 in its own stream** (eels 80%, the fish's stakes): F4 earns −14 to −2 per 100 and the healthy fish −228 to −183.
- **Score this criterion is noisy.** Five presses at a criterion of 0 gave −55, −84, −114, −81, −89: a miss costs 20 and there are about 35 of them in 500. A sweep still shows the shape, because the range from a criterion of 0 to the best one is more than 100. The *Energy per 100 encounters* on the scorecard is the same quantity on the fixed 2,000 and does not jump.
- **The face-memory testers** in the By hand box: 42, 8, 8, 42 gives d′ **1.99**, criterion 0.00 (neutral), 84.0%. 49, 1, 25, 25 gives d′ **2.05**, criterion −1.03 (liberal), 74.0%.
- **d′ from the rates as the criterion moves**: within ±0.15 of the panel's d′ across the middle half of the evidence, and within ±0.4 across the middle 80%. See §5.

### Part 3 — `fruit`

- **No hidden units, learning on**: 44 to 78% after 1,000 and 25 to 73% after 5,000, never settling. The line wanders.
- **The two prototype crosses** sit within 0.05 of each other, both near (0.5, 0.5).
- **The chapter's network by hand**, threshold function: hidden unit 1 weights 1 and 1, baseline −0.5 (OR); hidden unit 2 weights −1 and −1, baseline 1.5 (NOT-AND); output weights 1 and 1, baseline −1.5 (AND). All four typical smells come out right, and the test set scores 95% or better. The same lines can be placed with the thresholds instead of the baselines (0.5, −1.5, and a criterion of 1.5); **use the baselines if the network is to be handed to the rule afterwards**, because learning never moves a criterion.
- **Pass the error back, threshold function**: no hidden weight moves in 1,000 encounters, and the slope on the Learning tab reads 0.000. The output's weights do move.
- **Pass the error back, sigmoid**, of 20 seeds reaching 95% within 2,000 encounters:

| Hidden units | Seeds that reach 95% | When they do |
|---|---|---|
| 1 | 0 of 20 | never |
| 2 | **13 of 20** | 200 to 1,950 (median 600) |
| 3 | 18 of 20 | 200 to 1,250 (median 500) |
| 4 | 20 of 20 | 200 to 1,050 (median 400) |
| 6 | 20 of 20 | 200 to 700 (median 250) |
| 8 | 20 of 20 | 200 to 600 (median 250) |

- **Two hidden units stick in 7 seeds of 20**, at 55 to 80% (mean 72).
- **Which corners land together.** Of the 13 two-unit runs that solve it, the two ripe corners land together in hidden space in 9, and the twig and the rotting fruit land together in 4. See §5.
- **Both together** on, no hidden units: 95% after 150 to 250 encounters, in every seed. **Distance from the ideal strength** on instead: 27 to 64% after 5,000.

### Part 4 — `island`

- **No hidden units**: 32 to 53%.
- **Built in.** *Distance from the ideal strength*: 95% after **100 to 500 encounters (median 200)**, every seed. *Both together* instead: 44 to 55% after 5,000.
- **Wired at random** (only the output learns):

| Units | Not sparse, after 1,000 | Not sparse, after 5,000 | Sparse, after 1,000 | Sparse, after 5,000 | Reach 95% within 5,000 (not sparse / sparse) |
|---|---|---|---|---|---|
| 2 | 48–81% (mean 62) | 53–82% (67) | 53–80% (70) | 42–82% (66) | 0 of 6 / 0 of 6 |
| 10 | 74–96% (87) | 83–99% (92) | 87–97% (92) | 93–99% (96) | 4 of 6 / 6 of 6 |
| 50 | 83–99% (92) | 82–99% (94) | 93–98% (96) | 96–100% (98) | 6 of 6 (median 700) / 6 of 6 (median 200) |
| 200 | 87–96% (92) | 80–98% (92) | 95–99% (97) | 97–100% (98) | 6 of 6 (median 650) / 6 of 6 (median 150) |

- **Learned** (*Pass the error back*, of 20 seeds reaching 95% within 5,000):

| Hidden units | Seeds that reach 95% | When they do | Test after 5,000 |
|---|---|---|---|
| 2 | 0 of 20 | never | 53–84% (mean 72) |
| 3 | 6 of 20 | 2,100 to 4,200 | 53–93% (79) |
| 4 | **11 of 20** | 1,850 to 4,950 (median 2,800) | 67–95% (86) |
| 5 | 16 of 20 | 1,800 to 4,750 (median 2,700) | 73–97% (89) |
| 6 | 19 of 20 | 1,350 to 4,750 (median 2,150) | 87–96% (91) |
| 8 | 17 of 20 | 1,300 to 4,200 (median 2,000) | 82–100% (92) |

**The smallest hidden layer that reaches 95% in most seeds is four, and six is the smallest that does so reliably.** The Playground's answer is three; this scene's is not. Three units draw a triangle around a disk and reach about 80 to 90%. The learned route is also the slow one: thousands of encounters, where the built-in receptor takes about 200 and 50 sparse random units about 200.

### Part 5a — `pool`

Training is the last 300 encounters as the fish met them; test is the 200-encounter test set.

| | Training | Test | Gap |
|---|---|---|---|
| 12 individuals, 8 hidden, after 1,000 (83 meetings each) | 74–94% (mean 84) | 73–85% (78) | 6 |
| after 3,000 (250 meetings) | 73–100% (89) | 73–88% (81) | 8 |
| **after 5,000 (417 meetings)** | 72–100% (91) | 72–86% (79) | **12** |
| after 10,000 (833 meetings) | 81–99% (94) | 68–87% (79) | 15 |
| 12 individuals, 0 hidden, after 5,000 | 72–100% (88) | 73–87% (82) | 6 |
| 12 individuals, 2 hidden | 71–100% (88) | 72–86% (81) | 7 |
| 12 individuals, 3 hidden | 72–100% (90) | 72–86% (81) | 9 |
| 6 individuals, 8 hidden | 85–100% (96) | 69–84% (78) | 18 |
| 24 individuals, 8 hidden | 82–95% (87) | 73–86% (81) | 6 |
| 60 individuals, 8 hidden | 76–92% (85) | 75–86% (82) | 3 |
| a stream, 8 hidden | 81–88% (84) | 77–86% (83) | 2 |

**The spread across seeds is wide, and one seed in six shows no gap at all.** Training and test at 5,000, seed by seed: 92/75, 100/86, 96/77, 72/86, 92/72, 93/80. In the fourth, two or three of the twelve individuals have smells the wrong side of any sensible line, and 5,000 encounters is not enough to learn each as an exception. The handout should tell a student whose training line is not above the test line to press *New seed*, or should use six individuals, where the gap is 18 points and training reaches 85% or better in every seed.

**Fewer hidden units helps only a little**: the test set gains 2 or 3 points on average going from eight units to none, while the gap halves. Most of the overfitting here comes from the smallness of the pool, not from the size of the network: a single line fitted to twelve individuals is already six points better on them than on the test set.

### Part 5b — `downstream`

| | Near test | Far test | Far hit rate | Far false-alarm rate |
|---|---|---|---|---|
| Trained near only, after 300 | 96–100% | 47–56% (mean 51) | **0%** | 0% |
| after 1,000 | 96–100% | 47–56% | 0–6% | 0% |
| after 2,000 | 99–100% | 47–56% | 0% | 0% |
| **Learn from every distance**, after 300 | 91–100% | 54–90% (72) | 11–100% | 0–88% |
| after 1,000 | 98–100% | 85–99% (95) | 72–100% (90) | 0–5% |
| after 2,000 | 98–100% | 92–98% (95) | 86–99% (96) | 0–15% |
| **Proportion of A beside A and B**, near only, after 300 | 97–100% | 57–92% (74) | 4–83% (45) | 0% |
| after 1,000 | 95–100% | 54–96% (75) | 10–93% (50) | 0–1% |
| after 2,000 | 99–100% | 63–81% (67) | 16–64% (32) | 0% |
| **Proportion only**, near only, after 300 | 58–88% (74) | 59–90% (76) | 13–100% | 0–41% |
| after 1,000 | 85–100% (95) | 89–99% (94) | 88–100% (96) | 0–22% |
| after 2,000 | 99–100% | 95–98% (96) | 89–99% (93) | 0–3% |

- **Trained near only, the fish flees no far eel at all.** The far test sits at half right because half of it is suckers, which the fish correctly ignores.
- **The spec's outcome to watch for happens.** With *Proportion of A* beside A and B, the fish goes on leaning on raw strength and misses half or more of the far eels, and it gets worse with more training near, not better. *Proportion only* is the built-in fix that works, and it takes about 1,000 encounters.
- **Going downstream with learning still on** turns the fish into one that is learning from far things: it recovers within about 100 encounters and the near test then falls. The handout should say to switch *Learning on* off before *Go downstream*, or should make that recovery the next question.

### The Closer — `new-predator`

- **After phase 1** (1,000 encounters): eel and sucker 95 to 100%; **pike and chub 0%**. Before it has met either, the fish treats every pike as a sucker and every chub as an eel.
- **Phase 2 alone**: the eel-and-sucker test is at 60% or less within **50 encounters**, and after 1,000 it is at **1 to 6%**, with pike and chub at 100%. It does not fall to chance. It falls to nearly always wrong.
- **Phase 3**: the eel that comes back strikes the fish in 6 seeds of 6.
- **With *Eels and suckers stay around***, after 1,000 encounters of phase 2: eel and sucker 98 to 100%, pike and chub 100%. Along the way the old test dips (59, 65, 100, 76, 100… at each hundred in one seed) before it settles.
- **All four from the start** (go to phase 3 before any learning): after 1,000, eel and sucker about 50% in every seed; after 2,000, 91 to 100% in five seeds of six; after 3,000, five of six; **after 5,000, 99 to 100% in all six**, with pike and chub at 100% throughout.

---

## 4. Timing

**What was measured, and what was not.** Measured: how long the scene makes a student wait. Not measured: how long a student takes to read, set controls and write, which is most of the lab and which nobody has done yet. The part figures below are the session's estimates from counting the operations, and Jon's walk-through is the first real measurement.

**Waiting, measured.** One encounter is 4.0 s at 1× (2.5 s as first built; see §1). *Skip ahead 1,000* in the in-app browser on the development Mac, React updates included: **0.07 to 0.9 s** (0.07 s with six hidden units and the Learning tab open; 0.6 to 0.9 s with the Network tab open, or with 200 random units). Headless, the worst hundred-encounter slice is 9 ms with 200 random units (`timing.probe.ts`), so the cost is redrawing the panels ten times, not simulating. On a machine ten times slower a skip of 1,000 is a few seconds. No click path computes for more than 9 ms at a time.

**Skips each part needs**, which is what the handout writes after "Skip ahead":

| Part | What is run | Presses of Skip ahead | Live watching | Estimated time, with reading and writing |
|---|---|---|---|---|
| 0 | the tour | 0 | a few encounters | 3 min |
| 1 | by hand; learning on, three presses of 100; three settings of the spread at 1,000 | about 6 | the first ten encounters, 40 s | 12 min |
| 2 | criterion, arousal; two stakes presets swept with about eight presses of *Score this criterion* each; five fish, four counts each into the By hand box; the two face-memory testers | 0 | none needed | 25 to 30 min |
| 3 | one unit failing (2 × 1,000); the network by hand (nine sliders); threshold function (1,000); sigmoid; 1, 2, 3, 4 and 6 hidden units over three seeds each at up to 2,000; *Both together* | about 35 of 1,000 | none needed | 30 min |
| 4 | two built-in receptors; random layers of 2, 10, 50, 200, sparse and not, at 1,000 each; the learned route at 3, 4 and 6 units, up to 5,000 each | about 30 of 1,000 | none needed | 20 to 25 min |
| 5a | the pool at 5,000; fewer units; a larger pool; a stream | about 20 of 1,000 | none needed | 12 min |
| 5b | near only (3 × 100); go downstream; the two fixes at 1,000 to 2,000 each | about 8 | a few encounters downstream, 30 s | 10 min |
| Closer | phase 1 (1,000), phase 2 (1,000), one eel; reset and rerun with the old animals staying; optionally all four from the start (5,000) | 5 to 10 | the returning eel | 8 to 10 min |

**About 120 to 130 minutes in all**, of which under two minutes is waiting on the development Mac. Parts 3 and 4 are the long ones, and their length is the number of runs the comparisons ask for, not the cost of any one. If the lab has to be shortened, the cheapest cuts are the seed-by-seed table in Part 3 (ask for 2 and 4 units only) and the not-sparse column in Part 4.

---

## 5. Where the build departed from the spec, and where its targets were wrong

1. **Sigmoid width 0.25, weight range ±6** (§6.4). With width 0.25 and Lab 4's ±3, four hidden units already solved the fruit in 20 seeds of 20. The range was widened for a different reason: at ±3 a single unit learning eel from sucker pinned the weight from A at 3 within a few hundred encounters while the weight from B kept growing, which turned the line toward (3, −3) — and a line in that direction happens to sort far eels correctly, so Part 5b's failure disappeared with more training (far hit rate 0% at 300 encounters, 75% at 3,000). At ±6 nothing pins inside 3,000 encounters and the failure holds at every length of training. The criterion slider runs ±3. The learning rate runs 0.01 to 1, default 0.2: at 0.5 two hidden units solve the fruit less often (7 of 20 against 13), at 1 the island is not learned by passing the error back at any size, and at 2 nothing converges.
2. **Starting weights under *Pass the error back* are uniform in ±1.** Measured at ±0.5, ±1, ±2, ±3 and ±5: four hidden units reach 95% on the fruit in 20, 20, 15, 14 and 11 seeds of 20.
3. **Pike and chub moved** (§4.2). The spec's (0.35, 0.85) and (0.90, 0.30) put the four animals almost on one line, alternating harmless, dangerous, harmless, dangerous, with gaps of 0.21 to 0.32. One network then needs three boundaries along a line: it holds all four only after 5,000 to 10,000 encounters, and with the old animals staying around for 1,000 the two test sets ended at 37 to 61% and 79 to 91%. At **pike (0.15, 0.90) and chub (0.95, 0.10)** — the same sides, further out — phase 2 alone still wrecks the old test (1 to 6%), staying around holds both (98 to 100%, 100%), and all four from the start are learned by 5,000. A rectangle arrangement was also measured and was no better than the spec's. **This is a change to the world made to meet a target, so it is flagged for Jon in the walk-through.**
4. **The baseline learns, as the weight on an input that is always 1.** The spec says learning writes weights and baselines (§5.4); Lab 5's `learnWeights` wrote weights only. It now takes an optional `alwaysOn` change, which only the fish passes. `oneWriter.test.ts` asserts a baseline has the same two writers as a weight, and that nothing in Lab 4 or Lab 5 asks for it.
5. **The four fish's criterion shifts are about one spread of the evidence**, not more (F1 −0.50, F2 +0.60, F4 −0.60, where the evidence's spread is 0.50). A first version had them at −0.8 and +0.9, and F1 then had zero to two misses in a thousand, so d′ from its counts ranged from 2.06 to 2.64.
6. **Part 2's test set is 2,000, not 200.** At 200 a hit rate of 0.98 rests on two misses.
7. **The d′-stability target is met over the middle half of the evidence, not the middle 80%.** The spec asked for ±0.15 on 1,000 encounters. The evidence is equal-spread Gaussian and nothing drifts, but at the ends of the middle 80% one of the two rates is within a few percent of 0 or 1 and the standard error of d′ from 1,000 encounters is about 0.13 by itself. Measured on 2,000: ±0.15 across the middle half, ±0.4 across the middle 80%. d′ on the evidence panel, computed from the distributions, does not move at all.
8. **The second face-memory tester is d′ = 2.05**, which is 2.1 to one decimal. The spec asked the By hand box to print 2.0 for both. It prints two decimals: 1.99 and 2.05. The chapter says both are 2.0. **Flagged for Jon**: either the chapter's sentence can say "about 2.0", or the handout can ask why they differ in the second decimal.
9. **Two hidden units find two solutions to the fruit, not one.** The spec's test was that the two ripe corners land together in hidden space. They do in about two solved runs in three. In the rest the rule finds "A without B" and "B without A", and it is the twig and the rotting fruit that land together. The test asserts that some pair sharing an outcome lands together. Part 3's question about the hidden-activity space has to allow both.
10. **Four hidden units, not three, for the island**, and slowly. See §3.
11. **Overfitting in the pool is modest and comes mostly from the pool's size.** The 10-point target is met on average at 5,000 encounters (12 points) and not in every seed. The "fewer hidden units do better on the test set" target is met by 2 or 3 points. See §3.
12. **The downstream finding.** *Proportion of A* beside A and B does not rescue the fish. *Proportion only* does. Reported, as the spec asked.
13. **A fixed-at-random layer of two units reaches 80% in one seed of six** (target: under 80%). The mean is 62 to 70%.
14. **Phase 3 of the Closer** puts an eel upstream next and then all four kinds, so the stream does not run dry after one encounter. Going to phase 3 before any learning is how "all four at once from the start" is run.
15. **Learning is off when every scenario loads**, as the spec says, including the three (5a, 5b, the Closer) where there is nothing to do by hand first. The skip badge says *learning is off, so no weight changed* when that is why nothing happened. **A question for Jon** in the walk-through.
16. **Cut, in the spec's cut order**: the *Morph* animation, and *Competition* as a fourth hidden-layer setting. Built from the cut list: the pair menus, *Score this criterion* with its plot, and the idle animation.
17. **The modulators turn over for a verdict routed to *eat*.** The spec defines them for *dart to cover*. In Parts 3 and 4 they are locked at 1 and move nothing, so this is latent; if they were unlocked there, a hungry fish would eat more readily.
18. **The engine files Labs 4 and 5 shipped changed, inertly.** `unit.ts` (`activate` takes an optional sigmoid width; `activationSlope` added), `circuit.ts` (`Circuit.output`, and `setWiring` can address it), `learning/rule.ts` (`thirdFactor` accepts `'passed-back'`; `learnWeights` accepts `alwaysOn`). The Lab 4 regression fixture and Lab 5's suite pass untouched, and both scenes' no-XOR sweeps still run.

19. **One encounter is 4.0 s at 1×**, where the spec's §3.2 says about 2.5. The extra second and a half is still water after the outcome. Live watching is a minute or two of the whole lab, so the lab's length is unchanged; the speed control still runs to 8×.

## 6. Not verifiable from the scripted session

The in-app browser throttles the frame loop, so nothing about motion was judged. For Jon at `localhost:5173/#/m07-fish`, with the crib from `npm run closeout m07-fish`: the fish's tail beat, its wandering heading, fin flutter and occasional twitch; that it turns to face each puff of smell; the dart into the weed behind the rock at the right and the drift back; the eel's lunge to where the fish was and the red ring when the fish is struck; the green ring for a meal; a sucker carried past on the left; the fruit being taken, or left and mouthed briefly; whether the specks of a smell read as a smell and their two colors as two amounts; whether the current's speed (7.5 units a second, `CURRENT` in `meshes.tsx`) is too brisk; whether the murk reads as murk; and whether the hollow test-set dots, the white boundary and the hidden-unit squares are legible on the dark theme.

## 7. State at hand-off, 2026-10-04 evening — for the session that walks and revises it

**Where things stand.** Branch `m07-fish`, six commits off `main`, working tree clean, nothing pushed, nothing merged. 455 tests pass, the build is clean, and `npm run closeout m07-fish` exits 0. Jon has not walked the scene yet: `LAB_7_WALKTHROUGH.md` (course folder, beside the spec) is as the build session wrote it, with no boxes ticked and no answers under its ten questions in §12. He has opened the scene in Chrome once, has first impressions of what looks good and what does not, and will start the next session by describing them. No revision has been made in response to anything he has seen.

**Since then (2026-10-04, later the same evening).** Jon described what he saw on first opening the scene. Revisions followed, to the stream view only, on 2026-10-04 and 2026-10-05: the smell, the current, the animals' shapes and colors, the fruit and the cover rock, described at the top of §1. The suite is still 455 and green. The in-app browser confirmed that the new shapes draw; their motion is Jon's to check.

**Order of work from here.** Jon's observations and walk-through notes → changes to the scene, each with its test and each re-measured if it moves a number in §3 → these notes and the close-out's claim list corrected to match → the handout, `intro_to_bcs/pattern_recognition/fish_lab/fish_lab.md`, written from these notes → merge and push, which Jon is asked about first.

**What a revision has to keep true.** The seven non-negotiables in the build prompt, each held by a named test: the hidden-layer ban scoped per scene; passing the error back through `thirdFactor()` as one rule shape; the criterion never written by learning and never read by the prediction; the outcome arriving whatever the verdict; the output's Φ = a − p with the prediction held; each of the four fish differing from healthy in exactly one named property; the nine content lines on their panels. `naming.test.ts` also holds the vocabulary rules, so new on-screen text can fail it: no *loss*, *epoch*, receptor biology, named cortical area, or verb that has the network knowing or deciding. A selected control changes color and never size.

**If a change moves a number.** §3 is quoted by the walk-through and will be quoted by the handout. Re-run the crib (`PROBE=1 PROBE_DIR=src/sim/fish npx vitest run --disable-console-intercept -t "crib:"`, about a minute) and correct §3, the walk-through's predictions, and any band in `targets.test.ts` or `sdt.test.ts` that the change crosses. `tune.probe.ts` is the record of how the constants were chosen and is the place to add a sweep.

**Performance, measured 2026-10-04 with the scene open in Chrome on Jon's MacBook Pro (Liquid Retina XDR).** Steady over a minute, no thermal warning: one Chrome helper at 35 to 44% of a core (most likely the GPU process), the page's renderer at 14 to 17%, and WindowServer at 41 to 48% against about 20% with the page closed. The dev server sat at 0%. So the scene costs about one core, nearly all of it redrawing the 3D canvas every frame at full Retina resolution; the simulation and the panels are the 15% line. **Labs 4 and 5 were not measured the same way**, so whether Lab 7 is heavier than its siblings or typical of every 3D scene in the app is not known. Two reductions were offered and neither is built: cap the canvas at 1.5× device pixels (`dpr` on the `<Canvas>`), and stop redrawing while the transport is paused (`frameloop="demand"`). Either could be done for this scene alone or in the shared canvas setup, and both matter more on a Chromebook.

**An unrelated scare, recorded so it is not chased again.** Earlier the same evening the Mac was running hot with Finder at 120% and `fileproviderd` at 75%. That was Finder, up 39 days and holding 6 GB, looping on an iCloud Drive enumeration. It was not the scene, the dev server or the repo (`~/Documents` is not cloud-synced), and a restart cleared it. With the scene open afterwards, Finder and `fileproviderd` stayed at 0%.

**Practical notes.** The dev URL is `http://localhost:5173/#/m07-fish`, with no `/bcogapp/` in it. A dev server started by a Claude session stops when that session ends; start a fresh one. The in-app browser throttles the frame loop, so it cannot judge motion or cost: Jon's own browser is the test, and a session can sample `ps` while he has the page open. In the in-app browser, timers and screenshots lag the page, so read values from the page text after a scripted click and wait a second or two before a screenshot. Editing `meshes.tsx` or `FishScene.tsx` forces a full reload of the scene in dev, which resets its state.

