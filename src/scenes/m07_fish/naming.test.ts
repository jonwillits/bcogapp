import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The string tests of the Module 7 spec's §9, §10 and §12, on every string a
 * student could see: this scene, and the fish's simulation it draws its
 * words from.
 */

const scene = import.meta.glob('./*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const sim = import.meta.glob('../../sim/fish/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

const production = (files: Record<string, string>) =>
  Object.entries(files).filter(([p]) => !p.includes('.test.') && !p.includes('.probe.'))

function visibleText(src: string): string {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const literals = [...code.matchAll(/(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g)].map((m) => m[2])
  const jsxText = [...code.matchAll(/>([^<>{}]+)</g)].map((m) => m[1])
  return [...literals, ...jsxText].join('\n')
}

const all = [...production(scene), ...production(sim)]
const screen = all.map(([, src]) => visibleText(src)).join('\n')
const file = (name: string) => production(scene).find(([p]) => p.endsWith(name))![1]
const labels = visibleText(file('labels.ts'))

describe('the nine lines that are content, each on its panel', () => {
  it('finds the sources', () => {
    for (const f of ['FishScene.tsx', 'WorldTab.tsx', 'NetworkTab.tsx', 'LearningTab.tsx', 'DecisionTab.tsx', 'FishTab.tsx', 'plots.tsx', 'labels.ts'])
      expect(production(scene).some(([p]) => p.endsWith(f)), f).toBe(true)
    expect(production(sim).some(([p]) => p.endsWith('brain.ts'))).toBe(true)
  })

  it('1. orienting: turning toward something new is the tectum’s job, built in, and not this network’s', () => {
    expect(labels).toMatch(/Turning toward something new is not this network’s job\. In a real fish, the tectum turns the head and eyes toward what appears \(Module 6\), and that circuit is built in\. This lab is about what happens next\./)
    expect(file('WorldTab.tsx')).toMatch(/<Content>\{ORIENTING_LINE\}<\/Content>/)
  })

  it('2. murky water: each thing reaches the fish first as a smell', () => {
    expect(labels).toMatch(/The water is murky\. The fish cannot see what is upstream: each thing reaches it first as a smell/)
    expect(file('WorldTab.tsx')).toMatch(/<Content>\{MURKY_LINE\}<\/Content>/)
  })

  it('3. two receptors: a real fish has dozens', () => {
    expect(labels).toMatch(/A real fish has dozens of kinds of smell receptor\. This fish has two, so that its smell space can be drawn\./)
    expect(file('NetworkTab.tsx')).toMatch(/<Content>\{TWO_RECEPTORS_LINE\}<\/Content>/)
  })

  it('4. the dots: the experimenter’s record; the fish keeps only its weights', () => {
    expect(labels).toMatch(/The dots are the experimenter’s record, not the fish’s\. The fish keeps nothing but its weights\./)
    expect(file('NetworkTab.tsx')).toMatch(/title="The feature space"[\s\S]*?<Content>\{DOTS_LINE\}<\/Content>/)
  })

  it('5. the forebrain: a handful of units standing in for circuits including the pallium, not a map', () => {
    expect(labels).toMatch(/The network stands in for circuits in the fish’s forebrain, including its pallium \(Module 6\)\. It is a handful of units, not a map of them\./)
    expect(file('NetworkTab.tsx')).toMatch(/<Content>\{FOREBRAIN_LINE\}<\/Content>/)
  })

  it('6. the proportion receptor: hypothetical, and said so wherever it can be switched on', () => {
    expect(screen).toMatch(/A receptor like this would make the fish tolerant of distance\. Whether real fish have anything like it is not something this lab claims\./)
    expect(file('NetworkTab.tsx')).toMatch(/spec\.line/)
    expect(file('WorldTab.tsx')).toMatch(/x\.id === 'proportion'\)!\.line/)
  })

  it('7. random wiring: the mushroom body is wired like this; whether a fish’s pallium is, is not known', () => {
    expect(screen).toMatch(/The fruit fly’s mushroom body is wired like this \(§7\.3\.4\)\. Whether a fish’s pallium is, is not known\./)
    expect(file('LearningTab.tsx')).toMatch(/\{m\.line\}/)
  })

  it('8. backpropagation: no one has found it in a brain', () => {
    expect(labels).toMatch(/No one has found backpropagation in a brain\. The chapter’s §7\.3\.7 describes what it would need and the proposals that approximate it\. This fish runs it to show what it can do\./)
    expect(file('LearningTab.tsx')).toMatch(/<Content>\{BACKPROP_LINE\}<\/Content>/)
  })

  it('9. the target: the outcome a moment later; nothing inside the fish is a teacher', () => {
    expect(labels).toMatch(/The target is the outcome, a moment later\. Nothing inside the fish is a teacher\./)
    expect(file('LearningTab.tsx')).toMatch(/<Content>\{TARGET_LINE\}<\/Content>/)
  })

  it('and the line under Pass the error back says the rule has not changed shape', () => {
    expect(screen).toMatch(/Each connection still changes by its input times its unit’s share of the error\. A hidden unit’s share comes back from the units it feeds\./)
  })
})

describe('words that must not be on screen', () => {
  it('no loss and no epoch: percent wrong, and encounters', () => {
    for (const [path, src] of all) {
      const text = visibleText(src)
      expect(text, path).not.toMatch(/\bloss(es)?\b/i)
      expect(text, path).not.toMatch(/\bepochs?\b/i)
    }
    expect(screen).toMatch(/percent wrong/)
    expect(screen).toMatch(/encounters/)
  })

  it('no receptor biology and no named sensory structure: Module 8 owns the senses', () => {
    for (const [path, src] of all) {
      expect(visibleText(src), path).not.toMatch(/olfactory|epitheli|\bbulb\b|nostril|transduc|glomerul|retina|cochlea|cilia/i)
    }
  })

  it('the tectum is named once, in the orienting line', () => {
    expect([...screen.matchAll(/tectum/gi)].length).toBe(1)
    expect(labels).toMatch(/tectum/)
  })

  it('no named cortical area, and no neocortex', () => {
    for (const [path, src] of all) {
      expect(visibleText(src), path).not.toMatch(/neocortex|piriform|\bV1\b|\bV2\b|\bV4\b|visual cortex|auditory cortex|inferior temporal|hippocamp|cerebell|basal gangli|striat|amygdal/i)
    }
  })

  it('no string attributes knowing, noticing or deciding to the network', () => {
    // The fish predicts — a held prediction exists, so the word is earned —
    // and it has a verdict. Nothing more agentic than that.
    for (const [path, src] of all) {
      const text = visibleText(src)
      expect(text, path).not.toMatch(/\b(knows?|knew|notic\w*|figur\w+ out|realiz\w*|understands?|wants?|thinks?|believes?|decides?|decided|deciding|recogni[sz]es?|remembers?|expects?|learns? that|detects?|anticipat\w*)\b/i)
    }
    expect(screen).toMatch(/prediction/)
  })

  it('the fish does not meet anything: a smell reaches it, and it encounters or smells a thing', () => {
    // Jon, 2026-10-05: *meet* and *met* make an acquaintance of an eel. The
    // scene's own word is *encounter*.
    for (const [path, src] of all) {
      expect(visibleText(src), path).not.toMatch(/\b(meets?|met|meetings?)\b/i)
    }
  })

  it('nothing on screen speaks of a record kept inside the fish', () => {
    for (const [path, src] of all) {
      const text = visibleText(src)
      expect(text, path).not.toMatch(/episod/i)
      expect(text, path).not.toMatch(/\breplay/i)
      expect(text, path).not.toMatch(/\bretriev/i)
    }
  })

  it('no layers control: one hidden layer, and nothing about images or convolution', () => {
    for (const [path, src] of all) {
      expect(visibleText(src), path).not.toMatch(/hidden layers\b|second hidden layer|number of layers|convolution|pooling layer|adversarial|pixel/i)
    }
  })

  it('no other molecule is named, as in Lab 4', () => {
    for (const [path, src] of all) expect(src, path).not.toMatch(/dopamine|serotonin|norepinephrine|noradrenaline|endorphin|opioid/i)
  })
})

describe('the chapter’s words are where the instruments use them', () => {
  it('signal detection', () => {
    for (const w of ['Hit', 'Miss', 'False alarm', 'Correct rejection']) expect(labels, w).toContain(w)
    for (const w of ['Sensitivity', 'criterion', 'd′', 'hit rate', 'false-alarm rate', 'evidence']) expect(screen, w).toContain(w)
    expect(visibleText(file('DecisionTab.tsx'))).toMatch(/Sensitivity/)
    expect(file('plots.tsx')).toMatch(/d′ = \{d\.toFixed\(2\)\}/)
  })

  it('the network and its learning', () => {
    for (const w of [
      'feature space',
      'decision boundary',
      'Linear separability',
      'prototype',
      'hidden layer',
      'backpropagation',
      'structural credit assignment',
      'dimensionality expansion',
      'sparse coding',
      'training set',
      'test set',
      'overfitting',
      'out-of-distribution generalization',
      'invariance',
      'catastrophic interference',
      'learning rate',
      'activation function',
      'routing switch',
      'baseline',
    ])
      expect(screen, w).toContain(w)
  })

  it('this scene’s own words', () => {
    for (const w of ['receptor A', 'receptor B', 'Encounter', 'built-in receptor', 'pool', 'individuals', 'near', 'far']) expect(screen, w).toContain(w)
  })

  it('the three settings of the hidden layer are named as the spec names them, and Competition is not offered', () => {
    expect(screen).toContain('By hand')
    expect(screen).toContain('Pass the error back')
    expect(screen).toContain('Fixed at random')
    expect(screen).toContain('Who sets the hidden weights?')
    expect(screen).not.toMatch(/\bCompetition\b/)
  })

  it('the controls carry the names the spec gives them', () => {
    for (const w of [
      'Skip ahead 100 encounters',
      'Skip ahead 1,000 encounters',
      'How much smells vary',
      'How many individuals live here',
      'How often an eel is upstream',
      'Show the test set',
      'Show each kind’s average (its prototype)',
      'Number of hidden units',
      'Restore the wiring this scenario started with',
      'Learning on',
      'Score this criterion',
      'Energy per 100 encounters',
      'Go downstream',
      'Learn from every distance',
      'Proportion only',
      'Eels and suckers stay around',
      'An eel comes back',
      'This fish’s stream',
      'Reveal',
      'Both together',
      'Distance from the ideal strength',
      'Proportion of A',
      'The fish’s stakes',
      'The reading’s example',
      'arousal and vigilance',
      'satiety and tone',
    ])
      expect(screen, w).toContain(w)
  })

  it('a selected tab changes color and nothing else', () => {
    const ui = file('ui.tsx')
    const bar = ui.slice(ui.indexOf('export function TabBar'), ui.indexOf('export function Content'))
    expect(bar).not.toMatch(/fontWeight/)
  })
})

describe('the shell', () => {
  it('the Lab pane message for the missing Lab 7 handout is honest and not an error', () => {
    const registry = readFileSync(join(__dirname, '..', 'registry.ts'), 'utf-8')
    const at = registry.indexOf("route: 'm07-fish'")
    expect(at).toBeGreaterThan(0)
    const entry = registry.slice(at, at + 1500)
    expect(entry).toMatch(/pattern_recognition\/fish_lab\/fish_lab\.md/)
    expect(entry).toMatch(/notYet:/)
    expect(entry).toMatch(/has not been posted yet/)
  })

  it('Module 2’s code path is untouched: nothing in the fish imports the evolution engine', () => {
    for (const [path, src] of all) expect(src.match(/^import .*$/gm)?.join('\n') ?? '', path).not.toMatch(/sim\/world|sim\/creature|sim\/neural|m02_evolution/)
  })
})
