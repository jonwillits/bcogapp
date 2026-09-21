import { DishWorld, DISH_BOUNDS, REACH, type DishOptions } from '../dishWorld'
import type { CueSource } from '../fields'
import { unitOutput } from '../unit'
import { Learner, type LearningSettings } from './learner'
import type { LearningScenario, SiteSpec } from './scenarios'

/**
 * Lab 4's dish with the learning layer attached — the same world, the same
 * animal, the same step, and one thing added after each step: the learning
 * rule is shown what the step delivered and moves the weights.
 *
 * It also runs the one world mechanism Module 5's conditioning scenarios
 * need and Lab 4's did not. A **site** is a place marked by one or more
 * cues. When the animal touches it, the cues linger a moment and dissolve,
 * and whatever the site holds is delivered after the scenario's interval —
 * food, or a toxin, or nothing. Delivery does not wait on the animal's
 * verdict: what the world does at a site is the world's business, which is
 * what makes a cue something that can be learned about from a standing start.
 *
 * **Nothing here is a record of an occasion.** The traces below are the
 * experimenter's instruments — fixed-length ring buffers of a signal, like
 * Lab 4's — and nothing in the animal reads them.
 */

/** A touched site's cues linger this long before they dissolve, seconds: the window coincidence has to work in. */
export const CUE_LINGER_S = 1.5
/** How long "nothing arrived" takes to be true, seconds — as long as a meal takes to eat. */
export const OMISSION_S = 1
/** A marked site nobody finds moves on after this long, seconds. */
const SITE_LIFETIME_S = 45
/** Delivered food waits this long to be eaten, seconds. */
const PAYLOAD_LIFETIME_S = 20
/** Marker plumes are as strong as Lab 4's Part 2 plumes, so a cue at a site is present — an input of exactly 1. */
const SITE_STRENGTH = 8
/**
 * Narrow, and far apart: a marker reads as present within reach of its site and
 * as nearly nothing at the next site over. Broad markers (1.8) were tried and
 * every meal then coincided with the faint salt of the other sites, which was
 * enough to start the runaway whatever the interval said.
 */
const SITE_SCALE = 1
const SITE_SPACING = 7
/** After a meal in the lane the animal stays long enough for the news to land, then is returned, seconds. */
const LANE_RETURN_S = 2.5
const LANE_TIMEOUT_S = 90
export const CHAIN_TRIALS_KEPT = 12
/** An unpaired delivery waits until the cue's cell reads below this. */
const UNPAIRED_BELOW = 0.2
/** The weight trace keeps one sample every half second, for the last ten minutes. */
export const WEIGHT_SAMPLE_S = 0.5
export const WEIGHT_TRACE_LEN = 1200
/** The signal traces keep one sample every tenth of a second, for the last minute. */
export const SIGNAL_SAMPLE_S = 0.1
export const SIGNAL_TRACE_LEN = 600

interface Site {
  id: number
  x: number
  z: number
  spec: SiteSpec
  born: number
  /** Ids of the marker plumes still standing. */
  markers: number[]
  touchedAt: number | null
  delivered: boolean
  /** Id of the delivered food or toxin, while it waits to be eaten. */
  payload: number | null
}

export interface LearningDishOptions extends DishOptions {
  learning?: Partial<LearningSettings>
  /** Seconds between touching a site and what it holds arriving. */
  interval?: number
  /** Scenario switches a student can flip: a second cue at every site, which cue marks food. */
  flags?: Record<string, boolean>
}

