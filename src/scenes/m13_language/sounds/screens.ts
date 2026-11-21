import { HEADPHONES_LINE, MADE_OFFLINE_LINE, SETTINGS_NOT_MEASUREMENTS_LINE } from '../lines'
import { READY_SOUND_LINE, EXPLORATION_SITTING_LINE, RESULTS_BELOW, type StepScreen } from '../steps'
import { stepParams } from '../params'
import { LEAVING_PHRASE, RESTART_PHRASE, pauseClause, restartClause } from '../switching'

/**
 * Part 1's instruction screens (spec §5, §4.4): every acoustic term defined
 * where it is used, every number said in full, every control named by the
 * words printed on it, what is recorded, how long, whether one sitting, and
 * what happens if the student leaves. None of them names what Step 2 or
 * Step 3 tests (spec §11, item 2; `naming.test.ts`).
 */

export type Step = 1 | 2 | 3 | 4

export const STEP_TITLES: Record<Step, string> = {
  1: 'Step 1 — Reading a spectrogram',
  2: 'Step 2 — One consonant, different neighbors',
  3: 'Step 3 — Labeling and telling apart',
  4: 'Step 4 — A classifier learns the labels',
}

export const NEXT_LINE: Record<Step, string> = {
  1: 'This step is an exploration with no end of its own. When you have seen the screens you want to see, press “Go to Step 2” on the last screen or “Go on to Step 2” in the navigation panel.',
  2: `When this step is done, ${RESULTS_BELOW}: your labels beside the right ones, then the named spectrograms. To move on, press “Go on to Step 3” here or in the navigation panel.`,
  3: `When both blocks are done, ${RESULTS_BELOW}. To move on, press “Go on to Step 4” here or in the navigation panel.`,
  4: 'This step is an exploration with no end of its own. When you have done the three runs, this part is done. To move on to Part 2, press “Go on to Part 2” in the navigation panel, or choose the Stream tab at the top left.',
}

/** Built from params.yaml (Jon, 2026-11-18): the six labels pause, with or without a limit; a block restarts. */
const LABELS_LIMIT = stepParams('sounds', 2).pauseLimitMinutes ?? null
export const LABELS_SITTING_LINE = `Once you press “Begin”, label all six in one sitting if you can. ${pauseClause(LABELS_LIMIT)} ${restartClause(LABELS_LIMIT, RESTART_PHRASE.labels)} Nothing was revealed, so nothing needs to change.`
export const BLOCKS_SITTING_LINE = `Once you press “Begin”, finish each block in one sitting. A block runs in real time and cannot be paused. If you leave partway through a block, by ${LEAVING_PHRASE} or by closing or reloading the page, that block starts again from its first trial when you return, and the restart is noted on the results screen. A block you have finished is saved and not played again.`

