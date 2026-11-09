import { LONG_PAUSE_LINE, NOT_OPTIMAL_LINE } from '../lines'
import { LOOK_COST, SCORED_TREES, PRACTICE_TREES } from '../../../sim/planning/puzzles/trees'

/**
 * Part 2's instruction screens (spec §6, §4.4). None names what Step 3
 * tests before its reveal (spec §11, item 3).
 */

export type Step = 1 | 2 | 3

export const STEP_TITLES: Record<Step, string> = { 1: 'Step 1 — The tower', 2: 'Step 2 — Five procedures', 3: 'Step 3 — Looking costs' }

export interface StepScreen {
  step: Step
  title: string
  willDo: string[]
  minutes: number
  sitting: 'one sitting' | 'leave any time'
  sittingLine: string
  keys: string[]
  content: string[]
  kind: 'experiment' | 'exploration'
}

export const SCREENS: Record<Step, StepScreen> = {
  1: {
    step: 1,
    title: STEP_TITLES[1],
    kind: 'experiment',
    willDo: [
      'In this step you will solve a puzzle twice: the Tower of Hanoi with three disks, and then with four. The puzzle has three pegs, labeled left, middle, and right, and a stack of disks of different sizes on the left peg, the largest at the bottom. The goal is to move the whole stack to the right peg.',
      'The rules: only one disk may be moved at a time; only the top disk of a peg may be moved; and a larger disk may never be placed on top of a smaller one. To move a disk, click the peg it is on, which lifts its top disk, and then click the peg to put it on. A move that would place a larger disk on a smaller one is refused, with a line that says why, and is counted as an attempted move that was not legal. Clicking the same peg again puts the lifted disk back where it was, which does not count as a move.',
      'A counter shows how many moves you have made. There is no timer on the screen and no time limit, but the time of every move is recorded, as is every move and every refused attempt. Nothing is scored while you solve. When both puzzles are solved, the results of this step appear.',
      'Solve the puzzle in as few moves as you can, but finish it however you can: there is no penalty for extra moves.',
    ],
    minutes: 8,
    sitting: 'one sitting',
    sittingLine: 'Once you press “Begin”, finish each puzzle in one sitting. A puzzle you leave partway starts again from the beginning when you return, and the restart is noted on the results screen; a puzzle you have solved is saved and not played again.',
    keys: ['Click a peg to lift its top disk; click another peg to put the disk there. Click the same peg to put the disk back.'],
    content: [],
  },
  2: {
    step: 2,
    title: STEP_TITLES[2],
    kind: 'exploration',
    willDo: [
      'This step is an exploration. Five procedures, each a program that solves the Tower of Hanoi, run on the puzzle while you watch, and a table records what each one did. The procedures are explained in full on the right, with where each comes from.',
      '- Search everything examines arrangements in order of their distance from the start until it reaches the goal.',
      '- Goal recursion breaks the goal of moving a stack into smaller goals, nested inside one another.',
      '- Largest disk out of place looks at the pegs and works on the largest disk that is not yet on the right peg, and on whatever is in its way.',
      '- Move pattern repeats a fixed pattern of moves, and stores only whether the next move is odd or even.',
      '- Memorized moves applies a list of 15 moves, the solution for four disks, one after another.',
      'The slider “Disks” sets the number of disks, from 3 to 6. The setting “Start” chooses the usual start, every disk on the left peg, or “Scramble”, a legal arrangement drawn by your seed, with the goal still every disk on the right peg. Press a procedure’s “Run” to run it from the current start, animated at the speed the slider “Speed” sets; “Skip to the end” shows the result at once.',
      'Before the first run of each procedure, you are asked for a prediction about it, chosen from a short list, and committed with “Commit my prediction”. The prediction is saved, and the procedure runs only after it. The table fills as the procedures run: the moves each took; how many arrangements it examined; the most it had to store at once; whether it solved the puzzle from a scrambled start; and whether it solved the puzzle with one more disk than the current setting. Where a procedure cannot go on, the run stops and the panel says which procedure stopped and why.',
      'Beside the table, the futures panel has two sliders, “Options at each step” and “Steps ahead”. It prints the number of possible sequences of choices, and how long it would take to examine them all at about ten a minute, the rate the reading gives for people thinking aloud (§12.2.2). Two presets reproduce the reading’s numbers.',
      'Nothing here is scored. You can leave and come back, and run any procedure as often as you like.',
    ],
    minutes: 7,
    sitting: 'leave any time',
    sittingLine: 'You can leave and come back at any time. Your predictions stay committed; the table is filled again by running the procedures.',
    keys: ['“Disks” and “Speed” are sliders; “Start” is a pair of buttons, “Usual start” and “Scramble”.', 'Each procedure has a “Run” button. “Skip to the end” finishes the run on view at once.', '“Commit my prediction” commits the prediction asked before a procedure’s first run.'],
    content: [],
  },
  3: {
    step: 3,
    title: STEP_TITLES[3],
    kind: 'experiment',
    willDo: [
      `In this step you will choose paths through trees of hidden numbers, and earn points. A tree starts at a node at the top and branches into two choices at each of three steps: 2 nodes at the first step, 4 at the second, and 8 at the third, so 14 nodes in all and 8 paths from top to bottom. Each node is worth a number of points, which can be positive or negative, and the numbers are hidden when the tree appears.`,
      `Clicking a node uncovers its number, and each click costs ${LOOK_COST} point, shown on a large counter. You may uncover as many or as few nodes as you like, in any order. When you are ready, choose a path: click a first-step node, then one of the two second-step nodes under it, then one of the two third-step nodes under that, and press “Take this path”. You earn the sum of the three numbers on your path, minus the points your clicks cost. The three numbers on your path are shown; then every number is shown for one second, and the next tree appears.`,
      `There are ${PRACTICE_TREES} practice trees, which are not scored, and then ${SCORED_TREES} scored trees. Your running total is shown throughout. Every click, its order, your path and your points on every tree are recorded. When your last path is taken, the results of this step appear.`,
      'There is no time limit on a tree.',
    ],
    minutes: 7,
    sitting: 'one sitting',
    sittingLine: 'Once you press “Begin”, finish the trees in one sitting if you can. If you leave partway, the trees you have finished are kept, and when you return the step goes on with the remaining trees, drawn so that no tree is shown twice.',
    keys: ['Click a node to uncover its number, at a cost of 1 point.', 'Click one node at each step to choose your path, then press “Take this path”.'],
    content: [LONG_PAUSE_LINE.length ? NOT_OPTIMAL_LINE : ''].filter(() => false),
  },
}

export const READY_LINE = 'Nothing is needed. You will answer in the app. The report is filled in from the results screens afterward.'

/** The prediction asked before a procedure's first run (spec §6.3). */
export const PROCEDURE_PREDICTIONS: Record<string, { key: string; question: string; choices: string[] }> = {
  search: { key: 'p2-pred-search', question: 'The five-disk puzzle has 243 arrangements. How many of them will Search everything examine before it reaches the goal?', choices: ['fewer than 100', '100 to 200', 'more than 200'] },
  recursion: { key: 'p2-pred-recursion', question: 'How many goals will Goal recursion have to store at once, at most, on the six-disk puzzle?', choices: ['3', '6', '12', '63'] },
  largest: { key: 'p2-pred-largest', question: 'Will Largest disk out of place solve the puzzle from a scrambled start?', choices: ['yes', 'no'] },
  pattern: { key: 'p2-pred-pattern', question: 'Will Move pattern solve the puzzle with one more disk than the current setting, from the usual start?', choices: ['yes', 'no'] },
  memorized: { key: 'p2-pred-memorized', question: 'Will Memorized moves, the 15 moves of the four-disk solution, solve the five-disk puzzle?', choices: ['yes', 'no'] },
}
