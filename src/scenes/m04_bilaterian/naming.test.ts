import { describe, it, expect } from 'vitest'

/**
 * The naming tests of the spec's §9, on the scene and on the sim layer it
 * draws from — every string a student could see.
 *
 * 1. Nothing learns, and none of that vocabulary appears: no train, epoch,
 *    learning rate, backprop, gradient or error signal.
 * 2. No molecule is named: matching each modulator control to its molecule
 *    is a handout question.
 * 3. Inverting the Module 3 rule that has expired: *activation function*,
 *    *threshold function* and *sigmoid* MUST appear, because §4.2.3 names
 *    them and a builder following the M3 spec would remove them.
 */

const scene = import.meta.glob('./*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const sim = import.meta.glob('../../sim/bilaterian/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

const production = (files: Record<string, string>) =>
  Object.entries(files).filter(([p]) => !p.includes('.test.') && !p.includes('.probe.'))

/**
 * String literals and JSX text only: the words a student could ever see.
 * Comments are stripped first — an apostrophe in a comment would otherwise
 * open a "string" that swallows half the file.
 */
function visibleText(src: string): string {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const literals = [...code.matchAll(/(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g)].map((m) => m[2])
  const jsxText = [...code.matchAll(/>([^<>{}]+)</g)].map((m) => m[1])
  return [...literals, ...jsxText].join('\n')
}

describe('naming', () => {
  it('finds the scene sources', () => {
    const files = production(scene)
    expect(files.length).toBeGreaterThan(6)
    expect(files.some(([p]) => p.endsWith('CircuitTab.tsx'))).toBe(true)
    expect(production(sim).length).toBeGreaterThan(6)
  })

  it('no string speaks the vocabulary of training', () => {
    for (const [path, src] of [...production(scene), ...production(sim)]) {
      const text = visibleText(src)
      expect(text, path).not.toMatch(/\btrain(ing|ed|s)?\b/i)
      expect(text, path).not.toMatch(/\bepochs?\b/i)
      expect(text, path).not.toMatch(/learning rate/i)
      expect(text, path).not.toMatch(/backprop/i)
      expect(text, path).not.toMatch(/\bgradient/i)
      expect(text, path).not.toMatch(/error signal/i)
    }
  })

  it('no string names a molecule', () => {
    for (const [path, src] of [...production(scene), ...production(sim)]) {
      // The whole file, comments included: a word in a comment is how the
      // next edit puts it on the screen.
      expect(src, path).not.toMatch(/dopamine|serotonin|norepinephrine|noradrenaline|endorphin|opioid/i)
    }
  })

  it('the activation function, the threshold function and the sigmoid are named on screen', () => {
    const all = production(scene).map(([, src]) => visibleText(src)).join('\n')
    expect(all).toMatch(/activation function/i)
    expect(all).toMatch(/threshold function/i)
    expect(all).toMatch(/sigmoid/i)
  })

  it('the four modulator controls are named for what they do', () => {
    const all = production(sim).map(([, src]) => visibleText(src)).join('\n')
    for (const word of ['pursuit', 'satiety and tone', 'arousal and vigilance', 'relief']) expect(all).toContain(word)
  })

  it('the older names stay visible once beside the new ones', () => {
    const all = production(scene).map(([, src]) => visibleText(src)).join('\n')
    expect(all).toMatch(/connection strength/)
    expect(all).toMatch(/actuator bias/)
    expect(all).toMatch(/\bweight\b/)
    expect(all).toMatch(/\bbaseline\b/)
  })

  it('says where it is not being literal', () => {
    const all = production(scene).map(([, src]) => visibleText(src)).join('\n')
    expect(all).toMatch(/handful of interneurons/)
  })
})
