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
      'Four programmed foragers each run your own week: the same clearing, the same logs full on night 1, the same order of night features, the same length of night and the same call from the nest. They walk perfectly, straight to each log they choose, so the comparison is of digs, not of walking.',
      '- Usual only follows the slow learner’s knowledge of which kind of log has beetles. It stores no night.',
      '- Tendency only follows one weight per log, learned by Lab 5’s rule from the beetles found there. It stores no night, and nothing tells it the kinds of log beyond what its weights learn.',
      '- Tonight too has the slow learner and a fast store of each night, with strong separation between the nights’ codes.',
      '- Tonight too, nights blurred is the same with weak separation.',
      'Every forager also has a list for tonight: the logs it has already dug tonight, cleared at dawn. No forager is scored on it. Tendency only has only a disposition, a learned tendency to return to what paid off; Tonight too has accessible content as well, a stored night it can combine with the rule about refilling.',
      'First, predict: which forager will end closest to you on digs at logs emptied last night, and which will do worst on nights 2 to 6? Then press “Run the foragers”. The table compares every forager with you, night by night, with each one’s share of when-errors after look-alike pairs and after different pairs; the foragers have no practice effect, so their contrast is the effect of look-alike nights alone. The overhead replays any forager’s night beside yours.',
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
      'The fast store holds each night after one exposure, as a sparse code: the night’s features and a context that drifts a little from night to night are expanded into many units, of which only a few are active. With the night it stores the logs emptied that night.',
      'The store is a content-addressable memory: to ask which logs were emptied last night, it is cued with what last night was like, and every stored night contributes in proportion to how similar its code is to the cue. That is pattern completion: the rest of a night comes back from part of it. The bar chart shows each stored night’s contribution, and the strength with which each log comes back as emptied.',
      'The slider sets how separate the codes are: how many units the expansion has, and what share of them is active. That is pattern separation: similar nights made less alike before they are stored. The panel shows each stored night’s code as a grid of dots, and the similarity between every pair of stored nights.',
      'First, predict: at weak separation, which nights will give the store more when-errors, the nights that follow a look-alike pair or the nights that follow a different pair? Then press “Run the store at every setting”. The store runs your week at the three settings, and its share of when-errors after each kind of pair sits beside yours.',
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
      'The slow learner is a small network built with Lab 7’s engine: a thing and a relation in, a hidden layer, properties out, learning by passing the error back. Its world is eight things in the range: two kinds of wood, two plants, two hunters from the air, two on the ground, with properties from general (stays put, moves, is a danger) through the middle (is wood, has wings) to specific (has beetles under it, hunts at night).',
      'The two together are complementary learning systems: the fast store learns each night from one exposure, and the slow learner is trained from the fast store’s replay of a simulated youth of many nights, interleaved. On this account that replay is consolidation. Press “Skip ahead through the youth” and watch the hidden-activity space: snapshots at four points sit side by side, with the eight things placed by their hidden activity.',
      'Then a new season brings two new things, an acorn tree and a weasel. First, predict: with replay off, what happens to what the slow learner has learned of the old things? Then train on the new season with replay off (the new things alone) and with replay on (the new things interleaved with the fast store’s replay of the old), and read the plot of the old things’ properties still right against training. A loss of the old things with replay off is catastrophic interference, as in Lab 7’s closer.',
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
      'Two kinds of damage, each applied to Tonight too and run again on your nights.',
      '- Remove the fast store: the forager has only the slow learner and its tendency weights.',
      '- Damage the slow learner: noise is added to its hidden units, more with the slider. The property table shows how the damaged network answers, and the forager runs with the damaged network.',
      'First, predict what each kind of damage does to two errors: digs at logs emptied last night, and digs at smooth logs. Then make each change and read the lines. At the end, fill the two-by-two table of each kind of damage against each kind of error, and commit it. Two opposite patterns of loss are a double dissociation.',
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
