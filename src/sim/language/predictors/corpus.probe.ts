import { describe, it } from 'vitest'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { makeRng } from '../../random'
import { corpus, SETTINGS, VOCABULARY } from './grammar'

/**
 * Writes the one corpus every student sees, and the vocabulary, to
 * training/m13/corpus/ for the offline training of Part 4's networks
 * (spec §8.1, §8.5): the TypeScript generator is the source of the corpus,
 * so the networks are trained on exactly the sentences the lab shows.
 *   PROBE=1 PROBE_DIR=src/sim/language/predictors npx vitest run --disable-console-intercept -t "write corpus"
 */
describe('write corpus', () => {
  it('writes', () => {
    const dir = join(__dirname, '..', '..', '..', '..', 'training', 'm13', 'corpus')
    mkdirSync(dir, { recursive: true })
    const all = corpus(makeRng(SETTINGS.corpusSeed), SETTINGS.corpusSentences)
    writeFileSync(join(dir, 'corpus.txt'), all.map((s) => s.join(' ')).join('\n') + '\n')
    writeFileSync(join(dir, 'vocabulary.json'), JSON.stringify({ tokens: VOCABULARY, settings: SETTINGS }, null, 1))
    console.log(`wrote ${all.length} sentences, ${VOCABULARY.length} tokens to ${dir}`)
  })
})
