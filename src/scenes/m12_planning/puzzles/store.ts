import { makeRng, type Rng } from '../../../sim/random'
import type { ProgressStore } from '../../../sim/planning/progress/store'
import type { UnitId } from '../../../sim/planning/parts'
import { applyMove, goalArrangement, idOf, illegalBecause, isGoal, scrambled, startArrangement, stateGraph, topDisk, type Arrangement, type Move, type Peg } from '../../../sim/planning/puzzles/hanoi'
import { PROCEDURE_IDS, runProcedure, type ProcedureId, type Run } from '../../../sim/planning/puzzles/procedures'
import { treeSet, bestPath, LOOK_COST, N_NODES, childrenOf, stepOf, PRACTICE_TREES, SCORED_TREES, type Tree, type TreeSet } from '../../../sim/planning/puzzles/trees'
import { runLooker, LOOKER_IDS, type LookerId, type LookerRun } from '../../../sim/planning/puzzles/lookers'
import type { PartStore } from '../contract'
import { PROCEDURE_PREDICTIONS, type Step } from './screens'

/**
 * Part 2's state (spec §6): Step 1, two puzzles as two units, each
 * restarted from the start if interrupted; Step 2, an exploration of five
 * procedures walked one at a time in the middle of the screen, each read,
 * predicted, then run at any setting (Jon's walk, 2026-11-11); Step 3, the
 * trees as one resuming unit, with the three lookers run on the student's
 * own trees after the last choice.
 */

export type StepState = 'intro' | 'running' | 'done'

export const TOWER_UNIT = (disks: 3 | 4): UnitId => (disks === 3 ? 'p2-tower-3' : 'p2-tower-4')
export const TREES_UNIT: UnitId = 'p2-trees'

export interface TowerResult {
  disks: 3 | 4
  moves: Move[]
  /** Seconds from Begin to each move. */
  times: number[]
  /** The ids of every arrangement passed through, start first. */
  path: number[]
  illegalAttempts: number
  firstMoveSeconds: number
  totalSeconds: number
  restarts: number
}

export interface TreeRecord {
  tree: Tree
  /** The nodes uncovered, in order. */
  looks: number[]
  path: [number, number, number]
  /** Points: the path's sum minus the looks. */
  net: number
  scored: boolean
}

export interface TreesPartial {
  records: TreeRecord[]
  /** Index into the sequence of trees (practice then scored) now on screen. */
  index: number
  /** Whether the tree at `index` had been shown when the sitting was interrupted (so a reserve replaces it). */
  shown: boolean
  /** Which reserve trees have been used. */
  reserveUsed: number[]
  /** Replacements made: index → reserve index. */
  swaps: Record<number, number>
  restarts: number
}

export interface TreesResult {
  records: TreeRecord[]
  lookers: Record<LookerId, LookerRun[]>
  restarts: number
}

export class PuzzlesStore implements PartStore {
  readonly seed: number
  readonly progress: ProgressStore
  step: Step = 1
  version = 0
  private listeners = new Set<() => void>()
  private opened = new Set<Step>()

  // Step 1
  disks: 3 | 4 = 3
  arrangement: Arrangement = startArrangement(3)
  lifted: Peg | null = null
  moves: Move[] = []
  times: number[] = []
  path: number[] = []
  illegalAttempts = 0
  refusal: string | null = null
  private towerStart = 0
  /**
   * A replay of the tower after its reveal, not recorded (Jon's walk,
   * 2026-11-11: students may want to try for fewer moves once they have seen
   * the state graph). The saved result stays the first attempt; a replay
   * writes nothing to the record.
   */
  replay: { disks: 3 | 4 } | null = null

