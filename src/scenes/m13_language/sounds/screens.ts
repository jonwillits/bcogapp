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
  2: `When this step is done, ${RESULTS_BELOW}. You will see your labels beside the right ones, then the six spectrograms named. To move on, press “Go on to Step 3” here or in the navigation panel.`,
  3: `When both blocks are done, ${RESULTS_BELOW}. To move on, press “Go on to Step 4” here or in the navigation panel.`,
  4: 'This step is an exploration with no end of its own. When you have done the three runs, this part is done. To move on to Part 2, press “Go on to Part 2” in the navigation panel, or choose the Stream tab at the top left.',
}

/** Built from params.yaml (Jon, 2026-11-18): the six labels pause, with or without a limit; a block restarts. */
const LABELS_LIMIT = stepParams('sounds', 2).pauseLimitMinutes ?? null
export const LABELS_SITTING_LINE = `Once you press “Begin”, label all six in one sitting if you can. ${pauseClause(LABELS_LIMIT)} ${restartClause(LABELS_LIMIT, RESTART_PHRASE.labels)} The same six can be used again because nothing was revealed before you committed.`
export const BLOCKS_SITTING_LINE = `Once you press “Begin”, finish each block in one sitting. A block runs in real time and cannot be paused. If you leave partway through a block, whether by ${LEAVING_PHRASE}, or by closing or reloading the page, that block starts again from its first trial when you return. A line on the results screen then says that the block was restarted. A block you have finished is saved and not played again.`