export class LearningDish extends DishWorld {
  declare readonly scenario: LearningScenario
  readonly learner: Learner
  interval: number
  flags: Record<string, boolean>
  sites: Site[] = []
  /** Where the animal is and which session this is — what the context cells report. */
  context = { dish: 0 as 0 | 1, later: false }
  /** Unannounced meals delivered by hand. A count. */
  delivered = 0
  deliveryPending = false
  /** Which of the scenario's phases the dish is in. */
  phase = 0
  /** Sites touched so far. A count, not a list. */
  trials = 0
  /** Seconds left of a "nothing arrived" now being resolved. */
  private omissionLeft = 0
  private nextSite = 1
  /** The weights when the run started — what the weight trace prints beside the live values. */
  readonly startWeights: number[]
  weightTrace: number[][]
  signalTrace = { phi: [] as number[], broadcast: [] as number[], value: [] as number[], output: [] as number[] }
  /** Lane trials finished, and the instruments the Credit section reads. A count and a short ring, on the experimenter's side. */
  laneTrials = 0
  /** For each of the last few trials: what the critic held each point of the chain to be worth, and the surprise left at the food. */
  chainByTrial: { values: number[]; atFood: number }[] = []
  private trialBegan = 0
  private returnAt: number | null = null
  private distractorAt = 0
  private surpriseAtFood = 0
  private sinceWeightSample = 0
  private sinceSignalSample = 0

  constructor(seed: number, scenario: LearningScenario, opts: LearningDishOptions = {}) {
    super(seed, scenario, opts)
    const spec = scenario.learning
    const actor = this.worm.circuit.interneurons[0]
    this.learner = new Learner(actor, spec.config, { ...spec.settings, ...opts.learning })
    this.interval = opts.interval ?? spec.interval ?? 0
    this.flags = { ...spec.flags, ...opts.flags }
    this.startWeights = [...actor.weights]
    this.weightTrace = actor.weights.map((b) => [b])
    this.layOutSites()
    if (spec.lane) {
      this.worm.laneHalfWidth = spec.lane.halfWidth
      this.beginLaneTrial()
    }
  }

  /** Put the animal at the start of the lane, facing along it. Nothing carries across: it was picked up and put down. */
  private beginLaneTrial(): void {
    const lane = this.scenario.learning.lane!
    this.worm.placeAt(lane.startX, 0, 0)
    this.worm.mode = 'forward'
    this.learner.cut()
    this.trialBegan = this.time
    this.returnAt = null
    this.surpriseAtFood = 0
    this.distractorAt = this.rng.range(0.5, 3)
    if (!this.sources.some((s) => s.channel === 0)) {
      for (const spec of this.scenario.sources) this.spawn(spec, spec.x, spec.z)
    }
  }

  private runLane(): void {
    const lane = this.scenario.learning.lane!
    const x = this.worm.head.x
    const drive = this.worm.internalDrive
    for (const z of lane.zones) drive[z.cell] = x >= z.from && x <= z.to ? 1 : 0
    if (lane.distractor) {
      const t = this.time - this.trialBegan
      drive[lane.distractor.cell] = t >= this.distractorAt && t < this.distractorAt + lane.distractor.seconds ? 1 : 0
    }
    // The surprise at the food: the broadcast signal on the step of delay the meal falls in.
    if (this.returnAt !== null && this.time < this.returnAt - LANE_RETURN_S + 1.2) this.surpriseAtFood = Math.max(this.surpriseAtFood, this.learner.broadcast)
    const timedOut = this.returnAt === null && this.time - this.trialBegan > LANE_TIMEOUT_S
    if (timedOut || (this.returnAt !== null && this.time >= this.returnAt)) {
      if (!timedOut) {
        this.laneTrials++
        this.chainByTrial.push({ values: lane.chain.map((c) => this.learner.critic.weights[c.cell]), atFood: this.surpriseAtFood })
        if (this.chainByTrial.length > CHAIN_TRIALS_KEPT) this.chainByTrial.shift()
      }
      this.beginLaneTrial()
    }
  }

  /** What the context cells report now. */
  private runContext(): void {
    const c = this.scenario.learning.context!
    const drive = this.worm.internalDrive
    drive[c.dishes[0]] = this.context.dish === 0 ? 1 : 0
    drive[c.dishes[1]] = this.context.dish === 1 ? 1 : 0
    drive[c.sessions[0]] = this.context.later ? 0 : 1
    drive[c.sessions[1]] = this.context.later ? 1 : 0
  }

  /** Time passes with no training of any kind: the animal is set aside and comes back in a later session. Nothing about any weight changes. */
  wait(): void {
    this.context.later = true
    this.runContext()
    this.learner.cut()
  }

  /** The animal is moved to the other dish. Nothing about any weight changes. */
  moveDish(): void {
    this.context.dish = this.context.dish === 0 ? 1 : 0
    this.runContext()
    this.learner.cut()
    this.layOutSites()
  }

