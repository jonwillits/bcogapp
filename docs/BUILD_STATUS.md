# App Build Status

The build tracker for the **BCOG 100 Course App** — the step-by-step "what's done / what's next" for the code itself. Pairs with [`APP_DEVELOPMENT_PROCESS.md`](APP_DEVELOPMENT_PROCESS.md) (the recipe), [`ARCHITECTURE_DECISION.md`](ARCHITECTURE_DECISION.md) (the stack), and [`LAB_IDEAS.md`](LAB_IDEAS.md) (per-module scene ideas). Check items off as they land; keep it lean.

> **Stack:** web-first PWA · Vite + React + TypeScript · Three.js / react-three-fiber · plain-TS sim/neural layer. **License:** GPL v3. **Home:** standalone git repo `github.com/jonwillits/bcogapp`, active clone on **local disk outside any cloud-synced folder** (never run `npm install` inside Box/Drive/Dropbox — sync churns `node_modules` and can corrupt `.git`).

## Phase 0 — Repo & environment

- [x] Create the working clone on plain local disk, outside sync — `~/Documents/Projects/bcogapp` (cloned from the existing remote).
- [x] `git init`; create `github.com/jonwillits/bcogapp` (GPL v3) and set the remote — repo pre-existed; cloned, `origin` set, default branch `main`.
- [x] Copy the planning docs (`README.md` + `docs/`) from the Box course folder into the repo as the first commit (committed locally; push pending `gh auth`).
- [x] Add `LICENSE` (GPL v3) and `.gitignore` (`node_modules/`, `dist/`, `.DS_Store`, etc.) — LICENSE already GPLv3; replaced the Python `.gitignore` template with a Node/Vite one.
- [x] Update the course top-level README so it points to the repo by URL and describes the local-clone + GitHub layout (retired the "checked out at `course_creation/app/`" wording).
- [ ] (Optional) connect `~/Documents/Projects/bcogapp` as a Cowork workspace if we want to touch it from Cowork too.

## Phase 1 — Scaffold

- [x] Vite + React + TypeScript project (Vite 8, React 19, TS 6; `create-vite react-ts`).
- [x] Add deps: `three`, `@react-three/fiber`, `@react-three/drei`, `vite-plugin-pwa` (+ `@types/three`).
- [x] Create the folder layout from `APP_DEVELOPMENT_PROCESS.md`: `src/shell`, `src/components`, `src/sim/{creature,neural,world}`, `src/scenes`, `src/theme`, `public/`.
- [x] Hash-router + scene picker in `App.tsx` (`useHashRoute`, `scenes` registry, `Home` picker with built + planned cards).
- [x] Confirm `npm run dev` (hot reload) and `npm run build` both work; PWA manifest + service worker generated.

## Phase 2 — Shared shell & reusable pieces

- [x] App shell/layout + inspection-panel frame (`AppShell`, `SceneCanvasLayout`, `Panel`).
- [x] `CameraRig` (drei OrbitControls; fly/pointer-lock can slot in behind the same component later).
- [x] `ControlPanel` (sliders/toggles/reset), `Plot` (canvas/SVG), `ValueReadout`, `StepControls` (play/pause/speed/step) — built as `Panel` + `controls.tsx` primitives (Slider/SelectControl/Toggle/Button), `Plot` (SVG), `ValueReadout`, `StepControls`.
- [~] `theme/` palette + typography — tokens in place (CSS vars + TS mirror); **still a placeholder palette, to be tuned to the lecture decks.**
- [x] Sim/render separation: sim is plain TS in `sim/`, driven from the scene via `useFrame`; verified unit-testable without a browser (7 vitest tests, `npm run test`).

## Phase 3 — Module 1 vehicles scene (first spine stage)

