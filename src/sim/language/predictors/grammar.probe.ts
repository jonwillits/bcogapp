import { describe, it } from 'vitest'
import { makeRng } from '../../random'
import { corpus, NOUNS, SETTINGS, VERBS, VOCABULARY } from './grammar'

/**
 * Prints Part 4's vocabulary, the generator's settings and 20 sample
 * sentences for the stimulus review sheet (spec §13, step 2; §15, q. 2):
 *   PROBE=1 PROBE_DIR=src/sim/language/predictors npx vitest run --disable-console-intercept -t "grammar sheet"
 */
describe('grammar sheet', () => {
  it('prints', () => {
    const lines: string[] = []
    lines.push('VOCABULARY ' + VOCABULARY.length + ' tokens')
    lines.push('NOUNS ' + NOUNS.map((n) => `${n.singular}${n.plural ? '/' + n.plural : ''} (${n.category})`).join(', '))
    lines.push('VERBS ' + VERBS.map((v) => `${v.singular}/${v.plural} (${v.cls}; subjects ${v.subjects.join('|')}${v.objects.length ? '; objects ' + v.objects.join('|') : ''})`).join('; '))
    lines.push('SETTINGS ' + JSON.stringify(SETTINGS))
    const all = corpus(makeRng(SETTINGS.corpusSeed), SETTINGS.corpusSentences)
    const n = all.length
    const depth = (s: string[]) => s.filter((t) => t === 'who').length
    const hist = [0, 1, 2, 3, 4, 5, 6].map((d) => all.filter((s) => depth(s) === d).length)
    lines.push(`CORPUS ${n} sentences, ${all.reduce((a, s) => a + s.length, 0)} tokens; sentences by number of who: ${hist.join(' ')}; mean length ${(all.reduce((a, s) => a + s.length, 0) / n).toFixed(2)}`)
    for (let i = 0; i < 20; i++) lines.push('S ' + all[i].join(' '))
    console.log(lines.join('\n'))
  })
})
