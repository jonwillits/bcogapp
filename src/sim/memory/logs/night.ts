import type { Rng } from '../../random'
import { Body, RANGE_LOCOMOTION, type Command, type Pose } from '../../rodent/body'
import { CLEARING, branchFootprint, clearingFootprints, logInReach, pushOutOf, type Clearing, type Log } from './clearings'
import { fullOnNight, type LastEmptied } from './refill'
import type { NightFeatures } from './features'
import type { Footprint } from '../../rodent/range'

/**
 * One night at the logs (spec §8.3): the forager starts in the nest, walks
 * out, digs at logs, eats what it finds, is called back to nurse partway
 * through, and at dawn walks back to the nest by itself. A log never shows whether
 * it has beetles until it is dug (§12, item 4): `full` is read by nothing
 * in the scene but the dig's outcome. The night's length is a measurement
 * (`NIGHT_S`, tuned in `tune.probe.ts` so that a scripted forager that
 * remembers perfectly empties about four of the seven loose-bark logs).
 *
 * The same class runs the student (keys through `step`) and the programmed
 * foragers of Part 5 (`scripted.ts`), so their nights are the student's
 * nights: the same clearing, starting state, features, length and call.
 */

/**
 * A night's length at 1×, seconds. 55 s was tuned so that a scripted
 * perfect rememberer empties about four of the seven loose-bark logs
 * (`tune.probe.ts`); Jon, playing it (2026-10-27), found the call at the
 * half, the walk back and the nursing left no time to reach a log again,
 * so the night is 90 s, with the time taken from the shortened memory
 * experiments. A scripted perfect forager now empties about six of seven
 * on nights 1 and 3 and finds little on night 2; a student empties fewer.
 */
export const NIGHT_S = 90
/** The practice night is longer, for learning the keys (Jon, 2026-10-27: 55 s left time for about one beetle while learning). Nothing is scored on it. */
export const PRACTICE_S = 120
/** The walk home at dawn is given this long beyond the straight walk before the forager is set down at the nest. */
export const RETURN_GRACE_S = 6
/** The young call at this point in the night. */
export const CALL_AT_S = NIGHT_S / 2
export const DIG_S = 3
export const EAT_S = 3
export const NURSE_S = 8
/** The path is sampled this often for the replay, seconds. */
export const PATH_SAMPLE_S = 0.25
/** The energy bar: drains over the night, rises with each meal; never ends the night. */
export const ENERGY_DRAIN_PER_S = 0.7 / NIGHT_S
export const ENERGY_PER_MEAL = 0.2

export type DigOutcome = 'beetles' | 'empty' | 'smooth'

export interface DigEvent {
  t: number
  log: number
  outcome: DigOutcome
  /** The dig came after the young's call and the nursing. */
  afterCall: boolean
  /** The log had already been dug tonight. */
  repeat: boolean
  /** The log was emptied last night (so it was known to be empty by the rule). */
  emptiedLastNight: boolean
}

export interface NightRecord {
  night: number
  clearing: Clearing['id']
  features: NightFeatures
  digs: DigEvent[]
  path: { t: number; x: number; y: number; heading: number }[]
  beetles: number
  /** Logs full tonight, as the night began. */
  fullAtStart: boolean[]
  /** Logs emptied tonight. */
  emptiedTonight: boolean[]
  /** Logs full tonight that were emptied two nights ago and were not dug tonight: the error of misremembering when. */
  passedOverRefilled: number
  /** When the young called and when nursing ended. */
  calledAt: number
  nursedAt: number | null
  seconds: number
}

export type NightPhase = 'foraging' | 'digging' | 'eating' | 'called' | 'nursing' | 'returning' | 'dawn'

export interface NightCommand extends Command {
  dig?: boolean
}

export interface NightOptions {
  seconds?: number
  callAt?: number
}

export class NightSim {
  readonly clearing: Clearing
  readonly night: number
  readonly features: NightFeatures
  readonly body: Body
  readonly seconds: number
  readonly callAt: number
  /** Whether each log has beetles now. Read only by the dig. */
  private readonly full: boolean[]
  private readonly lastEmptied: LastEmptied
  readonly dugTonight: number[]
  readonly record: NightRecord
  phase: NightPhase = 'foraging'
  time = 0
  /** Seconds left in the dig, the meal or the nursing. */
  timer = 0
  /** The log being dug or eaten at. */
  at: Log | null = null
  /** The last dig's outcome, for the status line, until the next dig. */
  lastOutcome: DigOutcome | null = null
  energy = 1
  called = false
  nursed = false
  /** Seconds the walk home may still take before the forager is set down at the nest. */
  private returnLeft = 0
  private readonly prints: Footprint[]
  private lastSample = -Infinity

