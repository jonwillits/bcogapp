import { it } from 'vitest'
import { FishWorld, type WorldOptions } from './world'
import { scenarioByKey } from './scenarios'
import { fishById, type FishId } from './animals'
import { STAKES_PRESETS, byHand, dPrimeOf, energyPer100, falseAlarmRate, hitRate, percentCorrect } from './sdt'
import { hiddenOutputFor, makeScratch, CRITERION_RANGE } from './brain'
import { KINDS } from './kinds'

/**
 * The viewing crib for Module 7, and the measured numbers behind
 * `docs/M07_AS_BUILT_NOTES.md`. Motion cannot be verified headlessly, so
 * these are predictions to check by eye at localhost:5173 — what the
 * feature-space panel, the learning curve and the scorecards should read.
 * Six seeds (1000 to 1005) unless a line says twenty (1000 to 1019). Every
 * run is the scenario as it loads, with *Learning on* switched on.
 *
 *   PROBE=1 PROBE_DIR=src/sim/fish npx vitest run --disable-console-intercept -t "crib:"
 */

const SEEDS = [1000, 1001, 1002, 1003, 1004, 1005]
const SEEDS20 = Array.from({ length: 20 }, (_, i) => 1000 + i)
const f = (v: number, d = 0) => v.toFixed(d)
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const range = (xs: number[], d = 0) => `${f(Math.min(...xs), d)} to ${f(Math.max(...xs), d)} (mean ${f(mean(xs), d)})`
const say = (s: string) => console.log(`m07 · ${s}`)
const on = { on: true }

const make = (key: string, opts: WorldOptions, seed: number) => new FishWorld(seed, scenarioByKey(key), { ...opts, learning: { ...on, ...opts.learning } })

/** Encounters until the first test set reaches `bar`, checked every 50, or Infinity. */
function firstAt(key: string, opts: WorldOptions, seed: number, limit: number, bar = 95): number {
  const w = make(key, opts, seed)
  for (let n = 0; n < limit; n += 50) {
    w.run(50)
    if (w.testAccuracy(w.tests[0]) >= bar) return w.encounters
  }
  return Infinity
}

function reach(key: string, opts: WorldOptions, seeds: number[], limit: number): string {
  const at = seeds.map((s) => firstAt(key, opts, s, limit))
  const ok = at.filter((a) => a < Infinity).sort((a, b) => a - b)
  if (!ok.length) return `0 of ${seeds.length} reach 95% within ${limit}`
  return `${ok.length} of ${seeds.length} reach 95% within ${limit}; when they do, after ${ok[0]} to ${ok[ok.length - 1]} encounters (median ${ok[Math.floor(ok.length / 2)]})`
}

function after(key: string, opts: WorldOptions, n: number, set = 0): number[] {
  return SEEDS.map((s) => {
    const w = make(key, opts, s)
    w.run(n)
    return w.testAccuracy(w.tests[set])
  })
}

