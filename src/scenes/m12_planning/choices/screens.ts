import { HYPOTHETICAL_MONEY_LINE, NO_RIGHT_ANSWER_LINE, LABS_POINTS_LINE, SAME_EXPECTED_VALUE_LINE } from '../lines'
import { BLOCK_SECONDS, DELIVERY_POINTS, TAKE_POINTS, TAKE_PAUSE } from '../../../sim/planning/choices/dispensers'

/**
 * Part 1's instruction screens (spec §4.4, decision 8): every term defined
 * where it is used, every number said in full, every control named by the
 * words printed on it, what is recorded, how long, whether one sitting, and
 * what happens if the student does something else. None says what a step
 * tests (spec §11, item 2).
 */

export type Step = 1 | 2 | 3 | 4

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
}

export const STEP_TITLES: Record<Step, string> = { 1: 'Step 1 — Gambles', 2: 'Step 2 — Delays', 3: 'Step 3 — Two dispensers', 4: 'Step 4 — Enough for the night' }

export const SCREENS: Record<Step, StepScreen> = {
  1: {
    step: 1,
    title: STEP_TITLES[1],
    kind: 'experiment',
    willDo: [
      'In this step you will make about 30 choices, one at a time. Most of them are choices between two options with money in them. The money is hypothetical: nothing is paid, and you lose nothing. Choose each time what you would choose if the money were real.',
      'Each choice shows two cards side by side, labeled “Option A” and “Option B”. A card says, in words, what you would get and with what chance: for example, “a sure gain of $3,000”, or “an 80% chance of gaining $4,000, and otherwise nothing”. A bar under the words shows the chances as lengths. To choose, click a card, or press the key 1 for Option A or the key 2 for Option B. Once you have chosen, the next choice appears. A choice cannot be changed.',
      'The step opens with a wheel of fortune. Press “Spin the wheel”, wait for it to stop, and then answer two short questions about a quantity: first whether the quantity is higher or lower than the number the wheel stopped at, and then your own estimate of it, typed as a number.',
      'One of the choices is not about money. It describes a danger to a number of people and two programs to deal with it, and asks which program you would favor. Read it as written and choose.',
      'Everything you choose is recorded: which option you chose on each card, your two answers after the wheel, and the time you took. Nothing is scored while you choose. When the last choice is made, the results of this step appear, with every choice shown back to you.',
      'There is no time limit on any choice.',
    ],
    minutes: 9,
    sitting: 'one sitting',
    sittingLine: 'Once you press “Begin”, finish the step in one sitting if you can. If you leave partway, your choices so far are kept, and when you return the step goes on from the next choice you had not made. A series of related choices that was interrupted starts that series again. If the question about the danger, or the wheel, had been shown but not answered when you left, a different question of the same kind takes its place.',
    keys: ['The key 1 chooses Option A, and the key 2 chooses Option B. Clicking a card does the same.', '“Spin the wheel” spins the wheel of fortune at the start of the step.', 'After the wheel, two buttons answer “higher” or “lower”, and a box takes your estimate as a number from 0 to 100, followed by “Enter” or the button “Submit my estimate”.'],
    content: [HYPOTHETICAL_MONEY_LINE, NO_RIGHT_ANSWER_LINE],
  },
  2: {
    step: 2,
    title: STEP_TITLES[2],
    kind: 'experiment',
    willDo: [
      'In this step you will make 32 choices, one at a time, between an amount of money today and an amount of money later. The money is hypothetical: nothing is paid. Choose each time what you would choose if the money were real.',
      'Each choice shows two cards, “Option A” and “Option B”. One card is an amount today, such as “$50 today”. The other is an amount after a delay, such as “$100 after 6 months”. To choose, click a card, or press the key 1 for Option A or the key 2 for Option B. Once you have chosen, the next choice appears. A choice cannot be changed, and there is no time limit.',
      'The amounts and the delays change from choice to choice. Some choices will feel easy and some will feel close. Answer each one on its own.',
      'Every choice is recorded. Nothing is scored while you choose. When the last choice is made, the results of this step appear, with your choices shown back to you.',
    ],
    minutes: 6,
    sitting: 'one sitting',
    sittingLine: 'Once you press “Begin”, finish the step in one sitting if you can. If you leave partway, your choices so far are kept, and when you return the step goes on from the next choice you had not made. A series of related choices that was interrupted starts that series again.',
    keys: ['The key 1 chooses Option A, and the key 2 chooses Option B. Clicking a card does the same.'],
    content: [HYPOTHETICAL_MONEY_LINE, NO_RIGHT_ANSWER_LINE],
  },
  3: {
    step: 3,
    title: STEP_TITLES[3],
    kind: 'experiment',
    willDo: [
      `In this step you will spend two blocks of ${BLOCK_SECONDS / 60} minutes each at a dispenser of points, one block at a blue dispenser and one at an orange dispenser, in an order set by your run seed. The points are points in this lab, and nothing is paid for them. Your goal in each block is to collect as many points as you can before the block’s ${BLOCK_SECONDS / 60} minutes are up.`,
      `A block is a series of trials. At the start of each trial the dispenser is empty. At any moment during a trial you may press “Take ${TAKE_POINTS} now”, or the key 1, which adds ${TAKE_POINTS} point to your total, ends the trial, and starts the next trial after a pause of ${TAKE_PAUSE} seconds. If instead you wait, the dispenser may deliver ${DELIVERY_POINTS} points, which also ends the trial and starts the next one after a pause of 1 second. This screen does not say when, or how often, either dispenser delivers. That is for you to find out as you go.`,
      'A large timer shows how many seconds are left in the block, and a large counter shows your points. A line above them says what is happening now: a trial is running, points were delivered, you took a point, or the pause between trials is on.',
      `The block runs in real time, and it cannot be paused. If you switch to another window or tab, or the page loses focus, the block stops and does not count. When you return, the block starts again from its beginning, and your record notes that it was restarted. Waiting that happened while you were elsewhere is not waiting at the dispenser.`,
      'Everything is recorded: on every trial, how long you waited before taking a point, or that a delivery came; your points; and the time. When both blocks are done, the results of this step appear.',
    ],
    minutes: 7,
    sitting: 'one sitting',
    sittingLine: `Once you press “Begin”, each block of ${BLOCK_SECONDS / 60} minutes is done in one sitting, in real time. A block you leave partway starts again from its beginning when you return, and the restart is noted on the results screen. A block you have finished is saved and not played again.`,
    keys: [`“Take ${TAKE_POINTS} now”, or the key 1, takes ${TAKE_POINTS} point and ends the trial.`, 'There is nothing else to press during a block.'],
    content: [LABS_POINTS_LINE],
  },
  4: {
    step: 4,
    title: STEP_TITLES[4],
    kind: 'exploration',
    willDo: [
      'This step is an exploration of the reading’s small bird on a winter evening (§12.1.1). The bird needs 10 units of food to survive the night. It starts each evening with some food already in reserve, between 2 and 9 units, set by your run seed. It may feed at one of two patches, and then the night comes.',
      'The sure patch gives 4 units of food every evening. The variable patch gives 8 units on half the evenings and nothing on the other half, which half set by the seed. The bird survives the night if its reserves plus what it ate come to 10 units or more.',
      'You will choose a patch for the bird on each of 12 evenings, by pressing “Feed at the sure patch” or “Feed at the variable patch”. After each evening the screen shows what the bird ate and whether it survived. After the twelfth evening, a table shows, for every level of reserves from 2 to 9, the chance of surviving the night from each patch, computed exactly from the rules above.',
      'Then press “Run 1,000 evenings” to run three programmed foragers, each a fixed rule, over 1,000 evenings from the same spread of reserves: one always feeds at the sure patch, one always at the variable patch, and one feeds at the variable patch only on evenings when the sure patch could not bring its reserves to 10. The panel prints each rule’s share of nights survived, and your own share over your 12 evenings.',
      'Nothing here is scored, and nothing is saved across visits: you can leave and come back, and redo the evenings as often as you like.',
    ],
    minutes: 4,
    sitting: 'leave any time',
    sittingLine: 'You can leave and come back at any time, and start the evenings over with “Start the evenings again”.',
    keys: ['“Feed at the sure patch” and “Feed at the variable patch” choose the bird’s patch for the evening.', '“Run 1,000 evenings” runs the three programmed foragers.', '“Start the evenings again” begins a new set of 12 evenings.'],
    content: [SAME_EXPECTED_VALUE_LINE],
  },
}

export const READY_LINE = 'Nothing is needed. You will answer in the app. The report is filled in from the results screens afterward.'
