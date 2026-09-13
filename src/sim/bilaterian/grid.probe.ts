/// <reference types="node" />
import { describe, it } from 'vitest'
import { makeRng } from '../random'
import { scenarioByKey } from './scenarios'
import { Worm, TUNING } from './worm'
import { cloneCircuit } from './circuit'
import { DISH_BOUNDS, REACH } from './dishWorld'
import { mean } from './measure'
import type { CueSource } from './fields'

/**
 * Time to reach one source from a random heading, six units out, as the
 * steering constants vary. One number per setting: the mean over seeds,
 * timeouts counted at the cap.
 *
 *   PROBE=1 PROBE_DIR=src/sim/bilaterian npx vitest run --disable-console-intercept -t grid
 */
const BOUNDS = Number(process.env.BOUNDS ?? DISH_BOUNDS)
const DIST = Number(process.env.DIST ?? 6)

function search(seed: number, dist: number, cap = 90): number {
  const ll = scenarioByKey('labeled-line')
  const rng = makeRng(seed)
  const src: CueSource = { id: 1, channel: 0, x: 0, z: 0, strength: 4, scale: 1.8, lifetime: null, born: 0 }
  const to = rng.range(-Math.PI, Math.PI)
  const w = new Worm(cloneCircuit(ll.circuit), ll.channels, {}, {
    x: -Math.cos(to) * dist,
    z: -Math.sin(to) * dist,
    heading: rng.range(-Math.PI, Math.PI),
  })
  const dt = 1 / 30
  for (let t = 0; t < cap; t += dt) {
    w.step(dt, [src], rng, BOUNDS)
    if (Math.hypot(w.head.x, w.head.z) <= REACH) return t
  }
  return cap
}

const SEEDS = Number(process.env.SEEDS ?? 30)

function score(): { mean: number; timeouts: number } {
  const ts = Array.from({ length: SEEDS }, (_, i) => search(900 + i, DIST))
  return { mean: mean(ts), timeouts: ts.filter((t) => t >= 90).length }
}

describe('m04 grid', () => {
  it('grid', () => {
    const base = { ...TUNING, turnMax: 0.8, spontaneous: 0.02, forwardSpeed: 2.4, reverseSpeed: 1.6 }
    Object.assign(TUNING, base)
    const axes: Record<string, number[]> = {
      gain: [40, 80, 120],
      nowTau: [0.03, 0.1],
      spontaneous: [0.01, 0.02, 0.04],
      pulseTau: [0.5, 0.7, 0.9],
      turnMin: [0.4, 0.6],
      turnMax: [0.7, 0.8, 0.9],
      forwardSpeed: [2.0, 2.4, 3.0],
      reverseSpeed: [1.2, 1.6, 2.0],
    }
    const s0 = score()
    console.log(`\nbase: mean ${s0.mean.toFixed(1)} s, timeouts ${s0.timeouts}/${SEEDS}`)
    for (const [key, values] of Object.entries(axes)) {
      const row: string[] = []
      for (const v of values) {
        Object.assign(TUNING, base)
        ;(TUNING as Record<string, number>)[key] = v
        const s = score()
        row.push(`${v}: ${s.mean.toFixed(1)}s (${s.timeouts})`)
      }
      console.log(`${key.padEnd(15)} ${row.join('   ')}`)
    }
    Object.assign(TUNING, base)
  })
})
