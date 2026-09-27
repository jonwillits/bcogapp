/**
 * The Bench tab's hidden map (spec §8): one generic mammal, six tasks, four
 * tools, and a result for every cell that traces to the chapter.
 *
 * **No invented results.** Every result the bench can display is one of three
 * kinds, and the kind is shown on screen:
 *
 *   reported     the chapter describes this experiment and its result
 *   follows      the chapter states the function, and this result follows
 *                directly from it
 *   notReported  shown grey, with *no result reported* — never as zero
 *
 * §8.5 of the spec is the complete map, cell by cell, and this file is that
 * table in code. A cell with no chapter claim behind it is grey. If the bench
 * looks patchy, that is the honest shape of what the chapter reports, and the
 * handout uses the patchiness.
 *
 * The numbers a readout prints are schematic, drawn with a little seeded
 * jitter so that two runs look like two runs; their *kind* of behavior is
 * what the chapter supports (a trained animal freezes, an untrained one does
 * not), never a magnitude anyone measured. The panel says so.
 *
 * Nothing here is a simulated body: `train` and `test` are instantaneous, so
 * no part of the lab asks a student to sit and wait.
 */
import { makeRng, type Rng } from '../random'

export type TaskId = 'orient' | 'toneShock' | 'cueFood' | 'lever' | 'timedBlink' | 'openField'

export interface Task {
  id: TaskId
  label: string
  /** What happens. */
  what: string
  /** What is measured. */
  measured: string
  learned: boolean
  /** The claims the intact result rests on. */
  claims: string[]
}

export const TASKS: readonly Task[] = [
  {
    id: 'orient',
    label: 'Orient',
    what: 'A flash appears at one of several positions.',
    measured: 'Whether, and how accurately, the eyes and head turn toward it.',
    learned: false,
    claims: ['§6.1.8-C8', '§6.3.2-C4'],
  },
  {
    id: 'toneShock',
    label: 'Tone and shock',
    what: 'A tone is followed by a mild shock during training; the tone alone at test.',
    measured: 'Time spent freezing to the tone.',
    learned: true,
    claims: ['§6.3.13-C3', '§6.3.13-C6'],
  },
  {
    id: 'cueFood',
    label: 'Cue and food',
    what: 'A light is followed by food during training; the light alone at test.',
    measured: 'Approach to the food site after the light.',
    learned: true,
    claims: ['§6.3.13-C6'],
  },
  {
    id: 'lever',
    label: 'Lever',
    what: 'Pressing a lever delivers food.',
    measured: 'Presses per minute.',
    learned: true,
    claims: ['§6.2.5-C2', '§6.2.5-C3'],
  },
  {
    id: 'timedBlink',
    label: 'Timed blink',
    what: 'A tone is followed by a puff of air to the eye a quarter-second later.',
    measured: 'Whether the eye is already closed when the puff arrives. The reflex blink to the puff itself is shown separately.',
    learned: true,
    claims: ['§6.2.4-C2', '§6.2.4-C3', '§6.2.4-C8'],
  },
  {
    id: 'openField',
    label: 'Open field',
    what: 'No task; the animal is placed in an open space.',
    measured: 'Walking, grooming, exploring.',
    learned: false,
    claims: ['§6.2.8-C22'],
  },
] as const

export function task(id: TaskId): Task {
  const t = TASKS.find((x) => x.id === id)
  if (!t) throw new Error(`no task ${id}`)
  return t
}

/** The structures the bench records from. The hippocampus is listed and never non-grey. */
export type BenchStructureId =
  | 'hindbrainReticular'
  | 'norepinephrineCluster'
  | 'cerebellum'
  | 'tectum'
  | 'periaqueductalGray'
  | 'dopamineClusters'
  | 'hypothalamus'
  | 'thalamus'
  | 'striatum'
  | 'amygdala'
  | 'pallium'
  | 'hippocampus'
  | 'serotoninClusters'

