import { makeRng } from '../../../sim/random'
import type { ProgressStore } from '../../../sim/language/progress/store'
import type { UnitId } from '../../../sim/language/parts'
import { player } from '../../../sim/language/audio/player'
import { bufferFrom, type Clip } from '../../../sim/language/audio/clips'
import { makeDesign, isCorrect, LEARNING_TRIALS, WORDS_PER_SET, type Design, type Trial } from '../../../sim/language/words/design'
import { keyMeasure, type KeyMeasure } from '../../../sim/language/words/keyMeasure'
import { fit, runs, runModel, ALPHA_GRID, BETA_GRID, type ModelId, type ModelRuns } from '../../../sim/language/words/fit'
import { StepStore } from '../steps'
import { NOTICE_LINE, type Step } from './screens'
import { loadObjects, loadWordFiles, wordClip, type ObjectFile, type WordFile } from './assets'

/**
 * Part 3's state (spec §7): Steps 1 and 2 are one unit, the 60 learning
 * trials and the 12-trial test, restarted on the reserve set of 12 new
 * words and 12 new objects if interrupted (the materials slot the shared
 * layer gives the unit chooses the set); Step 3 is an exploration on the
 * student's own trials, behind a one-line notice while the unit is not
 * done. The word plays once when a trial's objects appear, on the audio
 * clock; a choice shows for about 200 ms before the next trial.
 */

export const WORDS_UNIT: UnitId = 'p3-words'
export const CHOICE_SHOW_MS = 200
export const PREDICTION = { key: 'p3-s3-after-wrong', question: 'After a trial on which you clicked the wrong object for a word, will your next choice for that word be correct about as often as chance, which is 1 in 5 (20%), or more often than chance?', choices: ['about as often as chance', 'more often than chance'] } as const

export interface WordsResult {
  materials: 0 | 1
  /** The chosen object on each learning trial, by index. */
  choices: number[]
  /** The chosen object on each test trial. */
  testChoices: number[]
  secondsPerTrial: number[]
  restarts: number
}

export class WordsStore extends StepStore<Step> {
  readonly materials: 0 | 1
  readonly design: Design
  /** The words of the set in use, by word index, and the objects by object index: filled once the files are loaded. */
  words: WordFile[] = []
  objects: ObjectFile[] = []
  clips = new Map<number, Clip>()
  loading = false
  loadedOk = false
  loadError: string | null = null

  // The unit under way
  phase: 'learning' | 'test' | 'done' = 'learning'
  i = 0
  choices: number[] = []
  testChoices: number[] = []
  seconds: number[] = []
  /** The object just chosen, shown briefly before the next trial. */
  chosenNow: number | null = null
  private trialStart = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  playing: { start: number; end: number } | null = null

  // Step 3
  draft: string | null = null
  gcRuns: ModelRuns | null = null
  tallyRuns: ModelRuns | null = null
  fitted: { alpha: number; alphaAccuracy: number; beta: number; betaAccuracy: number } | null = null
  alpha: number | null = null
  beta: number | null = null
  computing = false

  constructor(seed: number, progress: ProgressStore) {
    super(seed, progress, [1, 2, 3])
    this.materials = Math.min(1, progress.materialsSlot(WORDS_UNIT)) as 0 | 1
    this.design = makeDesign(seed, this.materials)
  }

  isDone(step: Step): boolean {
    return step !== 3 && this.progress.isComplete(WORDS_UNIT)
  }

  notice(step: Step): { line: string; goTo: Step } | null {
    if (step !== 3 || this.progress.isComplete(WORDS_UNIT)) return null
    return { line: NOTICE_LINE, goTo: 1 }
  }

  protected onOpen(): void {
    if (this.timer) clearTimeout(this.timer)
    player.stop()
  }

  protected onBegin(step: Step): void {
    void this.ensureLoaded()
    if (step !== 3 && !this.progress.isComplete(WORDS_UNIT)) {
      // Step 2 opened first starts the learning trials of Step 1 (its screen says so).
      if (this.progress.status(WORDS_UNIT) !== 'in progress') this.progress.begin(WORDS_UNIT)
      this.phase = 'learning'
      this.i = 0
      this.trialStart = performance.now()
      void this.ensureLoaded().then(() => this.playTrialWord())
    }
    if (step === 3 && this.result()) void this.prepareModels()
  }

  async ensureLoaded(): Promise<void> {
    if (this.loadedOk || this.loading) return
    this.loading = true
    this.changed()
    try {
      const ctx = player.ensure()
      const all = await loadWordFiles()
      this.words = all.filter((w) => w.set === this.materials)
      this.objects = (await loadObjects()).filter((o) => o.set === this.materials)
      for (let w = 0; w < WORDS_PER_SET; w++) this.clips.set(w, await wordClip(this.words[w].file, ctx))
      this.loadedOk = true
    } catch (e) {
      this.loadError = `A file could not be loaded: ${String(e)}`
    } finally {
      this.loading = false
      this.changed()
    }
  }

  // ------------------------------------------------------- the unit

  get currentTrial(): Trial | null {
    if (this.progress.isComplete(WORDS_UNIT)) return null
    if (this.phase === 'learning') return this.design.learning[this.i] ?? null
    if (this.phase === 'test') return this.design.test[this.i] ?? null
    return null
  }

  get trialLabel(): string {
    if (this.phase === 'learning') return `Trial ${String(this.i + 1).padStart(2)} of ${LEARNING_TRIALS}`
    if (this.phase === 'test') return `Test trial ${String(this.i + 1).padStart(2)} of ${WORDS_PER_SET}`
    return ''
  }

