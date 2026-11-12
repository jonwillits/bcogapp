import { BUILT_FOR_THE_EXPERIMENT_LINE, DRAWN_SIMPLY_LINE, EVERY_STEP_SEEN_LINE, FRESH_START_LINE, PROGRAMMED_HOMININS_LINE, THE_ELDER_LINE } from '../lines'
import { NEED_TABLE, NEEDS } from '../../../sim/planning/range/needs'
import { TESTS, TEST_IDS, RUN_DAYS } from '../../../sim/planning/tests'
import { HOMININ_LABEL, type HomininKind } from '../../../sim/planning/hominins/types'
import { MORNING_SECONDS, WINDOW_SECONDS, HANDS } from '../../../sim/planning/range/places'
import { TIME_SCALE } from '../../../sim/planning/studentDay'

/**
 * Part 3's texts (spec §7, §4.4): the instruction screens, the table of
 * what each need takes, the tests as the menu describes them, the five
 * procedures as the diagnosis lists them (in plain words, without
 * letters), and the information card on Homo erectus. Nothing before Step
 * 4's reveal says which hominin follows which procedure.
 */

export type Step = 1 | 2 | 3 | 4

export const STEP_TITLES: Record<Step, string> = { 1: 'Step 1 — A day in the range', 2: 'Step 2 — The usual day', 3: 'Step 3 — The chain of tests', 4: 'Step 4 — What each one was doing' }

/** What to press when a step is done, named without ambiguity, at the end of its instructions (Jon, 2026-11-09). */
export const NEXT_LINE: Record<Step, string> = {
  1: 'When both days are saved, press “Go on to Step 2” on the left.',
  2: 'When you have run the usual day and watched what you want to see, press “Go on to Step 3” on the left.',
  3: 'When your diagnosis is committed, press “Go on to Step 4” on the left.',
  4: 'When you have read what each one was doing, move on to Part 4 by pressing “Go on to Part 4” on the left, or choose the Corn tab at the top left.',
}

export interface StepScreen {
  step: Step
  title: string
  reread?: string
  willDo: string[]
  minutes: number
  sitting: 'one sitting' | 'leave any time'
  sittingLine: string
  keys: string[]
  content: string[]
  kind: 'experiment' | 'exploration'
  predictions: { key: string; question: string; choices: string[] }[]
}

const realMinutes = (rangeSeconds: number) => `${(rangeSeconds / TIME_SCALE / 60).toFixed(1)} minutes`

export const TEST_DESCRIPTION: Record<string, string> = {
  T1: 'vultures circle over the grassland; a carcass is on the grassland at midday; the elder is at camp.',
  T2: 'vultures circle on every day, but on every day the carcass is gone before anyone can reach it; the elder is at camp, and after the first day she does not go to the grassland.',
  T3: 'hyenas whoop at dawn near the old kill; bones with marrow are at the old kill at midday; the elder is at camp.',
  T4: 'rain fell in the night and winged termites rise; termites are at the mounds at midday; the elder is at camp.',
  T5: 'the flats are dry and cracked; tubers are in the dry flats at midday; the elder is at camp.',
  T6: 'as T4, but the elder left before dawn and is away all morning.',
}

export const TEST_TAKES_AWAY: Record<string, string> = {
  T1: 'nothing: it is the usual day.',
  T2: 'the outcome that followed the usual errands, as reinforcer devaluation does in Module 5: the errands can be done, but the carcass is never there.',
  T3: 'the usual need: the new need, marrow, is one each hominin has been rewarded for before.',
  T4: 'any reward for this need: no hidden hominin has ever been rewarded for carrying a probe, but each has seen every step of making and using one.',
  T5: 'the same, with a need that takes four preparatory acts.',
  T6: 'the elder to watch.',
}