export const SCREENS: Record<Step, StepScreen> = {
  1: {
    step: 1,
    title: STEP_TITLES[1],
    kind: 'exploration',
    willDo: [
      'In this step you will look at pictures of sounds, called spectrograms, and hear the sounds they picture. A spectrogram is a picture of a sound. Time runs from left to right. Frequency runs from bottom to top. Frequency is how many times a second a sound wave repeats, measured in hertz, written Hz: a sound at 100 Hz repeats 100 times a second. Brightness shows energy: the brighter a point, the more energy the sound has at that time and that frequency. Printed spectrograms, including the reading’s figures, are the other way around: the background is white, and more energy is drawn darker.',
      'There are seven screens. Press “Next” to go from one to the next, or press a screen’s name at the top of the panel. Press “Play” on any screen to hear its sound.',
      'Screens 1 to 4 are about one sound, the vowel ah: its time, its frequencies, its energy, and then two kinds of pattern in it. On screen 4 you can switch between two views of the same sound, “Wide bands” and “Narrow bands”; a line beside the buttons says which view is showing. In the narrow-band view you will see thin, evenly spaced horizontal lines. These lines are the harmonics of the voice: the lowest line is the pitch, how high or low the voice sounds, set by how fast the vocal folds vibrate, and the lines above it are at two, three, four times that frequency, and so on. In the wide-band view you will see broad bright bands. These bands are the formants: the frequencies at which the throat and mouth resonate, which make one vowel sound different from another.',
      'Screens 5 to 7 compare sounds. On “Pitch”, you will hear the vowel ah made at a low pitch and at a high pitch. Before the two spectrograms appear, choose a prediction on that screen and press “Commit my prediction”: when the pitch goes up, what moves on the spectrogram? On “Voice”, you will hear the same vowel at the same pitch from a shorter throat and mouth. On “Vowels”, you will hear ee, ah, and oo, and see each one placed on a plot of its second formant against its first.',
      'Nothing is scored in this step. Your one prediction is recorded. You can leave and come back at any time.',
    ],
    minutes: stepParams('sounds', 1).minutes,
    sitting: 'leave any time',
    sittingLine: EXPLORATION_SITTING_LINE,
    ready: READY_SOUND_LINE,
    keys: ['“Play” plays the sound on the screen.', '“Wide bands” and “Narrow bands”, from screen 4 on, switch the view of the same sound.', '“Next” and “Back” move through the seven screens. Press a screen’s name at the top of the panel to go to that screen.', '“Commit my prediction” commits the one prediction, on the “Pitch” screen; it is asked once.', '“Go to Step 2”, on the last screen, opens Step 2.'],
    content: [HEADPHONES_LINE, MADE_OFFLINE_LINE, SETTINGS_NOT_MEASUREMENTS_LINE],
    next: NEXT_LINE[1],
    bottomNext: false,
  },
  2: {
    step: 2,
    title: STEP_TITLES[2],
    kind: 'experiment',
    willDo: [
      'In this step you will hear six short syllables, one at a time, and look at each one’s spectrogram. Each syllable begins with one of two consonants, b or d, and ends in one of three vowels, ee, ah, or oo. Your task is to label each syllable b or d by what you hear.',
      'The six spectrograms appear without labels, in an order drawn for you. Under each one are “Play”, which plays the syllable, and two buttons, “b” and “d”. Click one to label the syllable. You can change a label as often as you like, and you can play a syllable as often as you like, until you press “Commit my labels”. Before the commit, nothing on the screen says which syllable is which.',
      'When all six are labeled, press “Commit my labels”. Then your six labels appear beside the right ones, with the number correct out of 6, and under them the six spectrograms are named, with a drawing on each and a sentence about each syllable.',
      'Your six labels and the time you took are recorded. There is no time limit.',
    ],
    minutes: stepParams('sounds', 2).minutes,
    sitting: 'one sitting',
    sittingLine: LABELS_SITTING_LINE,
    ready: READY_SOUND_LINE,
    keys: ['“Play” under a spectrogram plays that syllable.', '“b” and “d” under a spectrogram label it; a label can be changed until the commit.', '“Commit my labels” ends the step; it is available once all six are labeled.'],
    content: [HEADPHONES_LINE, MADE_OFFLINE_LINE],
    next: NEXT_LINE[2],
  },
  3: {
    step: 3,
    title: STEP_TITLES[3],
    kind: 'experiment',
    willDo: [
      'In this step you will hear short synthetic syllables and answer a question about each one. There are two blocks. Each block opens on its own screen, with its instructions and a button that starts it, runs on its own, and is saved when it ends.',
      'Block 1, labeling: 54 trials, about 3 minutes. On each trial you hear one syllable three times in a row, half a second apart. Then two buttons appear, “B” and “D”. Press the one that says which consonant you heard. You can also press the keys B and D. The next trial starts 800 milliseconds after your answer. No answer is marked right or wrong, and there is no feedback.',
      'Block 2, telling apart: 28 trials, about 7 minutes. On each trial you hear three syllables in a row, with a pause between them, and then the same three twice more, with a longer pause before each repeat. The first two syllables are different from each other. The third is the same as one of the first two, and your task is to say which. Press “3rd sounds like the 1st” or “3rd sounds like the 2nd”, or the keys 1 and 2. Again there is no feedback.',
      'When both blocks are done, the results of this step appear below in this panel, with your answers drawn as curves and explained.',
      'Every answer and its time are recorded. A trial has no time limit, but the sounds in a trial play on their own once the trial starts.',
    ],
    minutes: stepParams('sounds', 3).minutes,
    sitting: 'one sitting',
    sittingLine: BLOCKS_SITTING_LINE,
    ready: READY_SOUND_LINE,
    keys: ['“Start block 1” and “Start block 2” start each block from its own screen.', 'In block 1, “B” and “D”, or the keys B and D, give your label.', 'In block 2, “3rd sounds like the 1st” and “3rd sounds like the 2nd”, or the keys 1 and 2, give your answer.'],
    content: [HEADPHONES_LINE, MADE_OFFLINE_LINE],
    next: NEXT_LINE[3],
  },
  4: {
    step: 4,
    title: STEP_TITLES[4],
    kind: 'exploration',
    willDo: [
      'In this step you will train a small network of the kind described in Module 7 to sort syllables into three labels, b, d, and g, and then test it. The network takes in numbers, not sound: a small patch of a spectrogram, about 40 frequency bands by 10 frames of 10 milliseconds each, starting 20 milliseconds before the consonant begins. Each number is the energy in one frequency band in one frame. The same code that draws the spectrograms you see computes the network’s input.',
      'The training sounds are natural syllables, b, d, and g before five vowels, made by a text-to-speech program in several voices, each voice at its own pitch and at two shifted pitches. The text at the top of this panel states the exact counts. Two of the voices are held out of training, so that the network can be tested on voices it has not learned from.',
      'There are three runs, one under another in this panel. Before each run, choose a prediction from the list above its button and press “Commit my prediction”. In run 1, press “Train”: the network is trained on every voice but the two held out, and tested on those two. A plot shows the percentage correct on the held-out syllables rising while the network trains, and a table of its labels against the right labels appears when training ends. Once that network is done, you can press “Train 10 networks”: 10 more networks are trained on the same split, one after another, each from its own starting weights, and the panel shows all 10 curves, their mean with a band around it, and a table of their final percentages. Run 2 has three predictions, each committed on its own. Then press “Train both”: one network is trained on every voice at its own pitch only, a second on one voice at its three pitches only, and each is tested on all the rest; the two results appear side by side. Once both are done, you can press “Train 10 of each”: 10 more networks of each kind are trained, one after another, and each kind’s 10 are shown as run 1’s are, side by side. In run 3, press “Run on the 9 sounds”: the network from run 1 is run on the 9 synthetic syllables of Step 3, and its three outputs are drawn as three lines, one for each label.',
      'Nothing is scored. Your five predictions are recorded. Training a network takes a few seconds, and the panel says when it is done; the 10 networks take about ten times as long.',
    ],
    minutes: stepParams('sounds', 4).minutes,
    sitting: 'leave any time',
    sittingLine: EXPLORATION_SITTING_LINE,
    ready: READY_SOUND_LINE,
    keys: ['“Commit my prediction” commits a prediction; each is asked once. Run 1 and run 3 have one prediction each, run 2 has three.', '“Train” trains the network for run 1. “Train 10 networks”, available once that network is done, trains 10 more for run 1, one after another.', '“Train both” trains the two networks of run 2, one after the other; it is available once all three of run 2’s predictions are committed. “Train 10 of each”, available once those two are done, trains 10 more of each kind, one after another.', '“Run on the 9 sounds” runs the network from run 1 for run 3.', '“Train again” repeats run 1 from a new starting point for the weights, and pressing “Train both” again does the same for run 2. No prediction is asked again.'],
    content: [HEADPHONES_LINE, MADE_OFFLINE_LINE],
    next: NEXT_LINE[4],
  },
}
