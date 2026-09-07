/**
 * The words the Unit tab uses. (A biological / artificial toggle that changed
 * every word and no number was built for the spec's Q27 and removed with that
 * question on 2026-09-07 — a lab already full, and a minor loss.) This file is
 * the algorithmic level's vocabulary and nothing else:
 * the chapter's §3.2 names no part of a cell, and neither does anything here.
 * `NeuronScene.naming.test.ts` reads this file and `UnitTab.tsx` and fails on
 * any anatomical term, because the anatomical word is the obvious one to
 * print beside each of these and the chapter's arrangement forbids it.
 *
 * The four elements are named by the job each does. The words for the parts
 * that fill those jobs live in the Membrane tab's own labels file, which the
 * Unit tab must not import.
 */

export interface UnitVocabulary {
  /** The thing being described. */
  cell: string
  /** The four roles, in flow order. */
  inputSurface: string
  integrator: string
  outputLine: string
  junction: string
  /** A rate coming in or going out. */
  rate: string
  rateUnit: string
  /** What a connection's number is called. */
  strength: string
  /** The constant term. */
  baseline: string
  /** What the cell does with its inputs. */
  integrate: string
  /** One event of output. */
  spike: string
  /** The sequence of them. */
  spikeTrain: string
}

export const BIOLOGICAL: UnitVocabulary = {
  cell: 'neuron',
  inputSurface: 'input surface',
  integrator: 'integrator',
  outputLine: 'output line',
  junction: 'junction',
  rate: 'rate',
  rateUnit: 'spikes/s',
  strength: 'connection strength',
  baseline: 'baseline',
  integrate: 'integration',
  spike: 'spike',
  spikeTrain: 'spike train',
}


/**
 * The one-number-two-names line the panel prints, per spec §2.2. Lab 1 fixed
 * *connection strength* and *actuator bias*; the reading calls the same two
 * quantities a *weight* and a *baseline*. Both names, once, as an equivalence.
 */
export const EQUIVALENCE_LINES = [
  'connection strength (Lab 1)  =  weight (the reading)  =  b₁, b₂',
  'actuator bias (Lab 1)  =  baseline (the reading)  =  b₀',
] as const
