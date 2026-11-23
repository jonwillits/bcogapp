import { makeRng } from '../../../sim/random'
import type { ProgressStore } from '../../../sim/language/progress/store'
import type { UnitId } from '../../../sim/language/parts'
import type { View } from '../../../sim/language/audio/spectrogram'
import { player } from '../../../sim/language/audio/player'
import { bufferFrom, type Clip } from '../../../sim/language/audio/clips'
import { abxTrials, labelingTrials, LABELING_GAP_MS, LABELING_REPEATS, REPEAT_GAP_S, STEPS, TRIAD_INTERVAL_S, type Label as Lbl, type Triad } from '../../../sim/language/sounds/abx'
import { accuracy, confusion, forward, makeClassifier, shares, splitOnePitch, splitOneVoice, splitRun1, train, PASSES, type Classifier, type Token } from '../../../sim/language/sounds/classifier'
import { StepStore } from '../steps'
import { loadAll, type LoadProgress } from '../loading'
import type { UnderWay } from '../params'
import type { Step } from './screens'
import { RUN3_AFTER_STEP3 } from './afterStep3'
import { continuumClip, continuumPatch, loadContinuum, loadTts, loadVowels, syllableClip, tokenPatches, tokensClip, votClip, vowelClip, SIX_ORDER, type Continuum, type Six, type Tts, type Vowels } from './assets'

/**
 * Part 1's state (spec §5): four steps, each opening on its instruction
 * screen and each independently accessible. Step 2 is one unit (the six
 * labels, from the first label to the commit); Step 3 is two units, one
 * per block, each a timed block in real time that stops when the page is
 * hidden or loses focus, and each opening on its own screen with a Start
 * button (Jon, 2026-11-16); Steps 1 and 4 are explorations whose
 * predictions stay committed. Every sound is decoded before its step's first trial
 * (`ensureLoaded`), and played on the Web Audio clock (`player`).
 */

export const LABELS_UNIT: UnitId = 'p1-labels'
export const LABELING_UNIT: UnitId = 'p1-labeling'
export const ABX_UNIT: UnitId = 'p1-abx'

export type TourScreen = 'time' | 'frequency' | 'energy' | 'patterns' | 'pitch' | 'voice' | 'vowels'
export const TOUR: TourScreen[] = ['time', 'frequency', 'energy', 'patterns', 'pitch', 'voice', 'vowels']

export const PREDICTIONS = {
  pitch: { key: 'p1-s1-pitch', question: 'When the pitch of the vowel goes up from 100 Hz to 200 Hz, what will move on the spectrogram?', choices: ['the harmonics', 'the formants', 'both', 'neither'] },
  run1: { key: 'p1-s4-run1', question: 'The network is trained on ten voices and tested on the two voices it was not trained on. What percentage of the held-out syllables will it label correctly? Chance is 33%.', choices: ['under 50%', '50% to 75%', '75% to 90%', 'over 90%'] },
  run2pitch: { key: 'p1-s4-run2-pitch', question: 'A network is trained on every voice at its own pitch only, and tested on the shifted pitches and the two held-out voices. Will its percentage correct be higher than, about the same as, or lower than run 1’s?', choices: ['higher', 'about the same', 'lower'] },
  run2voice: { key: 'p1-s4-run2-voice', question: 'A network is trained on one voice at its three pitches only, and tested on the other eleven voices. Will its percentage correct be higher than, about the same as, or lower than run 1’s?', choices: ['higher', 'about the same', 'lower'] },
  run2which: { key: 'p1-s4-run2-which', question: 'Which of the two will label more of its test syllables correctly?', choices: ['the network trained on one pitch', 'the network trained on one voice', 'about the same'] },
  run3: { key: 'p1-s4-run3', question: `The network from run 1 is run on the ${STEPS} synthetic sounds of Step 3. From the first sound to the ninth, in what order will its most likely label change?`, choices: ['b, then d', 'another order', `one label for all ${STEPS}`] },
  // Asked instead of run3's when Step 3 is done (spec §5.4; §11, item 2): the wording is in afterStep3.ts.
  run3After: RUN3_AFTER_STEP3,
} as const
export type PredictionKey = keyof typeof PREDICTIONS
/** The three predictions of run 2, all committed before Train both (Jon, 2026-11-19). */
export const RUN2_KEYS = ['run2pitch', 'run2voice', 'run2which'] as const satisfies readonly PredictionKey[]
/** How many networks Train 10 networks trains, one after another, in run 1. */
export const MANY_NETWORKS = 10

