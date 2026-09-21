import { it } from 'vitest'
import { LearningDish, type LearningDishOptions } from './learningDish'
import { learningScenarioByKey } from './scenarios'

/**
 * The measuring bench for Module 5. Every number in `docs/M05_AS_BUILT_NOTES.md`
 * and every band in the acceptance tests was read off one of these.
 *
 *   PROBE=1 PROBE_DIR=src/sim/bilaterian/learning npx vitest run --disable-console-intercept -t "hand-over"
 */

const SEEDS = Number(process.env.SEEDS ?? 5)
const f = (v: number, d = 2) => v.toFixed(d)

function run(key: string, seed: number, seconds: number, opts: LearningDishOptions, each?: (w: LearningDish, minute: number) => void) {
  const w = new LearningDish(seed, learningScenarioByKey(key), opts)
  const minutes = Math.round(seconds / 60)
  for (let m = 0; m < minutes; m++) {
    w.run(60)
    each?.(w, m)
  }
  return w
}

it('hand-over', () => {
  for (const on of [false, true]) {
    for (const rate of on ? [0.01, 0.1, 0.3, 1] : [0.3]) {
      for (const weakening of on ? [false, true] : [false]) {
        const rows: string[] = []
        for (let seed = 1000; seed < 1000 + SEEDS; seed++) {
          const perMinute: number[] = []
          let last = 0
          const w = run('hand-over', seed, 300, { learning: { on, rate, weakening } }, (wd) => {
            perMinute.push(wd.harm - last)
            last = wd.harm
          })
          rows.push(`harm ${f(w.harm, 0)} [${perMinute.map((h) => f(h, 0)).join(' ')}] b=${f(w.worm.circuit.interneurons[0].weights[0])}`)
        }
        console.log(`on=${on} η=${rate} weakening=${weakening}\n  ` + rows.join('\n  '))
      }
    }
  }
})

it('pairing', () => {
  for (const cfg of [
    { label: 'η=0.3 interval 0', opts: { learning: { rate: 0.3 } } },
    { label: 'η=1 interval 0', opts: { learning: { rate: 1 } } },
    { label: 'η=0.01 interval 0', opts: { learning: { rate: 0.01 } } },
    { label: 'η=0.3 interval 3', opts: { learning: { rate: 0.3 }, interval: 3 } },
    { label: 'η=0.3 interval 10', opts: { learning: { rate: 0.3 }, interval: 10 } },
    { label: 'η=0.3 second cue', opts: { learning: { rate: 0.3 }, flags: { secondCue: true } } },
    { label: 'η=1 weakening', opts: { learning: { rate: 1, weakening: true } } },
    { label: 'η=1 competition, second cue', opts: { learning: { rate: 1, competition: true }, flags: { secondCue: true } } },
    { label: 'learning off', opts: { learning: { on: false } } },
  ] as { label: string; opts: LearningDishOptions }[]) {
    const rows: string[] = []
    for (let seed = 1000; seed < 1000 + SEEDS; seed++) {
      const path: string[] = []
      let fired = 0
      let steps = 0
      const w = new LearningDish(seed, learningScenarioByKey('pairing'), cfg.opts)
      for (let m = 0; m < 5; m++) {
        for (let k = 0; k < 1800; k++) {
          w.step(1 / 30)
          steps++
          if ((w.worm.output[0] ?? 0) >= 0.5) fired++
        }
        path.push(w.worm.circuit.interneurons[0].weights.map((b) => f(b)).join('/'))
      }
      rows.push(`trials ${w.trials} meals ${w.cuesReached} fires ${f(fired / steps)} weights by minute: ${path.join('  ')}`)
    }
    console.log(`${cfg.label}\n  ` + rows.join('\n  '))
  }
})

it('bounds', () => {
  for (const cfg of [
    { label: 'off', l: {} },
    { label: 'weakening', l: { weakening: true } },
    { label: 'competition', l: { competition: true } },
  ]) {
    for (const rate of [0.3, 1]) {
      for (const secondCue of [false, true]) {
        let atCeiling = 0
        let fires = 0
        let top = 0
        let n = 0
        for (let seed = 1000; seed < 1000 + SEEDS; seed++) {
          const w = new LearningDish(seed, learningScenarioByKey('pairing'), { learning: { rate, ...cfg.l }, flags: { secondCue } })
          w.run(60)
          for (let k = 0; k < 30 * 240; k++) {
            w.step(1 / 30)
            n++
            const b = w.worm.circuit.interneurons[0].weights
            if (b[1] >= 3) atCeiling++
            if ((w.worm.output[0] ?? 0) >= 0.5) fires++
            top = Math.max(top, b[1], b[2])
          }
        }
        console.log(`${cfg.label} η=${rate} second=${secondCue}: at ceiling ${f(atCeiling / n)} fires ${f(fires / n)} highest ${f(top)}`)
      }
    }
  }
})

it('blocking', () => {
  const minutesPerPhase = Number(process.env.PHASE_MIN ?? 4)
  for (const factor of ['coincidence', 'prediction', 'teacher', 'verdict'] as const) {
    for (const rate of [0.1, 0.3, 1]) {
      const rows: string[] = []
      for (let seed = 1000; seed < 1000 + SEEDS; seed++) {
        const w = new LearningDish(seed, learningScenarioByKey('blocking'), { learning: { factor, rate, traceWindow: factor === 'verdict' ? 3 : 0 } })
        const marks: string[] = []
        for (let ph = 0; ph < 3; ph++) {
          w.setPhase(ph)
          const before = w.trials
          w.run(60 * minutesPerPhase)
          const b = w.worm.circuit.interneurons[0].weights
          marks.push(`A ${f(b[1])} B ${f(b[2])} (${w.trials - before} trials)`)
        }
        rows.push(marks.join('  |  '))
      }
      console.log(`${factor} η=${rate}\n  ` + rows.join('\n  '))
    }
  }
})

