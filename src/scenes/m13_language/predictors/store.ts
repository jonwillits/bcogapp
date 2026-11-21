import { makeRng } from '../../../sim/random'
import type { ProgressStore } from '../../../sim/language/progress/store'
import { corpus, nextTokens, start, step as parseStep, accepts, SETTINGS, VOCABULARY, NOUNS, END, kindOf, type ParseState } from '../../../sim/language/predictors/grammar'
import { makeCountModel, countStream, type CountModel } from '../../../sim/language/predictors/counts'
import { makeNgram, predictFromOne, predictFromTwo, type Ngram } from '../../../sim/language/predictors/ngram'
import { makeProbes, type Probe } from '../../../sim/language/predictors/probes'
import { scoreSentences, type Scores } from '../../../sim/language/predictors/scoring'
import { loadDesc, loadSnapshot } from '../../../sim/language/predictors/runtime/load'
import { softmax, srnForward, transformerForward, type SeqDesc, type SeqModel, type TransformerOutput, type SrnOutput } from '../../../sim/language/predictors/runtime/seqNet'
import { StepStore } from '../steps'
import type { Step } from './screens'

/**
 * Part 4's state (spec §8): five explorations on one corpus, generated
 * once from a fixed seed so that every student's models are the same. The
 * count model and the prediction from counts are computed in the browser;
 * the transformer and the simple recurrent network are loaded from their
 * shipped snapshots and run by the lab's own runtime. Every prediction is
 * committed before its first result.
 */

export const PREDICTIONS = {
  nearest: { key: 'p4-s2-nearest', question: 'Which word will lie closest to “cat” in the count model, by the similarity of their lists of counts?' },
  counts: { key: 'p4-s3-counts', question: 'After “girls who boys chase”, which kind of token will the prediction from counts make most probable: a plural verb form (“chase”, “walk”, …), a singular verb form (“chases”, “walks”, …), or a noun?', choices: ['a plural verb form', 'a singular verb form', 'a noun'] },
  agree: { key: 'p4-s4-agree', question: 'After “boys who Mary chases”, which verb form will each network give more probability to?', choices: ['both the plural form', 'both the singular form', 'the transformer plural, the recurrent network singular', 'the transformer singular, the recurrent network plural'] },
} as const
// Step 4's temperature prediction was cut (Jon, 2026-11-20): temperature is explained beside Generate a sentence instead.
export type PredictionKey = keyof typeof PREDICTIONS

export const SHOW_SENTENCES = 20
export const WINDOW_DEFAULT = 4
/** One update of a network is one gradient step on a batch of this many sentences (training/m13/train_predictors.py, BATCH; public/m13/models/training.json). */
export const SENTENCES_PER_UPDATE = 32
export const TEMPERATURES = { min: 0.2, max: 2.0, step: 0.1 }
export const GENERATE_MAX = 32

export interface Generated {
  tokens: string[]
  allowed: boolean
  temperature: number
}

/** One press of Generate a sentence: a sentence from each network at the same temperature (Jon, 2026-11-19). */
export interface GeneratedPair {
  temperature: number
  transformer: Generated
  srn: Generated
}

/** The prediction from counts for a prompt (Steps 4 and 5): from the two words before, or from the one word before when the two never occurred together. */
export interface CountPrediction {
  probs: number[]
  /** The words the prediction was computed from: two, or one. */
  context: string[]
  from: 'two' | 'one'
  denominator: number
}

/** The count model's state matching one snapshot of the networks (Jon, 2026-11-20): the counts over the sentences the networks had seen by then. */
export interface CountState {
  updates: number
  /** How many of the training sentences are counted: 32 per update, up to all 9,000. */
  sentences: number
  ngram: Ngram
  model: CountModel
  /** Agreement by depth, as `countAgreementByDepth`. */
  agreement: number[]
  /** The three scores of `scoring.ts` on the held-out and the training sentences, as the networks' were scored when they were trained. */
  scores: { heldOut: Scores; training: Scores }
}

