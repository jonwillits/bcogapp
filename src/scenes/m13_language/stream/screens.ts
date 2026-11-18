import { HEADPHONES_LINE, MADE_OFFLINE_LINE, MADE_UP_LANGUAGE_LINE, COUNTS_FROM_YOUR_STREAM_LINE, REAL_SPEECH_LINE } from '../lines'
import { READY_SOUND_LINE, EXPLORATION_SITTING_LINE, EXPLORATION_NO_PREDICTION_LINE, RESULTS_BELOW, type StepScreen } from '../steps'
import { stepParams } from '../params'
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
  1: `When your answer is committed, ${RESULTS_BELOW}. When you have heard the replays you want to hear, press “Go on to Step 2” here or in the navigation panel.`,
  2: `When every word is found or shown, ${RESULTS_BELOW}. To move on, press “Go on to Step 3” here or in the navigation panel.`,
  3: 'This step is an exploration with no end of its own. When you have run the learners at the settings you want, press “Go on to Step 4” in the navigation panel.',
  4: 'This step is an exploration with no end of its own. When you have seen the utterances you want to see, this part is done. To move on to Part 3, press “Go on to Part 3” in the navigation panel, or choose the Words tab at the top left.',
}

/** The one-line notice on Steps 2 to 4 before Step 1 is committed (spec §11, item 3). */
export const NOTICE_LINE = 'This step shows how the stream of Step 1 is divided into words. If you open it before you commit your answer in Step 1, your answer there will no longer be a first guess.'

export const MINUTE_SITTING_LINE = `Once you press “Begin”, listen to the minute and commit your answer in one sitting. The minute cannot be paused. If you leave partway, by ${LEAVING_PHRASE} or by closing or reloading the page, before your answer is committed, the same minute plays again from the start when you return. Nothing was revealed, so nothing needs to change.`
export const BOARD_SITTING_LINE = 'You can leave and come back at any time. The board, the words you have found, and your checks are saved as they happen, and the step goes on from where you stopped.'

