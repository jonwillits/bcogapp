# Close-out: shipping a lab change to a live class

Run this before anything reaches students.

```bash
npm run closeout
```

One lab when several exist: `npm run closeout m02-evolution`. The document half alone, after a text-only edit: `npm run check:docs`.

It checks, it does not push. The two pushes are yours, in the order it prints.

**There is a skill for this**, so it can be invoked by name rather than remembered: `course_admin/skills/lab-close-out/` in the course folder. It covers shipping a change, registering a new lab, and answering a student who reports a discrepancy.

---

## Why it exists

Module 2 shipped three times in two days with something wrong each time, and none of the failures were subtle:

- A **broken build** committed twice, because the check that was supposed to catch it ended in `| tail` and the shell reported the pipe's exit code rather than the compiler's.
- A **handout describing a simulation that had not existed for months** — generations, an average-energy readout, a "Reset (same seed)" button. Students were told to run for 50 generations in an engine with no generations.
- A **report document that had drifted from the handout**, which a student found and emailed about before we did.

Every one of those was a claim in a document that nothing could check. The lab is two repositories and three artifacts — the app, the handout the app fetches live, and the `.docx` students download — and nothing tied them together.

## What it checks

**1. The app.** Test suite and production build, read by **exit code**. `npm run build` runs `tsc -b`, which is stricter than a bare `tsc --noEmit`: it uses the project references and flags unused locals, so probe files can pass the loose check and fail the build. CI gates the deploy on it.

**2. The documents** (`npm run check:docs`, runnable alone):

- **Retired wording.** A curated list of terms the simulation no longer has — generations, average energy, "Reset (same seed)", "population size", "the pit", the old depleting-food language, British spellings. Each may carry `unless` phrases for the places the term is used correctly, such as telling students there are no generations.
- **Control names.** Every control the labs are allowed to name, checked against strings extracted from the scene source. Renaming a control in the app fails this until the documents follow.
- **Question sets.** The handout and the `.docx` must ask the same questions. This is the check that would have caught the student's email.

**3. Claims that carry a test.** The half a word-checker cannot reach. A document can name every control correctly and still promise something the simulation does not do — Q18 did exactly that, with valid strings and an exercise that demonstrated nothing, because population Z survived W's world untouched. So each claim the handout makes about *what a student will see* is listed against the test that goes red if it stops being true, and claims with no test are **named rather than assumed**.

Currently unbacked: *"Part 1: a population visibly adapts."* At the shipped defaults, births per minute sits flat at about sixteen and the fraction steering toward light falls in four seeds of ten. The handout no longer promises improvement, but the section is still called "Watch a Population Adapt".

**4. What would be pushed.** Both repositories: commits ahead, whether you are behind origin, and which uncommitted paths are lab files versus work in progress that must not be swept in. It also spots a stale `.git/index.lock`, which the Box-synced course repo has produced twice.

**5. What only a person can confirm.** The Browser pane throttles `requestAnimationFrame`, which freezes react-three-fiber's `useFrame`, so no automated check in this repo can see motion. The close-out prints the expected counts and behaviours so that looking at the scene is a check against specific predictions rather than a general impression.

## The push order

**App first** when the documents describe something new in it — otherwise the handout tells students to use a control that is not deployed yet. **Documents first** when they are correcting something already wrong, since every minute the wrong text is live is a student reading it.

The handout is fetched live from `intro_to_bcs`, so document changes reach students within minutes and need no redeploy.

## Adding a lab

Everything module-specific lives in **`scripts/labs.config.mjs`**. Neither script knows about any particular module, so registering a new lab is one entry with four fields — which are the four ways a lab has gone wrong:

- **`retired`** — words the design abandoned and left stranded in the documents. Each may carry `unless` phrases for the places the term is used correctly.
- **`controls`** — every control name the documents may use, checked against strings extracted from that scene.
- **`claims`** — promises about what a student will see, each paired with a fragment of the test name that would go red if it stopped being true. `test: null` prints as an unbacked promise, which is the honest state until someone measures it.
- **`crib`** — the probe that prints what a person should look for.

`BANNED_EVERYWHERE` in the same file holds house style, checked in every lab. Keep it short: a rule there applies to documents nobody is currently thinking about.

**Write the test before the handout makes the promise.** That is the habit the whole of section 3 exists to enforce.
