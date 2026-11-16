/**
 * Run 3's prediction in the spec's words (spec §5.4), asked only once Step 3
 * is done, so that Step 4 done first cannot change Step 3 (§11, item 2):
 * this file is read only then, and it is the one Step 4 file that may name
 * a sharp or gradual change.
 */
export const RUN3_AFTER_STEP3 = { key: 'p1-s4-run3', question: 'Run on the 14 synthetic sounds of Step 3, will the network’s most likely label change from b to d to g sharply, gradually, or not in that order?', choices: ['sharply', 'gradually', 'not in that order'] } as const
