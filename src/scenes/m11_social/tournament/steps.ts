import { RULES } from '../../../sim/social/game/rules'
import { PREDICTOR_COSTS } from '../../../sim/social/game/generations'
import { ENOUGH_COOPERATORS_LINE, FINDING_OUT_LINE, MISTAKES_LINE, NEVER_AHEAD_LINE, PREDICTING_LINE, STAND_IN_COST_LINE, THE_FIELD_LINE, THE_GRID_LINE } from '../lines'

/**
 * The seven steps of Part 2 (spec §6): each opens on an instruction screen
 * that names the passage to reread, explains the panel, and asks a
 * prediction before anything runs. Explorations: a step can be left and
 * returned to, and reopened or redone, with Go to, Go back and Redo.
 */

export type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7

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

const RULE_LABELS = RULES.map((r) => r.label)
const ENTRY_LABELS = [...RULE_LABELS, 'My rule', 'Predictor']
const RANKS = ['first', 'second or third', 'in the middle', 'sixth or seventh', 'last']

export const STEPS: StepSpec[] = [
  {
    step: 1,
    title: 'Step 1 — Two Rules',
    reread: 'Reread §11.1.7, §11.1.8 and §11.2.1 of the reading: the payoff matrix, repeated encounters, and tit-for-tat.',
    willDo: [
      'Repeated encounters change the game: help given now and returned later is what the reading calls reciprocal altruism (§11.1.8), and this step asks when repetition favors it. Only two rules play in this step, with no mistakes: Always defect, which defects on every round, and Tit-for-tat, which cooperates on round 1 and then plays its partner’s move from the previous round. Four short runs, each computed by the engine from the rules’ moves and the payoff matrix.',
      '- Run 1, one round: Always defect against Tit-for-tat, once.',
      '- Run 2, a match: the same two, head to head, for R rounds. A slider sets R at 1, 2, 3, 10 or 200.',
      '- Run 3, a round-robin of the two: each rule plays the other and a copy of itself, for R rounds a match. Each rule’s total is the sum of its two matches.',
      '- Run 4, a population: a share x of the population plays Tit-for-tat and the rest Always defect, and each animal meets every other for R rounds. The plot shows each rule’s average points per encounter against x, and marks where Tit-for-tat starts to do better.',
      'First, predict the four runs with the four questions on the left, and commit them together. Then press “Begin the runs”; the panel shows every run with its slider.',
    ],
    minutes: 4,
    content: [NEVER_AHEAD_LINE, ENOUGH_COOPERATORS_LINE],
    predictions: [
      { key: 'p2-s1-one', question: 'Run 1, one round: which scores more?', choices: ['Always defect', 'Tit-for-tat', 'the same'] },
      { key: 'p2-s1-match', question: 'Run 2, a match of R rounds: how does the margin between them change as R grows?', choices: ['Always defect wins by more', 'Always defect wins by the same margin', 'Tit-for-tat catches up and wins'] },
      { key: 'p2-s1-rr', question: 'Run 3, the round-robin at R = 10: which has the higher total?', choices: ['Always defect', 'Tit-for-tat', 'the same'] },
      { key: 'p2-s1-pop', question: 'Run 4: as R grows, the share of Tit-for-tat players it needs to do better than Always defect…', choices: ['falls', 'rises', 'stays the same'] },
    ],
  },
  {
    step: 2,
    title: 'Step 2 — Build a rule',
    reread: 'Reread §11.2.1 of the reading: what tit-for-tat requires of a player.',
    willDo: [
      'A rule here is a short table of moves: a first move, and a move after each of the four outcomes of the previous round. The six partners of Part 1 are all rules of this kind, and the panel names which of them your rule matches, if any, as you set the chips.',
      '- First move: Cooperate or Defect.',
      '- After a round in which both cooperated; after one in which you cooperated and the partner defected; after one in which you defected and the partner cooperated; after one in which both defected: Cooperate or Defect.',
      '- Generosity: after the partner defects, cooperate anyway never, 1 time in 10, or 1 time in 3.',
      'Your rule is saved, can be rebuilt at any time, and enters every later step as a seventh entry, named “My rule” or “My rule 2”.',
      'First, predict: can a rule that never defects first win a match against Always defect? Then build your rule.',
    ],
    minutes: 4,
    content: [],
    predictions: [{ key: 'p2-s2', question: 'Can a rule that never defects first score more than Always defect in a match between the two?', choices: ['yes', 'no'] }],
  },
  {
    step: 3,
    title: 'Step 3 — The round-robin',
    reread: 'Reread §11.2.1 of the reading: the tournament.',
    willDo: [
      'Every entry plays every entry, itself included, for 200 rounds a match, with no mistakes. The length is the build’s choice; Axelrod’s first tournament used matches of 200 moves (Axelrod and Hamilton, 1981, p. 1393). Entries do not know the length. The entries are the six rules of Part 1 and your rule from Step 2.',
      'The table shows average points per round for every pair, each entry’s total (its mean over every opponent, itself included), and the ranking. The numbers come from the rules’ moves and the payoff matrix and nothing else.',
      'First, predict which entry will score highest, which lowest, and where your rule will rank. Then press “Run the round-robin”.',
    ],
    minutes: 5,
    content: [THE_FIELD_LINE],
    predictions: [
      { key: 'p2-s3-top', question: 'Which entry will score highest?', choices: [...RULE_LABELS, 'My rule'] },
      { key: 'p2-s3-bottom', question: 'Which entry will score lowest?', choices: [...RULE_LABELS, 'My rule'] },
      { key: 'p2-s3-mine', question: 'Where will your rule rank among the seven?', choices: RANKS },
    ],
  },
  {
    step: 4,
    title: 'Step 4 — A Rule That Predicts',
    reread: 'Reread §11.2.1 and §11.2.3 of the reading: tit-for-tat responds only to what the partner did, and many animals predict one another in richer ways.',
    willDo: [
      'Every entry so far is a fixed table of moves. This step adds one that predicts its partner: Predictor. For each partner it stores counts of the partner’s first move and of the partner’s move after each of the four outcomes of the previous round, each count starting at one cooperation and one defection, and from the counts it computes the probability that the partner cooperates next. On round 1 it cooperates. On every later round it computes, under its estimates, the expected points of every sequence of its own moves over the next 3 rounds (8 sequences) and plays the first move of the best; with probability 5% it plays the other move instead, a probe. It carries nothing from one partner to the next, and it has no partner’s rule, only counts.',
      'It is the student of Part 1 as a program: it predicts each round and chooses each round. Its matches are played, not computed, so its results are means over 50 seeds, with the spread.',
      'First, predict where Predictor will rank in the Step 3 round-robin, against which partner it will do best, and against which worst. Then press “Run with Predictor”. The panel shows the ranking; Predictor’s points against each partner, its share of the best possible total against each, and the points it lost to probing; a replay of Predictor against Defect forever after one defection with the first probe marked; its estimates for any partner as four rows against the partner’s true table; and, beside it, your own Part 1 results against the same six partners over matches of the same lengths.',
    ],
    minutes: 5,
    content: [PREDICTING_LINE, FINDING_OUT_LINE],
    predictions: [
      { key: 'p2-s4-rank', question: 'Where will Predictor rank among the eight entries?', choices: ['first', 'top three', 'in the middle', 'bottom three', 'last'] },
      { key: 'p2-s4-best', question: 'Against which partner will Predictor do best?', choices: RULE_LABELS },
      { key: 'p2-s4-worst', question: 'Against which partner will Predictor do worst?', choices: RULE_LABELS },
    ],
  },
  {
    step: 5,
    title: 'Step 5 — Mistakes',
    reread: 'Reread §11.2.1 of the reading: what tit-for-tat requires, and what happens after a defection.',
    willDo: [
      'A noise setting flips each intended move with a probability of 0, 1%, 5% or 10%, for every entry alike; 5% is the default. The legacy version of this lab used 20%, which swamps every rule.',
      'The round-robin of Step 4 runs again at the noise set on the left, and the table shows each number with its change from no noise. Predictor’s estimates now absorb its partners’ mistakes, and its panel shows how.',
      'First, predict which entry falls furthest with mistakes and which gains. Then press “Run with mistakes”.',
    ],
    minutes: 4,
    content: [MISTAKES_LINE],
    predictions: [
      { key: 'p2-s5-falls', question: 'Which entry falls furthest with mistakes?', choices: ENTRY_LABELS },
      { key: 'p2-s5-gains', question: 'Which entry gains most?', choices: ENTRY_LABELS },
    ],
  },
  {
    step: 6,
    title: 'Step 6 — Generations',
    reread: 'Reread §11.2.1 of the reading: the simulation in which more successful programs became more common.',
    willDo: [
      'Every entry starts at an equal share of a population. Each generation, an entry’s share is multiplied by its average points per round against the current population, and the shares are renormalized: Axelrod’s ecological simulation. The plot shows every entry’s share over 300 generations, with no mistakes and with the noise set in Step 5, side by side.',
      'A cost for Predictor, a slider in this step only: a cost per round subtracted from Predictor’s average points before each generation’s update, at 0, 0.05, 0.1, 0.2 or 0.5 points a round. It stands in for what computing a prediction costs an animal, as a larger brain costs energy (§11.3.2). The panel marks the lowest cost at which Predictor’s share falls below its starting share by generation 300.',
      'First, predict which entry vanishes first, which is most common at the end with mistakes, and at what cost Predictor stops spreading. Then press “Run the generations”.',
    ],
    minutes: 3,
    content: [STAND_IN_COST_LINE],
    predictions: [
      { key: 'p2-s6-vanish', question: 'With no mistakes, which entry vanishes first?', choices: ENTRY_LABELS },
      { key: 'p2-s6-common', question: 'With mistakes, which entry is most common at the end?', choices: ENTRY_LABELS },
      { key: 'p2-s6-cost', question: 'At what cost per round, if any, does Predictor stop spreading with mistakes?', choices: [...PREDICTOR_COSTS.map((c) => String(c)), 'it does not spread even at no cost', 'it spreads at every cost'] },
    ],
  },
  {
    step: 7,
    title: 'Step 7 — The cycle',
    reread: 'Reread §11.1.7 of the reading: an evolutionarily stable strategy.',
    willDo: [
      'A grid of 40 × 40 cells, wrapping at the edges, each cell playing one of three rules: Always cooperate, Always defect or Tit-for-tat, in the colors of the key. Each generation every cell plays each of its eight neighbors for 10 rounds at the noise set in Step 5, and its score is its total. Then every cell takes the rule of the highest-scoring cell among itself and its eight neighbors. Then mutation: each cell switches to a rule drawn at random with the probability set on the left.',
      'Three start worlds, each with its own prediction: All tit-for-tat, All always-cooperate, and All always-defect. The question each time is which rule, if any, takes over. In the all-defect world, after running it long enough to see that single mutants fail, “Drop a block of tit-for-tat” lets you test whether a cluster gives reciprocators a foothold. Then Mixed at random, run for 1,000 generations with “Skip ahead” or at a chosen speed: the band under the plot shows the most common rule at each generation, and the counter the number of times it changed.',
      'The 3 × 3 table of points per encounter at the current noise says why each invasion succeeds. Its numbers are the engine’s own.',
      'First, predict which rule, if any, takes over each start world. Then choose a world and press “Run”.',
    ],
    minutes: 5,
    content: [THE_GRID_LINE],
    predictions: [
      { key: 'p2-s7-tft', question: 'All tit-for-tat: which rule takes over?', choices: ['Always cooperate', 'Always defect', 'Tit-for-tat stays', 'none settles'] },
      { key: 'p2-s7-allc', question: 'All always-cooperate: which rule takes over?', choices: ['Always cooperate stays', 'Always defect', 'Tit-for-tat', 'none settles'] },
      { key: 'p2-s7-alld', question: 'All always-defect: which rule takes over?', choices: ['Always cooperate', 'Always defect stays', 'Tit-for-tat', 'none settles'] },
    ],
  },
]

export const stepSpec = (s: Step): StepSpec => STEPS[s - 1]
