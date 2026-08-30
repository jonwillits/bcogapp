import { it } from 'vitest'
import { LINEAGE_DATA } from './lineageData'
import { modalHue, hueDistance } from './evolutionWorld'

it('fixture hues', () => {
  const h: Record<string, number> = {}
  for (const fx of LINEAGE_DATA) {
    const m = modalHue(fx.genomes.map((g) => g.hue))
    h[fx.id] = m.hue
    const name =
      m.hue < 20 || m.hue > 340 ? 'red' : m.hue < 45 ? 'orange' : m.hue < 70 ? 'yellow'
      : m.hue < 160 ? 'green' : m.hue < 200 ? 'cyan' : m.hue < 260 ? 'blue'
      : m.hue < 300 ? 'violet' : 'magenta'
    console.log(
      `${fx.id}: hue ${m.hue.toFixed(1)}° (${name}), ${Math.round(m.concentration * 100)}% of the population`,
    )
  }
  for (const [a, b] of [['W','X'],['W','Y'],['W','Z'],['X','Z'],['Y','Z'],['X','Y']]) {
    console.log(`  ${a}-${b}: ${hueDistance(h[a], h[b]).toFixed(1)}° apart`)
  }
})