  /**
   * One meal at the animal's mouth, unannounced and unpaired: no cue marks
   * it. It waits until the animal is clear of the cue, because a meal that
   * lands while the animal is standing in salt is a pairing, not an unpaired
   * delivery (one seed in four did exactly that).
   */
  deliverOutcome(): void {
    if (this.scenario.learning.outcomeChannel !== undefined) this.deliveryPending = true
  }

  private runDelivery(): void {
    const spec = this.scenario.learning
    const cue = spec.context?.cue ?? 1
    if ((this.worm.cells[cue]?.output ?? 0) > UNPAIRED_BELOW) return
    const head = this.worm.head
    const p = this.spawn(
      { channel: spec.outcomeChannel!, x: head.x, z: head.z, strength: SITE_STRENGTH, scale: 1, lifetime: 6, respawn: 'none' },
      head.x,
      head.z,
    )
    p.carries = 'nourish'
    this.deliveryPending = false
    this.delivered++
  }

  /**
   * The response: what the verdict would be to the cue alone, here and now —
   * the cue present, the context cells as they currently are, nothing else.
   * Computed from the weights; nothing is looked up.
   */
  responseToCue(): number {
    const c = this.scenario.learning.context
    const circuit = this.worm.circuit
    const x = this.worm.cells.map((cell, i) => (cell.internal ? (this.worm.internalDrive[i] ?? 0) : 0))
    x[c ? c.cue : 1] = 1
    return unitOutput(circuit.interneurons[0], x, circuit.activation)
  }

  /**
   * Skip ahead: simulated time the dish owes, paid down a slice per frame
   * without drawing the frames in between. A minute of this dish is a few
   * milliseconds of arithmetic; what makes a student wait is the screen being
   * redrawn thirty times a second at a speed the machine may not reach. The
   * traces record through a skip, so the whole curve is there afterward, and
   * a skip paid in slices is the same run as one paid at once, by test.
   */
  skipRemaining = 0

  skipAhead(seconds: number): void {
    this.skipRemaining += seconds
  }

  /** Pay down up to `seconds` of the skip. Returns what is still owed. */
  paySkip(seconds: number): number {
    const dt = 1 / 30
    const steps = Math.round(Math.min(seconds, this.skipRemaining) / dt)
    for (let i = 0; i < steps; i++) this.step(dt)
    this.skipRemaining = Math.max(0, this.skipRemaining - steps * dt)
    if (this.skipRemaining < dt / 2) this.skipRemaining = 0
    return this.skipRemaining
  }

  /** Move the dish to another of the scenario's phases. The animal and its weights carry over; the sites do not. */
  setPhase(k: number): void {
    const n = this.scenario.learning.phases?.length ?? 1
    this.phase = Math.max(0, Math.min(n - 1, k))
    this.layOutSites()
  }

  /** Clear the sites and lay out the ones the scenario asks for now. */
  layOutSites(): void {
    for (const site of this.sites) this.clearSite(site)
    this.sites = []
    for (const spec of this.scenario.learning.sites?.(this) ?? []) this.placeSite(spec)
  }

  private placeSite(spec: SiteSpec): void {
    const head = this.worm.head
    // Clear of the animal, and far enough from every other site that two
    // sites never read as one.
    let p = this.clearGround(head.x, head.z)
    for (let tries = 0; tries < 40; tries++) {
      if (this.sites.every((q) => Math.hypot(q.x - p.x, q.z - p.z) >= SITE_SPACING)) break
      p = this.clearGround(head.x, head.z)
    }
    const site: Site = {
      id: this.nextSite++,
      x: p.x,
      z: p.z,
      spec,
      born: this.time,
      markers: [],
      touchedAt: null,
      delivered: false,
      payload: null,
    }
    for (const channel of spec.cues) {
      const s = this.spawn(
        { channel, x: p.x, z: p.z, strength: SITE_STRENGTH, scale: SITE_SCALE, lifetime: null, respawn: 'none' },
        p.x,
        p.z,
      )
      s.carries = 'ignore'
      site.markers.push(s.id)
    }
    this.sites.push(site)
  }