export const BENCH_STRUCTURES: readonly { id: BenchStructureId; label: string }[] = [
  { id: 'hindbrainReticular', label: 'hindbrain and reticular formation' },
  { id: 'norepinephrineCluster', label: 'norepinephrine cluster' },
  { id: 'cerebellum', label: 'cerebellum' },
  { id: 'tectum', label: 'tectum (superior colliculus)' },
  { id: 'periaqueductalGray', label: 'periaqueductal gray' },
  { id: 'dopamineClusters', label: 'dopamine clusters' },
  { id: 'hypothalamus', label: 'hypothalamus' },
  { id: 'thalamus', label: 'thalamus' },
  { id: 'striatum', label: 'basal ganglia (striatum)' },
  { id: 'amygdala', label: 'amygdala' },
  { id: 'pallium', label: 'pallium (neocortex)' },
  { id: 'hippocampus', label: 'hippocampus' },
  { id: 'serotoninClusters', label: 'serotonin clusters' },
] as const

export type Kind = 'reported' | 'follows' | 'notReported'

export const KIND_LABEL: Record<Kind, string> = {
  reported: 'reported',
  follows: 'follows from the chapter',
  notReported: 'no result reported',
}

/** The four-step schematic activity scale. */
export type Level = 'none' | 'low' | 'moderate' | 'high'

export const LEVEL_LINE = 'Activity is shown on a four-step schematic scale: none, low, moderate, high. The steps are not measurements.'

/** §6.2.1-C5, printed with every recording. */
export const REVERSE_INFERENCE_LINE = 'Going from “this structure was active during the task” to “this structure does the task” is reverse inference. A recording shows where; it does not show what for.'

type L = Level | null

interface RecordRow {
  structure: BenchStructureId
  levels: Record<TaskId, L>
  claims: string[]
  /** Printed beside the row. */
  note?: string
  crossRef?: string
}

/** §8.5's recording map, row for row. A `null` is a grey cell. */
const RECORD_MAP: readonly RecordRow[] = [
  {
    structure: 'hindbrainReticular',
    levels: { orient: 'moderate', toneShock: 'moderate', cueFood: 'moderate', lever: 'moderate', timedBlink: 'moderate', openField: 'moderate' },
    claims: ['§6.3.1-C6', '§6.3.1-C8'],
    note: 'Breathing, heart rate and wakefulness run throughout.',
  },
  {
    structure: 'norepinephrineCluster',
    levels: { orient: 'low', toneShock: 'high', cueFood: 'low', lever: 'low', timedBlink: 'low', openField: 'low' },
    claims: ['§6.3.1-C10', '§6.3.1-C11'],
    note: 'The arousal dial.',
  },
  {
    structure: 'cerebellum',
    levels: { orient: 'low', toneShock: null, cueFood: null, lever: 'moderate', timedBlink: 'high', openField: 'moderate' },
    claims: ['§6.2.1-C1', '§6.2.4-C10', '§6.2.4-C12'],
    note: 'Active during movement, and during perception.',
  },
  {
    structure: 'tectum',
    levels: { orient: 'high', toneShock: null, cueFood: 'low', lever: null, timedBlink: null, openField: 'low' },
    claims: ['§6.3.2-C2', '§6.3.2-C3', '§6.3.2-C4'],
  },
  {
    structure: 'periaqueductalGray',
    levels: { orient: null, toneShock: 'high', cueFood: null, lever: null, timedBlink: null, openField: null },
    claims: ['§6.3.2-C16'],
  },
  {
    structure: 'dopamineClusters',
    levels: { orient: null, toneShock: null, cueFood: 'moderate', lever: 'moderate', timedBlink: null, openField: null },
    claims: ['§6.2.5-C8', '§6.2.5-C4'],
    note: 'Early in training the response is at the food. Late in training it is at the cue, and not at the food.',
    crossRef: 'Module 5 §5.3.7; a primate recording result.',
  },
  {
    structure: 'hypothalamus',
    levels: { orient: null, toneShock: null, cueFood: 'moderate', lever: 'moderate', timedBlink: null, openField: null },
    claims: ['§6.1.8-C12', '§6.3.3-C4'],
    note: 'A food-restricted animal is driven toward food.',
  },
  {
    structure: 'thalamus',
    levels: { orient: 'moderate', toneShock: 'moderate', cueFood: 'moderate', lever: 'moderate', timedBlink: 'moderate', openField: 'low' },
    claims: ['§6.1.8-C13'],
  },
  {
    structure: 'striatum',
    levels: { orient: 'moderate', toneShock: 'moderate', cueFood: 'high', lever: 'high', timedBlink: 'moderate', openField: 'moderate' },
    claims: ['§6.2.1-C1', '§6.3.13-C16'],
  },
  {
    structure: 'amygdala',
    levels: { orient: 'low', toneShock: 'high', cueFood: 'high', lever: null, timedBlink: null, openField: null },
    claims: ['§6.3.3-C12', '§6.3.13-C7', '§6.3.13-C15'],
  },
  {
    structure: 'pallium',
    levels: { orient: 'moderate', toneShock: 'moderate', cueFood: 'moderate', lever: 'moderate', timedBlink: 'moderate', openField: 'moderate' },
    claims: ['§6.1.8-C15'],
  },
  {
    structure: 'hippocampus',
    levels: { orient: null, toneShock: null, cueFood: null, lever: null, timedBlink: null, openField: null },
    claims: [],
    note: 'Named, not spent. Modules 9 and 10 take it up.',
  },
  {
    structure: 'serotoninClusters',
    levels: { orient: null, toneShock: null, cueFood: null, lever: null, timedBlink: null, openField: null },
    claims: [],
    note: 'No task-specific claim in the chapter.',
  },
] as const

