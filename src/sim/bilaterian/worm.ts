import type { Rng } from '../random'
import { wrapAngle } from '../math'
import { concentrations, type CueSource } from './fields'
import { netInput, activate } from './unit'
import type { Circuit } from './circuit'
import {
  makeModulators,
  relaxModulators,
  type ModulatorState,
  type Levels,
} from './modulators'

/**
 * A nematode-like early bilaterian: a head carrying the sensory cells, a
 * body of segments, and body-wall muscle in two strips whose alternation
 * runs a wave along the animal. Forward is a wave from head to tail; reverse
 * is the same wave from tail to head.
 *
 * **The animal does not compare left against right.** It has one sensor per
 * cue channel, at the head, and it steers by comparing what it senses now
 * against what it sensed about a second ago. Rising, and nothing triggers a
 * reversal. Falling, and reversal probability climbs. Going straight is not
 * a behaviour the animal produces: it is what happens when the rule for
 * turning is not met (§4.3.3). Module 1's two-sensor sensorimotor code is
 * the obvious thing to reach for here and it would make the scene contradict
 * its own chapter, so none of it is used.
 *
 * Which wave runs is decided by which of two mutually inhibiting motor
 * groups currently has the upper hand (§4.2.7, implemented where §4.3.4 says
 * the worm implements it). A reversal ends in a deep bend that leaves the
 * animal on a new heading drawn from the seeded stream.
 */

export interface Point {
  x: number
  z: number
}

/** The sensory cell for one channel: its output now, and its trace of a moment ago. */
export interface SensoryCell {
  channel: number
  /**
   * Which chemistry reaches this cell. Fixed biology — which receptor cells
   * carry which modulator receptors — and not a valence: whether the animal
   * approaches or flees the cue is decided by the wiring alone.
   */
  pursuitDrives: boolean
  hungerSilences: boolean
  /** Concentration at the head. */
  concentration: number
  /** The modulator gain currently applied to this cell's output. */
  gain: number
  /** Output, 0..1: the cell has a ceiling of its own. */
  output: number
  /** What the cell has reported over the last quarter second. */
  now: number
  /** What the cell reported about a second ago. */
  trace: number
  /** now − trace: the comparison the circuit receives. */
  delta: number
}

export interface ChannelBiology {
  channel: number
  /** Pursuit is a gain on this cell's output. */
  pursuitDrives?: boolean
  /** A hungry animal's chemistry turns this cell down. */
  hungerSilences?: boolean
}

// ---- the body, the cells, the rule, the motor groups ---------------------

export const SEGMENTS = 16
export const SPACING = 0.085

/**
 * The cell's own ceiling. Output is a ramp with a floor and a ceiling —
 * gain × concentration, held between zero and one — and it reaches the
 * ceiling at `CEILING_AT` units of concentration, which is what a source
 * reads within about a body length of its centre. So "the cue is present"
 * on the truth table, an input of exactly 1, is what the cell reports at a
 * source, and the chapter's arithmetic holds in the dish and not only on
 * paper.
 *
 * Below the ceiling the output is linear in the gain, so a halved gain is
 * indistinguishable from a halved weight downstream. At the ceiling the
 * gain is invisible — a strong cue saturates the cell whatever the gain —
 * while a halved weight still halves the verdict. That asymmetry is what
 * separates Part 3's ambiguous pair, and it falls out of the floor and
 * ceiling Part 2 already taught.
 */
export const CEILING_AT = 4

export function sensoryOutput(concentration: number, gain: number): number {
  const drive = (gain * concentration) / CEILING_AT
  return drive < 0 ? 0 : drive > 1 ? 1 : drive
}

/**
 * Every constant the steering rule and the body run on, in one place, so
 * that `tune.probe.ts` can sweep them against a running animal. Each value
 * here was measured, not chosen; the probe prints the table that chose it.
 */
export const TUNING = {
  forwardSpeed: 2.4,
  reverseSpeed: 1.6,
  /** The head sweeps side to side as the animal moves — radians, and seconds per sweep. */
  sweepAmplitude: 0.3,
  sweepPeriod: 0.7,
  /** How far back "a moment ago" is, seconds. */
  traceTau: 1,
  /** "Now" is a short average, not an instant, or the sweep reads as the world rising and falling. */
  nowTau: 0.1,
  /** Reversals per second with nothing falling: the animal's own restlessness. */
  spontaneous: 0.02,
  /** Reversals per second per unit of the comparison, when it comes out badly. */
  gain: 40,
  /** A reversal is a pulse of input to the reverse group; the pulse decays. */
  pulseTau: 0.7,
  /** The deep bend after a reversal: how long, and the least and most of a half-turn it swings. */
  turnSeconds: 0.7,
  turnMin: 0.6,
  turnMax: 0.8,
}

