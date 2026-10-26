import { makeRng, type Rng } from '../../../sim/random'
import type { ProgressStore } from '../../../sim/memory/progress/store'
import type { StudentNights } from '../../../sim/memory/logs/results'
import { FORAGERS, runForagerBlock, trainedSlowLearner, type ForagerBlock, type ForagerId } from '../../../sim/memory/foragers/foragers'
import { SEPARATIONS, type Separation } from '../../../sim/memory/foragers/store'
import { SEASON_PASSES, SlowLearner, YOUTH_PASSES, newPatterns, oldPatterns, trainInterleaved } from '../../../sim/memory/foragers/slow'
import { THINGS, type Thing } from '../../../sim/memory/foragers/world'
import type { PartStore } from '../contract'
import { clearingOf, sampleNights, studentNights } from './nights'
import { STEPS, TABLE_COLUMNS, TABLE_KEY, TABLE_ROWS, stepSpec, type Step, type StepSpec } from './steps'

/**
 * Part 5's state (spec §9): four steps, one at a time, each opening on an
 * instruction screen, each asking its predictions before the change is
 * made, with Lab 9's Go to, Go back and Redo. Every run is paid in slices
 * on a timer, one forager block or a few passes of training at a time,
 * with a badge, so that nothing synchronous over about 300 ms sits on a
 * click path. No result is computed for display before the commit.
 */

export type StepState = 'intro' | 'predict' | 'running' | 'done'

/** The snapshots of the youth: the eight things' hidden activity at these passes. */
export const YOUTH_SNAPSHOTS = [5, 20, 80, YOUTH_PASSES]
/** Passes of the youth paid per slice (about 40 ms on the development Mac). */
export const YOUTH_SLICE = 5
/** Passes of the new season paid per slice: replay off runs passes of 6 patterns, replay on passes of 30. */
export const SEASON_SLICE_OFF = 25
export const SEASON_SLICE_ON = 5

export const NOISES = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5]

export interface Snapshot {
  pass: number
  reps: Record<Thing, number[]>
}

export interface SeasonPoint {
  presentations: number
  specific: number
  all: number
}

export interface Replay {
  who: 'you' | ForagerId
  block: 0 | 1
  night: 1 | 2 | 3
}

interface Job {
  label: string
  tasks: (() => void)[]
  onDone?: () => void
}

export class LearnersStore implements PartStore {
  readonly seed: number
  readonly progress: ProgressStore
  step: Step = 1
  state: StepState = 'intro'
  readonly done: Step[] = []
  /** The predictions chosen but not yet committed, by key. */
  readonly drafts: Record<string, string> = {}
  badge = ''
  version = 0
  // Step 1
  foragerRuns: Record<ForagerId, ForagerBlock[]> | null = null
  replay: Replay = { who: 'tonight', block: 0, night: 1 }
  // Step 2
  separation: Separation = 'weak'
  storeRuns: Partial<Record<Separation, ForagerBlock[]>> = {}
  cue: { block: 0 | 1; night: 2 | 3 } = { block: 0, night: 2 }
  // Step 3
  youthNet: SlowLearner | null = null
  youthPass = 0
  snapshots: Snapshot[] = []
  season: { off: SeasonPoint[]; on: SeasonPoint[] } = { off: [], on: [] }
  // Step 4
  noStoreRuns: ForagerBlock[] | null = null
  usualRuns: ForagerBlock[] | null = null
  intactRuns: ForagerBlock[] | null = null
  noise = 0
  noisyRuns: { noise: number; blocks: ForagerBlock[] } | null = null
  readonly tableDraft: Record<string, string> = {}
  private youthOrder: Rng | null = null
  private readonly queue: Job[] = []
  private busy = false
  private listeners = new Set<() => void>()