it('four-signals', () => {
  const half = Number(process.env.HALF_MIN ?? 5)
  for (const factor of ['coincidence', 'prediction', 'teacher', 'verdict'] as const) {
    const rows: string[] = []
    for (let seed = 1000; seed < 1000 + SEEDS; seed++) {
      const w = new LearningDish(seed, learningScenarioByKey('four-signals'), { learning: { factor } })
      const marks: string[] = []
      for (const flip of [false, true]) {
        w.flags.almondMarksFood = flip
        w.layOutSites()
        const meals = w.cuesReached
        const empty = w.emptyVisits
        w.run(60 * half)
        const b = w.worm.circuit.interneurons[0].weights
        marks.push(`salt ${f(b[1])} almond ${f(b[2])} meals ${w.cuesReached - meals} empty ${w.emptyVisits - empty}`)
      }
      rows.push(marks.join('  | flipped |  '))
    }
    console.log(`${factor}\n  ` + rows.join('\n  '))
  }
})

it('corridor', () => {
  for (const cfg of [
    { label: 'default (window 3, γ 0.9)', l: {} },
    { label: 'window 0', l: { traceWindow: 0 } },
    { label: 'window 10', l: { traceWindow: 10 } },
    { label: 'γ 0.5', l: { discount: 0.5 } },
    { label: 'γ 0.99', l: { discount: 0.99 } },
  ]) {
    for (let seed = 1000; seed < 1000 + Math.min(SEEDS, 3); seed++) {
      const w = new LearningDish(seed, learningScenarioByKey('corridor'), { learning: cfg.l })
      const lines: string[] = []
      let seen = 0
      while (w.laneTrials < 20 && w.time < 900) {
        w.step(1 / 30)
        if (w.laneTrials !== seen) {
          seen = w.laneTrials
          const c = w.chainByTrial[w.chainByTrial.length - 1]
          if (seen <= 6 || seen % 5 === 0) lines.push(`    trial ${seen} t=${f(w.time, 0)}s  values ${c.values.map((v) => f(v)).join(' ')}  surprise at food ${f(c.atFood)}`)
        }
      }
      const b = w.worm.circuit.interneurons[0].weights
      console.log(`${cfg.label} seed ${seed}: ${w.laneTrials} trials in ${f(w.time, 0)} s; actor marker ${f(b[1])} turn ${f(b[2])} approach ${f(b[3])} vibration ${f(b[4])}\n${lines.join('\n')}`)
    }
  }
})

it('chain', () => {
  for (const traceWindow of [0, 3, 10]) {
    for (let seed = 1000; seed < 1000 + SEEDS; seed++) {
      const w = new LearningDish(seed, learningScenarioByKey('corridor'), { learning: { traceWindow } })
      const first = [0, 0, 0]
      const late: { values: number[]; atFood: number }[] = []
      let seen = 0
      while (w.laneTrials < 30 && w.time < 1500) {
        w.step(1 / 30)
        if (w.laneTrials !== seen) {
          seen = w.laneTrials
          const c = w.chainByTrial[w.chainByTrial.length - 1]
          c.values.forEach((v, i) => { if (!first[i] && v > 0.3) first[i] = seen })
          if (seen > 20) late.push(c)
        }
      }
      const avg = (pick: (c: { values: number[]; atFood: number }) => number) => late.reduce((a, c) => a + pick(c), 0) / late.length
      const b = w.worm.circuit.interneurons[0].weights
      console.log(`window ${traceWindow} seed ${seed}: ${f(w.time / 60, 1)} min; first trial over 0.3: marker ${first[0]} turn ${first[1]} approach ${first[2]}; trials 21-30 mean: marker ${f(avg((c) => c.values[0]))} turn ${f(avg((c) => c.values[1]))} approach ${f(avg((c) => c.values[2]))} surprise at food ${f(avg((c) => c.atFood))}; actor marker ${f(b[1])} vibration ${f(b[4])}`)
    }
  }
})

it('extinction', () => {
  for (let seed = 1000; seed < 1000 + SEEDS; seed++) {
    const make = () => {
      const w = new LearningDish(seed, learningScenarioByKey('extinction'))
      w.run(240)
      const acquired = { b: [...w.worm.circuit.interneurons[0].weights], r: w.responseToCue(), trials: w.trials }
      w.setPhase(1)
      w.run(180)
      return { w, acquired }
    }
    const { w, acquired } = make()
    const b = w.worm.circuit.interneurons[0].weights
    const line = [`acquired: salt ${f(acquired.b[1])} response ${f(acquired.r)} (${acquired.trials} trials)`, `extinguished: salt ${f(b[1])} dish ${f(b[2])} session ${f(b[4])} response ${f(w.responseToCue())} (${w.trials - acquired.trials} trials)`]
    const a = make().w; a.wait(); line.push(`wait → ${f(a.responseToCue())}`)
    const m = make().w; m.moveDish(); line.push(`move → ${f(m.responseToCue())}`)
    const d = make().w; const meals = d.cuesReached; d.deliverOutcome(); d.run(15); line.push(`deliver → ${f(d.responseToCue())} (dish ${f(d.worm.circuit.interneurons[0].weights[2])}, meals +${d.cuesReached - meals}, held ${f(d.learner.held.value)})`)
    console.log(`seed ${seed}: ` + line.join(' | '))
  }
})
