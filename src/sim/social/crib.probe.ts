import { describe, it } from 'vitest'
import { RULES, ruleById } from './game/rules'
import { headToHead, twoRuleRoundRobin, populationThreshold, TWO_RULES_ROUNDS } from './game/tworules'
import { roundRobin, predictorVersus, entryLabel, type Entry } from './game/tournament'
import { runGenerations, costAtWhichEntryStops } from './game/generations'
import { measureCycle, SHIPPED_GRID, median } from './game/grid'
import { animalsByTests } from './arena/matrix'
import { ANIMAL_IDS, animalById } from './arena/animals'
import { TESTS } from './arena/trial'
import { runSteps, restingFiring } from './mirror/schedule'
import { disagreementSummary, thePool } from './paths/pool'
import { FILM_1, FILM_2, measure } from './shapes/films'
import { CLASS_ENTRIES } from './classes'
import { REFERENCES } from './references'

/**
 * The crib: what the parts should read, printed from the engine, over the
 * seeds stated, for the walk-through and the close-out.
 *
 *   PROBE=1 PROBE_DIR=src/sim/social npx vitest run --disable-console-intercept -t "crib:"
 */
const f2 = (x: number) => x.toFixed(2)

describe('crib:', () => {
  it('what the parts should read', () => {
    console.log('\n== Part 2, Step 1 — Two Rules (exact)')
    for (const R of TWO_RULES_ROUNDS) {
      const h = headToHead(R)
      const rr = twoRuleRoundRobin(R)
      const x = populationThreshold(R)
      console.log(`  R=${String(R).padStart(3)}: head to head alld ${h.alld} tft ${h.tft}; round-robin tft ${f2(rr.tft.total)} alld ${f2(rr.alld.total)}; threshold ${x === null ? 'never' : x.toFixed(4)}`)
    }
    const rules: Entry[] = RULES.map((rule) => ({ kind: 'rule', rule }))
    for (const noise of [0, 0.05]) {
      const rr = roundRobin(rules, noise)
      console.log(`\n== Part 2, Step ${noise ? 5 : 3} — round-robin of the six, noise ${noise}: ${rr.ranking.map((i) => `${entryLabel(rr.entries[i])} ${f2(rr.totals[i])}`).join(' | ')}`)
      const withP = roundRobin([...rules, { kind: 'predictor' }], noise)
      console.log(`   with Predictor (50 seeds): ${withP.ranking.map((i) => `${entryLabel(withP.entries[i])} ${f2(withP.totals[i])}`).join(' | ')}`)
      const run = runGenerations(withP)
      const last = run.shares[300]
      console.log(`   generations at 300 with Predictor: ${withP.entries.map((e, i) => `${entryLabel(e)} ${(100 * last[i]).toFixed(0)}%`).join(' | ')}; Predictor stops spreading at a cost per stored number of ${costAtWhichEntryStops(withP, withP.entries.length - 1).cost ?? 'none of the five'}`)
    }
    console.log('\n== Part 2, Step 4 — Predictor against each partner, 200 rounds, 50 seeds')
    for (const r of RULES) {
      const v = predictorVersus(r, 200)
      console.log(`  ${r.label.padEnd(36)} points ${v.points.mean.toFixed(0)}±${v.points.sd.toFixed(0)} best ${v.best} share ${f2(v.shareOfBest)} predicted ${f2(v.predictionsShare)} probes ${v.probes.mean.toFixed(1)} lost ${v.lostToProbing.toFixed(0)}`)
    }
    console.log('\n== Part 2, Step 7 — the shipped grid, 20 seeds')
    const c = measureCycle(SHIPPED_GRID, 20)
    const count = (v: (number | null)[]) => v.filter((x) => x !== null).length
    console.log(`  all tit-for-tat → always-cooperate in ${count(c.tftToAllc)}/20, median ${median(c.tftToAllc)} generations; all always-cooperate → always-defect ${count(c.allcToAlld)}/20, median ${median(c.allcToAlld)}; single mutants take all-defect ${count(c.alldToTftMutants)}/20; a 2 × 2 block ${count(c.alldToTftBlock)}/20, median ${median(c.alldToTftBlock)}; mixed: ${c.mixedChanges.filter((m) => m.changes >= 2).length}/20 seeds with 2+ takeovers in 1,000, median ${median(c.mixedChanges.map((m) => m.changes))}, in the cycle's order ${((100 * c.mixedChanges.reduce((a, m) => a + m.inOrder, 0)) / Math.max(1, c.mixedChanges.reduce((a, m) => a + m.changes, 0))).toFixed(0)}%`)
    console.log('\n== Part 3 — the films and the pool')
    const m1 = measure(FILM_1)
    const m2 = measure(FILM_2)
    console.log(`  Film 1 motion ${m1.motion.total.toFixed(0)} contacts ${m1.contactTotal}; Film 2 motion ${m2.motion.total.toFixed(0)} contacts ${m2.contactTotal}`)
    const d = disagreementSummary()
    console.log(`  shown judgment points ${d.total}, substantial disagreements ${d.substantial} (${(100 * d.share).toFixed(0)}%): ${d.points.map((p) => `${p.path}@${p.steps}`).join(' ')}; pool ${thePool().length} paths`)
    console.log('\n== Part 4 — animals × tests, 20 seeds, the learner with the usual room')
    const mx = animalsByTests(20, 'usual', 0)
    console.log('  ' + ''.padEnd(22) + TESTS.map((t) => t.id.padEnd(12)).join(''))
    for (const a of ANIMAL_IDS) console.log('  ' + animalById(a).label.padEnd(22) + TESTS.map((t) => `${f2(mx.mean[a][t.id])} (${f2(mx.sd[a][t.id])})`.padEnd(12)).join(''))
    const many = animalsByTests(20, 'many', 0)
    console.log(`  the learner with many rooms on T8: ${f2(many.mean.learner.T8)} (${f2(many.sd.learner.T8)})`)
    console.log('\n== Part 6 — the cells, 20 seeds; rest ' + f2(restingFiring()))
    const runs = Array.from({ length: 20 }, (_, i) => runSteps(1000 + i))
    const mean = (g: (r: (typeof runs)[number]) => number) => f2(runs.reduce((a, r) => a + g(r), 0) / runs.length)
    for (const step of [1, 2, 3, 4] as const) console.log(`  Step ${step}: precision cell to seen precision ${mean((r) => r[step].precisionCell.toPrecision)}, to seen whole-hand ${mean((r) => r[step].precisionCell.toWholeHand)}; whole-hand cell to seen precision ${mean((r) => r[step].wholeHandCell.toPrecision)}, to seen whole-hand ${mean((r) => r[step].wholeHandCell.toWholeHand)}`)
    console.log('\n== Pending')
    console.log(`  simulated classes pending: ${CLASS_ENTRIES.filter((e) => e.sources.some((s) => s === null)).map((e) => e.id).join(', ')}`)
    console.log(`  references pending: ${REFERENCES.filter((r) => r.values === null).map((r) => r.id).join(', ')}`)
    void ruleById
  }, 600000)
})
