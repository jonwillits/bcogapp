# App Development Process

The recipe for taking one **demo** or **lab** from idea to shipped inside the course app. Parallels the course's [`WEEK_DEVELOPMENT_PROCESS.md`](../../WEEK_DEVELOPMENT_PROCESS.md): this is the *recipe*, not a tracker. Per-item status lives in `LAB_IDEAS.md` (and, once the repo exists, its own build tracker).

> **Stack (decided 2026-07-13):** web-first PWA, **Vite + React + TypeScript + Three.js/react-three-fiber**; simulation/neural logic as plain TS; inspection UI in React/DOM. See [`ARCHITECTURE_DECISION.md`](ARCHITECTURE_DECISION.md). Stack-specific steps are marked ⚙️. The concrete layout below is the initial proposal — firm it up when the repo is first scaffolded.

## What "shipped" means for one interactive piece

A finished demo or lab is **four things**, mirroring how the course treats its artifacts:

| Piece | What it is | Where it lives |
|---|---|---|
| **Interactive scene** | The runnable demo/lab in the app (a route/screen the app can open) | app repo (`current_version/course_creation/app/`) |
| **Lab handout** *(labs only)* | The student-facing instructions + questions that point at the scene | `intro_to_bcs/<module>/<module>_lab.md` |
| **Rubric** *(graded labs only)* | Grading guide, if the lab is graded | `course_admin/grading_guides/` |
| **Entry in the tracker** | Status + which module it serves | `LAB_IDEAS.md` (app-side) and the course `BUILD_STATUS.md` (module-side) |

A demo used only for lecture may be just the scene plus a tracker entry — no handout, no rubric.

## The phases

### Phase 0 — Scope one piece
- Pick the module and the concept the piece must make vivid. One concept per piece; resist bundling.
- Decide **mode**: instructor demo, student lab, or a scene that serves both.
- Note what it replaces, if anything (an external site — see the migration inventory in `LAB_IDEAS.md`).
- Sketch the interaction: what the user manipulates, what they observe, and — for labs — what numbers/plots the handout will ask them to read off.