export interface LabelsResult {
  order: Six[]
  labels: Record<Six, 'b' | 'd'>
  correct: number
  seconds: number
  restarts: number
}
export interface LabelingResult {
  trials: number[]
  answers: Lbl[]
  seconds: number[]
  restarts: number
}
export interface AbxResult {
  trials: Triad[]
  answers: ('first' | 'second')[]
  seconds: number[]
  restarts: number
}

export type Block =
  | { kind: 'labeling'; trials: number[]; answers: Lbl[]; i: number; phase: 'waiting' | 'playing' | 'answer'; seconds: number[]; restarts: number }
  | { kind: 'abx'; trials: Triad[]; answers: ('first' | 'second')[]; i: number; phase: 'waiting' | 'playing' | 'answer'; seconds: number[]; restarts: number }

export interface RunState {
  state: 'idle' | 'training' | 'done'
  curve: number[]
  accuracy: number | null
  confusion: number[][] | null
  pass: number
  trainingSize: number
  testSize: number
  net: Classifier | null
}

/** A run before it trains. */
function freshRun(): RunState {
  return { state: 'idle', curve: [], accuracy: null, confusion: null, pass: 0, trainingSize: 0, testSize: 0, net: null }
}

export class SoundsStore extends StepStore<Step> {
  // Loading
  vowels: Vowels | null = null
  continuum: Continuum | null = null
  tts: Tts | null = null
  clips = new Map<string, Clip>()
  loadingFor = new Set<string>()
  loaded = new Set<string>()
  loadError: string | null = null
  /** The count of the step's files, or of Step 4's prepared syllables, while they load. */
  loadProgress: LoadProgress | null = null
  tokens: Token[] | null = null
  tokenProgress = 0
  continuumPatches: Float32Array[] | null = null

  // Step 1
  tour: TourScreen = 'time'
  view: View = 'wide'
  drafts: Partial<Record<PredictionKey, string>> = {}
  /** What is playing: the clip key and its start and end on the audio clock. */
  playing: { key: string; start: number; end: number } | null = null

  // Step 2
  sixOrder: Six[]
  labels: Partial<Record<Six, 'b' | 'd'>> = {}
  labelsStarted = 0
  showVot = false

  // Step 3
  block: Block | null = null
  blockStopped: string | null = null
  private timers: ReturnType<typeof setTimeout>[] = []

  // Step 4
  run1: RunState = freshRun()
  /** Run 1's second button (Jon, 2026-11-19): MANY_NETWORKS networks trained one after another on run 1's split, each from its own seed; `k` is the network under training, 1-based. */
  run1Many: { state: 'idle' | 'training' | 'done'; nets: RunState[]; k: number } = { state: 'idle', nets: [], k: 0 }
  /** Run 2's two networks (Jon, 2026-11-19): one trained on one pitch, one on one voice, trained one after the other by Train both. */
  run2pitch: RunState = freshRun()
  run2voice: RunState = freshRun()
  /** Run 2's second button (Jon, 2026-11-20): MANY_NETWORKS one-pitch networks, then MANY_NETWORKS one-voice networks, one after another; `k` counts the networks trained so far, 1 to 2 × MANY_NETWORKS. */
  run2Many: { state: 'idle' | 'training' | 'done'; pitch: RunState[]; voice: RunState[]; k: number } = { state: 'idle', pitch: [], voice: [], k: 0 }
  /** Run 2 as one state, for whatever reads it as one run: training while either network trains, done when both are. */
  get run2(): { state: 'idle' | 'training' | 'done' } {
    const states = [this.run2pitch.state, this.run2voice.state]
    return { state: states.includes('training') ? 'training' : states.every((x) => x === 'done') ? 'done' : 'idle' }
  }
  run3: { state: 'idle' | 'done'; shares: number[][] | null } = { state: 'idle', shares: null }
  /** Some network of Step 4 is training; every training button waits. */
  get anyTraining(): boolean {
    return this.run1.state === 'training' || this.run1Many.state === 'training' || this.run2.state === 'training' || this.run2Many.state === 'training'
  }
  private trainSeed = 0