const REVERSAL_PULSE = 1
const MOTOR_TAU = 0.08
/** Each group's inhibition of the other. */
const MUTUAL_INHIBITION = 1.2
/** The reverse group's loop onto itself — the recurrent connection that keeps a reversal running. */
const REVERSE_SELF = 0.5
/** The forward group's standing drive: forward is what happens by default. */
const FORWARD_DRIVE = 0.6
/** Stopping to eat, seconds; relief adds rest on top. */
export const FEEDING_PAUSE_S = 0.8
/**
 * Fleeing is running. While a verdict routed to the reverse group fires,
 * the animal moves faster; the rule for turning already reverses it when
 * the thing it flees is rising, and inside a shadow the fastest way out is
 * straight on. A flee built as extra reversals was tried twice — a jitter
 * that never left the shadow, then a blind run into the next one — and an
 * animal with no verdict at all did better than either.
 */
export const FLEE_SPEED = 0.6

/**
 * The klinokinesis rule, as a rate. `worse` is how much the comparison has
 * moved the wrong way for the route — a falling net input for a verdict
 * routed forward, a rising one for a verdict routed to reverse — and only
 * that direction raises the rate. Pure function, so the test can assert the
 * shape of it directly.
 */
export function reversalRate(worse: number, arousal: number, relief: number): number {
  const spontaneous = TUNING.spontaneous * (1 - 0.6 * relief)
  return arousal * (spontaneous + TUNING.gain * Math.max(0, worse))
}

// ---- energy ------------------------------------------------------------

const ENERGY_REST = 0.02
const ENERGY_PER_UNIT = 0.04
const ENERGY_PER_REVERSAL = 0.25
const ENERGY_PER_TURN = 0.15

export type Mode = 'forward' | 'reverse' | 'turning'

export class Worm {
  chain: Point[]
  /** The heading the animal is travelling on, radians from +X toward +Z. */
  course: number
  phase = 0
  cells: SensoryCell[]
  circuit: Circuit
  mod: ModulatorState
  motor = { forward: FORWARD_DRIVE, reverse: 0, pulse: 0 }
  mode: Mode = 'forward'
  private turnLeft = 0
  private turnRate = 0
  pauseLeft = 0
  /** A world may slow the animal — inside decaying matter, say. */
  speedFactor = 1

  // Live readouts, one per interneuron.
  net: number[]
  /** now − a moment ago, of the net input. */
  delta: number[]
  output: number[]
  /**
   * The comparison the steering rule actually uses for each interneuron:
   * the net input's change for a verdict routed forward, the verdict's own
   * change for one routed to reverse. Approach is a search on the evidence
   * — the chapter's worm climbs concentration — and avoidance is a response
   * to the verdict, which is what lets the threshold decide what is fled.
   */
  steer: number[]
  private outputNow: number[]
  private outputTrace: number[]
  /** The current reversal rate, per second. */
  rate = 0
  /** Total drive from verdicts routed to the reverse group — what runs. */
  flee = 0
  lastReversalAt: number | null = null

  reversals = 0
  turns = 0
  timeInReverse = 0
  distance = 0
  energy = 0
  time = 0

  constructor(
    circuit: Circuit,
    biology: readonly ChannelBiology[],
    modulators: Partial<Levels> = {},
    start: { x: number; z: number; heading: number } = { x: 0, z: 0, heading: 0 },
  ) {
    this.circuit = circuit
    this.cells = biology.map((b) => ({
      channel: b.channel,
      pursuitDrives: !!b.pursuitDrives,
      hungerSilences: !!b.hungerSilences,
      concentration: 0,
      gain: 1,
      output: 0,
      now: 0,
      trace: 0,
      delta: 0,
    }))
    this.mod = makeModulators(modulators)
    this.net = circuit.interneurons.map(() => 0)
    this.delta = circuit.interneurons.map(() => 0)
    this.output = circuit.interneurons.map(() => 0)
    this.steer = circuit.interneurons.map(() => 0)
    this.outputNow = circuit.interneurons.map(() => 0)
    this.outputTrace = circuit.interneurons.map(() => 0)
    this.course = start.heading
    this.chain = []
    this.placeAt(start.x, start.z, start.heading)
  }