export class PredictorsStore extends StepStore<Step> {
  /** The whole corpus, 10,000 sentences; the first 9,000 are the training sentences every model learns from, the last 1,000 are held out. */
  readonly sentences: string[][]
  readonly training: string[][]
  readonly heldOut: string[][]
  /** The training sentences as one stream, end marks included: what the count model and the n-gram model count. */
  readonly tokens: number[]
  /** The token count of the whole corpus, for Step 1's line. */
  readonly corpusTokens: number
  readonly probes: Probe[]
  readonly ngram: Ngram
  drafts: Partial<Record<PredictionKey, string>> = {}

  // Step 1
  shown = 0

  // Step 2. The window and the two-list rule are fixed (Jon, 2026-11-19): measured over windows 1 to 8 with the
  // lists joined or added, cat's five nearest, the tree's groups and the plane were the same to the eye, so the two
  // settings showed nothing and were cut. The window is WINDOW_DEFAULT; the lists of words before and after are
  // joined, as the original program did.
  readonly windowSize = WINDOW_DEFAULT
  readonly separate = true
  counting: { done: number } | null = null
  model: CountModel | null = null
  clicked: string | null = null
  private countSeq = 0

  // Step 3
  screen3: 'predict' | 'point' = 'predict'
  computed = false

  // Step 4
  descs: { transformer: SeqDesc; srn: SeqDesc } | null = null
  final: { transformer: SeqModel; srn: SeqModel } | null = null
  loadError: string | null = null
  prompt: string[] = []
  temperature = 1.0
  generated: GeneratedPair[] = []
  private genRng = makeRng(0)

  // Step 5
  snapshotIndex = 7
  snapshots = new Map<string, SeqModel>()
  /** Step 5's prompt: a held-out sentence's prefix to start with, then whatever the student builds from the palette or draws with Change the prompt (Jon, 2026-11-20). */
  prompt5: string[] = ['boys', 'who', 'Mary', 'chases']
  loadingSnapshot = false
  private countStates = new Map<number, CountState>()

  constructor(seed: number, progress: ProgressStore) {
    super(seed, progress, [1, 2, 3, 4, 5], 'predictors')
    this.sentences = corpus(makeRng(SETTINGS.corpusSeed), SETTINGS.corpusSentences)
    this.training = this.sentences.slice(0, SETTINGS.trainingSentences)
    this.heldOut = this.sentences.slice(SETTINGS.trainingSentences)
    this.tokens = this.training.flat().map((t) => VOCABULARY.indexOf(t))
    this.corpusTokens = this.sentences.reduce((n, s) => n + s.length, 0)
    this.probes = makeProbes()
    this.ngram = makeNgram(this.tokens)
    this.genRng = makeRng(seed ^ 0x9e4)
  }

  isDone(): boolean {
    return false
  }

  protected onBegin(step: Step): void {
    if (step >= 4) void this.ensureModels()
  }

  // ----------------------------------------------------------- predictions

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
  get nounChoices(): string[] {
    return NOUNS.flatMap((n) => (n.plural ? [n.singular, n.plural] : [n.singular])).filter((w) => w !== 'cat')
  }

  // ----------------------------------------------------------- Step 1

  showMore(): void {
    this.shown = Math.min(this.sentences.length, this.shown + SHOW_SENTENCES)
    this.changed()
  }

  // ----------------------------------------------------------- Step 2

  /** The finished count model, counted at once where a later step needs it before Step 2's Count has run (Steps 3 and 5). */
  ensureCounted(): CountModel {
    if (this.model && !this.counting) return this.model
    this.countSeq++
    const m = countStream(makeCountModel(this.windowSize, this.separate), this.tokens)
    this.model = m
    this.counting = null
    return m
  }
  /** Count the corpus in slices of 2,000 tokens, so that the table fills as it runs and the main thread is never held long. */
  async count(): Promise<void> {
    if (!this.predicted('nearest') || this.counting) return
    const seq = ++this.countSeq
    const m = makeCountModel(this.windowSize, this.separate)
    this.model = m
    this.counting = { done: 0 }
    this.changed()
    const SLICE = 2000
    for (let i = 0; i < this.tokens.length; i += SLICE) {
      await new Promise((r) => setTimeout(r, 0))
      if (seq !== this.countSeq) return
      countStream(m, this.tokens, i, Math.min(this.tokens.length, i + SLICE))
      this.counting = { done: Math.min(this.tokens.length, i + SLICE) }
      this.changed()
    }
    this.counting = null
    this.changed()
  }
  click(word: string): void {
    this.clicked = word
    this.changed()
  }

