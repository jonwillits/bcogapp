import { describe, it } from 'vitest'
import { makeRng } from '../random'
import { computeMatrix, separability, MATRIX_SEEDS } from './matrix'
import { liveHistory, printCounts } from './history'
import { bestPolicy, pointsPerMinute } from './choices/dispensers'
import { PAIRS, type PairId } from './choices/gambles'
import { expectedValue } from './choices/options'
import { runScriptedDelays, delayResults, exponential, hyperbolic } from './choices/delays'
import { stateGraph, startArrangement } from './puzzles/hanoi'
import { runProcedure, PROCEDURE_IDS, PROCEDURES } from './puzzles/procedures'
import { treeSet, bestPath } from './puzzles/trees'
import { runLooker, LOOKER_IDS, LOOKER_LABEL, lookedBelowAfter } from './puzzles/lookers'
import { oneTray, trayStats, lewontinSecond, twins, TWIN_PRESET, poorAndRich, seasons } from './corn/model'
import { CLASS_ENTRIES, cloudFor } from './classes'
import { REFERENCES } from './references'

/**
 * The crib: what the parts should read, printed from the engine over the
 * seeds stated, for the walk-through and the close-out. Every line starts
 * with "m12 · " so the close-out keeps it.
 *
 *   PROBE=1 PROBE_DIR=src/sim/planning npx vitest run --disable-console-intercept -t "crib: m12"
 */
const f2 = (x: number) => x.toFixed(2)
const log = (s: string) => console.log(`m12 · ${s}`)

