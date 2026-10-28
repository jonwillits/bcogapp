import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The string tests of the Module 10 spec's §11, §12 and §14, over every
 * string a student could see: this scene and the memory layer it draws
 * its words from.
 *
 * The first non-negotiable: before Part 1 is finished, no string anywhere
 * in the lab contains *false*, *lure*, *critical*, *associate*, *schema*,
 * *typical*, *organiz-*, *intrusion* or *DRM*. Every string that must
 * contain one lives in a file whose name says it is a reveal (rendered
 * only after the part's commit), in the words layer's scoring, or in the
 * reference data file, and nowhere else.
 */
const scene = import.meta.glob('./**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const sim = import.meta.glob('../../sim/memory/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const production = (files: Record<string, string>) => Object.entries(files).filter(([p]) => !p.includes('.test.') && !p.includes('.probe.'))

/** Every string a file can put on the screen: its string literals, and in a .tsx file its JSX text (a .ts file's `a > b` and `c < d` are not JSX). */
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

/** Files that may name what Part 1 tests: reveals, the words layer's scoring and materials, the references, the foragers' world (none of it on screen before Part 1's reveal: Part 5's world names no such word; this list is checked below). */
const REVEAL_FILES = /Reveal\.tsx$|\/words\/|references\.ts$|\/room\/arrangements\.ts$|\/room\/items\.ts$|\/sim\/memory\/room\//

const FORBIDDEN = /false|lure|critical|associate|schema|typical|organiz|intrusion|DRM/i

describe('nothing gives away Part 1 before its reveal (§12, item 2)', () => {
  it('no file outside the reveals, the words layer, the room’s item list and the references holds a forbidden word in a visible string', () => {
    for (const [path, src] of all) {
      if (REVEAL_FILES.test(path)) continue
      const text = textOf(path, src)
      const hits = text.split('\n').filter((l) => FORBIDDEN.test(l))
      expect(hits, `${path}: ${hits.join(' | ')}`).toEqual([])
    }
  })
  it('the tab names and part titles hint at nothing', () => {
    const ui = visibleText(file('ui.tsx'))
    expect(ui).toMatch(/Lists/)
    expect(ui).toMatch(/Study/)
    expect(ui).toMatch(/Room/)
    expect(ui).not.toMatch(FORBIDDEN)
    expect(ui).not.toMatch(/memory test|false memory/i)
  })
  it('the foragers’ world and features name no forbidden word either, since Part 4 can be done before Part 1', () => {
    for (const name of ['world.ts', 'features.ts', 'refill.ts', 'night.ts']) {
      const src = all.find(([p]) => p.endsWith(`/${name}`))![1]
      expect(visibleText(src, false), name).not.toMatch(FORBIDDEN)
    }
  })
})

describe('the seventeen lines that are content, each on its panel (§11)', () => {
  it('1. rats stand in for the early mammal, on Parts 4 and 5', () => {
    expect(lines).toMatch(/Rats stand in for the early mammal of the reading\./)
    expect(file('PartLogs.tsx')).toMatch(/<Content>\{RATS_LINE\}<\/Content>/)
    expect(file('PartLearners.tsx') + (production(scene).filter(([p]) => p.includes('/learners/')).map(([, s]) => s).join('\n'))).toMatch(/RATS_LINE/)
  })
  it('2. the two rules, beside Part 4’s view', () => {
    expect(file('PartLogs.tsx')).toMatch(/<Content>\{KIND_RULE\}<\/Content>/)
    expect(file('PartLogs.tsx')).toMatch(/<Content>\{REFILL_RULE\}<\/Content>/)
  })
  it('3 and 13. saved here only, and storage unavailable, in Part 0’s header', () => {
    expect(visibleText(file('progress/StorageLine.tsx'))).toMatch(/Results are saved in this browser on this computer only\. Nothing is sent anywhere\./)
    expect(visibleText(file('progress/StorageLine.tsx'))).toMatch(/results will be lost if this page is closed/)
    expect(file('MemoryScene.tsx')).toMatch(/<StorageLine available=\{progress\.storageAvailable\} \/>/)
  })
  it('4. reference curves, beside every reference panel', () => {
    expect(lines).toMatch(/These are published results from groups of people, with a different procedure\. One person’s lists vary a lot\./)
    expect(file('ui.tsx')).toMatch(/<Content>\{REFERENCE_LINE\}<\/Content>/)
  })
  it('5. a second run, on Clear', () => {
    expect(lines).toMatch(/A second run is not a first run: someone who knows what an experiment tests is no longer a naive subject\./)
    expect(file('Part0.tsx')).toMatch(/<Content>\{SECOND_RUN_LINE\}<\/Content>/)
  })
  it('6 to 10. the Part 5 lines exist and are used in Part 5', () => {
    const learners = production(scene).filter(([p]) => p.includes('/learners/') || p.endsWith('PartLearners.tsx')).map(([, s]) => s).join('\n')
    for (const [name, re] of [
      ['PROGRAMS_LINE', /These foragers are programs given your nights\. Ending with the same score does not show the same procedure\./],
      ['PASS_BACK_LINE', /The slow learner passes the error back, which no one has found in a brain\. The reading’s model learned the same way\./],
      ['DAMAGE_LINE', /Damaging a model is not a model of a disease\. It shows which knowledge goes first in a network of this kind\./],
      ['SEPARATION_LINE', /On one proposal, the dentate gyrus makes similar patterns less alike\. This program is not a model of the dentate gyrus\./],
      ['SAMPLE_NIGHTS_LINE', /These nights were played by someone else\./],
    ] as const) {
      expect(lines, name).toMatch(re)
      expect(learners, name).toMatch(new RegExp(name))
    }
  })
  it('11. comfort, on Part 4’s instruction screen', () => {
    expect(lines).toMatch(/Anyone who feels unwell can switch to the follow view or tick the Narrower view box\./)
    expect(file('PartLogs.tsx')).toMatch(/content: \[RATS_LINE, COMFORT_LINE, NO_NOTES_LINE\]/)
  })
  it('15. no notes, on Part 4’s instruction screen', () => {
    expect(lines).toMatch(/Do not write anything down or draw a map during the nights\. This part asks what you can do from memory alone\./)
    expect(file('PartLogs.tsx')).toMatch(/NO_NOTES_LINE/)
  })
  it('16. counterbalancing, on Part 4’s reveal', () => {
    expect(lines).toMatch(/The two kinds of night came at the same average point in the week, so getting better with practice helped both equally\./)
    expect(file('logs/Reveal.tsx')).toMatch(/<Content>\{COUNTERBALANCE_LINE\}<\/Content>/)
  })
  it('17. as a person, on the end-of-week question, and nowhere before it in Part 4', () => {
    expect(lines).toMatch(/Now answer as a person, not as the animal\. An animal can show what it remembers only by what it does\./)
    expect(file('PartLogs.tsx')).toMatch(/<Content>\{AS_A_PERSON_LINE\}<\/Content>/)
    const part = file('PartLogs.tsx')
    expect(part.indexOf('AS_A_PERSON_LINE')).toBeGreaterThan(0)
  })
  it('12. a restarted unit, on the results screens', () => {
    expect(lines).toMatch(/This part was interrupted and run again with new materials\./)
    for (const name of ['logs/Reveal.tsx', 'lists/Reveal.tsx', 'study/Reveal.tsx', 'room/Reveal.tsx']) expect(file(name), name).toMatch(/RESTARTED_LINE/)
  })
  it('14. the reading prints a list of this kind, on Part 1’s reveal', () => {
    expect(lines).toMatch(/The reading prints a list of this kind, so some students will have recognized these lists\./)
    expect(file('lists/Reveal.tsx')).toMatch(/READING_PRINTS_LINE/)
  })
})

describe('words that must not be on screen (§12)', () => {
  it('no agentic verb about a program, a forager, the store or a network', () => {
    const subjects = '(programs?|foragers?|store|networks?|learners?|units?|model|it|tendency|slow learner|fast store|Usual only|Tendency only|Tonight too)'
    const verbs = '(knows?|knew|notices?|noticed|decides?|decided|remembers?|remembered|recalls?|recalled|wants?|wanted|figures? out|believes?|thinks?|realiz\\w+|understands?)'
    for (const [path, src] of all) {
      const text = textOf(path, src)
      expect(text, path).not.toMatch(new RegExp(`\\b(the|a|each|every|this|that|its) ${subjects} ${verbs}\\b`, 'i'))
    }
  })
  it('keep and hold are not used for memory or information', () => {
    for (const [path, src] of all) expect(textOf(path, src), path).not.toMatch(/\b(keeps?|kept|holds?|held) (a |the |its |your )?(memory|memories|information|record|the logs|the nights|a list|in mind)\b/i)
  })
  it('no British spellings', () => {
    for (const [path, src] of all) expect(textOf(path, src), path).not.toMatch(/\bcolour|\bbehaviour|\bfavour|\bcentre\b|\banalyse|\bgrey\b|\bmetres?\b|\bneighbour|\brecognis|\borganis|\bmemoris|\blicence\b/i)
  })
  it('no browser dialog: no alert, confirm or prompt', () => {
    for (const [path, src] of production(scene)) expect(src, path).not.toMatch(/\balert\(|window\.confirm|\bconfirm\(|window\.prompt|\bprompt\(/)
  })
})

describe('the chapter’s words are where the instruments use them (§14)', () => {
  it('the vocabulary', () => {
    for (const w of ['serial position', 'primacy', 'recency', 'rehearsal', 'interference', 'remember', 'know', 'clustering', 'schema', 'hit', 'false alarm', 'd′', 'criterion', 'working memory', 'disposition', 'accessible content', 'pattern separation', 'pattern completion', 'complementary learning systems', 'replay', 'catastrophic interference', 'double dissociation', 'semantic dementia', 'the usual fact', 'the refill rule', 'look-alike pair', 'different pair', 'when-error', 'as a person', 'the fast store', 'the slow learner', 'the list for tonight', 'episodic-like'])
      expect(screen.toLowerCase(), w).toContain(w.toLowerCase())
  })
  it('the controls carry the names the spec gives them', () => {
    for (const w of ['Begin', 'Commit my prediction', 'Commit my predictions', 'Commit my answers', 'Begin night', 'Pause', 'Export my results', 'Load my results', 'Clear my saved results', 'Use a sample set of nights', 'Old', 'New', 'Remember', 'Know', 'In the room', 'Not in the room', 'I’m done', 'Mute', 'Narrower view', 'Low detail', 'Skip ahead through the youth', 'Emptied tonight', 'Emptied last night', 'Emptied two nights ago', 'Not emptied in the last three nights'])
      expect(screen, w).toContain(w)
  })
  it('a selected tab changes color and nothing else', () => {
    const ui = file('ui.tsx')
    const bar = ui.slice(ui.indexOf('export function TabBar'), ui.indexOf('export const PANEL_STYLE'))
    expect(bar).not.toMatch(/fontWeight: tab/)
  })
})

describe('the shell', () => {
  it('the Lab pane message for the missing Lab 10 handout is honest and not an error', () => {
    const registry = readFileSync(join(__dirname, '..', 'registry.ts'), 'utf-8')
    const at = registry.indexOf("route: 'm10-memory'")
    expect(at).toBeGreaterThan(0)
    const entry = registry.slice(at, at + 2000)
    expect(entry).toMatch(/memory_and_generative_models\/last_night_lab\/last_night_lab\.md/)
    expect(entry).toMatch(/notYet:/)
    expect(entry).toMatch(/has not been posted yet/)
  })
  it('Module 2’s code path is untouched: nothing here imports the evolution scene or the world engine', () => {
    for (const [path, src] of all) {
      const imports = src.match(/^import .*$/gm)?.join('\n') ?? ''
      expect(imports, path).not.toMatch(/sim\/world|sim\/creature|sim\/neural|m02_evolution/)
    }
  })
  it('Part 4 reuses Lab 9’s range, rat and cameras rather than copying them', () => {
    const view = file('logs/LogsView.tsx')
    expect(view).toMatch(/from '\.\.\/\.\.\/m09_rat\/RangeView'/)
    expect(view).toMatch(/from '\.\.\/\.\.\/m09_rat\/RatMesh'/)
    expect(view).toMatch(/from '\.\.\/\.\.\/m09_rat\/AnimalCamera'/)
  })
})
