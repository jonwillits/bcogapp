import { describe, it } from 'vitest'
import { FILM_1, FILM_2, measure } from './films'

/** Prints the two films' measurements: PROBE=1 PROBE_DIR=src/sim/social/shapes npx vitest run --disable-console-intercept -t "films:" */
describe('films:', () => {
  it('measurements', () => {
    for (const f of [FILM_1, FILM_2]) {
      const m = measure(f)
      console.log(`${f.title}: motion big ${m.motion.big.toFixed(0)} small ${m.motion.small.toFixed(0)} disc ${m.motion.disc.toFixed(0)} total ${m.motion.total.toFixed(0)}; speed ${Object.entries(m.speed).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(' ')}; contacts ${m.contacts.map((c) => `${c.pair.join('-')} ${c.count}`).join(' ')} total ${m.contactTotal}; door moves ${m.doorMoves}`)
    }
  })
})
