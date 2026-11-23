import { HEADPHONES_LINE, MADE_OFFLINE_LINE, MADE_UP_LANGUAGE_LINE, COUNTS_FROM_YOUR_STREAM_LINE, REAL_SPEECH_LINE } from '../lines'
import { READY_SOUND_LINE, EXPLORATION_SITTING_LINE, EXPLORATION_NO_PREDICTION_LINE, RESULTS_BELOW, type StepScreen } from '../steps'
import { MAIN_TABS, stepParams } from '../params'
import { LEAVING_PHRASE } from '../switching'

/**
 * Part 2's instruction screens (spec §6, §4.4). None of them, before Step
 * 1's commit, names how many words the language has or how they are found
 * (spec §11, item 3; `naming.test.ts`): Steps 2 to 4 may be opened first,
 * behind a one-line notice.
 */

export type Step = 1 | 2 | 3 | 4

export const STEP_TITLES: Record<Step, string> = {
  1: 'Step 1 — A minute of the language',
  2: 'Step 2 — Find the words',
  3: 'Step 3 — Three learners',
  4: 'Step 4 — Real speech',
}

export const NEXT_LINE: Record<Step, string> = {
  1: `When your answer is committed, ${RESULTS_BELOW}. Then press “Go on to Step 2” here or in the navigation panel.`,
  2: `When every word has been found or shown, you see the 300 syllables printed and divided into words, and the results of this step appear below, in this panel, with their explanation, and on the ${MAIN_TABS.results} tab at the top of this panel. To move on, press “Go on to Step 3” here or in the navigation panel.`,
  3: 'This step is an exploration with no end of its own. When you have run the learners and answered the questions, press “Go on to Step 4” in the navigation panel.',
  4: 'This step is an exploration with no end of its own. When you have seen the utterances you want to see, this part is done. To move on to Part 3, press “Go on to Part 3” in the navigation panel, or choose the Words tab at the top left.',
}

/** The one-line notice on Steps 2 to 4 before Step 1 is committed (spec §11, item 3). */
export const NOTICE_LINE = 'This step shows how the stream of Step 1 is divided into words. If you open it before you commit your answer in Step 1, your answer there will no longer be a first guess.'

export const MINUTE_SITTING_LINE = `Once you press “Begin”, listen to the minute and commit your answer in one sitting. The minute cannot be paused. If you leave partway, by ${LEAVING_PHRASE} or by closing or reloading the page, before your answer is committed, the same minute plays again from the start when you return. Nothing was revealed, so nothing needs to change.`
export const BOARD_SITTING_LINE = 'You can leave and come back at any time. The words you have found and every word you have checked are saved as they happen, and the step goes on from where you stopped.'

