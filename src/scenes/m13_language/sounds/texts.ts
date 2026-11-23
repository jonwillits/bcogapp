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
    'A spectrogram is a picture of a sound. Time runs from left to right. The left edge is the start of the sound and the right edge is its end. The strip above the picture is the waveform, the air pressure moment by moment, drawn on its own axis. Press “Play” to hear the sound. While the sound plays, a white line will move from left to right over the picture. The line marks the moment you are hearing.',
    'The sound on this screen is the vowel ‹ah›, made by a synthesizer at a pitch of 120 Hz. It lasts 0.6 seconds. The same sound is on the first four screens.',
  ],
  frequency: [
    'Frequency runs from bottom to top. A sound’s frequency is how many times a second its sound wave repeats. Frequency is measured in hertz, written Hz. A sound at 100 Hz repeats 100 times a second, and a sound at 1,000 Hz repeats a thousand times a second. The numbers up the left side mark 0 to 5,000 Hz. Most of what makes one speech sound different from another lies below 5,000 Hz.',
  ],
  energy: [
    'Brightness shows energy. The brighter a point, the more energy the sound has at that time and that frequency. The dark background is silence, or nearly silence. A speech sound is not one frequency but many at once, with more energy at some frequencies than at others. The picture shows which frequencies have the most energy at each moment.',
    'Printed spectrograms, including the reading’s figures, are the other way around: the background is white, and more energy is drawn darker.',
  ],
  patterns: [
    'There are two ways we can view the same sound, and each shows a different kind of pattern. In “Narrow bands” you see thin, evenly spaced horizontal lines. These lines are the harmonics of the voice. The lowest line is the pitch: the rate at which the vocal folds vibrate. The lines above it lie at two, three, four times the pitch, and so on. A voice at 120 Hz has harmonics at 120, 240, 360 Hz and up.',
    'In “Wide bands” the harmonics blur together and you see broad bright bands instead. These bands are the formants: the frequencies at which the throat and mouth resonate, as a bottle resonates at one note when you blow over it. The formants are what make one vowel sound different from another. They are counted from the bottom: the first formant, the second, the third. Switch between the two views with the buttons above the picture; the line beside them says which view is showing.',
  ],
  pitch: [
    'Here is the same vowel, ‹ah›, made twice by the synthesizer: once at a pitch of 100 Hz and once at 200 Hz. Every formant is set to the same frequencies both times. The question above is: when the pitch goes up, what moves on the spectrogram, the harmonics, the formants, both, or neither? Choose a prediction and press “Commit my prediction”.',
    'Once you commit your prediction, the two spectrograms appear side by side in the narrow-band view. Dashed lines mark the first two formants at the frequencies the synthesizer was set to.',
  ],
  voice: [
    'Here is the same vowel at the same pitch, 100 Hz, made twice by the synthesizer. The first sound has the formants of the earlier screens. The second has every formant raised by 15%, which is the change a throat and mouth about 13% shorter would make. The first two formants are marked at their set frequencies in both pictures. Look at what moves between the two pictures and what does not: the formant marks, or the spacing of the harmonics.',
  ],
  vowels: [
    'Here are three vowels at one pitch, 120 Hz: ‹ee› as in ‹see›, ‹ah› as in ‹father›, and ‹oo› as in ‹who›. Each has its first two formants marked at the synthesizer’s settings. The plot under them is a vowel map: each vowel is placed by its second formant, left to right, and by its first formant, up and down. The axes are turned to match the reading’s figure of monkey and human vowels (§13.1.6): the first formant increases downward and the second increases leftward.',
  ],
}

export const TOUR_RIGHT: Record<TourScreen, string> = {
  time: 'The sound was made by a computer. Every number marked on this screen is a setting of the synthesizer that made it, not a measurement.',
  frequency: 'A piano’s middle C is about 262 Hz; the highest note on a piano is about 4,186 Hz. Speech has energy over this whole range and above it.',
  energy: 'The picture is computed from the sound by a standard method, the short-time Fourier transform: the sound is cut into short pieces, and the energy at each frequency is measured in each piece.',
  patterns: 'In the narrow-band view each piece of sound is 25 milliseconds long, long enough for the harmonics to show as separate lines. In the wide-band view each piece is 5 milliseconds long, too short for that, so the harmonics blur into the formants.',
  pitch: 'The formants were set to 700, 1,200, 2,600, and 3,400 Hz in both sounds. Only the pitch differs.',
  voice: 'The formants were set to 700, 1,200, 2,600, and 3,400 Hz in one sound and to 805, 1,380, 2,990, and 3,910 Hz in the other. The pitch is 100 Hz in both.',
  vowels: 'The formants were set to ‹ee› 300 and 2,300 Hz, ‹ah› 700 and 1,200 Hz, and ‹oo› 320 and 850 Hz. These are round values from the range of English vowels, chosen for the synthesizer, not measured from a talker.',
}

