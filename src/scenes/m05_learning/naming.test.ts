import { describe, it, expect } from 'vitest'

/**
 * The naming tests of the Module 5 spec's §9, on every string a student
 * could see: this scene, and the learning layer it draws its words from.
 *
 * **One rule inverts from Lab 4.** Lab 4 asserted that no molecule is named
 * anywhere, because matching its four modulator controls to their molecules
 * was a handout question. §5.3.7 names dopamine and gives its mechanism, so
 * here *dopamine* MUST appear, labeling the broadcast signal — a builder who
 * had read the Lab 4 spec would strip it out — and the absence test narrows
 * to the other three. Lab 4's own test still guards Lab 4's files, unchanged.
 */

const scene = import.meta.glob('./*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const layer = import.meta.glob('../../sim/bilaterian/learning/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

const production = (files: Record<string, string>) =>
  Object.entries(files).filter(([p]) => !p.includes('.test.') && !p.includes('.probe.'))

function visibleText(src: string): string {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const literals = [...code.matchAll(/(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g)].map((m) => m[2])
  const jsxText = [...code.matchAll(/>([^<>{}]+)</g)].map((m) => m[1])
  return [...literals, ...jsxText].join('\n')
}

const all = [...production(scene), ...production(layer)]
const screen = all.map(([, src]) => visibleText(src)).join('\n')
const textOf = (file: string) => visibleText(production(scene).find(([p]) => p.endsWith(file))![1])

describe('naming, Module 5', () => {
  it('finds the sources', () => {
    expect(production(scene).some(([p]) => p.endsWith('LearningTab.tsx'))).toBe(true)
    expect(production(layer).some(([p]) => p.endsWith('scenarios.ts'))).toBe(true)
  })

  it('dopamine is named, on the broadcast signal', () => {
    expect(screen).toMatch(/dopamine — the broadcast signal/)
    expect(textOf('instruments.tsx')).toMatch(/dopamine/)
  })

  it('no other modulator is named after its molecule', () => {
    // The whole file, comments included: a word in a comment is how the next edit puts it on the screen.
    for (const [path, src] of all) expect(src, path).not.toMatch(/serotonin|norepinephrine|noradrenaline|endorphin|opioid/i)
  })

  it('says, where the dopamine is, that the evidence is from vertebrates and largely primates', () => {
    expect(textOf('labels.ts')).toMatch(/made in vertebrates, and largely in primates/)
    expect(production(scene).find(([p]) => p.endsWith('instruments.tsx'))![1]).toMatch(/DOPAMINE_EVIDENCE_LINE\}/)
  })

  it('the tier-four statement is on the Credit section and on the corridor’s own panel', () => {
    expect(textOf('labels.ts')).toMatch(/Real nematodes do not bridge delays of this kind/)
    const tab = production(scene).find(([p]) => p.endsWith('LearningTab.tsx'))![1]
    const world = production(scene).find(([p]) => p.endsWith('WorldTab.tsx'))![1]
    expect(tab).toMatch(/title="Credit"[\s\S]*?TIER_FOUR_LINE/)
    expect(world).toMatch(/spec\.tierFour && <Note><b>\{TIER_FOUR_LINE\}/)
    const corridor = production(layer).find(([p]) => p.endsWith('scenarios.ts'))![1]
    expect(corridor).toMatch(/key: 'corridor'[\s\S]*?tierFour: true/)
  })

  it('nothing on screen speaks of a record of an occasion', () => {
    for (const [path, src] of all) {
      const text = visibleText(src)
      expect(text, path).not.toMatch(/episod/i)
      expect(text, path).not.toMatch(/\breplay/i)
      expect(text, path).not.toMatch(/\bretriev/i)
    }
  })

  it('no structure is named from systems-level anatomy: Module 6 owns that', () => {
    for (const [path, src] of all) expect(src, path).not.toMatch(/basal gangli|cerebell|striat|hippocamp|amygdal/i)
  })

  it('leads with the chapter’s vocabulary', () => {
    for (const word of ['learning rate', 'prediction', 'target', 'eligibility', 'discount', 'value', 'critic', 'actor']) {
      expect(screen.toLowerCase(), word).toContain(word)
    }
    expect(screen).toMatch(/Coincidence/)
    expect(screen).toMatch(/Teacher/)
    expect(screen).toMatch(/Verdict/)
  })

  it('the teacher’s target is said to come from the scenario', () => {
    expect(screen).toMatch(/The target is supplied by the scenario/)
    expect(screen).toMatch(/Nothing inside the animal holds it/)
  })

  it('keeps the trace as a procedure apart from the trace as tissue', () => {
    expect(screen).toMatch(/§5\.2\.8 proposes this as a procedure; §5\.3\.8 reports/)
  })
})
