import { describe, it, expect, beforeAll } from 'vitest'
import { sounds, SoundsStore } from './PartSounds'
import { stream, StreamStore } from './PartStream'
import { words, WordsStore } from './PartWords'
import { predictors, PredictorsStore } from './PartPredictors'
import { fresh, text, labelingFixture, abxFixture } from './reveal.test'
import { loadShippedTokens, loadContinuumPatches } from '../../sim/language/sounds/tokens.node'
import { WORDS, SYLLABLES } from '../../sim/language/stream/language'
import { trayCount } from '../../sim/language/stream/board'
import { makeDesign } from '../../sim/language/words/design'
import { runModel } from '../../sim/language/words/fit'
import { WordsReveal } from './words/Reveal'
import { renderToStaticMarkup } from 'react-dom/server'

/**
 * Commit, then reveal, on every tested surface, on rendered markup (spec
 * §11 item 1, §14), as Lab 6 tests it. Part 1: no syllable label, formant
 * track, or count before Step 2's commit; no curve, reference, or
 * predicted line before both blocks of Step 3; no result before each
 * prediction in Step 4. Part 2: no word, count of words, or lengthened
 * replay before Step 1's commit; no table of transitional probabilities
 * before the first word is found; no learner's result before Step 3's
 * predictions. Part 3: no word's object, score or model before Step 2 is
 * done; no model's row before Step 3's prediction. Part 4: no nearest
 * neighbor before Step 2's prediction; no distribution before Steps 3's
 * and 4's predictions. Also: no microphone is ever asked for.
 */
type Mod = { Left: unknown; Stage: unknown; Right: unknown }
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const until = async (f: () => boolean, ms = 20000) => {
  const t0 = Date.now()
  while (!f()) {
    if (Date.now() - t0 > ms) throw new Error('timed out')
    await wait(20)
  }
}

let mediaCalls = 0
beforeAll(() => {
  // A microphone or camera request would go through getUserMedia; it must never be called.
  Object.defineProperty(globalThis, 'navigator', { value: { mediaDevices: { getUserMedia: () => { mediaCalls++; return Promise.reject(new Error('never')) } } }, configurable: true })
})