  /** Lay the body out straight behind the head, pointing along `heading`. */
  placeAt(x: number, z: number, heading: number): void {
    this.course = heading
    const cx = Math.cos(heading)
    const cz = Math.sin(heading)
    this.chain = Array.from({ length: SEGMENTS }, (_, i) => ({
      x: x - cx * SPACING * i,
      z: z - cz * SPACING * i,
    }))
  }

  get head(): Point {
    return this.chain[0]
  }

  /** Total drive from verdicts routed to the forward group — what feeds. */
  get feedDrive(): number {
    let d = 0
    this.circuit.routes.forEach((r, j) => {
      if (r === 'forward') d += this.output[j]
    })
    return Math.min(1, d)
  }

  /** Verdicts as good news (+) or bad news (−), for the affect plane. */
  get signedVerdict(): number {
    let v = 0
    this.circuit.routes.forEach((r, j) => {
      v += (r === 'forward' ? 1 : -1) * this.output[j]
    })
    return Math.max(-1, Math.min(1, v))
  }

  /** Seconds the reverse group has kept itself running since the last trigger. */
  get reverseHeldFor(): number | null {
    if (this.lastReversalAt === null || this.motor.reverse < 0.05) return null
    return this.time - this.lastReversalAt
  }

  /** Stop to eat, for a moment — plus rest, if the chemistry says so. */
  pause(seconds: number): void {
    this.pauseLeft = Math.max(this.pauseLeft, seconds)
  }

  step(
    dt: number,
    sources: readonly CueSource[],
    rng: Rng,
    bounds: number,
    scaleOf: (s: CueSource) => number = () => 1,
  ): void {
    const lv = this.mod.level

    // 1. Sense, at the head, one cell per channel.
    const c = concentrations(this.head.x, this.head.z, sources, scaleOf)
    for (const cell of this.cells) {
      cell.concentration = c[cell.channel]
      cell.gain = (cell.pursuitDrives ? lv.pursuit : 1) * (cell.hungerSilences ? lv.satiety : 1)
      cell.output = sensoryOutput(cell.concentration, cell.gain)
      cell.now += ((cell.output - cell.now) * dt) / TUNING.nowTau
      cell.trace += ((cell.output - cell.trace) * dt) / TUNING.traceTau
      cell.delta = cell.now - cell.trace
    }
    const x = this.cells.map((s) => s.output)
    const dx = this.cells.map((s) => s.delta)

    // 2. The circuit: each interneuron's verdict on the levels, and the same
    //    weights over the comparisons.
    let worse = 0
    let flee = 0
    this.circuit.interneurons.forEach((u, j) => {
      const net = netInput(u, x)
      const delta = netInput({ ...u, baseline: 0 }, dx)
      const y = activate(this.circuit.activation, net, u.threshold)
      this.net[j] = net
      this.delta[j] = delta
      this.output[j] = y
      this.outputNow[j] += ((y - this.outputNow[j]) * dt) / TUNING.nowTau
      this.outputTrace[j] += ((y - this.outputTrace[j]) * dt) / TUNING.traceTau
      if (this.circuit.routes[j] === 'forward') {
        this.steer[j] = delta
        worse += Math.max(0, -delta)
      } else {
        this.steer[j] = this.outputNow[j] - this.outputTrace[j]
        worse += Math.max(0, this.steer[j])
        flee += y
      }
    })
    this.flee = Math.min(1, flee)

    // 3. The rule about when to turn.
    this.rate = reversalRate(worse, lv.arousal, lv.relief)
    const canTrigger = this.mode === 'forward' && this.pauseLeft <= 0
    if (canTrigger && rng.next() < 1 - Math.exp(-this.rate * dt)) {
      this.motor.pulse = REVERSAL_PULSE
      this.reversals++
      this.energy += ENERGY_PER_REVERSAL
      this.lastReversalAt = this.time
    }

    // 4. Two motor groups that inhibit each other; whichever is ahead wins.
    const m = this.motor
    m.pulse -= (m.pulse * dt) / TUNING.pulseTau
    const fIn = Math.max(0, FORWARD_DRIVE - MUTUAL_INHIBITION * m.reverse)
    const rIn = Math.max(0, m.pulse + REVERSE_SELF * m.reverse - MUTUAL_INHIBITION * m.forward)
    m.forward += ((fIn - m.forward) * dt) / MOTOR_TAU
    m.reverse += ((rIn - m.reverse) * dt) / MOTOR_TAU

    const reverseWins = m.reverse > m.forward
    if (this.mode === 'reverse' && !reverseWins) this.beginTurn(rng)
    else if (this.mode !== 'reverse' && reverseWins) {
      this.mode = 'reverse'
      this.turnLeft = 0
    }

    // 5. Move.
    this.phase += (2 * Math.PI * dt) / TUNING.sweepPeriod
    const sweep = TUNING.sweepAmplitude * Math.sin(this.phase)
    if (this.pauseLeft > 0) {
      this.pauseLeft -= dt
    } else if (this.mode === 'reverse') {
      this.timeInReverse += dt
      const n = this.chain.length
      const tail = this.chain[n - 1]
      const prev = this.chain[n - 2]
      const tangent = Math.atan2(tail.z - prev.z, tail.x - prev.x)
      const d = TUNING.reverseSpeed * this.speedFactor * dt
      this.advance(n - 1, tangent + sweep, d, bounds, () => {
        // Backed into the wall: the reversal is over.
        m.pulse = 0
        m.reverse = 0
      })
      this.distance += d
    } else {
      let speed = TUNING.forwardSpeed * this.speedFactor
      if (this.mode === 'turning') {
        speed *= 0.5
        this.course += this.turnRate * dt
        this.turnLeft -= dt
        if (this.turnLeft <= 0) this.mode = 'forward'
      } else {
        speed *= 1 + FLEE_SPEED * this.flee
      }
      const d = speed * dt
      this.advance(0, this.course + sweep, d, bounds, (axis) => {
        this.course = wrapAngle(axis === 'x' ? Math.PI - this.course : -this.course)
      })
      this.distance += d
    }

    // 6. The chemistry relaxes toward its set-points.
    relaxModulators(this.mod, dt)

    // 7. Bookkeeping.
    this.energy += (ENERGY_REST + ENERGY_PER_UNIT * this.speedFactor) * dt
    this.time += dt
  }

