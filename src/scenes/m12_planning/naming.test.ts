import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as L from './lines'

/**
 * The string tests of the spec's §10, §11 and §14, over every string a
 * student could see: this scene and the planning layer it draws its words
 * from.
 *
 * §11, item 2: before Step 1's reveal, no string in Part 1 contains
 * reflect, frame, framing, loss aversion, risk averse, risk seeking,
 * prospect, value function, anchor, bias, heuristic, Kahneman or Tversky;
 * before Step 2's reveal: discount, hyperbolic, exponential, impulsive,
 * reversal, self-control; before Step 3's reveal: reliable, unreliable,
 * promise, trust, marshmallow, Kidd, persistence, or when a dispenser
 * delivers. §11, item 3: before Part 2, Step 3's reveal: prune, pruning,
 * bonsai, large loss, Pavlovian, resource-rational, Huys, Callaway. The
 * files that may hold those words are the reveal file, the data files
 * (rendered only on the reveal), and the lines file (each line tested for
 * where it is used).
 */
const scene = import.meta.glob('./**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const sim = import.meta.glob('../../sim/planning/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const production = (files: Record<string, string>) => Object.entries(files).filter(([p]) => !p.includes('.test.') && !p.includes('.probe.'))

/** Every string a file can put on the screen: its string literals, and in a .tsx file its JSX text. */
function visibleText(src: string, jsx = true): string {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const literals = [...code.matchAll(/(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g)].map((m) => m[2])
  const jsxText = jsx ? [...code.matchAll(/(?:>|\})([^<>{}]+)(?=<|\{)/g)].map((m) => m[1]) : []
  return [...literals, ...jsxText].join('\n')
}

const all: [string, string][] = [...production(scene), ...production(sim)]
const textOf = (path: string, src: string) => visibleText(src, path.endsWith('.tsx'))
const screen = all.map(([p, src]) => textOf(p, src)).join('\n')
const file = (name: string) => production(scene).find(([p]) => p.endsWith(name))![1]
const lines = visibleText(file('lines.ts'), false)

const STEP1_FORBIDDEN = /\breflect|\bframe\b|\bframing|loss aversion|risk[- ]averse|risk[- ]seeking|prospect|value function|\banchor|\bbias|heuristic|Kahneman|Tversky/i
const STEP2_FORBIDDEN = /discount|hyperbolic|exponential|impulsiv|reversal|self-control/i
const STEP3_FORBIDDEN = /\breliab|\bunreliab|promise|\btrust|marshmallow|\bKidd\b|persisten|delivers 5 points 8 seconds|on half of its trials/i
const PART2_FORBIDDEN = /\bprun|bonsai|large loss|Pavlovian|resource-rational|\bHuys|Callaway/i

const PART1_FILES = (p: string) => p.includes('/choices/') || p.includes('PartChoices') || p.includes('/sim/planning/choices/') || p.endsWith('classes.ts') || p.endsWith('references.ts')
const PART1_REVEAL = /\/choices\/Reveal\.tsx$|classes\.ts$|references\.ts$|lines\.ts$/
const PART2_FILES = (p: string) => p.includes('/puzzles/') || p.includes('PartPuzzles') || p.includes('/sim/planning/puzzles/')
const PART2_REVEAL = /\/puzzles\/Reveal\.tsx$|\/sim\/planning\/puzzles\/lookers\.ts$|\/sim\/planning\/puzzles\/trees\.ts$/

describe('nothing before Part 1’s reveals names what they test (§11, item 2)', () => {
  it('no Part 1 file outside the reveal and the data files holds a Step 1 word in a visible string', () => {
    for (const [path, src] of all) {
      if (!PART1_FILES(path) || PART1_REVEAL.test(path)) continue
      // gambles.ts names its sources beside each pair's published share; those citations render on the reveal only.
      const hits = textOf(path, src)
        .split('\n')
        .filter((l) => STEP1_FORBIDDEN.test(l) && !/^p1-/.test(l) && !(path.endsWith('/choices/gambles.ts') && /^(Kahneman and Tversky \(1979\)|Tversky and Kahneman \(1981\))$/.test(l)))
      expect(hits, `${path}: ${hits.join(' | ')}`).toEqual([])
    }
  })
  it('no Part 1 file outside the reveal holds a Step 2 or Step 3 word', () => {
    for (const [path, src] of all) {
      if (!PART1_FILES(path) || PART1_REVEAL.test(path)) continue
      // The dispensers' rules and best policies live in dispensers.ts and are rendered on the reveal only; the screen a student sees during a block is Dispenser.tsx, which is checked.
      if (path.endsWith('/choices/dispensers.ts')) continue
      const hits = textOf(path, src).split('\n').filter((l) => STEP2_FORBIDDEN.test(l) || STEP3_FORBIDDEN.test(l))
      expect(hits, `${path}: ${hits.join(' | ')}`).toEqual([])
    }
  })
  it('the gambles reveal names no Step 2 or Step 3 word, and the delays and dispensers reveals name no Step 1 word', () => {
    const reveal = file('choices/Reveal.tsx')
    const gambles = reveal.slice(reveal.indexOf('export function GamblesReveal'), reveal.indexOf('export function DelaysReveal'))
    const delays = reveal.slice(reveal.indexOf('export function DelaysReveal'), reveal.indexOf('export function DispensersReveal'))
    const dispensers = reveal.slice(reveal.indexOf('export function DispensersReveal'), reveal.indexOf('export function ChoicesResults'))
    const g = visibleText(gambles).split('\n').filter((l) => STEP2_FORBIDDEN.test(l) || STEP3_FORBIDDEN.test(l))
    expect(g, g.join(' | ')).toEqual([])
    const d = visibleText(delays).split('\n').filter((l) => STEP1_FORBIDDEN.test(l) || STEP3_FORBIDDEN.test(l))
    expect(d, d.join(' | ')).toEqual([])
    const p = visibleText(dispensers).split('\n').filter((l) => STEP1_FORBIDDEN.test(l) || STEP2_FORBIDDEN.test(l))
    expect(p, p.join(' | ')).toEqual([])
  })
  it('the tab and part titles are neutral', () => {
    const ui = visibleText(file('ui.tsx'))
    expect(ui).not.toMatch(STEP1_FORBIDDEN)
    expect(ui).not.toMatch(PART2_FORBIDDEN)
    expect(ui).toMatch(/Choices/)
    expect(ui).toMatch(/Puzzles/)
  })
})

describe('nothing before Part 2, Step 3’s reveal names what it tests (§11, item 3)', () => {
  it('no Part 2 file outside the reveal and the lookers holds a forbidden word in a visible string', () => {
    for (const [path, src] of all) {
      if (!PART2_FILES(path) || PART2_REVEAL.test(path)) continue
      const hits = textOf(path, src).split('\n').filter((l) => PART2_FORBIDDEN.test(l))
      expect(hits, `${path}: ${hits.join(' | ')}`).toEqual([])
    }
  })
  it('no procedure’s name is given before Part 3’s commit except in the descriptions file, where the names are keyed for the reveal', () => {
    const band = file('band/screens.ts')
    const pre = visibleText(band.slice(0, band.indexOf('export const PROCEDURE_SECTION')), false)
    // The step texts never say which letter is which; the names appear only through HOMININ_LABEL after the commit.
    expect(pre).not.toMatch(/hominin [A-E] is|[A-E] is the (Adapted|Planner|Copier)/)
  })
})

describe('words that must not be on screen (§11, items 6 and 7)', () => {
  it('no agentic verb about a program, procedure, model, looker, forager, rule, or the programmed hominins', () => {
    const subjects = '(programs?|procedures?|models?|lookers?|foragers?|rules?|hominins?|planners?|copier|critic|actor|it|network|learner|elder)'
    const verbs = '(knows?|knew|thinks?|thought|believes?|notices?|noticed|decides?|decided|wants?|wanted|expects?|expected|imagines?|remembers?|remembered|figures? out|realiz\\w+|understands?|plans)'
    for (const [path, src] of all) {
      const t = textOf(path, src)
      const hits = t.split('\n').filter((l) => new RegExp(`\\b(the|a|each|every|this|that|its|no) ${subjects} ${verbs}\\b`, 'i').test(l) && !/the student|you (know|think|want|expect)|a person|people|children|the chooser|a chooser/i.test(l))
      expect(hits, `${path}: ${hits.join(' | ')}`).toEqual([])
    }
  })
  it('no literal-use violation Jon has caught: no figurative verb for what the student does to the hominin or what a program does, and no inanimate thing that tells, asks, suggests, offers, gathers or invites (LAB_COMMON_FEATURES §8; Jon, 2026-11-11)', () => {
    const banned: [RegExp, string][] = [
      [/\byou (drive|steer|pilot|ride) (a|the|your) hominin/i, 'the student controls or moves the hominin; drive is for vehicles'],
      [/\b(procedure|program|planner|looker|rule)s? (walks?|wanders?|explores?|hunts?|tries|looks? for)\b/i, 'a program runs, searches, examines, stores; it does not walk or try'],
      [/\bthe (table|panel|screen|line|row|strip|app|tab|column|button|card|map|view|handout|lab|step|part) (tells?|asks?|suggests?|offers?|gathers?|invites?|lets?|wants?|knows?|thinks?|decides?|remembers?|notices?|sees?)\b/i, 'an inanimate thing shows, says, prints, records, lists, states'],
      [/\bwe record\b/i, 'say what the student will see, not what the build does'],
    ]
    for (const [path, src] of all) {
      const text = textOf(path, src)
      for (const [re, why] of banned) {
        const hits = text.split('\n').filter((l) => re.test(l))
        expect(hits, `${path}: ${why}: ${hits.join(' | ')}`).toEqual([])
      }
    }
  })
  it('keep and hold are not used for memory or information; carry is used only for objects', () => {
    for (const [path, src] of all) {
      const t = textOf(path, src)
      expect(t, path).not.toMatch(/\b(keeps?|kept|holds?|held) (a |the |its |your )?(memory|memories|information|record of|a list|in mind|a model)\b/i)
      expect(t, path).not.toMatch(/\bcarr(y|ies|ied) (information|a memory|knowledge|a value)\b/i)
    }
  })
  it('no British spellings', () => {
    for (const [path, src] of all) expect(textOf(path, src), path).not.toMatch(/\bcolour|\bbehaviour|\bfavour|\bcentre\b|\banalyse|\bgrey\b|\bmetres?\b|\bneighbour|\brecognis|\borganis(e|ed|es|ing|ation)\b|\bmemoris|\blicence\b|\bjudgement\b|\bwhilst\b|\bamongst\b/i)
  })
  it('the disease has no place name, and no race, ethnicity, nationality or human group appears outside the sources’ samples', () => {
    expect(screen).not.toMatch(/Asian disease/)
    for (const [path, src] of all) {
      if (path.endsWith('classes.ts') || path.endsWith('references.ts') || path.endsWith('gambles.ts')) continue
      expect(textOf(path, src), path).not.toMatch(/\b(Black people|white people|Black–white|European ancestry|African ancestry|racial|ethnic)\b/)
    }
  })
})

describe('the lines that are content, each on its panel (§10)', () => {
  it('every line exists and is used where the spec puts it', () => {
    const uses: [string, RegExp, string][] = [
      ['SECOND_RUN_LINE', /A second run is not a first run/, 'Part0.tsx'],
      ['ANY_ORDER_LINE', /in any order/, 'Part0.tsx'],
      ['HYPOTHETICAL_MONEY_LINE', /No money is paid in this lab/, 'choices/screens.ts'],
      ['NO_RIGHT_ANSWER_LINE', /There is no right answer yet/, 'choices/screens.ts'],
      ['ITEMS_DRAWN_SEPARATELY_LINE', /drawn independently/, 'choices/Reveal.tsx'],
      ['ONE_VERSION_EACH_LINE', /Each student saw one version/, 'choices/Reveal.tsx'],
      ['LABS_POINTS_LINE', /points in a lab/, 'choices/screens.ts'],
      ['LONG_PAUSE_LINE', /twice your median time between moves/, 'puzzles/Reveal.tsx'],
      ['NOT_OPTIMAL_LINE', /None of them is the best possible way to look/, 'puzzles/Reveal.tsx'],
      ['DIFFERENT_TASK_LINE', /were not charged for looking/, 'puzzles/Reveal.tsx'],
      ['PROGRAMMED_HOMININS_LINE', /programs with procedures/, 'PartBand.tsx'],
      ['FRESH_START_LINE', /goes on learning within a run/, 'PartBand.tsx'],
      ['THE_ELDER_LINE', /set by the scene/, 'PartBand.tsx'],
      ['BUILT_FOR_THE_EXPERIMENT_LINE', /built for this experiment/, 'PartBand.tsx'],
      ['DRAWN_SIMPLY_LINE', /not a reconstruction/, 'band/screens.ts'],
      ['EVERY_STEP_SEEN_LINE', /has seen every step of making and using them/, 'PartBand.tsx'],
      ['MODEL_OF_PLANTS_LINE', /plants in a model/, 'PartCorn.tsx'],
      ['MODELS_OWN_GENES_LINE', /A breeder or a twin study/, 'PartCorn.tsx'],
      ['MODELS_MECHANISM_LINE', /poor soil limits how tall any plant can grow/, 'PartCorn.tsx'],
      ['RESTARTED_LINE', /interrupted and run again/, 'choices/Reveal.tsx'],
      ['COMMIT_RULE_LINE', /Nothing an experiment would tell you is shown until you commit/, 'Part0.tsx'],
    ]
    for (const [name, re, where] of uses) {
      expect(lines, name).toMatch(re)
      const src = production(scene).find(([p]) => p.endsWith(where))
      expect(src, `${where} for ${name}`).toBeDefined()
      expect(src![1], `${name} in ${where}`).toMatch(new RegExp(name))
    }
    expect(L.SAVED_HERE_LINE).toMatch(/Results are saved in this browser on this computer only/)
    expect(L.STORAGE_UNAVAILABLE_LINE).toMatch(/results will be lost if this page is closed/)
    expect(L.PENDING_CLASS_LINE).toMatch(/Simulated class pending/)
    expect(L.PENDING_REFERENCE_LINE).toMatch(/Reference pending/)
    expect(file('PlanningScene.tsx')).toMatch(/<StorageLine available=\{progress\.storageAvailable\} \/>/)
  })
})

describe('the chapter’s words are where the instruments use them (§14)', () => {
  it('the vocabulary', () => {
    for (const w of ['expected value', 'risk', 'reflection effect', 'loss aversion', 'framing effect', 'heuristic', 'delay discounting', 'self-control', 'problem space', 'search', 'means', 'model-free', 'model-based', 'planning', 'value', 'hominin', 'goal', 'Morgan’s Canon', 'heritability', 'twin study', 'Flynn effect', 'certainty equivalent', 'loss ratio', 'indifference point', 'blue dispenser', 'orange dispenser', 'state graph', 'halfway node', 'Search everything', 'Goal recursion', 'Largest disk out of place', 'Move pattern', 'Memorized moves', 'futures panel', 'regular trees', 'Look at nothing', 'Look at everything', 'One more look when it is worth it', 'the range', 'the camp', 'the outcrop', 'the elder', 'What each need takes', 'Adapted', 'Learned value', 'Copier', 'Shallow planner', 'Planner', 'days before the lab', 'varied stock', 'uniform line'])
      expect(screen.toLowerCase(), w).toContain(w.toLowerCase())
    expect(screen).not.toMatch(/life history/)
  })
  it('the controls carry the names the spec gives them', () => {
    for (const w of ['Begin', 'Option A', 'Option B', 'Spin the wheel', 'Take 1 now', 'Start block 2', 'Scramble', 'Skip to the end', 'Take this path', 'Run 10 days', 'Watch day', 'Commit my diagnosis', 'Commit my prediction', 'Grow', 'Restore the nitrates', 'Restore the zinc', 'Identical twins treated more alike', 'What the Shallow planner counts at the end of its search', 'Export my results', 'Load my results', 'Clear my saved results', 'Erase and start over', 'Keep my results'])
      expect(screen, w).toContain(w)
  })
  it('a selected tab changes color and nothing else', () => {
    const ui = file('ui.tsx')
    const bar = ui.slice(ui.indexOf('export function TabBar'), ui.indexOf('export const PANEL_STYLE'))
    expect(bar).not.toMatch(/fontWeight: tab/)
  })
})

describe('the shell', () => {
  it('the Lab pane message for the missing Lab 12 handout is honest and not an error', () => {
    const registry = readFileSync(join(__dirname, '..', 'registry.ts'), 'utf-8')
    const at = registry.indexOf("route: 'm12-planning'")
    expect(at).toBeGreaterThan(0)
    const entry = registry.slice(at, at + 2000)
    expect(entry).toMatch(/planning_and_decisionmaking\/thinking_ahead_lab\/thinking_ahead_lab\.md/)
    expect(entry).toMatch(/notYet:/)
    expect(entry).toMatch(/has not been posted yet/)
  })
  it('Module 2’s code path is untouched: nothing here imports the evolution scene or the world engine', () => {
    for (const [path, src] of all) {
      const imports = src.match(/^import .*$/gm)?.join('\n') ?? ''
      expect(imports, path).not.toMatch(/sim\/world|sim\/creature|sim\/neural|m02_evolution/)
    }
  })
  it('the hominins have one neutral body color and no face, and nothing draws a person', () => {
    const view = file('band/RangeView3D.tsx')
    expect(view).toMatch(/const BODY = '#[0-9a-f]{6}'/)
    expect(visibleText(view)).not.toMatch(/mouth|nose|skin/i)
    for (const [path, src] of all) expect(src, path).not.toMatch(/\.(jpg|jpeg|png|webp)['"]/)
  })
})
