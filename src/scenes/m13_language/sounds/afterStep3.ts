/**
 * Run 3's prediction in the spec's words (spec §5.4), asked only once Step 3
 * is done, so that Step 4 done first cannot change Step 3 (§11, item 2):
 * this file is read only then, and it is the one Step 4 file that may name
 * a sharp or gradual change.
 */
export const RUN3_AFTER_STEP3 = { key: 'p1-s4-run3', question: 'The network from run 1 is run on the 9 synthetic sounds of Step 3. Will its most likely label change from “b” to “d” sharply, gradually, or not in that order?', choices: ['sharply', 'gradually', 'not in that order'] } as const
