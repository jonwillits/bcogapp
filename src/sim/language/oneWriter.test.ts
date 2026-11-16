import { describe, it, expect } from 'vitest'

/**
 * One writer, two paths (spec §2, §11 item 5): every weight Lab 13 learns
 * in the browser is written only by Lab 7's `learnWeights`, with Φ from
 * `thirdFactor('passed-back')`. The language layer and the scene hold no
 * other assignment to a unit's weights or baseline, and only the two
 * networks that learn in the browser, Part 1's classifier and Part 2's
 * simple recurrent network, call the learning rule at all.
 */
const sim = import.meta.glob('./**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const scene = import.meta.glob('../../scenes/m13_language/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const all = [...Object.entries(sim), ...Object.entries(scene)].filter(([p]) => !p.includes('.test.') && !p.includes('.probe.'))

const LEARNERS = [/\/sounds\/classifier\.ts$/, /\/stream\/learners\/srn\.ts$/]

describe('one writer, two paths, Module 13 included', () => {
  it('no file assigns to a unit’s weights or baseline except through learnWeights', () => {
    for (const [path, src] of all) {
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      expect(code, path).not.toMatch(/\.weights\[[^\]]+\]\s*(=|\+=|-=|\*=)[^=]/)
      expect(code, path).not.toMatch(/\.baseline\s*(=|\+=|-=|\*=)[^=]/)
      expect(code, path).not.toMatch(/\.weights\s*=[^=]/)
    }
  })
  it('only the classifier and the simple recurrent network call learnWeights or thirdFactor, and each learns through passed-back', () => {
    for (const [path, src] of all) {
      const learner = LEARNERS.some((re) => re.test(path))
      if (learner) {
        expect(src, path).toMatch(/learnWeights\(/)
        expect(src, path).toMatch(/thirdFactor\('passed-back'/)
      } else expect(src, path).not.toMatch(/learnWeights\(|thirdFactor\(/)
    }
  })
})
