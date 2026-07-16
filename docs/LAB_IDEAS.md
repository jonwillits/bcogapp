# Lab & Demo Ideas

Running capture of what the app should contain, module by module. This is the doc we fill **interactively** — it drives the [architecture decision](ARCHITECTURE_DECISION.md), so it comes first. For each idea, note the interaction, whether it needs **3D + camera** / 2D / plain UI, any **performance** or **saved-state** risk, and its status.

Legend — **Kind:** `demo` (instructor) · `lab` (student) · `both`. **Render:** `3D` (camera-controlled) · `2D` (canvas/plot) · `UI` (controls only). **Status:** `idea` · `spec` · `building` · `done`.

## Migration inventory — what external sites the current labs use

The starting backlog: existing labs that lean on third-party sites we'd bring in-house. (Source: `intro_to_bcs/<module>/*lab*.md`.)

| Module | Current lab | External dependency | Render | Migration note |
|---|---|---|---|---|
| 1 Mind & Brain | Vehicles (levels of analysis) | ~~Local Python `vehicles.py`~~ | 3D | ✅ **Migrated.** Now the [in-app scene](https://jonwillits.github.io/bcogapp/#/m01-vehicles) and the **first stage of the evolving-creature spine**. The Python install is retired from the handout; students just open a link. |
| 4 Neural Circuits | Neural-network logic lab | `trinket.io` pygame — 4-neuron net, truth tables, training | 2D | Self-contained 2D; strong first-migration candidate. |
| 7 Pattern Recognition | Pattern recognition | **TensorFlow Playground** (external site) | 2D | Recreating a focused subset gives us control + course-aligned framing. |
| 13 Language | Animal communication | YouTube videos + Hockett-features worksheet | — | Observation/discussion, not a sim — likely **stays** as handout + links, not an app piece. |

Labs with **no external interactive site today** (candidates for new interactive pieces, or fine as-is): Module 3 Neurons, Module 5 Learning (rock–paper–scissors RL), Module 9 Spatial Cognition, Module 10 Memory (recognition experiment), Module 11 Social Cognition (prisoner's dilemma), Module 14 Symbolic Cognition (logic lab).

## Per-module idea board

Fill these in as we talk. Canonical module list: `../../../intro_to_bcs/README.md`.

> **The spine.** Most of these are stages of one **evolving-creature engine** (M1 vehicle → M4 bilaterian → M5/M7 fish → maybe M11 primate), with M3/M6/M12–14 as satellite scenes. The durable statement of that architecture — and the "one focal, visualizable network; other agents are hard-coded NPCs" rule — lives in [`APP_DESIGN.md`](APP_DESIGN.md); this board just captures per-module ideas.

### Module 1 — Mind and Brain
- **Braitenberg Vehicles sim** — *(done)* — Render **3D** — **[live](https://jonwillits.github.io/bcogapp/#/m01-vehicles)** · `src/scenes/m01_vehicles/`. Replaces the local-Python setup.
  Six colour-coded phenotypes on screen at once — `2a/2b/2c/3a/3b/3c`, every combination of three wiring patterns (ipsilateral, contralateral, fully connected) with two signs (excitatory, inhibitory). Click a vehicle to see its live wiring, the arithmetic behind each actuator (`bias + Σ(strength × sensor)`), a sensor trace, and per-vehicle **connection strength** / **actuator bias** sliders — so a student can hold five constant and vary one. Lights are placed by clicking the floor, or stranded on the rim out of reach (sensed in 3D, so height costs signal). The arena is a hard-walled pit, drawn so the boundary is visible rather than mysterious.
  Only the neutral labels are shown — Braitenberg's "Fear/Aggression/…" names live in `vehiclePresets.ts` as an answer key — so the handout's observe → theorize → inspect arc survives.
  Handout: `intro_to_bcs/mind_and_brain/levels_of_analysis_lab/vehicles_lab.md`, fetched live by the app's Lab pane.

### Module 2 — Comparative Approaches
- **Undecided** - No committed idea for this lab yet. The four main topics for the week are:
  - understanding evolution and natural selection
  - benefits and pitfalls of evolutionary/adaptationist comparisons and analyses
  - cross species comparisons
  - biological vs. artificial comparisons

### Module 3 — Neurons and Neural Communication
- **Neuron Simulation** - I want to create a 2D simulation of a simple neuron, showing its parts, showing some of the biochemical interactions involved. I want ion gates, neurotransmitter release, reuptake, and binding, action potentials, and something like a working simulation of action potentials. We separately want some dynamically changing plots of electrical potential.

### Module 4 — Neural Circuits, Affect, & Valence
- **Logic-gate neural net** — Render **2D** — port of the python 4-neuron network: pick a truth table, train, watch weights/decision boundary. Confirmed self-contained. But we want to integrate this into the vehicles simulation. We want to render the vehicles as nematode like early bilaterians. We want one of the agents to have to make decisions to approach or avoid stimuli based different logical functions. We will also implement various different basic real neural circuits.

### Module 5 — Learning and Plasticity
- **Expand the 3D simulation to include learning** - The worms are now early vertebrates, probably fish, and they are going to be used to demonstrate neural adaptation, hebbian learning, error-driven learning, and reinforcement learning.

### Module 6 — Vertebrate Neural Architecture
- **camera flythrough of labeled brain structures** - Likely a driver of the 3D + camera requirement. Question about whether there would be added value embedding this within the vehicles simulation, or as a separate stand alone activity.

### Module 7 — Pattern Recognition
- **Classifier playground** — Continue with the fish, but expand the complexity of the pattern recognition problems the fish need to solve. We will demonstrate the same things you can learn from the Tensorflow playground: 1) linear inseparability of XOR and Circle-Surround classification problems. How there are two ways to solve the problems: hidden layers or input feature selection. And training set vs. test set differences used to demonstrate learning and generalization problems.

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
