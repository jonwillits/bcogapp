import type { Rng } from '../../random'

/**
 * Part 1, Step 3 — Two dispensers (spec §5.4): two blocks of three minutes,
 * one per dispenser, in real time. Each trial, the student may press “Take 1
 * now”, which adds 1 point; if the student waits, the dispenser may deliver
 * 5 points. The blue dispenser delivers 5 points 8 seconds after each trial
 * starts, on every trial. The orange dispenser delivers 5 points 8 seconds
 * after the trial starts on half of its trials, set by the seed, and never
 * on the other half.
 *
 * **Departure from the spec (as-built notes §8).** The spec has the next
 * trial start one second after a take and one second after a delivery. With
 * those gaps, taking 1 point at once on every trial earns 60 points a minute
 * against about 33 for waiting for 5 points every 9 seconds, so the best
 * policy for both dispensers would be never to wait, and the spec's stated
 * best policies would be false. Here a take is followed by a pause of
 * TAKE_PAUSE seconds before the next trial, and a delivery by one second.
 * With a 5-second pause, waiting is the best policy at the blue dispenser
 * (33.3 points a minute against 12 for taking at once) and waiting 8
 * seconds then taking is the best at the orange (16.4 against 12), as the
 * spec says. The best policies are computed exactly from these rules, over
 * every policy of the form “wait up to t seconds, then take”.
 */

export type DispenserId = 'blue' | 'orange'

export const DISPENSER_LABEL: Record<DispenserId, string> = { blue: 'the blue dispenser', orange: 'the orange dispenser' }

export const BLOCK_SECONDS = 180
export const DELIVERY_AT = 8
export const DELIVERY_POINTS = 5
export const TAKE_POINTS = 1
export const DELIVERY_PAUSE = 1
export const TAKE_PAUSE = 5
/** The share of the orange dispenser's trials on which it delivers. */
export const ORANGE_DELIVERS = 0.5

export const DISPENSER_RULE: Record<DispenserId, string> = {
  blue: `The blue dispenser delivers ${DELIVERY_POINTS} points ${DELIVERY_AT} seconds after each trial starts, on every trial.`,
  orange: `The orange dispenser delivers ${DELIVERY_POINTS} points ${DELIVERY_AT} seconds after the trial starts on half of its trials, chosen by the seed, and never on the other half. A trial on which nothing is delivered lasts until you take 1 point, or until the block ends.`,
}

export interface Trial {
  /** Seconds from the block's start. */
  start: number
  /** Whether this trial would deliver (blue: always; orange: by the seed). */
  delivers: boolean
  /** How it ended: a delivery, a take, or the block's end. */
  end: 'delivered' | 'took' | 'blockEnded' | null
  /** Seconds waited from the trial's start to its end. */
  waited: number | null
  points: number
}

export interface BlockState {
  dispenser: DispenserId
  trials: Trial[]
  points: number
  /** Seconds of block time elapsed. */
  elapsed: number
  /** Whether a trial is running now, or the pause between trials is. */
  phase: 'trial' | 'pause' | 'done'
  /** When the current trial started, or when the pause ends, in block seconds. */
  phaseStart: number
  pauseUntil: number
  /** How many times the block was restarted after the page was hidden or lost focus. */
  restarts: number
}

export function startBlock(dispenser: DispenserId, rng: Rng, restarts = 0): BlockState {
  const s: BlockState = { dispenser, trials: [], points: 0, elapsed: 0, phase: 'trial', phaseStart: 0, pauseUntil: 0, restarts }
  s.trials.push(newTrial(dispenser, 0, rng))
  return s
}

function newTrial(dispenser: DispenserId, start: number, rng: Rng): Trial {
  return { start, delivers: dispenser === 'blue' ? true : rng.next() < ORANGE_DELIVERS, end: null, waited: null, points: 0 }
}

/** Advance the block's clock to `elapsed` seconds. Deliveries and pauses that fall within happen in order. */
export function advance(s: BlockState, elapsed: number, rng: Rng): BlockState {
  const n: BlockState = { ...s, trials: s.trials.map((t) => ({ ...t })) }
  let t = n.elapsed
  while (t < elapsed && n.phase !== 'done') {
    if (n.phase === 'trial') {
      const trial = n.trials[n.trials.length - 1]
      const deliverAt = trial.start + DELIVERY_AT
      if (trial.delivers && deliverAt <= elapsed && deliverAt <= BLOCK_SECONDS) {
        trial.end = 'delivered'
        trial.waited = DELIVERY_AT
        trial.points = DELIVERY_POINTS
        n.points += DELIVERY_POINTS
        n.phase = 'pause'
        n.pauseUntil = deliverAt + DELIVERY_PAUSE
        t = deliverAt
      } else t = elapsed
    } else if (n.phase === 'pause') {
      if (n.pauseUntil <= elapsed && n.pauseUntil < BLOCK_SECONDS) {
        n.phase = 'trial'
        n.phaseStart = n.pauseUntil
        n.trials.push(newTrial(n.dispenser, n.pauseUntil, rng))
        t = n.pauseUntil
      } else t = elapsed
    }
  }
  n.elapsed = Math.min(elapsed, BLOCK_SECONDS)
  if (elapsed >= BLOCK_SECONDS && n.phase !== 'done') {
    const trial = n.trials[n.trials.length - 1]
    if (trial.end === null) {
      trial.end = 'blockEnded'
      trial.waited = BLOCK_SECONDS - trial.start
    }
    n.phase = 'done'
  }
  return n
}

