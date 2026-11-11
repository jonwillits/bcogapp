import { LONG_PAUSE_LINE, NOT_OPTIMAL_LINE } from '../lines'
import { LOOK_COST, SCORED_TREES, PRACTICE_TREES } from '../../../sim/planning/puzzles/trees'

/**
 * Part 2's instruction screens (spec §6, §4.4). None names what Step 3
 * tests before its reveal (spec §11, item 3).
 */

export type Step = 1 | 2 | 3

export const STEP_TITLES: Record<Step, string> = { 1: 'Step 1 — The tower', 2: 'Step 2 — Five procedures', 3: 'Step 3 — Looking costs' }

/** What to press when a step is done, named without ambiguity, at the end of its instructions and on its finished stage (Jon, 2026-11-09). */
export const NEXT_LINE: Record<Step, string> = {
  1: 'When both puzzles are solved, the results appear on the right. To move on, press “Go on to Step 2” on the left.',
  2: 'This step is an exploration with no end of its own. When you have seen the procedures you want to see, press “Go on to Step 3” under the fifth procedure or on the left.',
  3: 'When the last path is taken, the results appear on the right. To move on to Part 3, choose the Band tab at the top left.',
}

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
      'In this step you will solve the Tower of Hanoi puzzle. You will do it twice, once with three disks, and then with four. The puzzle has three pegs, labeled left, middle, and right, and a stack of disks of different sizes on the left peg, the largest at the bottom. The goal is to move the whole stack to the right peg.',
      'The rules: only one disk may be moved at a time; only the top disk of a peg may be moved; and a larger disk may never be placed on top of a smaller one. To move a disk, click the peg it is on, which lifts its top disk, and then click the peg to put it on. A move that would place a larger disk on a smaller one is refused, with a line that says why. Clicking the same peg again puts the lifted disk back where it was, which does not count as a move.',
      'A counter shows how many moves you have made. There is no timer on the screen and no time limit, but the time of every move is recorded, as is every move and every refused illegal attempt. When both puzzles are solved, the results of this step appear.',
      'Solve the puzzle in as few moves as you can, but finish it however you can.',
    ],
    minutes: 8,
    sitting: 'one sitting',
    sittingLine: 'Once you press “Begin”, finish each puzzle in one sitting. A puzzle you leave partway starts again from the beginning when you return, and the restart is noted on the results screen; a puzzle you have solved is saved and not played again for the record. After the results, you can play either puzzle again, unrecorded.',
    keys: ['Click a peg to lift its top disk; click another peg to put the disk there. Click the same peg to put the disk back.'],
    content: [],
  },
  2: {
    step: 2,
    title: STEP_TITLES[2],
    kind: 'exploration',
    willDo: [
      'This step is an exploration. We will show you five procedures that solve the Tower of Hanoi problem. They will be run on the puzzle while you watch. You will be able to see the results in a table on the right. The procedures are run one at a time in the middle of the screen. For each procedure, you will read a short description of it, make a prediction about it, and then run it on the puzzle at any setting you choose.',
      '- Search everything examines arrangements in order of their distance from the start until it reaches the goal.',
      '- Goal recursion breaks the goal of moving a stack into smaller goals, nested inside one another.',
      '- Largest disk out of place looks at the pegs and works on the largest disk that is not yet on the right peg, and on whatever is in its way.',
      '- Move pattern repeats a fixed pattern of moves, and stores only whether the next move is odd or even.',
      '- Memorized moves applies a list of 15 moves, the solution for four disks, one after another.',
      'For each procedure, first read its description. Then pick a prediction from the short list and press “Commit my prediction”. Your prediction is saved. You can run the procedure only after you have made it. Once you have committed, the puzzle appears under the description. Use the slider “Disks” to set the number of disks, from 3 to 6. Use “Start” to choose the usual start, with every disk on the left peg, or “Scramble”, a legal arrangement drawn by your seed. The goal is still to get every disk on the right peg. Press “Run” to run the procedure from the current start. Use the slider “Speed” to set how fast the moves are animated. Press “Skip to the end” to see the result at once. Under your prediction, we tell you which setting to use to check it.',
      'In the table on the right you will see, for each procedure: the moves it took; how many arrangements it examined; the most it had to store at once; whether it solved the puzzle from a scrambled start; and whether it solved the puzzle with one more disk than the current setting. If a procedure cannot go on, the run stops, and we tell you under the table which procedure stopped and why. Under the puzzle there is a map of every arrangement of the disks. The arrangements the run passed through are marked on it. Point at any dot to see that arrangement drawn beside the map.',
      'When a procedure has run, press “Go on to the next procedure”. You can also click any of the five names in the row at the top of the panel to go to that procedure, at any time. Use it to come back to a procedure, or to pick up where you left off.',
      'Beside the table, the futures panel has two sliders, “Options at each step” and “Steps ahead”. It prints the number of possible sequences of choices, and how long it would take to examine them all at about ten a minute, the rate the reading gives for people thinking aloud (§12.2.2). Two presets reproduce the reading’s numbers.',
      'Nothing here is scored. You can leave and come back, and run any procedure as often as you like.',
    ],
    minutes: 7,
    sitting: 'leave any time',
    sittingLine: 'You can leave and come back at any time. Your predictions stay committed. When you come back, you start at the first procedure you have not yet predicted, and you fill the table again by running the procedures.',
    keys: ['Click any of the five names at the top of the panel to go to that procedure.', 'Press “Commit my prediction” to commit the prediction asked before a procedure’s first run.', '“Disks” and “Speed” are sliders; “Start” is a pair of buttons, “Usual start” and “Scramble”.', 'Press “Run” to run the procedure on view; press “Skip to the end” to finish the run at once.', 'Press “Go on to the next procedure” to move to the next one; under the fifth, “Go on to Step 3”.'],
    content: [],
  },
  3: {
    step: 3,
    title: STEP_TITLES[3],
    kind: 'experiment',
    willDo: [
      `In this step you will choose paths through trees of hidden numbers, and earn points. A tree starts at a node at the top. It branches into two choices at each of three steps: 2 nodes at the first step, 4 at the second, and 8 at the third. That makes 14 nodes, and 8 paths from top to bottom. Each node is worth a number of points, positive or negative. The numbers are hidden when the tree appears.`,
      `Click a node to uncover its number. Each click costs ${LOOK_COST} point. You may uncover as many or as few nodes as you like, in any order. When you are ready, choose a path: click a first-step node, then one of the two second-step nodes under it, then one of the two third-step nodes under that. Then press “Take this path”. You earn the sum of the three numbers on your path, minus the points your clicks cost. Under the tree you can see a running score: your clicks, the numbers on your path so far, and the total.`,
      `After you take a path, you will see the numbers on your path and your points for that tree. Press “Next tree” to go on. On the practice trees, every number is shown after you take your path, so you can see what you missed. On the tests, only the numbers on your path are shown.`,
      `There are ${PRACTICE_TREES} practice trees, labeled Practice 1 to ${PRACTICE_TREES}, which are not scored, and then ${SCORED_TREES} tests, labeled Test 1 to ${SCORED_TREES}. Your total over the tests is shown throughout. Every click, its order, your path and your points on every tree are recorded. When your last path is taken, the results of this step appear.`,
      'There is no time limit on a tree. You can see these instructions again at any time: press “Show the instructions again” on the left.',
    ],
    minutes: 7,
    sitting: 'one sitting',
    sittingLine: 'Once you press “Begin”, finish the trees in one sitting if you can. If you leave partway, the trees you have finished are kept, and when you return the step goes on with the remaining trees, drawn so that no tree is shown twice.',
    keys: ['Click a node to uncover its number, at a cost of 1 point.', 'Click one node at each step to choose your path, then press “Take this path”.', 'Press “Next tree” to go on to the next tree.', 'Press “Show the instructions again” on the left to see this screen again.'],
    content: [LONG_PAUSE_LINE.length ? NOT_OPTIMAL_LINE : ''].filter(() => false),
  },
}