  private clearSite(site: Site): void {
    const gone = new Set([...site.markers, ...(site.payload === null ? [] : [site.payload])])
    this.sources = this.sources.filter((s) => !gone.has(s.id))
    site.markers = []
    site.payload = null
  }

  private moveSite(site: Site): void {
    this.clearSite(site)
    this.sites = this.sites.filter((s) => s !== site)
    this.placeSite(site.spec)
  }

  /** A delivered payload that is eaten, or that nobody comes back for, takes its site with it. */
  protected override respawn(s: CueSource): void {
    const site = this.sites.find((q) => q.payload === s.id)
    if (site) this.moveSite(site)
    else if (this.scenario.learning.lane) {
      // The food at the end of the lane: eaten, and back once the animal is returned to the start.
      this.sources = this.sources.filter((q) => q.id !== s.id)
      this.returnAt = this.time + LANE_RETURN_S
    } else super.respawn(s)
  }

  override step(dt: number): void {
    this.runSites()
    if (this.scenario.learning.lane) this.runLane()
    if (this.scenario.learning.context) this.runContext()
    if (this.deliveryPending) this.runDelivery()
    super.step(dt)

    if (this.omissionLeft > 0) {
      this.omissionLeft -= dt
      this.arriving = 0
    }

    const w = this.worm
    const x = w.cells.map((cell) => cell.output)
    this.learner.step(dt, {
      x,
      y: w.output[0] ?? 0,
      arriving: this.arriving,
      target: this.scenario.learning.teacher?.(x, this) ?? null,
      news: this.news,
    })
    this.sample(dt)
  }

  private runSites(): void {
    const head = this.worm.head
    const us = this.scenario.learning.outcomeChannel
    for (const site of [...this.sites]) {
      if (site.touchedAt === null) {
        if (Math.hypot(site.x - head.x, site.z - head.z) <= REACH) {
          site.touchedAt = this.time
          this.trials++
        } else if (this.time - site.born > SITE_LIFETIME_S) {
          this.moveSite(site)
        }
        continue
      }
      const since = this.time - site.touchedAt
      if (since >= CUE_LINGER_S && site.markers.length > 0) {
        const gone = new Set(site.markers)
        this.sources = this.sources.filter((s) => !gone.has(s.id))
        site.markers = []
      }
      if (!site.delivered && since >= this.interval) {
        site.delivered = true
        if (site.spec.payload === 'nothing' || us === undefined) {
          this.omissionLeft = OMISSION_S
          this.emptyVisits++
        } else {
          const p = this.spawn(
            { channel: us, x: site.x, z: site.z, strength: SITE_STRENGTH, scale: 1, lifetime: PAYLOAD_LIFETIME_S, respawn: 'none' },
            site.x,
            site.z,
          )
          p.carries = site.spec.payload
          site.payload = p.id
        }
      }
      // An empty site is done once its cues have dissolved and the omission has been resolved.
      if (site.delivered && site.payload === null && site.markers.length === 0 && this.omissionLeft <= 0) this.moveSite(site)
    }
  }

  private sample(dt: number): void {
    this.sinceWeightSample += dt
    if (this.sinceWeightSample >= WEIGHT_SAMPLE_S) {
      this.sinceWeightSample = 0
      this.learner.actor.weights.forEach((b, i) => push(this.weightTrace[i], b, WEIGHT_TRACE_LEN))
    }
    this.sinceSignalSample += dt
    if (this.sinceSignalSample >= SIGNAL_SAMPLE_S) {
      this.sinceSignalSample = 0
      const l = this.learner
      push(this.signalTrace.phi, l.phi, SIGNAL_TRACE_LEN)
      push(this.signalTrace.broadcast, l.broadcast, SIGNAL_TRACE_LEN)
      push(this.signalTrace.value, l.value, SIGNAL_TRACE_LEN)
      push(this.signalTrace.output, this.worm.output[0] ?? 0, SIGNAL_TRACE_LEN)
    }
  }
}

function push(arr: number[], v: number, cap: number): void {
  arr.push(v)
  if (arr.length > cap) arr.shift()
}

export { DISH_BOUNDS }