/** What the view line says on the first three screens, where the view is fixed, and on the rest (Jon, 2026-11-16: a switch that changes the picture but not the sound confuses before it is explained). */
export const VIEW_FIXED_LINE = 'This is the wide-band view. You will see a second view of the same sound on screen 4.'

export const STEP2_PANEL = [
  'Each of the six spectrograms is the picture of one syllable, made by a text-to-speech program in one voice, voice 1. Each syllable begins with ‹b› or ‹d› and ends in ‹ee›, ‹ah›, or ‹oo›. Press “Play” under a spectrogram to hear its syllable, as often as you like.',
  'Label each syllable by what you hear: press “b” or “d” under its spectrogram. You can change a label until you press “Commit my labels”. Until then, nothing on this screen says which syllable is which.',
]

export const STEP3_PANEL = [
  'Each sound in this step is synthetic: a short syllable made by the synthesizer from two formants only. The first formant is the same in every sound. The second formant differs from sound to sound in one setting of the synthesizer. There are 9 sounds. They play in an order drawn for you, and nothing on the screen says which sound is playing.',
  'In block 1 you give a label for each sound. In block 2 you say which of two sounds a third one matched. Answer by what you hear. No answer is shown as right or wrong.',
]

/** The screen before block 1, with Start block 1 (Jon, 2026-11-16: each block's instructions right before it). */
export const BLOCK1_SCREEN = [
  'Block 1 has 54 trials and takes about 3 minutes. On each trial you hear one short syllable three times in a row, half a second apart. Then two buttons appear, “B” and “D”. Press the button for the consonant you heard, or press the key B or D. The next trial starts 800 milliseconds after your answer.',
  'There are 9 different sounds. Each one plays on 6 of the 54 trials, in an order drawn for you. No answer is marked right or wrong, and there is no feedback. Some sounds will be hard to label. Answer by what you hear, and if you cannot tell, pick one label anyway.',
  'The block runs in real time. If you leave the page partway, the block starts again from its first trial. Press “Start block 1” when you are ready.',
]

/** The screen between the blocks, with Start block 2. */
export const BLOCK2_SCREEN = [
  'Block 1, labeling, is done and saved.',
  'Block 2 has 28 trials and takes about 2 minutes. On each trial you hear three sounds, one second apart. The first two are different from each other. The third is the same as one of the first two, and your task is to say which. After the third sound, press “3rd sounds like the 1st” or “3rd sounds like the 2nd”, or the key 1 or 2.',
  'Many trials will feel like guessing, because the two sounds are often very similar. That is expected. When you cannot tell, guess.',
  'The block runs in real time. If you leave the page partway, the block starts again from its first trial. Block 2 starts only when you press “Start block 2”.',
]

export const STEP4_PANEL = [
  'The network takes in 400 numbers for each syllable. The numbers come from a patch of the syllable’s spectrogram: 40 frequency bands from 0 to 5,000 Hz, by 10 frames of 10 milliseconds, starting 20 milliseconds before the consonant’s release, the moment the consonant opens into the vowel. Each number is the energy in one band in one frame. Each is scaled from 0, at 60 decibels below the loudest point of the patch, to 1, at the loudest point. The patch is cut from the same spectrogram you see.',
  'The 400 inputs connect to 12 hidden units. Each hidden unit computes a weighted sum of its inputs, adds its own baseline, and uses an activation function, an S-shaped curve, to turn the sum into a value between 0 and 1, as the units of Modules 4 and 7 do. The 12 hidden units connect to 3 output units, one for each label. Each output unit computes the same way. The network’s label for a syllable is the output with the largest value.',
  'The weights start as small random numbers. They change using the learning rule of Module 7. For each training syllable, each output is compared with its target: 1 for the right label, 0 for the other two. The difference is the error. The error is passed back through the connections to the hidden units, scaled by each unit’s slope. Every weight then changes in proportion to its input and to the error passed back to it. One pass through the training syllables changes every weight once per syllable; the network makes 12 passes.',
  'The training syllables are ‹b›, ‹d›, and ‹g› before five vowels: ‹ee›, ‹ay›, ‹ah›, ‹oh›, and ‹oo›. A text-to-speech program made them in 12 voices, each voice at its own pitch and at two shifted pitches, 3 semitones down and 3 semitones up; a semitone is one step from one piano key to the next. That makes 540 syllables in all. In run 1, voices 11 and 12 are held out of training, and the network is tested on them, to see whether what it learned generalizes to new voices. The network never receives a voice’s number, a pitch, or a vowel, only the 400 numbers.',
  'The network is trained on three labels, ‹b›, ‹d›, and ‹g›, although Steps 2 and 3 used ‹b› and ‹d› only. ‹b›, ‹d›, and ‹g› are the three voiced stop consonants of English: consonants made by closing the mouth and then releasing the air. ‹g› is made with the tongue further back in the mouth, as in ‹go›. The network is trained on all three so that in run 3 its label for a synthetic sound can be any of the three.',
]
