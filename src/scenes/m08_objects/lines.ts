/**
 * The lines on screen that are content, not decoration (Module 8 spec §8).
 * Each is short, each has a string test in `naming.test.ts`, and each sits
 * on the panel the spec names.
 */

/** 1. Every tab. */
export const NETWORKS_LINE =
  'A network here is an artificial neural network run on a computer: a model, not a brain.'

/** 2. Every tab. */
export const TRAINED_BEFORE_LINE =
  'These networks were trained before this lab, and nothing done here changes them. The one exception is the readout unit in Part 3.'

/** 3. Parts 2 to 4 and the Closer. */
export const OUR_NETWORKS_LINE =
  'These are our networks, not the ones in the reading, so their numbers differ from the reading’s.'

/** 4. Draw. */
export const POOLING_LINE =
  'Pooling keeps the strongest response in a small neighborhood and gives up exactly where it was. That is Module 7’s trade.'

/** 5. Draw. */
export const BUILT_IN_LINE =
  'Centering and scaling is done before the network receives the drawing. It is built in, not learned.'

/** 6. Parts. */
export const ERASERS_LINE =
  'Biederman’s drawings were made by hand, and in his nonrecoverable versions the remaining lines were arranged to run smoothly across the joints. These erasers only approximate his two kinds of deletion.'

/** 7. Views. */
export const READOUT_LINE = 'Only this one unit learns. The layers beneath it are frozen.'

/** 8. Noise and Closer, beside the blur-trained network. */
export const EYE_LINE =
  'A photograph is sharp everywhere. A human eye sees sharply only at the center of gaze (§8.2.4).'

/** 9. Closer. */
export const CLOCK_LINE =
  'A network that gives people’s answers is not thereby shown to work the way a brain does.'

/** 10. Draw. */
export const PRIVACY_LINE = 'Drawings stay in this browser. Nothing is sent anywhere.'

/** 11. Each glimpse test, while glimpse mode is in use. */
export const GLIMPSE_LINE = 'The picture appears for about a fifth of a second, then a mask.'

/** Printed under a scorecard when a rate of 0 or 1 was repaired before taking its z. */
export const CORRECTION_LINE =
  'A rate of exactly 0 or 1 has no z, so it was counted as half a response short of the end, as in Lab 7’s By hand box.'

/** The honesty line about the larger tests. */
export const LARGER_TEST_LINE =
  'The larger test was scored when the lab was built, on images that do not ship, with the same networks and the same noise.'
