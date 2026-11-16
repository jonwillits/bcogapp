/**
 * Part 2's panel texts beyond the instruction screens: the learners'
 * explanations, the prediction questions, and the lines shown only after
 * Step 1's commit (which may name the six words and the transitional
 * probability). `store.ts` holds none of these, since it is read before the
 * commit (`naming.test.ts`).
 */

export const SIX_WORDS_LINE = 'The language is made up. It has six words and no meanings.'

export const STEP1_AFTER_COMMIT = [
  'The language has six words, each of three syllables: babupu, bupada, dutaba, patubi, pidabu, tutibu. The minute you heard was 72 words in a row, in a random order in which no word came twice in a row, with no pause between them.',
  'Two replays are now available. “Play again, with the words marked” plays the same minute; above the spectrogram, a strip of syllables fills in as the sound plays, and each word lights up in its own color as it is heard. Thin lines mark the word boundaries on the spectrogram. The sound itself shows nothing at those lines: every syllable is the same length, the same loudness, and the same pitch wherever it falls.',
  '“Play again, with each word’s last syllable lengthened” plays the same 72 words with the vowel of every word’s last syllable lengthened by 100 milliseconds.',
]

export const PREDICTION_QUESTIONS = {
  partwords: { key: 'p2-s3-partwords', question: 'The test has two versions: each word against a nonword, a string of syllables from the language in an order never heard, or against a part-word, a string made of two syllables of a word plus one more. Will the part-word test be harder for the learners than the nonword test?', choices: ['harder', 'about the same', 'easier'] },
  reach76: { key: 'p2-s3-reach76', question: 'The adults in the original experiment scored 76% against nonwords after 21 minutes. At which amount of listening will the first learner, cut at the dips, first reach 76% against nonwords?', choices: ['30 seconds', '1 minute', '2 minutes', '4 minutes or more'] },
  least: { key: 'p2-s3-least', question: 'Which of the learners will need the least listening to reach 76% against nonwords?', choices: ['cut at the dips', 'the simple recurrent network', 'they will tie'] },
} as const

export const LEARNER_NAMES = { dips: 'Cut at the dips', srn: 'A simple recurrent network', parser: 'PARSER' } as const

export const LEARNER_TEXT: Record<keyof typeof LEARNER_NAMES, string[]> = {
  dips: [
    'This learner counts. For every pair of neighboring syllables it takes in, it adds one to a count for that pair, and for every syllable it adds one to a count for that syllable. From the counts it computes the transitional probability from each syllable to the next: the count of the pair divided by the count of the first syllable (§13.2.3). For example, if pa occurs 30 times and pa is followed by tu 25 of those times, the transitional probability from pa to tu is 25 divided by 30, 0.83.',
    'It places a cut wherever the transitional probability is lower than at both neighboring pairs: a dip. On the test, its score for a three-syllable string is the mean of the string’s two transitional probabilities, and its choice is the string with the higher score. It stores the counts and nothing else: it is never given the words.',
  ],
  srn: [
    'This learner is a simple recurrent network (§13.2.9). It takes in one syllable at a time, coded as one of 12 inputs, together with a copy of its own 12 hidden units’ activity from the syllable before, which is its context. Its 12 outputs are compared with the code of the next syllable, and the difference is passed back through the connections to move the weights, by the rule of Module 7: the network is trained to predict the next syllable, one pass through the stream, and the stream itself supplies the target.',
    'On the test, its score for a three-syllable string is minus its mean prediction error on the string’s second and third syllables: the string is fed in with the context reset to its starting value, and at each of the two later syllables the error is the sum over the 12 outputs of the squared difference between the output and the syllable’s code. Lower error is more word-like. Scoring moves no weight. It stores its weights and nothing else: it is never given the words.',
  ],
  parser: ['PARSER (Perruchet and Vinter, 1998) is the third learner the lab plans. Its parameters come from the paper, which is not yet in the course library, so it is not built: the panel reads Reference pending.'],
}

export const STEP3_PANEL = [
  'Each learner takes in the first so many syllables of your stream, the same stream Step 1 plays, and then takes the test. The slider sets how many: 30 seconds, 1, 2, 4, 7, 14, or 21 minutes of the language, which is 108, 216, 432, 864, 1,512, 3,024, or 4,536 syllables at 216 a minute. The same is done on 19 other streams of the same language, drawn from other seeds, and the plot shades the range over the 20 streams.',
  'The test is the original experiment’s (Saffran, Newport, and Aslin, 1996, p. 613), in two versions of 36 trials. In the nonword version, each of the six words is paired once with each of six nonwords: strings of three syllables from the language in an order that never occurs in any stream. In the part-word version, each word is paired once with each of six part-words: a word’s first two syllables plus another syllable, or a word’s last two plus another. On each trial the learner’s choice is the string with the higher score by its own rule; a tie is settled by the seeded stream. The score is the percentage of 36 trials on which the learner chose the word.',
]

export const STEP4_PANEL = [
  'The sample: every utterance spoken by someone other than the child, in every transcript whose child was under 3 years old, from the CHILDES corpora of English spoken in North America. Each word was turned into syllables by a pronouncing dictionary, so the syllables are the dictionary’s, not the speakers’.',
  'Above each pair of neighboring syllables is the transitional probability from the first to the second, computed over the whole sample: the count of the pair divided by the count of the first syllable, inside words and across the gaps between words alike. The marks under the strip are the true word boundaries.',
]