  constructor(seed: number, progress: ProgressStore) {
    super(seed, progress, [1, 2, 3, 4], 'sounds')
    const rng = makeRng(seed ^ 0x51a)
    const order = [...SIX_ORDER]
    for (let i = order.length - 1; i > 0; i--) {
      const j = rng.int(i + 1)
      ;[order[i], order[j]] = [order[j], order[i]]
    }
    // A restarted unit gets a new order: the restart count turns the shuffle.
    for (let r = 0; r < progress.restarts(LABELS_UNIT); r++) order.push(order.shift()!)
    this.sixOrder = order
    this.trainSeed = seed ^ 0x7ab
  }

  isDone(step: Step): boolean {
    if (step === 2) return this.progress.isComplete(LABELS_UNIT)
    if (step === 3) return this.progress.isComplete(LABELING_UNIT) && this.progress.isComplete(ABX_UNIT)
    return false
  }

  protected underWay(step: Step): boolean {
    return step === 3 && this.progress.isComplete(LABELING_UNIT) && !this.progress.isComplete(ABX_UNIT)
  }

  /** Step 3 is open and block 1 has not started: its own screen, with Start block 1 (Jon, 2026-11-16: each block gets its instructions right before it). */
  get beforeBlock1(): boolean {
    return this.step === 3 && !this.progress.isComplete(LABELING_UNIT) && this.block === null && this.blockStopped === null
  }
  get betweenBlocks(): boolean {
    return this.step === 3 && this.progress.isComplete(LABELING_UNIT) && !this.progress.isComplete(ABX_UNIT) && this.block === null && this.blockStopped === null
  }

  // ------------------------------------------------ leaving and pausing

  /** What is under way (Jon, 2026-11-18): the six labels once begun and not committed; a block while it runs; a network while it trains. */
  protected underWayNow(): UnderWay | null {
    if (this.step === 2 && this.stateOf(2) === 'running') return 'labels'
    if (this.step === 3 && this.block !== null) return 'block'
    if (this.step === 4 && this.anyTraining) return 'run'
    return null
  }

  protected onPause(what: UnderWay): void {
    if (what === 'labels') {
      player.stop()
      this.playing = null
    }
  }

  /** The labels' clock skips the pause. */
  protected onResume(what: UnderWay, ms: number): void {
    if (what === 'labels') this.labelsStarted += ms
  }

  /** A switch away, or a pause past its limit: the block stops as a focus loss stops it; the six labels start again in a new order. */
  protected onInterrupt(what: UnderWay): void {
    if (what === 'block') this.stopBlock('You left the step, so the block stopped.')
    if (what === 'labels') this.restartLabels()
  }

  /** The six syllables appear again from the start, in a new order, and the restart is counted (as a reload counts it). */
  private restartLabels(): void {
    this.progress.interrupt(LABELS_UNIT)
    const order = [...this.sixOrder]
    order.push(order.shift()!)
    this.sixOrder = order
    this.labels = {}
    this.progress.begin(LABELS_UNIT)
    this.labelsStarted = performance.now()
  }

  protected onOpen(step: Step): void {
    this.stopBlock(null)
    player.stop()
    this.playing = null
    // A finished or half-finished step draws its pictures from the decoded sounds, which `onBegin` alone would never load again after a reload (Jon, 2026-11-17: Step 2's six spectrograms came back black). Decode them when such a step is opened.
    if (this.isDone(step) || this.underWay(step)) void this.ensureLoaded(step)
  }

  protected onBegin(step: Step): void {
    void this.ensureLoaded(step)
    if (step === 2 && !this.progress.isComplete(LABELS_UNIT)) {
      if (this.progress.status(LABELS_UNIT) !== 'in progress') this.progress.begin(LABELS_UNIT)
      this.labelsStarted = performance.now()
    }
  }

  // ------------------------------------------------------------ loading