  constructor(seed: number, progress: ProgressStore) {
    this.seed = seed
    this.progress = progress
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  changed(): void {
    this.version++
    for (const fn of this.listeners) fn()
  }

  get spec(): StepSpec {
    return stepSpec(this.step)
  }

  /** The student's own nights, or the sample set once chosen, or null while Part 4 is unfinished and no sample is in use. */
  nights(): StudentNights | null {
    const own = studentNights(this.progress, this.seed)
    if (own) return own
    return this.progress.state.sampleNights ? sampleNights() : null
  }

  /** Any step may be opened (Lab 9's rule); a finished one reopens to its result. */
  canOpen(_s: Step): boolean {
    return true
  }

  open(s: Step): void {
    this.step = s
    this.state = this.done.includes(s) ? 'done' : 'intro'
    this.changed()
  }

  begin(): void {
    if (this.state !== 'intro') return
    this.state = this.allCommitted(this.step) ? 'running' : 'predict'
    this.changed()
  }

  /** Redo the step: it opens on its instruction screen again; its predictions, once committed, stay committed. */
  redo(): void {
    const i = this.done.indexOf(this.step)
    if (i >= 0) this.done.splice(i, 1)
    this.state = 'intro'
    this.changed()
  }

  finish(): void {
    if (this.state !== 'running') return
    if (!this.done.includes(this.step)) this.done.push(this.step)
    this.state = 'done'
    this.changed()
  }

  allCommitted(s: Step): boolean {
    return STEPS[s - 1].predictions.every((p) => this.progress.prediction(p.key) !== null)
  }

  choose(key: string, value: string): void {
    this.drafts[key] = value
    this.changed()
  }

  canCommit(): boolean {
    return this.spec.predictions.every((p) => this.drafts[p.key] || this.progress.prediction(p.key))
  }

  /** Commit the step's predictions: written once, never overwritten. Then the step runs. */
  commitPredictions(): void {
    if (this.state !== 'predict' || !this.canCommit()) return
    for (const p of this.spec.predictions) if (this.drafts[p.key]) this.progress.commitPrediction(p.key, this.drafts[p.key])
    this.state = 'running'
    this.changed()
  }

  prediction(key: string): string | null {
    return this.progress.prediction(key)
  }

  // ---------------------------------------------------------------- the queue

  /** Queue a labeled job of tasks, paid one per timer tick with a badge. */
  private enqueue(label: string, tasks: (() => void)[], onDone?: () => void): void {
    this.queue.push({ label, tasks, onDone })
    if (!this.busy) this.pump()
  }

  private pump(): void {
    const job = this.queue[0]
    if (!job) {
      this.busy = false
      this.badge = ''
      this.changed()
      return
    }
    this.busy = true
    const task = job.tasks.shift()
    if (task) {
      task()
      this.badge = `${job.label} — ${job.tasks.length} to go`
      this.changed()
      setTimeout(() => this.pump(), 0)
      return
    }
    this.queue.shift()
    job.onDone?.()
    setTimeout(() => this.pump(), 0)
  }

  get running(): boolean {
    return this.busy
  }

  /** Drain every queued task now (tests). */
  payAll(): void {
    while (this.queue.length) {
      const job = this.queue.shift()!
      for (const t of job.tasks) t()
      job.onDone?.()
    }
    this.busy = false
    this.badge = ''
    this.changed()
  }

  // ---------------------------------------------------------------- Step 1

  private blockRuns(id: ForagerId, damage: { noStore?: boolean; slowNoise?: number } = {}, separation?: Separation): { tasks: (() => void)[]; out: ForagerBlock[] } {
    const nights = this.nights()
    const out: ForagerBlock[] = []
    if (!nights) return { tasks: [], out }
    const tasks = ([0, 1] as const).map((i) => () => {
      out[i] = runForagerBlock(id, nights.seed, nights.blocks[i].plan, clearingOf(nights, i), damage, separation)
    })
    return { tasks, out }
  }

  /** Run the four foragers on the student's nights, one forager block per tick. */
  runForagers(): void {
    if (this.state !== 'running' || !this.nights()) return
    const runs = {} as Record<ForagerId, ForagerBlock[]>
    const tasks: (() => void)[] = []
    for (const f of FORAGERS) {
      const r = this.blockRuns(f.id)
      runs[f.id] = r.out
      tasks.push(...r.tasks)
    }
    this.enqueue('Running the foragers', tasks, () => {
      this.foragerRuns = runs
      this.intactRuns = runs.tonight
      this.usualRuns = runs.usual
    })
  }

  setReplay(r: Partial<Replay>): void {
    this.replay = { ...this.replay, ...r }
    this.changed()
  }

  // ---------------------------------------------------------------- Step 2

  setSeparation(s: Separation): void {
    this.separation = s
    this.changed()
  }

  setCue(c: Partial<{ block: 0 | 1; night: 2 | 3 }>): void {
    this.cue = { ...this.cue, ...c }
    this.changed()
  }

  /** Run the store on both blocks at the three settings. */
  runStore(): void {
    if (this.state !== 'running' || !this.nights()) return
    const tasks: (() => void)[] = []
    const outs: Partial<Record<Separation, ForagerBlock[]>> = {}
    for (const sep of SEPARATIONS) {
      const r = this.blockRuns('tonight', {}, sep)
      outs[sep] = r.out
      tasks.push(...r.tasks)
    }
    this.enqueue('Running the store at every setting', tasks, () => {
      this.storeRuns = outs
    })
  }

  // ---------------------------------------------------------------- Step 3

  /** A fresh slow learner from the seed's stream, as `trainedSlowLearner` builds it, so the youth here is the same youth. */
  private freshYouth(): void {
    const rng = makeRng(this.seed ^ 0x510)
    this.youthNet = new SlowLearner(rng.fork())
    this.youthOrder = rng.fork()
    this.youthPass = 0
    this.snapshots = []
  }

  get youthDone(): boolean {
    return this.youthPass >= YOUTH_PASSES
  }

  /** Skip ahead through the youth, a few passes a tick, with snapshots of the hidden-activity space on the way. */
  skipYouth(): void {
    if (this.state !== 'running') return
    if (!this.youthNet || this.youthDone) this.freshYouth()
    const tasks: (() => void)[] = []
    while (tasks.length * YOUTH_SLICE < YOUTH_PASSES) {
      tasks.push(() => {
        const net = this.youthNet!
        trainInterleaved(net, oldPatterns(), YOUTH_SLICE, this.youthOrder!)
        this.youthPass += YOUTH_SLICE
        if (YOUTH_SNAPSHOTS.includes(this.youthPass)) this.snapshots.push({ pass: this.youthPass, reps: Object.fromEntries(THINGS.map((t) => [t, net.representation(t)])) as Record<Thing, number[]> })
      })
    }
    this.enqueue('Skipping ahead through the youth', tasks)
  }

  /** The trained slow learner the new season and the damage start from: the youth run here when it is done, else the seed's. */
  private trainedNet(): SlowLearner {
    return this.youthNet && this.youthDone ? this.youthNet : trainedSlowLearner(this.seed)
  }

  /** Train on the new season, with replay off (the new things alone) or on (interleaved with the old), paid in slices, recording the old things' properties still right. */
  trainSeason(mode: 'off' | 'on'): void {
    if (this.state !== 'running') return
    const net = new SlowLearner(makeRng(1))
    net.copyFrom(this.trainedNet())
    const order = makeRng(this.seed ^ (mode === 'off' ? 0x0ff : 0x0a1))
    const season = newPatterns()
    const patterns = mode === 'off' ? season : [...oldPatterns(), ...season]
    const slice = mode === 'off' ? SEASON_SLICE_OFF : SEASON_SLICE_ON
    const totalPresentations = SEASON_PASSES * season.length
    const passes = Math.round(totalPresentations / patterns.length)
    const points: SeasonPoint[] = []
    const record = (presentations: number) => {
      const specific = net.kept(THINGS, 'specific')
      const all = (net.kept(THINGS, 'general') + net.kept(THINGS, 'middle') + specific) / 3
      points.push({ presentations, specific, all })
    }
    record(0)
    const tasks: (() => void)[] = []
    let done = 0
    while (done < passes) {
      const n = Math.min(slice, passes - done)
      done += n
      const at = done
      tasks.push(() => {
        trainInterleaved(net, patterns, n, order)
        record(at * patterns.length)
      })
    }
    this.season = { ...this.season, [mode]: [] }
    this.enqueue(mode === 'off' ? 'Training on the new season, replay off' : 'Training on the new season, replay on', tasks, () => {
      this.season = { ...this.season, [mode]: points }
    })
  }

  // ---------------------------------------------------------------- Step 4

  /** Remove the fast store: Tonight too without it, beside the intact forager and Usual only. */
  removeStore(): void {
    if (this.state !== 'running' || !this.nights()) return
    const tasks: (() => void)[] = []
    const no = this.blockRuns('tonight', { noStore: true })
    tasks.push(...no.tasks)
    let intact = this.intactRuns
    let usual = this.usualRuns
    if (!intact) {
      const r = this.blockRuns('tonight')
      intact = r.out
      tasks.push(...r.tasks)
    }
    if (!usual) {
      const r = this.blockRuns('usual')
      usual = r.out
      tasks.push(...r.tasks)
    }
    this.enqueue('Running Tonight too without its store', tasks, () => {
      this.noStoreRuns = no.out
      this.intactRuns = intact
      this.usualRuns = usual
    })
  }

  setNoise(n: number): void {
    this.noise = n
    this.changed()
  }

  /** The property table and the kept lines as the damaged network answers now, read with the damage set and then reset. */
  damagedReading(): { table: number[][]; kept: { general: number; middle: number; specific: number } } {
    const net = this.trainedNet()
    net.damage = { noise: this.noise }
    const table = net.table(THINGS, 20)
    const kept = { general: net.kept(THINGS, 'general', 20), middle: net.kept(THINGS, 'middle', 20), specific: net.kept(THINGS, 'specific', 20) }
    net.damage = { noise: 0 }
    return { table, kept }
  }

  /** Run Tonight too with the slow learner damaged at the slider's noise. */
  runDamaged(): void {
    if (this.state !== 'running' || !this.nights()) return
    const noise = this.noise
    const r = this.blockRuns('tonight', { slowNoise: noise })
    const tasks = [...r.tasks]
    let intact = this.intactRuns
    if (!intact) {
      const i = this.blockRuns('tonight')
      intact = i.out
      tasks.push(...i.tasks)
    }
    this.enqueue('Running Tonight too with the slow learner damaged', tasks, () => {
      this.noisyRuns = { noise, blocks: r.out }
      this.intactRuns = intact
    })
  }

  chooseCell(row: string, column: string, value: string): void {
    this.tableDraft[`${row}|${column}`] = value
    this.changed()
  }

  get tableComplete(): boolean {
    return TABLE_ROWS.every((r) => TABLE_COLUMNS.every((c) => this.tableDraft[`${r}|${c}`]))
  }

  get tableCommitted(): string | null {
    return this.progress.prediction(TABLE_KEY)
  }

  commitTable(): void {
    if (!this.tableComplete || this.tableCommitted) return
    this.progress.commitPrediction(TABLE_KEY, TABLE_ROWS.map((r) => TABLE_COLUMNS.map((c) => this.tableDraft[`${r}|${c}`]).join('|')).join('||'))
    this.changed()
  }

  /** The measured two-by-two table: each lesion's totals over both blocks against the intact forager's. */
  measuredTable(): { rows: { damage: string; emptiedLast: number; smooth: number; verdict: [string, string] }[]; intact: { emptiedLast: number; smooth: number } } | null {
    if (!this.intactRuns || !this.noStoreRuns || !this.noisyRuns) return null
    const sum = (runs: ForagerBlock[]) => ({
      emptiedLast: runs.reduce((a, b) => a + b.tallies.slice(1).reduce((x, t) => x + t.digsAtEmptiedLastNight, 0), 0),
      smooth: runs.reduce((a, b) => a + b.tallies.reduce((x, t) => x + t.digsAtSmooth, 0), 0),
    })
    const intact = sum(this.intactRuns)
    const verdict = (v: number, base: number) => (v >= base + 1 ? 'rises' : 'stays low')
    const rows = [
      { damage: TABLE_ROWS[0], ...sum(this.noStoreRuns) },
      { damage: TABLE_ROWS[1], ...sum(this.noisyRuns.blocks) },
    ].map((r) => ({ ...r, verdict: [verdict(r.emptiedLast, intact.emptiedLast), verdict(r.smooth, intact.smooth)] as [string, string] }))
    return { rows, intact }
  }
}
