/**
 * Every number on screen that the scene does not compute comes from the
 * chapter, or from a source in the library checked against the page, and is
 * listed here (spec §9; the build prompt: reference values come from
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
    id: 'reflection-1979',
    title: 'The reflection effect, as first reported',
    source: 'Kahneman and Tversky (1979), as the reading reports it (§12.2.5)',
    where: 'kahneman_1979 Table I, p. 268: Problems 3 and 3′ (N = 95), 7 and 7′, 8 and 8′ (N = 66)',
    values: [
      { label: 'chose the sure 3,000 over an 80% chance of 4,000', value: '80%' },
      { label: 'chose an 80% chance of losing 4,000 over a sure loss of 3,000', value: '92%' },
      { label: 'chose a 90% chance of 3,000 over a 45% chance of 6,000', value: '86%' },
      { label: 'chose a 45% chance of losing 6,000 over a 90% chance of losing 3,000', value: '92%' },
      { label: 'chose a 0.1% chance of 6,000 over a 0.2% chance of 3,000', value: '73%' },
      { label: 'chose a 0.2% chance of losing 3,000 over a 0.1% chance of losing 6,000', value: '70%' },
    ],
    differed: 'Hypothetical choices in Israeli pounds by students and faculty, a dozen problems to a booklet; the same numbers are given here as dollars.',
  },
  {
    id: 'reflection-2020',
    title: 'The replication in 19 countries',
    source: 'Ruggeri et al. (2020), as the reading reports it (§12.2.5)',
    where: 'ruggeri_2020 pp. 624–627: 4,098 people; items 3 and 7 (the sure-loss pair) replicated in every country; items 5 and 9 (pair 3) in every country; items 6 and 10 (pair 4) in 84% of countries; the reflection effect’s combined replication rate 73%. The pooled shares are shown only in Fig. 1a.',
    values: [
      { label: 'people, in 19 countries', value: 4098 },
      { label: 'pair 1 (the sure loss) replicated in', value: 'every country' },
      { label: 'pair 3 (90% against 45%) replicated in', value: 'every country' },
      { label: 'pair 4 (0.2% against 0.1%) replicated in', value: '84% of countries' },
      { label: 'the reflection effect’s combined replication rate', value: '73%' },
    ],
    differed: 'Online, with amounts rescaled to each country’s median income (for the United States, twice the 1979 numbers); the pooled share per item is given only graphically, so it is not quoted here.',
  },
  {
    id: 'pair2-1981',
    title: 'Pair 2: the sure $240 and the sure loss of $750',
    source: 'Tversky and Kahneman (1981), Problem 3; the gain version is the reading’s table (§12.1.1)',
    where: 'tversky_1981 p. 454 (N = 150)',
    values: [
      { label: 'chose the sure $240 over a 25% chance of $1,000', value: '84%' },
      { label: 'chose a 75% chance of losing $1,000 over a sure loss of $750', value: '87%' },
    ],
    differed: 'Their respondents chose the two decisions together, as one problem; here the two versions are separated by other items.',
  },
  {
    id: 'framing-1981',
    title: 'The disease problem',
    source: 'Tversky and Kahneman (1981), as the reading reports it (§12.2.5)',
    where: 'tversky_1981 p. 453: Problem 1 (N = 152) and Problem 2 (N = 155)',
    values: [
      { label: 'chose the certain program when the outcomes were described as lives saved', value: '72%' },
      { label: 'chose the certain program when the outcomes were described as deaths', value: '22%' },
    ],
    differed: 'Students in classrooms, with a place name on the disease that the reading and this lab leave out.',
  },
  {
    id: 'anchor-1974',
    title: 'The wheel of fortune',
    source: 'Tversky and Kahneman (1974), as the reading reports it (§12.2.5)',
    where: 'tversky_1974 p. 1128',
    values: [
      { label: 'median estimate of the percentage of African countries in the United Nations after the wheel stopped at 10', value: 25 },
      { label: 'median estimate after the wheel stopped at 65', value: 45 },
    ],
    differed: 'Their wheel was a real wheel in the room; payoffs for accuracy did not reduce the effect. No spread between people is reported, so no simulated class is drawn.',
  },
  {
    id: 'loss-ratio-huys',
    title: 'Sensitivity to losses against gains, in a different task',
    source: 'Huys et al. (2012)',
    where: 'huys_2012 pp. 6–7: participants were about 1.4 times as sensitive to punishments as to rewards',
    values: [{ label: 'fitted sensitivity to a loss, relative to a gain of the same size', value: 1.4 }],
    differed: 'A fitted parameter of a model of a sequential task with learned outcomes, not a choice among mixed gambles.',
  },
  {
    id: 'loss-ratio-1992',
    title: 'The median loss-aversion parameter',
    source: 'Tversky and Kahneman (1992), Advances in prospect theory',
    where: 'tversky_1992 p. 305 (the subjects) and p. 311 (the parameters, fitted to each subject’s certainty equivalents and reported as medians)',
    values: [
      { label: 'median loss-aversion parameter λ', value: 2.25 },
      { label: 'median exponent of the value function, the same for gains and losses', value: 0.88 },
      { label: 'subjects: graduate students from Berkeley and Stanford, paid $25', value: 25 },
    ],
    differed: 'Their parameters were fitted to certainty equivalents of risky prospects, over three one-hour sessions; the loss ratio here is one point of indifference between a sure $50 and a mixed gamble. They report medians only, with no spread between people, so no class is simulated from them.',
  },
  {
    id: 'kidd-2013',
    title: 'Waiting after kept and broken promises',
    source: 'Kidd, Palmeri and Aslin (2013), as the reading reports it (§12.2.6)',
    where: 'kidd_2013 p. 112: 3 min 2 s against 12 min 2 s, 14 children in each condition',
    values: [
      { label: 'mean wait, children whose experimenter had broken her promises', value: 'about 3 minutes' },
      { label: 'mean wait, children whose experimenter had kept them', value: 'about 12 minutes' },
      { label: 'children in each condition', value: 14 },
    ],
    differed: 'Preschoolers waiting for a second marshmallow, once, with a 15-minute limit; here, points from a dispenser over many short trials.',
  },
  {
    id: 'mcguire-kable-2012',
    title: 'The design the dispensers are a version of',
    source: 'McGuire and Kable (2012), Decision makers calibrate behavioral persistence on the basis of time-interval experience',
    where: 'mcguire_2012 pp. 218–220 (Experiment 1: participants, the 15¢ and 1¢ task, the two delay distributions, the survival analysis) and pp. 221–223 (Experiment 2)',
    values: [
      { label: 'Experiment 1: participants, recruited in a shopping mall, 20 to a group', value: 40 },
      { label: 'the wait on each trial, for 10 minutes', value: '15¢ after a random delay, or 1¢ at once' },
      { label: 'uniform delays, 0 to 12 s, where waiting always paid: median persistence (area under the waiting curve)', value: '9.74 s' },
      { label: 'heavy-tailed delays, truncated at 90 s, where the best policy was to quit at 2.13 s: median persistence', value: '3.14 s' },
      { label: 'Experiment 2: university participants, 16 to a group; median persistence with uniform delays, against heavy-tailed', value: '7.77 s against 3.83 s' },
    ],
    differed: 'Each of their participants met one distribution of delays, uniform or heavy-tailed, and could take 1¢ at any moment; here one student meets both dispensers in turn, one that always delivers and one that delivers on half its trials, for points.',
  },
  {
    id: 'discounting-sources',
    title: 'Discounting curves and the reversal of preference',
    source: 'Kirby and Herrnstein (1995); Green, Fristoe and Myerson (1994); Green and Myerson (2004)',
    where: 'kirby_1995 pp. 83–87; green_1994 pp. 383–387; green_2004 pp. 774–775',
    values: [
      { label: 'Kirby and Herrnstein: subjects whose preference reversed from the larger, later reward to the smaller, earlier one as both delays shrank', value: '34 of 36' },
      { label: 'their subjects in the three experiments, paid in real rewards after real delays', value: '14, 10 and 12' },
      { label: 'Green, Fristoe and Myerson: undergraduates choosing between hypothetical amounts, $20 or $50, $100 or $250, $500 or $1,250', value: 24 },
      { label: 'adding the same delay to both amounts reversed preference toward the larger amount; the rate of discounting fell as the amount rose', value: 'both found' },
      { label: 'Green and Myerson: variance in the group-median discounting of a hypothetical $10,000 accounted for by an exponential curve', value: '81.5%' },
      { label: 'by a hyperbola', value: '93.7%' },
      { label: 'by a hyperbola with an exponent, which fit every participant where the other two failed some', value: '97.7%' },
    ],
    differed: 'Kirby and Herrnstein shrank both delays until preference reversed; Green, Fristoe and Myerson added the same delay to both amounts; Green and Myerson review fits to group medians. Here the two curves are fitted to your five indifference points from 32 hypothetical cards, and no published rate is quoted. No source in the library gives the spread of k among students, so no class is simulated.',
  },
  {
    id: 'hanoi-counts',
    title: 'The Tower of Hanoi’s counts',
    source: 'Simon (1975), as the reading reports it (§12.1.1, §12.2.2)',
    where: 'simon_1975 p. 269 (3ⁿ arrangements and 2ⁿ − 1 moves), pp. 269–270 and 279 (goal recursion), p. 272 and 281 (the largest disk out of place), p. 273 (the move pattern), p. 272 (memorizing fifteen moves)',
    values: [
      { label: 'arrangements of n disks', value: '3ⁿ' },
      { label: 'moves in the shortest solution of n disks', value: '2ⁿ − 1' },
    ],
    differed: 'Simon reports no experiment; his strategies are an analysis of what a solver could do.',
  },
  {
    id: 'callaway-2022',
    title: 'The click task',
    source: 'Callaway et al. (2022), as the reading reports it (§12.2.4)',
    where: 'callaway_2022 pp. 1114–1115: values −10, −5, +5 or +10 with equal probability; three moves; eight paths; a myopic one-step approximation to the optimal policy',
    values: [
      { label: 'values a node can hold', value: '−10, −5, +5, +10' },
      { label: 'paths through a tree', value: 8 },
    ],
    differed: 'Their clicks were followed by a three-second delay in place of a point cost, and each state could be clicked only after its parent; here a look costs 1 point and any node can be uncovered.',
  },
  {
    id: 'huys-2012',
    title: 'Stopping after a large loss',
    source: 'Huys et al. (2012), as the reading reports it (§12.2.4)',
    where: 'huys_2012 pp. 2–7 and Fig. 6A: stopping probability about 0.35–0.43 just after a large loss, about 0.19–0.25 elsewhere',
    values: [{ label: 'how much a large loss raised the chance of stopping the search down that branch', value: 'roughly doubled' }],
    differed: 'Their participants learned a six-state tree over many trials and were not charged for looking.',
  },
  {
    id: 'twins-2015',
    title: 'Twin correlations for higher cognitive functions',
    source: 'Polderman et al. (2015), as the reading reports it (§12.3.5)',
    where: 'polderman_2015 Table 2, p. 707: identical 0.710, fraternal 0.441; twice the difference, 0.54, is the reading’s standard estimate',
    values: [
      { label: 'correlation within identical pairs', value: 0.71 },
      { label: 'correlation within fraternal pairs', value: 0.44 },
      { label: 'twice the difference', value: 0.54 },
    ],
    differed: 'A meta-analysis of published twin studies of measured abilities; the simulation here is of a trait in a model, not of any measured ability.',
  },
  {
    id: 'turkheimer-2003',
    title: 'Heritability by family income',
    source: 'Turkheimer et al. (2003), as the reading reports it (§12.3.5)',
    where: 'turkheimer_2003 pp. 626–627: in the poorest families the modeled heritability was close to zero; in the most affluent, most of the variance was genetic; by a median split, h² about 0.10 against about 0.72',
    values: [
      { label: 'heritability, below the median of family income', value: 'about 0.10' },
      { label: 'heritability, above the median', value: 'about 0.72' },
    ],
    differed: 'Twins aged 7 in one United States sample; the corn model’s poor soil is the model’s mechanism, not theirs.',
  },
  {
    id: 'lewontin-1970',
    title: 'Lewontin’s two experiments',
    source: 'Lewontin (1970), as the reading reports it (§12.3.6)',
    where: 'lewontin_1970 pp. 7–8',
    values: [
      { label: 'heritability within each of two inbred lines in the same soil', value: 0 },
      { label: 'heritability within each batch of one varied stock in two nutrient solutions', value: 1 },
    ],
    differed: 'A thought experiment in an essay; the trays here are a model built to the same design.',
  },
  {
    id: 'flynn',
    title: 'The Flynn effect',
    source: 'the reading (§12.1.8, §12.3.6)',
    where: '§12.1.8: about 3 points per decade in the United States; §12.3.6: about a standard deviation within a few generations',
    values: [{ label: 'rise in average scores', value: 'about 3 points a decade' }],
    differed: 'A rise in scores on tests over decades; here, a rise in the height of corn over six seasons of improving soil.',
  },
  {
    id: 'erectus',
    title: 'Homo erectus, from the reading',
    source: 'the reading (§12.1.4)',
    where: '§12.1.4',
    values: [
      { label: 'first appears in Africa', value: 'about 1.9 million years ago' },
      { label: 'adult weight', value: 'about 52 to 55 kilograms (about 115 to 120 pounds)' },
      { label: 'brain volume, early H. erectus', value: 'about 800 to 860 cubic centimeters' },
      { label: 'Acheulean tools from', value: 'about 1.7 million years ago' },
      { label: 'outside Africa by', value: '1.85 million years ago (Georgia); 1.66 million years ago (Java)' },
    ],
    differed: 'The figure on the range is stylized and is not a reconstruction.',
  },
  {
    id: 'needs-evidence',
    title: 'What the needs rest on',
    source: 'the reading (§12.1.3, §12.1.5); Backwell and d’Errico (2001); Boesch (2012), to request',
    where: 'cut marks and carried stone, §12.1.3; the Hadza and digging, §12.1.5; backwell_2001 pp. 1358–1362 for the termites; Boesch (2012) is not in the library',
    values: [
      { label: 'Backwell and d’Errico: purported bone tools from Swartkrans and Sterkfontein examined', value: 85 },
      { label: 'their age, Swartkrans Members 1 to 3', value: 'about 1.8 to 1 million years' },
      { label: 'the experimental use whose wear matched the fossils', value: 'digging into termite mounds, not soil' },
      { label: 'minutes of digging in one mound that produced that wear', value: '15 to 30' },
      { label: 'the user: Homo and Australopithecus robustus both occur at the sites', value: 'not identified' },
    ],
    differed: 'The Swartkrans tools were bone, not the sapling probe of this range, and their user is not identified; carcasses and marrow rest on the archaeological record the reading describes, digging sticks on living foragers, and the termite probe is a hypothesis built on chimpanzees’ termite fishing (Boesch, to request) and these bone tools.',
  },
]

export const reference = (id: string): Reference => {
  const r = REFERENCES.find((x) => x.id === id)
  if (!r) throw new Error(`no reference ${id}`)
  return r
}

export const PENDING_REFERENCES = (): Reference[] => REFERENCES.filter((r) => r.values === null)
