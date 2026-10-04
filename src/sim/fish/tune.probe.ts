import { it } from 'vitest'
import { FishWorld, type WorldOptions } from './world'
import { scenarioByKey } from './scenarios'
import { FISH_SIGMOID_WIDTH, FISH_WEIGHT_RANGE } from './brain'

/**
 * The tuning record for Module 7: the measurements that chose the fish's
 * sigmoid width, its weight range and each scenario's learning rate.
 *
 *   PROBE=1 PROBE_DIR=src/sim/fish npx vitest run --disable-console-intercept -t "tune:"
 */

const say = (s: string) => console.log(`m07 · ${s}`)
const SEEDS20 = Array.from({ length: 20 }, (_, i) => 1000 + i)

function firstAt(key: string, opts: WorldOptions, seed: number, limit: number, bar = 95, set = 0): number {
  const w = new FishWorld(seed, scenarioByKey(key), opts)
  for (let n = 0; n < limit; n += 50) {
    w.run(50)
    if (w.testAccuracy(w.tests[set]) >= bar) return w.encounters
  }
  return Infinity
}

function pinned(w: FishWorld): number {
  const c = w.brain.circuit
  const all = [...c.interneurons.flatMap((u) => [...u.weights, u.baseline]), ...c.output!.weights, c.output!.baseline]
  return all.filter((v) => Math.abs(v) >= FISH_WEIGHT_RANGE.max - 1e-9).length / all.length
}

it('tune: XOR by passing the error back', () => {
  say(`width ${FISH_SIGMOID_WIDTH}, range ±${FISH_WEIGHT_RANGE.max}`)
  for (const rate of [0.2, 0.5]) {
    for (const hidden of [1, 2, 3, 4, 6, 8]) {
      const at = SEEDS20.map((s) => firstAt('fruit', { hidden, hiddenMode: 'pass-back', learning: { on: true, rate } }, s, 2000))
      const ok = at.filter((a) => a < Infinity)
      const med = ok.sort((a, b) => a - b)[Math.floor(ok.length / 2)]
      let pin = 0
      for (const s of SEEDS20.slice(0, 5)) {
        const w = new FishWorld(s, scenarioByKey('fruit'), { hidden, hiddenMode: 'pass-back', learning: { on: true, rate } })
        w.run(2000)
        pin += pinned(w) / 5
      }
      say(`fruit η=${rate} h=${hidden}: ${ok.length}/20 reach 95% within 2000; median ${med}; share of weights at the range's end ${(pin * 100).toFixed(0)}%`)
    }
  }
})

const SEEDS6 = [1000, 1001, 1002, 1003, 1004, 1005]
const f = (v: number, d = 1) => v.toFixed(d)
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const rng = (xs: number[], d = 0) => `${f(Math.min(...xs), d)} to ${f(Math.max(...xs), d)} (mean ${f(mean(xs), d)})`
const out = (w: FishWorld) => w.brain.circuit.output!

