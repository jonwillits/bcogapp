import { angleDiff, rad } from './angles'

/**
 * Whether a landmark stays where it is, as far as the system can tell.
 *
 * A landmark is worth using to correct the sum only if it stays where it
 * is (§9.2.3), and cues a rat has seen move have little control over its
 * cells (§9.3.1, §9.3.5). The system has one way to tell: while a landmark
 * is in view, its bearing should change only as the head turns. A bearing
 * that jumps within one step, with no turn signal to match, is a landmark
 * that moved. Each such jump lowers the landmark's stability, which scales
 * its input to the rings and its weight in the position estimate. A
 * landmark moved while out of view cannot be caught this way: on return it
 * is simply seen somewhere new, and treated as stable (§9.3.1: the card
 * turned out of sight turns every cell with it).
 *
 * Parallax from the rat's own walking changes a near landmark's bearing by
 * under a degree a step and never trips the test; vestibular noise is
 * smaller still.
 */

/** A bearing change in one step, net of the turn signal, larger than this is a jump. */
export const JUMP = rad(15)
/** Stability is multiplied by this at each seen jump. Measured against it, a card's control is gone after about three moves (`system.test.ts`). */
export const MOVED_PENALTY = 0.5

export class Stability {
  private readonly value = new Map<string, number>()
  private readonly lastBearing = new Map<string, number>()

  of(id: string): number {
    return this.value.get(id) ?? 1
  }

  /** Forget everything seen: the rat was picked up. The stability values themselves are kept. */
  cut(): void {
    this.lastBearing.clear()
  }

  /**
   * One step: `turn` is the turn signal over the step in radians (positive
   * counterclockwise), so a stable landmark's bearing changes by about
   * −turn. Returns the ids that jumped this step.
   */
  step(views: readonly { id: string; bearing: number }[], turn: number): string[] {
    const jumped: string[] = []
    const seen = new Set<string>()
    for (const v of views) {
      seen.add(v.id)
      const last = this.lastBearing.get(v.id)
      if (last !== undefined) {
        const expected = last - turn
        if (Math.abs(angleDiff(expected, v.bearing)) > JUMP) {
          this.value.set(v.id, this.of(v.id) * MOVED_PENALTY)
          jumped.push(v.id)
        }
      }
      this.lastBearing.set(v.id, v.bearing)
    }
    for (const id of [...this.lastBearing.keys()]) if (!seen.has(id)) this.lastBearing.delete(id)
    return jumped
  }
}
