import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The string tests of the Module 9 spec's §11, §12 and §14, over every
 * string a student could see: this scene, and the rodent layer it draws
 * its words from.
 */
const scene = import.meta.glob('./*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const sim = import.meta.glob('../../sim/rodent/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const production = (files: Record<string, string>) => Object.entries(files).filter(([p]) => !p.includes('.test.') && !p.includes('.probe.'))

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

describe('the fifteen lines that are content, each on its panel (§11)', () => {
  it('finds the sources', () => {
    for (const f of ['RatScene.tsx', 'HomeTab.tsx', 'RatsTab.tsx', 'CellsTab.tsx', 'PatchTab.tsx', 'lines.ts', 'ui.tsx', 'AnimalCamera.tsx']) expect(production(scene).some(([p]) => p.endsWith(f)), f).toBe(true)
  })
  it('1. rats stand in for the early mammals, on every tab (the header)', () => {
    expect(lines).toMatch(/Rats stand in for the early mammals of the reading\. Most of what is known about these cells comes from rats\./)
    expect(file('RatScene.tsx')).toMatch(/<Content>\{RATS_LINE\}<\/Content>/)
  })
  it('2. these cells are a model, not recordings, in Part 3', () => {
    expect(lines).toMatch(/These cells are a model computed by this program, not recordings from a rat\./)
    expect(file('CellsTab.tsx')).toMatch(/<Content>\{MODELS_LINE\}<\/Content>/)
  })
  it('3. the cells respond to the estimate, in Part 3', () => {
    expect(lines).toMatch(/These cells respond to where the rat’s own estimate puts it, which can differ from where it is\./)
    expect(file('CellsTab.tsx')).toMatch(/<Content>\{ESTIMATE_LINE\}<\/Content>/)
  })
  it('4. grid cells from the running sum are a hypothesis, beside the grid cells', () => {
    expect(lines).toMatch(/Computing grid cells from the running sum is the leading hypothesis, not an established finding\./)
    expect(file('CellsTab.tsx')).toMatch(/Grid cells<\/GroupLabel>[\s\S]*?<Content>\{GRID_LINE\}<\/Content>/)
  })
  it('5. place cells computed from the estimate, not from grid cells, beside the place cells', () => {
    expect(lines).toMatch(/Here, place cells are computed from the estimate directly, not built from grid cells\./)
    expect(file('CellsTab.tsx')).toMatch(/Firing maps: place cells<\/GroupLabel>[\s\S]*?<Content>\{PLACE_LINE\}<\/Content>/)
  })
  it('6. the rings are an arrangement on paper, beside the rings', () => {
    expect(lines).toMatch(/In the rat, these cells are not laid out in a circle\. Each ring arranges them by the direction each prefers\./)
    expect(file('CellsTab.tsx')).toMatch(/The rings: a ring attractor below, the recorded cells above<\/GroupLabel>[\s\S]*?<Content>\{RINGS_LINE\}<\/Content>/)
  })
  it('7. a screen gives no sense of balance, on Part 1’s orienting screen', () => {
    expect(lines).toMatch(/A screen gives no sense of balance and no feeling of the body moving\. Here, how far and which way you have gone comes only from the ground moving past and the keys you pressed\./)
    expect(file('HomeTab.tsx')).toMatch(/content: \[SCREEN_LINE, COMFORT_LINE\]/)
  })
  it('8. each hidden rat follows one programmed strategy, in Part 2', () => {
    expect(lines).toMatch(/Each hidden rat follows one programmed strategy\. Real rats use several at once\./)
    expect(file('RatsTab.tsx')).toMatch(/<Content>\{PROGRAMMED_LINE\}<\/Content>/)
  })
  it('9. the map is chosen by a rule, not a model of the hippocampus, in Part 3', () => {
    expect(lines).toMatch(/The program chooses a room’s map by a rule that compares rooms\. It is not a model of the hippocampus’s own circuits\./)
    expect(file('CellsTab.tsx')).toMatch(/<Content>\{MAP_RULE_LINE\}<\/Content>/)
  })
  it('10. the leaving rule says when, not how, in the closer', () => {
    expect(lines).toMatch(/The rule says when leaving pays best, not how an animal comes to leave\./)
    expect(file('PatchTab.tsx')).toMatch(/<Content>\{LEAVING_LINE\}<\/Content>/)
  })
  it('11. the home-base line exists for the cuttable step, and the step is not built', () => {
    expect(lines).toMatch(/This is one proposal for why rats explore from a home base\./)
    expect(screen).not.toMatch(/Trips out from a home base/)
  })
  it('12. navigators are programs given the same trips, on Part 1’s reveal', () => {
    expect(lines).toMatch(/These navigators are programs given the same trips\. Ending in the same place does not show the same procedure\./)
    expect(file('HomeTab.tsx')).toMatch(/<Content>\{NAVIGATORS_LINE\}<\/Content>/)
  })
  it('13. three groups of grid cells, beside the grid cells', () => {
    expect(lines).toMatch(/This model has three groups of grid cells\. The most thoroughly recorded rats have four or five\./)
    expect(file('CellsTab.tsx')).toMatch(/<Content>\{THREE_GROUPS_LINE\}<\/Content>/)
  })
  it('14. comfort, on Part 1’s orienting screen', () => {
    expect(lines).toMatch(/Anyone who feels unwell can switch to the follow view or narrow the view\./)
  })
  it('15. the two rings, beside the rings', () => {
    expect(lines).toMatch(/The lower ring stands for the start of the chain, low in the brain, where the heading is kept from turns\. The upper ring stands for the cells recorded further up, where a landmark can correct it\./)
    expect(file('CellsTab.tsx')).toMatch(/<Content>\{TWO_RINGS_LINE\}<\/Content>/)
  })
  it('and the lesion’s assumption is stated beside Step 5', () => {
    expect(lines).toMatch(/is this model’s assumption/)
    expect(file('CellsTab.tsx')).toMatch(/<Content>\{LESION_ASSUMPTION_LINE\}<\/Content>/)
  })
})

describe('words that must not be on screen (§12)', () => {
  it('no agentic verb about cells, the rings, the program, a navigator or a programmed rat', () => {
    const subjects = '(cells?|rings?|bump|program|navigators?|programs?|R[1-6]|hidden rats?|programmed rats?|map rat|beacon rat|route rat|snapshot rat|estimate|system|it)'
    const verbs = '(knows?|knew|notices?|noticed|decides?|decided|remembers?|remembered|wants?|wanted|figures? out|figured out|believes?|thinks?|realiz\\w+|understands?)'
    for (const [path, src] of all) {
      const text = visibleText(src)
      expect(text, path).not.toMatch(new RegExp(`\\b(the|a|each|every|this|that|its) ${subjects} ${verbs}\\b`, 'i'))
      expect(text, path).not.toMatch(/\b(knows|notices|decides|remembers|figures out)\b/i)
    }
  })
  it('carry is not used for information', () => {
    for (const [path, src] of all) expect(visibleText(src), path).not.toMatch(/carr(y|ies|ied|ying) (information|the signal|a signal|the heading|a heading|the estimate|value|news)/i)
  })
  it('no British spellings', () => {
    for (const [path, src] of all) expect(visibleText(src), path).not.toMatch(/\bcolour|\bbehaviour|\bfavour|\bcentre\b|\banalyse|\bgrey\b|\bmetres?\b|\bneighbour/i)
  })
  it('no running the map without moving: no replay, preview, sweep or imagining of cell activity on screen', () => {
    for (const [path, src] of all) {
      const text = visibleText(src)
      expect(text, path).not.toMatch(/\breplay|\bpreplay|imagine the|picture the (room|place|view)|vicarious|sweep ahead/i)
    }
  })
  it('no lesion beyond the reading’s three', () => {
    expect(screen).toMatch(/Turn pathway/)
    expect(screen).toMatch(/damage to the hippocampus/)
    expect(screen).toMatch(/damage to the striatum/)
    for (const [path, src] of all) expect(visibleText(src), path).not.toMatch(/remove the (hippocampus|cortex|cerebell|thalam|entorhinal)/i)
  })
})

describe('the chapter’s words are where the instruments use them (§14)', () => {
  it('the vocabulary', () => {
    for (const w of ['path integration', 'home vector', 'landmark', 'beacon', 'snapshot', 'route', 'cue combination', 'place learning', 'response learning', 'cognitive map', 'survey knowledge', 'ring attractor', 'head-direction cell', 'place cell', 'place field', 'grid cell', 'border cell', 'remapping', 'running sum', 'estimate', 'firing map', 'eye view', 'follow view', 'the plus maze', 'the water maze', 'the radiating paths', 'rich room', 'plain enclosure', 'navigator'])
      expect(screen.toLowerCase(), w).toContain(w.toLowerCase())
  })
  it('reorientation is not claimed, because the step was not built', () => {
    expect(screen).not.toMatch(/reorientation/i)
  })
  it('the controls carry the names the spec gives them', () => {
    for (const w of ['Here is my nest', 'Commit my trials', 'Commit my diagnoses', 'Commit my prediction', 'Reveal', 'Let it explore by itself', 'Skip ahead 2 minutes', 'Skip ahead 10 minutes', 'Skip ahead 1 day', 'Try every setting', 'Narrower view', 'Low detail', 'Eye view', 'Follow view', 'Begin', 'Go on', 'New seed', 'Run the test', 'Skip ahead to the result', 'Pin these maps', 'Clear the maps', 'Move the card', 'Lights on', 'Back to the first room', 'Run a night'])
      expect(screen, w).toContain(w)
  })
  it('a selected tab changes color and nothing else', () => {
    const ui = file('ui.tsx')
    const bar = ui.slice(ui.indexOf('export function TabBar'), ui.indexOf('export function Content'))
    expect(bar).not.toMatch(/fontWeight: tab/)
  })
})

describe('the shell', () => {
  it('the Lab pane message for the missing Lab 9 handout is honest and not an error', () => {
    const registry = readFileSync(join(__dirname, '..', 'registry.ts'), 'utf-8')
    const at = registry.indexOf("route: 'm09-rat'")
    expect(at).toBeGreaterThan(0)
    const entry = registry.slice(at, at + 1800)
    expect(entry).toMatch(/spatial_cognition\/way_home_lab\/way_home_lab\.md/)
    expect(entry).toMatch(/notYet:/)
    expect(entry).toMatch(/has not been posted yet/)
  })
  it('Module 2’s code path is untouched, and the creature engine is reached only through the rate unit and the rule', () => {
    for (const [path, src] of all) {
      const imports = src.match(/^import .*$/gm)?.join('\n') ?? ''
      expect(imports, path).not.toMatch(/sim\/world|sim\/creature|sim\/neural|m02_evolution|sim\/fish|m07_fish/)
      if (!path.endsWith('ring.ts')) expect(imports, path).not.toMatch(/bilaterian/)
    }
  })
  it('CameraRig is mounted only on the Rats tab, and the keys that drive the animal are the scene’s own', () => {
    for (const [path, src] of production(scene)) {
      if (path.endsWith('LabView.tsx')) expect(src).toMatch(/<CameraRig/)
      else expect(src, path).not.toMatch(/<CameraRig/)
    }
    const keys = file('keys.ts')
    expect(keys).toMatch(/isInteractive\(e\.target\)/)
    expect(keys).toMatch(/ArrowUp: 'forward'/)
    expect(keys).toMatch(/KeyW: 'forward'/)
  })
})