export const READY_LINE = 'Nothing is needed. You will answer in the app. The report is filled in from the results screens afterward.'

/** The prediction asked before a procedure's first run (spec §6.3), and the line under the committed prediction that says which setting checks it (Jon's walk, 2026-11-11). */
export const PROCEDURE_PREDICTIONS: Record<string, { key: string; question: string; choices: string[]; check: string }> = {
  search: { key: 'p2-pred-search', question: 'The five-disk puzzle has 243 arrangements. How many of them will Search everything examine before it reaches the goal?', choices: ['fewer than 100', '100 to 200', 'more than 200'], check: 'To check it, set “Disks” to 5, keep the usual start, and press “Run”. Then look at the “examined” column of the table.' },
  recursion: { key: 'p2-pred-recursion', question: 'How many goals will Goal recursion have to store at once, at most, on the six-disk puzzle?', choices: ['3', '6', '12', '63'], check: 'To check it, set “Disks” to 6 and press “Run”. As it runs, watch the count of goals on the stack beside the pegs. Afterward, look at the “stored” column of the table.' },
  largest: { key: 'p2-pred-largest', question: 'Will Largest disk out of place solve the puzzle from a scrambled start?', choices: ['yes', 'no'], check: 'To check it, choose “Scramble” and press “Run”. Then look at the “scrambled” column of the table.' },
  pattern: { key: 'p2-pred-pattern', question: 'Will Move pattern solve the puzzle with one more disk than the current setting, from the usual start?', choices: ['yes', 'no'], check: 'To check it, keep the usual start and press “Run”. Then look at the last column of the table.' },
  memorized: { key: 'p2-pred-memorized', question: 'Will Memorized moves, the 15 moves of the four-disk solution, solve the five-disk puzzle?', choices: ['yes', 'no'], check: 'To check it, set “Disks” to 5, keep the usual start, and press “Run”.' },
}