/** The student takes 1 point now, at `elapsed` seconds. Nothing happens during a pause. */
export function take(s: BlockState, elapsed: number): BlockState {
  const n = advance(s, elapsed, { next: () => 0, range: () => 0, int: () => 0, normal: () => 0, fork: () => ({}) as never })
  if (n.phase !== 'trial') return n
  const trial = n.trials[n.trials.length - 1]
  trial.end = 'took'
  trial.waited = elapsed - trial.start
  trial.points = TAKE_POINTS
  n.points += TAKE_POINTS
  n.phase = 'pause'
  n.pauseUntil = elapsed + TAKE_PAUSE
  return n
}

/** The exact expected points per minute of the policy “wait up to t seconds, then take”, for a dispenser. */
export function pointsPerMinute(dispenser: DispenserId, waitUpTo: number): number {
  const pDeliver = dispenser === 'blue' ? 1 : ORANGE_DELIVERS
  if (waitUpTo < DELIVERY_AT) return (60 * TAKE_POINTS) / (waitUpTo + TAKE_PAUSE)
  // A delivering trial ends at 8 s with 5 points and a 1-s pause; a trial that does not deliver ends when the policy takes, with 1 point and the take pause.
  const expectedPoints = pDeliver * DELIVERY_POINTS + (1 - pDeliver) * TAKE_POINTS
  const expectedSeconds = pDeliver * (DELIVERY_AT + DELIVERY_PAUSE) + (1 - pDeliver) * (waitUpTo + TAKE_PAUSE)
  return (60 * expectedPoints) / expectedSeconds
}

export interface BestPolicy {
  dispenser: DispenserId
  /** The wait in seconds before taking, or Infinity for always waiting. */
  waitUpTo: number
  pointsPerMinute: number
  description: string
}

/** The best policy of the form “wait up to t seconds, then take”, over t from 0 to 20 in steps of half a second and never taking. */
export function bestPolicy(dispenser: DispenserId): BestPolicy {
  let best = { waitUpTo: 0, ppm: -Infinity }
  for (let t = 0; t <= 20; t += 0.5) {
    const ppm = pointsPerMinute(dispenser, t)
    if (ppm > best.ppm + 1e-9) best = { waitUpTo: t, ppm }
  }
  // Never taking: on the blue dispenser the same as waiting 8; on the orange, half the trials never end, so the rate over a block falls toward the delivering trials alone.
  const never = dispenser === 'blue' ? pointsPerMinute('blue', DELIVERY_AT) : -Infinity
  if (never > best.ppm + 1e-9) best = { waitUpTo: Infinity, ppm: never }
  const description = dispenser === 'blue' ? 'Always wait for the delivery.' : `Wait ${DELIVERY_AT} seconds, and if nothing has come, take 1 point.`
  return { dispenser, waitUpTo: best.waitUpTo, pointsPerMinute: best.ppm, description }
}

/** Points per minute over a block, from its record. */
export function blockPointsPerMinute(s: BlockState): number {
  return (60 * s.points) / BLOCK_SECONDS
}

/** Simulate a whole block under “wait up to t, then take”, for the tests. */
export function simulateBlock(dispenser: DispenserId, waitUpTo: number, rng: Rng): BlockState {
  let s = startBlock(dispenser, rng)
  while (s.phase !== 'done') {
    const trial = s.trials[s.trials.length - 1]
    if (s.phase === 'pause') {
      s = advance(s, Math.min(s.pauseUntil, BLOCK_SECONDS), rng)
      continue
    }
    const takeAt = trial.start + waitUpTo
    const deliverAt = trial.delivers ? trial.start + DELIVERY_AT : Infinity
    if (deliverAt <= takeAt) s = advance(s, Math.min(deliverAt, BLOCK_SECONDS), rng)
    else if (takeAt < BLOCK_SECONDS) s = take(s, takeAt)
    else s = advance(s, BLOCK_SECONDS, rng)
  }
  return s
}

export interface BlockSummary {
  dispenser: DispenserId
  trials: { waited: number; end: Trial['end'] }[]
  waitedForDelivery: number
  tookEarly: number
  points: number
  pointsPerMinute: number
  restarts: number
}

export function summarize(s: BlockState): BlockSummary {
  const trials = s.trials.filter((t) => t.end !== null).map((t) => ({ waited: t.waited ?? 0, end: t.end }))
  return {
    dispenser: s.dispenser,
    trials,
    waitedForDelivery: trials.filter((t) => t.end === 'delivered').length,
    tookEarly: trials.filter((t) => t.end === 'took').length,
    points: s.points,
    pointsPerMinute: blockPointsPerMinute(s),
    restarts: s.restarts,
  }
}
