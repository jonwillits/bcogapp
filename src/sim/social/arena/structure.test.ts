import { describe, it, expect } from 'vitest'

/**
 * The learner computes no line of sight (spec §13, item 5): no code path
 * in it reads the geometry module or the dominant's line-of-sight state.
 * `learner.ts` and `features.ts` import nothing from `geometry.ts`,
 * `animals.ts` or `trial.ts`'s staging, and name no sight, facing or
 * visibility; the view fields they read are the observable record.
 */
const files = import.meta.glob('./*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const src = (name: string) => files[`./${name}`]!

describe('the learner reads no line of sight', () => {
  it('learner.ts and features.ts import no geometry, and no module that computes sight', () => {
    for (const name of ['learner.ts', 'features.ts', 'doors.ts']) {
      const imports = src(name).match(/^import .*$/gm)?.join('\n') ?? ''
      expect(imports, name).not.toMatch(/geometry|animals|experience|matrix/)
      const code = src(name).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      expect(code, name).not.toMatch(/inLineOfSight|visibleFloor|hidingSide|\.facing\b|lineOfSight|segmentsCross|DOORS\b|POSITIONS\b/)
    }
    expect(src('features.ts')).toMatch(/from '\.\/doors'/)
    expect(src('features.ts')).toMatch(/import type \{ View \} from '\.\/trial'/)
  })
  it('the learner learns only by thirdFactor on the Prediction setting, written by learnWeights', () => {
    const code = src('learner.ts')
    expect(code).toMatch(/thirdFactor\('prediction'/)
    expect(code).toMatch(/thirdFactor\('passed-back'/)
    expect(code).toMatch(/learnWeights\(this\.output/)
    expect(code).toMatch(/learnWeights\(this\.hidden\[j\]/)
    expect(code).not.toMatch(/thirdFactor\('(teacher|verdict|coincidence)'/)
  })
  it('no error is written in: the animals’ choices come from their rules and the 0.85, the dominant’s from its rule', () => {
    const animals = src('animals.ts')
    expect(animals).toMatch(/FOLLOWS_RULE = 0\.85/)
    // The rules themselves name no test: only the ANIMALS table does, for the reveal's "separated by" line.
    const rules = animals.slice(animals.indexOf('export function preference'))
    expect(rules).not.toMatch(/\bT[1-8]\b/)
    const learner = src('learner.ts')
    expect(learner).not.toMatch(/T8|top|'east'/)
  })
})
