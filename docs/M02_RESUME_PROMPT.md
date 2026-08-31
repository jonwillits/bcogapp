# Suggested prompt for resuming Module 2 in a fresh session

Copy everything below the line.

---

I'm building the interactive scene for Lab 2 of BCOG 100 (Module 2, Comparative Approaches). The work is well advanced and sits on the branch `m02-evolution` in `~/Documents/Projects/bcogapp` — 30-odd commits, unmerged. **`main` auto-deploys to students, so do not push or merge anything without asking me.**

There is one open problem blocking it, and that's what I want to work on.

**Read these first, in this order:**

1. `docs/M02_SEPARABILITY_PROBLEM.md` — the open problem. Self-contained: root cause, everything already tried with its data, and four options with their costs.
2. `docs/M02_SPEC_DEVIATIONS.md` — where the build departed from the scene spec, and what the student handout still owes as a result.
3. `docs/BUILD_STATUS.md` — where everything stands.

The scene spec and the student handout live in a Box folder outside this repo, at `.../current_version/course_creation/labs/02_comparative_approaches/m02_evolution_SCENE_SPEC.md` and `.../current_version/intro_to_bcs/comparative_approaches/evolution_lab/evolution_lab.md`. **Read them if useful but never edit anything inside Box** — I carry changes across myself, which is what the deviations doc is for.

**The problem.** §6 of the spec calls it the one hard build requirement: in the default world, populations W, X and Y must not be tellable apart by watching. Part 3 of the lab depends on a student being unable to sort them, committing to a guess, and only then designing a test that separates them. The acceptance test said they matched. I watched the scene and sorted them instantly — Y drives backwards where W and X drive forwards, and the test's speed metric took an absolute value, so it couldn't see direction at all.

**Four tests are failing deliberately.** They are the corrected separability checks, in both `continuousLineages.test.ts` and `lineages.test.ts`. They fail because the metric was fixed, not because anything regressed. Do not make the suite green by relaxing them or by restoring the absolute value — **a green suite in this area means the blindness has come back.** They should go green only when the populations genuinely match.

**A rule I want followed, because the same mistake was made twice here.** Both failures in this area were a statistic that couldn't detect the thing it was meant to detect — first mean distance, which is structurally blind to mechanism, then absolute speed, which is blind to direction. So: before trusting any acceptance measure, check it against what someone watching the screen would actually see. And when you tell me a criterion is satisfied, tell me which specific visible behaviours the measure would and wouldn't catch.

**Be sceptical of the existing tests in this area.** They have a track record of agreeing with themselves. Twice they reported separability as satisfied and twice I found the problem by looking.

**The cheapest next step is already identified**: try `Q16@2400` as Y. It is the only non-reversing 3a population the search found, and it is untested as a fixture. It may fail the divergence test for being weakly wired — but that is one search away from being known rather than guessed.

**Two environment facts that will otherwise cost you time:**

- npm and node are Homebrew and are not on the non-interactive shell PATH. Prefix commands with `export PATH="/opt/homebrew/bin:$PATH"`.
- The in-app browser throttles `requestAnimationFrame`, which freezes react-three-fiber's `useFrame`. **Nothing about motion or the camera can be verified in-session** — that is exactly why this bug survived, since it can only be caught by watching. Ask me to look at `localhost:5173`. The acceptance tests are headless against the sim layer for this reason.

Read the three documents, then tell me how you'd approach it and what you'd want to know before starting. Don't start changing things until we've agreed on an approach.
