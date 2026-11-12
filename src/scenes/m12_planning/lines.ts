/**
 * The lines on screen that are content, not decoration (spec §10). Each is a
 * full sentence or two, each has a string test in `naming.test.ts`, and each
 * sits on the panel the spec names. None of them, before Part 1's or Part
 * 2's reveals, names what those parts test (§11, items 2 and 3).
 */

/** 1 and 24. Part 0: saved here only, or storage unavailable; in Lab 10's `progress/StorageLine.tsx`. */
export { SAVED_HERE_LINE, STORAGE_UNAVAILABLE_LINE } from '../m10_memory/progress/StorageLine'

/** 2. Part 0, on Clear. */
export const SECOND_RUN_LINE = 'A second run is not a first run: someone who knows what an experiment tests is no longer a naive subject.'

/** 3. Part 0. */
export const ANY_ORDER_LINE = 'Every part, and every step within a part, can be done at any time and in any order. Nothing done once has to be done again to reach anything else.'

/** 4. Part 1, every screen that names an amount. */
export const HYPOTHETICAL_MONEY_LINE = 'No money is paid in this lab. The amounts are hypothetical, as they were in the studies of gambles and of the disease problem that the reading describes (§12.2.5).'

/** 5. Part 1, Steps 1 and 2. */
export const NO_RIGHT_ANSWER_LINE = 'There is no right answer yet: choose what you would choose. The results of this step are shown after the last choice.'

/** 6. Part 1, Step 1, the simulated class. */
export const ITEMS_DRAWN_SEPARATELY_LINE = 'The sources report each item’s share of choices on its own, not how the same people chose across items, so the simulated students’ choices on different items are drawn independently.'

/** 7. Part 1, Step 1, the framing reveal. */
export const ONE_VERSION_EACH_LINE = 'Each student saw one version of the problem, because someone who sees both versions knows what is being asked.'

/** 8. Part 1, Step 3. */
export const LABS_POINTS_LINE = 'The children in the reading waited for real treats. These are points in a lab, and nothing is paid for them.'

/** 9. Part 1, Step 4, the bird. Removed with the step at Jon's word, 2026-11-09; the number is kept so the spec's list still counts. */

/** 10. Part 2, Step 1. */
export const LONG_PAUSE_LINE = 'A ring marks a long pause: a time before a move of more than twice your median time between moves.'

/** 11. Part 2, Step 3. */
export const NOT_OPTIMAL_LINE = 'These lookers are simple rules. None of them is the best possible way to look.'

/** 12. Part 2, Step 3. */
export const DIFFERENT_TASK_LINE = 'Huys and colleagues’ participants learned the tree over many trials and were not charged for looking, so their task was a different one from this.'

/** 13. Part 3. */
export const PROGRAMMED_HOMININS_LINE = 'These are programs with procedures. The same behavior on a day does not show the same procedure.'

/** 14. Part 3. */
export const FRESH_START_LINE = 'Every run starts each hominin in the state it reached at the end of its days before the lab, and a hominin that learns goes on learning within a run.'

/** 15. Part 3. */
export const THE_ELDER_LINE = 'The elder’s errands are set by the scene to fit each day’s need. She is not one of the five hidden hominins.'

/** 16. Part 3. */
export const BUILT_FOR_THE_EXPERIMENT_LINE = 'The needs and the range are built for this experiment. The evidence that Homo erectus met each need differs: strong for carcasses and marrow, from living foragers for digging sticks, and weaker and indirect for termite probes.'

/** 17. Part 3. */
export const DRAWN_SIMPLY_LINE = 'The hominins are drawn simply on purpose. How Homo erectus looked is reconstructed from fossils with uncertainty, and these figures are not a reconstruction.'

/** 18. Part 3, T4 and T5. */
export const EVERY_STEP_SEEN_LINE = 'No hidden hominin has ever been rewarded for carrying a probe or a digging stick, but each has recorded every step of making and using them.'

/** 19. Part 4. */
export const MODEL_OF_PLANTS_LINE = 'These are plants in a model. Nothing in this part measures real people or groups of people.'

/** 20. Part 4. */
export const MODELS_OWN_GENES_LINE = 'Heritability here is computed from the genetic values the model assigned to the plants, which the model stores. A breeder, or anyone running a twin study, cannot read those values and has to estimate heritability from resemblance among relatives.'

/** 21. Part 4, Step 4. */
export const MODELS_MECHANISM_LINE = 'In this model, the poor soil limits how tall any plant can grow. Why heritability differed between poor and affluent families in the study the reading describes was not measured this way.'

/** 22. Every class panel (as in Lab 11), in `src/sim/planning/classes.ts`. */
export { SIMULATED_CLASS_LINE, REAL_CLASS_LINE, PENDING_CLASS_LINE, PENDING_REFERENCE_LINE } from '../../sim/planning/classes'

/** 23. Any results screen whose unit was restarted. */
export const RESTARTED_LINE = 'This part was interrupted and run again.'

/** The commit-then-reveal rule, on Part 0. */
export const COMMIT_RULE_LINE = 'Nothing an experiment would tell you is shown until you commit your answers: not an expected value, not a published result, not what a question was for.'