export interface RecordCell {
  structure: BenchStructureId
  label: string
  level: Level | null
  kind: Kind
  claims: string[]
  note?: string
  crossRef?: string
  /** For the dopamine cells in the two food tasks: where the response is, early and late in training. */
  shift?: { early: string; late: string }
}

export function recordMap(): readonly RecordRow[] {
  return RECORD_MAP
}

export type Route = 'climbingFibers' | 'dopamineFibers'

export const ROUTES: readonly { id: Route; label: string; to: string }[] = [
  { id: 'climbingFibers', label: 'climbing fibers', to: 'to the cerebellum' },
  { id: 'dopamineFibers', label: 'dopamine fibers', to: 'to the striatum' },
] as const

export type Removable = 'pallium' | 'dopamineClusters' | 'amygdala' | 'hindbrain'
export type Stimulable = 'dopamineClusters' | 'periaqueductalGray' | 'tectum'

export const REMOVE_MENU: readonly { id: Removable; label: string }[] = [
  { id: 'pallium', label: 'the neocortex' },
  { id: 'dopamineClusters', label: 'the dopamine clusters' },
  { id: 'amygdala', label: 'the amygdala' },
  { id: 'hindbrain', label: 'the hindbrain' },
] as const

export const STIMULATE_MENU: readonly { id: Stimulable; label: string }[] = [
  { id: 'dopamineClusters', label: 'the dopamine clusters (raise dopamine)' },
  { id: 'periaqueductalGray', label: 'the periaqueductal gray' },
  { id: 'tectum', label: 'one point on the tectum' },
] as const

export const MENU_LINE = 'This bench reports only experiments the chapter describes, or results that follow directly from what it states.'
export const NO_FEELING_LINE = 'Nothing on this bench measures what the animal feels.'
export const READOUTS_LINE = 'What the bench reads out: behavior, activity, pain response.'
export const SCHEMATIC_NUMBERS_LINE =
  'The numbers are schematic: a trained animal against an untrained one, with a little variation from run to run. They are not measurements from any experiment.'

export interface Readout {
  label: string
  /** `null` means the readout cannot be scored cleanly. */
  value: string | null
  number?: number
}

