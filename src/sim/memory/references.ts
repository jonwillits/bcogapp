/**
 * Every reference panel's data, one entry per published result (spec §10;
 * the build prompt's rule: reference numbers come from sources, never from
 * memory). Each entry names its source, the figure or table, the values,
 * and a one-line note on how its procedure differed from the lab's. An
 * entry whose `values` is null is not yet filled from its source, and its
 * panel shows *Reference pending*. Jon adds the sources to the library,
 * and the entries are filled from them, page by page, before the handout
 * is written.
 *
 * Filled so far: Roediger and McDermott (1995), from the copy in the
 * library (`course_creation/input_readings/chapter_and_articles/
 * roediger_1995.pdf`), Table 2 and the text of p. 808; the transcription is
 * in the as-built notes.
 */

export interface Reference {
  id: string
  /** The source, as a short citation. */
  source: string
  /** The figure, table or page the values come from. */
  where: string
  /** The values, labeled, or null while pending. */
  values: { label: string; value: number | string }[] | null
  /** How the source's procedure differed from this lab's, in one line. */
  differed: string
  /** What the panel is for, on screen. */
  title: string
}

export const REFERENCES: Reference[] = [
  {
    id: 'murdock1962',
    title: 'Serial position and list length',
    source: 'Murdock (1962), The serial position effect of free recall',
    where: 'the serial-position curves by list length',
    values: null,
    differed: 'Lists of 10 to 40 words, read aloud at one or two seconds a word, with written recall, over many lists per person.',
  },
  {
    id: 'glanzer1966',
    title: 'A delay before recall',
    source: 'Glanzer and Cunitz (1966), Two storage mechanisms in free recall',
    where: 'the serial-position curves with and without a delay',
    values: null,
    differed: 'Lists of 15 words with a 30-second delay filled by counting, as here; their lists were read aloud.',
  },
  {
    id: 'roediger1995-recall',
    title: 'Recall of the word never presented',
    source: 'Roediger and McDermott (1995), Experiment 2',
    where: 'p. 808, text and Figure 3',
    values: [
      { label: 'critical word recalled, proportion of lists', value: 0.55 },
      { label: 'studied words recalled, proportion', value: 0.62 },
      { label: 'studied words in positions 4 to 11 recalled, proportion', value: 0.47 },
    ],
    differed: 'Sixteen lists of fifteen associates, heard from a tape at about 1.5 seconds a word, with two minutes of written recall after half of them.',
  },
  {
    id: 'roediger1995-table2',
    title: 'Recognition, with remember and know',
    source: 'Roediger and McDermott (1995), Experiment 2',
    where: 'Table 2, p. 808: proportion of old responses, with the remember and know shares',
    values: [
      { label: 'studied words, lists recalled: old', value: 0.79 },
      { label: 'studied words, lists recalled: remember', value: 0.57 },
      { label: 'studied words, lists recalled: know', value: 0.22 },
      { label: 'critical words of recalled lists: old', value: 0.81 },
      { label: 'critical words of recalled lists: remember', value: 0.58 },
      { label: 'critical words of recalled lists: know', value: 0.23 },
      { label: 'critical words of unstudied lists: old', value: 0.16 },
      { label: 'critical words of unstudied lists: remember', value: 0.03 },
      { label: 'critical words of unstudied lists: know', value: 0.13 },
      { label: 'words of unstudied lists: old', value: 0.11 },
      { label: 'words of unstudied lists: remember', value: 0.02 },
      { label: 'words of unstudied lists: know', value: 0.09 },
    ],
    differed: 'Ninety-six test items after sixteen lists; the new words were the words of eight unstudied lists of associates.',
  },
  {
    id: 'warning',
    title: 'Recognition after a warning about the lists',
    source: 'Gallo, Roberts and Seamon (1997); McDermott and Roediger (1998)',
    where: 'false recognition of the critical word by people warned in advance',
    values: null,
    differed: 'Their subjects were told before the lists what the lists were made of and what to look out for.',
  },
  {
    id: 'bower1969',
    title: 'An organized list against a scrambled one',
    source: 'Bower, Clark, Lesgold and Winzenz (1969), Hierarchical retrieval schemes in recall of categorized word lists',
    where: 'words recalled from organized and scrambled presentations',
    values: null,
    differed: 'Several hierarchies at once, longer study, and several study-and-recall trials.',
  },
  {
    id: 'roenker1971',
    title: 'The clustering score',
    source: 'Roenker, Thompson and Brown (1971), Comparison of measures for the estimation of clustering in free recall',
    where: 'the adjusted ratio of clustering',
    values: null,
    differed: 'The source of the formula; it reports no result of its own that this panel shows.',
  },
  {
    id: 'brewer1981',
    title: 'Recognition of things in a room',
    source: 'Brewer and Treyens (1981), Role of schemata in memory for places',
    where: 'recognition of present and absent objects by how well they fit the room',
    values: null,
    differed: 'Their room was an office, and their subjects were not told to study it: they waited in it for 35 seconds, thinking it was a waiting room.',
  },
  {
    id: 'rememberKnow',
    title: 'The remember and know procedure',
    source: 'Tulving (1985); Gardiner (1988); the wording follows Roediger and McDermott (1995), p. 807',
    where: 'the definitions given to subjects',
    values: null,
    differed: 'The on-screen definitions paraphrase the source; the as-built notes give the source’s sentences.',
  },
]

export function referenceById(id: string): Reference {
  const r = REFERENCES.find((x) => x.id === id)
  if (!r) throw new Error(`no reference ${id}`)
  return r
}

export const PENDING_LINE = 'Reference pending: the source is not yet in the course library, so no number is shown.'
