# App Design

The design spine for the BCOG 100 course app: what it's for, what it must do, and what it deliberately won't do. Kept lean — the tech-stack question lives in [`ARCHITECTURE_DECISION.md`](ARCHITECTURE_DECISION.md), the build recipe in [`APP_DEVELOPMENT_PROCESS.md`](APP_DEVELOPMENT_PROCESS.md), and per-lab ideas in [`LAB_IDEAS.md`](LAB_IDEAS.md). This file states the durable goals; when a decision is made, record it here and delete the open question.

## Purpose

One app that hosts the course's interactive **demonstrations** and **lab activities**, running identically on every device students and instructors use. It exists to (1) replace fragile third-party sites we don't control, (2) give demos and labs a shared visual language with the lectures and readings, and (3) make it cheap to author new interactive pieces as modules are built.

## Organizing principle: one evolving-creature engine + satellite scenes

The app is **not** a grab-bag of independent mini-apps. Most of its interactive content is a single **evolving-creature simulation** that accumulates capabilities module by module, tracking the course's evolutionary arc:

- **M1** a Braitenberg vehicle (sensor→actuator wiring, emergent behavior) — **built** →
- **M4** a nematode-like early bilaterian making logical approach/avoid decisions via real neural circuits →
- **M5** an early vertebrate (fish) that *learns* (neural adaptation, Hebbian, error-driven, reinforcement) →
- **M7** the same fish solving harder pattern-recognition problems (linear inseparability, hidden layers vs. feature selection, train/test generalization) →
- **M11** (possibly) primates in a game-theoretic social setting.

This is implemented as **one simulation engine, parameterized by evolutionary stage** — the same creature / sensor / nervous-system / environment framework, configured per module for which body plan, sensors, circuits, and learning rules are enabled. We build the machinery once and turn features on as the course advances, rather than rebuilding a creature each week.

Around that spine sit **satellite scenes** that reuse the shared shell (camera, control panels, plots) but aren't part of the creature: the **M3** 2D neuron (ion channels, action potentials, voltage plots), the **M6** labeled-brain flythrough (may embed in the creature or stand alone), and the more abstract **M12** planning, **M13** language-structure, and **M14** symbols-vs-statistics demos.

**Vocabulary is chosen for the whole arc, not one module.** Because the same sensor→actuator map *becomes* a neural network in M4/M5/M7, the seam is the expensive place to change words — so M1's terms are picked to survive it:

| In the app | Becomes, later | Why not the obvious alternative |
|---|---|---|
| **actuator** (marked `A`) | — | Not "motor": a flagellum or muscle isn't a motor, and "motor" primes a mechanical reading in a lab about mentalistic language collapsing into mechanism. ("Sensorimotor" stays, though — it's the right term for the *mapping*, and real motor neurons arrive later.) |
| **connection strength** | **weight** | Not "gain": in network terms gain is an activation-function slope, not the strength between two units — and this parameter is unambiguously a weight. "Connection strength" is jargon-free for M1 and maps 1:1 onto "weight" later. |
| **actuator bias** | **bias** | Pairs the creature word with the network word, so nothing is retracted — it's the bias term in `actuator = bias + Σ(weight × sensor)`. |

The corollary is architectural: **the general case is the one to build.** M1's weights are already a full 2×2 matrix — the ipsilateral/contralateral vehicles are just that matrix with a diagonal zeroed — which is exactly the form plasticity will later adjust.

**Focal vs. NPC networks.** In the spine sim there is normally **one focal agent** whose neural network is fully simulated and visualizable; any other on-screen agents are "NPCs" with hard-coded behaviors the focal agent reacts to. The lone exception is the social-cognition week (M11), where ~two full networks may run at once. This keeps the computational load small (the real ceiling is one network's *complexity*, not the number of agents) and is why a lightweight web stack is ample — see [`ARCHITECTURE_DECISION.md`](ARCHITECTURE_DECISION.md).

## The two modes

The app serves two related but distinct uses. Keeping them distinct guides both UI and architecture.

**Demonstrations** are instructor-driven, shown live in class (often projected). They favor big visuals, presenter-friendly controls, and immediate legibility from the back of the room. They carry no grading or data-collection burden. A demo can be as small as a single interactive figure that makes one concept vivid.

**Lab activities** are student-driven. A student opens the app on their own machine, manipulates a simulation, and answers questions in an accompanying lab handout (`intro_to_bcs/<module>/<module>_lab.md`). Labs need to be self-explanatory, robust to being poked at, and — where a lab asks students to record measurements — able to surface the numbers/plots the handout asks for. Some labs may benefit from letting a student export or copy a result to paste into a report.

A single interactive scene can often serve both modes; the difference is mainly framing and surrounding UI.

## Hard requirements

These are non-negotiable and drive the architecture decision.

**Four platforms, one of them binding.** The app must run on **Mac, Windows, Linux, and Chromebook**. Chromebooks are the binding constraint: they cannot reliably run native binaries across a whole class (Crostini/Linux-container and Android-app paths are inconsistent between models and not something we can require of every student), so anything a Chromebook must render has to run in the **browser**. This single fact does most of the work in the architecture decision.

**Interactive 3D with free camera control.** Several planned demos are spatial (e.g., neural-architecture flythroughs, spatial-cognition environments). The app must support real-time 3D scenes the user can move a camera around — orbit, fly, and/or first-person — not just static figures or 2D canvases. This must hold on the browser rendering path, i.e., on Chromebooks too.

**Low friction for students.** Starting a lab should be near-instant and near-zero-setup: ideally open a link (or a locally installed app) and go. No accounts, no toolchains, no per-device configuration. A lab that half the class can't launch is worse than the website it replaced.

## Soft requirements / preferences

- **Offline / poor-network resilience for classroom use.** In-class demos shouldn't die on flaky lecture-hall wifi. An installable/offline-capable form is preferred where feasible.
- **Cheap to add a new demo/lab.** The course has ~15 modules; authoring a new interactive piece should be a small, well-worn path, not a bespoke project each time. This argues for a shared shell + a library of reusable pieces (camera controllers, plotting, control panels).
- **Consistent visual identity** with the lectures/readings (shared palette, typography where practical).
- **Maintainable by one person** (plus occasional help), in a stack that's approachable and well-documented.
- **Open source**, GPL v3, matching the rest of the course.

## Non-goals (for now)

- **No accounts, logins, or server-side student data.** Labs are self-contained; grading happens off the handout, not in the app. (Revisit only if a specific lab genuinely needs saved state across sessions.)
- **Not a LMS / not autograded.** The app produces the interactive experience and, where useful, the numbers a student copies into their report. It does not submit or score.
- **Not a general game engine or a showcase of graphics tech.** 3D is in service of specific concepts; scenes should be as simple as the pedagogy allows.
- **No mobile-phone-first design.** Tablets/phones are a nice-to-have, not a target; the four listed platforms are the commitment.

## Open questions

- Do any labs need **saved/exportable state** (student measurements persisted or downloadable), or is "read the number off the screen and type it into the handout" enough for all of them? Default assumption is read-off-screen; flag any exception per-lab in [`LAB_IDEAS.md`](LAB_IDEAS.md).

*(Resolved and folded in: the heaviest-scene / performance question — the ceiling is one focal network's complexity, not scene size or agent count — and the native-installer question — PWA is enough for now, Tauri deferred. Both are recorded in [`ARCHITECTURE_DECISION.md`](ARCHITECTURE_DECISION.md).)*