export interface TestResult {
  task: TaskId
  kind: Kind
  claims: string[]
  speciesNote?: string
  note?: string
  /** `null` for a grey result. */
  movement: 'normal' | 'slow' | null
  readouts: Readout[]
  text: string
  /** How the task was trained, if at all. */
  trainedUnder: Route | 'none' | null
  /** What manipulation the result was measured under. */
  under: string
}

export interface StimulateResult {
  target: Stimulable
  kind: Kind
  claims: string[]
  speciesNote?: string
  text: string
  /** For the tectum: where the animal turned, in degrees left (−) to right (+). */
  direction?: number
  point?: number
}

export interface RemoveResult {
  ok: boolean
  text: string
  kind: Kind
  claims: string[]
}

interface RunRecord {
  what: 'train' | 'test'
  under: string
  summary: string
}

/** The whole bench: one animal, one manipulation at a time, a run record per task. */
export class Bench {
  readonly seed: number
  private rng: Rng
  removed: Removable | null = null
  /** What will be silenced during the next training. */
  silence: Route | null = null
  /** How each learned task was last trained: `null` untrained; 'none' trained intact. */
  trainedUnder: Record<TaskId, Route | 'none' | null>
  runs: Record<TaskId, RunRecord[]>
  private draws = 0

  constructor(seed: number) {
    this.seed = seed
    this.rng = makeRng(seed)
    this.trainedUnder = { orient: null, toneShock: null, cueFood: null, lever: null, timedBlink: null, openField: null }
    this.runs = { orient: [], toneShock: [], cueFood: [], lever: [], timedBlink: [], openField: [] }
  }

  /** How many numbers have been drawn: the determinism test compares two benches on it. */
  get drawCount(): number {
    return this.draws
  }

  private jitter(mean: number, sd: number, lo = 0, hi = Infinity): number {
    this.draws++
    const v = mean + this.rng.normal() * sd
    return Math.round(Math.min(hi, Math.max(lo, v)))
  }

  private describeUnder(): string {
    return this.removed ? `${REMOVE_MENU.find((m) => m.id === this.removed)!.label} removed` : 'intact'
  }

  /** Train a learned task, instantaneously. Whatever `silence` names is silenced for the session and restored afterward. */
  train(t: TaskId): void {
    if (!task(t).learned) return
    const under = this.silence ?? 'none'
    this.trainedUnder[t] = under
    const route = this.silence ? ROUTES.find((r) => r.id === this.silence)!.label : null
    this.push(t, {
      what: 'train',
      under: this.describeUnder(),
      summary: route ? `trained with the ${route} silenced, then restored` : 'trained',
    })
  }

  /** Reset a learned task to untrained. */
  untrain(t: TaskId): void {
    this.trainedUnder[t] = null
    this.push(t, { what: 'train', under: this.describeUnder(), summary: 'training cleared' })
  }

  private push(t: TaskId, r: RunRecord) {
    this.runs[t] = [...this.runs[t], r].slice(-6)
  }

  /** Attempt to remove a structure. The hindbrain is refused. */
  remove(s: Removable): RemoveResult {
    if (s === 'hindbrain') {
      return {
        ok: false,
        kind: 'follows',
        claims: ['§6.1.8-C6', '§6.3.1-C6'],
        text: 'Refused. The animal would not survive: the hindbrain runs breathing and heart rate.',
      }
    }
    this.removed = s
    return { ok: true, kind: 'follows', claims: [], text: `${REMOVE_MENU.find((m) => m.id === s)!.label} removed.` }
  }

  restore(): void {
    this.removed = null
  }

  /** Test a task, under whatever the bench currently is. */
  test(t: TaskId): TestResult {
    const under = this.describeUnder()
    const trainedUnder = this.trainedUnder[t]
    const r = this.result(t, trainedUnder)
    this.push(t, { what: 'test', under, summary: r.kind === 'notReported' ? 'no result reported' : r.readouts.map((x) => `${x.label}: ${x.value ?? 'not scorable'}`).join(' · ') })
    return { ...r, trainedUnder, under }
  }