export const SCREENS: Record<Step, StepScreen> = {
  1: {
    step: 1,
    title: STEP_TITLES[1],
    kind: 'experiment',
    reread: 'It may help to reread §12.1.3 and §12.1.4 of the reading, on the first hominins and Homo erectus, before this part.',
    willDo: [
      'In this step you control a Homo erectus-like hominin through two days on a landscape in eastern Africa, about 1.7 to 1.5 million years ago. You see the landscape from the hominin’s own eyes, or from behind it. The “View” setting on the left switches between the two. The arrow keys or W, A, S and D walk and turn, as in Labs 9 and 10. The arrow buttons under the view do the same with the mouse.',
      'Your hominin has two hands. Press “J” to use the left hand and “K” to use the right. An empty hand picks up the nearest item within reach. A full hand puts its item down in front of you. Press “Enter” to make an item from what you hold. A button for each possible act appears under the view, with its key, and only while the act is possible.',
      'The landscape has eight marked places.',
      '- At the center is the camp, where the band sleeps.',
      '- The riverbank, with rounded cobbles that can be picked up.',
      '- The outcrop, an area of stone that breaks into pieces with a sharp edge.',
      '- The woodland edge, with straight saplings that can be picked up.',
      '- The grassland, where carcasses appear and can be cut for meat.',
      '- The old kill, with scattered large bones from a kill long past.',
      '- The termite mounds, where termites can be taken with a probe.',
      '- The tuber flats, where tuber vines grow.',
      'A lone large tree, a low ridge, and the stream are landmarks. You can use them to keep your direction.',
      `A day begins at dawn, at camp. Each day begins with a cue. The cue is a sign of which kind of food will appear at midday that day. You can see or hear the cue from camp, and the line over the view names it. The morning lasts ${MORNING_SECONDS} seconds on the range clock, about ${realMinutes(MORNING_SECONDS)} of your time. The clock over the view shows how much of the morning is left.`,
      `During the morning you can walk, pick up an item, put down an item, and make an item. You can hold at most ${HANDS} items, one in each hand. To pick up a third item, you must first put one down. An item you put down stays where you left it, and you can pick it up again.`,
      'Some items can be made from others. At the outcrop, if you hold a cobble, you can make a flake by striking the cobble on the outcrop’s stone. The flake lands on the ground in front of you. You can pick it up if a hand is free. If you hold a sapling, you can strip it into a probe, anywhere. If you hold a sapling and a flake, you can sharpen the sapling into a digging stick, anywhere; the flake is kept. Making takes time, shown as a bar under the view.',
      `At midday, the food the cue pointed to appears at its place. It stays for ${WINDOW_SECONDS} seconds of range time. If you reach the place within that window holding what the food takes, your hominin eats. The table “What each need takes”, on the right, says which cue goes with which food, where the food appears, what it takes, and the preparatory acts.`,
      'The elder is at camp at dawn. Her errands are set by the scene to fit the day’s need, so watching her is one way to learn the range. A white ring at her feet and the label “the elder” mark her. A yellow ring marks your own hominin.',
      'The two days: a day of vultures, then a day of hyenas. Nothing in this step is scored. It is here so that you learn the range, the items, the two-hand limit, making, and the timing of a morning, before you test the hidden hominins in Steps 2 and 3.',
      'Every act and every move is recorded for the day’s summary, which is shown at the end of each day.',
    ],
    minutes: 6,
    sitting: 'one sitting',
    sittingLine: 'Once you press “Begin”, finish each day in one sitting. A day you leave partway starts again from dawn when you return; a day you have finished is saved and not played again.',
    keys: ['The arrow keys, or W, A, S and D, walk and turn. Up or W walks forward; left and right, or A and D, turn; down or S steps back. The drive pad under the view does the same.', '“J” uses the left hand and “K” the right. An empty hand picks up the nearest item within reach; a full hand puts its item down in front of you. The buttons under the view do the same and name the key.', '“Enter” makes what your hands allow where you stand: a flake at the outcrop, a probe, or a digging stick. Its button under the view names the making.', '“Narrower view” and “Low detail” on the left change only how the range is drawn.'],
    content: [BUILT_FOR_THE_EXPERIMENT_LINE, DRAWN_SIMPLY_LINE],
    predictions: [],
  },
  2: {
    step: 2,
    title: STEP_TITLES[2],
    kind: 'exploration',
    reread: 'It may help to reread §12.1.2 and §12.2.1 of the reading before this step: acting for the future in other animals, and the three procedures that could produce it. And recall Morgan’s Canon from Module 2: a behavior should not be explained by a higher mental process if a simpler one accounts for it.',
    willDo: [
      'From this step on, the range holds five hidden hominins, A to E, and the elder. Each hidden hominin follows a program with a procedure of its own, which you cannot see. Which letter has which procedure is set by your run seed. The elder is not hidden and follows no procedure: her errands are set by the scene to fit each day’s need.',
      'Before the lab, each hidden hominin lived a history of days in this same range. Every run starts each hominin from where it stood at the end of that history, and a hominin that learns goes on learning within a run. Each hidden hominin follows its procedure on about 85% of days; on the rest it does one of the four needs’ preparations, chosen at random, so one run is informative but not exact.',
      `A run is ${RUN_DAYS} days of one test, for all five hidden hominins at once, with the elder. For each day and each hominin, the run records whether the hominin reached the need’s place within the window holding what the need takes, which is to say whether it ate. The table on the right records, for each hominin and each test, the share of days on which it did, with the number of runs in brackets.`,
      'This step runs T1, the usual day, for all five: vultures over the grassland, a carcass on the grassland at midday, the elder at camp. Day 1 plays in the view; the other nine days are computed, and “Watch day n” plays any day at the speed the slider sets. First, predict whether any of the five will differ on T1, and press “Commit my prediction”. Then press “Run T1 for all five”.',
      'Before the first run can start, the hominins’ histories have to be lived, which takes a few seconds; a line on the left says how far along that is.',
    ],
    minutes: 4,
    sitting: 'leave any time',
    sittingLine: 'You can leave and come back at any time. Your prediction stays committed; the runs are not saved, so the table empties on a reload.',
    keys: ['“Run T1 for all five” runs ten days of T1.', '“Watch day n” plays a day of the last run in the view; the slider “Speed” sets how many seconds of range time pass in a second.', '“Follow” chooses whose point of view the camera takes, or the view from above.'],
    content: [PROGRAMMED_HOMININS_LINE, FRESH_START_LINE, THE_ELDER_LINE],
    predictions: [{ key: 'p3-s2', question: 'Will any of the five hidden hominins differ from the others on T1, the usual day?', choices: ['yes', 'no'] }],
  },
  3: {
    step: 3,
    title: STEP_TITLES[3],
    kind: 'exploration',
    willDo: [
      'In this step you choose tests from the menu, T1 to T6, and run them as often as you like, to find out what each hidden hominin does. Each test takes away one thing a hominin’s behavior might depend on, and a hominin whose behavior changes under a test depended on it. A counter shows the runs you have used; it does not limit them.',
      'The tests:',
      ...TEST_IDS.map((t) => `- ${t} ${TESTS[t].title}: ${TEST_DESCRIPTION[t]}`),
      'For T1 and T3 to T6, the table records the share of days on which each hominin ate. For T2, it records on which days each hominin carried a flake to the grassland, as a strip of ten days, and the share over days 2 to 10.',
      'Before your first run, predict how many of the five you will be able to tell apart with T1 to T6, and commit. When you can say what each hominin is doing, match each of A to E to one of the five descriptions of procedures on the left, given in plain words, and press “Commit my diagnosis”. Nothing about any hominin’s procedure is shown until then.',
    ],
    minutes: 12,
    sitting: 'leave any time',
    sittingLine: 'You can leave and come back at any time. Your prediction and your diagnosis, once committed, stay committed; the runs are not saved, so the table empties on a reload.',
    keys: ['“Test” chooses a test; “Run 10 days” runs it for all five.', '“Watch day n” plays any day of any run; “Speed” and “Follow” are as in Step 2.', '“Commit my diagnosis” commits your matching of letters to procedures, once every letter is placed.'],
    content: [PROGRAMMED_HOMININS_LINE, FRESH_START_LINE],
    predictions: [{ key: 'p3-s3', question: 'How many of the five hidden hominins will you be able to tell apart with T1 to T6?', choices: ['all five', 'four', 'three or fewer'] }],
  },
  4: {
    step: 4,
    title: STEP_TITLES[4],
    kind: 'exploration',
    willDo: [
      'This step opens once your diagnosis in Step 3 is committed. It states each letter’s procedure in full beside your diagnosis; shows, beside your table, the full matrix from runs made when this lab was built, over 20 seeds of ten-day runs; says, for each test, what it took away; shows the setting for the Shallow planner, which was hidden until now; and describes, in a sentence each, the design of three studies from the reading.',
      'The matrix is computed in this browser when the step opens, a slice at a time, and a line says how far along it is.',
    ],
    minutes: 6,
    sitting: 'leave any time',
    sittingLine: 'You can leave and come back at any time.',
    keys: ['“What the Shallow planner counts at the end of its search” switches the Shallow planner between its two variants for your later runs.'],
    content: [PROGRAMMED_HOMININS_LINE],
    predictions: [],
  },
}

