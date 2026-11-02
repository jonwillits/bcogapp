import { describe, it } from 'vitest'
import { RULES, ruleById } from './rules'
import { headToHead, twoRuleRoundRobin, populationThreshold, TWO_RULES_ROUNDS } from './tworules'
import { roundRobin, predictorVersus, entryLabel, type Entry } from './tournament'
import { runGenerations, costAtWhichPredictorStops, PREDICTOR_COSTS } from './generations'
import { bestTotal } from './best'

/**
 * Re-measures every number in spec §6 in this engine, printed beside the
 * spec's (the build prompt: "print the spec's number beside yours"). Run:
 *
 *   PROBE=1 PROBE_DIR=src/sim/social/game npx vitest run --disable-console-intercept -t "measure:"
 */

const f2 = (x: number) => x.toFixed(2)
const pad = (s: string, n: number) => s.padEnd(n)

describe('measure:', () => {
  it('Two Rules (§6.1)', () => {
    console.log('\n== Two Rules: head to head, round-robin of the two, threshold (spec: 5+(R-1) vs R-1; 4R-1 vs 2R+4; 1/(2R-3))')
    for (const R of TWO_RULES_ROUNDS) {
      const h = headToHead(R)
      const rr = twoRuleRoundRobin(R)
      const x = populationThreshold(R)
      console.log(`R=${String(R).padStart(3)}  alld ${String(h.alld).padStart(4)} tft ${String(h.tft).padStart(4)}   | rr tft ${f2(rr.tft.total).padStart(7)} alld ${f2(rr.alld.total).padStart(7)}   | threshold ${x === null ? 'never' : x.toFixed(4)}  (spec ${R < 3 ? 'never' : (1 / (2 * R - 3)).toFixed(4)})`)
    }
  })

  it('the round-robin without and with noise, with and without Predictor (§6.3, §6.5)', () => {
    const SPEC0: Record<string, number> = { tft: 2.58, allc: 2.5, wsls: 2.42, grim: 2.34, alld: 2.01, stft: 1.75 }
    const SPEC5: Record<string, number> = { wsls: 2.16, alld: 2.1, grim: 2.05, tft: 2.04, stft: 2.01, allc: 1.92 }
    const rules: Entry[] = RULES.map((rule) => ({ kind: 'rule', rule }))
    for (const noise of [0, 0.05]) {
      const spec = noise === 0 ? SPEC0 : SPEC5
      console.log(`\n== Round-robin, noise ${noise}, six rules (200 rounds; exact)`)
      const rr = roundRobin(rules, noise)
      for (const i of rr.ranking) console.log(`  ${pad(entryLabel(rr.entries[i]), 36)} ${f2(rr.totals[i])}   spec ${f2(spec[(rr.entries[i] as { rule: { id: string } }).rule.id])}`)
      console.log('  table (row vs column, points per round):')
      console.log('  ' + pad('', 36) + rr.entries.map((e) => pad(entryLabel(e).slice(0, 7), 8)).join(''))
      rr.table.forEach((row, i) => console.log('  ' + pad(entryLabel(rr.entries[i]), 36) + row.map((c) => pad(f2(c.mean), 8)).join('')))
      console.log(`\n== Round-robin, noise ${noise}, with Predictor (50 seeds, spread in brackets)`)
      const withP = roundRobin([...rules, { kind: 'predictor' }], noise)
      for (const i of withP.ranking) console.log(`  ${pad(entryLabel(withP.entries[i]), 36)} ${f2(withP.totals[i])}`)
      const pi = withP.entries.length - 1
      console.log('  Predictor row: ' + withP.table[pi].map((c, j) => `${entryLabel(withP.entries[j]).slice(0, 7)} ${f2(c.mean)}±${f2(c.sd)}`).join(' | '))
      console.log('  against Predictor (column): ' + withP.table.map((row, j) => `${entryLabel(withP.entries[j]).slice(0, 7)} ${f2(row[pi].mean)}`).join(' | '))
    }
  })

  it('Predictor against each partner (§6.4): points, share of the best, predictions, probes', () => {
    console.log('\n== Predictor vs each partner, 200 rounds, no noise, 50 seeds')
    for (const rule of RULES) {
      const v = predictorVersus(rule, 200)
      console.log(`  ${pad(rule.label, 36)} points ${f2(v.points.mean).padStart(7)}±${f2(v.points.sd)}  best ${v.best}  share ${f2(v.shareOfBest)}  predicted ${f2(v.predictionsShare)}  probes ${f2(v.probes.mean)}  lost to probing ${f2(v.lostToProbing)}`)
    }
    console.log('\n== Predictor vs each partner, 14 rounds (a Part 1 length), no noise')
    for (const rule of RULES) {
      const v = predictorVersus(rule, 14)
      console.log(`  ${pad(rule.label, 36)} points ${f2(v.points.mean).padStart(6)}±${f2(v.points.sd)}  best ${bestTotal(rule, 14).total}  share ${f2(v.shareOfBest)}  predicted ${f2(v.predictionsShare)}`)
    }
    const g = predictorVersus(ruleById('grim'), 200)
    const firstProbe = g.sample.rounds.findIndex((r) => r.probeA)
    console.log(`  sample vs grim: first probe at round ${firstProbe + 1}; moves after it: ${g.sample.rounds.slice(firstProbe, firstProbe + 6).map((r) => r.a + r.b).join(' ')}`)
  })

  it('horizon and probe-rate sweep (as-built notes only, §6.4)', () => {
    const rules: Entry[] = RULES.map((rule) => ({ kind: 'rule', rule }))
    console.log('\n== Predictor total in the round-robin (no noise) by horizon and probe rate; rank in brackets')
    for (const horizon of [1, 3, 5]) {
      const line: string[] = []
      for (const probeRate of [0, 0.02, 0.05, 0.1]) {
        const rr = roundRobin([...rules, { kind: 'predictor', options: { horizon, probeRate } }], 0, 200, 20)
        const pi = rr.entries.length - 1
        line.push(`p=${probeRate}: ${f2(rr.totals[pi])} [${rr.ranking.indexOf(pi) + 1}]`)
      }
      console.log(`  horizon ${horizon}: ${line.join('   ')}`)
    }
  })

  it('generations (§6.6), with and without noise, without and with Predictor; the cost at which Predictor stops spreading', () => {
    const rules: Entry[] = RULES.map((rule) => ({ kind: 'rule', rule }))
    for (const noise of [0, 0.05]) {
      const rr = roundRobin(rules, noise)
      const run = runGenerations(rr)
      const at = (g: number) => run.shares[g].map((s, i) => `${entryLabel(rr.entries[i]).slice(0, 5)} ${(100 * s).toFixed(0)}%`).join(' ')
      console.log(`\n== Generations, noise ${noise}, six rules (spec no noise: alld and stft gone by ~20; end tft 32 allc 24 wsls 23 grim 22. spec 5%: allc gone by ~30, wsls peaks ~50% near 30, alld ~33% near 50, grim >90% by 100)`)
      for (const g of [0, 10, 20, 30, 50, 100, 200, 300]) console.log(`  gen ${String(g).padStart(3)}: ${at(g)}`)
      const withP = roundRobin([...rules, { kind: 'predictor' }], noise)
      const pi = withP.entries.length - 1
      const runP = runGenerations(withP)
      const atP = (g: number) => runP.shares[g].map((s, i) => `${entryLabel(withP.entries[i]).slice(0, 5)} ${(100 * s).toFixed(0)}%`).join(' ')
      console.log(`== Generations, noise ${noise}, with Predictor`)
      for (const g of [0, 10, 20, 30, 50, 100, 200, 300]) console.log(`  gen ${String(g).padStart(3)}: ${atP(g)}`)
      const stop = costAtWhichPredictorStops(withP, pi)
      console.log(`  Predictor's final share by cost: ${PREDICTOR_COSTS.map((c) => `${c}: ${(100 * stop.finalShares[c]).toFixed(1)}%`).join('  ')}   stops spreading at cost ${stop.cost === null ? 'none in the list' : stop.cost} (start ${(100 / withP.entries.length).toFixed(1)}%)`)
    }
  })
})
