import { RecordingSession, CELL_KEYS, DT } from '../../sim/rodent/recording'
import { BOX_A, BOX_B } from '../../sim/rodent/rooms'
import type { Command } from '../../sim/rodent/body'
import { angleDiff, deg, rad } from '../../sim/rodent/spatial/angles'
import { fmtSigned } from '../../components/format'

/**
 * Part 3's state (spec §9): five steps, one at a time. Each step that
 * changes something asks first: a prediction with three or four choices,
 * then Commit my prediction, then the change. No result is computed for
 * display before the commit (`reveal.test.tsx`).
 */

export type Step = 1 | 2 | 3 | 4 | 5
export type StepState = 'intro' | 'predict' | 'running' | 'done'

export interface StepSpec {
  step: Step
  title: string
  what: string[]
  /** The prediction's question and choices; none for Step 1. */
  question?: string
  choices?: string[]
  minutes: number
}

export const STEPS: StepSpec[] = [
  { step: 1, title: 'Step 1 — Fill the maps', minutes: 4, what: ['A 1 m square box, lit, with a white card on one wall. Drive for a minute, then let the rat explore and skip ahead.', 'The firing maps fill in: one patch per place cell, a lattice per grid cell, a band along a wall per border cell, a lobe per head-direction cell. The estimate and the true path lie on top of each other.'] },
  { step: 2, title: 'Step 2 — Lights out', minutes: 5, what: ['The lights go out. A fresh set of maps records in the dark beside the pinned maps from the light.', 'Drive along a wall, then into the middle, and watch the gap between the estimate and the true path. Then the lights come back on.'], question: 'In the dark, what happens to the place fields?', choices: ['they stay where they were, as sharp', 'they smear and drift', 'they disappear', 'they move to new places and stay there'] },
  { step: 3, title: 'Step 3 — Turn the card', minutes: 5, what: ['First out of sight: the rat is taken out, the card moved 90° around the walls, and the rat put back.', 'Then in sight: the card is moved while the rat faces it, several times.'], question: 'When the card is turned 90° while the rat is out of the box, what do the head-direction cells do?', choices: ['each keeps its preferred direction', 'every preferred direction turns 90°, all together', 'the preferred directions scatter', 'the cells stop firing'] },
  { step: 4, title: 'Step 4 — A new room', minutes: 5, what: ['The rat is moved to a round box with blue walls and a black card. Then back to the first box.'], question: 'In the new room, what do the place cells do?', choices: ['they fire in the same places', 'some fire in new places and others fall silent', 'they all fall silent', 'they fire everywhere'] },
  { step: 5, title: 'Step 5 — Without the turn signal', minutes: 5, what: ['The vestibular input is removed. The card stays in view. Skip ahead a day.'], question: 'With the turn signal gone and the card in view, what do the head-direction cells do over a day?', choices: ['they keep their tuning, held by the card', 'they keep firing, but not for any one heading', 'they stop firing', 'they turn with the card as before'] },
]

export const SKIPS = [
  { label: 'Skip ahead 2 minutes', seconds: 120 },
  { label: 'Skip ahead 10 minutes', seconds: 600 },
] as const
/** Step 5's day, compressed: the lesion's effect is complete well inside it (`recording.test.ts`). */
export const DAY_SKIP = { label: 'Skip ahead 1 day (30 simulated minutes)', seconds: 30 * 60 } as const
/** Seconds of simulated time paid per slice of a skip, on a timer. */
export const SKIP_SLICE = 20

