import { HEADPHONES_LINE, MADE_OFFLINE_LINE, NO_FEEDBACK_LINE } from '../lines'
import { READY_SOUND_LINE, type StepScreen } from '../steps'
import { STEP3_SCREEN, STEP3_TITLE, STEP3_NEXT } from './step3Screen'

/**
 * Part 3's instruction screens (spec §7, §4.4). Steps 1 and 2 are one unit.
 * Neither screen says how many times a word occurs, how many words there
 * are, or how to work them out, and neither names what the part tests
 * (spec §7.2, §11, item 4). Step 3 names the two models, so it opens behind
 * a one-line notice while Steps 1 and 2 are not done.
 */

export type Step = 1 | 2 | 3

export const STEP_TITLES: Record<Step, string> = {
  1: 'Step 1 — Words and objects',
  2: 'Step 2 — The test',
  3: STEP3_TITLE,
}

export const NEXT_LINE: Record<Step, string> = {
  1: 'When the 60 trials are done, Step 2 begins on its own. When the test is done, the results of Steps 1 and 2 appear on the right.',
  2: 'When the test is done, the results of Steps 1 and 2 appear on the right. To move on, press “Go on to Step 3” on the left.',
  3: STEP3_NEXT,
}

/** The one-line notice on Step 3 before Steps 1 and 2 are done. */
export const NOTICE_LINE = 'This step explains what the trials of Steps 1 and 2 measure. If you open it before you have done them, you will no longer be a first-time learner there.'

export const UNIT_SITTING_LINE = 'Once you press “Begin”, finish the 60 trials and the test in one sitting if you can. If you leave partway, the unit starts again from its first trial with a new set of words and objects, none of them heard or seen before, and the restart is noted on the results screen.'

export const SCREENS: Record<Step, StepScreen> = {
  1: {
    step: 1,
    title: STEP_TITLES[1],
    kind: 'experiment',
    willDo: [
      'In this step you will hear new words and see new objects. Each word names one of the objects. No one will say which. Your task is to click the object each word names. If you are not sure, click anyway.',
      'On each trial, five objects appear on the screen and a word plays once. Press “Hear it again” to play it again. Click one object. Your choice shows for a moment, and the next trial begins. There are 60 trials, and each one takes a few seconds.',
      'This step and Step 2 are one unit. When the 60 trials are done, Step 2, a short test, begins at once on the same words and objects. Nothing is revealed between them.',
      'Every click and its time are recorded. The results of Steps 1 and 2 together appear on the right when the test is done.',
    ],
    minutes: 6,
    sitting: 'one sitting',
    sittingLine: UNIT_SITTING_LINE,
    ready: READY_SOUND_LINE,
    keys: ['“Hear it again” plays the trial’s word again.', 'Click an object to choose it. A choice cannot be changed.'],
    content: [HEADPHONES_LINE, MADE_OFFLINE_LINE, NO_FEEDBACK_LINE],
    next: NEXT_LINE[1],
  },
  2: {
    step: 2,
    title: STEP_TITLES[2],
    kind: 'experiment',
    willDo: [
      'In this step you take a short test on the words and objects of Step 1. On each trial, four objects appear and a word plays. Click the object the word names. If you are not sure, click anyway. There is one trial for each word.',
      'The test comes right after the learning trials of Step 1, as one unit. If you open this step before Step 1 is done, pressing “Begin” starts the learning trials of Step 1 first, and the test comes after them.',
      'No one will say whether a choice was right. When the test is done, the results of Steps 1 and 2 appear on the right.',
    ],
    minutes: 1,
    sitting: 'one sitting',
    sittingLine: UNIT_SITTING_LINE,
    ready: READY_SOUND_LINE,
    keys: ['“Hear it again” plays the trial’s word again.', 'Click an object to choose it. A choice cannot be changed.'],
    content: [HEADPHONES_LINE, NO_FEEDBACK_LINE],
    next: NEXT_LINE[2],
  },
  3: STEP3_SCREEN,
}