- [x] Creature engine v0 in `sim/creature` + `sim/neural`: sensor→motor wiring, differential-drive movement on a plane (`vehicle.ts`, `sensorimotor.ts`, `world.ts`).
- [x] `scenes/m01_vehicles/` — 3D render, orbit-camera-navigable arena with light sources (click ground to add, click light to remove).
- [x] Click a vehicle → wiring shown in a side panel (`VehicleInspector` + live `WiringDiagram`, sensor plot, value readouts).
- [x] Controls for wiring options; watch emergent approach/avoid behavior (4 presets: Fear/Aggression/Love/Explorer; gain + base sliders). Verified in-browser: Aggression vehicles charge the lights.
- [x] Register in the scene picker (lazy-loaded); matches the theme.

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
- **2026-07-15** — Phase 0 done. Installed Node 26.5.0 / npm 11.17.0 / gh 2.96.0 via Homebrew. Cloned the pre-existing `github.com/jonwillits/bcogapp` (public) to `~/Documents/Projects/bcogapp`. Seeded it with the planning docs (`README.md` + `docs/`) from Box; kept the repo's GPLv3 `LICENSE`; replaced its Python `.gitignore` with a Node/Vite one. Committed locally (author: Jon Willits). Retired the "checked out at `course_creation/app/`" wording in the course top-level README (app now described as a standalone repo + local clone). **This repo copy of the docs is now the live tracker; the Box `app/docs/` copy is the frozen seed.** Remaining: `git push` is blocked on interactive `gh auth login` (to be run by Jon). Next: Phase 1 scaffold.
- **2026-07-15** — Phase 1 done. Scaffolded Vite 8 + React 19 + TS 6 (oxlint) and merged into the repo (kept our README/.gitignore/LICENSE/docs). Added `three` 0.185 / r3f 9.6 / drei 10.7 / vite-plugin-pwa 1.3. Built the shell: `AppShell` top bar, `Home` scene picker (built + planned cards), `useHashRoute` hash router, `scenes/registry.ts`, `theme/` tokens (CSS vars + TS mirror; **placeholder palette — tune to lecture decks later**), PWA manifest + SVG app icon. `npm run build` clean (TS + SW generate); `npm run dev` verified in-browser, no console errors. Next: Phase 2 (shared reusable components) → Phase 3 (M1 vehicles scene).
- **2026-07-15** — Bugfix: sensor trace advanced on a wall-clock timer, so it kept scrolling while paused. Moved the trace into the sim — each vehicle now keeps a rolling `history` appended once per `world.step()` (frozen when paused, +1 sample per single-step). Inspector is now a pure render of `vehicle.history`; the scene pumps a throttled re-render (~12 Hz) only while playing + a vehicle is selected. Locked with a vitest case; verified in-browser (paused = frozen, step = advances). Cleaner data flow (sim → render), matches the architecture docs.
- **2026-07-15** — M1 polish (lab framing). Vehicles now show **one per phenotype, color-coded** (2a blue / 2b purple / 3a teal / 3b pink; non-leading colors, `color` moved into the presets); control panel dropdown replaced by a color legend. **Light editing**: left-click ground adds, right-click removes the nearest light within a radius (context menu suppressed; lights made non-interactive via `raycast`, vehicles stop pointer-down so selecting never drops a light). **Neutral labels**: UI shows only `2a/2b/3a/3b` — Braitenberg's names/descriptions kept in preset data as an answer key but removed from the picker legend and the inspector (inspector now prompts the student to infer behavior from the wiring). Build/lint clean; verified in-browser. Open follow-up: per-vehicle wiring switching if we want students to experiment after inferring.
- **2026-07-15** — Phases 2 + 3 done. **Sim layer** (plain TS, browser-free): `sim/neural/sensorimotor.ts` (2×2 sensor→motor net + wiring presets), `sim/creature/vehicle.ts` (differential-drive kinematics), `sim/creature/vehiclePresets.ts` (Fear/Aggression/Love/Explorer), `sim/world/world.ts` (`VehicleWorld`), `sim/world/source.ts`; 7 vitest tests pass. **Reusable components**: `CameraRig`, `SceneCanvasLayout`, `Panel`, `controls.tsx` (Slider/SelectControl/Toggle/Button), `StepControls`, `ValueReadout`, `Plot`. **M1 scene** `scenes/m01_vehicles/`: 3D orbit arena, glowing sensors, click-to-add/remove lights, click-vehicle→`VehicleInspector` (live wiring diagram + sensor plot + readouts). Scenes lazy-loaded (home 63 KB gz; scene chunk 245 KB gz). `npm run build` + `npm run test` clean; verified in-browser (Aggression vehicles charge lights; inspector live values; camera orbit; M1 shows in picker). **Next: Phase 4 (deploy to GitHub Pages + wire the M1 lab handout), and tune the palette.**
