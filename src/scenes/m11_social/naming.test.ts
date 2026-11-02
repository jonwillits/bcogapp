import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SAVED_HERE_LINE, STORAGE_UNAVAILABLE_LINE } from './lines'

/**
 * The string tests of the Module 11 spec's §12, §13 and §16, over every
 * string a student could see: this scene and the social layer it draws
 * its words from.
 *
 * §13, item 2: before Part 3, Step 1's reveal, no string in Part 3
 * contains *goal*, *intention*, *agent*, *animate*, *alive*, *purpose*,
 * *motive*, *chase*, *hide*, *bully*, *Heider* or *Simmel*, except the
 * rating question, which appears only after all three descriptions.
 * §13, item 3: before Part 5's reveal, no string in Part 5 contains
 * *stereotype*, *exaggerat-*, *accentuat-*, *bias*, *boundary*, *categor-*
 * or *Tajfel*. §13, item 4: Part 1 names no rule before its commit. The
 * files that may hold those words are reveals, the models' own files
 * (rendered only after the commit), and the data files.
 */
const scene = import.meta.glob('./**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const sim = import.meta.glob('../../sim/social/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const production = (files: Record<string, string>) => Object.entries(files).filter(([p]) => !p.includes('.test.') && !p.includes('.probe.'))

/** Every string a file can put on the screen: its string literals, and in a .tsx file its JSX text. */
function visibleText(src: string, jsx = true): string {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const literals = [...code.matchAll(/(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g)].map((m) => m[2])
  const jsxText = jsx ? [...code.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]) : []
  return [...literals, ...jsxText].join('\n')
}

const all: [string, string][] = [...production(scene), ...production(sim)]
const textOf = (path: string, src: string) => visibleText(src, path.endsWith('.tsx'))
const screen = all.map(([p, src]) => textOf(p, src)).join('\n')
const file = (name: string) => production(scene).find(([p]) => p.endsWith(name))![1]
const lines = visibleText(file('lines.ts'), false)

const PART3_FORBIDDEN = /\bgoal|intention|\bagent|animate|\balive\b|purpose|motive|\bchase|\bhide|\bhid\b|\bhiding\b|bully|Heider|Simmel/i
const PART5_FORBIDDEN = /stereotype|exaggerat|accentuat|\bbias|boundary|categor|Tajfel/i
const PART1_FORBIDDEN = /tit-for-tat|grudger|\bgrim\b|win-stay|lose-shift|Pavlov|always cooperate|always defect|suspicious|defect forever/i

/** Part 3's files that may hold its forbidden words: the reveals, the models (named only after the prediction), the films' rating strings (after the three descriptions), the references and the class file. */
const PART3_FILES = (p: string) => p.includes('/shapes/') || p.includes('PartShapes') || p.includes('/paths/')
const PART3_REVEAL = /Reveal\.tsx$|\/sim\/social\/paths\/models\.ts$|\/sim\/social\/paths\/pool\.ts$|\/sim\/social\/shapes\/films\.ts$|references\.ts$|classes\.ts$|lines\.ts$/
const PART5_FILES = (p: string) => p.includes('/groups/') || p.includes('PartGroups')
const PART5_REVEAL = /Reveal\.tsx$|references\.ts$|classes\.ts$|lines\.ts$/
const PART1_FILES = (p: string) => p.includes('/partners/') || p.includes('PartPartners')
const PART1_REVEAL = /Reveal\.tsx$/

describe('nothing names what Part 3 tests before its reveal (§13, item 2)', () => {
  it('no Part 3 file outside the reveals and the models holds a forbidden word in a visible string', () => {
    for (const [path, src] of all) {
      if (!PART3_FILES(path) || PART3_REVEAL.test(path)) continue
      const hits = textOf(path, src).split('\n').filter((l) => PART3_FORBIDDEN.test(l))
      expect(hits, `${path}: ${hits.join(' | ')}`).toEqual([])
    }
  })
  it('the films’ data names no forbidden word outside the rating question and the checklist, which come after the descriptions', () => {
    const films = production(sim).find(([p]) => p.endsWith('/shapes/films.ts'))![1]
    const stripped = visibleText(films, false)
      .split('\n')
      .filter((l) => !/act on purpose|gave a shape a goal|trying to get somewhere/.test(l))
    expect(stripped.filter((l) => PART3_FORBIDDEN.test(l))).toEqual([])
  })
  it('the tab and part titles are neutral', () => {
    const ui = visibleText(file('ui.tsx'))
    expect(ui).toMatch(/Shapes/)
    expect(ui).toMatch(/Groups/)
    expect(ui).not.toMatch(PART3_FORBIDDEN)
    expect(ui).not.toMatch(PART5_FORBIDDEN)
  })
})

describe('nothing names what Part 5 tests before its reveal (§13, item 3)', () => {
  it('no Part 5 file outside the reveal holds a forbidden word in a visible string', () => {
    for (const [path, src] of all) {
      if (!PART5_FILES(path) || PART5_REVEAL.test(path)) continue
      const hits = textOf(path, src).split('\n').filter((l) => PART5_FORBIDDEN.test(l))
      expect(hits, `${path}: ${hits.join(' | ')}`).toEqual([])
    }
    // The sets' data file names nothing either.
    const sets = production(sim).find(([p]) => p.endsWith('/groups/sets.ts'))![1]
    expect(visibleText(sets, false)).not.toMatch(PART5_FORBIDDEN)
  })
})

describe('Part 1 names no rule before the commit (§13, item 4)', () => {
  it('no Part 1 file outside the reveal holds a rule name in a visible string; the rules’ names live in the game layer and the reveal', () => {
    for (const [path, src] of all) {
      if (!PART1_FILES(path) || PART1_REVEAL.test(path)) continue
      const hits = textOf(path, src).split('\n').filter((l) => PART1_FORBIDDEN.test(l))
      expect(hits, `${path}: ${hits.join(' | ')}`).toEqual([])
    }
  })
})

describe('words that must not be on screen (§13, items 6 and 7)', () => {
  it('no agentic verb about a program, rule, partner, entry, Predictor, model, the learner, or the cells', () => {
    const subjects = '(programs?|rules?|partners?|entr(y|ies)|Predictor|models?|learner|cells?|it|network|grid|cell|animals?|dominant|subordinate)'
    const verbs = '(knows?|knew|thinks?|thought|believes?|notices?|noticed|decides?|decided|wants?|wanted|trusts?|forgives?|punish(es)?|remembers?|remembered|holds a grudge|figures? out|realiz\\w+|understands?)'
    for (const [path, src] of all) {
      const t = textOf(path, src)
      const hits = t.split('\n').filter((l) => new RegExp(`\\b(the|a|each|every|this|that|its|no) ${subjects} ${verbs}\\b`, 'i').test(l) && !/chimpanzees (understand|know)|the student|you (know|think|want)/i.test(l))
      expect(hits, `${path}: ${hits.join(' | ')}`).toEqual([])
    }
  })
  it('keep and hold are not used for memory or information; pays off is not used', () => {
    for (const [path, src] of all) {
      const t = textOf(path, src)
      expect(t, path).not.toMatch(/\b(keeps?|kept|holds?|held) (a |the |its |your )?(memory|memories|information|record|a list|in mind)\b/i)
      expect(t, path).not.toMatch(/\bpays off\b/i)
    }
  })
  it('no British spellings (a published title is quoted as published)', () => {
    for (const [path, src] of all) expect(path.endsWith('references.ts') ? textOf(path, src).replace(/Classification and quantitative judgement/g, '') : textOf(path, src), path).not.toMatch(/\bcolour|\bbehaviour|\bfavour|\bcentre\b|\banalyse|\bgrey\b|\bmetres?\b|\bneighbour|\brecognis|\borganis(e|ed|es|ing|ation)\b|\bmemoris|\blicence\b|\bjudgement\b/i)
  })
  it('no browser dialog: no alert, confirm or prompt', () => {
    for (const [path, src] of production(scene)) expect(src, path).not.toMatch(/\balert\(|window\.confirm|\bconfirm\(|window\.prompt|\bprompt\(/)
  })
})

describe('the lines that are content, each on its panel (§12)', () => {
  it('every line exists and is used where the spec puts it', () => {
    const uses: [string, RegExp, string][] = [
      ['SECOND_RUN_LINE', /A second run is not a first run/, 'Part0.tsx'],
      ['BEST_TOTAL_LINE', /best possible total is computed with the match’s length/, 'partners/Reveal.tsx'],
      ['PREDICTING_PLAYING_LINE', /Predicting a partner well and playing well against it are different/, 'partners/Reveal.tsx'],
      ['NO_BRAIN_LINE', /An organism does not need a brain to employ a strategy/, 'PartTournament.tsx'],
      ['NEVER_AHEAD_LINE', /Tit-for-tat never scores more than its partner in a single match/, 'tournament/steps.ts'],
      ['ENOUGH_COOPERATORS_LINE', /Repeated play favors tit-for-tat only when enough of the others also cooperate/, 'tournament/steps.ts'],
      ['THE_FIELD_LINE', /Which rule wins depends on which other rules are entered/, 'tournament/steps.ts'],
      ['PREDICTING_LINE', /Predictor estimates each partner’s next move/, 'tournament/steps.ts'],
      ['FINDING_OUT_LINE', /a probe is a defection/, 'tournament/steps.ts'],
      ['STAND_IN_COST_LINE', /This cost stands in for what memory costs an animal/, 'tournament/steps.ts'],
      ['MISTAKES_LINE', /With mistakes, a move is sometimes the opposite of what the rule specifies/, 'tournament/steps.ts'],
      ['THE_GRID_LINE', /Each cell copies the rule of its highest-scoring neighbor/, 'tournament/steps.ts'],
      ['ONE_VIEWER_LINE', /The 1944 viewers saw a different film/, 'shapes/Reveal.tsx'],
      ['GOALS_NOT_BELIEFS_LINE', /Inverse planning infers where something is heading, not what it believes/, 'shapes/Reveal.tsx'],
      ['PROGRAMMED_ANIMALS_LINE', /These are programs with rules\. The same choices do not show the same rule/, 'PartArena.tsx'],
      ['THE_LEARNER_LINE', /The learner was trained on contests, not on lines of sight/, 'arena/steps.ts'],
      ['MODEL_CELLS_LINE', /These are model cells/, 'PartMirror.tsx'],
      ['HUMAN_RESULT_LINE', /the reversal was measured in the muscles/, 'mirror/steps.ts'],
      ['RESTARTED_LINE', /This part was interrupted and run again/, 'partners/Reveal.tsx'],
      ['COMMIT_RULE_LINE', /Nothing a test would tell you is shown until you commit/, 'Part0.tsx'],
    ]
    for (const [name, re, where] of uses) {
      expect(lines, name).toMatch(re)
      const src = production(scene).find(([p]) => p.endsWith(where))
      expect(src, `${where} for ${name}`).toBeDefined()
      expect(src![1], `${name} in ${where}`).toMatch(new RegExp(name))
    }
    expect(SAVED_HERE_LINE).toMatch(/Results are saved in this browser on this computer only/)
    expect(STORAGE_UNAVAILABLE_LINE).toMatch(/results will be lost if this page is closed/)
    expect(file('SocialScene.tsx')).toMatch(/<StorageLine available=\{progress\.storageAvailable\} \/>/)
  })
})

describe('the chapter’s words are where the instruments use them (§16)', () => {
  it('the vocabulary', () => {
    for (const w of ['payoff matrix', 'prisoner’s dilemma', 'cooperate', 'defect', 'strategy', 'tit-for-tat', 'evolutionarily stable strategy', 'reciprocal altruism', 'theory of mind', 'inverse planning', 'Morgan’s Canon', 'behavior-reading', 'stereotype', 'mirror neuron', 'premotor cortex', 'Two Rules', 'Suspicious tit-for-tat', 'Defect forever after one defection', 'Win-stay, lose-shift', 'Predictor', 'probe', 'noise', 'generations', 'the cycle', 'line of sight', 'Line of sight now', 'Line of sight before', 'the usual room', 'many rooms', 'precision grip', 'whole-hand grasp', 'a simulated class'])
      expect(screen.toLowerCase(), w).toContain(w.toLowerCase())
  })
  it('the controls carry the names the spec gives them', () => {
    for (const w of ['Begin', 'Commit this round', 'Commit my diagnosis', 'Commit my prediction', 'Export my results', 'Load my results', 'Clear my saved results', 'Erase and start over', 'Keep my results', 'Skip Part 1', 'Cooperate', 'Defect', 'Save this match and go on'])
      expect(screen, w).toContain(w)
  })
  it('a selected tab changes color and nothing else', () => {
    const ui = file('ui.tsx')
    const bar = ui.slice(ui.indexOf('export function TabBar'), ui.indexOf('export const PANEL_STYLE'))
    expect(bar).not.toMatch(/fontWeight: tab/)
  })
})

describe('the shell', () => {
  it('the Lab pane message for the missing Lab 11 handout is honest and not an error', () => {
    const registry = readFileSync(join(__dirname, '..', 'registry.ts'), 'utf-8')
    const at = registry.indexOf("route: 'm11-social'")
    expect(at).toBeGreaterThan(0)
    const entry = registry.slice(at, at + 2000)
    expect(entry).toMatch(/social_cognition\/among_others_lab\/among_others_lab\.md/)
    expect(entry).toMatch(/notYet:/)
    expect(entry).toMatch(/has not been posted yet/)
  })
  it('Module 2’s code path is untouched: nothing here imports the evolution scene or the world engine', () => {
    for (const [path, src] of all) {
      const imports = src.match(/^import .*$/gm)?.join('\n') ?? ''
      expect(imports, path).not.toMatch(/sim\/world|sim\/creature|sim\/neural|m02_evolution/)
    }
  })
})
