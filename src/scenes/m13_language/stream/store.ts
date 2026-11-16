import { makeRng } from '../../../sim/random'
import type { ProgressStore } from '../../../sim/language/progress/store'
import type { UnitId } from '../../../sim/language/parts'
import { player } from '../../../sim/language/audio/player'
import { bufferFrom, type Clip } from '../../../sim/language/audio/clips'
import type { Spectrogram } from '../../../sim/language/audio/spectrogram'
import { streamFor, SYLLABLES, SYLLABLES_PER_MINUTE, WORDS, type Stream, type Syllable, type Word } from '../../../sim/language/stream/language'
import { scoreTest, scoreTestByRecognition, testTrials } from '../../../sim/language/stream/test'
import { trainDips, dipsScorer } from '../../../sim/language/stream/learners/dips'
import { makeSrn, trainSrn, srnScorer } from '../../../sim/language/stream/learners/srn'
import { makeParser, trainParser, parserScorer, parserKnows } from '../../../sim/language/stream/learners/parser'
import { boardSyllables, isWord, newBoard, trayCount, TRAY_MAX, type BoardState } from '../../../sim/language/stream/board'
import { StepStore } from '../steps'
import { NOTICE_LINE, type Step } from './screens'
import { assemble, loadRealSpeech, loadStreamJson, streamClip, syllableSpectrograms, type Assembled, type RealSpeech, type StreamJson } from './assets'

/**
 * Part 2's state (spec §6): four steps. Step 1 is one unit (the first
 * minute and the committed answer, restarted from the start if left); Step
 * 2 is a unit that resumes (the board is saved as it goes); Steps 3 and 4
 * are explorations. Steps 2 to 4 show the stream divided into words, so
 * while Step 1 is not committed they open behind a one-line notice (spec
 * §11, item 3). Every run of the learners is on the student's own stream
 * from its beginning, and on 19 other seeds' streams.
 */

export const MINUTE_UNIT: UnitId = 'p2-minute'
export const BOARD_UNIT: UnitId = 'p2-board'
export const MINUTE_SYLLABLES = SYLLABLES_PER_MINUTE
export const AMOUNTS_MIN = [0.5, 1, 2, 4, 7, 14, 21] as const
export const OTHER_STREAMS = 19
export type Replay = 'first' | 'marked' | 'long'

export interface MinuteResult {
  guess: number
  typed: string
  seconds: number
  restarts: number
}

export interface BoardResult extends BoardState {
  seconds: number
}

export type LearnerId = 'dips' | 'srn' | 'parser'
export const LEARNERS: LearnerId[] = ['dips', 'srn', 'parser']
export type TestKind = 'nonword' | 'partword'
/** PARSER's two test rules (spec §6.3; Perruchet and Vinter, 1998, p. 256): the spec's is the default, and the student can switch. */
export type ParserRule = 'spec' | 'paper'

export interface AmountResult {
  /** [student's stream, then the 19 others], each learner's score on each test; PARSER's under the spec's rule. */
  scores: Record<LearnerId, Record<TestKind, number[]>>
  /** PARSER's scores on the same streams under the paper's rule. */
  parserPaper: Record<TestKind, number[]>
}

export class StreamStore extends StepStore<Step> {
  readonly stream: Stream
  json: StreamJson | null = null
  real: RealSpeech | null = null
  clips = new Map<string, Clip>()
  loading = new Set<string>()
  loaded = new Set<string>()
  loadError: string | null = null
  spectrograms: Map<Syllable, Spectrogram> | null = null
  spectrogramsLong: Map<Syllable, Spectrogram> | null = null

  // Step 1
  replay: Replay | null = null
  assembled: Assembled | null = null
  playback: { start: number; end: number } | null = null
  guessDraft: number | null = null
  typedDraft = ''
  minuteStarted = 0
  minuteStopped: string | null = null
  private minuteRestarts = 0
  private timers: ReturnType<typeof setTimeout>[] = []

  // Step 2
  board: BoardState
  highlight: Syllable | null = null
  tray: Syllable[] = []
  confirmingShow = false
  lastCheck: 'word' | 'not a word' | null = null
  boardStarted = 0

  // Step 3
  drafts: Partial<Record<'partwords' | 'reach76' | 'least', string>> = {}
  amountIndex = 3
  results = new Map<number, AmountResult>()
  running: { amount: number; done: number } | null = null
  parserRule: ParserRule = 'spec'