it('tune: the other problems', () => {
  // Part 1: one unit learns eel from sucker.
  for (const rate of [0.2, 0.5, 1]) {
    const at = SEEDS6.map((s) => firstAt('one-line', { learning: { on: true, rate } }, s, 2000))
    const ws = SEEDS6.map((s) => {
      const w = new FishWorld(s, scenarioByKey('one-line'), { learning: { on: true, rate } })
      w.run(1000)
      return `${f(out(w).weights[0], 2)},${f(out(w).weights[1], 2)},${f(out(w).baseline, 2)}`
    })
    say(`one-line η=${rate}: 95% at ${at.join(', ')}; weights after 1000: ${ws.join(' | ')}`)
  }
  // Part 2's healthy weights: what one unit learns at spread 0.15.
  for (const rate of [0.1, 0.3]) {
    const ws = SEEDS6.map((s) => {
      const w = new FishWorld(s, scenarioByKey('one-line'), { settings: { spread: 0.15 }, learning: { on: true, rate } })
      w.run(5000)
      return `${f(out(w).weights[0], 2)},${f(out(w).weights[1], 2)},${f(out(w).baseline, 2)} acc ${f(w.testAccuracy(w.tests[0]))}`
    })
    say(`healthy η=${rate}, spread 0.15, 5000: ${ws.join(' | ')}`)
  }
  // XOR with no hidden units, and with Both together.
  for (const rate of [0.01, 0.1, 0.5, 1]) {
    const acc = SEEDS6.map((s) => {
      const w = new FishWorld(s, scenarioByKey('fruit'), { learning: { on: true, rate } })
      w.run(5000)
      return w.testAccuracy(w.tests[0])
    })
    const both = SEEDS6.map((s) => firstAt('fruit', { builtIns: ['both'], learning: { on: true, rate } }, s, 5000))
    say(`fruit, no hidden, η=${rate}: test after 5000 ${rng(acc)}; with Both together 95% at ${both.join(', ')}`)
  }
  // The island.
  for (const rate of [0.2, 0.5, 1]) {
    const dist = SEEDS6.map((s) => firstAt('island', { builtIns: ['distance'], learning: { on: true, rate } }, s, 5000))
    const both = SEEDS6.map((s) => {
      const w = new FishWorld(s, scenarioByKey('island'), { builtIns: ['both'], learning: { on: true, rate } })
      w.run(5000)
      return w.testAccuracy(w.tests[0])
    })
    say(`island η=${rate}: Distance 95% at ${dist.join(', ')}; Both together after 5000 ${rng(both)}`)
    for (const hidden of [2, 3, 4, 6, 8]) {
      const at = SEEDS20.map((s) => firstAt('island', { hidden, hiddenMode: 'pass-back', learning: { on: true, rate } }, s, 5000))
      const ok = at.filter((a) => a < Infinity).sort((a, b) => a - b)
      say(`island η=${rate} pass-back h=${hidden}: ${ok.length}/20 reach 95% within 5000; median ${ok[Math.floor(ok.length / 2)]}`)
    }
    for (const sparse of [false, true])
      for (const hidden of [2, 10, 50, 200]) {
        const acc = SEEDS6.map((s) => {
          const w = new FishWorld(s, scenarioByKey('island'), { hidden, hiddenMode: 'random', sparse, learning: { on: true, rate } })
          w.run(5000)
          return w.testAccuracy(w.tests[0])
        })
        const at = SEEDS6.map((s) => firstAt('island', { hidden, hiddenMode: 'random', sparse, learning: { on: true, rate } }, s, 5000))
        say(`island η=${rate} random h=${hidden}${sparse ? ' sparse' : ''}: test after 5000 ${rng(acc)}; 95% at ${at.join(', ')}`)
      }
  }
})

it('tune: pool, downstream, interference', () => {
  for (const rate of [0.05, 0.1, 0.2]) {
    for (const hidden of [0, 2, 3, 8]) {
      for (const poolSize of [8, 12, 60]) {
        const r = SEEDS6.map((s) => {
          const w = new FishWorld(s, scenarioByKey('pool'), { hidden, settings: { poolSize }, learning: { on: true, rate } })
          w.run(5000)
          return [w.recentTrainingAccuracy, w.testAccuracy(w.tests[0])]
        })
        say(`pool η=${rate} h=${hidden} n=${poolSize}: train ${rng(r.map((x) => x[0]))}, test ${rng(r.map((x) => x[1]))}, gap ${f(mean(r.map((x) => x[0] - x[1])))}`)
      }
      const r = SEEDS6.map((s) => {
        const w = new FishWorld(s, scenarioByKey('pool'), { hidden, settings: { source: 'stream' }, learning: { on: true, rate } })
        w.run(5000)
        return [w.recentTrainingAccuracy, w.testAccuracy(w.tests[0])]
      })
      say(`pool η=${rate} h=${hidden} STREAM: train ${rng(r.map((x) => x[0]))}, test ${rng(r.map((x) => x[1]))}`)
    }
  }
  for (const rate of [0.1, 0.2, 0.5]) {
    const cases: [string, WorldOptions, boolean][] = [
      ['near only', {}, false],
      ['every distance', { settings: { distance: 'both' } }, false],
      ['proportion beside A and B, near only', { builtIns: ['proportion'] }, false],
      ['proportion only, near only', { builtIns: ['proportion'], raw: false }, false],
    ]
    for (const [name, opts] of cases) {
      for (const n of [300, 1000, 3000]) {
        const r = SEEDS6.map((s) => {
          const w = new FishWorld(s, scenarioByKey('downstream'), { ...opts, learning: { on: true, rate } })
          w.run(n)
          const far = w.testCounts(w.tests[1])
          return [w.testAccuracy(w.tests[0]), w.testAccuracy(w.tests[1]), (100 * far.hits) / (far.hits + far.misses), (100 * far.falseAlarms) / (far.falseAlarms + far.correctRejections)]
        })
        say(`downstream η=${rate} ${name}, ${n}: near ${rng(r.map((x) => x[0]))}; far ${rng(r.map((x) => x[1]))}; far hit rate ${rng(r.map((x) => x[2]))}; far FA ${rng(r.map((x) => x[3]))}`)
      }
    }
  }
  for (const rate of [0.05, 0.1, 0.2]) {
    for (const stay of [false, true]) {
      const r = SEEDS6.map((s) => {
        const w = new FishWorld(s, scenarioByKey('new-predator'), { learning: { on: true, rate } })
        w.run(1000)
        const a = [w.testAccuracy(w.tests[0]), w.testAccuracy(w.tests[1])]
        w.set({ phase: 1, stayAround: stay })
        const track: number[] = []
        for (let i = 0; i < 10; i++) {
          w.run(100)
          track.push(w.testAccuracy(w.tests[0]))
        }
        return [...a, w.testAccuracy(w.tests[0]), w.testAccuracy(w.tests[1]), ...track]
      })
      say(`new-predator η=${rate} stay=${stay}: after phase 1 old ${rng(r.map((x) => x[0]))}; after phase 2 old ${rng(r.map((x) => x[2]))} new ${rng(r.map((x) => x[3]))}; old every 100 (seed 1000): ${r[0].slice(4).map((v) => f(v, 0)).join(' ')}`)
    }
    const r = SEEDS6.map((s) => {
      const w = new FishWorld(s, scenarioByKey('new-predator'), { settings: { phase: 2 }, learning: { on: true, rate } })
      w.run(2000)
      return [w.testAccuracy(w.tests[0]), w.testAccuracy(w.tests[1])]
    })
    say(`new-predator η=${rate} all four from the start, 2000: old ${rng(r.map((x) => x[0]))} new ${rng(r.map((x) => x[1]))}`)
  }
})

