/**
 * The lines on screen that are content, not decoration (Module 11 spec
 * §12). Each is short, each has a string test in `naming.test.ts`, and
 * each sits on the panel the spec names. None of them, before Part 3's or
 * Part 5's reveal, names what those parts test (§13, items 2 and 3).
 */

/** 1 and 25. Part 0: saved here only, or storage unavailable; in Lab 10's `progress/StorageLine.tsx`. */
export { SAVED_HERE_LINE, STORAGE_UNAVAILABLE_LINE } from '../m10_memory/progress/StorageLine'

/** 2. Part 0, on Clear. */
export const SECOND_RUN_LINE = 'A second run is not a first run: someone who knows what an experiment tests is no longer a naive subject.'

/** 3. Part 1's reveal. */
export const BEST_TOTAL_LINE = 'The best possible total is computed with the match’s length, which you were not told; against a partner that answers a defection, it ends by defecting on the last round.'

/** 4. Part 1's reveal. */
export const PREDICTING_PLAYING_LINE = 'Predicting a partner well and playing well against it are different things. The same difference is described for language models in the reading (§11.2.8).'

/** 5. Part 2. */
export const NO_BRAIN_LINE = 'These rules are short tables of moves. An organism does not need a brain to employ a strategy (§11.2.1).'

/** 6. Part 2, Step 1. */
export const NEVER_AHEAD_LINE = 'Tit-for-tat never scores more than its partner in a single match. It can do better only in total, across many partners.'

/** 7. Part 2, Step 1. */
export const ENOUGH_COOPERATORS_LINE = 'Repeated play favors tit-for-tat only when enough of the others also cooperate, and the more rounds, the fewer are needed (§11.1.8, §11.2.1).'

/** 8. Part 2, Step 3. */
export const THE_FIELD_LINE = 'Which rule wins depends on which other rules are entered.'

/** 9. Part 2, Step 4. */
export const PREDICTING_LINE = 'Predictor estimates each partner’s next move from the partner’s past moves. Tit-for-tat estimates nothing.'

/** 10. Part 2, Step 4. */
export const FINDING_OUT_LINE = 'Finding out costs points: a probe is a defection, and some partners answer it for the rest of the match.'

/** 11. Part 2, Step 6 (the memory cost, Jon 2026-11-02). */
export const STAND_IN_COST_LINE = 'This cost stands in for what memory costs an animal, as a larger brain costs energy. It is not a measured cost of any brain.'

/** 12. Part 2, Step 5. */
export const MISTAKES_LINE = 'With mistakes, a move is sometimes the opposite of what the rule specifies.'

/** 13. Part 2, Step 7. */
export const THE_GRID_LINE = 'Each cell copies the rule of its highest-scoring neighbor. No cell chooses anything.'

/** 14. Part 3, Step 1's reveal. */
export const ONE_VIEWER_LINE = 'The 1944 viewers saw a different film, and your ratings are one person’s.'

/** 15. Part 3, Step 2's reveal. */
export const GOALS_NOT_BELIEFS_LINE = 'Inverse planning infers where something is heading, not what it believes. Its authors read it either as a theory of agents or as the observer running its own planning in reverse (§11.2.2, §11.2.7).'

/** 16. Part 4. */
export const PROGRAMMED_ANIMALS_LINE = 'These are programs with rules. The same choices do not show the same rule.'

/** 17. Part 4, Step 3. */
export const THE_LEARNER_LINE = 'The learner was trained on contests, not on lines of sight.'

/** 18, 19, 20, 21. The simulated class's lines, in `src/sim/social/classes.ts`. */
export { ONE_PERSON_LINE, SIMULATED_CLASS_LINE, REAL_CLASS_LINE, PENDING_CLASS_LINE } from '../../sim/social/classes'

/** 22 and 23 were Part 6's lines; Part 6 was removed on 2026-11-04 and its lines live in `mirror/lines.ts`, unreachable. */

/** 24. Any results screen whose unit was restarted. */
export const RESTARTED_LINE = 'This part was interrupted and run again.'

/** The commit-then-reveal rule, on Part 0. */
export const COMMIT_RULE_LINE = 'Nothing a test would tell you is shown until you commit your answers: not a partner’s rule, not a result, not what a film or a judgment was for.'

/** Part 5 (PART5_REDESIGN_2026-11-04.md §8). 1. One student, on the reveal. */
export const ONE_STUDENT_LINE = 'One run is about 24 test items a round, so one student’s scores are noisy; the class shows what one run cannot.'

/** Part 5, §8 item 2. The order of the rounds, on the reveal. */
export const ORDER_LINE = 'Round 2 came second, so practice, and knowing that a surprise had come once, should both have made memory for individuals better in Round 2. A drop in Round 2 therefore did not come from either. Better sorting in Round 2 is partly the goal, and partly practice and the names, and one student’s run cannot separate them.'

/** Part 5, §8 item 3. Round 1's sorting score. */
export const BEST_ASSIGNMENT_LINE = 'Your kinds are scored under whichever matching of Kind 1 and Kind 2 to the two groups fits your answers better.'

/** Part 5, §8 item 4. The connection. */
export const APPLYING_LINE = 'Applying a category already learned is different from learning one.'

/** Part 1: the length, given only as about 16 (Jon, 2026-11-02). */
export const LENGTH_LINE = 'A match lasts about 16 rounds, but the exact number varies from match to match.'
