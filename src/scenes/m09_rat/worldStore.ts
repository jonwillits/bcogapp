import { makeRng } from '../../sim/random'
import { Body, RANGE_LOCOMOTION, type Command } from '../../sim/rodent/body'
import { RANGE, pushOut } from '../../sim/rodent/range'

/**
 * Part 0's state (spec §0): the tour. The range in moonlight with the nest
 * in view, the two camera views, and nothing scored: a place to learn the
 * keys before Part 1's practice.
 */
export class WorldStore {
  readonly body: Body
  /** Begin pressed: the orienting panel over the view is gone. */
  started = false
  version = 0
  private listeners = new Set<() => void>()

  constructor(seed: number) {
    this.body = new Body(makeRng(seed).fork(), RANGE_LOCOMOTION, { x: 1.5, y: -1.5, heading: Math.PI / 2 })
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  begin(): void {
    this.started = true
    this.version++
    for (const fn of this.listeners) fn()
  }

  step(dt: number, cmd: Command): void {
    this.body.step(dt, cmd, null)
    const clear = pushOut(this.body.x, this.body.y, this.body.loco.radius)
    this.body.x = clear.x
    this.body.y = clear.y
    const r = Math.hypot(this.body.x, this.body.y)
    if (r > RANGE.radius) {
      this.body.x *= RANGE.radius / r
      this.body.y *= RANGE.radius / r
    }
  }
}
