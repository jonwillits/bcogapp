import { makeRng } from '../random'
import { NeuronCell, type CellParams, type AxonGeometry, SPIKE_CROSSING_MV } from './cell'

/**
 * Instruments: things measured *from* a cell rather than read off its
 * parameters. Threshold, the maximum rate, the input–output curve and
 * conduction velocity all live here, and nothing in the scene may print any of
 * them from a constant — that rule is the point of half the acceptance tests.
 *
 * Every instrument builds a fresh cell from the parameters handed to it, on a
 * fixed seed, so a measurement is a pure function of the parameters and two
 * calls agree. The instrument's cell is not the scene's neuron and never shares
 * state with it; it is the same model, built the same way, asked a question.
 */

/** A short axon: instruments that only need the soma should not pay for 40 patches. */
const STUB_AXON: Partial<AxonGeometry> = { compartments: 2 }

/**
 * Threshold, measured. Brief current pulses are bisected between the largest
 * that fails and the smallest that fires; the voltage a just-failing pulse
 * reaches is where the sodium loop would have taken over — the threshold. It
 * comes out near −55 mV for the 1952 cell, and it moves when sodium
 * conductance is reduced, because it is a property of the loop and not a
 * number anyone typed.
 */
export function measureThreshold(params: Partial<CellParams> = {}): number {
  // A 5 ms pulse, weak enough that the passive response alone never reaches
  // the spike-counting level: the largest such pulse that fails peaks at the
  // voltage the sodium loop would have taken over from.
  const fires = (amp: number): { fired: boolean; peak: number } => {
    const cell = new NeuronCell(makeRng(11), params, STUB_AXON)
    cell.advance(30)
    cell.pulse(amp, 5)
    let peak = -100
    for (let i = 0; i < 60; i++) {
      cell.advance(0.25)
      peak = Math.max(peak, cell.v[0])
    }
    return { fired: cell.spikes.length > 0, peak }
  }
  let lo = 0
  let hi = 60
  let subPeak = -65
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    const r = fires(mid)
    if (r.fired) hi = mid
    else {
      lo = mid
      subPeak = r.peak
    }
  }
  return subPeak
}

/**
 * The cell's ceiling: the highest sustained rate it reaches under any steady
 * drive, spikes per second. Swept over injected current and the maximum taken,
 * so it is unaffected by depolarisation block at the top of the sweep.
 */
export function measureCeiling(params: Partial<CellParams> = {}): number {
  let best = 0
  for (const i of [6, 8, 10, 12, 15, 18, 22, 26, 30, 35, 40, 50, 60, 80]) {
    const cell = new NeuronCell(makeRng(12), { ...params, iInject: i }, STUB_AXON)
    cell.advance(300)
    const before = cell.spikes.length
    cell.advance(1000)
    best = Math.max(best, cell.spikes.length - before)
  }
  return best
}

/**
 * The measured input–output curve: output rate at each linear total T, driven
 * the way the scene drives the cell — the total delivered as unit-weight
 * events at rate T. Returned in the same order as `totals`.
 */
export function measureSweep(
  totals: readonly number[],
  params: Partial<CellParams> = {},
  seconds = 2,
): number[] {
  return totals.map((T) => {
    const cell = new NeuronCell(makeRng(13), params, STUB_AXON)
    cell.setInput({ b0: T, b: [0, 0, 0], x: [0, 0, 0] })
    cell.advance(300)
    const before = cell.spikes.length
    cell.advance(seconds * 1000)
    return (cell.spikes.length - before) / seconds
  })
}

/**
 * Conduction velocity, m/s, from one spike run down the axon; null if the
 * spike does not arrive. Also returns whether the far end fired at all, which
 * is what Q11 asks about under sodium block.
 */
export function measureVelocity(
  params: Partial<CellParams> = {},
  axon: Partial<AxonGeometry> = {},
): { velocity: number | null; arrived: boolean; somaFired: boolean } {
  const cell = new NeuronCell(makeRng(14), params, axon)
  cell.advance(30)
  cell.pulse(40, 1)
  cell.advance(80)
  return {
    velocity: cell.conductionVelocity,
    arrived: cell.farSpikes.length > 0,
    somaFired: cell.spikes.length > 0,
  }
}

/**
 * Does a spike launched at the soma come back? Counts crossings at a patch a
 * quarter of the way along: one for a spike that passes once and dies at the
 * sealed far end, more if the far end reflects it back up the axon. Normal
 * inactivation forbids the return trip; instant recovery permits it.
 */
export function measureReflection(
  params: Partial<CellParams> = {},
  axon: Partial<AxonGeometry> = {},
): number {
  const cell = new NeuronCell(makeRng(15), params, axon)
  cell.advance(30)
  cell.pulse(40, 1)
  const watch = 1 + Math.round(cell.compartments * 0.25)
  let above = false
  let crossings = 0
  for (let i = 0; i < 400; i++) {
    cell.advance(0.25)
    const v = cell.v[watch]
    if (!above && v > SPIKE_CROSSING_MV) {
      above = true
      crossings++
    } else if (above && v < SPIKE_CROSSING_MV) above = false
  }
  return crossings
}