  /** Decode a step's sounds before its first trial, the files fetched all at once and counted (Jon, 2026-11-20); `changed()` when done. */
  async ensureLoaded(step: Step): Promise<void> {
    const key = `step${step}`
    if (this.loaded.has(key) || this.loadingFor.has(key)) return
    this.loadingFor.add(key)
    this.changed()
    const ctx = player.ensure()
    const progress = (p: LoadProgress) => {
      this.loadProgress = p
      this.changed()
    }
    const put = (k: string, load: Promise<Clip>) => async () => {
      const c = await load
      this.clips.set(k, c)
      return c
    }
    try {
      if (step === 1) {
        this.vowels = this.vowels ?? (await loadVowels())
        await loadAll(Object.entries(this.vowels.sounds).map(([k, v]) => put(`vowel:${k}`, vowelClip(v.file, ctx))), progress)
      } else if (step === 2) {
        this.tts = this.tts ?? (await loadTts())
        const tts = this.tts
        await loadAll([...SIX_ORDER.map((k) => put(`six:${k}`, syllableClip(tts.six[k].file, ctx))), ...Object.entries(tts.vot).map(([k, v]) => put(`vot:${k}`, votClip(v.file, ctx)))], progress)
      } else if (step === 3) {
        this.continuum = this.continuum ?? (await loadContinuum())
        // The lab plays the first STEPS of the shipped 14 (abx.ts).
        await loadAll(this.continuum.steps.filter((x) => x.step <= STEPS).map((st) => put(`cont:${st.step}`, continuumClip(st.file, ctx))), progress)
      } else {
        const [tts, continuum] = await Promise.all([this.tts ?? loadTts(), this.continuum ?? loadContinuum()])
        this.tts = tts
        this.continuum = continuum
        const steps = continuum.steps.filter((x) => x.step <= STEPS)
        const [tk, ...conts] = await loadAll([put('tokens', tokensClip(ctx)), ...steps.map((st) => put(`cont:${st.step}`, continuumClip(st.file, ctx)))], progress)
        const total = tts.tokens.tokens.length
        progress({ done: 0, total, what: 'syllable' })
        this.tokens = await tokenPatches(tk, tts.tokens.tokens, (n) => {
          this.tokenProgress = n
          progress({ done: n, total, what: 'syllable' })
        })
        this.continuumPatches = conts.map((c) => continuumPatch(c))
      }
      this.loaded.add(key)
    } catch (e) {
      this.loadError = `A sound file could not be loaded: ${String(e)}`
    } finally {
      this.loadingFor.delete(key)
      this.loadProgress = null
      this.changed()
    }
  }

  preload(step: Step): void {
    void this.ensureLoaded(step)
  }

  isLoaded(step: Step): boolean {
    return this.loaded.has(`step${step}`)
  }

  clip(key: string): Clip | null {
    return this.clips.get(key) ?? null
  }

  // ------------------------------------------------------------ playback

  /** Play one clip now; the cursor follows the audio clock. */
  play(key: string): void {
    const c = this.clips.get(key)
    if (!c) return
    const ctx = player.ensure()
    if (!ctx) return
    const buffer = c.buffer ?? bufferFrom(ctx, c.samples, c.sampleRate)
    const r = player.play(buffer)
    this.playing = { key, start: r.start, end: r.end }
    this.changed()
    this.after((r.end - ctx.currentTime) * 1000 + 50, () => {
      if (this.playing?.key === key) this.playing = null
      this.changed()
    })
  }

  /** Play a token from the one tokens file: a short buffer cut from it. */
  playToken(i: number): void {
    const c = this.clips.get('tokens')
    const t = this.tts?.tokens.tokens[i]
    if (!c || !t) return
    const ctx = player.ensure()
    if (!ctx) return
    const r = player.play(bufferFrom(ctx, c.samples.slice(t.start, t.start + t.length), c.sampleRate))
    this.playing = { key: `token:${i}`, start: r.start, end: r.end }
    this.changed()
  }

  /** The cursor's position in a clip, from the audio clock; null when it is not playing. */
  cursorIn(key: string): number | null {
    if (!this.playing || this.playing.key !== key) return null
    const t = player.now() - this.playing.start
    return t < 0 || t > this.playing.end - this.playing.start ? null : t
  }

  private after(ms: number, fn: () => void): void {
    const id = setTimeout(() => {
      this.timers = this.timers.filter((t) => t !== id)
      fn()
    }, Math.max(0, ms))
    this.timers.push(id)
  }

  private clearTimers(): void {
    for (const t of this.timers) clearTimeout(t)
    this.timers = []
  }

