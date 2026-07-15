# App Build Status

The build tracker for the **BCOG 100 Course App** — the step-by-step "what's done / what's next" for the code itself. Pairs with [`APP_DEVELOPMENT_PROCESS.md`](APP_DEVELOPMENT_PROCESS.md) (the recipe), [`ARCHITECTURE_DECISION.md`](ARCHITECTURE_DECISION.md) (the stack), and [`LAB_IDEAS.md`](LAB_IDEAS.md) (per-module scene ideas). Check items off as they land; keep it lean.

> **Stack:** web-first PWA · Vite + React + TypeScript · Three.js / react-three-fiber · plain-TS sim/neural layer. **License:** GPL v3. **Home:** standalone git repo `github.com/jonwillits/bcogapp`, active clone on **local disk outside any cloud-synced folder** (never run `npm install` inside Box/Drive/Dropbox — sync churns `node_modules` and can corrupt `.git`).

## Phase 0 — Repo & environment

- [ ] Create the working clone on plain local disk, outside sync (e.g. `~/dev/bcogapp`).
- [ ] `git init`; create `github.com/jonwillits/bcogapp` (GPL v3) and set the remote.
- [ ] Copy the planning docs (`README.md` + `docs/`) from the Box course folder into the repo as the first commit.
- [ ] Add `LICENSE` (GPL v3) and `.gitignore` (`node_modules/`, `dist/`, `.DS_Store`, etc.).
- [ ] Update the course top-level README so it points to the repo by URL and describes the local-clone + GitHub layout (retire the "checked out at `course_creation/app/`" wording).
- [ ] (Optional) connect `~/dev/bcogapp` as a Cowork workspace if we want to touch it from Cowork too.

## Phase 1 — Scaffold

- [ ] Vite + React + TypeScript project.
- [ ] Add deps: `three`, `@react-three/fiber`, `@react-three/drei`, `vite-plugin-pwa`.
- [ ] Create the folder layout from `APP_DEVELOPMENT_PROCESS.md`: `src/shell`, `src/components`, `src/sim/{creature,neural,world}`, `src/scenes`, `src/theme`, `public/`.
- [ ] Hash-router + scene picker in `App.tsx`.
- [ ] Confirm `npm run dev` (hot reload) and `npm run build` both work; PWA manifest present.

## Phase 2 — Shared shell & reusable pieces

- [ ] App shell/layout + inspection-panel frame.
- [ ] `CameraRig` (orbit/fly/pointer-lock via drei).
- [ ] `ControlPanel` (sliders/toggles/reset), `Plot` (canvas/SVG), `ValueReadout`, `StepControls` (play/pause/speed/step).
- [ ] `theme/` palette + typography aligned with the lecture decks.
- [ ] Sim/render separation: a tick loop in `sim/` driven from a scene via `useFrame`, unit-testable without a browser.

## Phase 3 — Module 1 vehicles scene (first spine stage)

- [ ] Creature engine v0 in `sim/creature` + `sim/neural`: sensor→motor wiring, movement on a plane.
- [ ] `scenes/m01_vehicles/` — 3D render, camera-navigable environment with stimuli.
- [ ] Click a vehicle → wiring shown in a side panel.
- [ ] Controls for wiring options; watch emergent approach/avoid behavior.
- [ ] Register in the scene picker; matches the theme.

## Phase 4 — Deploy & integrate

- [ ] Deploy the PWA (GitHub Pages fits the `jonwillits` pattern); confirm install + offline + deep-link routes.
- [ ] Update `intro_to_bcs/mind_and_brain/levels_of_analysis_lab/vehicles_lab.md` to link the hosted scene (replacing the local-Python setup).
- [ ] Update the course `BUILD_STATUS.md` (Module 1 Lab cell + note it's app-hosted) and this tracker.

## Later stages (backlog — see `LAB_IDEAS.md`)

- [ ] M4 bilaterian: logical circuits into the creature (port of the trinket 4-neuron net).
- [ ] M5 fish: learning (adaptation, Hebbian, error-driven, RL).
- [ ] M7 fish: harder pattern recognition (XOR, circle-surround, hidden layers vs. features, train/test).
- [ ] M3 neuron satellite scene; M6 brain flythrough; M11 (two-network game theory); M12–14 abstract demos.

## Log

- **2026-07-13** — Tracker created. Docs + stack decided in Cowork; build to proceed in Claude Code (local disk + GitHub). Next: Phase 0.
