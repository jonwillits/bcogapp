import { THE_LEARNER_LINE } from '../lines'

/**
 * The three steps of Part 4 (spec §8.6): T1 for all five with a
 * prediction first; the student's own tests from the menu, then the
 * diagnosis; then the reveal, the build's matrix, T8 with a prediction,
 * and the learner's experience with a prediction. Explorations: a step can
 * be left and returned to, reopened or redone; the diagnosis, once
 * committed, stays committed.
 */

export type Step = 1 | 2 | 3

export interface Prediction {
  key: string
  question: string
  choices: string[]
}

export interface StepSpec {
  step: Step
  title: string
  reread: string
  willDo: string[]
  minutes: number
  content: string[]
  predictions: Prediction[]
}

export const STEPS: StepSpec[] = [
  {
    step: 1,
    title: 'Step 1 — The standard test',
    reread: 'Reread §11.1.9 and §11.2.3 of the reading: the food-competition test, and the chain of tests behind it.',
    willDo: [
      'The arena is the layout of the reading’s figure: the subordinate’s room on the left, the central room, and the dominant’s room on the right, each side room with a door onto the central room. Two pieces of food lie in the central room. A door can be open, shut, or raised for viewing, a gap the dominant can look through but not pass. A barrier is a short wall beside a piece, opaque or clear. “Draw the dominant’s line of sight” shades the floor the dominant can see from its door.',
      'Five hidden subordinates, A to E, each a program with a rule of its own. The dominant is one program in every trial: it goes to where it last watched a piece placed or moved, or, if it watched neither, to the nearer piece it can see at release; and before release, while its door is up, it faces the place it will go to. If both animals reach the same piece, the dominant takes it.',
      'A run is 10 trials of one test for one animal, and the table on the right records, per animal and per test, the share of trials on which the animal went to the piece the test scores: the piece outside the dominant’s line of sight, or the piece by the barrier, or the piece the dominant did not see placed or moved, as the test names it. Each animal follows its rule on about 85% of trials, and where its rule gives no preference it goes at random, so one run is informative but not exact.',
      'This step runs T1, the standard test, for all five: baited with the dominant’s door down, then the dominant watching through its door; one piece in the open and one behind an opaque barrier on the subordinate’s side.',
      'First, predict: will any of the five animals differ on T1? Then press “Run T1 for all five”.',
    ],
    minutes: 3,
    content: [],
    predictions: [{ key: 'p4-s1', question: 'Will any of the five animals differ from the others on T1?', choices: ['yes', 'no'] }],
  },
  {
    step: 2,
    title: 'Step 2 — The chain of tests',
    reread: 'Reread §11.2.3 of the reading, and Morgan’s Canon in Module 2: a behavior should not be explained by a higher mental process if a simpler one accounts for it.',
    willDo: [
      'Choose a test from the menu, T1 to T7, and an animal, and press “Run 10 trials”. Each run is added to the table. The aim is to rule out leaner explanations: each test in the chain takes away one thing the animal might be using, and an animal whose choice changes under a test was using it. A counter shows the number of runs you have used; it does not limit them.',
      'The tests: T1 Standard; T2 Clear barrier (as T1, with a barrier the dominant can see through); T3 Door shut (the dominant’s door shut throughout until release); T4 Did not watch (both pieces behind opaque barriers, one placed with the dominant watching and the other with its door shut); T5 Missed a move (both placed with the dominant watching, one then moved with its door shut); T6 Swap (the first piece placed with one dominant watching, that dominant replaced by another, the second piece placed with the new dominant watching); T7 Released first (as T1, with the subordinate released first).',
      'When you can say what each animal is going by, match each of A to E to one of the five rule descriptions on the left and press “Commit my diagnosis”. The animals’ rules are shown only after that.',
    ],
    minutes: 8,
    content: [],
    predictions: [{ key: 'p4-s2', question: 'How many of the five will you be able to tell apart with T1 to T7?', choices: ['all five', 'four', 'three or fewer'] }],
  },
  {
    step: 3,
    title: 'Step 3 — A new layout',
    reread: 'Reread §11.2.7 of the reading: five accounts, and the one further possibility, a learner trained on enough examples.',
    willDo: [
      'Every animal’s rule is now shown beside your diagnosis, and the full matrix from the build’s own runs, twenty seeds of 10 trials, beside your table. The reading’s question is whether what the chimpanzees track is seeing, a step toward a theory of mind, or categories of behavior, which is the behavior-reading account; the last animal is a learner of the second kind.',
      'Then T8, held back until now: the dominant enters by a door on the top wall it has never used, with barriers at new positions. Predict first whether every animal takes the piece outside the dominant’s line of sight, then press “Run T8 for all five”.',
      'Then the learner’s experience, a setting on the left: the usual room (a history of 300 contests across T1 to T7’s layouts, the dominant always entering by its usual door) or many rooms (the same number of contests across many layouts and doors, but never T8’s exact layout). Predict first what the learner does on T8 after many rooms, then set it and press “Run T8 for all five” again.',
    ],
    minutes: 4,
    content: [THE_LEARNER_LINE],
    predictions: [
      { key: 'p4-s3-t8', question: 'On T8, will every animal take the piece outside the dominant’s line of sight?', choices: ['yes, all five', 'all but one', 'fewer than four'] },
      { key: 'p4-s3-many', question: 'After many rooms, what will the learner do on T8?', choices: ['take the hidden piece', 'no preference', 'take the open piece'] },
    ],
  },
]

export const stepSpec = (s: Step): StepSpec => STEPS[s - 1]