  // Step 4
  utterance = 0
  showStress = false

  constructor(seed: number, progress: ProgressStore) {
    super(seed, progress, [1, 2, 3, 4])
    this.stream = streamFor(seed, 1512)
    this.board = (progress.partial(BOARD_UNIT) as BoardState | undefined) ?? newBoard()
  }

  get boardSyllables(): Syllable[] {
    return boardSyllables(this.stream)
  }

  isDone(step: Step): boolean {
    if (step === 1) return this.progress.isComplete(MINUTE_UNIT)
    if (step === 2) return this.progress.isComplete(BOARD_UNIT)
    return false
  }

  protected underWay(step: Step): boolean {
    return step === 2 && this.progress.status(BOARD_UNIT) === 'in progress'
  }

  notice(step: Step): { line: string; goTo: Step } | null {
    if (step === 1 || this.progress.isComplete(MINUTE_UNIT)) return null
    return { line: NOTICE_LINE, goTo: 1 }
  }

  protected onOpen(): void {
    this.stopPlayback()
  }

  protected onBegin(step: Step): void {
    void this.ensureLoaded(step)
    if (step === 1 && !this.progress.isComplete(MINUTE_UNIT)) {
      if (this.progress.status(MINUTE_UNIT) !== 'in progress') this.progress.begin(MINUTE_UNIT)
    }
    if (step === 2 && !this.progress.isComplete(BOARD_UNIT)) {
      if (this.progress.status(BOARD_UNIT) !== 'in progress') this.progress.begin(BOARD_UNIT)
      this.boardStarted = performance.now()
    }
  }

  // ----------------------------------------------------------- loading

  async ensureLoaded(step: Step): Promise<void> {
    const key = step === 4 ? 'real' : 'stream'
    if (this.loaded.has(key) || this.loading.has(key)) return
    this.loading.add(key)
    this.changed()
    try {
      if (key === 'real') this.real = await loadRealSpeech()
      else {
        const ctx = player.ensure()
        this.json = this.json ?? (await loadStreamJson())
        for (const s of SYLLABLES) {
          this.clips.set(`plain:${s}`, await streamClip(this.json.plain[s].file, ctx))
          this.clips.set(`long:${s}`, await streamClip(this.json.long[s].file, ctx))
        }
        this.spectrograms = syllableSpectrograms(this.clips, false)
        this.spectrogramsLong = syllableSpectrograms(this.clips, true)
      }
      this.loaded.add(key)
    } catch (e) {
      this.loadError = `A file could not be loaded: ${String(e)}`
    } finally {
      this.loading.delete(key)
      this.changed()
    }
  }

  isLoaded(step: Step): boolean {
    return this.loaded.has(step === 4 ? 'real' : 'stream')
  }

  // ----------------------------------------------------------- Step 1

  /** Play the minute: the first 216 syllables, plain or lengthened, on the audio clock. */
  playMinute(which: Replay): void {
    if (!this.isLoaded(1)) return
    if (which === 'first' && this.progress.isComplete(MINUTE_UNIT)) return
    if (which !== 'first' && !this.progress.isComplete(MINUTE_UNIT)) return
    const ctx = player.ensure()
    if (!ctx) return
    this.stopPlayback()
    this.assembled = assemble(this.stream, MINUTE_SYLLABLES, this.clips, which === 'long')
    const r = player.play(bufferFrom(ctx, this.assembled.samples, 16000))
    this.replay = which
    this.playback = r
    this.minuteStopped = null
    if (which === 'first') this.minuteStarted = performance.now()
    this.changed()
    const id = setTimeout(() => {
      this.timers = this.timers.filter((t) => t !== id)
      this.playback = null
      this.changed()
    }, (r.end - ctx.currentTime) * 1000 + 100)
    this.timers.push(id)
  }

  stopPlayback(): void {
    player.stop()
    for (const t of this.timers) clearTimeout(t)
    this.timers = []
    this.playback = null
  }

  /** The first playback was interrupted: it starts again from the start on the student's press (spec §4.1). */
  stopMinute(reason: string): void {
    if (this.replay !== 'first' || !this.playback) return
    this.stopPlayback()
    this.minuteStopped = reason
    this.minuteRestarts++
    this.replay = null
    this.changed()
  }