### Phase 1 — Spec the interaction
- Write a short spec into `LAB_IDEAS.md` under that module: inputs (controls), outputs (what's shown/measured), and whether it needs 3D + camera, 2D canvas/plot, or plain UI.
- Flag any **performance risk** (heavy 3D) so it's weighed against the low-end-Chromebook budget.
- Flag any **state need** (does the student need to save/export a result, or just read it off screen?). Most labs should be read-off-screen; anything more is an explicit decision.
- Confirm the concept, terms, and framing against the module's reading/lectures so the app agrees with the rest of the course.

### Phase 2 — Build the scene ⚙️
- Add a new scene folder `src/scenes/mNN_<slug>/` exporting a React component, and register its route in the scene picker.
- Build the interaction from the shared pieces in `src/components/` (camera rig, control panel, plot, value readout, step controls) — don't reinvent them.
- Put all simulation/neural logic in `src/sim/` (plain TS), driven from the scene via r3f's `useFrame`. Keep sim logic out of components so it's testable and reusable across stages.
- For spine (evolving-creature) modules, extend the shared engine in `src/sim/creature|neural|world/` behind a stage flag — don't fork a new creature.
- Keep parameters exposed and legible; match the course palette/typography from `src/theme/`.
- **Measure every synchronous path before it ships, and keep the probe.** Write a `timing.probe.ts` beside the sim (Module 4's is the pattern) that times scene construction, any head start or warm-up, one fixed step, one frame at the maximum speed, one second of simulation, and every instrument the panels compute per render or on a slider change. Anything over about 300 ms on a click path or in a render, after multiplying by four for a student laptop, gets the Lab 3 treatment: made incremental across frames with a progress badge, bit-identical to the one-shot version, with a test that says so (`NeuronWorld.warmUp` / `fastForward` and `NeuronScene`'s `WarmUpBadge`). Check the frame loop's clamp and step cap while you are there, and that no per-step list grows without a cap. The reasoning is in `APP_DESIGN.md` under hard requirements.

### Phase 2.5 — The walk-through document *(labs; as soon as the first draft runs)*

**When the first draft of a lab scene is up and running — every scenario loads, the acceptance tests pass — the build session writes a walk-through document before anything else happens.** Not the handout, not a merge, not a push. Motion cannot be verified headlessly, the person who knows what the lab is for has not seen it yet, and every lab so far changed after Jon first watched it (Lab 4: sixteen of eighteen predictions held, and the two that did not were real).

- It is a Markdown file **beside the scene spec in the course folder**, `course_creation/labs/NN_<module>/LAB_N_WALKTHROUGH.md`, so Jon can edit it inline. This is the one file a build session writes into the course folder; say so when you do it.
- **At the top: the exact command that starts it running, and the local URL**, including the branch to check out and the route. Then the close-out command that reprints the predictions.
- Then a checklist, one section per scenario plus the shell, wording, and the previous lab's regression. **Every item is a prediction to check against — a count, a time, a value, a thing that should NOT happen — never "does it look right".** Take the numbers from the crib probe, with the seeds they were measured over. Flag the items the session could least check itself, and put the open judgment calls in as questions.
- A *Notes:* line under each section, a list of what is already known to be imperfect, and an empty section at the end for everything else.
- One paragraph per line, as in every `.md` in that folder.

Jon walks it, edits it in place, and hands back notes. The handout (Phase 3) is written after that pass, from the as-built notes as corrected by it. `labs/05_learning_and_plasticity/LAB_5_WALKTHROUGH.md` is the pattern.

### Phase 3 — Author the handout *(labs only)*
- Write/adapt `intro_to_bcs/<module>/<module>_lab.md` per the course [`WEEK_DEVELOPMENT_PROCESS.md`](../../WEEK_DEVELOPMENT_PROCESS.md) Phase 4 (activity-based, references the reading/lectures, points at the in-app scene rather than an external URL).
- Make sure every question the handout asks maps to something the scene actually lets the student see/measure.
- **The handout points at the reading; the reading and the lectures never point at the lab** (Jon's standing rule, recorded 2026-09-22). A lab is the artifact most likely to change, and a chapter or deck that names it has to change with it. So no "see the lab" sentence is ever owed by a chapter, and any such item in a tracker is a mistake to remove, not a debt to pay.
- If graded, create/point to the rubric in `course_admin/grading_guides/`.

### Phase 4 — Test on the binding platform
- Verify it runs and performs acceptably **in a browser on a low-end Chromebook-class device** (the constraint that matters), plus a quick check on Mac/Win/Linux.
- Click every button that loads or resets something and watch the tab: if the page goes unresponsive for even a second on the Mac, it is several on the binding platform. The timing probe from Phase 2 says which call it is.
- Sanity-check that a student with zero setup can launch and complete it.
- Spot-check the 3D camera controls feel right (no lost-in-space, sensible reset).

### Phase 5 — Integrate & record
- Update the app-side tracker (`LAB_IDEAS.md`) status for the piece.
- Update the course `BUILD_STATUS.md`: the module's Lab cell and the per-module task, noting the lab is now app-hosted (and which external site it retired).
- If the lab replaced an external URL, remove/redirect that URL in the module's `_lab.md`.

## How the app maps to the course

- **One module can have several pieces** (a lecture demo plus a lab, or multiple demos across its three Marr-level lectures).
- The **canonical list of modules** is `intro_to_bcs/README.md`; the app never invents module names — it uses the same `<module>` folder names.
- The app is a **course-creation tool**: it's developed/versioned in its own repo, but the labs it produces are course artifacts governed by the course's own process and trackers. When in doubt about where a *handout* or *rubric* goes, the course `WEEK_DEVELOPMENT_PROCESS.md` wins; when in doubt about the *scene/code*, this doc wins.

## Conventions ⚙️

*Initial proposal — refine when the repo is first scaffolded.*

**Proposed repo layout** (Vite + React + TS + r3f PWA):

```
app/
  index.html · package.json · vite.config.ts   # three, @react-three/fiber, @react-three/drei, vite-plugin-pwa
  public/                    # PWA manifest, icons, static assets
  src/
    main.tsx · App.tsx       # entry + scene picker / router
    shell/                   # shared layout, nav, panel frame
    components/              # CameraRig, ControlPanel, Plot, ValueReadout, StepControls
    sim/                     # stack-independent simulation + neural logic (plain TS)
      creature/  neural/  world/   # the evolving-creature engine, learning rules, environment + NPCs
    scenes/                  # one folder per module scene
      m01_vehicles/  m03_neuron/  m04_circuits/  ...
    theme/                   # palette/typography aligned with the lectures
```

- **Scene naming:** `src/scenes/mNN_<slug>/`, `NN` = zero-padded module number matching the `intro_to_bcs/` folder; exports a React component + a small manifest (title, module, mode: demo/lab/both).
- **Routing:** hash routes (e.g. `/#/m04-circuits`) so deep links work offline inside the installed PWA.
- **Linking from a lab handout:** `intro_to_bcs/<module>/<module>_lab.md` links to the scene's hosted route (replacing the old external URL), not to a local file.
- **Lab text in the app (the in-scene Lab pane):** the handout stays **canonical in `intro_to_bcs`** — the app never keeps a copy. A scene declares a `lab` source in its manifest (`rawUrl` on `raw.githubusercontent.com`, `sourceUrl`, optional `reportUrl`), and the shared `LabPane` **fetches the markdown at runtime** and renders it beside the scene. Consequences worth knowing: editing the handout in the course repo updates every student's view **with no redeploy**; relative links/images in the handout are rewritten against the raw URL so they resolve across repos; the service worker caches the fetch (`StaleWhileRevalidate`) so labs still open offline after one visit; and if the fetch fails (offline first-visit, file moved/renamed) the pane degrades to "Lab info not available" plus a direct link. **Because students read the handout inside the app, a stale handout is now visible to them** — keep it in sync with what the scene actually does.
- **Scene picker:** the home screen groups scenes into one row per module, using the canonical module titles from `intro_to_bcs/README.md` (mirrored in `MODULES` in `src/scenes/registry.ts` — never invent names). A module row appears only once it has at least one demo, built (`scenes`) or planned (`plannedScenes`); a module may hold several of either.
- **Camera controls:** use `@react-three/drei` (`OrbitControls` / `FlyControls` / `PointerLockControls`) via the shared `CameraRig`.
- **Build/deploy:** `npm run dev` locally; `npm run build` → static bundle → host as a PWA (GitHub Pages fits the existing `jonwillits` GitHub pattern).
- **Sim/render separation:** simulation state and neural math live in `src/sim/` and are unit-testable without a browser; components only render and wire controls.