export class CellsStore {
  readonly seed: number
  session: RecordingSession
  step: Step = 1
  state: StepState = 'intro'
  prediction: string | null = null
  committed: string | null = null
  /** Steps finished, in order. */
  readonly done: Step[] = []
  /** Step 3: whether the out-of-sight turn has happened. */
  cardTurnedOutOfSight = false
  /** Step 4: whether the rat is in the second room. */
  inSecondRoom = false
  /** The heading offset recorded at lights-out, to print the drift since. */
  offsetAtLightsOut: number | null = null
  /** Preferred directions recorded before the card was turned, degrees. */
  preferredBefore: number[] | null = null
  /** Which place cells and grid cells the panel shows. */
  placeShown = [0, 1, 2, 3, 4, 5]
  gridShown: [number, number][] = [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1]]
  owed = 0
  skipping = false
  skipBadge = ''
  /** Seconds of black still to show (a fade through black at a carry). */
  fade = 0
  version = 0
  private listeners = new Set<() => void>()
  private firstLookDone = false

  constructor(seed: number) {
    this.seed = seed
    this.session = new RecordingSession(seed, BOX_A)
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
    return STEPS[this.step - 1]
  }

  canOpen(s: Step): boolean {
    return s <= this.done.length + 1
  }

  open(s: Step): void {
    if (!this.canOpen(s)) return
    this.step = s
    this.state = this.done.includes(s) ? 'done' : 'intro'
    this.prediction = null
    this.committed = null
    this.changed()
  }

  begin(): void {
    if (this.state !== 'intro') return
    this.state = this.spec.question ? 'predict' : 'running'
    this.changed()
  }

  choose(p: string): void {
    this.prediction = p
    this.changed()
  }

  /** Commit my prediction, then the change the step makes. */
  commitPrediction(): void {
    if (this.state !== 'predict' || !this.prediction) return
    this.committed = this.prediction
    this.state = 'running'
    this.applyChange()
    this.changed()
  }

  private applyChange(): void {
    const s = this.session
    if (this.step === 2) {
      s.pin('in the light')
      this.offsetAtLightsOut = s.errors().heading
      s.lightsOut()
    } else if (this.step === 3) {
      this.preferredBefore = s.hdPreferred()
      s.pin('before the turn')
      this.carryAndTurn(90)
      this.cardTurnedOutOfSight = true
    } else if (this.step === 4) {
      s.pin('the first room')
      this.fade = 1.2
      s.carry(BOX_B)
      this.inSecondRoom = true
    } else if (this.step === 5) {
      s.pin('before the lesion')
      s.removeTurnPathway()
    }
  }

  /** Step 3, out of sight: the rat is taken out (a fade), the card is moved, and the rat is put back. */
  private carryAndTurn(degrees: number): void {
    this.fade = 1.2
    this.session.carry()
    this.session.turnCard(degrees)
    this.session.carry()
    this.session.clearMaps()
  }

  /** Step 3, in sight: the card moves 90° while the rat faces it. Returns a fixed line saying what happened. */
  moveCardInSight(): string {
    const s = this.session
    const deg90 = s.cardStaysInView(90) ? 90 : s.cardStaysInView(-90) ? -90 : 0
    if (deg90 === 0) return 'Turn to face the card first'
    s.turnCard(deg90)
    this.changed()
    return `The card moved ${deg90 > 0 ? 'counterclockwise' : 'clockwise'} 90°, in sight: move ${s.seenMoves}`
  }

  finishStep(): void {
    if (this.state !== 'running') return
    if (this.step === 2) this.session.lightsOn()
    if (!this.done.includes(this.step)) this.done.push(this.step)
    this.state = 'done'
    this.changed()
  }

  /** Step 4: back to the first room. */
  backToFirstRoom(): void {
    if (!this.inSecondRoom) return
    this.fade = 1.2
    this.session.pin('the second room')
    this.session.carry(BOX_A)
    this.inSecondRoom = false
    this.changed()
  }

  setExploring(v: boolean): void {
    this.session.exploring = v
    this.changed()
  }

  /** The frame loop's step. */
  tick(dt: number, cmd: Command): void {
    if (this.skipping) return
    if (this.fade > 0) {
      this.fade = Math.max(0, this.fade - dt)
      return
    }
    if (!this.firstLookDone) this.firstLookDone = true
    this.session.drive(cmd)
    this.session.step(dt)
  }

  /** Skip ahead, paid in slices on a timer so the page stays responsive. */
  skip(seconds: number, bump: () => void): void {
    this.owed += seconds
    if (this.skipping) return
    this.skipping = true
    const total = this.owed
    const pay = () => {
      const n = Math.min(SKIP_SLICE, this.owed)
      this.session.run(n)
      this.owed -= n
      this.skipBadge = `Skipping ahead — ${Math.round(this.owed)} s to go`
      bump()
      if (this.owed > 0) setTimeout(pay, 0)
      else {
        this.skipping = false
        this.skipBadge = `Skipped ahead ${Math.round(total / 60)} min — ${(this.session.time / 60).toFixed(1)} min so far`
        this.changed()
        setTimeout(() => {
          this.skipBadge = ''
          this.changed()
        }, 1500)
      }
    }
    setTimeout(pay, 0)
  }

  pin(): void {
    this.session.pin(`pinned at ${(this.session.time / 60).toFixed(1)} min`)
    this.changed()
  }

  clearMaps(): void {
    this.session.clearMaps()
    this.changed()
  }

  /** Browse: the next six place cells, or the next pair in each grid group. */
  browsePlace(): void {
    this.placeShown = this.placeShown.map((i) => (i + 6) % CELL_KEYS.place.length)
    this.changed()
  }

  browseGrid(): void {
    this.gridShown = this.gridShown.map(([g, c]) => [g, (c + 2) % CELL_KEYS.grid[g].length] as [number, number])
    this.changed()
  }

  /** The fixed lines the panel prints: one fact to a line, each worded one way always. */
  lines(): (string | null)[] {
    const s = this.session
    const e = s.errors()
    const room = s.room.id === 'box-a' ? 'the first box' : s.room.id === 'box-b' ? 'the round box' : s.room.id
    const control = s.cardControls ? `The ${s.cardId} holds the heading` : `The ${s.cardId} does not hold the heading yet`
    const when = s.controlAt !== null ? `It took control after ${(s.controlAt / 60).toFixed(1)} min in this room` : `Time in this room ${(s.spatial.timeInRoom / 60).toFixed(1)} min`
    const tuning = s.hdTuningIndex()
    const drift = this.offsetAtLightsOut !== null && !s.lit ? `Drift of the bump since lights out ${fmtSigned(deg(angleDiff(rad(this.offsetAtLightsOut), rad(e.heading))), 0).padStart(5)}°` : null
    return [
      `Room: ${room}, ${s.lit ? 'lit' : 'dark'}`,
      `Simulated time ${(s.time / 60).toFixed(1).padStart(5)} min`,
      `Gap between the estimate and the true position ${(e.position * 100).toFixed(0).padStart(3)} cm`,
      `The bump against the true heading ${fmtSigned(e.heading, 0).padStart(5)}°`,
      drift,
      control,
      when,
      `Directional tuning of the shown cells (0 to 1) ${tuning.toFixed(2)}`,
      s.seenMoves ? `Card moves seen by the rat in this room: ${s.seenMoves}` : null,
      s.spatial.hd.pathway ? 'Turn pathway: intact' : 'Turn pathway: removed',
    ]
  }

  /** The result lines of the step now running or done, computed only after the commit. */
  resultLines(): (string | null)[] {
    if (this.state !== 'running' && this.state !== 'done') return [null, null, null]
    const s = this.session
    if (this.step === 3 && this.preferredBefore) {
      const now = s.hdPreferred()
      const shifts = now.map((a, i) => deg(angleDiff(rad(this.preferredBefore![i]), rad(a))))
      const mean = shifts.reduce((x, y) => x + y, 0) / shifts.length
      return [`Preferred directions since the turn: ${shifts.map((d) => fmtSigned(d, 0).padStart(5)).join(' ')}°`, `Mean turn of the eight cells ${fmtSigned(mean, 0)}°`, s.cardControls ? 'The card holds the heading' : 'The card no longer holds the heading']
    }
    if (this.step === 4) {
      const map = s.spatial.map
      const silent = map ? map.fields.filter((f) => !f).length : 0
      return [`Map in use: room map ${map?.id ?? '-'} of ${s.spatial.maps.maps.length} stored`, `Place cells silent in this room: ${silent} of ${CELL_KEYS.place.length}`, s.controlAt !== null ? `The card took control after ${(s.controlAt / 60).toFixed(1)} min` : `The card does not control the heading yet (${(s.spatial.timeInRoom / 60).toFixed(1)} min in this room)`]
    }
    if (this.step === 5) {
      return [`Turn pathway: ${s.spatial.hd.pathway ? 'intact' : 'removed'}`, `Lower ring bump strength ${s.spatial.hd.decodeLower().strength.toFixed(2)}`, `Directional tuning of the shown cells ${s.hdTuningIndex().toFixed(2)}`]
    }
    if (this.step === 2) {
      return [`Lights: ${s.lit ? 'on' : 'off'}`, `Gap between the estimate and the true position ${(s.errors().position * 100).toFixed(0)} cm`, null]
    }
    return [null, null, null]
  }

  get dt(): number {
    return DT
  }
}
