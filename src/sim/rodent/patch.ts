import { makeRng, type Rng } from '../random'
import { RANGE_LOCOMOTION } from './body'
import { RANGE } from './range'

/**
 * The closer, Stay or Go (spec §10.1): the forager goes out at night to
 * patches of beetles. In a patch, beetles turn up quickly at first and then
 * more and more slowly; moving to another patch takes time. The student
 * sets one rule — leave when beetles turn up more slowly than one every
 * so many seconds — and a night runs. The rule concerns when leaving pays
 * best, not how an animal comes to leave (§11, line 10).
 */

export type Habitat = 'rich' | 'poor'

export interface HabitatSpec {
  id: Habitat
  label: string
  /** Beetles per second when a patch is fresh. */
  rate0: number
  /** Seconds over which a patch's rate falls by two thirds. */
  tau: number
  /** Distance between patches, meters; travel takes this at the range pace. */
  spacing: number
}

export const HABITATS: HabitatSpec[] = [
  { id: 'rich', label: 'rich habitat', rate0: 0.5, tau: 20, spacing: 12 },
  { id: 'poor', label: 'poor habitat', rate0: 0.2, tau: 20, spacing: 30 },
]

export const habitatById = (id: Habitat): HabitatSpec => HABITATS.find((h) => h.id === id)!

/** The settings *Try every setting* runs: seconds between beetles at which the forager leaves. */
export const SETTINGS = [2, 3, 4, 6, 8, 10, 12, 15, 20, 25]
export const DEFAULT_SETTING = 8
/** A night, in simulated seconds. */
export const NIGHT = 4 * 3600

/** Travel time between patches, seconds. */
export const travelTime = (h: HabitatSpec): number => h.spacing / RANGE_LOCOMOTION.speed

/** Beetles gained in a patch after `t` seconds: the integral of the falling rate. */
export const gained = (h: HabitatSpec, t: number): number => h.rate0 * h.tau * (1 - Math.exp(-t / h.tau))

/**
 * The habitat's average rate when leaving is timed best (§9.2.9): the
 * largest value of beetles gained per second of patch time plus travel,
 * which the patch's falling rate equals at the moment to leave. The
 * setting it predicts is one beetle every 1/rate seconds.
 */
export function averageRate(h: HabitatSpec): { rate: number; leaveAfter: number; setting: number } {
  const T = travelTime(h)
  let best = { rate: 0, leaveAfter: 0 }
  for (let t = 0.5; t < 300; t += 0.5) {
    const rate = gained(h, t) / (t + T)
    if (rate > best.rate) best = { rate, leaveAfter: t }
  }
  return { rate: best.rate, leaveAfter: best.leaveAfter, setting: 1 / best.rate }
}

/** The setting among SETTINGS nearest the one the habitat's average rate predicts. */
export function predictedSetting(h: HabitatSpec): number {
  const want = averageRate(h).setting
  return SETTINGS.reduce((a, b) => (Math.abs(b - want) < Math.abs(a - want) ? b : a))
}

export interface NightResult {
  beetles: number
  patches: number
  /** Beetles per minute over the whole night. */
  perMinute: number
}

export interface PatchEvent {
  t: number
  kind: 'beetle' | 'leave' | 'arrive'
}

/**
 * One night under one rule, run as events. Patches are visited in a seeded
 * order around the nest; the forager's position, for the drawing, is where
 * the night's clock puts it: in a patch, or on the way to the next.
 */
export class Night {
  readonly habitat: HabitatSpec
  readonly setting: number
  readonly rng: Rng
  time = 0
  beetles = 0
  patches = 1
  /** Time in the current patch, and since the last beetle there. */
  inPatch = 0
  sinceBeetle = 0
  traveling = 0
  /** Where the forager is, for the drawing: the current patch's center, or between two. */
  patchAt!: { x: number; y: number }
  nextPatch!: { x: number; y: number }
  readonly events: PatchEvent[] = []
  private angle: number

