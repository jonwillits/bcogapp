import { describe, it, expect } from 'vitest'

/**
 * The boundaries of Part 5 (spec §12, items 3, 5 and 8), held on the
 * sources: the tendency unit stores no occasion (Lab 5's no-record test,
 * extended); no forager's error is written in; the hidden layer is this
 * scene's; and nothing reaches for a second source of randomness.
 */
const files = import.meta.glob('./*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const production = Object.entries(files).filter(([p]) => !p.includes('.test.') && !p.includes('.probe.'))
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const file = (name: string) => strip(production.find(([p]) => p.endsWith(name))![1])

describe('the tendency-only forager stores no occasion', () => {
  it('the tendency unit holds no list that grows, keeps no timestamps, and names no record', () => {
    const t = file('tendency.ts')
    expect(t).not.toMatch(/\.push\(|\.unshift\(|new Map|new Set|\bhistory\b|\blog\b|\bnights?\b|Date\.now|performance\.now/)
    expect(t).not.toMatch(/episod|replay|retriev|store/i)
  })
  it('it learns only through thirdFactor on the Prediction setting and learnWeights', () => {
    const t = file('tendency.ts')
    expect(t).toMatch(/thirdFactor\('prediction'/)
    expect(t).toMatch(/learnWeights\(this\.unit/)
    expect(t).not.toMatch(/\.weights\s*\[[^\]]*\]\s*[-+*/]?=(?!=)/)
    expect(t).not.toMatch(/'coincidence'|'teacher'|'verdict'/)
  })
  it('the foragers reach the tendency unit only through begin and outcome', () => {
    const f = file('foragers.ts')
    expect(f).toMatch(/tendency\.begin\(/)
    expect(f).toMatch(/tendency\?\.outcome\(/)
    expect(f).not.toMatch(/tendency\.unit\.weights\s*\[[^\]]*\]\s*=/)
  })
})

describe('no forager’s error is written in', () => {
  it('no error rate, confusion rate, mistake probability or special case for a night or a block appears in the foragers or the store', () => {
    for (const name of ['foragers.ts', 'store.ts', 'slow.ts', 'tendency.ts']) {
      const src = file(name)
      expect(src, name).not.toMatch(/errorRate|confusionRate|mistake|ERROR_|CONFUSE|lookAlike\s*\?|kind === 'look-alike'|kind === 'distinct'/)
      expect(src, name).not.toMatch(/Math\.random|Date\.now/)
    }
  })
  it('the store’s retrieval is similarity and nothing else: contributions come from the cosine of codes', () => {
    const s = file('store.ts')
    expect(s).toMatch(/cosine\(cue, n\.code\)/)
    expect(s).toMatch(/contributions\[i\] \* n\.content\[k\]/)
  })
  it('the forager acts on the retrieved strength, with no threshold written in', () => {
    const f = file('foragers.ts')
    expect(f).toMatch(/decideRng\.next\(\) < \(r\.blended\[l\.id\] \?\? 0\)/)
    expect(f).not.toMatch(/blended\[l\.id\][^\n]*>= 0\.5/)
  })
})

describe('the hidden layer is this scene’s', () => {
  it('the slow learner’s hidden units learn through the passed-back Φ and learnWeights, and the separation stage never learns', () => {
    const s = file('slow.ts')
    expect(s).toMatch(/thirdFactor\('passed-back'/)
    expect(s).toMatch(/thirdFactor\('teacher'/)
    expect(s).toMatch(/learnWeights\(this\.hidden\[j\]/)
    expect(s).toMatch(/learnWeights\(this\.outputs\[k\]/)
    const st = file('store.ts')
    expect(st).not.toMatch(/learnWeights|thirdFactor/)
  })
  it('the separation stage is Lab 7’s random direction and sparse baseline, not a second version', () => {
    const st = file('store.ts')
    expect(st).toMatch(/import \{[^}]*randomDirection[^}]*sparseBaseline[^}]*\} from '\.\.\/\.\.\/fish\/brain'/)
  })
})
