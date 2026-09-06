/**
 * The words the Membrane tab uses: the four parts of a neuron that fill the
 * four roles the Unit tab names, introduced where the chapter introduces them
 * — at the end of §3.3.1, not in §3.2. Kept apart from `unitLabels.ts` so the
 * naming test can assert the Unit tab never imports these.
 */

export const PARTS = {
  inputSurface: 'dendrites',
  integrator: 'soma',
  outputLine: 'axon',
  junction: 'synapse',
} as const

/** Role → part, for the switch-over caption when the tab changes. */
export const ROLE_TO_PART: { role: string; part: string; note: string }[] = [
  { role: 'input surface', part: PARTS.inputSurface, note: 'a branching spray of tendrils, thousands of them, each carrying a different source' },
  { role: 'integrator', part: PARTS.integrator, note: 'the cell body, where the arriving shifts in voltage combine' },
  { role: 'output line', part: PARTS.outputLine, note: 'one long fibre; here a 6 mm stretch of it, in 40 patches' },
  { role: 'junction', part: PARTS.junction, note: 'the gap where a spike becomes a chemical, and the chemical becomes a current' },
]