  private grey(t: TaskId, why: string): Omit<TestResult, 'trainedUnder' | 'under'> {
    return { task: t, kind: 'notReported', claims: [], movement: null, readouts: [], text: `No result reported. ${why}` }
  }

  private result(t: TaskId, trainedUnder: Route | 'none' | null): Omit<TestResult, 'trainedUnder' | 'under'> {
    const learned = task(t).learned
    const trained = learned && trainedUnder !== null

    // --- Remove rows ---------------------------------------------------
    if (this.removed === 'dopamineClusters') {
      // §6.2.9-C11: every movement slow and hard to start, in every task.
      const readouts: Readout[] = []
      if (t === 'lever') {
        const presses = this.jitter(trained ? 3 : 1, 1, 0)
        readouts.push({ label: 'presses per minute', value: String(presses), number: presses })
      } else if (t === 'orient') {
        readouts.push({ label: 'turn toward the flash', value: 'slow to start' })
      } else if (t === 'openField') {
        readouts.push({ label: 'walking', value: 'little' }, { label: 'grooming', value: 'little' }, { label: 'exploring', value: 'little' })
      } else {
        readouts.push({ label: task(t).measured.replace(/\.$/, ''), value: null })
      }
      return {
        task: t,
        kind: 'reported',
        claims: ['§6.2.9-C11'],
        speciesNote: 'A lamprey whose dopamine is depleted; Parkinson’s disease in humans.',
        movement: 'slow',
        readouts,
        text:
          t === 'lever'
            ? 'Every movement is slow and hard to start. Lever presses fall, whatever the training.'
            : t === 'orient' || t === 'openField'
              ? 'Every movement is slow and hard to start.'
              : 'Every movement is slow and hard to start. The learned response cannot be scored cleanly, because the animal barely moves.',
      }
    }
    if (this.removed === 'pallium') {
      if (t !== 'openField') return this.grey(t, 'The chapter describes the animal without a neocortex in the open field only.')
      return {
        task: t,
        kind: 'reported',
        claims: ['§6.2.8-C22'],
        speciesNote: 'Cat, with the basal ganglia intact.',
        movement: 'normal',
        readouts: [
          { label: 'walking', value: 'continues' },
          { label: 'grooming', value: 'continues' },
          { label: 'exploring', value: 'continues' },
        ],
        text: 'Walking, grooming and exploring all continue.',
      }
    }
    if (this.removed === 'amygdala') {
      if (t !== 'toneShock' && t !== 'cueFood') return this.grey(t, 'The chapter reports the amygdala’s part in learning about threats and about rewards, and nothing about this task.')
      const untrainedLevel = t === 'toneShock' ? this.freezing(false) : this.approach(false)
      return {
        task: t,
        kind: 'reported',
        claims: ['§6.3.13-C6', '§6.3.13-C7'],
        speciesNote: 'Rat.',
        movement: 'normal',
        readouts: [untrainedLevel],
        text:
          t === 'toneShock'
            ? trained
              ? 'Freezing to the tone is not learned: the trained animal freezes no more than an untrained one.'
              : 'Untrained. Train, then test: freezing to the tone will not be learned.'
            : trained
              ? 'Approach to the light is not learned: the trained animal approaches no more than an untrained one.'
              : 'Untrained. Train, then test: approach to the light will not be learned.',
      }
    }

    // --- Silence rows (training-time) -----------------------------------
    if (learned && trainedUnder === 'dopamineFibers') {
      if (t === 'lever') {
        const presses = this.jitter(2, 1, 0)
        return {
          task: t,
          kind: 'follows',
          claims: ['§6.2.5-C8', '§6.2.5-C9', '§6.2.5-C14', '§6.2.6-C13'],
          note: 'This is what the three-systems mapping predicts. The chapter’s evidence for the mapping is reward-related activity where the pallium meets the striatum (§6.2.6-C9).',
          movement: 'normal',
          readouts: [{ label: 'presses per minute', value: String(presses), number: presses }],
          text: 'The animal moves normally at test, and presses no more than an untrained animal.',
        }
      }
      if (t === 'timedBlink') {
        return { ...this.blink(true), kind: 'follows', claims: ['#t-learning-structures', '§6.2.6-C12', '§6.2.6-C13'], text: 'The blink is learned normally.' }
      }
      return this.grey(t, 'The chapter states where the dopamine fibers deliver their signal, and says nothing about this task.')
    }
    if (learned && trainedUnder === 'climbingFibers') {
      if (t === 'timedBlink') {
        const r = this.blink(false)
        return {
          ...r,
          kind: 'reported',
          claims: ['§6.2.4-C12', '§6.2.4-C4'],
          speciesNote: 'Rabbit.',
          note: 'The learned blink is the reported result (§6.2.4-C12). That the reflex blink is unaffected follows from §6.2.4-C4: what had to be learned was when, not whether.',
          text: 'The learned, timed blink never develops. The reflex blink to the puff itself is unaffected.',
        }
      }
      if (t === 'lever') {
        const presses = this.jitter(20, 3, 0)
        return {
          task: t,
          kind: 'follows',
          claims: ['#t-learning-structures', '§6.2.6-C13'],
          movement: 'normal',
          readouts: [{ label: 'presses per minute', value: String(presses), number: presses }],
          text: 'The lever is learned normally.',
        }
      }
      return this.grey(t, 'The chapter states where the climbing fibers deliver their signal, and says nothing about this task.')
    }

    // --- Intact baseline ------------------------------------------------
    switch (t) {
      case 'orient': {
        const acc = this.jitter(92, 4, 0, 100)
        return {
          task: t,
          kind: 'follows',
          claims: task(t).claims,
          movement: 'normal',
          readouts: [{ label: 'turns toward the flash', value: `${acc}% of flashes`, number: acc }],
          text: 'The eyes and head turn toward the flash.',
        }
      }
      case 'toneShock':
        return {
          task: t,
          kind: 'follows',
          claims: task(t).claims,
          movement: 'normal',
          readouts: [this.freezing(trained)],
          text: trained ? 'The trained animal freezes to the tone.' : 'Untrained: little freezing to the tone.',
        }
      case 'cueFood':
        return {
          task: t,
          kind: 'follows',
          claims: task(t).claims,
          movement: 'normal',
          readouts: [this.approach(trained)],
          text: trained ? 'After the light, the trained animal approaches the food site.' : 'Untrained: the light is not followed by approach.',
        }
      case 'lever': {
        const presses = this.jitter(trained ? 20 : 2, trained ? 3 : 1, 0)
        return {
          task: t,
          kind: 'follows',
          claims: task(t).claims,
          movement: 'normal',
          readouts: [{ label: 'presses per minute', value: String(presses), number: presses }],
          text: trained ? 'The trained animal presses the lever.' : 'Untrained: an occasional press.',
        }
      }
      case 'timedBlink':
        return { ...this.blink(trained), kind: 'follows', claims: task(t).claims, text: trained ? 'The eye is already closed when the puff arrives.' : 'Untrained: the eye closes only when the puff lands.' }
      case 'openField':
        return {
          task: t,
          kind: 'follows',
          claims: task(t).claims,
          movement: 'normal',
          readouts: [
            { label: 'walking', value: 'yes' },
            { label: 'grooming', value: 'yes' },
            { label: 'exploring', value: 'yes' },
          ],
          text: 'The animal walks, grooms and explores.',
        }
    }
  }

