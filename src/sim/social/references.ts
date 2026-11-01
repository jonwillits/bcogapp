/**
 * Every number on screen that the scene does not compute comes from the
 * chapter or from a source in the library, checked against the page, and
 * is listed here (spec §11; the build prompt: reference values come from
 * sources, never from memory). An entry whose `values` is null is pending
 * until its source is in the library, and its panel line reads *Reference
 * pending*. The walk-through lists every pending entry.
 */

export interface Reference {
  id: string
  title: string
  /** The source, as a short citation. */
  source: string
  /** The section, figure, table or page the values come from. */
  where: string
  values: { label: string; value: number | string }[] | null
  /** How the source's procedure differed from this lab's, in one line. */
  differed: string
}

export const REFERENCES: Reference[] = [
  {
    id: 'heider1944',
    title: 'The 1944 film',
    source: 'Heider and Simmel (1944), as the reading reports it (§11.2.2)',
    where: '§11.2.2 of the reading; heider_1944 pp. 246–252',
    values: [
      { label: 'viewers who described the large triangle as aggressive or a bully, told to see persons', value: '97%' },
      { label: 'viewers who described the disc as hiding in the house, told to see persons', value: '92%' },
      { label: 'viewers of the reversed film who still saw people acting', value: 'all but two of 44' },
    ],
    differed: 'The 1944 viewers saw a different film, twice, and wrote freely; one person’s ratings here are one person’s.',
  },
  {
    id: 'baker2009',
    title: 'Adults judging where a dot is heading',
    source: 'Baker, Saxe and Tenenbaum (2009), as the reading reports it (§11.2.2)',
    where: '§11.2.2 of the reading; baker_2009 Table 1, p. 338',
    values: [
      { label: 'correlation of inverse planning with people’s judgments', value: 0.97 },
      { label: 'correlation of the “last moved toward” rule with people’s judgments', value: 0.96 },
    ],
    differed: 'Their 16 adults judged 99 stimuli on a 17 × 9 grid, with a nine-point scale; these paths are a different set, and the correlations here are over one person’s judgments.',
  },
  {
    id: 'axelrod1981-rounds',
    title: 'The length of Axelrod’s matches',
    source: 'Axelrod and Hamilton (1981)',
    where: 'axelrod_1981 p. 1393: the first tournament’s matches were 200 moves; the second’s length was uncertain, with an expected 200',
    values: [{ label: 'rounds per match in the first tournament', value: 200 }],
    differed: 'His entries were programs sent in by game theorists and hobbyists; these are six rules and a predictor.',
  },
  {
    id: 'axelrod1980-elaborate',
    title: 'How the more elaborate entries fared',
    source: 'Axelrod (1980), Effective choice in the Prisoner’s Dilemma; More effective choice in the Prisoner’s Dilemma',
    where: 'not in the library (spec §11, to request)',
    values: null,
    differed: 'The claim that entries which modeled their opponents did worse than tit-for-tat is to be confirmed from the source before the handout relies on it.',
  },
  {
    id: 'riemer2025',
    title: 'Language models in repeated games',
    source: 'Riemer et al. (2025), as the reading reports it (§11.2.8)',
    where: '§11.2.8 of the reading; the source is not in the library (spec §11, to request)',
    values: [{ label: 'the reading’s account', value: 'predicted simple partners’ moves well, but did not choose the moves that would have gained the most' }],
    differed: 'Their players were language models answering in text; here the player is you, and then a program with counts.',
  },
  {
    id: 'tajfel1963',
    title: 'Labeled lines',
    source: 'Tajfel and Wilkes (1963), Classification and quantitative judgement',
    where: 'not in the library (spec §11, to request)',
    values: null,
    differed: 'Their items were eight lines, judged in centimeters, with the four shorter labeled A and the four longer B; here, the members of two invented groups.',
  },
  {
    id: 'catmur2007',
    title: 'The human counter-mirror result',
    source: 'Catmur, Walsh and Heyes (2007), as the reading reports it (§11.3.5)',
    where: '§11.3.5 of the reading; cook_2014 pdf p. 33',
    values: [{ label: 'training to make one finger movement while watching the opposite movement', value: 'about 90 minutes' }],
    differed: 'Measured in the muscles of people, not in recorded cells; these are model cells.',
  },
  {
    id: 'mirror-share',
    title: 'How many recorded cells were mirror neurons',
    source: 'As the reading reports it (§11.3.5)',
    where: '§11.3.5 of the reading',
    values: [
      { label: 'in the first study', value: 'fewer than 10%' },
      { label: 'in another', value: '17%' },
    ],
    differed: 'This scene records two model cells, both of which can be made to mirror.',
  },
  {
    id: 'cycle-sources',
    title: 'The cycle',
    source: 'Boyd and Lorberbaum (1987); Imhof, Fudenberg and Nowak (2005); Nowak and May (1992); Nowak and Sigmund (1993)',
    where: 'not in the library (spec §11, to request)',
    values: null,
    differed: 'The grid’s results come from this engine; the sources are for the handout’s account of why no pure strategy is stable.',
  },
]

export const referenceById = (id: string): Reference => REFERENCES.find((r) => r.id === id)!
export const PENDING_REFERENCE_LINE = 'Reference pending: the source is not yet in the course library, so no number is shown.'