  // Step 2
  procDisks = 3
  start: 'usual' | 'scramble' = 'usual'
  scramble: Arrangement
  speed = 4
  runs: Partial<Record<ProcedureId, Run>> = {}
  /** The most recent scrambled-start run per procedure, and the n+1 run. */
  scrambledRuns: Partial<Record<ProcedureId, Run>> = {}
  transferRuns: Partial<Record<ProcedureId, Run>> = {}
  /**
   * The run on view: the most recent run, its index into its states, and
   * whether it is still animating. A finished run stays on view, pegs at its
   * last arrangement and its whole path on the graph, until the next Run or
   * a change of Disks or Start (Jon's walk, 2026-11-10: the first build
   * dropped the run the moment it ended, and the pegs fell back to another
   * stored run's end, chosen by menu order).
   */
  onView: { run: Run; index: number; playing: boolean } | null = null
  draft: Partial<Record<ProcedureId, string>> = {}
  /**
   * The walk through the procedures (Jon's walk, 2026-11-11: the first build
   * put five Run buttons, the sliders and the prediction box in the left
   * column and the descriptions in the right, which scattered what the
   * student needed). One procedure is on view at a time, in PROCEDURE_IDS
   * order; it opens at the first procedure not yet predicted, so a student
   * who left picks up where they were, and the row of names goes anywhere.
   */
  tourIndex = 0
  /** The procedures run at least once this session; “Go on” waits for a run. */
  hasRun = new Set<ProcedureId>()
  futures = { options: 2, steps: 3 }
  private timer: ReturnType<typeof setInterval> | null = null
  private scrambleRng: Rng

  // Step 3
  readonly trees: TreeSet
  treesPartial: TreesPartial
  known: (number | null)[] = new Array<number | null>(N_NODES).fill(null)
  looks: number[] = []
  chosen: number[] = []
  /**
   * The tree just taken, kept on view with its path's numbers and its
   * points until “Next tree” (Jon's walk, 2026-11-11: the spec's one-second
   * flash of every number was a working-memory test and a timed transition;
   * now a scored tree shows only the path's numbers, a practice tree every
   * number, and the student goes on when ready). The record is saved at
   * once, so a reload here loses nothing.
   */
  afterPath: { tree: Tree; record: TreeRecord } | null = null
  /** The instruction screen shown again over a tree in progress (Jon, 2026-11-11). */
  instructionsOpen = false
  private lookerRng: Rng

