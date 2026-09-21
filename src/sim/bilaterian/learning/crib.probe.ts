import { it } from 'vitest'
import { LearningDish, type LearningDishOptions } from './learningDish'
import { learningScenarioByKey } from './scenarios'
import { mean } from '../measure'

/**
 * The viewing crib for Module 5, and the measured numbers behind
 * `docs/M05_AS_BUILT_NOTES.md`. Motion cannot be verified headlessly, so
 * these are predictions to check by eye at localhost:5173 — mostly what the
 * weight trace and the signal trace do over a run, not how the animal moves.
 * Six seeds (1000 to 1005) unless a line says otherwise; times are simulated
 * seconds, which are wall-clock seconds at 1× speed.
 *
 *   PROBE=1 PROBE_DIR=src/sim/bilaterian/learning npx vitest run --disable-console-intercept -t "crib:"
 */

const SEEDS = [1000, 1001, 1002, 1003, 1004, 1005]
const f = (v: number, d = 2) => v.toFixed(d)
const range = (xs: number[], d = 2) => `${f(Math.min(...xs), d)} to ${f(Math.max(...xs), d)} (mean ${f(mean(xs), d)})`
const say = (s: string) => console.log(`m05 · ${s}`)
const b = (w: LearningDish) => w.worm.circuit.interneurons[0].weights

function until(w: LearningDish, done: () => boolean, limit: number): number {
  while (!done() && w.time < limit) w.step(1 / 30)
  return w.time
}