  // ------------------------------------------------------------ Step 1

  goTour(s: TourScreen): void {
    this.tour = s
    this.changed()
  }
  tourNext(): void {
    const i = TOUR.indexOf(this.tour)
    if (i + 1 < TOUR.length) this.goTour(TOUR[i + 1])
  }
  tourBack(): void {
    const i = TOUR.indexOf(this.tour)
    if (i > 0) this.goTour(TOUR[i - 1])
  }
  setView(v: View): void {
    this.view = v
    this.changed()
  }
  draft(k: PredictionKey, v: string): void {
    this.drafts[k] = v
    this.changed()
  }
  predicted(k: PredictionKey): string | null {
    return this.progress.prediction(PREDICTIONS[k].key)
  }
  commit(k: PredictionKey): void {
    const v = this.drafts[k]
    if (!v) return
    this.progress.commitPrediction(PREDICTIONS[k].key, v)
    this.changed()
  }

  // ------------------------------------------------------------ Step 2

  setLabel(s: Six, l: 'b' | 'd'): void {
    if (this.progress.isComplete(LABELS_UNIT)) return
    this.labels[s] = l
    this.changed()
  }
  get allLabeled(): boolean {
    return SIX_ORDER.every((s) => this.labels[s])
  }
  commitLabels(): void {
    if (!this.allLabeled || this.progress.isComplete(LABELS_UNIT)) return
    const labels = { ...this.labels } as Record<Six, 'b' | 'd'>
    const correct = SIX_ORDER.filter((s) => labels[s] === s[0]).length
    const result: LabelsResult = { order: this.sixOrder, labels, correct, seconds: (performance.now() - this.labelsStarted) / 1000, restarts: this.progress.restarts(LABELS_UNIT) }
    this.progress.complete(LABELS_UNIT, result)
    this.changed()
  }
  labelsResult(): LabelsResult | null {
    return (this.progress.result(LABELS_UNIT) as LabelsResult | undefined) ?? null
  }
  toggleVot(): void {
    this.showVot = !this.showVot
    this.changed()
  }

  // ------------------------------------------------------------ Step 3

  /** Block 1, on the student's press of Start block 1. */
  startBlock1(): void {
    if (!this.progress.isComplete(LABELING_UNIT) && this.block === null) this.beginBlock('labeling')
  }
  startBlock2(): void {
    if (this.progress.isComplete(LABELING_UNIT) && !this.progress.isComplete(ABX_UNIT)) this.beginBlock('abx')
  }

  private beginBlock(kind: 'labeling' | 'abx'): void {
    const unit = kind === 'labeling' ? LABELING_UNIT : ABX_UNIT
    const restarts = this.progress.restarts(unit) + (this.block?.restarts ?? 0)
    if (this.progress.status(unit) !== 'in progress') this.progress.begin(unit)
    const rng = makeRng((this.seed ^ (kind === 'labeling' ? 0x1ab : 0xabc)) + restarts * 101)
    this.block = kind === 'labeling' ? { kind, trials: labelingTrials(rng), answers: [], i: 0, phase: 'waiting', seconds: [], restarts } : { kind, trials: abxTrials(rng), answers: [], i: 0, phase: 'waiting', seconds: [], restarts }
    this.blockStopped = null
    this.changed()
    void this.ensureLoaded(3).then(() => this.playTrial())
  }

  private trialStart = 0

