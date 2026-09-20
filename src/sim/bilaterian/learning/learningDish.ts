import { DishWorld, DISH_BOUNDS, REACH, type DishOptions } from '../dishWorld'
import type { CueSource } from '../fields'
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
    else super.respawn(s)
  }

  override step(dt: number): void {
    this.runSites()
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
