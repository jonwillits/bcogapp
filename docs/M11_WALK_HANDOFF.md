# Lab 11 walk: instructions for the thread that runs it

This file briefs a fresh Claude Code thread for Jon's interactive walk-through of Lab 11, `m11-social` ("Living Among Others"). The build is finished and committed on the branch `m11-social`, eight commits ahead of `main`, nothing pushed. Jon walks the lab in his own browser and reports what he sees, part by part; the thread fixes on the branch, verifies, records his decisions, and never pushes without asking him.

## 1. Read first, in this order

1. `~/.claude/projects/-Users-jon-Documents-Projects-bcogapp/memory/lab11-build-state.md` and `lab10-walk-rules.md` (Jon's standing rules; they carry over).
2. The walk-through, the one file in Box this thread may edit: `/Users/jon/Library/CloudStorage/Box-Box/teaching/bcog_web/courses/introduction_to_brain_and_cognitive_science_1/current_version/course_creation/labs/11_social_cognition/LAB_11_WALKTHROUGH.md`. Its §10 holds the thirteen judgment calls to put to Jon, §11 the spec targets that came out different, §12 the materials for his review and the pending entries, §14 what comes after the walk.
3. `docs/M11_AS_BUILT_NOTES.md` (≈77 KB): the record of every control, material and number; §4 the measurements, §8 the thirteen departures from the spec. Read sections as the walk reaches them, not all at once.
4. The spec, read-only: `.../labs/11_social_cognition/m11_social_SCENE_SPEC.md` (decisions 11 to 18 are Jon's answers) and `CLAUDE_CODE_PROMPT.md` beside it, for the non-negotiables (section 4 below).

Do not re-read the build transcript. What matters from it is in those files.

## 2. Where the lab lives

- Sim: `src/sim/social/` (`game/`, `arena/`, `mirror/`, `paths/`, `shapes/`, `groups/`, `classes.ts`, `references.ts`, `parts.ts`, `progress/`, `crib.probe.ts`).
- Scene: `src/scenes/m11_social/` (`SocialScene.tsx`, `Part0.tsx`, `PartPartners.tsx` + `partners/`, `PartTournament.tsx` + `tournament/`, `PartShapes.tsx` + `shapes/`, `PartArena.tsx` + `arena/`, `PartGroups.tsx` + `groups/`, `PartMirror.tsx` + `mirror/`, `ui.tsx`, `lines.ts`, `contract.ts`, `ClassPanel.tsx`).
- Saved progress: the shared layer `src/sim/progress/` (Lab 10 configures it too; its suite is untouched), Lab 11's configuration in `src/sim/social/progress/`. One storage key, `bcogapp.m11.v1`.
- Close-out entry: `scripts/labs.config.mjs` (`handoutPending: true`, 43 claims). Timing in a real browser: `scripts/m11-timing.mjs`.
- Registry: `src/scenes/registry.ts` (`m11-social`; the handout URL is `social_cognition/among_others_lab/among_others_lab.md`, which does not exist yet).

## 3. Start it running

Jon's own server:

```bash
cd ~/Documents/Projects/bcogapp && git checkout m11-social && npm run dev
```

He opens `http://localhost:5173/#/m11-social`. With `?dev=1` before the hash every tab is open at once; students see the Tournament tab locked until Part 1's diagnosis is committed, with "Skip Part 1" on its lock screen.

The thread's own view is the in-app browser pane: `preview_start {name: "dev"}` (it lands on 5174 or 5175 when Jon's server holds 5173). Node and npm need `export PATH="/opt/homebrew/bin:$PATH"` in every Bash call. Never `npm install` or `pip install` inside Box.

## 4. Rules that stand for the whole walk

- Fix on the branch, one commit per batch, the message saying why, with `git -c core.hooksPath=/dev/null commit` and the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. **Never push without asking Jon.** Never `git add -A` in the course repo.
- Edit nothing in Box but `LAB_11_WALKTHROUGH.md`. Record Jon's answers to §10 under each question, and his findings in the *Notes:* line of each part's section. The spec is his to revise.
- If a change moves a number: rerun the probe that measures it (section 7), then correct notes §4, the walk-through's ranges and the test bands. Never retune a mechanism to make a number come out. Numbers are findings, not targets.
- Keep the suite green (about 1,073 tests, ≈40 s alone) and `npm run closeout m11-social` clean (3 NO TEST claims expected: the two timing claims and legibility). Run them one after the other in the background, writing to the scratchpad; concurrent runs produced spurious timeouts.
- The build's non-negotiables, each held by a test, must survive every fix: commit-then-reveal on every tested surface; no rule name before Part 1's commit; the partner's move never depends on the same round's choice; Part 4's learner computes no line of sight (`structure.test.ts`); Part 6's cells learn only by Lab 5's Prediction setting through `thirdFactor()`/`learnWeights`; nothing leaves the page (`storage.test.ts`); no person, face or photo; no browser dialog; strategies described by behavior alone, with no agentic verbs, no "pays off", no British spellings (`naming.test.ts` holds the vocabulary); films authored as keyframes with the control matched within 10%; the Part 5 bar not alignable; one writer of weights (`oneWriter.test.ts`).
- Interface rules from Lab 10 carry over: a selected control changes color, never size; live text never reflows (`FixedLines`); every text selectable; a large timer on every timed screen; stage notes describe what is shown and never state a conclusion the handout asks for.
- Tell Jon only what cannot be checked programmatically. Verify in the pane first (section 6).

## 5. How the walk goes

Jon goes part by part in his browser and writes what he sees. For each message of his:

1. Reproduce what he reports in the pane, or in a test, before changing anything.
2. Put his §10 answers and findings in the walk-through as they come, not at the end.
3. Fix the batch, run the affected tests and probes, commit once with the reason.
4. Report what changed and what he should now see, in a few lines; attach a screenshot only for a visual change.

Playing Part 1 or judging Part 5 himself is not a naive run and he knows it; he does them for the mechanics. "Clear my saved results" on the Open tab resets everything and draws a new seed behind an in-page confirmation.

## 6. Driving the scene from the pane

- The canvas is black and the clocks stand still while the pane is hidden: call `mcp__ccd_view__show_pane {pane: "preview"}` (and `tabs_select`) before a screenshot or a sim-driven loop, and again after a reload. Even shown, it may run at a few frames a second; the timing numbers come from `node scripts/m11-timing.mjs` (headed Chromium, dev server up), never from the pane.
- Buttons: `button.click()` from `javascript_tool` is reliable; a `find` ref's click sometimes lands nowhere. Real key presses do not hold in the pane; synthesized `KeyboardEvent`s on `window` do.
- The `testId` attributes to read with `read_page` or JS: `partners-status`, `rule-match`, `match`, `last-round`, `predict`, `reveal`, `results-rows`, `rules-table`, `rules-in-words`, `my-table`, `run1`–`run4`, `runs-used`, `rr3`–`rr5`, `predictor-rank`, `predictor-versus`, `student-versus`, `totals`, `shapes-status`, `film`, `describe`, `rate`, `step1-done`, `path`, `path-status`, `judge`, `models-intro`, `trial-status`, `test-result`, `matrix`, `present`, `predicted`, `weights`, `mirror-status`, `record`, `mine`, `parts-done`, `results-all`, `reveal-table`; and the data attributes `data-stage`, `data-lines`, `data-panel`, `data-choice`, `data-chip`, `data-door`, `data-dom-door`, `data-creature`, `data-bar`, `data-checklist`, `data-diagnosis-row`, `data-reveal-record`.
- To jump to a later screen, build a saved state in the page: `const m = await import('/src/sim/social/progress/state.ts')` (Vite serves TS), `const st = m.newState(seed)`, fill `st.units['p1-match-0']` and so on (`{status: 'complete', materials, restarts, result}`; the unit ids are `p1-match-0`…`p1-match-5`, `p1-diagnosis`, `p3-films`, `p3-paths`, `p5-sets`), set `st.flags.skippedPart1` if wanted, write `localStorage['bcogapp.m11.v1'] = JSON.stringify(st)` and reload. Opening every tab needs only `?dev=1`.
- A module edit under HMR leaves the old store instance running, so a string change in a store shows only after a reload.

## 7. Re-measuring

```bash
PROBE=1 PROBE_DIR=src/sim/social npx vitest run --disable-console-intercept -t "crib:"
```

Then by area: the spec §6 numbers `PROBE_DIR=src/sim/social/game -t "measure:"`; the cycle search `-t "cycle:"` (12 min; `CYCLE_QUICK=1 CYCLE_SEEDS=3` for a short one); the animals×tests matrix `PROBE_DIR=src/sim/social/arena -t "matrix:"`; the cells `PROBE_DIR=src/sim/social/mirror -t "mirror:"`; the paths `PROBE_DIR=src/sim/social/paths -t "paths:"`; the films `PROBE_DIR=src/sim/social/shapes -t "films:"`; the texts for the notes `PROBE_DIR=src/scenes/m11_social -t "texts:"`. Probes print; they assert nothing.

## 8. The questions to put to Jon (walk-through §10, in short)

1. Standard arena tests baited with the dominant's door down, only T4–T6 with it watching. Right split? More on the instruction screen about "watching"?
2. T6 places the second piece after the swap, so exactly one piece is unwatched. Right?
3. The learner leans to the clear-barrier piece on T2 (0.71). Leave as a finding, or train with both-open contests?
4. The macaque sees its own hand on 3 grasps in 10 (every grasp seen blocks the copy). A sentence he can stand behind, or drop the own-view inputs?
5. Predictor never spreads without noise, with noise until cost 0.5. The handout's lesson, or reword the cost slider's prediction?
6. Predictor's "lost to probing" negative against the tit-for-tats. Keep the column with its note?
7. Part 2 Step 1's four predictions commit together. Fine, or one per run?
8. Part 3's two reveals come together at the end. Fine, or Step 1's at its commit?
9. The films: Film 2's seven beats readable, the control neutral, speeds and sizes.
10. Part 5's creature (stilt and bulb) and the set names Ostra, Velin, Marl, Tesk.
11. The macaque from simple shapes; camera height and distance.
12. The arena drawing on the dark theme: facing stroke, amber sight shading, white and dashed-blue barriers.
13. Noise as chips (0, 1, 5, 10%) and grid speed as chips (2, 10, 20 a second), not sliders.

Also for his review (§12): every simulated class is "pending" (all four entries of `classes.ts` lack a source) and four references in `references.ts` await their sources.

## 9. After the walk (walk-through §14)

- The handout, from the corrected notes, at `intro_to_bcs/social_cognition/among_others_lab/among_others_lab.md` with its report document (Lab 10's `last_night_lab/` folder is the model, with its `build_report.py`); then `handoutPending: false` in `scripts/labs.config.mjs`. That folder is a Box edit Jon must ask for first, as he did for Lab 10.
- The pending references and simulated classes, from their sources.
- `LAB_11_AS_BUILT.md` beside the walk-through, on Lab 10's model, when he asks.
- Merge `m11-social` into `main` and push (the push deploys), only when Jon says so.
