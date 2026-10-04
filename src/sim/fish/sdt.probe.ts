import { it } from 'vitest'
import { FishWorld } from './world'
import { scenarioByKey } from './scenarios'
import { fishById, type FishId } from './animals'
import { byHand, dPrimeOf, percentCorrect, hitRate, falseAlarmRate } from './sdt'

const say = (s: string) => console.log(`m07 · ${s}`)
const f = (v: number, d = 2) => v.toFixed(d)

it('sdt: where the numbers fall', () => {
  for (const seed of [2026, 1000, 1001, 1002]) {
    const a = fishById('healthy')
    const w = new FishWorld(seed, scenarioByKey('diagnosis'), { circuit: a.circuit })
    const ev = Array.from(w.testEvidence(w.tests[0]))
    const sorted = [...ev].sort((p, q) => p - q)
    const lo = sorted[Math.floor(sorted.length * 0.1)]
    const hi = sorted[Math.floor(sorted.length * 0.9)]
    const present = ev.filter((_, i) => w.tests[0].happens[i])
    const absent = ev.filter((_, i) => !w.tests[0].happens[i])
    const vals: string[] = []
    for (let k = 0; k <= 16; k++) vals.push(f(byHand(w.testCounts(w.tests[0], lo + ((hi - lo) * k) / 16)).dPrime))
    say(`seed ${seed}: d′ from distributions ${f(dPrimeOf(present, absent))}; from rates across criteria ${f(lo)}..${f(hi)}: ${vals.join(' ')}`)
    for (const id of ['healthy', 'F1', 'F2', 'F3', 'F4'] as FishId[]) {
      const an = fishById(id)
      const ww = new FishWorld(seed, scenarioByKey('diagnosis'), { circuit: an.circuit, settings: { chemistry: an.chemistry } })
      const c = ww.testCounts(ww.tests[0])
      const h = byHand(c)
      say(`  ${id}: hits ${c.hits} misses ${c.misses} FA ${c.falseAlarms} CR ${c.correctRejections}; H ${f(hitRate(c))} F ${f(falseAlarmRate(c))}; pc ${f(percentCorrect(c), 1)}; d′ by hand ${f(h.dPrime)}; c ${f(h.criterion)}`)
    }
    for (const sat of [0.3, 0.4, 0.5]) {
      const an = fishById('F2')
      const ww = new FishWorld(seed, scenarioByKey('diagnosis'), { circuit: an.circuit, settings: { chemistry: { arousal: 1, satiety: sat } } })
      say(`  F2 at satiety ${sat}: pc ${f(percentCorrect(ww.testCounts(ww.tests[0])), 1)}`)
    }
  }
})