describe('crib: m12', () => {
  it('what the parts should read', { timeout: 600_000 }, () => {
    log('== Part 1, Step 1 — the pairs: expected values and the published shares')
    for (const pair of [1, 2, 3, 4] as PairId[]) for (const v of ['gain', 'loss'] as const) { const p = PAIRS[pair][v]; log(`pair ${pair} ${v}: EV A ${expectedValue(p.options[0])}, EV B ${expectedValue(p.options[1])}; published ${Math.round(p.source.share * 100)}% chose ${p.countedLabel} (${p.source.citation}, ${p.source.where}, N = ${p.source.n})`) }
    log('== Part 1, Step 2 — scripted choosers: γ 0.995 recovered; k 0.02 recovered; reversals')
    const e = delayResults(runScriptedDelays((a, d) => exponential(0.995, d) * (a / 100)))
    const h = delayResults(runScriptedDelays((a, d) => hyperbolic(0.02, d) * (a / 100)))
    log(`exponential chooser: γ fitted ${e.exponential.parameter.toFixed(4)} (sse ${e.exponential.sse.toFixed(1)}), k fitted ${e.hyperbolic.parameter.toFixed(4)} (sse ${e.hyperbolic.sse.toFixed(1)}); reverses: ${e.reversals.map((r) => r.choseLater).join('/')}`)
    log(`hyperbolic chooser: k fitted ${h.hyperbolic.parameter.toFixed(4)} (sse ${h.hyperbolic.sse.toFixed(1)}), γ fitted ${h.exponential.parameter.toFixed(4)} (sse ${h.exponential.sse.toFixed(1)}); reverses: ${h.reversals.map((r) => r.choseLater).join('/')}`)
    log('== Part 1, Step 3 — the best policies, exact')
    for (const d of ['blue', 'orange'] as const) { const b = bestPolicy(d); log(`${d}: ${b.description} ${f2(b.pointsPerMinute)} points a minute; taking at once ${f2(pointsPerMinute(d, 0))}; waiting 4 s then taking ${f2(pointsPerMinute(d, 4))}`) }
    log('== Part 2, Step 1 — the state graphs')
    for (const n of [3, 4, 5, 6]) log(`${n} disks: ${stateGraph(n).nodes.length} arrangements, shortest ${stateGraph(n).shortest.length - 1} moves, halfway node ${stateGraph(n).halfway ?? 'none'}`)
    log('== Part 2, Step 2 — the five procedures from the usual start: moves, examined, stored, solved; and with one more disk')
    for (const n of [3, 4, 5, 6]) for (const id of PROCEDURE_IDS) { const r = runProcedure(id, n, startArrangement(n)); const t = runProcedure(id, n + 1, startArrangement(n + 1)); log(`${n} disks, ${PROCEDURES[id].label}: moves ${r.moves.length}, examined ${r.examined}, stored ${r.stored}, solved ${r.solved}${r.stopped ? ` (${r.stopped})` : ''}; ${n + 1} disks solved ${t.solved}`) }
    log('== Part 2, Step 3 — the three lookers over 20 seeds’ 16 scored trees: net points, clicks per tree, share looking below the −40')
    for (const id of LOOKER_IDS) {
      let net = 0; let clicks = 0; let saw = 0; let below = 0; let trees = 0
      for (const seed of MATRIX_SEEDS) {
        const rng = makeRng(seed)
        for (const t of treeSet(makeRng(seed ^ 0x72ee5)).scored) {
          const run = runLooker(id, t, rng); net += run.net; clicks += run.looks.length; trees++
          if (t.lossNode !== null) { const b = lookedBelowAfter(run.looks, t.lossNode); if (b !== null) { saw++; if (b) below++ } }
        }
      }
      log(`${LOOKER_LABEL[id]}: net ${(net / MATRIX_SEEDS.length).toFixed(1)} a student, ${(clicks / trees).toFixed(1)} clicks a tree, looked below the −40 on ${saw ? Math.round((100 * below) / saw) : 0}% of the trees on which it uncovered it (${saw} trees)`)
    }
    const best = MATRIX_SEEDS.reduce((s, seed) => s + treeSet(makeRng(seed ^ 0x72ee5)).scored.reduce((a, t) => a + bestPath(t).value, 0), 0) / MATRIX_SEEDS.length
    log(`the best paths sum to ${best.toFixed(1)} a student on average, before any clicks`)
    log('== Part 3 — the histories (seed 1000) and the matrices over 20 seeds')
    const bands = MATRIX_SEEDS.map((s) => liveHistory(s))
    const labels = ['adapted', 'learnedValue', 'copier', 'shallow A', 'shallow B', 'planner']
    bands[0].counts.forEach((c, i) => printCounts(c, labels[i]).forEach((l) => log(l)))
    for (const variant of ['A', 'B'] as const) {
      const m = computeMatrix(variant, MATRIX_SEEDS, bands)
      log(`variant ${variant}: ${['adapted', 'learnedValue', 'copier', 'shallow', 'planner'].map((k) => `${k} ${(['T1', 'T2', 'T3', 'T4', 'T5', 'T6'] as const).map((t) => `${f2(m.cells[k as 'adapted'][t].mean)}(${f2(m.cells[k as 'adapted'][t].sd)})`).join(' ')}`).join(' | ')}`)
      for (const k of ['adapted', 'learnedValue', 'copier', 'shallow', 'planner'] as const) log(`variant ${variant} T2 strip ${k}: ${m.t2Strip[k].map(f2).join(' ')}`)
      for (const r of separability(m)) log(`variant ${variant}: ${r.a} vs ${r.b}: best ${r.bestTest}, difference ${f2(Math.abs(r.difference))}, runs for 95% ${r.runsFor95 ?? '>10'}, separating ${r.separatingTests.join(' ')}`)
    }
    log('== Part 4 — the corn over 20 seeds')
    let hv = 0; let hp = 0; let hu = 0; let l2a = 0; let l2b = 0; let poor = 0; let rich = 0; let mz = 0; let dz = 0; let rise = 0
    for (const seed of MATRIX_SEEDS) {
      const rng = makeRng(seed)
      hv += trayStats(oneTray('varied', 'even', rng)).heritability; hp += trayStats(oneTray('varied', 'patchy', rng)).heritability; hu += trayStats(oneTray('uniform', 'patchy', rng)).heritability
      const [a, b] = lewontinSecond(rng); l2a += trayStats(a).heritability; l2b += trayStats(b).heritability
      const [p, r] = poorAndRich(rng); poor += trayStats(p).heritability; rich += trayStats(r).heritability
      const t = twins(TWIN_PRESET, rng); mz += t.identical; dz += t.fraternal
      const s = seasons(rng); rise += (s[5].stats.meanHeight - s[0].stats.meanHeight) / Math.sqrt(s[0].stats.varianceHeight)
    }
    const n = MATRIX_SEEDS.length
    log(`heritability: varied/even ${f2(hv / n)}, varied/patchy ${f2(hp / n)}, uniform/patchy ${f2(hu / n)}; Lewontin 2: ${f2(l2a / n)} and ${f2(l2b / n)}; poor ${f2(poor / n)}, rich ${f2(rich / n)}; twins preset rMZ ${f2(mz / n)} rDZ ${f2(dz / n)}; six seasons’ rise ${f2(rise / n)} sd`)
    log('== Classes and references')
    for (const c of CLASS_ENTRIES) log(`class ${c.id}: ${cloudFor(c).kind}`)
    for (const r of REFERENCES) log(`reference ${r.id}: ${r.values ? 'filled' : 'PENDING'}`)
  })
})