export const SCREENS: Record<Step, StepScreen> = {
  1: {
    step: 1,
    title: STEP_TITLES[1],
    kind: 'experiment',
    willDo: [
      'In this step you will hear one minute of a made-up language. The language has words, but its words have no meanings, and it has no grammar. A synthetic voice speaks its words one after another, with no pauses between them. Your task, as in the original experiment, is to work out where its words begin and end. There is no test.',
      'Press “Play the minute”. The sound plays for 60 seconds. A large timer counts down. Under the timer, a spectrogram scrolls past a cursor at the sound being played. A spectrogram is a picture of a sound: time runs from left to right, frequency from bottom to top, and brightness shows energy. Nothing on the screen marks where a word begins or ends.',
      'When the minute ends, answer one question: how many different words do you think the language has? Choose a number from 1 to 20. A box under the number takes any words you think you heard, typed as they sound. The box is optional. Then press “Commit my answer”.',
      'After the commit, two more buttons appear. Each one replays the same minute in a different way, and the results under them say what each replay adds.',
      'Your answer, any words you typed, and the time are recorded.',
    ],
    minutes: stepParams('stream', 1).minutes,
    sitting: 'one sitting',
    sittingLine: MINUTE_SITTING_LINE,
    ready: READY_SOUND_LINE,
    keys: ['“Play the minute” plays 60 seconds of the language once.', 'A list from 1 to 20 takes your answer, and an optional box takes words you think you heard.', '“Commit my answer” commits them.', 'After the commit, two buttons replay the minute in two different ways.'],
    content: [HEADPHONES_LINE, MADE_OFFLINE_LINE, MADE_UP_LANGUAGE_LINE],
    next: NEXT_LINE[1],
  },
  2: {
    step: 2,
    title: STEP_TITLES[2],
    kind: 'experiment',
    willDo: [
      'In this step you will see the first 300 syllables of the language of Step 1, printed as tiles on a board, in the order they are spoken. Each tile is one syllable in plain lowercase letters. The rows are 20 tiles wide. A row break means nothing: it falls wherever the twentieth tile falls.',
      'Click a tile to highlight every tile with the same syllable. The panel of counts beside the board then lists, for that syllable, every syllable that comes right after it on the board and how many times each one does, and every syllable that comes right before it. Click the same tile again, or press “Clear the highlight”, to remove the highlight.',
      'Build a word in the tray under the board. Drag tiles into the tray from the board, or from the palette of the language’s 12 syllables, 2 to 4 tiles at a time. Drag a tile out of the tray to remove it, or press “Empty the tray”. A line under the tray says how many times the tray’s syllables occur together, in that order, on the board. Press “Check this word” to test the tray.',
      'If the tray holds one of the language’s words, every instance of that word on the board fills with the word’s own color and stays filled, and the word is added to “Words found”. If the tray does not hold one of the language’s words, a line says so, and nothing on the board changes. Every check is recorded, and a wrong check costs nothing.',
      'The step ends when every word is found, or when you press “Show me the words” and confirm it. Then the results of this step appear under the board.',
    ],
    minutes: stepParams('stream', 2).minutes,
    sitting: 'leave any time',
    sittingLine: BOARD_SITTING_LINE,
    keys: ['Click a tile to highlight its syllable everywhere on the board; click it again, or press “Clear the highlight”, to remove the highlight.', 'Drag tiles into the tray, 2 to 4 at a time; drag one out, or press “Empty the tray”, to remove them.', '“Check this word” tests the tray.', '“Show me the words” ends the search, after an in-page confirmation.'],
    content: [MADE_UP_LANGUAGE_LINE, COUNTS_FROM_YOUR_STREAM_LINE],
    next: NEXT_LINE[2],
  },
  3: {
    step: 3,
    title: STEP_TITLES[3],
    kind: 'exploration',
    willDo: [
      'In this step you will run three computer programs, called learners here, on the language of Step 1. Each learner takes in syllables, one at a time, and computes something from them. None of the three is given the words. Each learner’s description, under the plot, says step by step what it computes.',
      'A slider, “How much of the stream”, sets how many syllables each learner takes in: 30 seconds, 1, 2, 4, 7, 14, or 21 minutes of the language. The panel prints how many syllables that is. Press “Run the learners” to run every learner on that much of your stream, and on the same amount of 19 other streams of the same language, so that you see the spread.',
      'After taking in the stream, each learner takes a test of 36 trials in two versions. On each trial, a learner is given two strings of three syllables, and its choice is the string with the higher score by its own rule. The panel says what the two versions of the test are once the first run is done.',
      'Before the first run, choose three predictions from the lists above the plot, and press “Commit my predictions”. The plot shows each learner’s percentage correct on each version of the test against how much of the stream it took in. Two published results are marked on the plot once the first run is done.',
      'Nothing is scored. Your predictions are recorded. A run takes a few seconds at the longest setting.',
    ],
    minutes: stepParams('stream', 3).minutes,
    sitting: 'leave any time',
    sittingLine: EXPLORATION_SITTING_LINE,
    keys: ['“Commit my predictions” commits the three predictions, asked once before the first run.', '“How much of the stream” is a slider with seven settings.', '“Run the learners” runs all three at the slider’s setting.', 'Click a learner’s name under the plot to read what it computes.'],
    content: [MADE_UP_LANGUAGE_LINE],
    next: NEXT_LINE[3],
  },
  4: {
    step: 4,
    title: STEP_TITLES[4],
    kind: 'exploration',
    willDo: [
      'In this step you will look at real speech spoken to young children, written out as syllables. The utterances come from transcripts in a public archive of recordings of children and the adults around them. No sound plays in this step. Each word was turned into syllables by a pronouncing dictionary, so what you see is the dictionary’s syllables, not the recordings’.',
      'Choose an utterance from the menu above the strip. It appears as a strip of syllable tiles. Above each pair of neighboring syllables is a number computed from the whole sample of utterances, the same number the first learner of Step 3 computes, and the panel defines it. The true word boundaries are marked under the strip. Press “Show stress” to mark the syllables the dictionary gives stress.',
      'Under the strip, a histogram compares that number at two kinds of place in the sample of real speech, beside the same two kinds for the made-up language of Step 1. Under them, the first learner from Step 3 is run on the sample, and two shares are printed.',
      'Nothing is scored, and nothing is recorded in this step.',
    ],
    minutes: stepParams('stream', 4).minutes,
    sitting: 'leave any time',
    sittingLine: EXPLORATION_NO_PREDICTION_LINE,
    keys: ['Choose an utterance from the menu above the strip.', '“Show stress” marks the stressed syllables on the strip.'],
    content: [REAL_SPEECH_LINE],
    next: NEXT_LINE[4],
  },
}