  // ----------------------------------------------------------- Step 3

  goScreen3(s: 'predict' | 'point'): void {
    this.screen3 = s
    this.changed()
  }
  compute(): void {
    if (!this.predicted('counts')) return
    this.computed = true
    this.changed()
  }

  // ----------------------------------------------------------- Step 4

  async ensureModels(): Promise<void> {
    if (this.final || this.loadError) return
    try {
      const [td, sd] = await Promise.all([loadDesc('transformer'), loadDesc('srn')])
      this.descs = { transformer: td, srn: sd }
      this.changed()
      const [t, s] = await Promise.all([loadSnapshot('transformer'), loadSnapshot('srn')])
      this.final = { transformer: t, srn: s }
      this.snapshots.set(`transformer:${t.updates}`, t)
      this.snapshots.set(`srn:${s.updates}`, s)
    } catch (e) {
      this.loadError = `A model file could not be loaded: ${String(e)}`
    }
    this.changed()
  }

  parseOf(prompt: readonly string[]): ParseState {
    let st = start()
    for (const t of prompt) st = parseStep(st, t)
    return st
  }
  /** The tokens the grammar allows next after a prompt: none when the prompt is not allowed or is a complete sentence. */
  allowedNextOf(prompt: readonly string[]): string[] {
    const st = this.parseOf(prompt)
    return st.ok && !st.complete ? nextTokens(st) : []
  }
  get parse(): ParseState {
    return this.parseOf(this.prompt)
  }
  /** The tokens the palette offers: the whole vocabulary (Jon, 2026-11-19: no Allow any token; the ones the grammar allows next are outlined). */
  get palette(): string[] {
    return VOCABULARY
  }
  /** The tokens the grammar allows next after the prompt: none when the prompt is not allowed or is a complete sentence. */
  get allowedNext(): string[] {
    return this.allowedNextOf(this.prompt)
  }
  get promptAllowed(): boolean {
    return this.parse.ok
  }

  /**
   * The prediction from counts for a prompt, by Step 3's rule: from the two
   * words before, or, when those two words never occurred together in the
   * corpus, from the one word before. A one-token prompt follows the end mark,
   * as a sentence's first word does in the stream.
   */
  countPrediction(prompt: readonly string[], ngram: Ngram = this.ngram): CountPrediction | null {
    if (prompt.length === 0) return null
    const ctx = prompt.length === 1 ? [END, prompt[0]] : prompt.slice(-2)
    const two = predictFromTwo(ngram, VOCABULARY.indexOf(ctx[0]), VOCABULARY.indexOf(ctx[1]))
    if (two.denominator > 0) return { probs: two.probs, context: ctx, from: 'two', denominator: two.denominator }
    const one = predictFromOne(ngram, VOCABULARY.indexOf(ctx[1]))
    return { probs: one.probs, context: [ctx[1]], from: 'one', denominator: one.denominator }
  }
  addToken(t: string): void {
    if (!this.allPredicted4 || this.prompt.length >= GENERATE_MAX - 1 || this.parse.complete) return
    this.prompt = [...this.prompt, t]
    this.changed()
  }
  removeLast(): void {
    this.prompt = this.prompt.slice(0, -1)
    this.changed()
  }
  clearPrompt(): void {
    this.prompt = []
    this.changed()
  }
  get allPredicted4(): boolean {
    return this.predicted('agree') !== null
  }
  setTemperature(t: number): void {
    this.temperature = Math.max(TEMPERATURES.min, Math.min(TEMPERATURES.max, Math.round(t * 10) / 10))
    this.changed()
  }

  /** The two networks' outputs for the prompt, from the final snapshots. */
  outputs(prompt: string[] = this.prompt, models = this.final): { transformer: TransformerOutput; srn: SrnOutput } | null {
    if (!models || prompt.length === 0) return null
    const ids = prompt.map((t) => VOCABULARY.indexOf(t))
    return { transformer: transformerForward(models.transformer, ids), srn: srnForward(models.srn, ids) }
  }

  /** One draw from a distribution with the seeded generator. */
  private draw(p: ArrayLike<number>): number {
    let r = this.genRng.next()
    let pick = p.length - 1
    for (let j = 0; j < p.length; j++) {
      r -= p[j]
      if (r <= 0) {
        pick = j
        break
      }
    }
    return pick
  }