  constructor(clearing: Clearing, lastEmptied: LastEmptied, night: number, features: NightFeatures, rng: Rng, opts: NightOptions = {}) {
    this.clearing = clearing
    this.night = night
    this.features = features
    this.lastEmptied = lastEmptied
    this.seconds = opts.seconds ?? NIGHT_S
    this.callAt = opts.callAt ?? this.seconds / 2
    this.full = fullOnNight(
      clearing.logs.map((l) => l.kind),
      lastEmptied,
      night,
    )
    this.dugTonight = clearing.logs.map(() => 0)
    this.body = new Body(rng, RANGE_LOCOMOTION, { x: clearing.nest.x, y: clearing.nest.y, heading: rng.range(0, 2 * Math.PI) })
    this.prints = clearingFootprints(clearing)
    if (features.ground === 'a fallen branch across the path') this.prints.push(branchFootprint(clearing.nest))
    this.record = {
      night,
      clearing: clearing.id,
      features,
      digs: [],
      path: [],
      beetles: 0,
      fullAtStart: [...this.full],
      emptiedTonight: clearing.logs.map(() => false),
      passedOverRefilled: 0,
      calledAt: this.callAt,
      nursedAt: null,
      seconds: this.seconds,
    }
    this.sample()
  }

  get done(): boolean {
    return this.phase === 'dawn'
  }

  /** Dawn has come: the night's time is up and the forager is walking home, or is home. */
  get dawning(): boolean {
    return this.phase === 'returning' || this.phase === 'dawn'
  }

  get pose(): Pose {
    return this.body.pose
  }

  /** The log the forager could dig now, or null: within reach, while foraging, and not while the young are calling. */
  get canDigAt(): Log | null {
    if (this.phase !== 'foraging') return null
    return logInReach(this.clearing, this.body.x, this.body.y)
  }

  get atNest(): boolean {
    return Math.hypot(this.body.x - this.clearing.nest.x, this.body.y - this.clearing.nest.y) <= CLEARING.nestReach
  }

  private sample(): void {
    if (this.time - this.lastSample < PATH_SAMPLE_S - 1e-9) return
    this.lastSample = this.time
    this.record.path.push({ t: this.time, x: this.body.x, y: this.body.y, heading: this.body.heading })
  }

  /** One step: the keys move the body unless it is busy; a dig request starts a dig at a log in reach. */
  step(dt: number, cmd: NightCommand): void {
    if (this.phase === 'dawn') return
    this.time += dt
    this.energy = Math.max(0, this.energy - ENERGY_DRAIN_PER_S * dt)
    if (!this.called && this.time >= this.callAt) {
      this.called = true
      // A dig or a meal in progress finishes; the call is heard either way.
      if (this.phase === 'foraging') this.phase = 'called'
    }
    switch (this.phase) {
      case 'foraging':
      case 'called': {
        this.move(dt, cmd)
        if (this.phase === 'called' && this.atNest) {
          this.phase = 'nursing'
          this.timer = NURSE_S
        } else if (this.phase === 'foraging' && cmd.dig) {
          const l = this.canDigAt
          if (l) this.startDig(l)
        }
        break
      }
      case 'digging': {
        this.timer -= dt
        if (this.timer <= 0) this.finishDig()
        break
      }
      case 'eating': {
        this.timer -= dt
        if (this.timer <= 0) {
          this.phase = this.called && !this.nursed ? 'called' : 'foraging'
          this.at = null
        }
        break
      }
      case 'nursing': {
        this.timer -= dt
        if (this.timer <= 0) {
          this.nursed = true
          this.record.nursedAt = this.time
          this.phase = 'foraging'
        }
        break
      }
      case 'returning': {
        this.walkHome(dt)
        this.returnLeft -= dt
        if (this.atNest || this.returnLeft <= 0) this.dawn()
        break
      }
    }
    if (this.time >= this.seconds && !this.dawning) this.startReturn()
    this.sample()
  }

  /** The night's time is up: whatever was in hand stops, and the forager walks home by itself. */
  private startReturn(): void {
    this.phase = 'returning'
    this.at = null
    const d = Math.hypot(this.body.x - this.clearing.nest.x, this.body.y - this.clearing.nest.y)
    this.returnLeft = d / this.body.loco.speed + RETURN_GRACE_S
  }

  /** One step of the walk home: turn toward the nest at the turn rate (the last few degrees in one go), and walk once nearly facing it. */
  private walkHome(dt: number): void {
    const want = Math.atan2(this.clearing.nest.y - this.body.y, this.clearing.nest.x - this.body.x)
    let diff = want - this.body.heading
    while (diff > Math.PI) diff -= 2 * Math.PI
    while (diff < -Math.PI) diff += 2 * Math.PI
    let turn: -1 | 0 | 1 = diff > 0 ? 1 : -1
    if (Math.abs(diff) <= this.body.loco.turnRate * dt) {
      this.body.place({ x: this.body.x, y: this.body.y, heading: want })
      turn = 0
    }
    this.move(dt, { forward: Math.abs(diff) < 0.6 ? 1 : 0, turn })
  }

  private move(dt: number, cmd: Command): void {
    this.body.step(dt, { forward: cmd.forward, turn: cmd.turn }, null)
    const clear = pushOutOf(this.body.x, this.body.y, this.body.loco.radius, this.prints)
    this.body.x = clear.x
    this.body.y = clear.y
    const dx = this.body.x - this.clearing.nest.x
    const dy = this.body.y - this.clearing.nest.y
    const r = Math.hypot(dx, dy)
    if (r > CLEARING.bound) {
      this.body.x = this.clearing.nest.x + (dx * CLEARING.bound) / r
      this.body.y = this.clearing.nest.y + (dy * CLEARING.bound) / r
    }
  }

