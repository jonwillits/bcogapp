/**
 * The words the Module 4 scene uses for the two quantities Lab 1 named.
 *
 * Lab 1 fixed *connection strength* and *actuator bias* for the whole arc;
 * the chapter calls the same two quantities a *weight* and a *baseline*, and
 * Module 3 printed both as an equivalence. Module 4 is where the network
 * vocabulary takes over, so the panel leads with weight and baseline and
 * keeps the older names visible once, because Lab 1's panel is what a
 * student is remembering.
 */
export const EQUIVALENCE_LINES = [
  'weight (the reading)  =  connection strength (Lab 1)  =  b₁, b₂',
  'baseline (the reading)  =  actuator bias (Lab 1)  =  b₀',
] as const

/** Where the scene is not being literal, said on its own face. */
export const HONESTY_LINE =
  'The real worm uses a handful of interneurons where this shows one. One is enough to make the verdict.'
