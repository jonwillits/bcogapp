import { makeRng } from '../../../sim/random'
import type { ProgressStore } from '../../../sim/language/progress/store'
import { corpus, nextTokens, start, step as parseStep, accepts, SETTINGS, VOCABULARY, NOUNS, END, kindOf, type ParseState } from '../../../sim/language/predictors/grammar'
import { makeCountModel, countStream, type CountModel } from '../../../sim/language/predictors/counts'
import { makeNgram, type Ngram } from '../../../sim/language/predictors/ngram'
import { makeProbes, type Probe } from '../../../sim/language/predictors/probes'
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
  nearest: { key: 'p4-s2-nearest', question: 'Which word will lie closest to cat in the count model, by the similarity of their lists of counts?' },
  counts: { key: 'p4-s3-counts', question: 'After boys who the dog chases, will the prediction from counts give more probability to the plural verb form (chase, walk, …) or to the singular form (chases, walks, …)?', choices: ['the plural form', 'the singular form'] },
  agree: { key: 'p4-s4-agree', question: 'After boys who Mary chases, which verb form will each network give more probability to?', choices: ['both the plural form', 'both the singular form', 'the transformer plural, the recurrent network singular', 'the transformer singular, the recurrent network plural'] },
  temp: { key: 'p4-s4-temp', question: 'At a temperature of 2.0, will most of the sentences the transformer generates be ones the grammar allows?', choices: ['yes, most', 'no, fewer than half'] },
} as const
export type PredictionKey = keyof typeof PREDICTIONS

export const SHOW_SENTENCES = 20
export const WINDOW_DEFAULT = 4
export const TEMPERATURES = { min: 0.2, max: 2.0, step: 0.1 }
export const GENERATE_MAX = 32

export interface Generated {
  tokens: string[]
  allowed: boolean
  temperature: number
}

export class PredictorsStore extends StepStore<Step> {
  readonly sentences: string[][]
  readonly tokens: number[]
  readonly probes: Probe[]
  readonly ngram: Ngram
  drafts: Partial<Record<PredictionKey, string>> = {}

  // Step 1
  shown = 0

  // Step 2
  windowSize = WINDOW_DEFAULT
  separate = true
  counting: { done: number } | null = null
  model: CountModel | null = null
  clicked: string | null = null
  private countSeq = 0

  // Step 3
  screen3: 'order' | 'predict' | 'point' = 'order'
  computed = false

  // Step 4
  descs: { transformer: SeqDesc; srn: SeqDesc } | null = null
  final: { transformer: SeqModel; srn: SeqModel } | null = null
  loadError: string | null = null
  prompt: string[] = []
  anyToken = false
  temperature = 1.0
  generated: Generated[] = []
  private genRng = makeRng(0)

  // Step 5
  snapshotIndex = 7
  snapshots = new Map<string, SeqModel>()
  fixedPrompt: string[] = ['boys', 'who', 'Mary', 'chases']
  loadingSnapshot = false

  constructor(seed: number, progress: ProgressStore) {
    super(seed, progress, [1, 2, 3, 4, 5])
    this.sentences = corpus(makeRng(SETTINGS.corpusSeed), SETTINGS.corpusSentences)
    this.tokens = this.sentences.flat().map((t) => VOCABULARY.indexOf(t))
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

  setWindow(w: number): void {
    this.windowSize = Math.max(1, Math.min(8, Math.round(w)))
    this.model = null
    this.changed()
  }
  setSeparate(on: boolean): void {
    this.separate = on
    this.model = null
    this.changed()
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

  goScreen3(s: 'order' | 'predict' | 'point'): void {
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

  get parse(): ParseState {
    let st = start()
    for (const t of this.prompt) st = parseStep(st, t)
    return st
  }
  /** The tokens the palette offers: the grammar's legal next tokens, or every token with Allow any token. */
  get palette(): string[] {
    if (this.anyToken) return VOCABULARY
    const st = this.parse
    return st.ok && !st.complete ? nextTokens(st) : []
  }
  get promptAllowed(): boolean {
    return this.parse.ok
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
  setAnyToken(on: boolean): void {
    this.anyToken = on
    this.changed()
  }
  get allPredicted4(): boolean {
    return this.predicted('agree') !== null && this.predicted('temp') !== null
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

  /** Sample one sentence from the transformer at the temperature, from an empty start token: the first token is drawn from the distribution after the end mark, as a sentence begins after one. */
  generate(): void {
    if (!this.final || !this.allPredicted4) return
    const V = VOCABULARY
    const out: string[] = []
    let ctx: number[] = [V.indexOf(END)]
    for (let k = 0; k < GENERATE_MAX; k++) {
      const o = transformerForward(this.final.transformer, ctx)
      const p = softmax(o.logits[o.logits.length - 1], this.temperature)
      let r = this.genRng.next()
      let pick = p.length - 1
      for (let j = 0; j < p.length; j++) {
        r -= p[j]
        if (r <= 0) {
          pick = j
          break
        }
      }
      out.push(V[pick])
      if (V[pick] === END) break
      ctx = ctx.length >= 31 ? [...ctx.slice(1), pick] : [...ctx, pick]
    }
    this.generated = [{ tokens: out, allowed: accepts(out), temperature: this.temperature }, ...this.generated].slice(0, 12)
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
  changePrompt(): void {
    // A new fixed prompt: a held-out sentence's prefix, cut before its main verb where one can be found, else before its end.
    const rng = this.genRng
    for (let tries = 0; tries < 50; tries++) {
      const s = this.sentences[9000 + rng.int(1000)]
      const i = s.findIndex((t) => kindOf(t) === 'verb')
      const cut = i > 0 ? i : s.length - 1
      const p = s.slice(0, cut)
      if (p.length >= 1 && p.join(' ') !== this.fixedPrompt.join(' ')) {
        this.fixedPrompt = p
        this.changed()
        return
      }
    }
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
}
