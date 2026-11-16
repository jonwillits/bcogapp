import { FITTED_TO_YOUR_ACCURACY_LINE, SMALL_NUMBERS_LINE } from '../lines'
import { EXPLORATION_SITTING_LINE, type StepScreen } from '../steps'

/**
 * Part 3, Step 3's instruction screen, in its own file because it names the
 * two models, which no string a student sees before Steps 1 and 2 are done
 * may do (spec §11, item 4). The step opens behind a one-line notice until
 * then (`store.ts`), so this text is seen only after the unit, or after
 * Open anyway.
 */
export const STEP3_TITLE = 'Step 3 — Two models on your trials'
export const STEP3_NEXT = 'This step is an exploration with no end of its own. When you have run the models at the settings you want, this part is done. To move on to Part 4, press “Go on to Part 4” on the left, or choose the Predictors tab at the top left.'

export const STEP3_SCREEN: StepScreen = {
  step: 3,
  title: STEP3_TITLE,
  kind: 'exploration',
  willDo: [
    'In this step you will run two models on your own 60 trials from Step 1: the same words and the same objects, in the same order. Each model is a procedure that picks an object on every trial by a rule. The two names below are names of procedures, not descriptions of a person.',
    'First, a prediction. After a trial on which you clicked the wrong object for a word, will your next choice for that word be correct about as often as chance, which is 1 in 5, or more often than chance? Choose on the left and press “Commit my prediction”. Then the key measure appears: the share of your choices that were correct on a word’s next occurrence, split by whether your choice for that word just before was right or wrong, pooled over occurrences 2 to 5 of each word.',
    '“Guess and check” stores one object per word. On a word’s first occurrence it picks an object at random. On each later occurrence it recalls its last pick for that word with a set probability. If it recalls the pick and that object is present, it picks it again; otherwise it picks an object at random. “Tallying” adds one to a count for the word with every object present, on every trial, and picks among the objects present with probabilities that favor the highest count by a set amount. Each model’s one setting is chosen to match your overall accuracy, and the panel explains how.',
    'Press “Run the models”. Each model runs 200 times on your trials, and the panel shows its mean and its 90% range beside your own row. A slider for each model moves its setting away from the fitted value, and “Back to the fitted value” returns it.',
    'If Steps 1 and 2 are not done, the models run on a sample sequence of trials drawn from your seed, the panel says so, and your own row stays empty until they are done.',
  ],
  minutes: 7,
  sitting: 'leave any time',
  sittingLine: EXPLORATION_SITTING_LINE,
  keys: ['“Commit my prediction” commits the one prediction, asked once.', '“Run the models” runs both models 200 times each on your trials.', 'The two sliders move each model’s setting; “Back to the fitted value” returns it.'],
  content: [FITTED_TO_YOUR_ACCURACY_LINE, SMALL_NUMBERS_LINE],
  next: STEP3_NEXT,
}