export const SCREENS: Record<Step, StepScreen> = {
  1: {
    step: 1,
    title: STEP_TITLES[1],
    kind: 'exploration',
    willDo: [
      'In this step you will look at spectrograms, which are pictures of sounds. You will hear each sound while you look at its picture. Time runs from left to right. Frequency runs from bottom to top. A sound’s frequency is how many times a second its sound wave repeats. Frequency is measured in hertz, written Hz: a sound at 100 Hz repeats 100 times a second. Brightness shows energy. The brighter a point, the more energy the sound has at that time and that frequency. Spectrograms printed on paper or on white backgrounds, including the reading’s figures, are usually the other way around: the background is white, and more energy is drawn darker.',
      'There are seven screens. Press “Next” to go from one to the next, or press a screen’s name at the top of the panel. Press “Play” on any screen to hear its sound.',
      'Screens 1 to 4 are about one sound, the vowel “ah”: its time, its frequencies, its energy, and then two kinds of pattern in it. On screen 4 you can switch between two views of the same sound: “Wide bands” and “Narrow bands”. A line beside the buttons says which view is showing. In the narrow-band view, you will see thin, evenly spaced horizontal lines. These lines are the harmonics of the voice. The lowest line is the pitch, how high or low the voice sounds. The faster the vocal folds vibrate, the higher the pitch. The lines above the lowest lie at two, three, four times its frequency, and so on. In the wide-band view you will see broad bright bands. These bands are the formants: the frequencies at which the throat and mouth resonate. The formants are what make one vowel sound different from another.',
      'Screens 5 to 7 compare sounds. On “Pitch”, you will hear the vowel “ah” made at a low pitch and at a high pitch. The question on that screen is: when the pitch goes up, what moves on the spectrogram? Choose a prediction and press “Commit my prediction”. The two spectrograms appear once you have committed. On “Voice”, you will hear the same vowel at the same pitch, made as a shorter throat and mouth would make it. On “Vowels”, you will hear “ee”, “ah”, and “oo”, and see each one placed on a plot of its second formant against its first.',
      'Nothing is scored in this step. Your one prediction is recorded. You can leave and come back at any time.',
    ],
    minutes: stepParams('sounds', 1).minutes,
    sitting: 'leave any time',
    sittingLine: EXPLORATION_SITTING_LINE,
    ready: READY_SOUND_LINE,
    keys: ['Press “Play” to hear the sound on the screen.', 'Press “Wide bands” or “Narrow bands”, from screen 4 on, to switch between two views of the same sound.', 'Press “Next” or “Back” to move through the seven screens. Press a screen’s name at the top of the panel to go to that screen.', 'Press “Commit my prediction”, on the “Pitch” screen, to commit your one prediction. You answer the question once; it does not come back.', 'Press “Go to Step 2”, on the last screen, to open Step 2.'],
    content: [HEADPHONES_LINE, MADE_OFFLINE_LINE, SETTINGS_NOT_MEASUREMENTS_LINE],
    next: NEXT_LINE[1],
    bottomNext: false,
  },
  2: {
    step: 2,
    title: STEP_TITLES[2],
    kind: 'experiment',
    willDo: [
      'In this step you will hear six short syllables, one at a time, and look at each one’s spectrogram. Each syllable begins with one of two consonants, “b” or “d”, and ends in one of three vowels, “ee”, “ah”, or “oo”. Your task is to label each syllable “b” or “d” by what you hear.',
      'The six spectrograms appear without labels, in an order drawn for you. Under each one are three buttons: “Play”, which plays the syllable, and “b” and “d”. Press “b” or “d” to label the syllable. You can change a label, and play a syllable, as often as you like until you press “Commit my labels”. Until you commit, nothing on the screen says which syllable is which.',
      'When all six are labeled, press “Commit my labels”. Your six labels then appear beside the right ones, with your number correct out of 6. Under them, the six spectrograms appear again, each named, each with two lines measured from the sound drawn on it, and each with a sentence about its syllable.',
      'Your six labels and the time you took are recorded. There is no time limit.',
    ],
    minutes: stepParams('sounds', 2).minutes,
    sitting: 'one sitting',
    sittingLine: LABELS_SITTING_LINE,
    ready: READY_SOUND_LINE,
    keys: ['Press “Play” under a spectrogram to hear that syllable.', 'Press “b” or “d” under a spectrogram to label it. You can change a label until you press “Commit my labels”.', 'Press “Commit my labels” to end the step; it is available once all six are labeled.'],
    content: [HEADPHONES_LINE, MADE_OFFLINE_LINE],
    next: NEXT_LINE[2],
  },
  3: {
    step: 3,
    title: STEP_TITLES[3],
    kind: 'experiment',
    willDo: [
      'In this step you will hear short synthetic syllables, made by a synthesizer, and answer a question about each one. There are two blocks. Each block opens on its own screen with its instructions. You start a block by pressing its button; it then runs on its own and is saved when it ends.',
      'Block 1, labeling: 54 trials, about 3 minutes. On each trial you hear one syllable three times in a row, half a second apart. Then two buttons appear, “B” and “D”. Press the button for the consonant you heard, or press the key B or D. The next trial starts 800 milliseconds after your answer. No answer is marked right or wrong, and there is no feedback.',
      'Block 2, telling apart: 28 trials, about 2 minutes. On each trial you hear three syllables in a row, one second apart. The first two are different from each other. The third is the same as one of the first two, and your task is to say which. Press “3rd sounds like the 1st” or “3rd sounds like the 2nd”, or press the key 1 or 2. Again there is no feedback.',
      'When both blocks are done, the results of this step appear below in this panel: your answers drawn as curves, each with its explanation.',
      'Every answer and its time are recorded. A trial has no time limit, but the sounds in a trial play on their own once the trial starts.',
    ],
    minutes: stepParams('sounds', 3).minutes,
    sitting: 'one sitting',
    sittingLine: BLOCKS_SITTING_LINE,
    ready: READY_SOUND_LINE,
    keys: ['Press “Start block 1” or “Start block 2” to start that block from its own screen.', 'In block 1, press “B” or “D”, or the key B or D, to give your label.', 'In block 2, press “3rd sounds like the 1st” or “3rd sounds like the 2nd”, or the key 1 or 2, to give your answer.'],
    content: [HEADPHONES_LINE, MADE_OFFLINE_LINE],
    next: NEXT_LINE[3],
  },
  4: {
    step: 4,
    title: STEP_TITLES[4],
    kind: 'exploration',
    willDo: [
      'In this step you will train a small neural network of the kind described in Module 7, and then test it. The network is a classifier: it sorts syllables into three labels, “b”, “d”, and “g”. The network takes in numbers, not sound: a small patch of a spectrogram, 40 frequency bands by 10 frames of 10 milliseconds each, starting 20 milliseconds before the consonant begins. Each number is the energy in one frequency band in one frame. The same program that draws the spectrograms you see computes the network’s input.',
      'The training sounds are syllables made by a text-to-speech program: “b”, “d”, and “g” before five vowels, in several voices. Each voice is used at its own pitch and at two shifted pitches. Once you press “Begin”, you will see the exact counts in the text at the top of the panel. Two of the voices are held out of training, so that the network can be tested on voices it was not trained on.',
      'There are three runs, one under another in this panel. Before each run, choose a prediction from the list above its button and press “Commit my prediction”. In run 1, press “Train”. The network is trained on every voice but the two held out, and tested on those two. While it trains, you will see a plot of the percentage of held-out syllables it labels correctly, pass by pass. When training ends, you will see a table of the network’s labels against the right labels. Once that network is done, you can press “Train 10 networks”: 10 more networks are trained on the same voices and tested on the same two, one after another, each from its own starting weights. You will then see all 10 curves, their mean with a band around it, and a table of their final percentages. Run 2 has three predictions; commit each on its own. Then press “Train both”: one network is trained on every voice at its own pitch only, a second on one voice at its three pitches only, and each is tested on all the rest. The two results appear side by side. Once both are done, you can press “Train 10 of each”: 10 more networks of each kind are trained, one after another, and each kind’s 10 are shown side by side, as run 1’s 10 are shown. In run 3, press “Run on the 9 sounds”. The network from run 1 is run on the 9 synthetic syllables of Step 3, and its three outputs are drawn as three lines, one for each label.',
      'Nothing is scored. Your five predictions are recorded. Training a network takes a few seconds, and a line in the panel says when training is done. Training 10 networks takes about ten times as long.',
    ],
    minutes: stepParams('sounds', 4).minutes,
    sitting: 'leave any time',
    sittingLine: EXPLORATION_SITTING_LINE,
    ready: READY_SOUND_LINE,
    keys: ['Press “Commit my prediction” to commit a prediction. Run 1 and run 3 have one prediction each; run 2 has three. Each is committed once and cannot be changed.', 'Press “Train” to train the network for run 1. “Train 10 networks” appears once that network is done; press it to train 10 more for run 1, one after another.', 'Press “Train both” to train the two networks of run 2, one after the other. It is available once all three of run 2’s predictions are committed. “Train 10 of each” appears once those two are done; press it to train 10 more of each kind, one after another.', 'Press “Run on the 9 sounds”, in run 3, to run the network from run 1 on the 9 synthetic sounds of Step 3.', 'Press “Train again” to repeat run 1 with new starting weights; press “Train both” again to do the same for run 2. Your predictions stay as you committed them.'],
    content: [HEADPHONES_LINE, MADE_OFFLINE_LINE],
    next: NEXT_LINE[4],
  },
}
