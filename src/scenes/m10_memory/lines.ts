/**
 * The lines on screen that are content, not decoration (Module 10 spec
 * §11). Each is short, each has a string test in `naming.test.ts`, and
 * each sits on the panel the spec names. None of them, before Part 1's
 * reveal, names what Part 1 tests (§12, item 2).
 */

/** 1. Part 4 and Part 5. */
export const RATS_LINE = 'Rats stand in for the early mammal of the reading.'

/** 2. Part 4, beside the view: the two rules, as `refill.ts` states them. */
export { KIND_RULE, REFILL_RULE } from '../../sim/memory/logs/refill'

/** 3 and 13. Part 0: saved here only, or storage unavailable; in `progress/StorageLine.tsx`. */
export { SAVED_HERE_LINE, STORAGE_UNAVAILABLE_LINE } from './progress/StorageLine'

/** 4. Parts 1 to 3, beside every reference panel. */
export const REFERENCE_LINE = 'These are published results from groups of people, with a different procedure. One person’s lists vary a lot.'

/** 5. Part 0, on Clear. */
export const SECOND_RUN_LINE = 'A second run is not a first run: someone who knows what an experiment tests is no longer a naive subject.'

/** 6. Part 5. */
export const PROGRAMS_LINE = 'These foragers are programs given your nights. Ending with the same score does not show the same procedure.'

/** 7. Part 5, beside the slow learner. */
export const PASS_BACK_LINE = 'The slow learner passes the error back, which no one has found in a brain. The reading’s model learned the same way.'

/** 8. Part 5, Step 4. */
export const DAMAGE_LINE = 'Damaging a model is not a model of a disease. It shows which knowledge goes first in a network of this kind.'

/** 9. Part 5, Step 2. */
export const SEPARATION_LINE = 'On one proposal, the dentate gyrus makes similar patterns less alike. This program is not a model of the dentate gyrus.'

/** 10. Every Part 5 panel, when the sample nights are in use. */
export const SAMPLE_NIGHTS_LINE = 'These nights were played by someone else.'

/** 11. Part 4’s instruction screen, carried from Lab 9. */
export const COMFORT_LINE = 'Anyone who feels unwell can switch to the follow view or tick the Narrower view box.'

/** 12. Any results screen whose unit was restarted. */
export const RESTARTED_LINE = 'This part was interrupted and run again with new materials.'

/** 14. Part 1’s reveal: the reading prints a list of this kind. */
export const READING_PRINTS_LINE = 'The reading prints a list of this kind, so some students will have recognized these lists. That is itself a result worth reporting.'

/** The commit-then-reveal rule, on Part 0. */
export const COMMIT_RULE_LINE = 'Nothing a memory test would tell you is shown until you commit your answers: not what was on a list, not what was in the room, not how a night went.'

/** 15. Part 4’s instruction screen: no notes. */
export const NO_NOTES_LINE = 'Do not write anything down or draw a map during the nights. This part asks what you can do from memory alone.'

/** 16. Part 4’s reveal: the counterbalancing. */
export const COUNTERBALANCE_LINE = 'The two kinds of night came at the same average point in the week, so getting better with practice helped both equally.'

/** 17. The end-of-week question. */
export const AS_A_PERSON_LINE = 'Now answer as a person, not as the animal. An animal can show what it remembers only by what it does.'

/** Part 5: how the foragers with a store decide, beside the store. */
export const STRENGTH_LINE = 'A forager treats a log as emptied last night as often as the store’s answer says: a log the store puts at 0.5 is treated as emptied half the time.'
