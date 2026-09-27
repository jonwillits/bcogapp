import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The vocabulary tests of the spec's §9 and §11, over every string a student
 * could see: this scene's sources, the brain model's data layer, and the
 * specimen manifest and NOTICE.
 *
 * 1. No cortical region is named. Later modules own all of them.
 * 2. No brain structure is called a module, and *fear center* never appears.
 * 3. No agentic verb is applied to a structure.
 * 4. The chapter's vocabulary is what the scene leads with.
 */

const scene = import.meta.glob('./*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const layer = import.meta.glob('../../sim/brain/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

const production = (files: Record<string, string>) => Object.entries(files).filter(([p]) => !p.includes('.test.') && !p.includes('.probe.'))

/** String literals and JSX text only: the words a student could ever see. */
function visibleText(src: string): string {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const literals = [...code.matchAll(/(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g)].map((m) => m[2])
  const jsxText = [...code.matchAll(/>([^<>{}]+)</g)].map((m) => m[1])
  return [...literals, ...jsxText].join('\n')
}

const all = [...production(scene), ...production(layer)]
const DIR = join(__dirname, '..', '..', '..', 'public', 'm06', 'specimens')
const data = [
  ['manifest.json', readFileSync(join(DIR, 'manifest.json'), 'utf-8')],
  ['NOTICE', readFileSync(join(DIR, 'NOTICE'), 'utf-8')],
] as const
const screen = all.map(([, src]) => visibleText(src)).join('\n') + '\n' + data.map(([, s]) => s).join('\n')

describe('naming, Module 6', () => {
  it('finds the sources', () => {
    expect(production(scene).some(([p]) => p.endsWith('BenchTab.tsx'))).toBe(true)
    expect(production(layer).some(([p]) => p.endsWith('bench.ts'))).toBe(true)
    expect(all.length).toBeGreaterThan(12)
  })

  it('names no cortical region', () => {
    const banned = [/\bfrontal\b/i, /\bparietal\b/i, /\btemporal\b/i, /\boccipital\b/i, /\blobes?\b/i, /\bV1\b/, /visual cortex/i, /homunculus/i, /\bBroca/i, /\bWernicke/i, /prefrontal/i, /motor cortex/i, /language area/i]
    for (const [path, src] of all) for (const re of banned) expect(visibleText(src), `${path} ${re}`).not.toMatch(re)
    for (const [name, s] of data) for (const re of banned) expect(s, `${name} ${re}`).not.toMatch(re)
  })

  it('never says fear center, and never calls a brain part a module', () => {
    for (const [path, src] of all) {
      // The whole file, comments included: a word in a comment is how the next edit puts it on the screen.
      expect(src, path).not.toMatch(/fear\s+cent(er|re)/i)
      const text = visibleText(src)
      // "Module 4", "Modules 9 and 10", "later modules" are the book's own chapters. Anything else is a brain part called a module.
      const stray = text.replace(/\bModules? \d/g, '').replace(/\blater modules\b/g, '').replace(/\bModule 6’s\b/g, '')
      expect(stray, path).not.toMatch(/\bmodules?\b/i)
    }
    for (const [name, s] of data) expect(s, name).not.toMatch(/fear\s+cent(er|re)|\bmodules?\b/i)
  })

  it('applies no agentic verb to a structure', () => {
    const verbs = [/\bdecides?\b/i, /\bwants?\b/i, /\bknows?\b/i, /\bnotices?\b/i, /\brecogni[sz]es?\b/i, /\bfigures? out\b/i, /\bunderstands?\b/i, /\bbelieves?\b/i, /\bintends?\b/i]
    for (const [path, src] of all) for (const re of verbs) expect(visibleText(src), `${path} ${re}`).not.toMatch(re)
  })

  it('leads with the chapter’s vocabulary', () => {
    const words = ['vertebrate', 'spinal cord', 'hindbrain', 'midbrain', 'forebrain', 'brainstem', 'tectum', 'hypothalamus', 'thalamus', 'basal ganglia', 'striatum', 'pallium', 'neocortex', 'cerebellum', 'amygdala', 'periaqueductal gray', 'reticular formation', 'climbing fiber', 'direct pathway', 'topographic map', 'corpus callosum', 'reverse inference', 'record', 'remove', 'stimulate', 'silence', 'correlational', 'necessity', 'sufficiency']
    for (const w of words) expect(screen.toLowerCase(), w).toContain(w)
  })

  it('states the three honesty lines: schematic proportions, credited photographs, labeled results', () => {
    expect(screen).toMatch(/Proportions are schematic/)
    expect(screen).toMatch(/Nothing on this bench measures what the animal feels/)
    expect(screen).toMatch(/no result reported/)
    expect(screen).toMatch(/follows from the chapter/)
    expect(screen).toMatch(/This bench reports only experiments the chapter describes/)
    expect(screen).toMatch(/Each description is a first approximation/)
    expect(screen).toMatch(/A part two species both have was most likely present in their common ancestor/)
  })

  it('the Lab pane message for the missing handout is honest and not an error', () => {
    const registry = readFileSync(join(__dirname, '..', 'registry.ts'), 'utf-8')
    const entry = registry.slice(registry.indexOf("route: 'm06-brain'"), registry.indexOf("route: 'm06-brain'") + 1200)
    expect(entry).toMatch(/vertebrate_neural_architecture\/brain_lab\/brain_lab\.md/)
    expect(entry).toMatch(/notYet:/)
    expect(entry).toMatch(/has not been posted yet/)
  })

  it('imports nothing from the bilaterian engine', () => {
    for (const [path, src] of all) expect(src.match(/^import .*$/gm)?.join('\n') ?? '', path).not.toMatch(/sim\/bilaterian/)
  })
})