  /** The deep bend: the head swings onto a new heading drawn from the stream. */
  private beginTurn(rng: Rng): void {
    const p0 = this.chain[0]
    const p1 = this.chain[1]
    this.course = Math.atan2(p0.z - p1.z, p0.x - p1.x)
    // A deep bend reorients the animal by most of a half-turn — the way
    // things were better — with the exact angle and its side drawn from the
    // stream. No direction information enters here: it is a fixed motor
    // pattern with noise on it.
    // An aroused animal overreacts: the bend that follows a reversal is
    // wilder, so its new heading is less often back the way things were
    // better. (A longer reversal was tried instead and backed the animal
    // tail-first into things it could not sense.)
    const excess = Math.max(0, this.mod.level.arousal - 1)
    const least = TUNING.turnMin / (1 + 0.5 * excess)
    const angle = (rng.next() < 0.5 ? -1 : 1) * Math.PI * (least + (TUNING.turnMax - least) * rng.next())
    const seconds = TUNING.turnSeconds * (1 + 0.06 * excess)
    this.turnRate = angle / seconds
    this.turnLeft = seconds
    this.mode = 'turning'
    this.turns++
    this.energy += ENERGY_PER_TURN
  }

  /**
   * Move one end of the body along `dir` by `dist`, keeping it inside the
   * dish, then pull the rest of the body after it segment by segment. Leading
   * from the head runs the wave head to tail; leading from the tail runs it
   * the other way.
   */
  private advance(
    lead: number,
    dir: number,
    dist: number,
    bounds: number,
    onWall: (axis: 'x' | 'z') => void,
  ): void {
    const p = this.chain[lead]
    p.x += Math.cos(dir) * dist
    p.z += Math.sin(dir) * dist
    const lim = bounds - 0.15
    if (p.x > lim || p.x < -lim) {
      p.x = Math.max(-lim, Math.min(lim, p.x))
      onWall('x')
    }
    if (p.z > lim || p.z < -lim) {
      p.z = Math.max(-lim, Math.min(lim, p.z))
      onWall('z')
    }
    const n = this.chain.length
    const step = lead === 0 ? 1 : -1
    for (let k = lead + step; k >= 0 && k < n; k += step) {
      const ahead = this.chain[k - step]
      const me = this.chain[k]
      const ddx = me.x - ahead.x
      const ddz = me.z - ahead.z
      const len = Math.hypot(ddx, ddz) || 1e-9
      me.x = ahead.x + (ddx / len) * SPACING
      me.z = ahead.z + (ddz / len) * SPACING
    }
  }
}

