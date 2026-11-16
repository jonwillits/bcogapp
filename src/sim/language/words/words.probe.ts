import { describe, it } from 'vitest'
import { makeDesign } from './design'
import { keyMeasure, share } from './keyMeasure'
import { fit, runModel, runs, type ModelId } from './fit'

/**
 * Stop 2, Part 3 (spec §13, step 3): each model's key measure at fitted
 * parameters over 200 runs, for scripted students across a range of overall
 * accuracies; and, for students simulated by each model, the share whose
 * key measure falls inside each model's 90% range, so that the panel can
 * say how often 48 pairs tell the two accounts apart.
 *   PROBE=1 PROBE_DIR=src/sim/language/words npx vitest run --disable-console-intercept -t "words models"
 */
const pct = (x: number) => (100 * x).toFixed(0).padStart(3)

describe('words models', () => {
  it('prints', () => {
    const out: string[] = []
    const d = makeDesign(1234, 0)
    out.push('1. Each model at a range of its parameter on one design (seed 1234): accuracy over occurrences 2 to 5, and the key measure (after right / after wrong), means over 200 runs with 90% ranges')
    for (const [model, params] of [
      ['guessCheck', [0, 0.25, 0.5, 0.75, 0.9, 1]],
      ['tally', [0, 0.5, 1, 2, 4, 8]],
    ] as [ModelId, number[]][]) {
      for (const p of params) {
        const r = runs(model, p, d, 77)
        out.push(`  ${model.padEnd(10)} ${String(p).padStart(5)}: accuracy ${pct(r.accuracy.mean)}% [${pct(r.accuracy.lo)}-${pct(r.accuracy.hi)}]  after right ${pct(r.afterRight.mean)}% [${pct(r.afterRight.lo)}-${pct(r.afterRight.hi)}]  after wrong ${pct(r.afterWrong.mean)}% [${pct(r.afterWrong.lo)}-${pct(r.afterWrong.hi)}]`)
      }
    }
    out.push('2. Scripted students simulated by each model at a range of accuracies: fit both models to the student’s accuracy, then the share of such students whose after-wrong share falls inside each fitted model’s 90% range (20 students per cell, 200 runs per fit)')
    const designs = [1234, 2345, 3456, 4567, 5678]
    for (const [truthModel, params] of [
      ['guessCheck', [0.3, 0.6, 0.9, 1]],
      ['tally', [0.5, 1, 2, 4]],
    ] as [ModelId, number[]][]) {
      for (const p of params) {
        let inGC = 0
        let inTally = 0
        let n = 0
        const accs: number[] = []
        const fitted: { a: number; b: number }[] = []
        for (let k = 0; k < 20; k++) {
          const dd = makeDesign(designs[k % designs.length], 0)
          const choices = runModel(truthModel, p, dd, 900 + k)
          const km = keyMeasure(dd, choices)
          accs.push(km.accuracy)
          const aw = share(km.afterWrong)
          if (Number.isNaN(aw)) continue
          const fa = fit('guessCheck', dd, km.accuracy, 11 + k, 40)
          const fb = fit('tally', dd, km.accuracy, 13 + k, 40)
          fitted.push({ a: fa.param, b: fb.param })
          const ra = runs('guessCheck', fa.param, dd, 21 + k, 100)
          const rb = runs('tally', fb.param, dd, 23 + k, 100)
          n++
          if (aw >= ra.afterWrong.lo && aw <= ra.afterWrong.hi) inGC++
          if (aw >= rb.afterWrong.lo && aw <= rb.afterWrong.hi) inTally++
        }
        const meanAcc = accs.reduce((a, b) => a + b, 0) / accs.length
        out.push(`  student by ${truthModel.padEnd(10)} ${String(p).padStart(4)} (accuracy about ${pct(meanAcc)}%; fitted α ${(fitted.reduce((s, f) => s + f.a, 0) / fitted.length).toFixed(2)}, β ${(fitted.reduce((s, f) => s + f.b, 0) / fitted.length).toFixed(2)}): inside guess-and-check’s range ${inGC}/${n}, inside tallying’s range ${inTally}/${n}`)
      }
    }
    console.log(out.join('\n'))
  })
})