it('crib: what the panels should read', () => {
  // ───── Part 1
  say('PART 1 · one-line')
  say(`  learning on, η 0.2: ${reach('one-line', {}, SEEDS, 2000)}`)
  for (const n of [100, 300, 1000]) {
    const ws = SEEDS.map((s) => {
      const w = make('one-line', {}, s)
      w.run(n)
      const o = w.brain.circuit.output!
      return [o.weights[0], o.weights[1], o.baseline, w.testAccuracy(w.tests[0])]
    })
    say(`  after ${n}: weight from A ${range(ws.map((x) => x[0]), 2)}, from B ${range(ws.map((x) => x[1]), 2)}, baseline ${range(ws.map((x) => x[2]), 2)}; test ${range(ws.map((x) => x[3]))}%`)
  }
  for (const spread of [0.06, 0.1, 0.15, 0.2]) say(`  spread ${spread}, after 1000: test ${range(after('one-line', { settings: { spread } }, 1000))}%`)
  {
    // By hand: 3, −1.5, −1.0 separates them.
    const w = new FishWorld(1000, scenarioByKey('one-line'))
    w.wire({ layer: 'output', weight: { input: 0, value: 3 } })
    w.wire({ layer: 'output', weight: { input: 1, value: -1.5 } })
    w.wire({ layer: 'output', baseline: -1 })
    say(`  by hand, weights 3 and −1.5, baseline −1: test ${f(w.testAccuracy(w.tests[0]))}%`)
  }

  // ───── Part 2
  say('PART 2 · diagnosis')
  for (const id of ['healthy', 'F1', 'F2', 'F3', 'F4'] as FishId[]) {
    const rows = SEEDS.map((s) => {
      const a = fishById(id)
      const w = new FishWorld(s, scenarioByKey('diagnosis'), { circuit: a.circuit, settings: { chemistry: a.chemistry } })
      const c = w.testCounts(w.tests[0])
      const ev = Array.from(w.testEvidence(w.tests[0]))
      const d = dPrimeOf(ev.filter((_, i) => w.tests[0].happens[i]), ev.filter((_, i) => !w.tests[0].happens[i]))
      return { c, d, hand: byHand(c).dPrime, pc: percentCorrect(c), h: hitRate(c), fa: falseAlarmRate(c), e: energyPer100(c, w.settings.stakes) }
    })
    say(`  ${id}: hits ${range(rows.map((r) => r.c.hits))}, misses ${range(rows.map((r) => r.c.misses))}, false alarms ${range(rows.map((r) => r.c.falseAlarms))}, correct rejections ${range(rows.map((r) => r.c.correctRejections))}`)
    say(`      hit rate ${range(rows.map((r) => r.h), 2)}, false-alarm rate ${range(rows.map((r) => r.fa), 2)}, percent correct ${range(rows.map((r) => r.pc), 1)}; d′ on the panel ${range(rows.map((r) => r.d), 2)}, by hand ${range(rows.map((r) => r.hand), 2)}; energy per 100 under the fish’s stakes ${range(rows.map((r) => r.e))}`)
  }
  for (const preset of STAKES_PRESETS) {
    for (const baseRate of [0.2, 0.5, 0.8]) {
      const best = SEEDS.map((s) => {
        const w = new FishWorld(s, scenarioByKey('diagnosis'), { settings: { baseRate, stakes: preset.stakes } })
        let at = 0
        let top = -Infinity
        for (let c = CRITERION_RANGE.min; c <= CRITERION_RANGE.max + 1e-9; c += 0.05) {
          const e = energyPer100(w.testCounts(w.tests[0], c), preset.stakes)
          if (e > top) {
            top = e
            at = c
          }
        }
        return [at, top, energyPer100(w.testCounts(w.tests[0], 0), preset.stakes)]
      })
      say(`  ${preset.label}, eels ${baseRate * 100}%: best criterion ${range(best.map((b) => b[0]), 2)}, earning ${range(best.map((b) => b[1]))} per 100; at a criterion of 0, ${range(best.map((b) => b[2]))}`)
    }
  }
  {
    const own = fishById('F4').ownStream!
    const earn = (id: FishId) =>
      SEEDS.map((s) => {
        const a = fishById(id)
        const w = new FishWorld(s, scenarioByKey('diagnosis'), { circuit: a.circuit, settings: { chemistry: a.chemistry, baseRate: own.baseRate, stakes: own.stakes } })
        return energyPer100(w.testCounts(w.tests[0]), own.stakes)
      })
    say(`  in F4’s own stream (eels 80%): F4 earns ${range(earn('F4'))} per 100, the healthy fish ${range(earn('healthy'))}`)
    const w = new FishWorld(1000, scenarioByKey('diagnosis'))
    const fresh = [0, 1, 2, 3, 4].map(() => w.scoreFresh(500).energyPer100)
    say(`  Score this criterion, five presses at a criterion of 0 (seed 1000): ${fresh.map((v) => f(v)).join(', ')}`)
  }

  // ───── Part 3
  say('PART 3 · fruit')
  for (const n of [1000, 5000]) say(`  no hidden units, after ${n}: test ${range(after('fruit', {}, n))}%`)
  for (const hidden of [1, 2, 3, 4, 6, 8]) say(`  ${hidden} hidden, pass the error back: ${reach('fruit', { hidden, hiddenMode: 'pass-back' }, SEEDS20, 2000)}`)
  {
    const raw = { raw: true, builtIns: [] }
    const s = makeScratch()
    let ripe = 0
    let others = 0
    let solved = 0
    for (const seed of SEEDS20) {
      const w = make('fruit', { hidden: 2, hiddenMode: 'pass-back' }, seed)
      w.run(2000)
      if (w.testAccuracy(w.tests[0]) < 95) continue
      solved++
      const at = (id: 'twig' | 'ripe-a' | 'ripe-b' | 'rotting') => [0, 1].map((j) => hiddenOutputFor(w.brain.circuit, raw, j, ...KINDS[id].typical!, s))
      const d = (p: number[], q: number[]) => Math.hypot(p[0] - q[0], p[1] - q[1])
      let across = Infinity
      for (const r of ['ripe-a', 'ripe-b'] as const) for (const o of ['twig', 'rotting'] as const) across = Math.min(across, d(at(r), at(o)))
      if (d(at('ripe-a'), at('ripe-b')) < across) ripe++
      if (d(at('twig'), at('rotting')) < across) others++
    }
    say(`  two hidden units after 2000: solved in ${solved} of 20; the ripe corners land together in ${ripe}, the twig and the rotting fruit in ${others}`)
    const stuck = SEEDS20.map((seed) => {
      const w = make('fruit', { hidden: 2, hiddenMode: 'pass-back' }, seed)
      w.run(2000)
      return w.testAccuracy(w.tests[0])
    }).filter((a) => a < 95)
    say(`  two hidden units that stick: test ${range(stuck)}% after 2000`)
  }
  say(`  threshold function, 4 hidden, pass the error back, after 1000: test ${range(after('fruit', { hidden: 4, hiddenMode: 'pass-back', activation: 'threshold' }, 1000))}%`)
  say(`  Both together on, no hidden units: ${reach('fruit', { builtIns: ['both'] }, SEEDS, 2000)}`)
  say(`  Distance from the ideal strength on, no hidden units, after 5000: test ${range(after('fruit', { builtIns: ['distance'] }, 5000))}%`)

  // ───── Part 4
  say('PART 4 · island')
  say(`  no hidden units, after 1000: test ${range(after('island', {}, 1000))}%`)
  say(`  Distance from the ideal strength: ${reach('island', { builtIns: ['distance'] }, SEEDS, 5000)}`)
  say(`  Both together, after 5000: test ${range(after('island', { builtIns: ['both'] }, 5000))}%`)
  for (const sparse of [false, true])
    for (const hidden of [2, 10, 50, 200]) {
      const o: WorldOptions = { hidden, hiddenMode: 'random', sparse }
      say(`  fixed at random, ${hidden} units${sparse ? ', sparse' : ''}: after 1000 ${range(after('island', o, 1000))}%, after 5000 ${range(after('island', o, 5000))}%; ${reach('island', o, SEEDS, 5000)}`)
    }
  for (const hidden of [2, 3, 4, 5, 6, 8]) {
    const o: WorldOptions = { hidden, hiddenMode: 'pass-back' }
    say(`  pass the error back, ${hidden} hidden: ${reach('island', o, SEEDS20, 5000)}; test after 5000 ${range(after('island', o, 5000))}%`)
  }

  // ───── Part 5a
  say('PART 5a · pool')
  const pool = (o: WorldOptions, n = 5000) =>
    SEEDS.map((s) => {
      const w = make('pool', o, s)
      w.run(n)
      return [w.recentTrainingAccuracy, w.testAccuracy(w.tests[0]), w.meetingsPerIndividual]
    })
  for (const n of [1000, 3000, 5000, 10000]) {
    const r = pool({}, n)
    say(`  12 individuals, 8 hidden, after ${n}: training ${range(r.map((x) => x[0]))}%, test ${range(r.map((x) => x[1]))}%, gap ${f(mean(r.map((x) => x[0] - x[1])))} points; each seed training/test ${r.map((x) => `${f(x[0])}/${f(x[1])}`).join(' ')}; ${f(r[0][2])} meetings per individual`)
  }
  for (const hidden of [0, 2, 3]) {
    const r = pool({ hidden })
    say(`  12 individuals, ${hidden} hidden, after 5000: training ${range(r.map((x) => x[0]))}%, test ${range(r.map((x) => x[1]))}%, gap ${f(mean(r.map((x) => x[0] - x[1])))}`)
  }
  for (const poolSize of [6, 24, 60]) {
    const r = pool({ settings: { poolSize } })
    say(`  ${poolSize} individuals, 8 hidden, after 5000: training ${range(r.map((x) => x[0]))}%, test ${range(r.map((x) => x[1]))}%, gap ${f(mean(r.map((x) => x[0] - x[1])))}`)
  }
  {
    const r = pool({ settings: { source: 'stream' } })
    say(`  a stream, 8 hidden, after 5000: training ${range(r.map((x) => x[0]))}%, test ${range(r.map((x) => x[1]))}%, gap ${f(mean(r.map((x) => x[0] - x[1])))}`)
  }

  // ───── Part 5b
  say('PART 5b · downstream')
  const cases: [string, WorldOptions][] = [
    ['trained near only', {}],
    ['learn from every distance', { settings: { distance: 'both' } }],
    ['Proportion of A beside A and B, near only', { builtIns: ['proportion'] }],
    ['Proportion only, near only', { builtIns: ['proportion'], raw: false }],
  ]
  for (const [name, o] of cases)
    for (const n of [300, 1000, 2000]) {
      const r = SEEDS.map((s) => {
        const w = make('downstream', o, s)
        w.run(n)
        const c = w.testCounts(w.tests[1])
        return [w.testAccuracy(w.tests[0]), w.testAccuracy(w.tests[1]), 100 * hitRate(c), 100 * falseAlarmRate(c)]
      })
      say(`  ${name}, after ${n}: near ${range(r.map((x) => x[0]))}%, far ${range(r.map((x) => x[1]))}%; far hit rate ${range(r.map((x) => x[2]))}%, far false-alarm rate ${range(r.map((x) => x[3]))}%`)
    }

  // ───── Closer
  say('CLOSER · new-predator')
  for (const stay of [false, true]) {
    const r = SEEDS.map((s) => {
      const w = make('new-predator', {}, s)
      w.run(1000)
      const one = [w.testAccuracy(w.tests[0]), w.testAccuracy(w.tests[1])]
      w.set({ phase: 1, stayAround: stay })
      const track: string[] = []
      let collapsed = Infinity
      for (let i = 1; i <= 20; i++) {
        w.run(50)
        const old = w.testAccuracy(w.tests[0])
        if (i % 2 === 0) track.push(`${f(old)}/${f(w.testAccuracy(w.tests[1]))}`)
        if (old <= 60 && collapsed === Infinity) collapsed = i * 50
      }
      const two = [w.testAccuracy(w.tests[0]), w.testAccuracy(w.tests[1])]
      w.eelReturns()
      const e = w.runEncounter()
      return { one, two, track, collapsed, struck: !e.verdict }
    })
    say(`  ${stay ? 'eels and suckers stay around' : 'phase 2 alone'}: after phase 1 (1000) old ${range(r.map((x) => x.one[0]))}%, new ${range(r.map((x) => x.one[1]))}%; after phase 2 (1000 more) old ${range(r.map((x) => x.two[0]))}%, new ${range(r.map((x) => x.two[1]))}%`)
    say(`      old/new every 100 encounters of phase 2, seed 1000: ${r[0].track.join(' ')}`)
    if (!stay) say(`      the old test set is at 60% or less after ${range(r.map((x) => x.collapsed))} encounters of phase 2; then an eel comes back and the fish is struck in ${r.filter((x) => x.struck).length} of 6`)
  }
  for (const n of [1000, 2000, 3000, 5000]) {
    const r = SEEDS.map((s) => {
      const w = make('new-predator', { settings: { phase: 2 } }, s)
      w.run(n)
      return [w.testAccuracy(w.tests[0]), w.testAccuracy(w.tests[1])]
    })
    say(`  all four from the start, after ${n}: old ${r.map((x) => f(x[0])).join(' ')} · new ${r.map((x) => f(x[1])).join(' ')}`)
  }
})