it('tune: all four at once', () => {
  for (const hidden of [6, 8])
    for (const rate of [0.1, 0.2, 0.5]) {
      const rows: string[] = []
      for (const n of [2000, 5000, 10000, 20000]) {
        const r = SEEDS6.map((s) => {
          const w = new FishWorld(s, scenarioByKey('new-predator'), { hidden, settings: { phase: 2 }, learning: { on: true, rate } })
          w.run(n)
          return [w.testAccuracy(w.tests[0]), w.testAccuracy(w.tests[1])]
        })
        rows.push(`${n}: old ${r.map((x) => f(x[0], 0)).join(' ')} · new ${r.map((x) => f(x[1], 0)).join(' ')}`)
      }
      say(`all four h=${hidden} η=${rate} — ${rows.join(' || ')}`)
    }
})

it('tune: the closer', () => {
  for (const rate of [0.1, 0.2, 0.5]) {
    for (const stay of [false, true]) {
      const r = SEEDS6.map((s) => {
        const w = new FishWorld(s, scenarioByKey('new-predator'), { learning: { on: true, rate } })
        w.run(1000)
        const a = [w.testAccuracy(w.tests[0]), w.testAccuracy(w.tests[1])]
        w.set({ phase: 1, stayAround: stay })
        const track: string[] = []
        for (let i = 0; i < 10; i++) {
          w.run(100)
          track.push(`${f(w.testAccuracy(w.tests[0]), 0)}/${f(w.testAccuracy(w.tests[1]), 0)}`)
        }
        return { a, end: [w.testAccuracy(w.tests[0]), w.testAccuracy(w.tests[1])], track }
      })
      say(`closer η=${rate} stay=${stay}: after phase 1 old ${rng(r.map((x) => x.a[0]))}; after phase 2 old ${r.map((x) => f(x.end[0], 0)).join(' ')} · new ${r.map((x) => f(x.end[1], 0)).join(' ')}; old/new every 100 (seed 1000): ${r[0].track.join(' ')}`)
    }
    for (const n of [1000, 2000, 5000]) {
      const r = SEEDS6.map((s) => {
        const w = new FishWorld(s, scenarioByKey('new-predator'), { settings: { phase: 2 }, learning: { on: true, rate } })
        w.run(n)
        return [w.testAccuracy(w.tests[0]), w.testAccuracy(w.tests[1])]
      })
      say(`closer η=${rate} all four from the start, ${n}: old ${r.map((x) => f(x[0], 0)).join(' ')} · new ${r.map((x) => f(x[1], 0)).join(' ')}`)
    }
  }
})

/*
 * Measured and not kept as a probe: the size of the starting weights under
 * *Pass the error back*. At ±0.5, ±1, ±2, ±3 and ±5, four hidden units reach
 * 95% on the fruit in 20, 20, 15, 14 and 11 seeds of 20, and six reach it on
 * the island in 16, 19, 16, 16 and 9. ±1 shipped.
 */
