import { it } from 'vitest'
import { LINEAGE_DATA } from './lineageData'
import { observe, CENTRE_LIGHT } from './observation'

const f = (n: number, w = 6) => n.toFixed(2).padStart(w)

it('do they actually approach, and from how far', () => {
  console.log('start | id | arrive  meanD  closest settled  speed | verdict')
  for (const startRadius of [0.3, 0.45, 0.6, 0.8]) {
    for (const fx of LINEAGE_DATA) {
      const o = observe(fx.genomes, CENTRE_LIGHT, {
        startRadius, lightStrength: 4, duration: 40,
      })
      const start = 9 * startRadius
      const verdict =
        o.meanDistance < start - 0.5 ? 'APPROACHES'
        : o.meanDistance > start + 0.5 ? 'moves away'
        : 'stays put'
      console.log(
        `${f(start, 5)} | ${fx.id}  | ${f(o.meanTimeToArrival)} ${f(o.meanDistance)} ${f(
          o.meanClosest,
        )} ${f(o.meanFinalDistance)} ${f(o.meanSpeed)} | ${verdict}`,
      )
    }
    console.log('')
  }
})
