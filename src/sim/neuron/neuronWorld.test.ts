import { describe, it, expect } from 'vitest'
import { makeRng } from '../random'
import { NeuronCell, HEALTHY_CELL, DEFAULT_AXON, REDUCED_COMPARTMENTS } from './cell'
import { NeuronWorld } from './neuronWorld'
import { HEALTHY_SCENARIO, HEALTHY_UNIT, HEALTHY_WIRING, DIAGNOSTIC_CELLS, insideHealthyBand } from './cells'
import { UNIT_INPUT_RANGE } from './unitRanges'

/**
 * The acceptance tests of `m03_neuron_SCENE_SPEC.md` §10 that need the
 * vehicle and its world and run in seconds: the parts of the diagnosability
 * test that read parameters or drive one cell, determinism, and what stands
 * in for the resolution-invariance test.
 *
 * The count-based tests — the symptom-identity test, N1 in a slow world, N4
 * on energy per light — need four seeds of three minutes each to say anything
 * over the noise of a few lights a minute, and take a quarter of an hour.
 * They live in `neuronWorld.slow.test.ts`, run by `npm run test:slow` and
 * before any deploy that touches the cells, not by every `npm run test`.
 */

/** Diagnostic cells are shown after this much driving, as the scene does. */
const WARM_S = 45

const cell = (id: string) => DIAGNOSTIC_CELLS.find((c) => c.id === id)!

describe('the diagnosability test', () => {
  it('N1: every cell parameter and connection is healthy — inspection finds nothing', () => {
    const n1 = cell('N1').scenario
    expect(insideHealthyBand(n1.cell)).toBe(true)
    expect(n1.unit).toEqual(HEALTHY_UNIT)
  })

  it("N2: the Unit tab's printed strengths give it away, and nothing else does", () => {
    const n2 = cell('N2').scenario
    expect(insideHealthyBand(n2.cell)).toBe(true)
    // The crossed connection is b₂ in the left cell and b₁ in the right.
    const crossed = (u: typeof n2.unit, side: 'left' | 'right') => (side === 'left' ? u[side].b2 : u[side].b1)
    for (const side of ['left', 'right'] as const) {
      expect(Math.abs(HEALTHY_WIRING.b2) / Math.abs(crossed(n2.unit, side))).toBeGreaterThanOrEqual(2)
      for (const id of ['N1', 'N3', 'N4']) {
        expect(Math.abs(crossed(cell(id).scenario.unit, side))).toBeCloseTo(Math.abs(HEALTHY_WIRING.b2))
      }
    }
  })

  it('N3: nearly normal at rest, and only fails under sustained maximum input', () => {
    const n3 = cell('N3').scenario
    expect(n3.unit).toEqual(HEALTHY_UNIT)
    // At rest, after the scene's warm-up: the spike is nearly the healthy one.
    const spikeAt = (params: typeof HEALTHY_CELL) => {
      const c = new NeuronCell(makeRng(21), params, { compartments: REDUCED_COMPARTMENTS })
      c.advance(WARM_S * 1000)
      const rest = c.v[0]
      c.pulse(40, 1)
      c.advance(30)
      return { rest, amp: c.spikeAmplitudes[0] ?? 0 }
    }
    const healthy = spikeAt(HEALTHY_CELL)
    const sick = spikeAt(n3.cell)
    expect(Math.abs(sick.rest - healthy.rest)).toBeLessThan(3)
    expect(sick.amp).toBeGreaterThan(healthy.amp * 0.8)
    // Under thirty seconds of the Unit tab's maximum input: the healthy cell
    // keeps delivering spikes to the far end; N3's spikes shrink and fail.
    const farRate = (params: typeof HEALTHY_CELL) => {
      const c = new NeuronCell(makeRng(22), params)
      c.advance(WARM_S * 1000)
      c.setInput({ b0: UNIT_INPUT_RANGE.max, b: [0, 0, 0], x: [0, 0, 0] })
      c.advance(30000)
      return c.farSpikes.filter((t) => t > c.time - 5000).length / 5
    }
    const healthyFar = farRate(HEALTHY_CELL)
    const sickFar = farRate(n3.cell)
    expect(healthyFar).toBeGreaterThan(20)
    expect(healthyFar).toBeGreaterThanOrEqual(2 * sickFar)
  })

  it('N4: not broken — every cell parameter is healthy', () => {
    expect(insideHealthyBand(cell('N4').scenario.cell)).toBe(true)
  })
})

describe('determinism', () => {
  it('the same seed and settings reproduce a run exactly', () => {
    const run = () => {
      const w = new NeuronWorld(77, HEALTHY_SCENARIO)
      w.run(20)
      return {
        x: w.vehicle.state.x,
        z: w.vehicle.state.z,
        lights: w.lightsCollected,
        atp: w.atpTotal,
        spikes: w.cell.spikes.length,
      }
    }
    expect(run()).toEqual(run())
  })
})

describe('axon resolution', () => {
  /**
   * The spec's resolution-invariance test asked that a coarse axon, run
   * while the Membrane tab is hidden, change the vehicle's lights-collected
   * rate by less than 5%. Measured, a coarse axon drops spikes: ten patches
   * lose a fifth of them at 40 events/s, twenty lose a third at 200. So the
   * scene runs the full axon always (a 0.05 ms step made that affordable)
   * and this test records the measurement that decided it, plus the one
   * regime where the coarse cut is faithful.
   */
  it('a coarse axon carries every spike at low rates and drops them at high rates', () => {
    const farCount = (compartments: number, T: number) => {
      const c = new NeuronCell(makeRng(5), {}, { compartments })
      c.setInput({ b0: T, b: [0, 0, 0], x: [0, 0, 0] })
      c.advance(6000)
      return { soma: c.spikes.length, far: c.farSpikes.length }
    }
    const fullLow = farCount(DEFAULT_AXON.compartments, 40)
    expect(fullLow.far).toBeGreaterThanOrEqual(fullLow.soma - 1)
    const coarseLow = farCount(REDUCED_COMPARTMENTS, 40)
    expect(coarseLow.far).toBeGreaterThanOrEqual(coarseLow.soma - 1)
    const fullHigh = farCount(DEFAULT_AXON.compartments, 200)
    expect(fullHigh.far).toBeGreaterThanOrEqual(fullHigh.soma * 0.97)
    const coarseHigh = farCount(REDUCED_COMPARTMENTS, 200)
    expect(coarseHigh.far).toBeLessThan(coarseHigh.soma * 0.9)
  })
})
