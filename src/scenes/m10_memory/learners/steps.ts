import { FORAGERS } from '../../../sim/memory/foragers/foragers'
import { DAMAGE_LINE, PASS_BACK_LINE, PROGRAMS_LINE, SEPARATION_LINE, STRENGTH_LINE } from '../lines'

/**
 * The four steps of Part 5 (spec §9): each opens on an instruction screen
 * that names the passage to reread, explains the panel, and asks a
 * prediction before the change is made. Explorations: a step can be left
 * and returned to, and reopened or redone.
 */

export type Step = 1 | 2 | 3 | 4

export interface Prediction {
  key: string
  question: string
  choices: string[]
}

export interface StepSpec {
  step: Step
  title: string
  reread: string
  willDo: string[]
  minutes: number
  content: string[]
  predictions: Prediction[]
}

export const FORAGER_IDS = FORAGERS.map((f) => f.id)
export const FORAGER_LABELS = FORAGERS.map((f) => f.label)

export const STEPS: StepSpec[] = [
  {
    step: 1,
    title: 'Step 1 — Four foragers on your nights',
    reread: 'Reread §10.2.1 of the reading: a disposition against accessible content.',
    willDo: [
      'Four programmed foragers each run your own week: the same clearing, the same logs full on night 1, the same order of night features, the same length of night and the same call from the nest. They walk perfectly, straight to each log they choose, so the comparison is of digs, not of walking. Each is built from some of the three parts in the diagram on the right, and the four differ only in which parts they have.',
      '- Usual only has the slow learner, which has learned over a long youth which kind of log has beetles under it. It chooses at random among the loose-bark logs it has not dug tonight. It stores nothing about any night, so on night 2 it has no way of telling a log it emptied on night 1 from one it did not.',
      '- Tendency only has one weight per log, raised a little by Lab 5’s rule each time beetles were found there and lowered a little when they were not. It digs where its weights are highest. It stores nothing about any night, and nothing tells it the kinds of log beyond what its weights learn, so it can dig at a smooth log.',
      '- Tonight too has the slow learner and a fast store that holds each night after one exposure, with strong separation between the nights’ codes. Before a dig it asks the store which logs were emptied last night and passes those by.',
      '- Tonight too, nights blurred is the same forager with weak separation, so two nights that looked alike are stored as nearly the same code.',
      'Every forager also has a list for tonight: the logs it has already dug tonight, cleared at dawn, so no forager digs the same log twice in a night. In the reading’s terms, Tendency only has only a disposition, a learned tendency to return to what paid off; Tonight too has accessible content as well, a stored night it can combine with the refill rule.',
      'Two errors are counted for every forager, and for you. A dig at a log emptied last night is one; a dig at a smooth log is the other. The share of when-errors is the one your Part 4 results used: on nights 3 to 6, errors over decisions at the logs emptied last night or two nights ago.',
      'First, predict. The first question asks which forager will end closest to you on digs at logs emptied last night, summed over the week; the choices are the four foragers. The second asks which forager will do worst on nights 2 to 6, by the same count. Then press “Run the foragers”. The table on the stage compares every forager with you, over the week and night by night, with each one’s share of when-errors after look-alike pairs and after different pairs. Under it, “Replay” draws any forager’s night from above beside your own night, chosen by two menus: whose night, and which night.',
    ],
    minutes: 5,
    content: [PROGRAMS_LINE],
    predictions: [
      { key: 'p5-step1-closest', question: 'Which forager will end closest to you on digs at logs emptied last night?', choices: FORAGER_LABELS },
      { key: 'p5-step1-worst', question: 'Which forager will do worst on nights 2 to 6?', choices: FORAGER_LABELS },
    ],
  },
  {
    step: 2,
    title: 'Step 2 — Inside the store',
    reread: 'Reread §10.2.8 and §10.1.3 of the reading: recall by content, and distinguishing two similar occasions.',
    willDo: [
      'This step opens the fast store of Tonight too and runs it on your week at three settings. The store holds each night after one exposure, as a sparse code: the night’s features (its moon, weather, ground and sound) and a context that drifts a little from night to night are expanded into many units, of which only a few are active. With the night it stores the logs emptied that night.',
      'The store is a content-addressable memory. To ask which logs were emptied last night, the forager cues it with what last night was like, and every stored night contributes in proportion to how similar its code is to the cue. That is pattern completion: the rest of a night comes back from part of it. The answer for each log is a strength between 0 and 1, and the forager treats the log as emptied last night that often: a log at 0.5 is passed by half the time.',
      'The setting, “How separate the codes are”, has three values. Weak: 8 units, half of them active for any night. Medium: 60 units, about one in seven active. Strong: 480 units, about one in thirty active. More units with fewer active is more pattern separation: two similar nights are made less alike before they are stored. The setting changes nothing else about the forager.',
      'A night after a look-alike pair is a night whose two nights before were identical in every feature; a night after a different pair had two nights before it that differed. Your week’s order on the right says which of nights 3 to 6 are which. The store’s when-errors are counted as yours were: a dig at a log emptied last night, or a full log emptied two nights ago passed close by and never dug.',
      'First, predict: at the weak setting, which nights will give the store more when-errors, the nights after a look-alike pair, the nights after a different pair, or about the same? Then press “Run the store at every setting”. The stage then shows, for the setting chosen on the left: each stored night’s code as a grid of dots with the logs emptied that night; the similarity between every pair of stored nights as a shaded matrix; the retrieval for a cue night chosen from the “The cue” menu, as two bar charts; and the store’s share of when-errors at each setting beside yours.',
    ],
    minutes: 5,
    content: [SEPARATION_LINE, STRENGTH_LINE],
    predictions: [{ key: 'p5-step2', question: 'At weak separation, which nights give the store more when-errors?', choices: ['nights after a look-alike pair', 'nights after a different pair', 'about the same'] }],
  },
  {
    step: 3,
    title: 'Step 3 — Two learners',
    reread: 'Reread §10.2.10 and §10.1.2 of the reading: two learners at two speeds, and the long youth of a mammal.',
    willDo: [
      'The slow learner is a small network built with Lab 7’s engine: a thing and a relation in, a hidden layer of eight units, properties out, learning by passing the error back. Its world is eight things in the range: two kinds of wood (the loose-bark log and the smooth log), two plants (seed grass and a berry bush), two hunters from the air (the owl and the hawk) and two on the ground (the fox and the snake). Each has properties at three levels. General properties are shared by many things: stays put, moves, is a danger. Middle properties are shared by a pair: is wood, has wings. Specific properties belong to one thing: has beetles under it, hunts at night. The property table on the stage lists every property, its level, and which things have it.',
      'The two learners together are complementary learning systems. The fast store learns each night from one exposure. The slow learner is trained from the fast store’s replay of a simulated youth of many nights, with the eight things interleaved, and on this account that replay is consolidation. “Skip ahead through the youth” runs the youth in slices of five passes to its end at 600 passes; the hidden-activity space is drawn after 5, 20, 80 and 600 passes, side by side, with the eight things placed by the activity of the hidden units, on one pair of axes. Three distances are printed under it: between the things that stay put and the things that move, between wood and plants and between air and ground, and within each pair.',
      'Then a new season brings two new things, an acorn tree (a plant that stays put, with bark and roots, and nothing under it) and a weasel (a hunter on the ground). Two buttons train the slow learner on them. “Train on the new season, replay off” presents the new things alone, many times. “Train on the new season, replay on” presents them interleaved with the fast store’s replay of the old eight. After each, a plot shows, against presentations of the new season, the share of the old things’ properties the network still says yes to, with a line for the specific properties and a line for all three levels averaged.',
      'First, predict: with replay off, what happens to the old things’ properties as the slow learner learns the new season? The choices are that they stay right; that the specific ones are lost first; that the general ones are lost first; or that all are lost at once. A loss of the old things when new ones are learned alone is catastrophic interference, as in Lab 7’s closer.',
    ],
    minutes: 5,
    content: [PASS_BACK_LINE],
    predictions: [{ key: 'p5-step3', question: 'With replay off, what happens to the old things’ properties as the slow learner learns the new season?', choices: ['they stay right', 'the specific ones are lost first', 'the general ones are lost first', 'all are lost at once'] }],
  },
  {
    step: 4,
    title: 'Step 4 — Damage',
    reread: 'Reread §10.3.1 to §10.3.3 of the reading: H.M., K.C., and semantic dementia.',
    willDo: [
      'Two kinds of damage, each applied to Tonight too, which then runs your week again. Tonight too intact runs first, so each damaged forager is read against the same forager undamaged.',
      '- “Remove the fast store”: the forager has only the slow learner and its tendency weights, and nothing stored about any night.',
      '- “Damage the slow learner”: noise is added to the activity of the network’s hidden units, more with the slider, from 0 to 1.5. The property table shows how the damaged network answers, averaged over twenty draws of the noise, with each wrong answer in red; then “Run Tonight too with the damaged slow learner” runs the forager with that network and the fast store intact.',
      'Two errors are counted, over the week. Digs at logs emptied last night, on nights 2 to 6. Digs at smooth logs, on every night. For each kind of damage and each error, the question is whether the error rises or stays low. On the stage, an error counts as risen when the damaged forager’s total is at least one more than the intact forager’s.',
      'First, predict what each kind of damage does to the two errors: for each, whether digs at logs emptied last night rise, digs at smooth logs rise, both, or neither. Then make each change and read the tables. At the end, fill the two-by-two table on the left, one cell for each kind of damage against each error, with “rises” or “stays low”, and commit it. The measured table then appears beside yours.',
    ],
    minutes: 5,
    content: [DAMAGE_LINE],
    predictions: [
      { key: 'p5-step4-store', question: 'With the fast store removed, which error rises?', choices: ['digs at logs emptied last night', 'digs at smooth logs', 'both', 'neither'] },
      { key: 'p5-step4-slow', question: 'With the slow learner damaged, which error rises?', choices: ['digs at logs emptied last night', 'digs at smooth logs', 'both', 'neither'] },
    ],
  },
]

export const stepSpec = (s: Step): StepSpec => STEPS[s - 1]

/** The two-by-two table's cells (§9.5): each kind of damage against each kind of error. */
export const TABLE_ROWS = ['Remove the fast store', 'Damage the slow learner'] as const
export const TABLE_COLUMNS = ['digs at logs emptied last night', 'digs at smooth logs'] as const
export const TABLE_CHOICES = ['rises', 'stays low'] as const
export const TABLE_KEY = 'p5-table'