  get minutePlayed(): boolean {
    return this.replay === 'first' && this.playback === null && this.minuteStopped === null && this.assembled !== null
  }

  /** The audio clock's position in the playing minute, seconds, or null. */
  cursor(): number | null {
    if (!this.playback) return null
    const t = player.now() - this.playback.start
    return t < 0 || t > this.playback.end - this.playback.start ? null : t
  }

  secondsLeft(): number {
    if (!this.playback) return 0
    return Math.max(0, this.playback.end - player.now())
  }

  setGuess(n: number): void {
    this.guessDraft = n
    this.changed()
  }
  setTyped(t: string): void {
    this.typedDraft = t.slice(0, 500)
    this.changed()
  }
  commitAnswer(): void {
    if (this.guessDraft === null || !this.minutePlayed || this.progress.isComplete(MINUTE_UNIT)) return
    const result: MinuteResult = { guess: this.guessDraft, typed: this.typedDraft.trim(), seconds: (performance.now() - this.minuteStarted) / 1000, restarts: this.progress.restarts(MINUTE_UNIT) + this.minuteRestarts }
    this.progress.complete(MINUTE_UNIT, result)
    this.replay = null
    this.changed()
  }
  minuteResult(): MinuteResult | null {
    return (this.progress.result(MINUTE_UNIT) as MinuteResult | undefined) ?? null
  }

  // ----------------------------------------------------------- Step 2

  private saveBoard(): void {
    if (!this.progress.isComplete(BOARD_UNIT)) this.progress.savePartial(BOARD_UNIT, this.board)
  }

  get foundWords(): Word[] {
    return this.board.found.map((f) => f.word)
  }

  clickTile(s: Syllable): void {
    if (this.board.ended) return
    this.highlight = this.highlight === s ? null : s
    this.board = { ...this.board, clicks: [...this.board.clicks, { syllable: s, at: Date.now() }] }
    this.saveBoard()
    this.changed()
  }
  clearHighlight(): void {
    this.highlight = null
    this.changed()
  }
  addToTray(s: Syllable): void {
    if (this.tray.length >= TRAY_MAX || this.board.ended) return
    this.tray = [...this.tray, s]
    this.lastCheck = null
    this.changed()
  }
  removeFromTray(i: number): void {
    this.tray = this.tray.filter((_, k) => k !== i)
    this.lastCheck = null
    this.changed()
  }
  emptyTray(): void {
    this.tray = []
    this.lastCheck = null
    this.changed()
  }
  get trayOccurrences(): number {
    return trayCount(this.boardSyllables, this.tray)
  }
  checkTray(): void {
    if (this.tray.length < 2 || this.board.ended) return
    const w = isWord(this.tray)
    const already = w !== null && this.foundWords.includes(w)
    const result: 'word' | 'not a word' = w ? 'word' : 'not a word'
    const checks = [...this.board.checks, { tray: this.tray, result, at: Date.now() }]
    let found = this.board.found
    if (w && !already) found = [...found, { word: w, checksBefore: checks.length - 1, how: 'found' as const }]
    this.board = { ...this.board, checks, found }
    this.lastCheck = result
    this.tray = []
    this.saveBoard()
    if (found.length === WORDS.length) this.endBoard()
    this.changed()
  }
  askShow(on: boolean): void {
    this.confirmingShow = on
    this.changed()
  }
  /** Show me the words: every word not yet found is added as shown, and the search ends. */
  showWords(): void {
    this.confirmingShow = false
    const found = [...this.board.found]
    for (const w of WORDS) if (!found.some((f) => f.word === w)) found.push({ word: w, checksBefore: this.board.checks.length, how: 'shown' })
    this.board = { ...this.board, found }
    this.endBoard()
    this.changed()
  }
  private endBoard(): void {
    this.board = { ...this.board, ended: true }
    if (!this.progress.isComplete(BOARD_UNIT)) {
      const result: BoardResult = { ...this.board, seconds: (performance.now() - this.boardStarted) / 1000 }
      this.progress.complete(BOARD_UNIT, result)
    }
  }
  boardResult(): BoardResult | null {
    return (this.progress.result(BOARD_UNIT) as BoardResult | undefined) ?? null
  }
  /** The term and the proportions appear once the first word is found (decision 10). */
  get firstWordFound(): boolean {
    return this.board.found.length > 0 || this.progress.isComplete(BOARD_UNIT)
  }

