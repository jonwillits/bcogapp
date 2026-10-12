/**
 * The scene's configuration (spec §7): which viewing mode each student
 * test runs in, the glimpse duration, the deletion level, and the trial
 * counts. Until Jon chooses, both modes exist for every test and a
 * developer control (shown only with `?dev=1`) switches them live; once he
 * has chosen, the mode is fixed here and the control for that test goes.
 */

export type TestId = 'parts' | 'views' | 'noise'
export type TestMode = 'glimpse' | 'free'

export const TEST_LABEL: Record<TestId, string> = { parts: 'Part 2: contour deletion', views: 'Part 3: views', noise: 'Part 4: noise' }
export const MODE_LABEL: Record<TestMode, string> = { glimpse: 'glimpse', free: 'free' }

/**
 * Part 2 and Part 3 are fixed as free (Jon, 2026-10-12, on his walk);
 * their switches are gone from the developer control and `config.test.ts`
 * pins them. Part 4 loads as glimpse, the spec's preference, and keeps
 * its switch until Jon decides.
 */
export const DEFAULT_MODES: Record<TestId, TestMode> = { parts: 'free', views: 'free', noise: 'glimpse' }
/** The tests whose mode is still Jon's to choose; only these get a switch in the developer control. */
export const UNDECIDED_TESTS: TestId[] = ['noise']

/** About a fifth of a second, scheduled on animation frames; the duration actually shown is logged on every trial. */
export const GLIMPSE_MS = 200

/** The share of ink each eraser removes in the student's test. The larger test also runs at 0.35 and 0.65. */
export const DELETION_LEVEL = 0.5
/** Twelve drawings, six per eraser. */
export const PART2_TRIALS = 12
/** Twelve photographs per condition: clean, noise A, noise B. */
export const PART4_PER_CONDITION = 12
/** Test views per condition in Part 3: 4 (24 trials) or 3 (18). Jon's call, 2026-10-12. */
export const VIEWS_PER_CONDITION: 3 | 4 = 4
/** How long each learned view's wobble is shown in the study phase, seconds. */
export const STUDY_SECONDS = 10
/** One press of *Skip ahead*. */
export const READOUT_SKIP = 50
/** The readout is trained until it reaches this share of its training images. */
export const READOUT_TARGET = 0.95