  /**
   * Sample one sentence from one network at the temperature. The networks
   * were trained on sentences from their first word, so the first token is
   * drawn from how often each token begins a sentence in the corpus (the
   * counts after the end mark, the temperature applied the same way); every
   * token after it is drawn from the network's probabilities on the growing
   * context, until the end mark or GENERATE_MAX tokens.
   */
  private sample(kind: 'transformer' | 'srn'): Generated {
    const V = VOCABULARY
    const m = this.final![kind]
    const first = predictFromOne(this.ngram, V.indexOf(END)).probs
    const out: string[] = [V[this.draw(softmax(first.map((p) => Math.log(p || 1e-12)), this.temperature))]]
    let ctx: number[] = [V.indexOf(out[0])]
    while (out.length < GENERATE_MAX && out[out.length - 1] !== END) {
      const o = kind === 'transformer' ? transformerForward(m, ctx) : srnForward(m, ctx)
      const pick = this.draw(softmax(o.logits[o.logits.length - 1], this.temperature))
      out.push(V[pick])
      ctx = ctx.length >= 31 ? [...ctx.slice(1), pick] : [...ctx, pick]
    }
    return { tokens: out, allowed: accepts(out), temperature: this.temperature }
  }

  /** Generate a sentence: one from the transformer and one from the recurrent network, at the same temperature, by the same rules (Jon, 2026-11-19). */
  generate(): void {
    if (!this.final || !this.allPredicted4) return
    const pair: GeneratedPair = { temperature: this.temperature, transformer: this.sample('transformer'), srn: this.sample('srn') }
    this.generated = [pair, ...this.generated].slice(0, 12)
    this.changed()
  }

  // ----------------------------------------------------------- Step 5

  get snapshotUpdates(): number[] {
    return this.descs?.transformer.snapshots.map((s) => s.updates) ?? [0, 50, 200, 500, 1000, 3000, 10000, 20000]
  }
  async setSnapshot(i: number): Promise<void> {
    this.snapshotIndex = Math.max(0, Math.min(this.snapshotUpdates.length - 1, i))
    this.changed()
    await this.ensureSnapshotLoaded()
  }
  async ensureSnapshotLoaded(): Promise<void> {
    const u = this.snapshotUpdates[this.snapshotIndex]
    if (this.snapshots.has(`transformer:${u}`) && this.snapshots.has(`srn:${u}`)) return
    this.loadingSnapshot = true
    this.changed()
    try {
      const [t, s] = await Promise.all([loadSnapshot('transformer', u), loadSnapshot('srn', u)])
      this.snapshots.set(`transformer:${u}`, t)
      this.snapshots.set(`srn:${u}`, s)
    } catch (e) {
      this.loadError = `A model file could not be loaded: ${String(e)}`
    }
    this.loadingSnapshot = false
    this.changed()
  }
  snapshotModels(): { transformer: SeqModel; srn: SeqModel } | null {
    const u = this.snapshotUpdates[this.snapshotIndex]
    const t = this.snapshots.get(`transformer:${u}`)
    const s = this.snapshots.get(`srn:${u}`)
    return t && s ? { transformer: t, srn: s } : null
  }
  /** Change the prompt: a held-out sentence's prefix, cut before its main verb where one can be found, else before its end. */
  changePrompt(): void {
    const rng = this.genRng
    for (let tries = 0; tries < 50; tries++) {
      const s = this.heldOut[rng.int(this.heldOut.length)]
      const i = s.findIndex((t) => kindOf(t) === 'verb')
      const cut = i > 0 ? i : s.length - 1
      const p = s.slice(0, cut)
      if (p.length >= 1 && p.join(' ') !== this.prompt5.join(' ')) {
        this.prompt5 = p
        this.changed()
        return
      }
    }
  }
  /** Step 5's palette (Jon, 2026-11-20): any token, up to the window; a complete sentence takes no more. */
  addToken5(t: string): void {
    if (this.prompt5.length >= GENERATE_MAX - 1 || this.parseOf(this.prompt5).complete) return
    this.prompt5 = [...this.prompt5, t]
    this.changed()
  }
  removeLast5(): void {
    this.prompt5 = this.prompt5.slice(0, -1)
    this.changed()
  }
  clearPrompt5(): void {
    this.prompt5 = []
    this.changed()
  }
  /** Agreement by depth at the current snapshot, as the training script measured it, recomputed here from the probes so the student sees the runtime's own numbers. */
  agreementByDepth(models: { transformer: SeqModel; srn: SeqModel }): Record<'transformer' | 'srn', number[]> {
    const out: Record<'transformer' | 'srn', number[]> = { transformer: [], srn: [] }
    for (const kind of ['transformer', 'srn'] as const) {
      for (const depth of [0, 1, 2, 3]) {
        const ps = this.probes.filter((p) => p.depth === depth)
        let ok = 0
        for (const p of ps) {
          const ids = p.prefix.map((t) => VOCABULARY.indexOf(t))
          const probs = kind === 'transformer' ? transformerForward(models.transformer, ids).probs : srnForward(models.srn, ids).probs
          const last = probs[probs.length - 1]
          if (last[VOCABULARY.indexOf(p.agreeing)] > last[VOCABULARY.indexOf(p.other)]) ok++
        }
        out[kind].push(ps.length ? ok / ps.length : 0)
      }
    }
    return out
  }