export const SCREENS: Record<Step, StepScreen> = {
  1: {
    step: 1,
    title: STEP_TITLES[1],
    kind: 'experiment',
    willDo: [
      'In this step you will hear one minute of a made-up language. The language has words, but its words have no meanings, and it has no grammar. A synthetic voice speaks its words one after another, with no pauses between them. Your task, as in the original experiment, is to work out where its words begin and end. There is no test.',
      'Press “Play the minute”. The sound plays for 60 seconds. A large timer counts down, and nothing else is on the screen while the sound plays. Listen.',
      'When the minute ends, answer one question: how many different words do you think the language has? Choose a number from 1 to 20. A box under the number takes any words you think you heard, typed as they sound. The box is optional. Then press “Commit my answer”.',
      'After the commit, your answer is shown beside the number of words the language has. The minute can be heard again, with its words marked, once Step 2 is done.',
      'Your answer, any words you typed, and the time are recorded.',
    ],
    minutes: stepParams('stream', 1).minutes,
    sitting: 'one sitting',
    sittingLine: MINUTE_SITTING_LINE,
    ready: READY_SOUND_LINE,
    keys: ['Press “Play the minute” to play 60 seconds of the language once.', 'A list from 1 to 20 takes your answer, and an optional box takes words you think you heard.', 'Press “Commit my answer” to commit them.'],
    content: [HEADPHONES_LINE, MADE_OFFLINE_LINE, MADE_UP_LANGUAGE_LINE],
    next: NEXT_LINE[1],
  },
  2: {
    step: 2,
    title: STEP_TITLES[2],
    kind: 'experiment',
    willDo: [
      'In this step you will find the words of the language of Step 1 from counts. The counts come from the first 300 syllables of your stream, which begin with the minute you heard; the syllables themselves are not shown. You see the palette of the language’s 12 syllables, a panel of counts beside it, and a tray.',
      'Click a syllable in the palette to highlight it. In the panel beside the palette, you then see how many times that syllable occurs in the 300 syllables, which syllables come right after it, and which come right before it, each with its own count. The syllable stays highlighted until you click it again or press “Clear the highlight”.',
      'Build a word in the tray, 2 to 4 tiles at a time: drag tiles from the palette into the tray, or highlight a syllable and press “Add to the tray”. To take a tile out, click it; to take every tile out, press “Empty the tray”. Under the tray you see how many times the tray’s syllables occur together, in that order, in the 300 syllables. To test the tray, press “Check this word”.',
      'If the tray holds one of the language’s words, the word is added to “Words found” in a color of its own. If it does not, a line says so. Every word you check is recorded, and checking a wrong one costs nothing.',
      'The step ends when you have found every word, or when you press “Show me the words” and confirm it. Then you see the 300 syllables printed in the order they are spoken, each word filled with its color; you can hear the minute of Step 1 again with its words marked; and the results of this step appear under them.',
    ],
    minutes: stepParams('stream', 2).minutes,
    sitting: 'leave any time',
    sittingLine: BOARD_SITTING_LINE,
    keys: ['Click a syllable in the palette to highlight it and see its counts. The syllable stays highlighted until you click it again or press “Clear the highlight”.', 'Drag tiles into the tray, 2 to 4 at a time, or press “Add to the tray”. To take a tile out, click it; to take every tile out, press “Empty the tray”.', 'Press “Check this word” to test the tray.', 'Press “Show me the words” to end the search; it asks you to confirm first.'],
    content: [MADE_UP_LANGUAGE_LINE, COUNTS_FROM_YOUR_STREAM_LINE],
    next: NEXT_LINE[2],
  },
  3: {
    step: 3,
    title: STEP_TITLES[3],
    kind: 'exploration',
    willDo: [
      'In this step you will run three computer programs, called learners here, on the language of Step 1. Each learner takes in syllables one at a time and computes something from them. None of the three is given the words. Before anything runs, you read what the adults and the infants of the original experiments did, what the three learners are explanations of, what would count as success, and how each learner works, with a drawing of each. Once the learners have run, you read how each takes the test, and you answer questions from the results.',
      'Press “Run the learners” once. Each learner takes the test having taken in nothing, then after 30 seconds of your stream, then after every minute of it from 1 to 21. The same is done at each amount on 19 other streams of the same language, so that you see the spread. The plot fills in as each amount is done.',
      'After taking in the stream, each learner takes a test of 36 trials in two versions. On each trial, a learner is given two strings of three syllables, and it chooses the string with the higher score by its own rule. The two versions are described at the top of the panel.',
      'Before the run, choose three predictions from the lists above the plot and press “Commit my predictions”. The plot shows each learner’s percentage correct on each version of the test against how much of the stream it took in, with the adults’ and the infants’ results marked.',
      'Nothing is scored. Your predictions are recorded. The run takes some seconds, and the plot fills in amount by amount.',
    ],
    minutes: stepParams('stream', 3).minutes,
    sitting: 'leave any time',
    sittingLine: EXPLORATION_SITTING_LINE,
    keys: ['Press “Commit my predictions” to commit your three predictions, which you make once, before the run.', 'Press “Run the learners” to run all three at every amount, nothing to 21 minutes, in turn.', 'You read how each learner works at the top of the panel, with a drawing, and how each takes the test under the plot.'],
    content: [MADE_UP_LANGUAGE_LINE],
    next: NEXT_LINE[3],
  },
  4: {
    step: 4,
    title: STEP_TITLES[4],
    kind: 'exploration',
    willDo: [
      'In this step you will look at real speech spoken to young children, written out as syllables. The utterances come from transcripts in a public archive of recordings of children and the adults around them. No sound plays in this step. Each word was turned into syllables by a pronouncing dictionary, so you see the dictionary’s syllables, not the recordings’.',
      'Choose an utterance from the menu above the strip. You see it as a strip of syllable tiles. Above each pair of neighboring syllables is a number computed from the whole sample of utterances, the same number the first learner of Step 3 computes; the panel defines it. The true word boundaries are marked under the strip. To mark the syllables the dictionary gives stress, press “Show stress”.',
      'Under the strip, two histograms show that number at two kinds of place in the sample of real speech, and the same two kinds for the made-up language of Step 1. Under them, you see the first learner of Step 3 run on the whole sample, with two shares.',
      'Nothing is scored, and nothing is recorded in this step.',
    ],
    minutes: stepParams('stream', 4).minutes,
    sitting: 'leave any time',
    sittingLine: EXPLORATION_NO_PREDICTION_LINE,
    keys: ['Choose an utterance from the menu above the strip.', 'Press “Show stress” to mark the stressed syllables on the strip.'],
    content: [REAL_SPEECH_LINE],
    next: NEXT_LINE[4],
  },
}