  constructor(habitat: HabitatSpec, setting: number, seed: number) {
    this.habitat = habitat
    this.setting = setting
    this.rng = makeRng(seed)
    this.angle = this.rng.range(0, 2 * Math.PI)
    this.patchAt = this.placePatch()
    this.nextPatch = this.placePatch()
  }

  /**
   * The next patch: one spacing away from the last, in a direction that turns
   * on by 0.6 to 1.4 rad each time, turned back toward the nest when the range's
   * edge is near. Two draws, as before (Jon's walk, 2026-10-20: the patches had
   * been placed about the nest at 0.4 to 0.9 of the spacing, so the drawn
   * forager covered less than the spacing in the travel time); the beetles do
   * not depend on where the patches are, only on the travel time.
   */
  private placePatch(): { x: number; y: number } {
    this.angle += this.rng.range(0.6, 1.4)
    const r = this.habitat.spacing * this.rng.range(0.9, 1.1)
    const from = this.patchAt ?? { x: 0, y: 0 }
    let x = from.x + r * Math.cos(this.angle)
    let y = from.y + r * Math.sin(this.angle)
    if (Math.hypot(x, y) > RANGE.radius - 4) {
      this.angle = Math.atan2(-from.y, -from.x) + 0.4
      x = from.x + r * Math.cos(this.angle)
      y = from.y + r * Math.sin(this.angle)
    }
    return { x, y }
  }

  /** The forager's position now. */
  position(): { x: number; y: number } {
    if (this.traveling <= 0) return this.patchAt
    const T = travelTime(this.habitat)
    const k = 1 - this.traveling / T
    return { x: this.patchAt.x + k * (this.nextPatch.x - this.patchAt.x), y: this.patchAt.y + k * (this.nextPatch.y - this.patchAt.y) }
  }

  get phase(): 'in a patch' | 'traveling' {
    return this.traveling > 0 ? 'traveling' : 'in a patch'
  }

  step(dt: number): void {
    this.time += dt
    if (this.traveling > 0) {
      this.traveling -= dt
      if (this.traveling <= 0) {
        this.traveling = 0
        this.patchAt = this.nextPatch
        this.nextPatch = this.placePatch()
        this.patches++
        this.inPatch = 0
        this.sinceBeetle = 0
        this.events.push({ t: this.time, kind: 'arrive' })
      }
      return
    }
    this.inPatch += dt
    this.sinceBeetle += dt
    const rate = this.habitat.rate0 * Math.exp(-this.inPatch / this.habitat.tau)
    if (this.rng.next() < rate * dt) {
      this.beetles++
      this.sinceBeetle = 0
      this.events.push({ t: this.time, kind: 'beetle' })
    }
    if (this.sinceBeetle > this.setting) {
      this.traveling = travelTime(this.habitat)
      this.events.push({ t: this.time, kind: 'leave' })
    }
    if (this.events.length > 200) this.events.splice(0, this.events.length - 200)
  }

  run(seconds: number, dt = 0.1): void {
    const n = Math.round(seconds / dt)
    for (let i = 0; i < n; i++) this.step(dt)
  }

  result(): NightResult {
    return { beetles: this.beetles, patches: this.patches, perMinute: this.time > 0 ? (this.beetles / this.time) * 60 : 0 }
  }
}

/** *Try every setting*: a seeded night at each setting, beetles per minute against the setting. */
export function tryEverySetting(habitat: HabitatSpec, seed: number, seconds = NIGHT): { setting: number; perMinute: number }[] {
  return SETTINGS.map((setting, i) => {
    const night = new Night(habitat, setting, seed + i * 7)
    night.run(seconds)
    return { setting, perMinute: night.result().perMinute }
  })
}

export function bestSetting(curve: { setting: number; perMinute: number }[]): number {
  return curve.reduce((a, b) => (b.perMinute > a.perMinute ? b : a)).setting
}
