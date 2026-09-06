import { describe, it, expect } from 'vitest'

/**
 * The naming tests of the spec's §10. Both exist because the forbidden word
 * is in each case the obvious one to print.
 *
 * 1. The chapter withholds the name of the output function until Module 4, so
 *    nothing in the scene may call it an activation function, a transfer
 *    function, a rectifier or a ReLU — in either state of the toggle.
 * 2. The chapter's §3.2 names no anatomy, and the Unit tab is that section:
 *    no string on it may say dendrite, soma, axon or synapse.
 */

const sources = import.meta.glob('./*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** String literals and JSX text only: the words a student could ever see. */
function visibleText(src: string): string {
  const literals = [...src.matchAll(/(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g)].map((m) => m[2])
  const jsxText = [...src.matchAll(/>([^<>{}]+)</g)].map((m) => m[1])
  return [...literals, ...jsxText].join('\n')
}

describe('naming', () => {
  it('finds the scene sources', () => {
    const files = Object.keys(sources).filter((p) => !p.includes('.test.'))
    expect(files.length).toBeGreaterThan(6)
    expect(files.some((p) => p.endsWith('UnitTab.tsx'))).toBe(true)
    expect(files.some((p) => p.endsWith('unitLabels.ts'))).toBe(true)
  })

  it('never names the output function', () => {
    for (const [path, src] of Object.entries(sources)) {
      if (path.includes('.test.')) continue
      const text = visibleText(src)
      expect(text, path).not.toMatch(/activation\s+function/i)
      expect(text, path).not.toMatch(/transfer\s+function/i)
      expect(text, path).not.toMatch(/rectif/i)
      expect(text, path).not.toMatch(/\bReLU\b/i)
    }
  })

  it('the Unit tab contains no anatomy', () => {
    const unitFiles = Object.entries(sources).filter(
      ([p]) => p.endsWith('UnitTab.tsx') || p.endsWith('unitLabels.ts'),
    )
    expect(unitFiles.length).toBe(2)
    for (const [path, src] of unitFiles) {
      // The whole file, comments included: a stray word in a comment is how
      // the next edit puts it on the screen.
      expect(src, path).not.toMatch(/dendrit/i)
      expect(src, path).not.toMatch(/\bsoma/i)
      expect(src, path).not.toMatch(/\baxon/i)
      expect(src, path).not.toMatch(/synap/i)
      expect(src, path).not.toMatch(/membraneLabels/)
    }
  })

  it('the Membrane tab does name the four parts', () => {
    const [, src] = Object.entries(sources).find(([p]) => p.endsWith('membraneLabels.ts'))!
    for (const word of ['dendrites', 'soma', 'axon', 'synapse']) expect(src).toContain(word)
  })
})