  /** Play the current trial's sound or triad on the audio clock; the answer buttons appear when the last sound ends. */
  private playTrial(): void {
    const b = this.block
    if (!b || b.phase !== 'waiting' || !this.isLoaded(3)) return
    const ctx = player.ensure()
    if (!ctx) return
    b.phase = 'playing'
    const buf = (step: number) => {
      const c = this.clips.get(`cont:${step}`)!
      return c.buffer ?? bufferFrom(ctx, c.samples, c.sampleRate)
    }
    let end: number
    if (b.kind === 'labeling') {
      // The sound plays LABELING_REPEATS times in a row, REPEAT_GAP_S apart (Jon, 2026-11-20); the buttons appear after the last play.
      const bb = buf(b.trials[b.i])
      const r = player.playSequence(Array.from({ length: LABELING_REPEATS }, (_, k) => ({ buffer: bb, offsetS: k * (bb.duration + REPEAT_GAP_S) })))
      end = r.end
      this.playing = { key: `cont:${b.trials[b.i]}`, start: r.start, end: r.end }
    } else {
      const t = b.trials[b.i]
      const items: { buffer: AudioBuffer; offsetS: number }[] = []
      let off = 0
      for (const s of t.sounds) {
        const bb = buf(s)
        items.push({ buffer: bb, offsetS: off })
        off += bb.duration + TRIAD_INTERVAL_S
      }
      const r = player.playSequence(items)
      end = r.end
      this.playing = { key: 'triad', start: r.start, end: r.end }
    }
    this.changed()
    this.after((end - ctx.currentTime) * 1000, () => {
      if (this.block !== b || b.phase !== 'playing') return
      b.phase = 'answer'
      this.trialStart = performance.now()
      this.playing = null
      this.changed()
    })
  }

  /** The student's answer: B or D in block 1; first or second in block 2. */
  answer(a: Lbl | 'first' | 'second'): void {
    const b = this.block
    if (!b || b.phase !== 'answer') return
    const seconds = (performance.now() - this.trialStart) / 1000
    if (b.kind === 'labeling') {
      if (a !== 'b' && a !== 'd') return
      b.answers.push(a)
    } else {
      if (a !== 'first' && a !== 'second') return
      b.answers.push(a)
    }
    b.seconds.push(seconds)
    b.i++
    if (b.i >= b.trials.length) {
      this.finishBlock()
      return
    }
    b.phase = 'waiting'
    this.changed()
    // The next trial starts 800 ms after the answer in both blocks.
    this.after(LABELING_GAP_MS, () => this.playTrial())
  }

  private finishBlock(): void {
    const b = this.block!
    if (b.kind === 'labeling') {
      const result: LabelingResult = { trials: b.trials, answers: b.answers, seconds: b.seconds, restarts: b.restarts }
      this.progress.complete(LABELING_UNIT, result)
    } else {
      const result: AbxResult = { trials: b.trials, answers: b.answers, seconds: b.seconds, restarts: b.restarts }
      this.progress.complete(ABX_UNIT, result)
    }
    this.block = null
    this.changed()
  }

  /** The page was hidden or lost focus during a block: the block stops, and starts again from its first trial on the student's press (LAB_COMMON_FEATURES §7). */
  stopBlock(reason: string | null): void {
    if (!this.block) return
    this.clearTimers()
    player.stop()
    this.playing = null
    if (reason) {
      this.blockStopped = reason
      this.block = { ...this.block, phase: 'waiting', i: 0, answers: [], seconds: [], restarts: this.block.restarts + 1 } as Block
      // The restart is recorded in the block; the trials are redrawn when it starts again.
      const kind = this.block.kind
      const restarts = this.block.restarts
      this.block = null
      this.pendingRestart = { kind, restarts }
    } else this.block = null
    this.changed()
  }
  private pendingRestart: { kind: 'labeling' | 'abx'; restarts: number } | null = null

  /** Start again after a stop. */
  startAgain(): void {
    const p = this.pendingRestart
    if (!p) return
    this.pendingRestart = null
    this.blockStopped = null
    const unit = p.kind === 'labeling' ? LABELING_UNIT : ABX_UNIT
    const rng = makeRng((this.seed ^ (p.kind === 'labeling' ? 0x1ab : 0xabc)) + (this.progress.restarts(unit) + p.restarts) * 101)
    this.block = p.kind === 'labeling' ? { kind: 'labeling', trials: labelingTrials(rng), answers: [], i: 0, phase: 'waiting', seconds: [], restarts: p.restarts } : { kind: 'abx', trials: abxTrials(rng), answers: [], i: 0, phase: 'waiting', seconds: [], restarts: p.restarts }
    this.changed()
    void this.ensureLoaded(3).then(() => this.playTrial())
  }

  labelingResult(): LabelingResult | null {
    return (this.progress.result(LABELING_UNIT) as LabelingResult | undefined) ?? null
  }
  abxResult(): AbxResult | null {
    return (this.progress.result(ABX_UNIT) as AbxResult | undefined) ?? null
  }

  // ------------------------------------------------------------ Step 4

