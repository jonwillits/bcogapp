import { describe, it, expect } from 'vitest'

/**
 * The readout's weights are written only by `setWiring` and `learnWeights`
 * (spec §1, §9.2), and every Φ comes from `thirdFactor`. The objects
 * layer holds no other assignment to a unit's weights or baseline, and
 * reimplements no logistic regression beside Lab 7's unit.
 */
const sim = import.meta.glob('./*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const scene = import.meta.glob('../../scenes/m08_objects/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const all = [...Object.entries(sim), ...Object.entries(scene)].filter(([p]) => !p.includes('.test.') && !p.includes('.probe.'))

describe('one writer, two paths', () => {
  it('no file assigns to a unit’s weights or baseline except through learnWeights', () => {
    for (const [path, src] of all) {
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      expect(code, path).not.toMatch(/\.weights\[[^\]]+\]\s*(=|\+=|-=|\*=)[^=]/)
      expect(code, path).not.toMatch(/\.baseline\s*(=|\+=|-=|\*=)[^=]/)
      expect(code, path).not.toMatch(/\.weights\s*=[^=]/)
    }
  })
  it('readout.ts learns through thirdFactor, weightChange and learnWeights, and nothing else moves a weight', () => {
    const readout = all.find(([p]) => p.endsWith('/readout.ts'))![1]
    expect(readout).toMatch(/thirdFactor\('prediction'/)
    expect(readout).toMatch(/learnWeights\(u, changes/)
    expect(readout).toMatch(/weightChange\(rate, x\[i\]/)
    for (const [path, src] of all) if (!path.endsWith('/readout.ts')) expect(src, path).not.toMatch(/learnWeights\(|thirdFactor\(/)
  })
})
