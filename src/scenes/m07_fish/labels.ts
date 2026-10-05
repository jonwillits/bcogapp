/**
 * The lines on screen that are content, not decoration (Module 7 spec §9).
 * Each is short, each is asked about or leaned on by the handout, and
 * `naming.test.ts` asserts that each is on its panel.
 */

/** World tab. Jon's request: say where the turn toward a new thing comes from, and that it is not this lab's subject. */
export const ORIENTING_LINE =
  'Turning toward something new is not this network’s job. In a real fish, the tectum turns the head and eyes toward what appears (Module 6), and that circuit is built in. This lab is about what happens next.'

/** World tab. Or a student asks why the fish does not just look. */
export const MURKY_LINE =
  'The water is murky. The fish cannot see what is upstream: each thing reaches it first as a smell, and sees an eel only when the eel arrives.'

/** Network tab. §7.2.2 makes the same simplification. */
export const TWO_RECEPTORS_LINE =
  'A real fish has dozens of kinds of smell receptor. This fish has two, so that its smell space can be drawn.'

/** On the feature-space panel. */
export const DOTS_LINE =
  'The dots are the experimenter’s record, not the fish’s. The fish keeps nothing but its weights.'

/** Network tab. */
export const FOREBRAIN_LINE =
  'The network stands in for circuits in the fish’s forebrain, including its pallium (Module 6). It is a handful of units, not a map of them.'

/** Learning tab. In the convention of Lab 5's tier-four line: content, and the handout asks about it. */
export const BACKPROP_LINE =
  'No one has found backpropagation in a brain. The chapter’s §7.3.7 describes what it would need and the proposals that approximate it. This fish runs it to show what it can do.'

/** Learning tab, under the output's rule. §7.2.7: the target need not come from a teacher. */
export const TARGET_LINE = 'The target is the outcome, a moment later. Nothing inside the fish is a teacher.'

/** Learning tab: Lab 5's four third factors, as context and not as controls. */
export const LAB5_LINE =
  'Lab 5 offered four things a weight change could depend on: Coincidence, Prediction, Teacher and Verdict. This fish’s output unit uses Prediction, Φ = a − p, and nothing else.'

/** Network and Learning tabs, when learning is on over hidden units that are set by hand and still all zero. */
export const BLANK_HIDDEN_LINE =
  'Learning is on, but nothing can change yet. The hidden weights are set by hand and every one is still zero, so each hidden unit gives the same output for every smell. Set them on the Network tab, or choose Pass the error back or Fixed at random on the Learning tab.'

export const KIND_COLORS = {
  happens: '#4f9cff',
  doesNot: '#f0a94b',
} as const

/**
 * One color for each receptor: the specks of a smell in the stream, the two
 * receptors on the diagram, and the feature space's two axes. Neither is the
 * feature space's blue or orange.
 */
export const RECEPTOR_COLORS = {
  a: '#ff5fd2',
  b: '#b8f04a',
} as const

export const CURVE_COLORS = ['#ffd166', '#5ee6d6', '#ff6fae'] as const

/** What the outcome is called, by where the verdict goes. */
export const OUTCOME_WORDS = {
  dart: { happens: 'an eel was there', doesNot: 'no eel was there', verdict: 'dart to cover', quiet: 'stay and feed' },
  eat: { happens: 'good to eat', doesNot: 'not good to eat', verdict: 'eat', quiet: 'leave it' },
} as const

/** The four outcomes, named exactly as the chapter's table names them. */
export const SDT_NAMES = {
  hit: 'Hit',
  miss: 'Miss',
  falseAlarm: 'False alarm',
  correctRejection: 'Correct rejection',
} as const
