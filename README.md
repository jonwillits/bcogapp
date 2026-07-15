# BCOG 100 Course App

A cross-platform application for **in-class demonstrations** and **student lab activities** in BCOG 100 — Introduction to Brain and Cognitive Science. It replaces the current patchwork of external websites (trinket.io pygame sims, TensorFlow Playground, Prisoner's-Dilemma pages, etc.) with one home-grown app that runs the same way on every device a student or instructor might bring to class.

> **Status: planning.** No code yet. The tech stack is an **open decision** — see [`docs/ARCHITECTURE_DECISION.md`](docs/ARCHITECTURE_DECISION.md). We are gathering the lab/demo requirements first (in [`docs/LAB_IDEAS.md`](docs/LAB_IDEAS.md)) so the stack is chosen to fit what the labs actually need, rather than the other way around.

## Why this exists

The course's demos and labs currently live on third-party sites. That creates real problems: links rot, the UIs aren't ours to fix or align with the lectures, some sites don't work well (or at all) on Chromebooks, and there's no unified look or offline story for classroom use. Consolidating them into one app we control fixes all of that and lets demos and labs share a common visual language with the lectures and readings.

## Hard requirements (the ones that shape everything)

- **Runs on Mac, Windows, Linux, and Chromebook.** Students bring all four; Chromebooks are common and are the binding constraint (see the architecture doc).
- **Supports interactive 3D graphical simulations with free camera control** (orbit/fly/first-person), since several planned demos are spatial.
- **Serves two modes:** lightweight *demonstrations* the instructor drives live in class, and *lab activities* students run themselves and answer questions about.

Full requirements and scope are in [`docs/APP_DESIGN.md`](docs/APP_DESIGN.md).

## Documentation

| Doc | What it holds |
|---|---|
| [`docs/APP_DESIGN.md`](docs/APP_DESIGN.md) | Goals, hard requirements, the demos-vs-labs model, scope and non-goals. The design spine. |
| [`docs/ARCHITECTURE_DECISION.md`](docs/ARCHITECTURE_DECISION.md) | The open tech-stack decision: the binding-constraint analysis, candidate stacks, tradeoffs, and the questions we need to answer to choose. |
| [`docs/APP_DEVELOPMENT_PROCESS.md`](docs/APP_DEVELOPMENT_PROCESS.md) | The recipe for taking one demo or lab from idea to shipped, and how the app maps back to the course modules. |
| [`docs/LAB_IDEAS.md`](docs/LAB_IDEAS.md) | Running capture of demo/lab ideas per module, plus the inventory of external-site labs to migrate. Filled in interactively. |
| [`docs/BUILD_STATUS.md`](docs/BUILD_STATUS.md) | The step-by-step build tracker for the code (repo setup → scaffold → shell → Module 1 → deploy). The live "what's next" for development. |

## Repository

The app is a **standalone git repo** (planned remote `github.com/jonwillits/bcogapp`, GPL v3 — confirm name). Because it's a live code project, its **canonical home is GitHub + a working clone on plain local disk** (e.g. `~/dev/bcogapp`), **not** a checkout inside a cloud-synced folder: file-sync tools (Box/Drive/Dropbox/iCloud) churn on `node_modules/` and can corrupt a git repo. These planning docs currently live in the Box course folder and will **seed the repo's first commit**, after which the course directory just references the repo by URL rather than holding a live checkout. Build steps are tracked in [`docs/BUILD_STATUS.md`](docs/BUILD_STATUS.md).

## Relationship to the rest of the course

The app is a **course-creation tool**: it produces artifacts (demos, labs) that students use, but it is developed and versioned separately from the module content. Finished lab *instructions* still live with their module in `intro_to_bcs/<module>/<module>_lab.md`; the app provides the interactive piece those instructions point to. See the course-level [`../../../README.md`](../../../README.md) and [`../WEEK_DEVELOPMENT_PROCESS.md`](../WEEK_DEVELOPMENT_PROCESS.md) for how labs fit the per-module deliverable model.
