import type { ProgressStore } from '../../../sim/social/progress/store'
import { unitOfMatch } from '../../../sim/social/parts'
import { planPart1, ABOUT_ROUNDS } from '../../../sim/social/game/plan'
import { makeRng } from '../../../sim/random'
import { RULES, buildRule, matchesPartner, DEFAULT_CHIPS, GENEROSITY, RULE_NAMES, type Chips, type Generosity, type MemoryOneRule, type Move } from '../../../sim/social/game/rules'
import { headToHead, twoRuleRoundRobin, populationCurve, populationThreshold, TWO_RULES_ROUNDS, type HeadToHead, type TwoRuleRoundRobin, type PopulationPoint } from '../../../sim/social/game/tworules'
import { roundRobin, predictorVersus, playerOf, entryId, entryLabel, type Entry, type RoundRobin, type PredictorVersus } from '../../../sim/social/game/tournament'
import { playMatch, type Round } from '../../../sim/social/game/match'
import { runGenerations, costAtWhichEntryStops, costsFor, MEMORY_COSTS, type GenerationsRun } from '../../../sim/social/game/generations'
import { Grid, SHIPPED_GRID, MUTATIONS, startWorldsFor, type StartWorld, type GridRule, type GridBoundary } from '../../../sim/social/game/grid'
import type { PartStore } from '../contract'
import { STEPS, stepSpec, type Step, type StepSpec } from './steps'
import type { MatchResult } from '../partners/partnersStore'

/**
 * Part 2's state (spec §6): seven steps, one at a time, each opening on an
 * instruction screen, each asking its predictions before anything runs,
 * with Lab 9's Go to, Go back and Redo. Runs that play matches (Predictor's)
 * are paid in slices on a timer with a badge, so that nothing synchronous
 * over about 300 ms sits on a click path; the grid runs on its own timer,
 * and Skip ahead pays 1,000 generations in slices. No result is computed
 * for display before the commit.
 *
 * Jon's Part 2 pass (2026-11-02): Steps 4 and 5 can be run again, each
 * run on new seeds; Step 3 shows any entry's record round by round; Step 6
 * charges every entry for its memory; Step 7 runs any set of the entries
 * on a wrapping or a bounded grid, with a box for what the student sees.
 */

export type StepState = 'intro' | 'predict' | 'running' | 'done'
export const NOISES = [0, 0.01, 0.05, 0.1] as const
export const RULE_SETTING = 'p2-rule'
export const GRID_NOTES_SETTING = 'p2-grid-notes'
export const GRID_NOTES_CAP = 1500
export const GRID_SPEEDS = { slow: 2, normal: 10, fast: 20 } as const
export type GridSpeed = keyof typeof GRID_SPEEDS
export const SKIP_GENERATIONS = 1000
/** Generations paid per timer tick while skipping ahead: about 10 ms at 40 × 40. */
export const SKIP_SLICE = 50
export const HISTORY_CAP = 2000
/** The entries the grid starts with: the spec's three. */
export const DEFAULT_GRID_IDS = ['allc', 'alld', 'tft']
/** Every entry the grid can hold, in the order of the key. */
export const GRID_ENTRY_IDS = [...RULES.map((r) => r.id), 'mine', 'predictor'] as const

interface Job {
  label: string
  tasks: (() => void)[]
  onDone?: () => void
}

export interface StudentVersus {
  partner: string
  rounds: number
  student: { points: number; share: number; correct: number; shareOfBest: number } | null
  predictor: { points: number; share: number; correct: number; shareOfBest: number }
}

/** One entry's match against another in the round-robin, round by round (Step 3). */
export interface EntryRecord {
  against: string
  rounds: Round[]
  mine: number
  theirs: number
  /** Points per round from the table, the exact value the match realizes in expectation. */
  tableMean: number
}

export function serializeChips(c: Chips): string {
  return [c.first, c.CC, c.CD, c.DC, c.DD, String(c.generosity)].join(',')
}

