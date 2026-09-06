/**
 * The energy calculator of the spec's §7, for Q20 and Q21.
 *
 * **It does not compute from the simulated cell.** The cell on the Membrane
 * tab is one soma and six millimetres of thin axon, and its ATP-per-spike
 * covers the pump work of one spike in that much membrane — none of the
 * synapses, transmitter, vesicles or housekeeping a whole cortical neuron pays
 * for. The calculator uses Lennie's published estimate for a whole neuron and
 * says so on its face; the simulated figure stays on the Membrane tab, where
 * only ratios matter and it is honest.
 */

/** Neurons in a human brain (Azevedo et al. 2009). */
export const NEURONS_IN_A_BRAIN = 86e9
/** ATP per action potential for a whole cortical neuron (Lennie 2003). */
export const ATP_PER_SPIKE_LENNIE = 2.4e9
/** Free energy of ATP hydrolysis under cellular conditions, joules per molecule (~50 kJ/mol). */
export const JOULES_PER_ATP = 50e3 / 6.022e23
/** The brain's resting power, watts, for comparison. */
export const BRAIN_WATTS = 20

/** The budget breakdown from the reading's §3.3.6 (Attwell & Laughlin 2001). */
export interface EnergyBudget {
  /** Share of the brain's energy that goes to signalling rather than housekeeping. */
  signallingShare: number
  /** Share of the signalling budget that action potentials take. */
  spikeShareOfSignalling: number
}

export const DEFAULT_BUDGET: EnergyBudget = {
  signallingShare: 0.75,
  spikeShareOfSignalling: 0.5,
}

/** Whole-brain power implied by every neuron firing at `rateHz`, watts. */
export function brainWatts(
  rateHz: number,
  neurons = NEURONS_IN_A_BRAIN,
  atpPerSpike = ATP_PER_SPIKE_LENNIE,
  budget = DEFAULT_BUDGET,
): number {
  const spikeWatts = neurons * rateHz * atpPerSpike * JOULES_PER_ATP
  return spikeWatts / (budget.signallingShare * budget.spikeShareOfSignalling)
}

/** The average firing rate a given whole-brain power can afford, spikes per neuron per second. */
export function affordableRateHz(
  watts: number,
  neurons = NEURONS_IN_A_BRAIN,
  atpPerSpike = ATP_PER_SPIKE_LENNIE,
  budget = DEFAULT_BUDGET,
): number {
  const spikeWatts = watts * budget.signallingShare * budget.spikeShareOfSignalling
  return spikeWatts / (neurons * atpPerSpike * JOULES_PER_ATP)
}