  private async trainRun(run: RunState, training: Token[], test: Token[], seed: number): Promise<void> {
    run.state = 'training'
    run.curve = []
    run.accuracy = null
    run.confusion = null
    run.pass = 0
    run.trainingSize = training.length
    run.testSize = test.length
    const net = makeClassifier(seed)
    run.net = net
    this.changed()
    // One pass per slice, so that the main thread is free between passes and the curve draws as it rises.
    for (let p = 0; p < PASSES; p++) {
      await new Promise((r) => setTimeout(r, 0))
      train(net, training, test, seed + p * 17, 1, undefined, undefined)
      run.curve.push(net.curve[net.curve.length - 1])
      run.pass = p + 1
      this.changed()
    }
    run.accuracy = accuracy(net, test)
    run.confusion = confusion(net, test)
    run.state = 'done'
    this.changed()
  }

  get heldOut(): number[] {
    return this.tts?.tokens.heldOutVoices ?? []
  }

  train1(): void {
    if (!this.tokens || !this.predicted('run1') || this.anyTraining) return
    const { training, test } = splitRun1(this.tokens, this.heldOut)
    this.trainSeed += 1
    void this.trainRun(this.run1, training, test, this.trainSeed)
  }
  /** Train 10 networks: MANY_NETWORKS networks on run 1's split, one after another, each from a new seed; available once the single network of run 1 is done. */
  train1Many(): void {
    if (!this.tokens || !this.predicted('run1') || this.run1.state !== 'done' || this.anyTraining) return
    const { training, test } = splitRun1(this.tokens, this.heldOut)
    const many = { state: 'training' as const, nets: [] as RunState[], k: 0 }
    this.run1Many = many
    this.changed()
    void (async () => {
      for (let k = 0; k < MANY_NETWORKS; k++) {
        const run = freshRun()
        many.nets.push(run)
        many.k = k + 1
        this.trainSeed += 1
        await this.trainRun(run, training, test, this.trainSeed)
        if (this.run1Many !== many) return
      }
      this.run1Many = { ...many, state: 'done' }
      this.changed()
    })()
  }
  /** Every one of run 2's three predictions is committed. */
  get run2Predicted(): boolean {
    return RUN2_KEYS.every((k) => this.predicted(k) !== null)
  }
  /** Train both: the one-pitch network, then the one-voice network, each on its own split (classifier.ts). */
  trainBoth(): void {
    if (!this.tokens || !this.run2Predicted || this.anyTraining) return
    const pitch = splitOnePitch(this.tokens, this.heldOut)
    const voice = splitOneVoice(this.tokens, 1)
    void (async () => {
      this.trainSeed += 1
      await this.trainRun(this.run2pitch, pitch.training, pitch.test, this.trainSeed)
      this.trainSeed += 1
      await this.trainRun(this.run2voice, voice.training, voice.test, this.trainSeed)
    })()
  }
  /** Train 10 of each (Jon, 2026-11-20): MANY_NETWORKS networks on the one-pitch split, then MANY_NETWORKS on the one-voice split, one after another, each from a new seed; available once run 2's two networks are done. */
  train2Many(): void {
    if (!this.tokens || !this.run2Predicted || this.run2.state !== 'done' || this.anyTraining) return
    const pitch = splitOnePitch(this.tokens, this.heldOut)
    const voice = splitOneVoice(this.tokens, 1)
    const many = { state: 'training' as const, pitch: [] as RunState[], voice: [] as RunState[], k: 0 }
    this.run2Many = many
    this.changed()
    void (async () => {
      for (const [list, split] of [[many.pitch, pitch], [many.voice, voice]] as const) {
        for (let k = 0; k < MANY_NETWORKS; k++) {
          const run = freshRun()
          list.push(run)
          many.k += 1
          this.trainSeed += 1
          await this.trainRun(run, split.training, split.test, this.trainSeed)
          if (this.run2Many !== many) return
        }
      }
      this.run2Many = { ...many, state: 'done' }
      this.changed()
    })()
  }
  run3Now(): void {
    if (!this.run1.net || !this.continuumPatches || !this.predicted('run3')) return
    this.run3 = { state: 'done', shares: this.continuumPatches.map((p) => shares(forward(this.run1.net!, p).o)) }
    this.changed()
  }
}