  private freezing(trained: boolean): Readout {
    const v = this.jitter(trained ? 70 : 8, trained ? 8 : 4, 0, 100)
    return { label: 'freezing to the tone', value: `${v}% of the tone`, number: v }
  }

  private approach(trained: boolean): Readout {
    const v = this.jitter(trained ? 85 : 12, trained ? 6 : 5, 0, 100)
    return { label: 'approach after the light', value: `${v}% of trials`, number: v }
  }

  private blink(learned: boolean): Omit<TestResult, 'trainedUnder' | 'under' | 'kind' | 'claims' | 'text'> {
    const timed = this.jitter(learned ? 85 : 4, learned ? 6 : 3, 0, 100)
    return {
      task: 'timedBlink',
      movement: 'normal',
      readouts: [
        { label: 'eye already closed when the puff arrives', value: `${timed}% of trials`, number: timed },
        { label: 'reflex blink to the puff itself', value: '100% of trials', number: 100 },
      ],
    }
  }

  /** Stimulate a structure. The tectum takes a point from 0 (one end) to 1 (the other). */
  stimulate(s: Stimulable, opts: { task?: TaskId; point?: number } = {}): StimulateResult {
    if (s === 'periaqueductalGray') {
      return {
        target: s,
        kind: 'reported',
        claims: ['§6.3.2-C16', '§6.3.2-C17'],
        speciesNote: 'Rat.',
        text: 'The whole defensive pattern appears: freezing or fleeing, with reduced response to pain. Not a fragment of it.',
      }
    }
    if (s === 'tectum') {
      const point = Math.min(1, Math.max(0, opts.point ?? 0.5))
      const direction = Math.round(-60 + 120 * point)
      return {
        target: s,
        kind: 'follows',
        claims: ['§6.2.8-C3', '§6.2.8-C4', '§6.3.2-C4'],
        speciesNote: 'The superior colliculus in mammals (§6.3.2-C9).',
        direction,
        point,
        text: `The eyes and head turn ${direction === 0 ? 'straight ahead' : `${Math.abs(direction)}° to the ${direction < 0 ? 'left' : 'right'}`}. A neighboring point on the tectum turns them toward a neighboring place: the tectum is a topographic map.`,
      }
    }
    // dopamine clusters
    if (opts.task !== 'openField') {
      return {
        target: s,
        kind: 'notReported',
        claims: [],
        text: 'No result reported. The chapter reports what raised dopamine does in the open field, and nothing about it during this task.',
      }
    }
    return {
      target: s,
      kind: 'reported',
      claims: ['§6.2.9-C12'],
      text: 'Unwanted movements break through.',
    }
  }