  // ----------------------------------------------------------- Step 3

  draft(k: 'partwords' | 'reach76' | 'least', v: string): void {
    this.drafts[k] = v
    this.changed()
  }
  predictionKey(k: 'partwords' | 'reach76' | 'least'): string {
    return `p2-s3-${k}`
  }
  predicted(k: 'partwords' | 'reach76' | 'least'): string | null {
    return this.progress.prediction(this.predictionKey(k))
  }
  get allPredicted(): boolean {
    return (['partwords', 'reach76', 'least'] as const).every((k) => this.predicted(k))
  }
  commitPredictions(): void {
    if (!(['partwords', 'reach76', 'least'] as const).every((k) => this.drafts[k])) return
    for (const k of ['partwords', 'reach76', 'least'] as const) this.progress.commitPrediction(this.predictionKey(k), this.drafts[k]!)
    this.changed()
  }
  setAmount(i: number): void {
    this.amountIndex = Math.max(0, Math.min(AMOUNTS_MIN.length - 1, i))
    this.changed()
  }
  get amountSyllables(): number {
    return Math.round(AMOUNTS_MIN[this.amountIndex] * SYLLABLES_PER_MINUTE)
  }
  setParserRule(r: ParserRule): void {
    this.parserRule = r
    this.changed()
  }
  /** A learner's 20 scores on a test at a run amount; PARSER's under the rule the student has chosen (both are computed at the run). */
  scoresOf(r: AmountResult, l: LearnerId, test: TestKind): number[] {
    return l === 'parser' && this.parserRule === 'paper' ? r.parserPaper[test] : r.scores[l][test]
  }

  /** Run the three learners on the student's stream and 19 others at the slider's amount, one stream per slice, so that no task holds the main thread long. */
  async runLearners(): Promise<void> {
    if (!this.allPredicted || this.running) return
    const amount = this.amountIndex
    if (this.results.has(amount)) return
    const n = Math.round(AMOUNTS_MIN[amount] * SYLLABLES_PER_MINUTE)
    const scores: AmountResult['scores'] = { dips: { nonword: [], partword: [] }, srn: { nonword: [], partword: [] }, parser: { nonword: [], partword: [] } }
    const parserPaper: AmountResult['parserPaper'] = { nonword: [], partword: [] }
    this.running = { amount, done: 0 }
    this.changed()
    for (let k = 0; k <= OTHER_STREAMS; k++) {
      await new Promise((r) => setTimeout(r, 0))
      const seed = k === 0 ? this.seed : (this.seed ^ 0x2e5d) + k * 7919
      const s = k === 0 ? this.stream : streamFor(seed, Math.ceil(n / 3))
      const nw = testTrials('nonword', makeRng(seed + 1))
      const pw = testTrials('partword', makeRng(seed + 2))
      const dips = trainDips(s.syllables.slice(0, n))
      scores.dips.nonword.push(scoreTest(nw, dipsScorer(dips), makeRng(seed + 3)))
      scores.dips.partword.push(scoreTest(pw, dipsScorer(dips), makeRng(seed + 4)))
      const srn = makeSrn(seed)
      trainSrn(srn, s.syllables, 0, n)
      scores.srn.nonword.push(scoreTest(nw, srnScorer(srn), makeRng(seed + 5)))
      scores.srn.partword.push(scoreTest(pw, srnScorer(srn), makeRng(seed + 6)))
      const parser = makeParser(seed)
      trainParser(parser, s.syllables.slice(0, n))
      scores.parser.nonword.push(scoreTest(nw, parserScorer(parser), makeRng(seed + 7)))
      scores.parser.partword.push(scoreTest(pw, parserScorer(parser), makeRng(seed + 8)))
      parserPaper.nonword.push(scoreTestByRecognition(nw, parserKnows(parser), makeRng(seed + 9)))
      parserPaper.partword.push(scoreTestByRecognition(pw, parserKnows(parser), makeRng(seed + 10)))
      this.running = { amount, done: k + 1 }
      this.changed()
    }
    this.results.set(amount, { scores, parserPaper })
    this.running = null
    this.changed()
  }

  // ----------------------------------------------------------- Step 4

  chooseUtterance(i: number): void {
    this.utterance = i
    this.changed()
  }
  toggleStress(): void {
    this.showStress = !this.showStress
    this.changed()
  }
}
