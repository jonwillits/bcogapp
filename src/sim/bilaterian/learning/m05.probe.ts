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
