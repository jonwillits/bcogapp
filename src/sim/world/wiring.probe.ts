import { it } from 'vitest'
import { LINEAGE_DATA } from './lineageData'
import type { Genome } from '../creature/genome'

const f = (n: number, w = 6) => n.toFixed(2).padStart(w)

it('what are the four weights, actually', () => {
  for (const fx of LINEAGE_DATA) {
    const n = fx.genomes.length
    const m = (pick: (g: Genome) => number) => fx.genomes.reduce((a, g) => a + pick(g), 0) / n
    console.log(`\n=== ${fx.id}`)
    console.log(
      `  mean:  wLL ${f(m((g) => g.wLL))}  wLR ${f(m((g) => g.wLR))}  wRL ${f(
        m((g) => g.wRL),
      )}  wRR ${f(m((g) => g.wRR))}  bias ${f(m((g) => g.bias))}`,
    )
    console.log(
      `         straight (wLL,wRR) sum ${f(m((g) => g.wLL + g.wRR))}   crossed (wLR,wRL) sum ${f(
        m((g) => g.wLR + g.wRL),
      )}`,
    )
    // Sign agreement across the population, per connection: is the population
    // actually of one mind about each weight?
    const agree = (pick: (g: Genome) => number) => {
      const pos = fx.genomes.filter((g) => pick(g) > 0.15).length
      const neg = fx.genomes.filter((g) => pick(g) < -0.15).length
      return `+${pos}/-${neg}/0${n - pos - neg}`
    }
    console.log(
      `  signs: wLL ${agree((g) => g.wLL)}  wLR ${agree((g) => g.wLR)}  wRL ${agree(
        (g) => g.wRL,
      )}  wRR ${agree((g) => g.wRR)}`,
    )
    console.log('  three individuals:')
    for (const g of fx.genomes.slice(0, 3)) {
      console.log(
        `    wLL ${f(g.wLL)} wLR ${f(g.wLR)} wRL ${f(g.wRL)} wRR ${f(g.wRR)} bias ${f(g.bias)}`,
      )
    }
  }
})
