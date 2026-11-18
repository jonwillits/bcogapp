import type { TourScreen } from './store'

/**
 * Part 1's panel texts: the tour's screens, the explanations beside each
 * step, and the network's panel. Every acoustic term defined where it is
 * used (spec §4.4); nothing from Step 2's or Step 3's held-back lists
 * before their reveals (§11, item 2).
 */

export const TOUR_TITLES: Record<TourScreen, string> = {
  time: 'Time',
  frequency: 'Frequency',
  energy: 'Energy',
  patterns: 'Two kinds of pattern',
  pitch: 'Pitch',
  voice: 'Voice',
  vowels: 'Vowels',
}

export const TOUR_TEXT: Record<TourScreen, string[]> = {
  time: [
    'A spectrogram is a picture of a sound. Time runs from left to right: the left edge is the start of the sound and the right edge is its end. The strip above the picture, on its own axis, is the waveform: the air pressure moment by moment. Press “Play” to hear the sound. While it plays, a white line moves from left to right at the moment being heard.',
    'The sound on this screen is the vowel ah, made by a synthesizer at a pitch of 120 Hz. It lasts 0.6 seconds. The same sound is on the first four screens.',
  ],
  frequency: [
    'Frequency runs from bottom to top. Frequency is how many times a second a sound wave repeats, measured in hertz, written Hz: a sound at 100 Hz repeats 100 times a second, and a sound at 1,000 Hz a thousand times. The numbers up the left side mark 0 to 5,000 Hz. Most of what makes one speech sound different from another lies below 5,000 Hz.',
  ],
  energy: [
    'Brightness shows energy. The brighter a point, the more energy the sound has at that time and that frequency; the dark background is silence or nearly so. A speech sound is not one frequency but many at once, with more energy at some than at others, and the picture shows which.',
    'Printed spectrograms, including the reading’s figures, are the other way around: the background is white, and more energy is drawn darker.',
  ],
  patterns: [
    'There are two views of the same sound, and each shows one kind of pattern. In “Narrow bands” you see thin, evenly spaced horizontal lines. These lines are the harmonics of the voice. The lowest line is the pitch, the rate at which the vocal folds vibrate, and the lines above it lie at two, three, four times that frequency, and so on: a voice at 120 Hz has harmonics at 120, 240, 360 Hz and up.',
    'In “Wide bands” the harmonics blur together and you see broad bright bands instead. These bands are the formants: the frequencies at which the throat and mouth resonate, as a bottle resonates at one note when you blow over it. The formants are what make one vowel sound different from another. They are counted from the bottom: the first formant, the second, the third. Switch between the two views with the buttons above the picture; the line beside them says which view is showing.',
  ],
  pitch: [
    'Here is the same vowel, ah, made twice by the synthesizer: once at a pitch of 100 Hz and once at 200 Hz, with every formant set to the same frequencies both times. Before the two spectrograms appear, choose a prediction above and press “Commit my prediction”: when the pitch goes up, what moves on the spectrogram, the harmonics, the formants, both, or neither?',
    'After the commit, the two spectrograms appear side by side in the narrow-band view, with the first two formants marked at the frequencies the synthesizer was set to.',
  ],
  voice: [
    'Here is the same vowel at the same pitch, 100 Hz, made by the synthesizer twice: once with the formants of the earlier screens, and once with every formant raised by 15%, which is what a vocal tract about 13% shorter would do. The first two formants are marked at their set frequencies in both. Look at what moves between the two pictures and what does not: the formant marks, or the spacing of the harmonics.',
  ],
  vowels: [
    'Here are three vowels at one pitch, 120 Hz: ee as in see, ah as in father, and oo as in who. Each has its first two formants marked at the synthesizer’s settings. The plot under them places each vowel by its second formant (left to right) against its first formant (up and down), with the axes turned so that the plot has the same orientation as the reading’s figure of monkey and human vowels (§13.1.6): the first formant increases downward and the second increases leftward.',
  ],
}

export const TOUR_RIGHT: Record<TourScreen, string> = {
  time: 'The sound was made by a computer. Every number marked on this screen is a setting of the synthesizer that made it, not a measurement.',
  frequency: 'A piano’s middle C is about 262 Hz; the highest note on a piano is about 4,186 Hz. Speech has energy over this whole range and above it.',
  energy: 'The picture is computed from the sound by a standard method, the short-time Fourier transform: the sound is cut into short pieces, and the energy at each frequency is measured in each piece.',
  patterns: 'In the narrow-band view each piece of sound is 25 milliseconds long, long enough to tell harmonics apart. In the wide-band view each piece is 5 milliseconds long, too short to tell harmonics apart, so the harmonics blur into the formants.',
  pitch: 'The formants were set to 700, 1,200, 2,600, and 3,400 Hz in both sounds. Only the pitch differs.',
  voice: 'The formants were set to 700, 1,200, 2,600, and 3,400 Hz in one sound and to 805, 1,380, 2,990, and 3,910 Hz in the other. The pitch is 100 Hz in both.',
  vowels: 'The formants were set to ee 300 and 2,300 Hz, ah 700 and 1,200 Hz, and oo 320 and 850 Hz. These are round values from the range of English vowels, chosen for the synthesizer, not measured from a talker.',
}