  /** Record from every structure during a task. */
  record(t: TaskId): RecordCell[] {
    return RECORD_MAP.map((row) => {
      const level = row.levels[t]
      const label = BENCH_STRUCTURES.find((s) => s.id === row.structure)!.label
      const cell: RecordCell = {
        structure: row.structure,
        label,
        level,
        kind: level === null ? 'notReported' : 'follows',
        claims: level === null ? [] : row.claims,
        note: row.note,
        crossRef: row.crossRef,
      }
      if (row.structure === 'dopamineClusters' && level !== null) {
        cell.shift = { early: 'at the food, not at the cue', late: 'at the cue, not at the food' }
      }
      return cell
    })
  }
}

/** Every claim id the bench can print, for the claim test and the close-out. */
export function benchClaims(): string[] {
  const ids = new Set<string>()
  for (const row of RECORD_MAP) row.claims.forEach((c) => ids.add(c))
  for (const t of TASKS) t.claims.forEach((c) => ids.add(c))
  const b = new Bench(1)
  for (const s of REMOVE_MENU) {
    const bb = new Bench(1)
    const r = bb.remove(s.id)
    r.claims.forEach((c) => ids.add(c))
    for (const t of TASKS) {
      bb.train(t.id)
      bb.test(t.id).claims.forEach((c) => ids.add(c))
    }
  }
  for (const route of ROUTES) {
    const bb = new Bench(1)
    bb.silence = route.id
    for (const t of TASKS) {
      bb.train(t.id)
      bb.test(t.id).claims.forEach((c) => ids.add(c))
    }
  }
  for (const s of STIMULATE_MENU) b.stimulate(s.id, { task: 'openField', point: 0.5 }).claims.forEach((c) => ids.add(c))
  return [...ids].sort()
}