/** The five procedures as the diagnosis lists them: plain words, no letters, no names (spec §7.6). The names appear only after the commit. */
export const PROCEDURE_DESCRIPTIONS: Record<HomininKind, string> = {
  adapted: 'Every morning, whatever the cue, it fetches a cobble, makes a flake at the outcrop, and goes to the grassland, where the usual need arrives. It uses what it carries on whatever need it meets there. Nothing in it learns.',
  learnedValue: 'It chooses its errands by values learned from the reward that followed its own errands on past mornings: an actor and a critic, learning from the difference between what happened and what the critic estimated, with discounting. What it learns about is the morning’s cue, what it is holding, and where it is. It learns only from its own rewards, and represents no state of the world that its errands bring about.',
  copier: 'On a morning when the elder is at camp, it picks up and makes what the elder picks up and makes that morning, and goes where she goes. On a morning when the elder is away, it chooses from values learned from its own past rewards, as the previous procedure does.',
  shallow: 'It learns a model from everything it has seen, its own errands and the elder’s: what each cue is followed by, what each act makes from what, and what each place yields with what in hand. Each morning it searches its model for the sequence of up to two preparatory acts, followed by going to a place, with the highest expected chance of food.',
  planner: 'It learns the same kind of model, and searches it for the best sequence of acts that fits in the morning, with no limit on the number of steps.',
}

