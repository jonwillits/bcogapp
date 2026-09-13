import { describe, it, expect } from 'vitest'

/**
 * The no-learning test of the spec's §9, enforced rather than remembered.
 *
 * Nothing learns. The student is the only thing in the room that can change
 * a weight, and the lab's closing move — change what the world rewards,
 * watch the animal fail, fix it by hand, then ask what we have that the worm
 * does not — depends on that being literally true.
 */

const sources = import.meta.glob('./**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const production = Object.entries(sources).filter(
  ([p]) => !p.includes('.test.') && !p.includes('.probe.'),
)

describe('nothing learns', () => {
  it('finds the sim sources', () => {
    expect(production.length).toBeGreaterThan(6)
    expect(production.some(([p]) => p.endsWith('/circuit.ts'))).toBe(true)
  })

  it('no code path writes to a stored weight, baseline, threshold or route except setWiring', () => {
    for (const [path, src] of production) {
      if (path.endsWith('/circuit.ts')) continue
      // Assignments into a unit's weights, baseline, threshold, or a route.
      expect(src, path).not.toMatch(/\.weights\s*\[[^\]]*\]\s*[-+*/]?=/)
      expect(src, path).not.toMatch(/\.baseline\s*[-+*/]?=[^=]/)
      expect(src, path).not.toMatch(/\.threshold\s*[-+*/]?=[^=]/)
      expect(src, path).not.toMatch(/\.routes\s*\[[^\]]*\]\s*=[^=]/)
    }
  })

  it('no string in the sim layer speaks the vocabulary of training', () => {
    for (const [path, src] of production) {
      const strings = [...src.matchAll(/(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g)].map((m) => m[2]).join('\n')
      expect(strings, path).not.toMatch(/\btrain(ing|ed|s)?\b/i)
      expect(strings, path).not.toMatch(/\bepochs?\b/i)
      expect(strings, path).not.toMatch(/learning rate/i)
      expect(strings, path).not.toMatch(/backprop/i)
      expect(strings, path).not.toMatch(/\bgradient/i)
      expect(strings, path).not.toMatch(/error signal/i)
    }
  })

  it('no string in the sim layer names a molecule', () => {
    for (const [path, src] of production) {
      expect(src, path).not.toMatch(/dopamine|serotonin|norepinephrine|noradrenaline|endorphin|opioid/i)
    }
  })
})