export function parseChips(s: string | null): Chips {
  if (!s) return { ...DEFAULT_CHIPS }
  const p = s.split(',')
  if (p.length !== 6) return { ...DEFAULT_CHIPS }
  const m = (x: string): Move => (x === 'D' ? 'D' : 'C')
  const g = GENEROSITY.find((v) => String(v) === p[5]) ?? 0
  return { first: m(p[0]), CC: m(p[1]), CD: m(p[2]), DC: m(p[3]), DD: m(p[4]), generosity: g as Generosity }
}

export class TournamentStore implements PartStore {
  readonly seed: number
  readonly progress: ProgressStore
  step: Step = 1
  state: StepState = 'intro'
  readonly done: Step[] = []
  readonly drafts: Record<string, string> = {}
  badge = ''
  version = 0
  // Step 1
  rounds = 10
  share = 0.3
  // Step 2
  chips: Chips
  ruleName: (typeof RULE_NAMES)[number] = 'My rule'
  // Step 3
  rr3: RoundRobin | null = null
  recordEntry: number | null = null
  // Step 4
  rr4: RoundRobin | null = null
  versus: PredictorVersus[] = []
  studentVersus: StudentVersus[] = []
  estimatesFor = 0
  /** How many times Step 4 has been run: each run plays on new seeds. */
  runs4 = 0
  // Step 5
  noise: (typeof NOISES)[number] = 0.05
  rr5: RoundRobin | null = null
  runs5 = 0
  // Step 6
  gen: { clean: GenerationsRun; noisy: GenerationsRun; cleanRR: RoundRobin; noisyRR: RoundRobin } | null = null
  /** The cost per stored number per round. */
  cost: (typeof MEMORY_COSTS)[number] = 0
  costStop: { predictor: { clean: number | null; noisy: number | null }; tft: { clean: number | null; noisy: number | null } } | null = null
  // Step 7
  grid: Grid | null = null
  gridIds: string[] = [...DEFAULT_GRID_IDS]
  world: StartWorld = 'tft'
  mutation: (typeof MUTATIONS)[number] = 0.002
  boundary: GridBoundary = SHIPPED_GRID.boundary
  speed: GridSpeed = 'normal'
  running = false
  skipping = 0
  history: number[][] = []
  gridNotes = ''
  private gridTimer: ReturnType<typeof setInterval> | null = null
  private carry = 0
  private readonly queue: Job[] = []
  private busy = false
  private listeners = new Set<() => void>()

