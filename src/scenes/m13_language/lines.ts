/**
 * The lines on screen that are content, not decoration (spec §10). Each is a
 * full sentence or two, each has a string test in `naming.test.ts`, and each
 * sits on the panel the spec names. None of them, before a part's reveal,
 * names what that part tests (§11, items 2 to 4).
 */

/** Part 0: saved here only, or storage unavailable; in Lab 10's `progress/StorageLine.tsx`. */
export { SAVED_HERE_LINE, STORAGE_UNAVAILABLE_LINE } from '../m10_memory/progress/StorageLine'

/** Part 0, on Clear. */
export const SECOND_RUN_LINE = 'A second run is not a first run: someone who knows what an experiment tests is no longer a naive subject.'

/** Part 0. */
export const ANY_ORDER_LINE = 'Every part, and every step within a part, can be done at any time and in any order. Nothing done once has to be done again to reach anything else.'

/** The commit-then-reveal rule, on Part 0. */
export const COMMIT_RULE_LINE = 'Nothing an experiment would tell you is shown until you commit your answers: not an expected value, not a published result, not what a question was for.'

/** Any results screen whose unit was restarted. */
export const RESTARTED_LINE = 'This part was interrupted and run again.'

/** 1. The Open tab, and every instruction screen in Parts 1 to 3. */
export const HEADPHONES_LINE = 'This step plays sound. Use headphones or earbuds if you have them, and set a comfortable volume once. Small differences between sounds may be harder to hear through speakers. You can still do every step without headphones.'

/** 2. Parts 1 to 3, wherever a sound is first played. */
export const MADE_OFFLINE_LINE = 'Every sound in this lab was made by a computer before the lab was posted. Nothing is recorded from you, and this lab never turns on a camera or microphone.'

/** 3. Part 1, Step 1. */
export const SETTINGS_NOT_MEASUREMENTS_LINE = 'Every frequency marked on this screen is a setting of the synthesizer that made the sound, not a measurement of the sound.'

/** 4. Part 1, Step 2, the reveal. */
export const MEASURED_LINE = 'The formant tracks drawn here were measured from the sounds by a computer program, and such measurements can be off by a little.'

/** 5. Part 1, Step 4, run 3. */
export const SYNTHETIC_TEST_LINE = 'The network learned from natural voices. In this run it is tested on synthetic sounds unlike any it learned from.'

/** 6. Part 1, Step 3, the reveal. */
export const ONE_LISTENER_LINE = 'The reference curves are one listener’s, from the reading’s figure, measured in 1957.'

/** 7. Part 2, every step. */
export const MADE_UP_LANGUAGE_LINE = 'The language in this part is made up. Its words have no meanings.'

/** 8. Part 2, Step 1, after the commit. */
export const LENGTHENED_DIFFERENTLY_LINE = 'The original experiment lengthened the last syllable of three of the six words. This replay lengthens all six, so the difference is easy to hear.'

/** 9. Part 2, Step 2. */
export const COUNTS_FROM_YOUR_STREAM_LINE = 'Every count on this panel is from the 300 syllables printed on the board.'

/** 10. Part 2, Step 3. */
export const ADULTS_21_MINUTES_LINE = 'The adults’ results came after 21 minutes of listening.'

/** 11. Part 2, Step 3. */
export const INFANTS_MEASURED_DIFFERENTLY_LINE = 'The infants’ result is from how long they listened to each test item, not from a choice between two items.'

/** 12. Part 2, Step 4. */
export const REAL_SPEECH_LINE = 'These utterances were spoken to young children and transcribed by researchers. The syllables come from a pronouncing dictionary, not from the recordings, and this step plays no sound.'

/** 13. Part 3, Steps 1 and 2. */
export const NO_FEEDBACK_LINE = 'No one will say whether a choice was right. There is no feedback of any kind until the test is done.'

/** 14. Part 3, Step 3. */
export const FITTED_TO_YOUR_ACCURACY_LINE = 'Each model’s one setting was chosen to match your overall accuracy. The two models are then compared on something they were not fitted to.'

/** 15. Part 3, Step 3; the sentence about how often 48 pairs tell the models apart is filled in from the build's measurement. */
export const SMALL_NUMBERS_LINE = 'Your key measure rests on 48 pairs of choices: for each of 12 words, the choices on occurrences 2 to 5, each compared with the choice just before it.'

/** 16. Part 4, every step. */
export const ONE_CORPUS_LINE = 'Every model in this part learned from the same made-up corpus of sentences, built from a vocabulary of about 50 tokens, and from nothing else.'

/** 17. Part 4, Steps 4 and 5. */
export const TRAINED_BEFORE_LINE = 'These models were trained before the lab was posted. They do not change while you use them.'

/** 18. Part 4, Step 4, attention. */
export const REAL_WEIGHTS_LINE = 'These attention weights come from the trained model. The reading’s figure of attention was an illustration with invented weights.'

/** 19. Part 4, Step 4, generation. */
export const NOT_ENGLISH_LINE = 'Here “allowed” means allowed by this corpus’s grammar, not by English.'
