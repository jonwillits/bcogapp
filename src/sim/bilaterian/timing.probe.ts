/// <reference types="node" />
import { describe, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { DishWorld } from './dishWorld'
import { SCENARIOS, DIAGNOSIS } from './scenarios'
import { ANIMALS } from './animals'
import { truthTableOf, decisionBoundary, unitOutput, activate } from './unit'
import { valenceArousal, nearestState } from './modulators'

/**
 * How long everything the Module 4 scene runs synchronously takes, so that
 * nothing blocks the main thread the way Lab 3's head start did.
 *
 *   PROBE=1 PROBE_DIR=src/sim/bilaterian npx vitest run --disable-console-intercept -t timing
 */
const OUT = process.env.TIMING_OUT ?? '/tmp/m04-timing.md'

function time(label: string, fn: () => void, reps = 1): [string, number] {
  fn() // warm the JIT once
  const t0 = performance.now()
  for (let i = 0; i < reps; i++) fn()
  return [label, (performance.now() - t0) / reps]
}

describe('m04 timing', () => {
  it('timing', () => {
    const rows: [string, number][] = []
    for (const s of SCENARIOS) rows.push(time(`construct ${s.key}`, () => new DishWorld(1, s), 5))
    for (const a of ANIMALS) {
      rows.push(
        time(`warm-up 60 s, ${a.id} (loadAnimal / Reset in the diagnosis dish)`, () => {
          const w = new DishWorld(1, DIAGNOSIS, { circuit: a.circuit, modulators: a.modulators })
          w.run(60)
        }, 3),
      )
    }
    const w = new DishWorld(1, DIAGNOSIS)
    w.run(30)
    rows.push(time('one step of 1/60 s', () => w.step(1 / 60), 200))
    rows.push(time('one step of 1/30 s (the fixed step)', () => w.step(1 / 30), 200))
    rows.push(time('one frame at speed 1 (0.0167 s: one step)', () => w.step(1 / 60), 200))
    rows.push(time('one frame at speed 3, clamped (0.05 s: two steps)', () => { w.step(1 / 30); w.step(0.05 - 1 / 30) }, 200))
    rows.push(time('worst frame after a stall (0.05 s clamp × speed 3)', () => { w.step(1 / 30); w.step(0.05 - 1 / 30) }, 200))
    rows.push(time('one second of simulation (30 steps)', () => w.run(1), 20))
    const u = w.worm.circuit.interneurons[0]
    rows.push(time('truthTableOf (the table, per render)', () => truthTableOf(u, 'sigmoid'), 500))
    rows.push(time('decisionBoundary (per render)', () => decisionBoundary(u), 500))
    rows.push(
      time('decision-boundary shading, 24×24 unitOutput (per render)', () => {
        for (let i = 0; i < 24; i++) for (let j = 0; j < 24; j++) unitOutput(u, [i / 24, j / 24], 'sigmoid')
      }, 200),
    )
    rows.push(time('activation curve, 300 points (per render)', () => { for (let v = -3; v <= 3; v += 0.02) activate('sigmoid', v, 0.35) }, 200))
    rows.push(time('valenceArousal + nearestState (per render)', () => nearestState(...Object.values(valenceArousal(w.worm.mod.level, 0)) as [number, number]), 500))
    rows.push(time('trace snapshot for the plots (map over 240 × 8 series)', () => {
      const t = w.trace
      ;[t.net, t.output, t.rate, t.valence, t.arousal, ...t.cells, ...Object.values(t.levels)].forEach((a) => a.map((v) => v * 1))
    }, 200))
    rows.push(time('addSource + removeNearest (a click)', () => { w.addSource(0, 2, 2); w.removeNearest(2, 2) }, 200))

    const md = ['| What | ms |', '|---|---|', ...rows.map(([l, ms]) => `| ${l} | ${ms.toFixed(2)} |`)].join('\n')
    writeFileSync(OUT, md + '\n')
    console.log('\n' + md)
  })
})
