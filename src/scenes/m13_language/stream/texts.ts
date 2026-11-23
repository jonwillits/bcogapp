/**
 * Part 2's panel texts beyond the instruction screens: the learners'
 * explanations, the prediction questions, and the lines shown only once
 * Step 2's search has ended (which name the six words and the transitional
 * probability; Jon, 2026-11-21: nothing names a word before the search).
 * `store.ts` holds none of these, since it is read before Step 1's commit
 * (`naming.test.ts`).
 */

export const SIX_WORDS_LINE = 'The language is made up. It has six words and no meanings.'

/** The replays' paragraphs, at the end of Step 2 once every word is found or shown. */
export const REPLAYS_TEXT = [
  'The language has six words, each of three syllables: “babupu”, “bupada”, “dutaba”, “patubi”, “pidabu”, “tutibu”. The minute you heard in Step 1 was 72 words in a row, in a random order in which no word came twice in a row, with no pause between them.',
  '“Play again, with the words marked” plays that minute again, now with its spectrogram, the picture of the sound from Part 1. The spectrogram scrolls under a cursor that marks the moment being played. Above it, a strip of syllables fills in as the sound plays, and each word lights up in its own color as it is heard. Thin lines mark the word boundaries on the spectrogram. The sound itself has nothing at those lines: every syllable has the same length, the same loudness, and the same pitch wherever it falls.',
  '“Play again, with each word’s last syllable lengthened” plays the same 72 words with the vowel of every word’s last syllable lengthened by 100 milliseconds.',
]

export const PREDICTION_QUESTIONS = {
  partwords: { key: 'p2-s3-partwords', question: 'The test has two versions: each word against a nonword, a string of syllables from the language in an order never heard, or against a part-word, a string made of two syllables of a word plus one more. Will the part-word test be harder for the learners than the nonword test?', choices: ['harder', 'about the same', 'easier'] },
  reach76: { key: 'p2-s3-reach76', question: 'The adults in the original experiment scored 76% against nonwords after 21 minutes. At which amount of listening will the first learner, cut at the dips, first reach 76% against nonwords?', choices: ['30 seconds', '1 minute', '2 minutes', '4 minutes or more'] },
  least: { key: 'p2-s3-least', question: 'Which of the learners will reach 76% against nonwords with the least listening?', choices: ['cut at the dips', 'the simple recurrent network', 'PARSER', 'they will tie'] },
} as const

export const LEARNER_NAMES = { dips: 'Cut at the dips', srn: 'A simple recurrent network', parser: 'PARSER' } as const

/**
 * How each learner works, shown with its drawing at the top of Step 3's
 * panel before anything runs (Jon, 2026-11-21: the explanation comes first,
 * as Part 4's networks have theirs), and how each takes the test, shown
 * under the plot once the first run is done. `LEARNER_TEXT` joins the two
 * for the texts probe.
 */
export const LEARNER_HOW: Record<keyof typeof LEARNER_NAMES, string[]> = {
  dips: [
    'This learner counts. For every pair of neighboring syllables it takes in, it adds one to a count for that pair, and for every syllable it adds one to a count for that syllable. From the counts it computes the transitional probability from each syllable to the next: the count of the pair divided by the count of the first syllable (§13.2.3). For example, if “pa” occurs 30 times and “pa” is followed by “tu” 25 of those times, the transitional probability from “pa” to “tu” is 25 divided by 30, 0.83.',
    'It places a cut wherever the transitional probability is lower than at both neighboring pairs: a dip. It stores the counts and nothing else: it is never given the words.',
  ],
  srn: [
    'This learner is a simple recurrent network (§13.2.9). It takes in one syllable at a time, coded as one of 12 inputs, together with a copy of its own 12 hidden units’ activity from the syllable before, which is its context. Its 12 outputs are compared with the code of the next syllable, and the difference is passed back through the connections to move the weights, by the rule of Module 7: the network is trained to predict the next syllable, one pass through the stream, and the stream itself supplies the target.',
    'Where a word begins, the next syllable is hard to predict from the syllables before it, since any of the other words may follow. Inside a word, the next syllable is fixed. So the network’s error is high at the first syllable of a word and low at the second and the third, and where its error jumps, it has a word boundary. The figure under the drawing shows its error at each of the first 15 syllables of your stream after it has taken in 21 minutes of the stream. It stores its weights and nothing else: it is never given the words.',
  ],
  parser: [
    'This learner is PARSER (Perruchet and Vinter, 1998). It stores units, each with a weight. It starts with the 12 syllables as units, each at a weight of 1. It takes in the stream in small pieces: for each piece, a seeded draw sets how many units the piece covers, 1, 2, or 3. A unit covers the stream where it matches, if its weight is 1 or more; where several match, the longest is used; a syllable on its own always matches.',
    'A piece of 2 or 3 units that is not yet a unit becomes a new unit at a weight of 1, and each unit inside it gains 0.5. A piece that is already a unit gains 0.5, and so does each unit inside it. A piece of one unit adds 0.5 to that unit. After every piece, every unit loses 0.05, and every unit that shares a syllable with the piece loses 0.005 more. A unit whose weight reaches 0 is dropped; the 12 syllables are never dropped. Pieces inside words recur more often than pieces across word boundaries, so the words come to be the strongest units, with no count and no probability. Every number here is the paper’s (pp. 250 to 252). It stores the units and their weights and nothing else: it is never given the words.',
  ],
}

