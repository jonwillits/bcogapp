import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The string tests of the Module 8 spec's §8, §9 and §11, over every
 * string a student could see: this scene, and the objects layer it draws
 * its words from.
 */
const scene = import.meta.glob('./*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const sim = import.meta.glob('../../sim/objects/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const production = (files: Record<string, string>) => Object.entries(files).filter(([p]) => !p.includes('.test.') && !p.includes('.probe.') && !p.includes('.node.'))

function visibleText(src: string): string {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const literals = [...code.matchAll(/(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g)].map((m) => m[2])
  const jsxText = [...code.matchAll(/>([^<>{}]+)</g)].map((m) => m[1])
  return [...literals, ...jsxText].join('\n')
}

const all = [...production(scene), ...production(sim)]
const screen = all.map(([, src]) => visibleText(src)).join('\n')
const file = (name: string) => production(scene).find(([p]) => p.endsWith(name))![1]
const lines = visibleText(file('lines.ts'))

describe('the eleven lines that are content, each on its panel (§8)', () => {
  it('finds the sources', () => {
    for (const f of ['ObjectsScene.tsx', 'DrawTab.tsx', 'PartsTab.tsx', 'ViewsTab.tsx', 'NoiseTab.tsx', 'CloserTab.tsx', 'Glimpse.tsx', 'lines.ts'])
      expect(production(scene).some(([p]) => p.endsWith(f)), f).toBe(true)
  })
  it('1. networks: a model, not a brain, on every tab (the header)', () => {
    expect(lines).toMatch(/A network here is an artificial neural network run on a computer: a model, not a brain\./)
    expect(file('ObjectsScene.tsx')).toMatch(/<Content>\{NETWORKS_LINE\}<\/Content>/)
  })
  it('2. trained before the lab, on every tab (the header)', () => {
    expect(lines).toMatch(/These networks were trained before this lab, and nothing done here changes them\. The one exception is the readout unit in Part 3\./)
    expect(file('ObjectsScene.tsx')).toMatch(/<Content>\{TRAINED_BEFORE_LINE\}<\/Content>/)
  })
  it('3. our networks, not the reading’s, on Parts 2 to 4 and the Closer', () => {
    expect(lines).toMatch(/These are our networks, not the ones in the reading, so their numbers differ from the reading’s\./)
    for (const f of ['PartsTab.tsx', 'ViewsTab.tsx', 'NoiseTab.tsx', 'CloserTab.tsx']) expect(file(f), f).toMatch(/<Content>\{OUR_NETWORKS_LINE\}<\/Content>/)
  })
  it('4. pooling, on Draw', () => {
    expect(lines).toMatch(/Pooling keeps the strongest response in a small neighborhood and gives up exactly where it was\. That is Module 7’s trade\./)
    expect(file('DrawTab.tsx')).toMatch(/<Content>\{POOLING_LINE\}<\/Content>/)
  })
  it('5. the built-in step, on Draw', () => {
    expect(lines).toMatch(/Centering and scaling is done before the network receives the drawing\. It is built in, not learned\./)
    expect(file('DrawTab.tsx')).toMatch(/<Content>\{BUILT_IN_LINE\}<\/Content>/)
  })
  it('6. the erasers, on Parts', () => {
    expect(lines).toMatch(/Biederman’s drawings were made by hand/)
    expect(lines).toMatch(/These erasers only approximate his two kinds of deletion\./)
    expect(file('PartsTab.tsx')).toMatch(/<Content>\{ERASERS_LINE\}<\/Content>/)
  })
  it('7. the readout, on Views', () => {
    expect(lines).toMatch(/Only this one unit learns\. The layers beneath it are frozen\./)
    expect(file('ViewsTab.tsx')).toMatch(/<Content>\{READOUT_LINE\}<\/Content>/)
  })
  it('8. the eye, on Noise and the Closer', () => {
    expect(lines).toMatch(/A photograph is sharp everywhere\. A human eye sees sharply only at the center of gaze \(§8\.2\.4\)\./)
    expect(file('NoiseTab.tsx')).toMatch(/<Content>\{EYE_LINE\}<\/Content>/)
    expect(file('CloserTab.tsx')).toMatch(/<Content>\{EYE_LINE\}<\/Content>/)
  })
  it('9. the clock, on the Closer', () => {
    expect(lines).toMatch(/A network that gives people’s answers is not thereby shown to work the way a brain does\./)
    expect(file('CloserTab.tsx')).toMatch(/<Content>\{CLOCK_LINE\}<\/Content>/)
  })
  it('10. privacy, on Draw', () => {
    expect(lines).toMatch(/Drawings stay in this browser\. Nothing is sent anywhere\./)
    expect(file('DrawTab.tsx')).toMatch(/<Content>\{PRIVACY_LINE\}<\/Content>/)
  })
  it('11. the glimpse line, on each glimpse test while glimpse mode is in use', () => {
    expect(lines).toMatch(/The picture appears for about a fifth of a second, then a mask\./)
    for (const f of ['PartsTab.tsx', 'ViewsTab.tsx', 'NoiseTab.tsx']) expect(file(f), f).toMatch(/mode === 'glimpse' && <Content>\{GLIMPSE_LINE\}<\/Content>/)
  })
})

describe('words that must not be on screen (§9)', () => {
  it('no loss and no epoch', () => {
    for (const [path, src] of all) {
      const text = visibleText(src)
      expect(text, path).not.toMatch(/\bloss(es)?\b/i)
      expect(text, path).not.toMatch(/\bepochs?\b/i)
    }
    expect(screen).toMatch(/percent correct/i)
  })
  it('no named cortical area, and no ventral stream', () => {
    for (const [path, src] of all) expect(visibleText(src), path).not.toMatch(/inferior temporal|\bIT cortex|ventral stream|dorsal stream|\bV1\b|\bV2\b|\bV4\b|visual cortex|temporal lobe|parietal|occipital|fovea\b/i)
  })
  it('no agentic verb about a network: it labels, classifies, outputs and responds', () => {
    for (const [path, src] of all) {
      const text = visibleText(src)
      expect(text, path).not.toMatch(/\b(the|a|each|every|this|that|our|three|photo|drawing) (networks?|readout|units?) (sees?|saw|knows?|knew|thinks?|thought|understands?|understood|notices?|noticed|decides?|decided|recogni[sz]es?|recogni[sz]ed|believes?|wants?|realizes?|figures? out)\b/i)
      expect(text, path).not.toMatch(/\bnetworks? (that|which) (see|know|think|understand|notice|decide|recogni[sz]e)/i)
      expect(text, path).not.toMatch(/\bnotic(e|es|ed|ing)\b/i)
    }
  })
  it('invariance names the problem; what is achieved is tolerance', () => {
    expect(screen).toMatch(/tolerance/i)
    expect(screen).not.toMatch(/achieves? invariance|is invariant|invariant to/i)
  })
  it('no adversarial attack tool and no generated image of what a unit wants', () => {
    for (const [path, src] of all) expect(visibleText(src), path).not.toMatch(/adversarial|wants to see|dream/i)
  })
})

describe('the chapter’s words are where the instruments use them (§11)', () => {
  it('the vocabulary', () => {
    for (const w of ['tolerance', 'convolution', 'pooling', 'feature map', 'layer', 'readout', 'Hit', 'Miss', 'False alarm', 'Correct rejection', 'd′', 'recoverable', 'view', 'training', 'glimpse', 'mask', 'between', 'beyond', 'at right angles', 'one shoe among shoes', 'one shoe among other things', 'noise A', 'noise B', 'drawing network', 'photo network', 'learning rate', 'baseline', 'weight', 'prediction'])
      expect(screen.toLowerCase(), w).toContain(w.toLowerCase())
  })
  it('the controls carry the names the spec gives them', () => {
    for (const w of ['Commit my answers', 'Center and scale the drawing first', 'Undo', 'Clear', 'Draw this:', 'Mid-line', 'At the joints', 'Learning on', 'Skip ahead', 'same shoe', 'not the same shoe', 'New seed', 'Label my drawing', 'Show it', 'Start the test'])
      expect(screen, w).toContain(w)
  })
  it('a selected tab changes color and nothing else', () => {
    const ui = file('ui.tsx')
    const bar = ui.slice(ui.indexOf('export function TabBar'), ui.indexOf('export function Content'))
    expect(bar).not.toMatch(/fontWeight: tab/)
  })
})

describe('the shell', () => {
  it('the Lab pane message for the missing Lab 8 handout is honest and not an error', () => {
    const registry = readFileSync(join(__dirname, '..', 'registry.ts'), 'utf-8')
    const at = registry.indexOf("route: 'm08-objects'")
    expect(at).toBeGreaterThan(0)
    const entry = registry.slice(at, at + 1500)
    expect(entry).toMatch(/perception_and_action\/object_lab\/object_lab\.md/)
    expect(entry).toMatch(/notYet:/)
    expect(entry).toMatch(/has not been posted yet/)
  })
  it('Module 2’s code path is untouched, and the creature engine is reached only through the readout', () => {
    for (const [path, src] of all) {
      const imports = src.match(/^import .*$/gm)?.join('\n') ?? ''
      expect(imports, path).not.toMatch(/sim\/world|sim\/creature|sim\/neural|m02_evolution/)
      if (!path.endsWith('readout.ts') && !path.endsWith('readout.probe.ts')) expect(imports, path).not.toMatch(/sim\/bilaterian/)
    }
  })
})
