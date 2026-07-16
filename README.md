# BCOG 100 Course App

Interactive **demonstrations** and **lab activities** for BCOG 100 — Introduction to Brain and Cognitive Science. One home-grown app, replacing the patchwork of external sites (trinket.io pygame sims, TensorFlow Playground, Prisoner's-Dilemma pages) with something that runs the same way on every device a student or instructor brings to class.

## ▶️ Live: <https://jonwillits.github.io/bcogapp/>

**Students need only a browser.** Open the link on Mac, Windows, Linux, or a Chromebook — nothing to install, no accounts, no setup. It's an installable PWA, so it also works offline after the first visit.

> **Status:** Module 1 (Braitenberg Vehicles) is built and deployed. The stack is decided and the shared shell exists, so further scenes are additive. See [`docs/BUILD_STATUS.md`](docs/BUILD_STATUS.md) for what's next.

## Working on it

Node and npm are **build tools only** — they never touch a student's machine.

```bash
npm install     # first time only
npm run dev     # http://localhost:5173
npm run test    # sim unit tests (no browser needed)
npm run build   # production bundle
npm run preview # serve the built app at /bcogapp/
```

Pushing to `main` **auto-deploys** via GitHub Actions ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)); the tests gate the deploy.

## How it's organized

```
src/
  main.tsx · App.tsx     entry + hash router
  shell/                 AppShell (top bar, lab drawer), Home (scene picker)
  components/            reusable: CameraRig, Panel, controls, Plot,
                         StepControls, ValueReadout, LabPane, SceneCanvasLayout
  sim/                   simulation + neural logic — plain TS, no React/Three,
    creature/ neural/ world/    unit-testable without a browser
  scenes/                one folder per module scene; registry.ts registers them
    m01_vehicles/
  theme/                 palette + type tokens
```

Two rules carry the design (see [`docs/APP_DEVELOPMENT_PROCESS.md`](docs/APP_DEVELOPMENT_PROCESS.md)):

- **Sim/render separation.** Everything in `src/sim/` is plain TypeScript with no React or Three.js imports, driven from a scene via r3f's `useFrame`. It's unit-tested with vitest.
- **One evolving-creature engine**, parameterized by evolutionary stage, rather than a new creature per module. M1's vehicle is the seed: its 2×2 sensor→actuator weight matrix is the same structure M5/M7 will attach learning to.

## Lab text lives in the course repo

Scenes don't store their handouts. A scene declares a `lab` source and the shared `LabPane` **fetches the markdown at runtime** from [`intro_to_bcs`](https://github.com/jonwillits/intro_to_bcs), which stays the single source of truth — so editing a handout there updates every student's view **with no redeploy**. If the fetch fails, the pane degrades to a clear message plus a direct link.

## Documentation

| Doc | What it holds |
|---|---|
| [`docs/APP_DESIGN.md`](docs/APP_DESIGN.md) | Goals, hard requirements, the demos-vs-labs model, scope and non-goals. The design spine. |
| [`docs/ARCHITECTURE_DECISION.md`](docs/ARCHITECTURE_DECISION.md) | The stack decision (web-first PWA + Three.js/r3f), the binding-constraint analysis, and the alternatives rejected. |
| [`docs/APP_DEVELOPMENT_PROCESS.md`](docs/APP_DEVELOPMENT_PROCESS.md) | The recipe for taking one demo or lab from idea to shipped, plus the repo conventions. |
| [`docs/LAB_IDEAS.md`](docs/LAB_IDEAS.md) | Per-module demo/lab ideas and the inventory of external sites to migrate. |
| [`docs/BUILD_STATUS.md`](docs/BUILD_STATUS.md) | The build tracker and running log. The live "what's next". |

## Repository

Standalone repo, GPL v3. Because it's a live code project, its canonical home is **GitHub + a working clone on plain local disk** (`~/Documents/Projects/bcogapp`) — **never** inside Box/Drive/Dropbox, where sync churns `node_modules/` and can corrupt `.git`. The course directory references this repo by URL rather than holding a checkout.

## Relationship to the rest of the course

The app is a **course-creation tool**: developed and versioned separately from the module content, but the labs it produces are course artifacts. Handouts and rubrics stay with their module in the `intro_to_bcs` repo and follow the course's own process; this repo owns the scene code.
