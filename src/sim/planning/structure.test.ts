import { describe, it, expect } from 'vitest'

/**
 * The programmed hominins compute only what their procedures allow (spec §11,
 * item 4), by the text of their sources. Adapted contains no learning code
 * and reads no cue. Learned value and the Copier read no model of the range,
 * no transition table, and no other hominin's acts, except that the Copier
 * reads the elder's errands at dawn. The planners learn their models from
 * observations and import nothing from the table of what each need takes.
 * No hominin reads the test's identity.
 */
const files = import.meta.glob('./hominins/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const src = (name: string) => {
  const s = files[`./hominins/${name}`]
  expect(s, name).toBeDefined()
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('what each programmed hominin may read', () => {
  it('no hominin imports the table of what each need takes, the chains, the day, or the tests', () => {
    for (const [path, raw] of Object.entries(files)) {
      const s = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      expect(s, path).not.toMatch(/NEED_TABLE|needOfCue|chainFor|from '\.\.\/range\/chains'|from '\.\.\/day'|from '\.\.\/tests'|from '\.\.\/history'|TestId|TESTS/)
      // The cue is a type; nothing else from needs.ts is imported.
      const needsImports = [...s.matchAll(/import\s+(type\s+)?\{([^}]*)\}\s+from\s+'\.\.\/range\/needs'/g)]
      for (const m of needsImports) for (const name of m[2].split(',').map((x) => x.trim()).filter(Boolean)) expect(name.replace(/^type\s+/, ''), path).toMatch(/^(Cue|CUES)$/)
    }
  })

  it('Adapted contains no learning code and reads no cue', () => {
    const s = src('adapted.ts')
    expect(s).not.toMatch(/learnWeights|thirdFactor|ValueLearner|WorldModel|cue\./)
    expect(s).toMatch(/_cue: Cue/)
  })

  it('Learned value reads no model, no other hominin, and only its own errands and rewards', () => {
    const s = src('learnedValue.ts')
    expect(s).not.toMatch(/WorldModel|elder|Observation\b[^)]*\)\s*:\s*void\s*\{[^}]*\w/)
    expect(s).toMatch(/observe\(_o: Observation\): void \{\}/)
    expect(s).toMatch(/ValueLearner/)
  })

  it('the Copier reads the elder’s errands at dawn only, and otherwise chooses as Learned value does', () => {
    const s = src('copier.ts')
    expect(s).not.toMatch(/WorldModel/)
    expect(s).toMatch(/observe\(_o: Observation\): void \{\}/)
    expect(s).toMatch(/d\.elderAtCamp && d\.elderErrands/)
    expect(s).toMatch(/ValueLearner/)
  })

  it('the planners’ model is built from observations alone', () => {
    const s = src('model.ts')
    expect(s).not.toMatch(/RECIPES|YIELDS|chainFor|NEED_TABLE/)
    expect(s).toMatch(/observe\(o: Observation\)/)
    const p = src('planners.ts')
    expect(p).not.toMatch(/RECIPES|YIELDS|chainFor|NEED_TABLE/)
    expect(p).toMatch(/searchPlans\(/)
  })

  it('the value learner learns only by Lab 5’s Verdict setting, through thirdFactor, written only by learnWeights', () => {
    const s = src('valueLearner.ts')
    expect(s).toMatch(/thirdFactor\('verdict'/)
    expect(s).toMatch(/learnWeights\(this\.actors\[a\]/)
    expect(s).toMatch(/learnWeights\(this\.critic/)
    expect(s).not.toMatch(/'prediction'|'teacher'|'coincidence'/)
  })
})
