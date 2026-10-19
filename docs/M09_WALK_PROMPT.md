# Prompt for the session that walks `m09-rat` with Jon

Written 2026-10-19 by the session that built the scene, to be pasted into a fresh session started in `~/Documents/Projects/bcogapp`. Paste everything below the line.

---

We are walking **Lab 9, The Way Home** (`#/m09-rat`) together, interactively: I drive the scene in my browser at `http://localhost:5173/#/m09-rat` and bring you what I see, one part at a time; you compare it with the predictions, fix what needs fixing on the branch, keep the records true, and tell me what to look at next.

**State.** Branch `m09-rat` in this clone, seven commits off `main`, working tree clean, nothing pushed, nothing merged. 672 tests pass (`npm run test`; one Lab 8 speed test at 75 ms fails only when the machine is busy), the build is clean, and `npm run closeout m09-rat` prints the 49 claims and the crib. A dev server from this clone may already be on port 5173; start one with `npm run dev` if not. Prefix shell commands with `export PATH="/opt/homebrew/bin:$PATH"`.

**Read these first, in this order.**

1. `docs/M09_AS_BUILT_NOTES.md` — every control as it shipped, the spatial system's constants, every world, every measured number with its seeds, the timing, and §5, the fourteen places the build departed from the spec or its targets came out different. §7 is the hand-off state.
2. The walk-through I am working from: `/Users/jon/Library/CloudStorage/Box-Box/teaching/bcog_web/courses/introduction_to_brain_and_cognitive_science_1/current_version/course_creation/labs/09_spatial_cognition/LAB_9_WALKTHROUGH.md`. Its §9 holds eight judgment calls I will answer as we go, and §10 the targets that came out different. **That file is the one file you may edit inside the Box folder**: revise it in place as the scene changes under me, as Lab 8's walk did, and record my answers in §9.
3. The spec, `m09_rat_SCENE_SPEC.md` beside it, and the build prompt, `CLAUDE_CODE_PROMPT.md`, for the contract and the seven non-negotiables, each held by a named test. Do not retune a mechanism to make a reading's number come out; measure and record.
4. `docs/APP_DEVELOPMENT_PROCESS.md` Phase 2.5, and `docs/M07_AS_BUILT_NOTES.md` §7 and `docs/M08_AS_BUILT_NOTES.md` for how the last two walks were run and recorded.

**Where things live.** Sim in `src/sim/rodent/` (the spatial system under `spatial/`: `ring.ts`, `estimate.ts`, `stability.ts`, `maps.ts`, `system.ts`; the body, rooms, recording session, homing runner, rats, patch world beside it). Scene in `src/scenes/m09_rat/` (one plain store per part: `homeStore.ts`, `ratsStore.ts`, `cellsStore.ts`, `patchStore.ts`; `AnimalCamera.tsx` is the eye/follow controller; `RangeView.tsx`, `BoxView.tsx`, `LabView.tsx` draw the three worlds). Tests beside the code; the crib is `src/sim/rodent/crib.probe.ts`, the timing probe `timing.probe.ts`, the frame-rate script `scripts/m09-fps.mjs` (headed Chromium; only meaningful with nothing else running).

**Two decisions the measurements forced, which the spec did not say, and which I may overrule** (notes §5.1 and §5.2): a card the rat has seen move loses control through a stability rule (each bearing jump the turn signal does not match halves the weight the system gives the landmark), because weight spreading alone never did it in any regime where takeover, rotation and lit stability all held; and the rings read a landmark's direction as seen from the room's center, because a card on a 1 m box's wall swings with every step.

**Rules for the walk.** Every change I ask for goes on the branch in a commit that says why, ending with the `Co-Authored-By:` line the repo's recent history uses. If a change moves a number, re-run the crib (`PROBE=1 PROBE_DIR=src/sim/rodent npx vitest run --disable-console-intercept -t "crib:"`, about ten minutes) and correct the notes §4, the walk-through's predictions, and any test band it crosses. Keep the suite green. The interface rules hold: a selected control changes color and never size; live text never reflows and a signed value keeps its sign's place; no agentic verbs about cells, rings, programs or programmed rats; no British spellings. Never `npm install` inside Box; never edit anything in Box but the walk-through. Ask me before pushing anything. The handout is written after the walk, from the notes; do not start it.

**Start by** confirming the branch, the tests and the dev server, then ask me which part I am on.