export const PROCEDURE_SECTION: Record<HomininKind, string> = {
  adapted: '§12.2.1, the simplest procedure: adapted actions, each suited to its own situation, with nothing linking them',
  learnedValue: '§12.2.1, model-free choice: a value learned from the reward that followed, by Lab 5’s Verdict setting',
  copier: 'copying, with model-free choice as its fallback',
  shallow: '§12.2.1 and §12.2.3, model-based choice with a depth limit on its search',
  planner: '§12.2.1, planning: choosing a sequence of acts by working through their predicted consequences before acting',
}

export const HOMININ_LABELS = HOMININ_LABEL

/** The table shown throughout Part 3 (spec §7.3). */
export const NEEDS_TABLE_LINES: string[] = [
  `${'need'.padEnd(28)}${'the morning’s cue'.padEnd(52)}${'where'.padEnd(20)}${'what it takes'.padEnd(24)}preparatory acts`,
  ...NEEDS.map((n) => {
    const s = NEED_TABLE[n]
    const acts = n === 'carcass' ? '2: fetch a cobble; make a flake at the outcrop' : n === 'marrow' ? '1: fetch a cobble' : n === 'termites' ? '2: fetch a sapling; strip it' : '4: fetch a cobble; make a flake at the outcrop; fetch a sapling; sharpen it'
    return `${s.label.padEnd(28)}${s.cueLabel.padEnd(52)}${placeName(s.place).padEnd(20)}${s.takesLabel.padEnd(24)}${acts}`
  }),
]

export function placeName(p: string): string {
  return p === 'camp' ? 'the camp' : p === 'riverbank' ? 'the riverbank' : p === 'outcrop' ? 'the outcrop' : p === 'woodland' ? 'the woodland edge' : p === 'grassland' ? 'the grassland' : p === 'oldKill' ? 'the old kill' : p === 'mounds' ? 'the termite mounds' : 'the tuber flats'
}

export const ERECTUS_CARD = {
  title: 'Homo erectus, from the reading (§12.1.4)',
  lines: [
    'Homo erectus appears in Africa about 1.9 million years ago. It had a larger body than earlier hominins: its adults weighed around 52 to 55 kilograms (about 115 to 120 pounds), against about 40 kilograms (about 90 pounds) for australopiths, and its thigh bones were longer and stronger.',
    'It is the first hominin whose fossils are found outside Africa: in Georgia, in the Caucasus, by 1.85 million years ago, and on Java by 1.66 million years ago. Its early brains were about 800 to 860 cubic centimeters, against about 460 to 480 for australopiths and about 1,350 to 1,400 for people today.',
    'Acheulean tools, large cutting tools including hand axes shaped on both faces, were made from about 1.7 million years ago. The stones are evidence of what was made; how the making was organized is an inference.',
  ],
  footer: DRAWN_SIMPLY_LINE,
}

export const EVERY_STEP_SEEN = EVERY_STEP_SEEN_LINE
export const READY_LINE = 'Nothing is needed. You will answer in the app. The report is filled in from the results screens afterward.'

export const THREE_STUDIES = [
  'The zoo chimpanzee (Opening, Close): keepers at a zoo in Sweden recorded one chimpanzee for about ten years. On many mornings, before the zoo opened and with no visitors present, he gathered stones from the water and piled them on the shore facing the visitors; hours later, during displays, he threw them. No test that tells the procedures apart was run.',
  'The apes and the ravens (§12.1.2, §12.2.1): bonobos and orangutans were offered eight objects, two of which would work as a tool on an apparatus they had practiced with; many chose a suitable tool, carried it away, and brought it back an hour later, or overnight, when the apparatus was available again. Ravens chose a tool, or a token they had learned to exchange for food, and used it 15 minutes or 17 hours later. In both studies the animals had already been rewarded for using the very tools and tokens they later chose.',
  'The scrub jays (§12.1.2, §12.2.1): for six mornings, after a night without food, each jay spent two hours in one of two compartments, with breakfast in one and nothing in the other. Given their first chance to cache pine nuts one evening, the jays cached about three times as many in the compartment where they had gone without breakfast. In a second test, each compartment came with a different breakfast food, and the jays cached more of the food they had not been given in each compartment. The jays had no history of caching in either compartment.',
]
