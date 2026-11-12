import { HYPOTHETICAL_MONEY_LINE, NO_RIGHT_ANSWER_LINE, LABS_POINTS_LINE } from '../lines'
import { BLOCK_SECONDS, DELIVERY_POINTS, TAKE_POINTS, TAKE_PAUSE, DELIVERY_PAUSE } from '../../../sim/planning/choices/dispensers'

/**
 * Part 1's instruction screens (spec §4.4, decision 8): every term defined
 * where it is used, every number said in full, every control named by the
 * words printed on it, what is recorded, how long, whether one sitting, and
 * what happens if the student does something else. None says what a step
 * tests (spec §11, item 2). The wording of Steps 1 to 3 is Jon's, from the
 * walk of 2026-11-09. Step 4 (the bird) was removed the same day at his
 * word: its rule was transparent once stated, so it tested nothing.
 */

export type Step = 1 | 2 | 3

export interface StepScreen {
  step: Step
  title: string
  willDo: string[]
  minutes: number
  sitting: 'one sitting' | 'leave any time'
  sittingLine: string
  keys: string[]
  content: string[]
  /** Whether the step is an experiment (done once) or an exploration. */
  kind: 'experiment' | 'exploration'
  /** What to press when the step is done, named without ambiguity (Jon, 2026-11-09). */
  next: string
}

export const STEP_TITLES: Record<Step, string> = { 1: 'Step 1 — Gambles', 2: 'Step 2 — Delays', 3: 'Step 3 — Two dispensers' }

/** The line on a finished step's screen and at the end of its instructions, naming the button that comes next. */
export const NEXT_LINE: Record<Step, string> = {
  1: 'When this step is done, its results appear on the right. To move on, press “Go on to Step 2” on the left.',
  2: 'When this step is done, its results appear on the right. To move on, press “Go on to Step 3” on the left.',
  3: 'When both blocks are done, the results of this step appear on the right. To move on to Part 2, choose the Puzzles tab at the top left.',
}