/** What the view line says on the first three screens, where the view is fixed, and on the rest (Jon, 2026-11-16: a switch that changes the picture but not the sound confuses before it is explained). */
export const VIEW_FIXED_LINE = 'This is the wide-band view. A second view of the same sound is introduced on screen 4.'

export const STEP2_PANEL = [
  'Each of the six spectrograms is a syllable made by a text-to-speech program in one voice, voice 1. Each begins with b or d and ends in ee, ah, or oo. Press “Play” under a spectrogram to hear it, as often as you like.',
  'Label each one by what you hear: press “b” or “d” under it. A label can be changed until you press “Commit my labels”. Nothing on this screen says which syllable is which until then.',
]

export const STEP3_PANEL = [
  'Each sound in this step is synthetic: a short syllable made by the synthesizer from two formants, the same first formant in every sound and a second formant that differs from sound to sound in one setting. There are 9 sounds. They are not in order on the screen, and no screen shows which sound is playing.',
  'In block 1 you give a label for each sound. In block 2 you say which of two sounds a third one matched. Answer by what you hear. There is no right or wrong shown.',
]

/** The screen before block 1, with Start block 1 (Jon, 2026-11-16: each block's instructions right before it). */
export const BLOCK1_SCREEN = [
  'Block 1 has 54 trials and takes about 2 minutes. On each trial you hear one short syllable. Then two buttons appear, “B” and “D”. Press the one that says which consonant you heard, or press the key B or D. The next syllable plays 800 milliseconds after your answer.',
  'There are 9 different sounds, each played 6 times in an order drawn for you. No answer is marked right or wrong, and there is no feedback. Some sounds will be hard to call; answer by what you hear, and if you cannot tell, pick one anyway.',
  'The block runs in real time. If you leave the page partway, the block starts again from its first trial. Press “Start block 1” when you are ready.',
]

/** The screen between the blocks, with Start block 2. */
export const BLOCK2_SCREEN = [
  'Block 1, labeling, is done and saved.',
  'Block 2 has 28 trials and takes about 2 minutes. On each trial you hear three sounds, one second apart. The first two are different from each other. The third is the same as one of the first two, and your task is to say which. After the third sound, press “X matched the first” or “X matched the second”, or the key 1 or 2.',
  'Many trials will feel like guessing: the two sounds are often very alike. That is expected. When you cannot tell, guess; a guess is the right answer here. There is no feedback.',
  'The block runs in real time. If you leave the page partway, the block starts again from its first trial. Block 2 starts only when you press “Start block 2”.',
]

export const STEP4_PANEL = [
  'The network takes in 400 numbers for each syllable. Each number is the energy in one frequency band in one 10 millisecond frame of the spectrogram: 40 bands from 0 to 5,000 Hz, by 10 frames starting 20 milliseconds before the consonant’s release, scaled from 0 at 60 decibels below the loudest point of the patch to 1 at the loudest point. The patch is cut from the same spectrogram you see.',
  'The 400 inputs connect to 12 hidden units. Each hidden unit computes a weighted sum of its inputs, adds its own baseline, and squashes the sum with an S-shaped curve to a value between 0 and 1, as the units of Module 7 do. The 12 hidden units connect to 3 output units, one for each label, which compute the same way. The network’s label for a syllable is the output with the largest value.',
  'The weights start as small random numbers. Learning moves them by the rule of Module 7: for each syllable, each output is compared with its target (1 for the right label, 0 for the other two), and the difference is passed back through the connections to the hidden units, scaled by each unit’s slope, so that every weight changes in proportion to its input and to the error passed back to it. One pass through the training syllables moves every weight once per syllable; the network makes 12 passes.',
  'Training syllables: b, d, and g before ee, ay, ah, oh, and oo, from 12 voices of a text-to-speech program, each voice at its own pitch and at two shifted pitches, 3 semitones down and 3 up: 540 syllables in all. Voices 11 and 12 are held out of training in run 1 and tested on. The network never receives a voice’s number, a pitch, or a vowel, only the 400 numbers.',
]
