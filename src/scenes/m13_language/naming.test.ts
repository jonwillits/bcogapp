import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as L from './lines'

/**
 * The string tests of the spec's §10, §11 and §14, over every string a
 * student could see: this scene and the language layer it draws its words
 * from.
 *
 * §11, item 2: before Part 1, Step 2's commit, no Part 1 string names
 * transition, formant track, rise, fall, context or coarticulation; before
 * Step 3's reveal, none names categorical, category, boundary, within,
 * across, predicted from the labels, Liberman or Haskins, and Step 4 says
 * nothing about sharp or gradual changes. §11, item 3: before Part 2, Step
 * 1's commit, no string a student can see in Part 2 names transitional,
 * probability, statistic, follow, predict (as the mechanism) or six. §11,
 * item 4: before Part 3, Step 2's end, no Part 3 string names guess,
 * hypothesis, check, verify, tally, count, association, propose, the
 * previous time, or the four authors. The files that may hold those words
 * are each experiment's reveal, Part 3's Step 3, and the data files
 * (rendered only on the reveal).
 */
const scene = import.meta.glob('./**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const sim = import.meta.glob('../../sim/language/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const production = (files: Record<string, string>) => Object.entries(files).filter(([p]) => !p.includes('.test.') && !p.includes('.probe.'))

/** Every string a file can put on the screen: its string literals, and in a .tsx file its JSX text. */
export function visibleText(src: string, jsx = true): string {
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
const hitsIn = (path: string, src: string, re: RegExp, allow: (l: string) => boolean = () => false) =>
  textOf(path, src)
    .split('\n')
    .filter((l) => re.test(l) && !allow(l))

// Part 1
const P1_STEP2_FORBIDDEN = /\btransitions?\b|formant track|\brises?\b|\bfalls?\b|\bcontexts?\b|coarticulat/i
const P1_STEP3_FORBIDDEN = /categor|\bboundar|\bwithin\b|\bacross\b|predicted from the labels|Liberman|Haskins/i
const P1_STEP4_BEFORE_STEP3 = /\bsharp|\bgradual|where (the )?labels change|abrupt/i
const P1_FILES = (p: string) => p.includes('/sounds/') || p.includes('PartSounds') || p.includes('/sim/language/sounds/')
const P1_STEP2_REVEAL = /\/sounds\/(Reveal|LabelsReveal)\.tsx$|\/sim\/language\/sounds\/syllables\.ts$|\/sim\/language\/references\.ts$/
const P1_STEP3_REVEAL = /\/sounds\/(Reveal|Step3Reveal)\.tsx$|\/sounds\/afterStep3\.ts$|\/sim\/language\/sounds\/abx\.ts$|\/sim\/language\/references\.ts$/
// Part 2
const P2_STEP1_FORBIDDEN = /transitional|probabilit|statistic|\bfollow|\bpredict(s|ed|ing|able|or)?\b|\bsix\b/i
const P2_PRE_COMMIT_FILES = /\/stream\/(screens|store)\.ts$|PartStream\.tsx$|\/ui\.tsx$/
// Part 3
const P3_FORBIDDEN = /\bguess|hypothes|\bcheck|\bverif|\btall(y|ies|ied)\b|\bcount|associat|\bpropos|the previous time|Trueswell|Medina|\bYu\b|\bSmith\b/i
const P3_GLOBAL_FORBIDDEN = /hypothes|\btall(y|ies|ied)\b|\bpropose|the previous time|Trueswell|Medina|\bYu\b|\bSmith\b/i
const P3_FILES = (p: string) => p.includes('/words/') || p.includes('PartWords') || p.includes('/sim/language/words/')
// The words layer's own identifiers name the models (guessCheck, tally); what reaches the screen before the reveal is tested on rendered markup in reveal.test.tsx.
const P3_AFTER = /\/words\/(Reveal|Models|Step3)\.tsx$|\/words\/step3Screen\.ts$|\/sim\/language\/words\/|\/sim\/language\/references\.ts$/

describe('nothing before Part 1’s reveals names what they test (§11, item 2)', () => {
  it('no Part 1 file outside Step 2’s reveal holds a Step 2 word in a visible string', () => {
    for (const [path, src] of all) {
      if (!P1_FILES(path) || P1_STEP2_REVEAL.test(path)) continue
      const hits = hitsIn(path, src, P1_STEP2_FORBIDDEN)
      expect(hits, `${path}: ${hits.join(' | ')}`).toEqual([])
    }
  })
  it('no Part 1 file outside Step 3’s reveal holds a Step 3 word, and Step 4 says nothing about sharp or gradual changes', () => {
    for (const [path, src] of all) {
      if (!P1_FILES(path) || P1_STEP3_REVEAL.test(path)) continue
      const hits = hitsIn(path, src, P1_STEP3_FORBIDDEN)
      expect(hits, `${path}: ${hits.join(' | ')}`).toEqual([])
      const hits4 = hitsIn(path, src, P1_STEP4_BEFORE_STEP3)
      expect(hits4, `${path}: ${hits4.join(' | ')}`).toEqual([])
    }
  })
  it('nowhere in the lab, outside Step 3’s reveal and the references, is categorical perception, a phoneme boundary, the predicted line, Liberman or Haskins named', () => {
    for (const [path, src] of all) {
      if (P1_STEP3_REVEAL.test(path)) continue
      const hits = hitsIn(path, src, /categorical|\bcategor(y|ies)\b|phoneme boundar|predicted from the labels|Liberman|Haskins/i)
      expect(hits, `${path}: ${hits.join(' | ')}`).toEqual([])
    }
  })
})

describe('nothing before Part 2, Step 1’s commit names how many words there are or how they are found (§11, item 3)', () => {
  it('the files a student sees before the commit hold none of Step 1’s words', () => {
    for (const [path, src] of all) {
      if (!P2_PRE_COMMIT_FILES.test(path)) continue
      const hits = hitsIn(path, src, P2_STEP1_FORBIDDEN, (l) => /^p2-/.test(l))
      expect(hits, `${path}: ${hits.join(' | ')}`).toEqual([])
    }
    for (const name of ['MADE_UP_LANGUAGE_LINE', 'COUNTS_FROM_YOUR_STREAM_LINE', 'HEADPHONES_LINE', 'MADE_OFFLINE_LINE'] as const) expect(L[name], name).not.toMatch(P2_STEP1_FORBIDDEN)
  })
  it('the notice for Steps 2 to 4 says what opening first changes, and names Step 1', () => {
    const screens = file('stream/screens.ts')
    expect(screens).toMatch(/NOTICE_LINE = '.*Step 1.*'/)
    expect(visibleText(file('steps.tsx'))).toMatch(/Open anyway/)
  })
})

describe('nothing before Part 3, Step 2’s end names what Part 3 tests (§11, item 4)', () => {
  it('no Part 3 file outside Step 3 and the reveal holds a held-back word in a visible string', () => {
    for (const [path, src] of all) {
      if (!P3_FILES(path) || P3_AFTER.test(path)) continue
      // The two model identifiers, as bare literals, are the store's keys, never printed.
      const hits = hitsIn(path, src, P3_FORBIDDEN, (l) => /^p3-/.test(l) || /^Step 3 — /.test(l) || /^(tally|guessCheck)$/.test(l))
      expect(hits, `${path}: ${hits.join(' | ')}`).toEqual([])
    }
  })
  it('nowhere in the lab, outside Part 3’s Step 3, its reveal and the references, is tallying, a hypothesis, propose, the previous time, or one of the four authors named', () => {
    for (const [path, src] of all) {
      if (P3_AFTER.test(path)) continue
      const hits = hitsIn(path, src, P3_GLOBAL_FORBIDDEN, (l) => /^p3-/.test(l) || /^Step 3 — /.test(l) || /^(tally|guessCheck)$/.test(l))
      expect(hits, `${path}: ${hits.join(' | ')}`).toEqual([])
    }
  })
  it('Part 3’s instruction screens do not say how many words there are or how many times a word occurs', () => {
    const screens = visibleText(file('words/screens.ts'), false)
    const pre = screens.slice(0, screens.indexOf('Step 3 — '))
    expect(pre).not.toMatch(/\b12 (words|new words|trials)\b|\bfive times\b|\b5 times\b|each word occurs/i)
  })
})

describe('words that must not be on screen (§11, items 6, 7 and 14)', () => {
  it('no agentic verb about a program, procedure, model, learner, network, classifier, transformer, or the app', () => {
    const subjects = '(programs?|procedures?|models?|learners?|networks?|classifiers?|transformers?|predictors?|rules?|generators?|parsers?|it)'
    const verbs = '(knows?|knew|thinks?|thought|believes?|notices?|noticed|decides?|decided|wants?|wanted|expects?|expected|imagines?|remembers?|remembered|figures? out|realiz\\w+|understands?|hears?|heard|listens?|tries|tried|guess(es|ed)?|sees?|saw)'
    for (const [path, src] of all) {
      const t = textOf(path, src)
      const hits = t.split('\n').filter((l) => new RegExp(`\\b(the|a|each|every|this|that|its|no|which) ${subjects} ${verbs}\\b`, 'i').test(l) && !/the student|you (know|think|want|expect|hear)|a person|people|children|infants|adults|listeners|the listener/i.test(l))
      expect(hits, `${path}: ${hits.join(' | ')}`).toEqual([])
    }
  })
  it('a network does not predict as a mental act: predict, for a network, appears only in the chapter’s phrase trained to predict the next token or word', () => {
    for (const [path, src] of all) {
      const t = textOf(path, src)
      const hits = t.split('\n').filter((l) => /\b(network|learner|model|classifier|transformer|it) predicts?\b/i.test(l) && !/trained to predict the next/i.test(l))
      expect(hits, `${path}: ${hits.join(' | ')}`).toEqual([])
    }
  })
  it('no literal-use violation Jon has caught: no inanimate thing that tells, asks, suggests, offers, gathers or invites; a program runs, it does not walk or try (LAB_COMMON_FEATURES §8)', () => {
    const banned: [RegExp, string][] = [
      [/\byou (drive|steer|pilot|ride)\b/i, 'the student controls or moves; drive is for vehicles'],
      [/\b(procedure|program|learner|model|network|rule)s? (walks?|wanders?|explores?|hunts?|tries|looks? for|listens? for)\b/i, 'a program runs, computes, stores; it does not walk or try'],
      [/\bthe (table|panel|screen|line|row|strip|app|tab|column|button|card|map|view|handout|lab|step|part|board|tray|plot|slider|menu|tour|block|formula|picture|spectrogram|names?) (tells?|asks?|suggests?|offers?|gathers?|invites?|lets?|wants?|knows?|thinks?|decides?|remembers?|notices?|sees?|gives?|points? out|assumes?|measures?)\b/i, 'an inanimate thing shows, says, prints, records, lists, states'],
      // Jon, Lab 13 walk, 2026-11-16: a tour that points out, names that go to a screen, a view that measures, a block that asks, a formula that assumes.
      [/\b(tour|names?|buttons?|row of names|screen’s names) (go(es)? to|take you to|points? out)\b/i, 'the student presses a name to go to a screen; a tour has screens'],
      [/\b(view|picture|spectrogram|plot) measures\b/i, 'a view shows; a program measures'],
      [/\b(block|run|trial) (asks?|wants?)\b/i, 'in a block the student gives an answer'],
      [/\bit assumes that\b/i, 'a formula rests on an assumption; people assume'],
      // Jon, Lab 13 walk, 2026-11-17 (Part 2's screens): a panel that runs a learner, a learner that needs listening, a menu that chooses.
      [/\b(panel|screen|table|plot|strip) (runs|computes|trains)\b/i, 'a program runs; a panel shows what was run'],
      [/\b(learners?|networks?|models?|programs?|classifiers?) (needs?|will need|needed)\b/i, 'a program takes in or is given; it does not need'],
      [/\bmenu( on the \w+)? chooses\b/i, 'the student chooses from a menu'],
      [/\bdarkness shows energy\b/i, 'the lab draws bright on dark: brightness shows energy'],
      [/\bwe record\b/i, 'say what the student will see, not what the build does'],
      [/\bthe (run|table|panel|strip|step|board) records\b/i, 'say what the student will see'],
      [/\b(this|the) step (runs|reproduces|simulates|states)\b/i, 'the student runs; a step opens'],
      [/\b(setting|slider|menu|control|“[^”]+”) chooses\b/i, 'the student chooses with a control'],
      [/\b(learners?|networks?|models?|programs?|procedures?|classifiers?) (has|have) (seen|heard)\b/i, 'a program records or stores what it is given; it does not see or hear'],
      [/\b(study|experiment|model|simulation) (compares|has to estimate|cannot read|assumes)\b/i, 'people compare and estimate'],
      [/\b(panel|table|screen|card) gives\b/i, 'a panel shows'],
      [/\bthe (learner|network|model|classifier) (is told|was told|is given a hint)\b/i, 'a program is given input'],
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
      expect(t, path).not.toMatch(/\b(keeps?|kept|holds?|held) (a |the |its |your |one )?(memory|memories|information|record of|a list|in mind|a model|track)\b/i)
      expect(t, path).not.toMatch(/\bcarr(y|ies|ied) (information|a memory|knowledge|a value|meaning)\b/i)
    }
  })
  it('no British spellings', () => {
    for (const [path, src] of all) expect(textOf(path, src), path).not.toMatch(/\bcolour|\bbehaviour|\bfavour|\bcentre\b|\banalyse|\bgrey\b|\bmetres?\b|\bneighbour|\brecognis|\borganis(e|ed|es|ing|ation)\b|\bmemoris|\blicence\b|\bjudgement\b|\bwhilst\b|\bamongst\b|\blabell(ed|ing)\b|\bmodell(ed|ing)\b|\bgeneralis|\bsynthesis(e|ed|er)\b/i)
  })
  it('no race, ethnicity, nationality or human group, and voices are named only as voice n', () => {
    for (const [path, src] of all) {
      if (path.endsWith('references.ts')) continue
      const t = textOf(path, src)
      expect(t, path).not.toMatch(/\b(Black people|white people|European|African|Asian|American|British|Hispanic|Latino|racial|ethnic|female voice|male voice|a woman|a man|woman’s|man’s)\b/)
    }
  })
  it('no pictographs: no emoji or check marks in a visible string', () => {
    for (const [path, src] of all) expect(textOf(path, src), path).not.toMatch(/[☀-➿\u{1F300}-\u{1FAFF}]/u)
  })
})

describe('the lines that are content, each on its panel (§10)', () => {
  it('every line exists and is used where the spec puts it', () => {
    const uses: [string, RegExp, string][] = [
      ['SECOND_RUN_LINE', /A second run is not a first run/, 'Part0.tsx'],
      ['ANY_ORDER_LINE', /in any order/, 'Part0.tsx'],
      ['COMMIT_RULE_LINE', /Nothing an experiment would tell you is shown until you commit/, 'Part0.tsx'],
      ['HEADPHONES_LINE', /headphones or earbuds/, 'Part0.tsx'],
      ['HEADPHONES_LINE', /headphones or earbuds/, 'sounds/screens.ts'],
      ['HEADPHONES_LINE', /headphones or earbuds/, 'stream/screens.ts'],
      ['HEADPHONES_LINE', /headphones or earbuds/, 'words/screens.ts'],
      ['MADE_OFFLINE_LINE', /made by a computer before the lab was posted/, 'sounds/screens.ts'],
      ['MADE_OFFLINE_LINE', /made by a computer before the lab was posted/, 'stream/screens.ts'],
      ['MADE_OFFLINE_LINE', /made by a computer before the lab was posted/, 'words/screens.ts'],
      ['SETTINGS_NOT_MEASUREMENTS_LINE', /a setting of the synthesizer/, 'sounds/screens.ts'],
      ['MADE_UP_LANGUAGE_LINE', /The language in this part is made up/, 'stream/screens.ts'],
      ['COUNTS_FROM_YOUR_STREAM_LINE', /first 300 syllables of your stream/, 'stream/screens.ts'],
      ['REAL_SPEECH_LINE', /spoken to young children and transcribed by researchers/, 'stream/screens.ts'],
      ['NO_FEEDBACK_LINE', /No one will say whether a choice was right/, 'words/screens.ts'],
      ['FITTED_TO_YOUR_ACCURACY_LINE', /chosen to match your overall accuracy/, 'words/step3Screen.ts'],
      ['SMALL_NUMBERS_LINE', /48 pairs of choices/, 'words/step3Screen.ts'],
      ['ONE_CORPUS_LINE', /same made-up corpus/, 'predictors/screens.ts'],
      ['TRAINED_BEFORE_LINE', /trained before the lab was posted/, 'predictors/screens.ts'],
    ]
    for (const [name, re, where] of uses) {
      expect(lines, name).toMatch(re)
      const src = production(scene).find(([p]) => p.endsWith(where))
      expect(src, `${where} for ${name}`).toBeDefined()
      expect(src![1], `${name} in ${where}`).toMatch(new RegExp(name))
    }
    // The lines placed by the parts' screens as they are built.
    for (const name of ['MEASURED_LINE', 'SYNTHETIC_TEST_LINE', 'ONE_LISTENER_LINE', 'LENGTHENED_DIFFERENTLY_LINE', 'ADULTS_21_MINUTES_LINE', 'INFANTS_MEASURED_DIFFERENTLY_LINE', 'REAL_WEIGHTS_LINE', 'NOT_ENGLISH_LINE', 'RESTARTED_LINE'] as const) expect(typeof L[name]).toBe('string')
    expect(L.SAVED_HERE_LINE).toMatch(/Results are saved in this browser on this computer only/)
    expect(L.STORAGE_UNAVAILABLE_LINE).toMatch(/results will be lost if this page is closed/)
    expect(file('LanguageScene.tsx')).toMatch(/<StorageLine available=\{progress\.storageAvailable\} \/>/)
  })
  it('every instruction screen in Parts 1 to 3 that plays sound carries the headphones line, and every screen names what to press next', () => {
    for (const part of ['sounds', 'stream', 'words']) {
      const src = file(`${part}/screens.ts`)
      const blocks = src.split(/\n  \d: \{\n/).slice(1)
      for (const b of blocks) {
        expect(b, `${part}: next`).toMatch(/next: NEXT_LINE\[\d\]/)
        if (/READY_SOUND_LINE/.test(b)) expect(b, `${part}: headphones`).toMatch(/HEADPHONES_LINE/)
      }
    }
  })
})

describe('the shell', () => {
  it('the tab and part titles are neutral', () => {
    const ui = visibleText(file('ui.tsx'))
    expect(ui).not.toMatch(P1_STEP3_FORBIDDEN)
    expect(ui).not.toMatch(P2_STEP1_FORBIDDEN)
    expect(ui).not.toMatch(P3_GLOBAL_FORBIDDEN)
    for (const t of ['Open', 'Sounds', 'Stream', 'Words', 'Predictors']) expect(ui).toContain(t)
  })
  it('the title string is in one place', () => {
    const sceneSrc = file('LanguageScene.tsx')
    expect(sceneSrc).toMatch(/export const LAB_TITLE_WORDS = 'Sounds, Words, and Predictions'/)
    for (const [path, src] of production(scene)) if (!path.endsWith('LanguageScene.tsx')) expect(src, path).not.toMatch(/Lab 13: Sounds/)
  })
  it('the Lab pane message for the missing Lab 13 handout is honest and not an error', () => {
    const registry = readFileSync(join(__dirname, '..', 'registry.ts'), 'utf-8')
    const at = registry.indexOf("route: 'm13-language'")
    expect(at).toBeGreaterThan(0)
    const entry = registry.slice(at, at + 2000)
    expect(entry).toMatch(/language\/sounds_words_lab\/sounds_words_lab\.md/)
    expect(entry).toMatch(/notYet:/)
    expect(entry).toMatch(/has not been posted yet/)
  })
  it('Module 2’s code path is untouched: nothing here imports the evolution scene or the world engine, and nothing imports a 3D library', () => {
    for (const [path, src] of all) {
      const imports = src.match(/^import .*$/gm)?.join('\n') ?? ''
      expect(imports, path).not.toMatch(/sim\/world|sim\/creature|sim\/neural|m02_evolution|@react-three|from 'three'/)
    }
  })
  it('the controls carry the names the spec gives them', () => {
    for (const w of ['Begin', 'Begin Part 1', 'Play a test sound', 'Export my results', 'Load my results', 'Clear my saved results', 'Erase and start over', 'Keep my results', 'Open anyway', 'Show the instructions again', 'Commit my prediction', 'Commit my labels', 'Go to Step 2', 'Start block 1', 'Start block 2', '3rd sounds like the 1st', '3rd sounds like the 2nd', 'Train', 'Run on the 9 sounds', 'Play the minute', 'Commit my answer', 'Check this word', 'Empty the tray', 'Clear the highlight', 'Show me the words', 'Run the learners', 'Show stress', 'Hear it again', 'Run the models', 'Back to the fitted value', 'Show me sentences', 'Count', 'Compute', 'Remove the last token', 'Clear the prompt', 'Temperature', 'Generate a sentence', 'Snapshot', 'Change the prompt'])
      expect(screen, w).toContain(w)
  })
})
