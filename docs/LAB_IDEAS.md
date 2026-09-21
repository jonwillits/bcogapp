# Lab & Demo Ideas

Running capture of what the app should contain, module by module. This is the doc we fill **interactively** — it drives the [architecture decision](ARCHITECTURE_DECISION.md), so it comes first. For each idea, note the interaction, whether it needs **3D + camera** / 2D / plain UI, any **performance** or **saved-state** risk, and its status.

Legend — **Kind:** `demo` (instructor) · `lab` (student) · `both`. **Render:** `3D` (camera-controlled) · `2D` (canvas/plot) · `UI` (controls only). **Status:** `idea` · `spec` · `building` · `done`.

## Migration inventory — what external sites the current labs use

The starting backlog: existing labs that lean on third-party sites we'd bring in-house. (Source: `intro_to_bcs/<module>/*lab*.md`.)

| Module | Current lab | External dependency | Render | Migration note |
|---|---|---|---|---|
| 1 Mind & Brain | Vehicles (levels of analysis) | ~~Local Python `vehicles.py`~~ | 3D | ✅ **Migrated.** Now the [in-app scene](https://jonwillits.github.io/bcogapp/#/m01-vehicles) and the **first stage of the evolving-creature spine**. The Python install is retired from the handout; students just open a link. |
| 4 Neural Circuits | Neural-network logic lab | ~~`trinket.io` pygame — 4-neuron net, truth tables, training~~ | 3D | ✅ **Replaced, not ported.** The [in-app scene](https://jonwillits.github.io/bcogapp/#/m04-bilaterian) is the **second stage of the evolving-creature spine**; the training is out, on purpose — the student sets the weights by hand, and the closer asks what the animal lacks. |
| 7 Pattern Recognition | Pattern recognition | **TensorFlow Playground** (external site) | 2D | Recreating a focused subset gives us control + course-aligned framing. |
| 13 Language | Animal communication | YouTube videos + Hockett-features worksheet | — | Observation/discussion, not a sim — likely **stays** as handout + links, not an app piece. |

Labs with **no external interactive site today** (candidates for new interactive pieces, or fine as-is): Module 3 Neurons, Module 5 Learning (rock–paper–scissors RL), Module 9 Spatial Cognition, Module 10 Memory (recognition experiment), Module 11 Social Cognition (prisoner's dilemma), Module 14 Symbolic Cognition (logic lab).

## Per-module idea board

Fill these in as we talk. Canonical module list: `../../../intro_to_bcs/README.md`.

> **The spine.** Most of these are stages of one **evolving-creature engine** (M1 vehicle → M4 and M5 bilaterian → M7 fish → maybe M11 primate), with M3/M6/M12–14 as satellite scenes. The durable statement of that architecture — and the "one focal, visualizable network; other agents are hard-coded NPCs" rule — lives in [`APP_DESIGN.md`](APP_DESIGN.md); this board just captures per-module ideas.

### Module 1 — Mind and Brain
- **Braitenberg Vehicles sim** — *(done)* — Render **3D** — **[live](https://jonwillits.github.io/bcogapp/#/m01-vehicles)** · `src/scenes/m01_vehicles/`. Replaces the local-Python setup.
  Six colour-coded phenotypes on screen at once — `2a/2b/2c/3a/3b/3c`, every combination of three wiring patterns (ipsilateral, contralateral, fully connected) with two signs (excitatory, inhibitory). Click a vehicle to see its live wiring, the arithmetic behind each actuator (`bias + Σ(strength × sensor)`), a sensor trace, and per-vehicle **connection strength** / **actuator bias** sliders — so a student can hold five constant and vary one. Lights are placed by clicking the floor, or stranded on the rim out of reach (sensed in 3D, so height costs signal). The arena is a hard-walled pit, drawn so the boundary is visible rather than mysterious.
  Only the neutral labels are shown — Braitenberg's "Fear/Aggression/…" names live in `vehiclePresets.ts` as an answer key — so the handout's observe → theorize → inspect arc survives.
  Handout: `intro_to_bcs/mind_and_brain/levels_of_analysis_lab/vehicles_lab.md`, fetched live by the app's Lab pane.

### Module 2 — Comparative Approaches
- **Evolving Vehicles** — *(done)* — Render **3D** — `#/m02-evolution` · `src/scenes/m02_evolution/`. The second stage of the spine: the Module 1 creature, now with a genome it inherits and mutates.
  **The Evolve tab** is a living population in a walled arena. Every creature carries an energy store and a lifespan; food is patches that drift across the floor, giving out energy shared among whoever is feeding on them. Fill your store and you reproduce as soon as the arena has room; run out of life and you die. Nothing is ranked and there are no generations — the arena supports a fixed number, and a slot goes to whoever is furthest ahead.
  The genome is the numbers the creature already had in Lab 1 — the four connection strengths and the actuator bias — plus a **mark**, a bead on its tail that affects nothing at all and is inherited anyway. **Body colour is read off the wiring**, so two creatures the same colour are wired alike and a population converging in colour is a population whose wiring is converging. The mark is the one that means nothing, and it sweeps too, which is the whole of the lab's Part 4.
  **The Lineages tab** holds four populations — W, X, Y, Z — evolved before the student arrives, with wiring, colour and ancestry all hidden. W and X are sister branches of one run; Y reached the same behaviour from the other founder pool by different machinery; Z still flees. In the default world the three approachers cannot be told apart, and come apart only under a perturbation the student has to design. Revealed in stages.
  Handout: `intro_to_bcs/comparative_approaches/evolution_lab/evolution_lab.md`, fetched live by the app's Lab pane. **Where the build departed from the scene spec, and what the handout still owes: [`M02_SPEC_DEVIATIONS.md`](M02_SPEC_DEVIATIONS.md).**

### Module 3 — Neurons and Neural Communication
- **The Neuron** — *(live since 2026-09-07)* — Render **3D** — `#/m03-neuron` · `src/scenes/m03_neuron/`. A satellite scene, not an instalment of the creature spine: the Lab 1 vehicle and Module 2's moving lights as a shell, with a real neuron inside the connection Lab 1 drew as a line — shown three ways, at three time scales, as one cell.
  **World tab** (computational): one vehicle, moving lights, a signal-type switch (diffusing chemical · graded electrical · spikes), a body-size slider over six orders of magnitude, a world-speed control, and readouts of reaction time broken into sensing · travel · integration, lights collected per minute, and energy per light collected. **Unit tab** (algorithmic): the reading's `y = b₀ + b₁x₁ + b₂x₂ + b₃x₃` with live numbers, the Lab 1 / reading vocabulary reconciled on the panel (connection strength = weight, actuator bias = baseline), an output rate measured from the membrane, an input–output curve whose floor and ceiling are measured from the cell, a spike raster with a 1–1000 ms time-window slider, a show-measured overlay, and a biological/artificial toggle that changes every word and no number. No anatomy on it, by test. **Membrane tab** (implementational): Hodgkin–Huxley with the concentrations and the electrogenic pump classic HH lacks — voltage trace, the three gate meters, currents and the pump, live concentrations and reversal potentials, an ATP counter that is pump turnover, lesion controls (pump power, sodium block, inactivation recovery, injected current), the equations off by default, the energy calculator (from Lennie's literature figure, declared as such), and a Things-to-try area holding myelin. **Diagnosis tab**: five cells, N0 explained and N1–N4 hidden until Reveal faults, each the healthy cell with one parameter changed.
  Threshold and the refractory period are emergent, not parameters — tests assert it. The cell model is in `src/sim/neuron/`, headless, with the spec's §10 acceptance tests. Handout: `intro_to_bcs/neurons_and_neural_communication/neuron_lab/neuron_lab.md`, fetched live. **Where the build departed from the scene spec, and where the spec's numbers turned out to be wrong: [`M03_SPEC_DEVIATIONS.md`](M03_SPEC_DEVIATIONS.md).**
  *(The original idea here was a 2D neuron with ion gates, transmitter release, reuptake and binding, and live voltage plots. What was built keeps the gates, the action potential and the voltage plots and adds the pump, the concentrations and the vehicle; transmitter release and reuptake are named on the Membrane tab but not simulated.)*

### Module 4 — Neural Circuits, Affect, & Valence
- **The Bilaterian** — *(live since 2026-09-14)* — Render **3D** — **[live](https://jonwillits.github.io/bcogapp/#/m04-bilaterian)** · `src/scenes/m04_bilaterian/`. The second instalment of the creature spine, not a satellite: M1's vehicle becomes a nematode-like early bilaterian with a layered nervous system, and Modules 5 and 7 configure what is built here rather than replace it.
  **The animal**: one sensory cell per cue channel, at the head, steering by comparing what it senses now against about a second ago — rising, nothing triggers a reversal; falling, reversal probability climbs — and never one side against the other, which §4.3.3 is emphatic the worm cannot do. Two mutually inhibiting motor groups decide which wave runs; a reversal ends in a deep bend onto a heading drawn from the seeded stream. **The nervous system**: sensory cells → one interneuron → forward and reverse groups, every number on screen; underneath, a general *n*-to-*m*-to-*k* rate-unit layer instantiated at one interneuron, with a test that no student-reachable setting satisfies XOR. **Circuit tab**: the diagram with the routing switch as a visible clickable object, sliders for every weight, baseline and threshold, the arithmetic with the activation function named (threshold function or sigmoid — §4.2.3 names them, so the Module 3 prohibition has expired), the scenario's truth table with what the animal does on each row, and the decision boundary. **Chemistry tab**: four modulators named for what they do (pursuit, satiety and tone, arousal and vigilance, relief — no molecule named anywhere, by test), each a gain applied at simulation time and stored apart from every weight, the valence–arousal plane with the animal's state as a live dot, and a persistence readout. **Worms tab**: five animals, W0 diagnosed as a worked example, W1–W4 hidden until Reveal faults, one of them a hungry animal with nothing wrong with it. **Seven scenarios**: the labeled line, food beyond copper, AND, OR (loaded from AND without resetting the weights), AND NOT, the five animals, and the closer in which the food odor now comes from the toxin and the animal's fixed weights carry it in.
  **Nothing trains.** The legacy idea below — a port of the Python logic-gate network with training — is retired: §4.2.12 and the chapter's Close turn on the weights being fixed, so the student is the learning algorithm, and the closer collects on that. Handout: `intro_to_bcs/neural_circuits_affect_and_valence/bilaterian_lab/bilaterian_lab.md`, fetched live; 24 questions, with `build_report.py` beside it generating the report `.docx`. **Where the build departed from the scene spec, and where the spec's numbers turned out wrong: [`M04_SPEC_DEVIATIONS.md`](M04_SPEC_DEVIATIONS.md).**
- ~~**Logic-gate neural net** — Render **2D** — port of the python 4-neuron network: pick a truth table, train, watch weights/decision boundary.~~ Superseded by the scene above; the training is explicitly out.

### Module 5 — Learning and Plasticity
- **Learning** (`#/m05-learning`) — **built 2026-09-20**, on the branch `m05-learning`. Lab 4's bilaterian in Lab 4's dish with one thing added: the weights can change by themselves. One rule, Δbᵢ = η·xᵢ·Φ, with a selector for what supplies Φ (the unit's own output, a held prediction's error, a target the scenario holds, one broadcast number). Six scenarios: `hand-over` (the rule is on and the animal is poisoned anyway), `pairing`, `blocking` (the separating experiment), `four-signals`, `corridor` (value seeping backward; a rule this animal does not have, and the panel says so), `extinction` (three returns, no weight that decays). The handout is written from the built scene; the record for it is [`M05_AS_BUILT_NOTES.md`](M05_AS_BUILT_NOTES.md).
- ~~The worms are now early vertebrates, probably fish~~ — retired. The fish is Module 7's; see the spine amendment in [`APP_DESIGN.md`](APP_DESIGN.md).
- ~~Rock–paper–scissors reinforcement learning~~ — the legacy lab, superseded entirely.

### Module 6 — Vertebrate Neural Architecture
- **camera flythrough of labeled brain structures** - Likely a driver of the 3D + camera requirement. Question about whether there would be added value embedding this within the vehicles simulation, or as a separate stand alone activity.

### Module 7 — Pattern Recognition
- **Classifier playground** — The creature becomes an early vertebrate, a fish, here (not in Module 5), configuring Module 5's learning layer with `m > 1` and a second layer, which `circuit.test.ts` forbids until then. Expand the complexity of the pattern recognition problems the fish need to solve. We will demonstrate the same things you can learn from the Tensorflow playground: 1) linear inseparability of XOR and Circle-Surround classification problems. How there are two ways to solve the problems: hidden layers or input feature selection. And training set vs. test set differences used to demonstrate learning and generalization problems.

### Module 8 — Perception and Action
- _(open)_

### Module 9 — Spatial Cognition
- _(open)_ — **candidate 3D**: navigable environment (place/grid-cell intuition, cognitive maps, path integration). Likely a driver of the 3D + camera requirement.

### Module 10 — Memory, Imagination, and Generative Models
- _(open)_ — recognition-memory experiment (study list → test), self-scoring for the handout.

### Module 11 — Social Cognition
- _(open)_ — iterated prisoner's dilemma vs. selectable strategies (tit-for-tat, etc.); running score.

### Module 12 — Planning and Decision-making
- _(open)_ - but I would like to do something related to first using something like a Generalized Problem Solver and why it is great but also why it fails to scale. Somehow teach about how neural networks have a complimentary set of strengths and weaknesses.

### Module 13 — Language
- _(open)_ — Previously we had a demo analyzing different animal communication systems according to Hockett’s design features. That was ok. But I would be more interested in something that was more about the nature and structure of language. Acoustics—>Phonetics—>Morphemes—>Words—>Phrases—>Sentences. Syntax vs. Semantics.

### Module 14 — Symbolic Cognition
- **Symbols vs. Statistics** — I want a demo that walks through the logical problem of language representation and debates about its learning. Skinner and transition probability language models and what they can and cannot do. Then Chomsky, FSA vs. Push-down Automata vs. Turing machine and the different kinds of complexities they can handle. But then limitations of chomksian approach: context sensitivity and complexity requires too many rules. Then SRNs and Transformers.

### Module 15 — Culture and Cognition
- _(open)_

## Cross-cutting reusable pieces (harvest as ideas firm up)

Things multiple labs will want, worth building once into the shared shell: a **camera controller** (orbit/fly/first-person), a **control panel** (sliders/toggles/reset), a **3D plot/canvas** widget, a **training/step loop** with play/pause/speed, and a **read-off-a-value** display for handout questions.
