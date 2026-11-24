import { FITTED_TO_YOUR_ACCURACY_LINE, SMALL_NUMBERS_LINE } from '../lines'
import { EXPLORATION_SITTING_LINE, type StepScreen } from '../steps'
import { stepParams } from '../params'

/**
 * Part 3, Step 3's instruction screen, in its own file because it names the
 * two models, which no string a student sees before Steps 1 and 2 are done
 * may do (spec §11, item 4). The step opens behind a one-line notice until
 * then (`store.ts`), so this text is seen only after the unit, or after
 * Open anyway.
 */
export const STEP3_TITLE = 'Step 3 — Two models on your trials'
export const STEP3_NEXT = 'This step is an exploration with no end of its own. When you have run the models at the settings you want, this part is done. To move on to Part 4, press “Go on to Part 4” in the navigation panel, or choose the Predictors tab at the top left.'

export const STEP3_SCREEN: StepScreen = {
  step: 3,
  title: STEP3_TITLE,
  kind: 'exploration',
  willDo: [
    'In this step you will run two models on your own 60 trials from Step 1: the same words and the same objects, in the same order. Each model is a procedure that picks an object on every trial by a rule. The two names below are names of procedures, not descriptions of a person.',
    'First, a prediction. Suppose you clicked the wrong object for a word. On that word’s next trial, will your choice be correct about as often as chance, which is 1 in 2, or more often than chance? Once the step opens, choose your answer and press “Commit my prediction”. Then you see the key measure. We take occurrences 2 to 5 of each word and sort them into two groups: those where your choice for that word on the occurrence just before was right, and those where it was wrong. The key measure is the share of your choices that were correct in each group.',
    '“Guess and check” stores one object per word. On a word’s first occurrence, it picks an object at random. On each later occurrence, it reads its stored pick for that word with a set probability. If it reads the pick and that object is on the screen, it picks that object again. Otherwise it picks one of the objects on the screen at random and stores that pick. “Tallying” stores a count for every word with every object. On every trial, it adds one to the count of the word with each object on the screen. Then it picks among the objects on the screen, with probabilities that favor the highest count by a set amount. Each model has one setting, chosen to match your overall accuracy. The panel says how the setting is chosen.',
    'Press “Run the models” in the section “The three rows”. Each model runs 200 times on your trials. You then see each model’s mean and its 90% range in a row beside your own row. Under the rows, you can move each model’s setting away from the fitted value with its slider, and the model’s row changes as you move it. To return a setting to the fitted value, press “Back to the fitted value”.',
    'If Steps 1 and 2 are not done, the models run on a sample sequence of trials drawn from your seed, and the panel says so. Your own row stays empty until Steps 1 and 2 are done.',
  ],
  minutes: stepParams('words', 3).minutes,
  sitting: 'leave any time',
  sittingLine: EXPLORATION_SITTING_LINE,
  keys: ['Press “Commit my prediction” to commit your one prediction, which cannot be changed afterward.', 'Press “Run the models” to run both models 200 times each on your trials.', 'You move each model’s setting with its slider. Press “Back to the fitted value” to return that setting to its fitted value.'],
  content: [FITTED_TO_YOUR_ACCURACY_LINE, SMALL_NUMBERS_LINE],
  next: STEP3_NEXT,
}