  constructor(seed: number, progress: ProgressStore) {
    this.seed = seed
    this.progress = progress
    this.scrambleRng = makeRng(seed ^ 0x5c7a)
    this.scramble = scrambled(this.procDisks, this.scrambleRng)
    this.trees = treeSet(makeRng(seed ^ 0x72ee5))
    const partial = progress.partial(TREES_UNIT) as TreesPartial | undefined
    this.treesPartial = partial ?? { records: [], index: 0, shown: false, reserveUsed: [], swaps: {}, restarts: progress.restarts(TREES_UNIT) }
    if (partial?.shown) this.swapInReserve()
    this.lookerRng = makeRng(seed ^ 0x100c)
    const first = PROCEDURE_IDS.findIndex((id) => this.predicted(id) === null)
    this.tourIndex = first < 0 ? 0 : first
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  changed(): void {
    this.version++
    for (const fn of this.listeners) fn()
  }

  // ----------------------------------------------------------------- steps

  open(step: Step): void {
    this.stopPlaying()
    this.replay = null
    this.instructionsOpen = false
    this.step = step
    this.changed()
  }

  showInstructions(): void {
    this.instructionsOpen = true
    this.changed()
  }

  hideInstructions(): void {
    this.instructionsOpen = false
    this.changed()
  }

  stateOf(step: Step): StepState {
    switch (step) {
      case 1:
        return this.progress.isComplete(TOWER_UNIT(3)) && this.progress.isComplete(TOWER_UNIT(4)) ? 'done' : this.opened.has(1) ? 'running' : 'intro'
      case 2:
        return this.opened.has(2) ? 'running' : 'intro'
      case 3:
        return this.progress.isComplete(TREES_UNIT) ? 'done' : this.opened.has(3) || this.treesPartial.records.length > 0 ? 'running' : 'intro'
    }
  }

  get state(): StepState {
    return this.stateOf(this.step)
  }

  begin(): void {
    this.opened.add(this.step)
    if (this.step === 1) this.startTower()
    if (this.step === 3) this.startTree()
    this.changed()
  }

  reopen(): void {
    this.opened.delete(this.step)
    this.stopPlaying()
    this.changed()
  }

  // ----------------------------------------------------------------- Step 1

  private startTower(): void {
    this.disks = this.progress.isComplete(TOWER_UNIT(3)) ? 4 : 3
    if (this.progress.isComplete(TOWER_UNIT(this.disks))) return
    const unit = TOWER_UNIT(this.disks)
    if (this.progress.status(unit) !== 'in progress') this.progress.begin(unit)
    this.arrangement = startArrangement(this.disks)
    this.lifted = null
    this.moves = []
    this.times = []
    this.path = [idOf(this.arrangement)]
    this.illegalAttempts = 0
    this.refusal = null
    this.towerStart = performance.now()
  }

  /** Play the tower again after the reveal, with nothing recorded. */
  startReplay(disks: 3 | 4): void {
    if (this.state !== 'done') return
    this.replay = { disks }
    this.disks = disks
    this.arrangement = startArrangement(disks)
    this.lifted = null
    this.moves = []
    this.times = []
    this.path = [idOf(this.arrangement)]
    this.illegalAttempts = 0
    this.refusal = null
    this.towerStart = performance.now()
    this.changed()
  }

  endReplay(): void {
    this.replay = null
    this.changed()
  }

  /** A peg was clicked: lift its top disk, put a lifted disk down, or put it back. */
  clickPeg(peg: Peg): void {
    if (!(this.state === 'running' || this.replay) || isGoal(this.arrangement)) return
    if (this.lifted === null) {
      if (topDisk(this.arrangement, peg) === null) {
        this.refusal = 'That peg has no disk to lift.'
        this.changed()
        return
      }
      this.lifted = peg
      this.refusal = null
      this.changed()
      return
    }
    if (this.lifted === peg) {
      this.lifted = null
      this.refusal = null
      this.changed()
      return
    }
    const m = { from: this.lifted, to: peg }
    const why = illegalBecause(this.arrangement, m)
    if (why) {
      this.illegalAttempts++
      this.refusal = `${why} The disk stays lifted; click a peg it can go on, or click its own peg to put it back.`
      this.changed()
      return
    }
    this.arrangement = applyMove(this.arrangement, m)
    this.moves.push(m)
    this.times.push((performance.now() - this.towerStart) / 1000)
    this.path.push(idOf(this.arrangement))
    this.lifted = null
    this.refusal = null
    if (isGoal(this.arrangement) && !this.replay) this.finishTower()
    this.changed()
  }

  private finishTower(): void {
    const unit = TOWER_UNIT(this.disks)
    const result: TowerResult = { disks: this.disks, moves: this.moves, times: this.times, path: this.path, illegalAttempts: this.illegalAttempts, firstMoveSeconds: this.times[0] ?? 0, totalSeconds: this.times[this.times.length - 1] ?? 0, restarts: this.progress.restarts(unit) }
    this.progress.complete(unit, result)
    if (this.disks === 3 && !this.progress.isComplete(TOWER_UNIT(4))) {
      this.disks = 4
      this.startTower()
    }
  }

  towerResult(disks: 3 | 4): TowerResult | null {
    return this.progress.isComplete(TOWER_UNIT(disks)) ? (this.progress.result(TOWER_UNIT(disks)) as TowerResult) : null
  }

  /** The puzzle is solved on view: the moment between the last move and the next puzzle. */
  get solvedOnView(): boolean {
    return isGoal(this.arrangement) && this.moves.length > 0
  }

  // ----------------------------------------------------------------- Step 2

  setProcDisks(n: number): void {
    this.procDisks = Math.max(3, Math.min(6, Math.round(n)))
    this.scramble = scrambled(this.procDisks, this.scrambleRng)
    this.runs = {}
    this.scrambledRuns = {}
    this.transferRuns = {}
    this.stopPlaying()
    this.onView = null
    this.changed()
  }

  setStart(s: 'usual' | 'scramble'): void {
    this.start = s
    if (s === 'scramble') this.scramble = scrambled(this.procDisks, this.scrambleRng)
    this.stopPlaying()
    this.onView = null
    this.changed()
  }

  setSpeed(v: number): void {
    this.speed = Math.max(1, Math.min(20, v))
    this.changed()
  }

  startArrangementNow(): Arrangement {
    return this.start === 'usual' ? startArrangement(this.procDisks) : this.scramble
  }

  predicted(id: ProcedureId): string | null {
    return this.progress.prediction(PROCEDURE_PREDICTIONS[id].key)
  }

  /** The procedure on view in the walk. */
  get current(): ProcedureId {
    return PROCEDURE_IDS[this.tourIndex]
  }

  /** Go to a procedure by name: the row of names, or “Go on to the next procedure”. The run on view is cleared, since it was another procedure's. */
  goTo(id: ProcedureId): void {
    const i = PROCEDURE_IDS.indexOf(id)
    if (i < 0) return
    this.tourIndex = i
    this.stopPlaying()
    this.onView = null
    this.changed()
  }

  nextProcedure(): void {
    if (this.tourIndex < PROCEDURE_IDS.length - 1) this.goTo(PROCEDURE_IDS[this.tourIndex + 1])
  }

  /** A procedure runs only once its prediction is committed; before that, Run does nothing, and the card asks for the prediction. */
  requestRun(id: ProcedureId): void {
    if (this.predicted(id) === null) return
    this.run(id)
  }

  chooseDraft(id: ProcedureId, c: string): void {
    this.draft[id] = c
    this.changed()
  }

  /** Commit the prediction for the procedure on view. The run is the student's next press, at the setting the card names. */
  commitPrediction(): void {
    const id = this.current
    if (this.predicted(id) !== null || !this.draft[id]) return
    this.progress.commitPrediction(PROCEDURE_PREDICTIONS[id].key, this.draft[id]!)
    this.changed()
  }

  private run(id: ProcedureId): void {
    const start = this.startArrangementNow()
    const run = runProcedure(id, this.procDisks, start)
    this.runs[id] = run
    this.hasRun.add(id)
    if (this.start === 'scramble') this.scrambledRuns[id] = run
    this.transferRuns[id] = runProcedure(id, this.procDisks + 1, startArrangement(this.procDisks + 1))
    this.onView = { run, index: 0, playing: true }
    if (!this.timer) this.timer = setInterval(() => this.tickTimer(), 50)
    this.changed()
  }

  private tickTimer(): void {
    const v = this.onView
    if (!v || !v.playing) {
      this.stopPlaying()
      return
    }
    // `speed` states a second.
    const last = v.run.states.length - 1
    v.index = Math.min(last, v.index + (this.speed * 50) / 1000)
    if (v.index >= last) {
      v.index = last
      this.stopPlaying()
    }
    this.changed()
  }

  /** Finish the run on view at once: its last arrangement, its whole path. */
  skipToEnd(): void {
    if (this.onView) this.onView.index = this.onView.run.states.length - 1
    this.stopPlaying()
    this.changed()
  }

  /** Stop the animation; the run stays on view. */
  private stopPlaying(): void {
    if (this.onView) this.onView.playing = false
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  /** The arrangement on view: the run on view at its current index, or the start when no run has been made at this setting. */
  get arrangementOnView(): Arrangement {
    if (this.onView) return this.onView.run.states[Math.floor(this.onView.index)]
    return this.startArrangementNow()
  }

  setFutures(options: number, steps: number): void {
    this.futures = { options: Math.max(2, Math.min(40, Math.round(options))), steps: Math.max(1, Math.min(8, Math.round(steps))) }
    this.changed()
  }

  // ----------------------------------------------------------------- Step 3

  /** The sequence of trees: the practice trees, then the scored ones, with reserves swapped in where a sitting was interrupted mid-tree. */
  treeAt(index: number): Tree {
    const swap = this.treesPartial.swaps[index]
    if (swap !== undefined) return this.trees.reserve[swap]
    return index < PRACTICE_TREES ? this.trees.practice[index] : this.trees.scored[index - PRACTICE_TREES]
  }

  get totalTrees(): number {
    return PRACTICE_TREES + SCORED_TREES
  }

  private swapInReserve(): void {
    const i = this.treesPartial.index
    if (i >= this.totalTrees) return
    const kind = this.treeAt(i).kind
    const k = this.trees.reserve.findIndex((t, j) => !this.treesPartial.reserveUsed.includes(j) && (kind === 'regular' ? t.kind === 'regular' : t.kind !== 'regular'))
    if (k >= 0) this.treesPartial = { ...this.treesPartial, swaps: { ...this.treesPartial.swaps, [i]: k }, reserveUsed: [...this.treesPartial.reserveUsed, k], shown: false }
    else this.treesPartial = { ...this.treesPartial, shown: false }
  }

  private startTree(): void {
    if (this.progress.isComplete(TREES_UNIT)) return
    if (this.progress.status(TREES_UNIT) !== 'in progress') this.progress.begin(TREES_UNIT)
    this.known = new Array<number | null>(N_NODES).fill(null)
    this.looks = []
    this.chosen = []
    this.afterPath = null
    this.treesPartial = { ...this.treesPartial, shown: true }
    this.progress.savePartial(TREES_UNIT, this.treesPartial)
  }

  get currentTree(): Tree | null {
    return this.treesPartial.index < this.totalTrees ? this.treeAt(this.treesPartial.index) : null
  }

  /** Whether the tree on view (the one just taken, while its feedback is up) is a practice tree. */
  get isPractice(): boolean {
    if (this.afterPath) return !this.afterPath.record.scored
    return this.treesPartial.index < PRACTICE_TREES
  }

  /** The index of the tree on view in the sequence; during the feedback, the tree just taken. */
  get indexOnView(): number {
    return this.afterPath ? this.treesPartial.index - 1 : this.treesPartial.index
  }

  /** The label of the tree on view: Practice n of 3, or Test n of 16 (Jon, 2026-11-11). */
  get treeLabel(): string {
    const i = this.indexOnView
    return i < PRACTICE_TREES ? `Practice ${i + 1} of ${PRACTICE_TREES}` : `Test ${i - PRACTICE_TREES + 1} of ${SCORED_TREES}`
  }

  /** Whether every number of the tree on view is shown: after the path, on a practice tree only. */
  get revealAll(): boolean {
    return this.afterPath !== null && !this.afterPath.record.scored
  }

  /** The practice trees' total so far, points; shown as an example, never scored. */
  get practiceTotal(): number {
    return this.treesPartial.records.filter((r) => !r.scored).reduce((s, r) => s + r.net, 0)
  }

  /** The points of the chosen nodes whose numbers are known, and whether any chosen node is still hidden. */
  pathSoFar(): { known: number[]; hidden: number } {
    const known: number[] = []
    let hidden = 0
    for (const n of this.chosen) {
      const v = this.known[n]
      if (v === null) hidden++
      else known.push(v)
    }
    return { known, hidden }
  }

  /** Uncover a node for a point. */
  look(node: number): void {
    const t = this.currentTree
    if (!t || this.afterPath || this.known[node] !== null) return
    this.known[node] = t.values[node]
    this.looks.push(node)
    this.changed()
  }

  /** Choose a node for the path: a step-1 node, then a child, then a grandchild; choosing elsewhere restarts the path from that node's step. */
  choosePathNode(node: number): void {
    if (this.afterPath) return
    const step = stepOf(node)
    if (step === 1) this.chosen = [node]
    else if (step === 2 && this.chosen.length >= 1 && childrenOf(this.chosen[0]).includes(node)) this.chosen = [this.chosen[0], node]
    else if (step === 3 && this.chosen.length >= 2 && childrenOf(this.chosen[1]).includes(node)) this.chosen = [this.chosen[0], this.chosen[1], node]
    else return
    this.changed()
  }

  get canTake(): boolean {
    return this.chosen.length === 3 && !this.afterPath
  }

  /** Take the chosen path: the record is saved at once; the tree stays on view with its feedback until “Next tree”. */
  takePath(): void {
    const t = this.currentTree
    if (!t || !this.canTake) return
    const path = this.chosen as [number, number, number]
    const net = path.reduce((s, n) => s + t.values[n], 0) - this.looks.length * LOOK_COST
    const record: TreeRecord = { tree: t, looks: [...this.looks], path, net, scored: !this.isPractice }
    for (const n of path) this.known[n] = t.values[n]
    this.afterPath = { tree: t, record }
    this.treesPartial = { ...this.treesPartial, records: [...this.treesPartial.records, record], index: this.treesPartial.index + 1, shown: false }
    if (this.treesPartial.index >= this.totalTrees) this.finishTrees()
    else this.progress.savePartial(TREES_UNIT, this.treesPartial)
    this.changed()
  }

  /** On from the feedback to the next tree, or to the results after the last. */
  nextTree(): void {
    this.afterPath = null
    if (!this.progress.isComplete(TREES_UNIT)) this.startTree()
    this.changed()
  }

  private finishTrees(): void {
    const scored = this.treesPartial.records.filter((r) => r.scored)
    const lookers = {} as Record<LookerId, LookerRun[]>
    for (const id of LOOKER_IDS) lookers[id] = scored.map((r) => runLooker(id, r.tree, this.lookerRng))
    const result: TreesResult = { records: this.treesPartial.records, lookers, restarts: this.treesPartial.restarts }
    this.progress.complete(TREES_UNIT, result)
  }

  get treesResult(): TreesResult | null {
    return this.progress.isComplete(TREES_UNIT) ? (this.progress.result(TREES_UNIT) as TreesResult) : null
  }

  /** The running total over scored trees so far, points. */
  get runningTotal(): number {
    return this.treesPartial.records.filter((r) => r.scored).reduce((s, r) => s + r.net, 0)
  }

}

export { stateGraph, goalArrangement, bestPath }