it('crib: what the weight trace and the signal trace should do', () => {
  // hand-over
  {
    const toCeiling: number[] = []
    const harmOn: number[] = []
    const harmOff: number[] = []
    for (const s of SEEDS) {
      const w = new LearningDish(s, learningScenarioByKey('hand-over'))
      toCeiling.push(until(w, () => b(w)[0] >= 3, 300))
      w.run(300 - w.time)
      harmOn.push(w.harm / 5)
      const off = new LearningDish(s, learningScenarioByKey('hand-over'), { learning: { on: false } })
      off.run(300)
      harmOff.push(off.harm / 5)
    }
    say(`hand-over: the food-odor weight climbs from 1.00 in steps, one step per approach, and reaches 3.00 after ${range(toCeiling, 0)} s. It never goes down.`)
    say(`hand-over: harm per minute with the rule on ${range(harmOn, 1)}; with learning off ${range(harmOff, 1)}. The harm counter should NOT slow down.`)
    const slow = SEEDS.map((s) => { const w = new LearningDish(s, learningScenarioByKey('hand-over'), { learning: { rate: 0.01 } }); w.run(300); return b(w)[0] })
    say(`hand-over at η = 0.01: the weight after five minutes is ${range(slow)} — still moving, still no help.`)
  }
  // pairing
  {
    const at = (opts: LearningDishOptions, seconds: number) => SEEDS.map((s) => { const w = new LearningDish(s, learningScenarioByKey('pairing'), opts); w.run(seconds); return w })
    const first = SEEDS.map((s) => { const w = new LearningDish(s, learningScenarioByKey('pairing')); return until(w, () => b(w)[1] >= 3, 600) })
    say(`pairing: salt starts at 0.00, rises in small steps at each meal, then takes off once it passes the threshold 0.35; it reaches 3.00 after ${range(first, 0)} s.`)
    say(`pairing: meals per minute in the first minute ${range(at({}, 60).map((w) => w.cuesReached), 0)}; sites touched in five minutes ${range(at({}, 300).map((w) => w.trials), 0)}.`)
    say(`pairing, interval 10 s: salt after five minutes ${range(at({ interval: 10 }, 300).map((w) => b(w)[1]))}. Interval 3 s: ${range(at({ interval: 3 }, 300).map((w) => b(w)[1]))}. It should NOT take off inside five minutes (one seed in six at 3 s does).`)
    const two = at({ flags: { secondCue: true }, learning: { rate: 0.05 } }, 120)
    say(`pairing, second cue, η = 0.05, two minutes: salt ${range(two.map((w) => b(w)[1]))}, almond identical to the last digit (${two.every((w) => b(w)[1] === b(w)[2])}).`)
    const hi = at({ learning: { rate: 1 } }, 20).map((w) => b(w)[1] / Math.max(1, w.cuesReached))
    const lo = at({ learning: { rate: 0.01 } }, 120).map((w) => b(w)[1] / Math.max(1, w.cuesReached))
    say(`pairing: weight gained per meal at η = 1 over the first 20 s ${range(hi)}; at η = 0.01 over two minutes ${range(lo, 3)}.`)
    const weak = at({ learning: { rate: 0.3, weakening: true } }, 300).map((w) => b(w)[1])
    const comp = at({ learning: { rate: 0.3, competition: true } }, 300).map((w) => b(w)[1])
    say(`pairing with weakening on: salt after five minutes ${range(weak)}, and the trace goes DOWN as well as up. With competition on: ${range(comp)}, flat at 2.00.`)
  }
  // blocking
  {
    for (const factor of ['coincidence', 'prediction'] as const) {
      const rows = SEEDS.map((s) => {
        const w = new LearningDish(s, learningScenarioByKey('blocking'), { learning: { factor } })
        const flat = until(w, () => (factor === 'coincidence' ? b(w)[1] >= 3 : b(w)[1] >= 0.95), 480)
        w.run(Math.max(0, 240 - w.time))
        const one = b(w)[1]
        w.setPhase(1)
        w.run(240)
        return { flat, one, salt: b(w)[1], almond: b(w)[2] }
      })
      say(`blocking under ${factor}: salt stops climbing after ${range(rows.map((r) => r.flat), 0)} s at ${range(rows.map((r) => r.one))}; after four minutes of phase 2, salt ${range(rows.map((r) => r.salt))} and almond ${range(rows.map((r) => r.almond))}.`)
    }
  }
  // four-signals
  {
    for (const factor of ['coincidence', 'prediction', 'teacher', 'verdict'] as const) {
      const rows = SEEDS.map((s) => {
        const w = new LearningDish(s, learningScenarioByKey('four-signals'), { learning: { factor } })
        w.run(300)
        const before = [b(w)[1], b(w)[2]]
        w.flags.almondMarksFood = true
        w.layOutSites()
        w.run(300)
        return { before, after: [b(w)[1], b(w)[2]] }
      })
      say(`four-signals under ${factor}: after five minutes salt ${f(mean(rows.map((r) => r.before[0])))} almond ${f(mean(rows.map((r) => r.before[1])))}; five minutes after the flip salt ${f(mean(rows.map((r) => r.after[0])))} almond ${f(mean(rows.map((r) => r.after[1])))}.`)
    }
  }
  // corridor
  {
    const rows = SEEDS.map((s) => {
      const w = new LearningDish(s, learningScenarioByKey('corridor'))
      const first = [0, 0, 0]
      let seen = 0
      let t10 = 0
      while (w.laneTrials < 30 && w.time < 1200) {
        w.step(1 / 30)
        if (w.laneTrials !== seen) {
          seen = w.laneTrials
          if (seen === 10) t10 = w.time
          w.chainByTrial[w.chainByTrial.length - 1].values.forEach((v, i) => { if (!first[i] && v > 0.3) first[i] = seen })
        }
      }
      const last = w.chainByTrial[w.chainByTrial.length - 1]
      return { first, t10, t30: w.time, last }
    })
    say(`corridor: a value over 0.30 appears at the approach on trial ${range(rows.map((r) => r.first[2]), 0)}, at the turn on trial ${range(rows.map((r) => r.first[1]), 0)}, at the marker on trial ${range(rows.map((r) => r.first[0]), 0)}.`)
    say(`corridor: ten trials take ${range(rows.map((r) => r.t10), 0)} s and thirty take ${range(rows.map((r) => r.t30), 0)} s. On trial 30 the marker holds ${range(rows.map((r) => r.last.values[0]))} and the surprise at the food is ${range(rows.map((r) => r.last.atFood))}, down from 1.00 on trial 1.`)
    say('corridor: the pink column should fade while the green columns fill from the right. With the trace window at 0 nothing fills at all.')
  }
  // extinction
  {
    const rows = SEEDS.map((s) => {
      const make = () => { const w = new LearningDish(s, learningScenarioByKey('extinction')); w.run(240); const acq = { salt: b(w)[1], r: w.responseToCue() }; w.setPhase(1); const from = w.time; until(w, () => w.responseToCue() < 0.2, from + 300); const gone = w.time - from; w.run(60); return { w, acq, gone } }
      const base = make()
      const wait = make().w; wait.wait()
      const move = make().w; move.moveDish()
      const both = make().w; both.wait(); both.moveDish()
      const del = make().w; const meals = del.cuesReached; del.deliverOutcome(); until(del, () => del.cuesReached > meals, del.time + 60)
      return { acq: base.acq, gone: base.gone, salt: b(base.w)[1], dish: b(base.w)[2], session: b(base.w)[4], low: base.w.responseToCue(), wait: wait.responseToCue(), move: move.responseToCue(), both: both.responseToCue(), del: del.responseToCue() }
    })
    say(`extinction: after four minutes of acquisition salt is ${range(rows.map((r) => r.acq.salt))} and the response ${range(rows.map((r) => r.acq.r))}.`)
    say(`extinction: in phase 2 the response falls under 0.20 within ${range(rows.map((r) => r.gone), 0)} s. Salt then sits at ${range(rows.map((r) => r.salt))} — NOT back at 0 — with dish one at ${range(rows.map((r) => r.dish))} and session one at ${range(rows.map((r) => r.session))}; response ${range(rows.map((r) => r.low))}.`)
    say(`extinction: response after Wait ${range(rows.map((r) => r.wait))}; after Move ${range(rows.map((r) => r.move))}; after both ${range(rows.map((r) => r.both))}; after one unpaired meal ${range(rows.map((r) => r.del))}. No weight moves on Wait or Move.`)
  }
}, 600_000)
