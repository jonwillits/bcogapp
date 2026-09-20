import { describe, it, expect } from 'vitest'
import fixture from './lab4Regression.fixture.json'
import { lab4Digests } from './lab4Signature'

/**
 * The Lab 4 regression test of the Module 5 spec's §9 — one of the two tests
 * that replace `noLearning.test.ts`, and the one that makes retiring it safe.
 *
 * Module 5 is a configuration of Module 4's engine, so Module 5's build
 * edits Module 4's files. This asserts that, with no learning layer attached,
 * every Lab 4 scenario and every Lab 4 animal still runs the trajectory it
 * ran the day Lab 4 shipped: same seeds, same settings, same path to the
 * last bit, same meals, same harm, same wiring at the end.
 *
 * Gated on the platform the digests were recorded on, for the reason
 * `continuousLineages.test.ts` gives at length: `Math.exp`, `Math.sin` and
 * `Math.atan2` are implementation-approximated, and a last-bit difference
 * compounds. CI runs the suite on the same architecture.
 */

const host = (globalThis as { process?: { platform?: string; arch?: string } }).process
const native = host?.platform === fixture.generatedOn.platform && host?.arch === fixture.generatedOn.arch

describe('Lab 4, with the learning layer switched off', () => {
  it.runIf(native)('reproduces bit-for-bit: every scenario and every animal', () => {
    const now = lab4Digests()
    expect(now.map((r) => r.id)).toEqual(fixture.runs.map((r) => r.id))
    for (const [i, run] of now.entries()) expect(run, run.id).toEqual(fixture.runs[i])
  })

  it('the fixture covers all seven scenarios and all six animals', () => {
    expect(fixture.runs.length).toBe(7 * 2 + 6)
    expect(fixture.engineCommit).toBe('9ebfc77')
  })
})
