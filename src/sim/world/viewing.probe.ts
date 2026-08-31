/**
 * The Lineages tab's light is a *choice*, not a given. Its strength and where
 * the creatures start are mine, and they set how strongly each mechanism
 * expresses itself. A weaker gradient might put the difference between Y and
 * W/X below what a viewer can see, without touching the engine or the fixtures.
 */
import { it } from 'vitest'
import { CONTINUOUS_LINEAGE_DATA } from './continuousLineageData'
import { observe, CENTRE_LIGHT } from './observation'

const f = (n: number, w = 6) => n.toFixed(2).padStart(w)

it('viewing conditions: can the difference be put below threshold', () => {
  for (const lightStrength of [4, 2.5, 1.5, 1]) {
    for (const startRadius of [0.3, 0.5]) {
      console.log(
        `\nlight ${lightStrength}, start ${(startRadius * 9).toFixed(1)} units out`,
      )
      console.log('   id | arrive |  dist | signed speed | % reverse | spread')
      for (const fx of CONTINUOUS_LINEAGE_DATA) {
        const o = observe(fx.genomes, CENTRE_LIGHT, {
          startRadius,
          lightStrength,
          duration: 30,
        })
        console.log(
          `    ${fx.id} | ${f(o.meanTimeToArrival)} | ${f(o.meanDistance, 5)} | ${f(
            o.meanSpeed, 12,
          )} | ${f(o.reverseFraction * 100, 9)} | ${f(o.meanDistanceSpread)}`,
        )
      }
    }
  }
})