  // ----------------------------------------------------------- the count model by snapshot (Jon, 2026-11-20)

  /** How many training sentences the networks had seen after `updates` updates: 32 per update, up to all 9,000. */
  sentencesSeen(updates: number): number {
    return Math.min(this.training.length, updates * SENTENCES_PER_UPDATE)
  }
  /**
   * The count model's state matching a snapshot: its n-gram counts and its
   * count model over the first `sentencesSeen(updates)` training sentences,
   * with its agreement by depth and its held-out accuracy. From the third
   * snapshot on the whole training set is counted and nothing changes any
   * more. Computed once per distinct sentence count.
   */
  countStateAt(updates: number): CountState {
    const n = this.sentencesSeen(updates)
    const had = this.countStates.get(n)
    if (had) return had
    let ngram: Ngram
    let model: CountModel
    if (n === this.training.length) {
      ngram = this.ngram
      model = this.ensureCounted()
    } else {
      const tokens = this.training.slice(0, n).flat().map((t) => VOCABULARY.indexOf(t))
      ngram = makeNgram(tokens)
      model = countStream(makeCountModel(this.windowSize, this.separate), tokens)
    }
    const state: CountState = { updates, sentences: n, ngram, model, agreement: this.countAgreementByDepth(ngram), scores: { heldOut: this.countScores(ngram, this.heldOut), training: this.countScores(ngram, this.training) } }
    this.countStates.set(n, state)
    return state
  }
  /**
   * Agreement by depth for the prediction from counts: for each probe, the
   * two words before the main verb (the last two tokens of the prefix; a
   * one-token prefix follows the end mark), falling back to the one word
   * before when the two never occurred together. The agreeing form must have
   * strictly more probability than the other; a tie, both zero included,
   * counts as not agreeing.
   */
  countAgreementByDepth(ngram: Ngram = this.ngram): number[] {
    const out: number[] = []
    for (const depth of [0, 1, 2, 3]) {
      const ps = this.probes.filter((p) => p.depth === depth)
      let ok = 0
      for (const p of ps) {
        const c = this.countPrediction(p.prefix, ngram)
        if (c && c.probs[VOCABULARY.indexOf(p.agreeing)] > c.probs[VOCABULARY.indexOf(p.other)]) ok++
      }
      out.push(ps.length ? ok / ps.length : 0)
    }
    return out
  }
  /**
   * The count model's three scores on a set of sentences (scoring.ts), as
   * the networks' were scored when they were trained: every token after a
   * sentence's first is predicted from the tokens before it by Step 3's rule
   * (the two words before, else the one word before; a first token follows
   * the end mark).
   */
  countScores(ngram: Ngram, sentences: readonly string[][]): Scores {
    const end = VOCABULARY.indexOf(END)
    return scoreSentences(sentences, (ids) => {
      const out: number[][] = []
      for (let i = 1; i < ids.length; i++) {
        const two = predictFromTwo(ngram, i >= 2 ? ids[i - 2] : end, ids[i - 1])
        out.push(two.denominator > 0 ? two.probs : predictFromOne(ngram, ids[i - 1]).probs)
      }
      return out
    })
  }
}