describe('Part 1: commit, then reveal', () => {
  it('Step 2: no syllable name, track, or count before the commit; all of them after', () => {
    const c = fresh(sounds as Mod, (s, p) => new SoundsStore(s, p))
    c.store.open(2)
    c.store.begin()
    let m = c.all()
    expect(m).toMatch(/data-stage="sounds-2"/)
    expect(m).not.toMatch(/data-reveal/)
    expect(text(m)).not.toMatch(/\b(bee|bah|boo|dee|dah|doo)\b|Correct:|formant track|rises|falls/)
    c.store.commitLabels()
    expect(c.progress.isComplete('p1-labels')).toBe(false)
    for (const k of c.store.sixOrder) c.store.setLabel(k, 'b')
    c.store.commitLabels()
    expect(c.progress.isComplete('p1-labels')).toBe(true)
    m = c.all()
    expect(m).toMatch(/data-reveal="labels"/)
    expect(text(m)).toMatch(/Correct: 3 of 6/)
    expect(text(m)).toMatch(/\bbee\b/)
    // The named spectrograms are in the center, in a 3 × 2 grid, with the button that comes next (Jon, 2026-11-16).
    expect(m).toMatch(/data-stage="sounds-2-done"/)
    expect(m).toMatch(/data-six-grid/)
    expect(text(m)).toMatch(/Go on to Step 3/)
  })
  it('Step 3: no curve, reference, formula, or boundary before both blocks; the block screens name no sound; the reveal has all six sections', () => {
    const c = fresh(sounds as Mod, (s, p) => new SoundsStore(s, p))
    c.store.open(3)
    c.store.begin()
    let m = c.all()
    // Block 1 opens on its own screen, with Start block 1 (Jon, 2026-11-16); the block runs on the press.
    expect(m).toMatch(/data-stage="before-block-1"/)
    expect(text(m)).toMatch(/Start block 1/)
    expect(text(m)).not.toMatch(/categor|boundar|Liberman|predicted from|step \d+ of 9|sound \d+ of 9|\bG\b/i)
    c.store.startBlock1()
    m = c.all()
    expect(m).toMatch(/data-stage="block-labeling"/)
    expect(text(m)).toMatch(/Trial +1 of 54/)
    expect(text(m)).not.toMatch(/categor|boundar|Liberman|predicted from|step \d+ of 9|sound \d+ of 9/i)
    expect(m).not.toMatch(/data-reveal/)
    c.progress.complete('p1-labeling', labelingFixture)
    c.store.block = null
    c.store.open(3)
    m = c.all()
    expect(m).toMatch(/data-stage="between-blocks"/)
    expect(text(m)).toMatch(/Start block 2/)
    expect(text(m)).toMatch(/28 trials/)
    expect(m).not.toMatch(/data-reveal/)
    c.progress.complete('p1-abx', abxFixture)
    c.store.open(3)
    m = c.all()
    expect(m).toMatch(/data-reveal="step3"/)
    for (const n of [1, 2, 3, 4, 5, 6]) expect(m).toMatch(new RegExp(`data-section="${n}"`))
    expect(text(m)).toMatch(/50% \+ 25%/)
    expect(text(m)).toMatch(/55% of the time/)
    expect(text(m)).toMatch(/over the 7 pairs/)
    expect(text(m)).not.toMatch(/d to g/)
    expect(m).toMatch(/data-reference="liberman-pairs"/)
  })
  it('Step 4: nothing trains before its prediction; run 3 waits for run 1; the curve and the table appear after; run 3 names no sharp or gradual change before Step 3 is done', async () => {
    const c = fresh(sounds as Mod, (s, p) => new SoundsStore(s, p))
    c.store.open(4)
    c.store.begin()
    const shipped = loadShippedTokens()
    c.store.tokens = shipped.tokens
    c.store.tts = { tokens: { heldOutVoices: shipped.heldOutVoices, tokens: [] } } as never
    c.store.continuumPatches = loadContinuumPatches()
    c.store.train1()
    expect(c.store.run1.state).toBe('idle')
    expect(text(c.all())).not.toMatch(/sharp|gradual/i)
    c.store.draft('run1', '75% to 90%')
    c.store.commit('run1')
    c.store.run3Now()
    expect(c.store.run3.state).toBe('idle')
    c.store.train1()
    await until(() => c.store.run1.state === 'done')
    const m = c.all()
    expect(m).toMatch(/data-run="Run 1/)
    expect(text(m)).toMatch(/Training is done/)
    expect(m).toMatch(/data-lines="confusion-Run 1/)
    c.store.draft('run3', 'b, then d')
    c.store.commit('run3')
    c.store.run3Now()
    expect(c.store.run3.state).toBe('done')
    expect(c.all()).toMatch(/data-run="run3"/)
    expect(text(c.all())).toMatch(/appear beside the network’s once Step 3 is done/)
  })
})

describe('Part 2: commit, then reveal', () => {
  it('Step 1: no word, count of words, or replay before the commit; the answer cannot be committed before the minute has played; the reveal after', () => {
    const z = fresh(stream as Mod, (s, p) => new StreamStore(s, p))
    z.store.open(1)
    z.store.begin()
    let m = z.all()
    expect(m).toMatch(/data-stage="stream-1"/)
    expect(text(m)).not.toMatch(/babupu|six words|Play again/)
    expect(m).not.toMatch(/data-replays|data-reveal/)
    z.store.setGuess(4)
    z.store.commitAnswer()
    expect(z.progress.isComplete('p2-minute')).toBe(false)
    z.progress.complete('p2-minute', { guess: 4, typed: 'babupu', seconds: 70, restarts: 0 })
    z.store.open(1)
    m = z.all()
    expect(m).toMatch(/data-reveal="minute"/)
    expect(m).toMatch(/data-replays/)
    expect(text(m)).toMatch(/The language has 6 words/)
    expect(text(m)).toMatch(/lengthens all six/)
    expect(m).toMatch(/data-reference="saffran-lengthening"/)
  })
  it('Step 2: counts only before the first word is found, then the term and the proportions; a true word colors exactly its instances; a part-word changes nothing; the results after Show me the words', () => {
    const z = fresh(stream as Mod, (s, p) => new StreamStore(s, p))
    z.progress.complete('p2-minute', { guess: 6, typed: '', seconds: 70, restarts: 0 })
    z.store.open(2)
    z.store.begin()
    z.store.clickTile('bu')
    let m = z.all()
    expect(m).toMatch(/data-neighbors="bu"/)
    expect(text(m)).not.toMatch(/transitional|probability|proportion/i)
    for (const syl of ['pi', 'da', 'ta'] as const) z.store.addToTray(syl)
    z.store.checkTray()
    expect(z.store.lastCheck).toBe('not a word')
    expect(z.store.board.found.length).toBe(0)
    expect((z.all().match(/data-word="/g) ?? []).length).toBe(0)
    for (const syl of ['pi', 'da', 'bu'] as const) z.store.addToTray(syl)
    z.store.checkTray()
    expect(z.store.board.found.map((f) => f.word)).toEqual(['pidabu'])
    m = z.all()
    const filled = (m.match(/data-word="pidabu"/g) ?? []).length
    expect(filled).toBe(3 * trayCount(z.store.boardSyllables, ['pi', 'da', 'bu']))
    expect(m).toMatch(/data-tp-definition/)
    expect(text(m)).toMatch(/transitional probability/)
    expect(z.progress.partial('p2-board')).toBeTruthy()
    z.store.askShow(true)
    expect(z.all()).toMatch(/data-confirm-show/)
    z.store.showWords()
    expect(z.progress.isComplete('p2-board')).toBe(true)
    m = z.all()
    expect(m).toMatch(/data-reveal="board"/)
    expect(m).toMatch(/data-tp-table/)
    expect((m.match(/data-within="true"/g) ?? []).length).toBe(12)
    expect(text(m)).toMatch(/79% against 72%/)
    for (const w of WORDS) expect(text(m)).toContain(w)
    expect(SYLLABLES.length).toBe(12)
  })
  it('Step 3: no learner runs before the three predictions; after them a run fills the plot and the table with the adults’ lines', async () => {
    const z = fresh(stream as Mod, (s, p) => new StreamStore(s, p))
    z.store.acceptNotice()
    z.store.open(3)
    z.store.acceptNotice()
    z.store.begin()
    await z.store.runLearners()
    expect(z.store.results.size).toBe(0)
    expect(z.all()).not.toMatch(/data-reveal="learners"/)
    expect(text(z.all())).not.toMatch(/adults, nonwords, 76% at 21 min/)
    z.store.draft('partwords', 'harder')
    z.store.draft('reach76', '1 minute')
    z.store.draft('least', 'they will tie')
    z.store.commitPredictions()
    z.store.setAmount(0)
    await z.store.runLearners()
    const m = z.all()
    expect(m).toMatch(/data-reveal="learners"/)
    expect(m).toMatch(/data-plot="learners-plot"/)
    expect(text(m)).toMatch(/adults, nonwords, 76% at 21 min/)
    expect(text(m)).toMatch(/infants, 2 minutes/)
    expect(m).toMatch(/data-lines="learners-table"/)
    expect(z.store.results.get(0)!.scores.dips.nonword.length).toBe(20)
    // The third learner: a row for PARSER on each test, both test rules scored at the run, and the control switching PARSER's rows and nothing else.
    expect(text(m)).toMatch(/PARSER, nonwords/)
    expect(text(m)).toMatch(/PARSER, part-words/)
    expect(z.store.results.get(0)!.scores.parser.nonword.length).toBe(20)
    expect(z.store.results.get(0)!.parserPaper.partword.length).toBe(20)
    expect(m).toMatch(/data-parser-rule="spec"/)
    const row = (t: string, l: string) => t.match(new RegExp(`${l}, nonwords \\d+\\.\\d%`))![0]
    const dipsRow = row(text(m), 'Cut at the dips')
    const parserRow = row(text(m), 'PARSER')
    z.store.setParserRule('paper')
    const m2 = z.all()
    expect(m2).toMatch(/data-parser-rule="paper"/)
    expect(row(text(m2), 'Cut at the dips')).toBe(dipsRow)
    expect(row(text(m2), 'PARSER')).not.toBe(parserRow)
    const r = z.store.results.get(0)!
    expect(z.store.scoresOf(r, 'parser', 'nonword')).toBe(r.parserPaper.nonword)
    z.store.setParserRule('spec')
    expect(z.store.scoresOf(r, 'parser', 'nonword')).toBe(r.scores.parser.nonword)
  })
})

describe('Part 3: commit, then reveal', () => {
  it('no word’s spelling, score, or model before the test is done; the reveal has the curve, the score, and the table', () => {
    const w = fresh(words as Mod, (s, p) => new WordsStore(s, p))
    // The files are not fetched in Node: the store is given the set's words and objects directly.
    w.store.loadedOk = true
    w.store.words = ['dax', 'blicket', 'toma', 'fep', 'gorp', 'kibby', 'mipen', 'nellum', 'pimwit', 'sprock', 'wug', 'zorch'].map((word) => ({ word, set: 0, file: `${word}.wav`, durationS: 0.5 }))
    w.store.objects = Array.from({ length: 12 }, (_, i) => ({ id: `object${String(i + 1).padStart(2, '0')}`, set: 0, fill: '#fff', pattern: 'dots' }))
    w.store.open(1)
    w.store.begin()
    let m = w.all()
    expect(m).toMatch(/data-stage="words-learning"/)
    expect((m.match(/data-object=/g) ?? []).length).toBe(5)
    w.store.choose(w.store.currentTrial!.objects[0])
    expect(w.store.choices.length).toBe(1)
    expect(text(m)).not.toMatch(/\b(dax|blicket|toma|fep|gorp|kibby|mipen|nellum|pimwit|sprock|wug|zorch)\b|Test score|guess|tally/i)
    expect(m).not.toMatch(/data-reveal/)
    const d = makeDesign(7, 0)
    const choices = runModel('tally', 3, d, 5)
    const testChoices = d.test.map((t) => t.objects[0])
    w.progress.complete('p3-words', { materials: 0, choices, testChoices, secondsPerTrial: [], restarts: 0 })
    const wordsA = ['dax', 'blicket', 'toma', 'fep', 'gorp', 'kibby', 'mipen', 'nellum', 'pimwit', 'sprock', 'wug', 'zorch'].map((word) => ({ word, set: 0, file: `${word}.wav`, durationS: 0.5 }))
    const objects = Array.from({ length: 12 }, (_, i) => ({ id: `object${String(i + 1).padStart(2, '0')}`, set: 0, fill: '#fff', pattern: 'dots' }))
    m = renderToStaticMarkup(<WordsReveal seed={7} result={w.progress.result('p3-words') as never} words={wordsA} objects={objects} />)
    expect(m).toMatch(/data-reveal="words"/)
    expect(m).toMatch(/data-plot="by-occurrence"/)
    expect(text(m)).toMatch(/Test score: \d+ of 12/)
    expect((m.match(/data-word-row=/g) ?? []).length).toBe(12)
    expect(w.store.stateOf(1)).toBe('done')
    expect(text(w.all())).toMatch(/press “Go on to Step 2”/)
    w.store.open(2)
    expect(text(w.all())).toMatch(/press “Go on to Step 3”/)
  })
  it('Step 3: the key measure and the rows wait for the prediction; the models run after it; the sample-sequence notice when Steps 1 and 2 are not done', async () => {
    const w = fresh(words as Mod, (s, p) => new WordsStore(s, p))
    w.store.open(3)
    w.store.acceptNotice()
    w.store.begin()
    let m = w.all()
    expect(m).toMatch(/data-missing="steps12"/)
    expect(m).not.toMatch(/data-reveal="models"/)
    w.store.runModels()
    expect(w.store.fitted).toBeNull()
    w.store.setDraft('more often than chance')
    w.store.commit()
    m = w.all()
    expect(m).toMatch(/data-reveal="models"/)
    // The button is in the center, in the section of the three rows (the left column is navigation only).
    expect(m).toMatch(/data-step3-controls/)
    expect(text(m)).toMatch(/Run the models/)
    w.store.runModels()
    await until(() => w.store.gcRuns !== null && w.store.tallyRuns !== null && !w.store.computing)
    m = w.all()
    expect(m).toMatch(/data-lines="three-rows"/)
    expect(text(m)).toMatch(/48 pairs of choices/)
    expect(m).toMatch(/data-reference="trueswell-2013"/)
    w.store.setBeta(6)
    expect(w.store.tallyRuns!.param).toBe(6)
    w.store.backToFitted('tally')
    expect(w.store.tallyRuns!.param).toBe(w.store.fitted!.beta)
  })
})

describe('Part 4: commit, then reveal', () => {
  it('Step 2: no count or neighbor before the prediction; after it the table fills and cat’s neighbors appear', async () => {
    const k = fresh(predictors as Mod, (s, p) => new PredictorsStore(s, p))
    k.store.open(2)
    k.store.begin()
    await k.store.count()
    expect(k.store.model).toBeNull()
    expect(k.all()).not.toMatch(/data-reveal="counts"/)
    k.store.draft('nearest', 'dog')
    k.store.commit('nearest')
    await k.store.count()
    k.store.click('cat')
    const m = k.all()
    expect(m).toMatch(/data-reveal="counts"/)
    expect(m).toMatch(/data-lines="neighbors"/)
    expect(text(m)).toMatch(/Your prediction for the word closest to cat: dog/)
  })
  it('Step 3: no distribution before the prediction; Step 4: no palette, distribution, or attention before the two predictions', () => {
    const k = fresh(predictors as Mod, (s, p) => new PredictorsStore(s, p))
    k.store.open(3)
    k.store.begin()
    k.store.goScreen3('predict')
    k.store.compute()
    expect(k.store.computed).toBe(false)
    expect(k.all()).not.toMatch(/data-reveal="ngram"/)
    k.store.draft('counts', 'the plural form')
    k.store.commit('counts')
    k.store.compute()
    expect(k.all()).toMatch(/data-reveal="ngram"/)
    expect(k.all()).toMatch(/data-bars="from-two"/)
    k.store.open(4)
    k.store.begin()
    expect(k.all()).not.toMatch(/data-reveal="networks"|data-palette/)
    k.store.addToken('boys')
    expect(k.store.prompt).toEqual([])
    k.store.draft('agree', 'both the plural form')
    k.store.draft('temp', 'yes, most')
    k.store.commit('agree')
    k.store.commit('temp')
    expect(k.all()).toMatch(/data-reveal="networks"/)
    k.store.addToken('boys')
    k.store.addToken('who')
    expect(k.store.palette).toContain('Mary')
    expect(k.store.palette).not.toContain('.')
  })
  it('the generator, the parser and the probes are the lab’s own: 10,000 sentences and 200 probes', () => {
    const k = fresh(predictors as Mod, (s, p) => new PredictorsStore(s, p))
    expect(k.store.sentences.length).toBe(10000)
    expect(k.store.probes.length).toBe(200)
  })
})

describe('no microphone or camera', () => {
  it('getUserMedia was never called by anything above', () => {
    expect(mediaCalls).toBe(0)
  })
})