export const SCREENS: Record<Step, StepScreen> = {
  1: {
    step: 1,
    title: STEP_TITLES[1],
    kind: 'experiment',
    willDo: [
      'In this step you will make about 30 choices, one at a time. Most of them are choices between two options involving hypothetical money. Choose each time what you would choose if the money were real.',
      'Each choice shows two cards side by side, labeled “Option A” and “Option B”. A card says, in words, what you would get and with what chance: for example, “a sure gain of $3,000”, or “an 80% chance of gaining $4,000, and otherwise nothing”. A bar under the words shows the chances as lengths. To choose, click a card, or press the key 1 for Option A or the key 2 for Option B. Once you have chosen, the next choice appears. A choice cannot be changed.',
      'Step 1 opens with a wheel of fortune. Press “Spin the wheel”, and wait for it to stop. Then, answer two short questions about a quantity. First, is the quantity higher or lower than the number the wheel stopped at? Second, what is your own estimate of the quantity, typed as a number.',
      'One of the choices is not about money. It describes a danger to a number of people, and two programs to deal with it. The question is which program you would favor. Read it and choose.',
      'Everything you choose is recorded. Which option you chose on each card, your two answers after the wheel, and the time you took. When the last choice is made, the results of this step appear, with every choice shown back to you.',
      'There is no time limit on any choice.',
    ],
    minutes: 9,
    sitting: 'one sitting',
    sittingLine: 'Once you press “Begin”, finish the step in one sitting if you can. If you leave partway, your choices so far are kept, and when you return the step goes on from the next choice you had not made. A series of related choices that was interrupted starts that series again. If the question about the danger, or the wheel, had been shown but not answered when you left, a different question of the same kind takes its place.',
    keys: ['The key 1 chooses Option A, and the key 2 chooses Option B. Clicking a card does the same.', '“Spin the wheel” spins the wheel of fortune at the start of the step.', 'After the wheel, two buttons answer “higher” or “lower”, and a box takes your estimate as a number from 0 to 100, followed by “Enter” or the button “Submit my estimate”.'],
    content: [HYPOTHETICAL_MONEY_LINE, NO_RIGHT_ANSWER_LINE],
    next: NEXT_LINE[1],
  },
  2: {
    step: 2,
    title: STEP_TITLES[2],
    kind: 'experiment',
    willDo: [
      'In this step you will make 32 choices, one at a time, between an amount of hypothetical money today and an amount of hypothetical money later. Choose each time what you would choose if the money were real.',
      'Each choice shows two cards, “Option A” and “Option B”. One card is an amount today, such as “$50 today”. The other is an amount after a delay, such as “$100 after 6 months”. To choose, click a card, or press the key 1 for Option A or the key 2 for Option B. Once you have chosen, the next choice appears. A choice cannot be changed, and there is no time limit.',
      'The amounts and the delays change from choice to choice. Some choices will feel easy and some will feel close. Answer each one on its own.',
      'Every choice is recorded. When the last choice is made, the results of this step appear, with your choices shown back to you.',
    ],
    minutes: 6,
    sitting: 'one sitting',
    sittingLine: 'Once you press “Begin”, finish the step in one sitting if you can. If you leave partway, your choices so far are kept, and when you return the step goes on from the next choice you had not made. A series of related choices that was interrupted starts that series again.',
    keys: ['The key 1 chooses Option A, and the key 2 chooses Option B. Clicking a card does the same.'],
    content: [HYPOTHETICAL_MONEY_LINE, NO_RIGHT_ANSWER_LINE],
    next: NEXT_LINE[2],
  },
  3: {
    step: 3,
    title: STEP_TITLES[3],
    kind: 'experiment',
    willDo: [
      `In this step you will be playing a game where you are trying to get the most points possible. You will spend ${BLOCK_SECONDS / 60} minutes at each of two “point dispensers”, a blue one and an orange one.`,
      `At each dispenser you will be given a block of trials. At the start of each trial, the dispenser will be empty. At any moment during a trial, you may press “Take ${TAKE_POINTS} now”, or the “1” key on your keyboard. This will add ${TAKE_POINTS} point to your total, and end the trial. The next trial starts after a pause of ${TAKE_PAUSE} seconds. You can instead decide not to “Take ${TAKE_POINTS} now”, and to wait. If you wait, the dispenser may deliver ${DELIVERY_POINTS} points. This will also end the trial and start the next one, after a pause of ${DELIVERY_PAUSE} second. This screen does not say when, or how often, either dispenser delivers. That is for you to find out as you go.`,
      'A large timer shows how many seconds are left in the block, and a large counter shows your points. A line above them says what is happening now: a trial is running, points were delivered, you took a point, or the pause between trials is on.',
      `The block runs in real time, and it cannot be paused. If you switch to another window or tab, or the page loses focus, the block stops and does not count. When you return, the block starts again from its beginning, and your record notes that it was restarted. Waiting that happened while you were elsewhere is not waiting at the dispenser.`,
      'Everything is recorded: on every trial, how long you waited before taking a point, or that a delivery came; your points; and the time. When both blocks are done, the results of this step appear.',
    ],
    minutes: 7,
    sitting: 'one sitting',
    sittingLine: `Once you press “Begin”, each block of ${BLOCK_SECONDS / 60} minutes is done in one sitting, in real time. A block you leave partway starts again from its beginning when you return, and the restart is noted on the results screen. A block you have finished is saved and not played again.`,
    keys: [`“Take ${TAKE_POINTS} now”, or the key 1, takes ${TAKE_POINTS} point and ends the trial.`, 'There is nothing else to press during a block.'],
    content: [LABS_POINTS_LINE],
    next: NEXT_LINE[3],
  },
}

export const READY_LINE = 'Nothing is needed. You will answer in the app. The report is filled in from the results screens afterward.'