  private startDig(l: Log): void {
    this.phase = 'digging'
    this.timer = DIG_S
    this.at = l
  }

  private finishDig(): void {
    const l = this.at!
    const i = l.id
    const outcome: DigOutcome = l.kind === 'smooth' ? 'smooth' : this.full[i] ? 'beetles' : 'empty'
    this.record.digs.push({
      t: this.time,
      log: i,
      outcome,
      afterCall: this.called,
      repeat: this.dugTonight[i] > 0,
      emptiedLastNight: this.lastEmptied[i] === this.night - 1,
    })
    this.dugTonight[i]++
    this.lastOutcome = outcome
    if (outcome === 'beetles') {
      this.full[i] = false
      this.record.emptiedTonight[i] = true
      this.record.beetles++
      this.energy = Math.min(1, this.energy + ENERGY_PER_MEAL)
      this.phase = 'eating'
      this.timer = EAT_S
    } else {
      this.phase = this.called && !this.nursed ? 'called' : 'foraging'
      this.at = null
    }
  }

  /** Place the body (the scripted foragers walk perfectly; the frame loop never calls this). */
  place(x: number, y: number, heading: number): void {
    this.body.place({ x, y, heading })
  }

  /** Start a dig at a log the scripted forager stands at. */
  digAt(l: Log): boolean {
    if (this.phase !== 'foraging') return false
    this.startDig(l)
    return true
  }

  /** Home: the night is over. A forager the walk home did not bring to the nest in time is set down there. */
  private dawn(): void {
    this.phase = 'dawn'
    this.at = null
    let passed = 0
    for (const l of this.clearing.logs) {
      if (l.kind !== 'loose') continue
      if (this.lastEmptied[l.id] === this.night - 2 && this.record.fullAtStart[l.id] && this.dugTonight[l.id] === 0) passed++
    }
    this.record.passedOverRefilled = passed
    if (!this.atNest) this.body.place({ x: this.clearing.nest.x, y: this.clearing.nest.y, heading: this.body.heading })
  }

  /** Run to dawn with no keys held (the student left the keys alone; a test's convenience). */
  runStill(dt = 0.05): void {
    while (!this.done) this.step(dt, { forward: 0, turn: 0 })
  }
}

/** The per-night tallies of spec §8.7, from a record. */
export interface NightTallies {
  beetles: number
  digsAtFull: number
  digsAtEmptiedLastNight: number
  passedOverRefilled: number | null
  repeatsBeforeCall: number
  repeatsAfterCall: number
  digsAtSmooth: number
  digs: number
}

export function tallies(r: NightRecord): NightTallies {
  let digsAtFull = 0
  let digsAtEmptiedLastNight = 0
  let repeatsBeforeCall = 0
  let repeatsAfterCall = 0
  let digsAtSmooth = 0
  for (const d of r.digs) {
    if (d.outcome === 'beetles') digsAtFull++
    if (d.outcome === 'smooth') digsAtSmooth++
    if (d.emptiedLastNight && !d.repeat) digsAtEmptiedLastNight++
    if (d.repeat) {
      if (d.afterCall) repeatsAfterCall++
      else repeatsBeforeCall++
    }
  }
  return {
    beetles: r.beetles,
    digsAtFull,
    digsAtEmptiedLastNight,
    passedOverRefilled: r.night >= 3 ? r.passedOverRefilled : null,
    repeatsBeforeCall,
    repeatsAfterCall,
    digsAtSmooth,
    digs: r.digs.length,
  }
}

/** The fixed lines of a night's tallies, each worded one way always (§8.7). */
export const TALLY_LABELS = {
  beetles: 'Beetles eaten',
  digsAtFull: 'Digs at full logs',
  digsAtEmptiedLastNight: 'Digs at logs emptied last night',
  passedOverRefilled: 'Full logs passed over, emptied two nights ago',
  repeatsBeforeCall: 'Repeat digs tonight, before the call',
  repeatsAfterCall: 'Repeat digs tonight, after the call',
  digsAtSmooth: 'Digs at smooth logs',
} as const

export function tallyLines(t: NightTallies, width = 46): string[] {
  const row = (label: string, v: number | null) => `${label.padEnd(width)}${v === null ? '   —' : String(v).padStart(4)}`
  return [
    row(TALLY_LABELS.beetles, t.beetles),
    row(TALLY_LABELS.digsAtFull, t.digsAtFull),
    row(TALLY_LABELS.digsAtEmptiedLastNight, t.digsAtEmptiedLastNight),
    row(TALLY_LABELS.passedOverRefilled, t.passedOverRefilled),
    row(TALLY_LABELS.repeatsBeforeCall, t.repeatsBeforeCall),
    row(TALLY_LABELS.repeatsAfterCall, t.repeatsAfterCall),
    row(TALLY_LABELS.digsAtSmooth, t.digsAtSmooth),
  ]
}
