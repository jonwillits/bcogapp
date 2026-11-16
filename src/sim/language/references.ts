/**
 * Every number on screen that the scene does not compute comes from the
 * chapter, or from a source in the library checked against the page, and
 * is listed here (spec §4.3, §9; LAB_COMMON_FEATURES §6). An entry whose
 * `values` is null is pending until its source is in the library, and its
 * panel reads *Reference pending* with what appears once it is added. No
 * simulated class appears in this lab (decision 15); the slot for this
 * term's class is `CLASS_SLOT`, empty.
 */

export interface Reference {
  id: string
  title: string
  source: string
  where: string
  values: { label: string; value: number | string }[] | null
  /** What appears once a pending source is added, or how the source's procedure differed from this lab's. */
  note: string
}

export const PENDING_REFERENCE_LINE = 'Reference pending: this value appears once its source is added to the course library.'

export const REFERENCES: Reference[] = [
  {
    id: 'liberman-listener',
    title: 'One listener from 1957',
    source: 'Liberman, Harris, Hoffman, and Griffith (1957), as the reading’s figure redraws it (§13.2.2)',
    where: 'liberman_1957 Fig. 2, p. 361, listener CD; values read from the page image for the reading’s figure, accurate to about 2 points',
    values: [
      { label: 'labeled b, steps 1 to 14 (%)', value: '100 100 94 31 0 0 0 0 0 0 0 0 0 0' },
      { label: 'labeled d, steps 1 to 14 (%)', value: '0 0 6 69 100 100 100 100 83 22 4 0 0 0' },
      { label: 'labeled g, steps 1 to 14 (%)', value: '0 0 0 0 0 0 0 0 17 78 96 100 100 100' },
      { label: 'told apart, pairs two steps apart, at middle steps 2 to 13 (%)', value: '55 82 100 79 54 53 87 100 85 93 82 91' },
      { label: 'predicted from the labels, the same pairs (%)', value: '50 73 93 55 49 48 49 79 82 52 50 50' },
    ],
    note: 'The listener labeled each step 32 times and judged each pair 42 times, over many sessions; this step gives 6 labels per step and 4 triads per pair in one sitting.',
  },
  {
    id: 'liberman-pairs',
    title: 'The two example pairs',
    source: 'Liberman et al. (1957)',
    where: 'liberman_1957 p. 362',
    values: [
      { label: 'stimuli 1 and 3, both heard as b, told apart', value: '55%' },
      { label: 'stimuli 3 and 5, heard as b and d, told apart', value: '100%' },
    ],
    note: 'The same listener, CD.',
  },
  {
    id: 'liberman-prediction',
    title: 'What the 1957 paper found about prediction',
    source: 'Liberman et al. (1957)',
    where: 'liberman_1957 pp. 362–363 (the formula) and p. 366 (the finding)',
    values: [
      { label: 'predicted against obtained, two-step pairs, Kendall’s tau over listeners', value: '+.43' },
      { label: 'the finding', value: 'the predicted peaks fell in the right places, but listeners discriminated better than the labels alone predict' },
    ],
    note: 'The formula is averaged over the ABA and ABB orders; the scan prints its constant as .5 where the paper’s own derivation gives 2, and this lab uses the derivation (LAB_13_STIMULI.md §11).',
  },
  {
    id: 'saffran-adults',
    title: 'The adults after 21 minutes',
    source: 'Saffran, Newport, and Aslin (1996), Experiment 1',
    where: '1-s2.0-S0749596X96900327-main.pdf, p. 613 (N = 12 per test)',
    values: [
      { label: 'words against nonwords, mean score of 36', value: '27.2 (76%)' },
      { label: 'words against part-words, mean score of 36', value: '22.3 (65%)' },
    ],
    note: 'Three blocks of seven minutes with breaks; a two-alternative test on tape; the 500 ms between the two strings of a trial is the paper’s.',
  },
  {
    id: 'saffran-high-low',
    title: 'Words with high and low transitional probabilities',
    source: 'Saffran, Newport, and Aslin (1996), Experiment 1',
    where: 'p. 614 and footnote 3',
    values: [
      { label: 'the three words with the highest average transitional probabilities (1.0, .75, .75)', value: '79%' },
      { label: 'the three with the lowest (.5, .41, .37)', value: '72%' },
    ],
    note: 'The averages are the paper’s, computed as the mean of a word’s two internal transitions; the table from a student’s own stream differs a little.',
  },
  {
    id: 'saffran-lengthening',
    title: 'Lengthening the vowel',
    source: 'Saffran, Newport, and Aslin (1996), Experiment 2',
    where: 'pp. 616–617 (N = 8 per condition)',
    values: [
      { label: 'final syllable lengthened by 100 ms in three of six words', value: '80%' },
      { label: 'first syllable lengthened', value: '61%' },
      { label: 'no lengthening', value: '65%' },
    ],
    note: 'In a language with m and n in place of b and d, tested against nonwords; this demonstration lengthens all six words.',
  },
  {
    id: 'saffran-infants',
    title: 'The infants after 2 minutes',
    source: 'Saffran, Aslin, and Newport (1996), as the reading reports it (§13.2.3)',
    where: 'saffran_1996 p. 1927, Table 1 (N = 24 per experiment)',
    values: [
      { label: 'listening time to words against nonwords', value: '7.97 s against 8.85 s' },
      { label: 'listening time to words against part-words', value: '6.77 s against 7.60 s' },
    ],
    note: 'Measured by how long 8-month-olds listened to each test item, not by a choice between two.',
  },
  {
    id: 'elman-1991',
    title: 'The prediction after boys who Mary chases',
    source: 'Elman (1991), as the reading reports it (§13.2.9)',
    where: 'elman_1991 p. 209, Fig. 4f (the text on p. 206 states the number the wrong way round; the figure is right)',
    values: [{ label: 'the network’s prediction after boys who mary chases', value: 'a plural verb' }],
    note: 'A network of 70 hidden units trained in stages on 10,000-sentence corpora; this lab’s networks are smaller and trained in one stage.',
  },
  {
    id: 'elman-1990',
    title: 'Prediction error at word onsets',
    source: 'Elman (1990), as the reading reports it (§13.2.9)',
    where: 'elman_1990 pp. 188–194, Fig. 6',
    values: [{ label: 'in a stream of letters, prediction error', value: 'high at the start of each word, falling as the word proceeds' }],
    note: 'Letters, not syllables; a 15-word lexicon.',
  },
  {
    id: 'lund-1996',
    title: 'The count model',
    source: 'Lund and Burgess (1996), as the reading reports it (§13.2.10)',
    where: 'lund_1996 p. 204 (the window and the weights), p. 205 (nearest neighbors)',
    values: [
      { label: 'window', value: '10 words, weights inversely proportional to distance' },
      { label: 'corpus', value: 'about 160 million words of Usenet text' },
      { label: 'a word’s vector', value: 'its row and its column, joined' },
    ],
    note: 'This corpus has 46,265 tokens; the window here runs from 1 to 8.',
  },
  {
    id: 'mao-2025',
    title: 'A two-layer transformer at small scale',
    source: 'Mao, Huebner, and Willits (2025), as the reading reports it (§13.2.12)',
    where: 'mao_2025 pp. 429–432 and p. 437',
    values: [
      { label: 'the transformer', value: '2 layers, 32 hidden units' },
      { label: 'with one layer, transformer and recurrent networks alike on the hardest test', value: 'about 0.75' },
    ],
    note: 'A different artificial language, built to test generalization; this lab’s transformer has the same scale.',
  },
  { id: 'trueswell-2013', title: 'Propose but verify', source: 'Trueswell, Medina, Hafri, and Gleitman (2013)', where: 'not yet in the library', values: null, note: 'Once added: the design’s counts, the share correct after a wrong choice and after a right one, and any rule of guess and check beyond the one stated here.' },
  { id: 'medina-2011', title: 'How words can and cannot be learned by observation', source: 'Medina, Snedeker, Trueswell, and Gleitman (2011)', where: 'not yet in the library', values: null, note: 'Once added: the share correct after a wrong choice.' },
  { id: 'yu-smith-2007', title: 'Cross-situational learning in adults', source: 'Yu and Smith (2007)', where: 'not yet in the library', values: null, note: 'Once added: adults’ accuracy with 18 words against 9, for the contrast with the tallying account.' },
  { id: 'perruchet-1998', title: 'PARSER', source: 'Perruchet and Vinter (1998)', where: 'not yet in the library', values: null, note: 'Once added: PARSER’s parameters, with their pages, and the third learner in Step 3.' },
  { id: 'bortfeld-2005', title: 'Familiar names help segmentation', source: 'Bortfeld, Morgan, Golinkoff, and Rathbun (2005)', where: 'not yet in the library', values: null, note: 'Once added: the infants’ result with a familiar word in the stream.' },
  { id: 'swingley-2005', title: 'Transitional probabilities in speech to children', source: 'Swingley (2005)', where: 'not yet in the library', values: null, note: 'Once added: a published analysis of transitional probabilities in real speech to children, beside this step’s sample.' },
  { id: 'klatt-1980', title: 'The formant synthesizer', source: 'Klatt (1980)', where: 'not yet in the library', values: null, note: 'Once added: the citation for the synthesizer’s design.' },
  { id: 'macwhinney-2000', title: 'The CHILDES Project', source: 'MacWhinney (2000)', where: 'the citation is taken from TalkBank’s terms; the book is not in the library', values: null, note: 'Once added: the citation’s page.' },
]

export function reference(id: string): Reference {
  const r = REFERENCES.find((x) => x.id === id)
  if (!r) throw new Error(`no reference ${id}`)
  return r
}

/** This term's class: not collected for this lab (decision 15). The line is hidden until Jon adds data. */
export const CLASS_SLOT: { values: null | { label: string; value: number }[]; line: string } = { values: null, line: 'This term’s class results are not collected for this lab.' }