  private playTrialWord(): void {
    const t = this.currentTrial
    if (!t || !this.loadedOk) return
    this.playWord(t.word)
  }

  /** Play a word, on the audio clock. Hear it again replays the trial's word. */
  playWord(w: number): void {
    const c = this.clips.get(w)
    const ctx = player.ensure()
    if (!c || !ctx) return
    const r = player.play(c.buffer ?? bufferFrom(ctx, c.samples, c.sampleRate))
    this.playing = r
    this.changed()
  }
  hearAgain(): void {
    const t = this.currentTrial
    if (t && this.chosenNow === null) this.playWord(t.word)
  }

  choose(object: number): void {
    const t = this.currentTrial
    if (!t || this.chosenNow !== null || !t.objects.includes(object)) return
    this.chosenNow = object
    this.seconds.push((performance.now() - this.trialStart) / 1000)
    if (this.phase === 'learning') this.choices.push(object)
    else this.testChoices.push(object)
    this.changed()
    this.timer = setTimeout(() => this.advance(), CHOICE_SHOW_MS)
  }

  private advance(): void {
    this.chosenNow = null
    this.i++
    if (this.phase === 'learning' && this.i >= this.design.learning.length) {
      this.phase = 'test'
      this.i = 0
      this.step = 2
    }
    if (this.phase === 'test' && this.i >= this.design.test.length) {
      this.phase = 'done'
      const result: WordsResult = { materials: this.materials, choices: this.choices, testChoices: this.testChoices, secondsPerTrial: this.seconds, restarts: this.progress.restarts(WORDS_UNIT) }
      this.progress.complete(WORDS_UNIT, result)
      this.changed()
      return
    }
    this.trialStart = performance.now()
    this.changed()
    this.playTrialWord()
  }

  result(): WordsResult | null {
    return (this.progress.result(WORDS_UNIT) as WordsResult | undefined) ?? null
  }

  /** The design of the saved result's set (the reserve set, if that is what was used). */
  resultDesign(): Design | null {
    const r = this.result()
    return r ? makeDesign(this.seed, r.materials) : null
  }

  studentMeasure(): KeyMeasure | null {
    const r = this.result()
    const d = this.resultDesign()
    return r && d ? keyMeasure(d, r.choices) : null
  }

  testScore(): number | null {
    const r = this.result()
    const d = this.resultDesign()
    if (!r || !d) return null
    return d.test.filter((t, k) => isCorrect(d, t, r.testChoices[k])).length
  }

  // ------------------------------------------------------- Step 3

  setDraft(v: string): void {
    this.draft = v
    this.changed()
  }
  predicted(): string | null {
    return this.progress.prediction(PREDICTION.key)
  }
  commit(): void {
    if (!this.draft) return
    this.progress.commitPrediction(PREDICTION.key, this.draft)
    this.changed()
  }

  /** The trials the models run on: the student's own, or a sample sequence drawn from the seed when Steps 1 and 2 are not done (spec §4.2). */
  get modelDesign(): Design {
    return this.resultDesign() ?? makeDesign(this.seed ^ 0x5a3, 0)
  }
  get usingSample(): boolean {
    return this.result() === null
  }
  /** The accuracy the models are fitted to: the student's over occurrences 2 to 5, or, for the sample sequence, that of a scripted chooser drawn from the seed. */
  get targetAccuracy(): number {
    const km = this.studentMeasure()
    if (km) return km.accuracy
    const d = this.modelDesign
    return keyMeasure(d, runModel('tally', 2, d, this.seed ^ 0x77)).accuracy
  }

  /** Fit both models to the target accuracy and run them 200 times at the fitted values, in slices. */
  async prepareModels(): Promise<void> {
    if (this.fitted || this.computing) return
    this.computing = true
    this.changed()
    const d = this.modelDesign
    const target = this.targetAccuracy
    await new Promise((r) => setTimeout(r, 0))
    const fa = fit('guessCheck', d, target, this.seed + 11)
    await new Promise((r) => setTimeout(r, 0))
    const fb = fit('tally', d, target, this.seed + 13)
    this.fitted = { alpha: fa.param, alphaAccuracy: fa.accuracy, beta: fb.param, betaAccuracy: fb.accuracy }
    this.alpha = fa.param
    this.beta = fb.param
    await new Promise((r) => setTimeout(r, 0))
    this.gcRuns = runs('guessCheck', fa.param, d, this.seed + 21)
    this.changed()
    await new Promise((r) => setTimeout(r, 0))
    this.tallyRuns = runs('tally', fb.param, d, this.seed + 23)
    this.computing = false
    this.changed()
  }

  runModels(): void {
    if (!this.predicted()) return
    void this.prepareModels()
  }

  setAlpha(v: number): void {
    this.alpha = ALPHA_GRID.reduce((best, g) => (Math.abs(g - v) < Math.abs(best - v) ? g : best), ALPHA_GRID[0])
    this.gcRuns = runs('guessCheck', this.alpha, this.modelDesign, this.seed + 21)
    this.changed()
  }
  setBeta(v: number): void {
    this.beta = BETA_GRID.reduce((best, g) => (Math.abs(g - v) < Math.abs(best - v) ? g : best), BETA_GRID[0])
    this.tallyRuns = runs('tally', this.beta, this.modelDesign, this.seed + 23)
    this.changed()
  }
  backToFitted(model: ModelId): void {
    if (!this.fitted) return
    if (model === 'guessCheck') this.setAlpha(this.fitted.alpha)
    else this.setBeta(this.fitted.beta)
  }
}

export function sampleRng(seed: number) {
  return makeRng(seed)
}
