import { RULES } from '../../../sim/social/game/rules'
import { MEMORY_COSTS } from '../../../sim/social/game/generations'
import { ENOUGH_COOPERATORS_LINE, FINDING_OUT_LINE, MISTAKES_LINE, NEVER_AHEAD_LINE, PREDICTING_LINE, STAND_IN_COST_LINE, THE_FIELD_LINE, THE_GRID_LINE } from '../lines'

/**
 * The seven steps of Part 2 (spec §6): each opens on an instruction screen
 * that explains the panel and asks a prediction before anything runs. The
 * passages to reread are listed once, on Step 1 (Jon, 2026-11-02). The
 * texts are Jon's from his Part 2 pass of 2026-11-02, with the memory
 * cost (Step 6) and the chosen entries (Step 7) worked in. Explorations:
 * a step can be left and returned to, and reopened or redone, with Go
 * to, Go back and Redo.
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
  /** The passages to reread, on Step 1 only. */
  reread?: string
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
    reread: 'It may help to reread the parts of the reading on the prisoner’s dilemma before this part: §11.1.7 (Games Without Minds), §11.1.8 (Repeated Encounters), and §11.2.1 (Playing a Repeated Game). Step 4 also draws on §11.2.3 (What Others Can See), and Step 6 on §11.3.2 (Why Did Primate Brains Become Larger?).',
    willDo: [
      'Repeated encounters change the game. Help that is given now and returned later is reciprocal altruism. The question in this step is when repetition favors reciprocal altruism. Only two rules play in this step: Always defect, which defects on every round, and Tit-for-tat, which cooperates on round 1 and then plays its partner’s move from the previous round. Four short runs, each computed from the rules’ moves and the payoff matrix.',
      '- Run 1, one round: Always defect against Tit-for-tat, once.',
      '- Run 2, a match: the same two against each other for R rounds. R can be set to 1, 2, 3, 10, or 200.',
      '- Run 3, a round-robin of the two rules: each rule plays the other and a copy of itself, for R rounds a match. Each rule’s total is the sum of its two matches.',
      '- Run 4, a population: a share x of the population plays Tit-for-tat and the rest Always defect, and each animal plays every other for R rounds. The plot shows each rule’s average points per encounter against x, and marks where Tit-for-tat starts to do better.',
      'First, predict the four runs with the four questions on the left, and press “Commit my prediction”. The panel then shows every run with its settings.',
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
    willDo: [
      'A rule here is a short table of moves: a first move, and what move to make after each of the four outcomes of the previous round. The six partners of Part 1 are all rules of this kind, and the panel shows which of them your rule matches, if any, as you set your rule.',
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
    willDo: [
      'In this step, every entry plays every other entry, itself included, for 200 rounds a match. The length follows Axelrod’s first tournament, whose matches were 200 moves long (Axelrod and Hamilton, 1981, p. 1393). The competitors are the six rules of Part 1 and your rule from Step 2.',
      'The table shows average points per round for every pair, each entry’s total (its mean over every entry, itself included), and the ranking. The numbers come from the rules’ moves and the payoff matrix, and nothing else. Under the ranking, pressing an entry’s name shows its record against every entry, round by round, with its running points.',
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
    willDo: [
      'Every entry so far is a fixed table of moves. This step adds a new strategy, called Predictor, that learns to predict its partner’s moves. For each partner, Predictor stores counts of what the partner did on round 1, and of what the partner did after each of the four outcomes of the previous round. Every count starts at one cooperation and one defection, so that no estimate is ever certain. From the counts, Predictor computes the probability that the partner cooperates next. On round 1 it cooperates. On every later round it works out, from those probabilities, the expected points of every sequence of its own moves over the next 3 rounds (8 sequences), and plays the first move of the best sequence. With probability 5% it plays the other move instead. This is an “exploration” move, a probe, designed to get information in the event that the moves are always the same. Predictor starts its learning over with every new partner. It is never given a partner’s rule, only the counts.',
      'Predictor does, as a program, what you did in Part 1: it predicts each round and chooses each round. Because its probes fall at random, its matches come out differently on every run, so its results are means over 50 runs, with the spread. The step can be run again at any time, and each run plays new matches.',
      'First, try to guess where Predictor will rank in the round-robin of Step 3. Which partner will it do best against, and which worst? Then press “Run with Predictor”. The panel shows the ranking and, for each partner, Predictor’s points. It shows its share of the best possible total, and the points it lost to probing. The panel also shows a replay of Predictor against Defect forever after one defection, with the first probe marked; Predictor’s estimates for any partner, as four rows beside the partner’s true table; and your own Part 1 results against the same six partners, over matches of the same lengths.',
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
    willDo: [
      'In this step, a noise setting is used to insert randomness into the behavior of the strategies. You can think of this as intentional randomness, or as the strategy occasionally making mistakes. The noise flips each intended move with a probability of 0, 1%, 5%, or 10%, for every entry alike; 5% is the default. Above 10%, the strategies become very hard to tell apart.',
      'The round-robin of Step 4 runs again at the noise set on the left, and the table shows each number with its change from no noise. Predictor’s counts now include its partners’ mistakes, and its panel shows how.',
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
    willDo: [
      'In this step, we will do another competition. This time, there are many competitors. The different strategies each start as an equal share of the population. Each generation, the ratio of the different strategies in the population changes to reflect the relative success of the different strategies. For example, if the tit-for-tat players together earn 30% of all the points earned in a generation, tit-for-tat will be 30% of the population in the next generation. This resembles Axelrod’s original ecological simulation of different strategies. The results plot will show every entry’s share over 300 generations. It will show the results with no noise, and with the noise set in Step 5, side by side.',
      'The simulation will also show how the performance of the different strategies changes if you factor in that more complex strategies would require bigger brains, and therefore more energy. A strategy that always cooperates or always defects would need no memory at all. Tit-for-tat and the other rules would need a limited memory, what happened on the previous round, which is one number. Predictor would need a larger memory to keep track of the history: its ten counts and the previous round, which is eleven numbers. The memory is charged for: a cost per number remembered, per round, set on the stage at 0, 0.01, 0.02, 0.05, or 0.1 points, is subtracted from each strategy’s average points before each generation’s update. The results plot will show how the spread of the different strategies changes as this cost rises. The results panel marks the lowest cost at which Predictor’s share, and at which Tit-for-tat’s share, falls below its starting share by generation 300.',
      'First, predict which entry vanishes first, which is most common at the end with mistakes, and at what cost Predictor stops spreading. Then press “Run the generations”.',
    ],
    minutes: 3,
    content: [STAND_IN_COST_LINE],
    predictions: [
      { key: 'p2-s6-vanish', question: 'With no mistakes, which entry vanishes first?', choices: ENTRY_LABELS },
      { key: 'p2-s6-common', question: 'With mistakes, which entry is most common at the end?', choices: ENTRY_LABELS },
      { key: 'p2-s6-cost', question: 'At what cost per number remembered, if any, does Predictor stop spreading with mistakes?', choices: [...MEMORY_COSTS.map((c) => String(c)), 'it does not spread even at no cost', 'it spreads at every cost'] },
    ],
  },
  {
    step: 7,
    title: 'Step 7 — The cycle',
    willDo: [
      'In Step 7, you will see a simulated world of different players following different strategies, which takes proximity and spatial location into account. There is a grid of 40 × 40 cells, wrapping at the edges, so that the far left cells touch the far right cells, and the top cells touch the bottom cells; a setting on the left makes the edges stop instead, so that a cell on an edge has fewer neighbors. Each cell contains a player, playing one of the rules checked on the left. Which rule is in which cell is color-coded and shown in the key.',
      'In this simulation, all three steps of natural selection are simulated. First, competition. Instead of playing against all the other strategies, each player only plays against its eight neighbors. They play each neighbor for 10 rounds, at the noise set in Step 5. Its score is its average points over its neighbors.',
      'Next, we simulate selection. The highest performing players survive and reproduce, replacing their lower performing neighbors. The exact rule: each cell takes the rule of the highest-scoring cell among itself and its eight neighbors, so a cell keeps its rule when no neighbor scored more, and a tie is broken at random.',
      'Finally, additional variation is inserted by allowing for a small amount of mutation. Each cell has a chance of switching to a rule drawn at random from the checked rules, with the probability set on the left.',
      'To start, run the simulation using the three preselected rules: Always cooperate, Always defect, and Tit-for-tat. Three start worlds, each with its own prediction: All tit-for-tat, All always-cooperate, and All always-defect. The question each time is which rule, if any, takes over, which is to ask whether the rule that fills the world is an evolutionarily stable strategy (§11.1.7). In the all-defect world, after running it long enough to see that single mutants fail, “Drop a block of tit-for-tat” lets you test whether a cluster of tit-for-tat cells can spread where single mutants could not. Then Mixed at random, run for 1,000 generations with “Skip ahead” or at a chosen speed: the band under the plot shows the most common rule at each generation, and the counter the number of times it changed. Watch the grid itself as well as the counts, and describe in the box what happens locally, in pockets of cells, as well as what happens to the whole.',
      'Then experiment: check or uncheck rules on the left, your own rule and Predictor included, start a world, and describe in the box the dynamics of each combination you try.',
      'The table of points per encounter at the current noise, for the checked rules, shows why each invasion succeeds. Its numbers come from the same play as the grid’s; Predictor’s row and column are means over 50 played encounters, since it is not a table of moves.',
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