export const LEARNER_TEST: Record<keyof typeof LEARNER_NAMES, string> = {
  dips: 'On the test, its score for a three-syllable string is the mean of the string’s two transitional probabilities, and it chooses the string with the higher score.',
  srn: 'On the test, its score for a three-syllable string is minus its mean prediction error on the string’s second and third syllables: the string is fed in with the context reset to its starting value, and at each of the two later syllables the error is the sum over the 12 outputs of the squared difference between the output and the syllable’s code. Lower error is more word-like. Scoring moves no weight.',
  parser: 'On the test, its score for a three-syllable string is the string’s weight as a unit, or 0 if the string is not a unit, and it chooses the string with the higher score. The paper scored its test by another rule, which you can choose with the control under the table: the word is chosen if it is a unit with a weight above 1, and otherwise the choice is random (p. 256).',
}

export const LEARNER_TEXT: Record<keyof typeof LEARNER_NAMES, string[]> = {
  dips: [...LEARNER_HOW.dips, LEARNER_TEST.dips],
  srn: [...LEARNER_HOW.srn, LEARNER_TEST.srn],
  parser: [...LEARNER_HOW.parser, LEARNER_TEST.parser],
}

/** PARSER's two test rules on the control under the table: the spec's (§6.3) is the default. */
export const PARSER_RULE_NAMES = { spec: 'Higher weight wins', paper: 'Known word wins, else random' } as const

export const PARSER_RULE_LINES = [
  'Under “Higher weight wins”, PARSER’s choice on each trial is the string with the higher weight as a unit, 0 for a string that is not a unit. Under “Known word wins, else random”, the paper’s rule, the word is chosen if it is a unit with a weight above 1, and otherwise the choice is random. Both rules score the same units from the same run; switching changes PARSER’s lines and rows and nothing else.',
  'The two rules give different scores at the shorter amounts, from one store of units: a detail of how a test is scored changes the result.',
]

/** What the people of the original experiments did, at the top of Step 3's panel (Jon, 2026-11-21: the performance first, then the explanations and what counts as success, then the learners). The numbers are the reference entries' (`references.ts`, saffran-adults and saffran-infants). */
export const PEOPLE_TEXT = [
  'In the original experiment (Saffran, Newport, and Aslin, 1996), adults listened to 21 minutes of a stream like the one you heard, in three blocks of seven minutes, and then took a test of 36 trials in two versions. On each trial they heard two strings of three syllables, a word of the language and a foil, and said which was a word. Against nonwords, strings of the language’s syllables in an order that never occurred in the stream, they chose the word on 76% of the trials. Against part-words, a word’s first two syllables plus another syllable or its last two plus another, they chose the word on 65%.',
  'Eight-month-old infants (Saffran, Aslin, and Newport, 1996) heard 2 minutes of a stream of the same kind. An infant cannot choose between two strings, so each was measured by how long it listened to a test item: the infants listened longer to the nonwords and the part-words than to the words (8.85 seconds against 7.97, and 7.60 against 6.77). After 2 minutes, the words had become familiar.',
]

export const EXPLANATIONS_TEXT = [
  'The people learned the words from nothing but the order of the syllables: the stream has no pause, no stress, and no change of pitch at a boundary. The three learners below are three explanations of what people compute from that order: counts of which syllable follows which (cut at the dips); a prediction of the next syllable, with the places where the prediction fails (a simple recurrent network); or a store of the pieces that recur, each gaining strength as it recurs (PARSER). Each learner takes in the same stream you heard and then takes the adults’ test.',
  'A learner succeeds as an explanation of the people if it does what they did with what they had: it tells the words from the nonwords and from the part-words after 21 minutes of the stream at about the adults’ 76% and 65%, and it tells them apart in some degree after the infants’ 2 minutes. A learner that reaches the adults’ scores only with far more of the stream, or that scores the same on both tests where the adults did not, fails as an account of the adults, however well it finds the words.',
]

/** Under the results: the questions the student answers from the plot and the table (Jon, 2026-11-21: show the results and ask them to interpret). Nothing is scored. */
export const INTERPRET_QUESTIONS = [
  'Which learners reached the adults’ 76% against nonwords and 65% against part-words, and with how much of the stream?',
  'Which learners told the words from the foils after the infants’ 2 minutes?',
  'Which test was harder for each learner, and was it the one the adults found harder?',
  'Which of the three explanations, if any, does what the people did with what the people had? What would you change in the others?',
]

export const STEP3_PANEL = [
  'Each learner takes in the first so many syllables of your stream, the same stream Step 1 plays, and then takes the test. One press of “Run the learners” does this at every amount in turn: nothing at all, then 30 seconds, then every minute from 1 to 21 minutes of the language, at 216 syllables a minute, 4,536 syllables at 21 minutes. The same is done on 19 other streams of the same language, drawn from other seeds, and the plot shades the 95% confidence interval of the mean over the 20 streams. The plot fills in as each amount is done.',
  'The test is the original experiment’s (Saffran, Newport, and Aslin, 1996, p. 613), in two versions of 36 trials. In the nonword version, each of the six words is paired once with each of six nonwords: strings of three syllables from the language in an order that never occurs in any stream. In the part-word version, each word is paired once with each of six part-words: a word’s first two syllables plus another syllable, or a word’s last two plus another. On each trial the learner chooses the string with the higher score by its own rule; a tie is settled by a coin toss fixed by the seed. The score is the percentage of 36 trials on which the learner chose the word.',
]

export const STEP4_PANEL = [
  'The sample: every utterance spoken by someone other than the child, in every transcript whose child was under 3 years old, from the CHILDES corpora of English spoken in North America. Each word was turned into syllables by a pronouncing dictionary, so the syllables are the dictionary’s, not the speakers’.',
  'Above each pair of neighboring syllables is the transitional probability from the first to the second, computed over the whole sample: the count of the pair divided by the count of the first syllable, inside words and across the gaps between words alike. The marks under the strip are the true word boundaries.',
]