  constructor(seed: number, progress: ProgressStore) {
    this.seed = seed
    this.progress = progress
    this.chips = parseChips(progress.setting(RULE_SETTING))
    const name = progress.setting('p2-rule-name')
    if (name === 'My rule 2') this.ruleName = 'My rule 2'
    this.gridNotes = (progress.setting(GRID_NOTES_SETTING) ?? '').slice(0, GRID_NOTES_CAP)
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

  // --------------------------------------------------------------- steps

  open(s: Step): void {
    this.stopGrid()
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
    this.stopGrid()
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

  commitPredictions(): void {
    if (this.state !== 'predict' || !this.canCommit()) return
    for (const p of this.spec.predictions) if (this.drafts[p.key]) this.progress.commitPrediction(p.key, this.drafts[p.key])
    this.state = 'running'
    this.changed()
  }

  prediction(key: string): string | null {
    return this.progress.prediction(key)
  }

  // --------------------------------------------------------------- the queue

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

  get working(): boolean {
    return this.busy
  }

  // --------------------------------------------------------------- Step 1

  setRounds(r: number): void {
    this.rounds = r
    this.changed()
  }

  setShare(x: number): void {
    this.share = x
    this.changed()
  }

  twoRules(): { one: HeadToHead; match: HeadToHead; rr: TwoRuleRoundRobin; curve: PopulationPoint[]; threshold: number | null; at: PopulationPoint; rounds: readonly number[] } {
    return { one: headToHead(1), match: headToHead(this.rounds), rr: twoRuleRoundRobin(this.rounds), curve: populationCurve(this.rounds), threshold: populationThreshold(this.rounds), at: populationCurve(this.rounds, 100)[Math.round(this.share * 100)], rounds: TWO_RULES_ROUNDS }
  }

  // --------------------------------------------------------------- Step 2

  setChip<K extends keyof Chips>(k: K, v: Chips[K]): void {
    this.chips = { ...this.chips, [k]: v }
    this.progress.setSetting(RULE_SETTING, serializeChips(this.chips))
    this.invalidateRuns()
    this.changed()
  }

  setRuleName(n: (typeof RULE_NAMES)[number]): void {
    this.ruleName = n
    this.progress.setSetting('p2-rule-name', n)
    this.changed()
  }

  myRule(): MemoryOneRule {
    return buildRule(this.chips, this.ruleName)
  }

  matches(): string | null {
    return matchesPartner(this.myRule())?.label ?? null
  }

  /** A rebuilt rule changes every later step's field, so their results are dropped until run again. */
  private invalidateRuns(): void {
    this.rr3 = null
    this.recordEntry = null
    this.rr4 = null
    this.rr5 = null
    this.versus = []
    this.gen = null
    this.costStop = null
    this.stopGrid()
    this.grid = null
    this.history = []
  }

  // --------------------------------------------------------------- Steps 3 to 6

  entries(withPredictor: boolean): Entry[] {
    const e: Entry[] = [...RULES.map((rule) => ({ kind: 'rule' as const, rule })), { kind: 'rule', rule: this.myRule() }]
    if (withPredictor) e.push({ kind: 'predictor' })
    return e
  }

  runRoundRobin(): void {
    this.rr3 = roundRobin(this.entries(false), 0)
    this.recordEntry = null
    this.changed()
  }

  setRecordEntry(i: number | null): void {
    this.recordEntry = i
    this.changed()
  }

  /**
   * Step 3's record for one entry: its match against every entry, round by
   * round, with the running points. Two deterministic rules with no noise
   * play the one match the table's exact value describes; a rule with
   * generosity, Predictor, or any match with mistakes (Step 5, at its noise;
   * added 2026-11-08 for the handout's Q14) draws its moves, so its record is
   * one realized match of the many the table's value averages, played on
   * the run seed.
   */
  recordsFor(i: number, step: 3 | 5 = 3): EntryRecord[] {
    const rr = step === 3 ? this.rr3 : this.rr5
    if (!rr) return []
    const a = rr.entries[i]
    return rr.entries.map((b, j) => {
      // Step 3's matches between two rules are the table's exact value; every other match here is one realized match on the run seed.
      const m = playMatch(playerOf(a), playerOf(b), rr.rounds, rr.noise, makeRng(this.seed * 31 + i * 7 + j + step * 1009))
      return { against: entryLabel(b), rounds: m.rounds, mine: m.totalA, theirs: m.totalB, tableMean: rr.table[i][j].mean }
    })
  }

  runWithPredictor(): void {
    if (this.working) return
    const run = this.runs4++
    const seedBase = 5000 + run * 1013
    const tasks: (() => void)[] = []
    tasks.push(() => {
      this.rr4 = roundRobin(this.entries(true), 0, undefined, undefined, seedBase)
    })
    const versus: PredictorVersus[] = []
    for (const rule of RULES) tasks.push(() => versus.push(predictorVersus(rule, 200, 0, undefined, {}, 9000 + run * 1013)))
    tasks.push(() => {
      this.versus = versus
      this.studentVersus = this.compareWithStudent(12000 + run * 1013)
      this.gen = null
      this.costStop = null
    })
    this.enqueue('Playing Predictor’s matches', tasks)
  }

  /** The student's Part 1 results beside Predictor's over matches of the same lengths (§6.4). */
  private compareWithStudent(seedBase: number): StudentVersus[] {
    const out: StudentVersus[] = []
    const played = this.progress.partComplete(1)
    const plan = played ? planPart1(this.seed) : null
    for (const rule of RULES) {
      let rounds = ABOUT_ROUNDS
      let student: StudentVersus['student'] = null
      if (plan) {
        const idx = plan.rules.indexOf(rule.id)
        const m = this.progress.result(unitOfMatch(idx)) as MatchResult
        rounds = m.rounds.length
        const pts = m.rounds.reduce((a, r) => a + r.studentPoints, 0)
        const correct = m.rounds.filter((r) => r.predicted === r.partner).length
        const v = predictorVersus(rule, rounds, 0, 50, {}, seedBase)
        student = { points: pts, share: correct / rounds, correct, shareOfBest: pts / v.best }
        out.push({ partner: rule.label, rounds, student, predictor: { points: v.points.mean, share: v.predictionsShare, correct: v.predictionsCorrect.mean, shareOfBest: v.shareOfBest } })
      } else {
        const v = predictorVersus(rule, rounds, 0, 50, {}, seedBase)
        out.push({ partner: rule.label, rounds, student: null, predictor: { points: v.points.mean, share: v.predictionsShare, correct: v.predictionsCorrect.mean, shareOfBest: v.shareOfBest } })
      }
    }
    return out
  }

  setEstimatesFor(i: number): void {
    this.estimatesFor = i
    this.changed()
  }

  setNoise(n: (typeof NOISES)[number]): void {
    this.noise = n
    this.rr5 = null
    this.gen = null
    this.costStop = null
    this.stopGrid()
    this.grid = null
    this.history = []
    this.changed()
  }

  runWithNoise(): void {
    if (this.working) return
    const run = this.runs5++
    this.enqueue('Playing the matches with mistakes', [
      () => {
        this.rr5 = roundRobin(this.entries(true), this.noise, undefined, undefined, 5000 + run * 1013)
        this.recordEntry = null
        this.gen = null
        this.costStop = null
      },
    ])
  }

  runGenerationsNow(): void {
    if (this.working) return
    this.enqueue('Running the generations', [
      () => {
        const cleanRR = this.rr4 ?? roundRobin(this.entries(true), 0)
        const noisyRR = this.rr5 && this.rr5.noise === this.noise ? this.rr5 : roundRobin(this.entries(true), this.noise)
        this.rr4 = cleanRR
        this.rr5 = noisyRR
        this.gen = { cleanRR, noisyRR, clean: runGenerations(cleanRR, costsFor(cleanRR, this.cost)), noisy: runGenerations(noisyRR, costsFor(noisyRR, this.cost)) }
        const pi = cleanRR.entries.findIndex((e) => e.kind === 'predictor')
        const ti = cleanRR.entries.findIndex((e) => entryId(e) === 'tft')
        this.costStop = {
          predictor: { clean: costAtWhichEntryStops(cleanRR, pi).cost, noisy: costAtWhichEntryStops(noisyRR, pi).cost },
          tft: { clean: costAtWhichEntryStops(cleanRR, ti).cost, noisy: costAtWhichEntryStops(noisyRR, ti).cost },
        }
      },
    ])
  }

  setCost(c: (typeof MEMORY_COSTS)[number]): void {
    this.cost = c
    if (this.gen) {
      this.gen = { ...this.gen, clean: runGenerations(this.gen.cleanRR, costsFor(this.gen.cleanRR, c)), noisy: runGenerations(this.gen.noisyRR, costsFor(this.gen.noisyRR, c)) }
    }
    this.changed()
  }

  // --------------------------------------------------------------- Step 7

  gridSettings() {
    return { ...SHIPPED_GRID, noise: this.noise, mutation: this.mutation, boundary: this.boundary }
  }

  /** The entries the grid holds, in the key's order. */
  gridEntries(): Entry[] {
    return this.entries(true).filter((e) => this.gridIds.includes(entryId(e)))
  }

  /** The start worlds for the current entries: all of each, then mixed. */
  worlds(): { id: StartWorld; label: string }[] {
    return startWorldsFor(this.gridEntries())
  }

  /** Check or uncheck an entry; at least two stay checked. A change drops the grid. */
  toggleGridId(id: string): void {
    if (!(GRID_ENTRY_IDS as readonly string[]).includes(id)) return
    if (this.gridIds.includes(id)) {
      if (this.gridIds.length <= 2) return
      this.gridIds = this.gridIds.filter((x) => x !== id)
    } else this.gridIds = [...this.gridIds, id]
    if (this.world !== 'mixed' && !this.gridIds.includes(this.world)) this.world = 'mixed'
    this.resetGrid()
  }

  private resetGrid(): void {
    this.stopGrid()
    this.grid = null
    this.history = []
    this.changed()
  }

  setWorld(w: StartWorld): void {
    this.world = w
    this.resetGrid()
  }

  setMutation(m: (typeof MUTATIONS)[number]): void {
    this.mutation = m
    this.resetGrid()
  }

  setBoundary(b: GridBoundary): void {
    this.boundary = b
    this.resetGrid()
  }

  setSpeed(s: GridSpeed): void {
    this.speed = s
    this.changed()
  }

  setGridNotes(t: string): void {
    this.gridNotes = t.slice(0, GRID_NOTES_CAP)
    this.progress.setSetting(GRID_NOTES_SETTING, this.gridNotes)
    this.changed()
  }

  startGrid(): void {
    const g = new Grid(this.gridSettings(), this.seed ^ (this.world.length * 977) ^ Math.round(this.mutation * 1e5) ^ (this.boundary === 'bounded' ? 4099 : 0), this.gridEntries())
    g.start(this.world)
    this.grid = g
    this.history = [g.shares()]
    this.changed()
  }

  runGrid(): void {
    if (!this.grid) this.startGrid()
    if (this.running) return
    this.running = true
    this.carry = 0
    this.gridTimer = setInterval(() => this.gridTick(), 50)
    this.changed()
  }

  pauseGrid(): void {
    this.running = false
    if (this.gridTimer) clearInterval(this.gridTimer)
    this.gridTimer = null
    this.changed()
  }

  private stopGrid(): void {
    this.pauseGrid()
    this.skipping = 0
  }

  private gridTick(): void {
    if (!this.grid) return
    if (this.skipping > 0) {
      const n = Math.min(SKIP_SLICE, this.skipping)
      for (let i = 0; i < n; i++) this.stepGrid()
      this.skipping -= n
      this.badge = this.skipping > 0 ? `Skipping ahead — ${this.skipping} generations to go` : ''
      if (this.skipping === 0 && !this.running) {
        if (this.gridTimer) clearInterval(this.gridTimer)
        this.gridTimer = null
      }
      this.changed()
      return
    }
    this.carry += GRID_SPEEDS[this.speed] * 0.05
    while (this.carry >= 1) {
      this.carry -= 1
      this.stepGrid()
    }
    this.changed()
  }

  private stepGrid(): void {
    const g = this.grid!
    g.step()
    this.history.push(g.shares())
    if (this.history.length > HISTORY_CAP) this.history.splice(0, this.history.length - HISTORY_CAP)
  }

  /** Skip ahead 1,000 generations, paid in slices on the timer. */
  skipAhead(): void {
    if (!this.grid) this.startGrid()
    this.skipping += SKIP_GENERATIONS
    if (!this.gridTimer) this.gridTimer = setInterval(() => this.gridTick(), 50)
    this.changed()
  }

  /** Tit-for-tat is in the grid, so a block of it can be dropped. */
  canDropBlock(): boolean {
    return this.gridIds.includes('tft')
  }

  dropBlock(side: 2 | 3): void {
    if (!this.canDropBlock()) return
    if (!this.grid) this.startGrid()
    this.grid!.dropBlock(side)
    this.history.push(this.grid!.shares())
    this.changed()
  }

  private tableCache: { key: string; table: number[][] } | null = null

  /** The encounter table for the current entries and noise: the grid's own once it exists, else computed once for the panel. */
  encounterTable(): number[][] {
    if (this.grid) return this.grid.table
    const key = `${this.noise}|${this.gridIds.join()}|${serializeChips(this.chips)}`
    if (!this.tableCache || this.tableCache.key !== key) this.tableCache = { key, table: new Grid(this.gridSettings(), 0, this.gridEntries()).table }
    return this.tableCache.table
  }

  changes() {
    return this.grid?.changes() ?? []
  }

  commonest(): GridRule | null {
    return this.grid ? this.grid.commonest() : null
  }
}
