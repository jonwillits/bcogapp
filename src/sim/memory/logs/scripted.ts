import { RANGE_LOCOMOTION } from '../../rodent/body'
import { CLEARING, type Log } from './clearings'
import type { NightSim } from './night'

/**
 * A scripted forager walks perfectly (spec §9.2): straight to the log it
 * chooses at the range pace, digs, and goes on; when the young call it
 * walks straight back to the nest. Its policy is asked for the next log
 * whenever it is free to choose, and may answer null, in which case it
 * returns to the nest and waits for dawn. The programmed foragers of Part 5
 * and the tuning foragers of `tune.probe.ts` are policies on this runner,
 * so they are compared with the student on digs, not on navigation.
 */

export interface Policy {
  /** The next log to dig, given what the forager can see of the night so far, or null for nothing worth digging. */
  next(sim: NightSim): Log | null
  /** Told the outcome of each dig. */
  outcome?(log: Log, outcome: 'beetles' | 'empty' | 'smooth', sim: NightSim): void
}

export const SCRIPT_DT = 0.05
/**
 * The pace a scripted forager walks at, m/s. The keys drive the student at
 * the range pace, 1.5 m/s, and the scripted foragers walked at that until
 * 2026-10-27, when the night went from 55 to 90 s for the student's sake
 * (`NIGHT_S`). At 1.5 m/s a 90 s night let every scripted forager dig all
 * seven logs, so memory stopped paying (Usual only ate as many beetles as
 * Tonight too). Half the range pace stands for the sniffing, turning and
 * searching a student at the keys does between logs, and brings the
 * scripted foragers back to about four of seven (`tune.probe.ts`, notes §4.1).
 */
export let SCRIPT_PACE = RANGE_LOCOMOTION.speed / 2
export function setScriptPace(v: number): void {
  SCRIPT_PACE = v
}

/** Run a night under a policy, to dawn. */
export function runScripted(sim: NightSim, policy: Policy, dt = SCRIPT_DT): void {
  let target: Log | null = null
  let digsSeen = 0
  while (!sim.done) {
    // Report outcomes as they land.
    while (digsSeen < sim.record.digs.length) {
      const d = sim.record.digs[digsSeen++]
      policy.outcome?.(sim.clearing.logs[d.log], d.outcome, sim)
    }
    if (sim.phase === 'called') {
      walkToward(sim, sim.clearing.nest.x, sim.clearing.nest.y, dt)
      sim.step(dt, { forward: 0, turn: 0 })
      target = null
      continue
    }
    if (sim.phase !== 'foraging') {
      sim.step(dt, { forward: 0, turn: 0 })
      continue
    }
    if (!target) target = policy.next(sim)
    if (!target) {
      // Nothing worth digging: back to the nest, and wait.
      if (!sim.atNest) walkToward(sim, sim.clearing.nest.x, sim.clearing.nest.y, dt)
      sim.step(dt, { forward: 0, turn: 0 })
      continue
    }
    const d = Math.hypot(target.x - sim.body.x, target.y - sim.body.y)
    if (d <= CLEARING.reach - 0.1) {
      sim.digAt(target)
      target = null
      sim.step(dt, { forward: 0, turn: 0 })
    } else {
      walkToward(sim, target.x, target.y, dt)
      sim.step(dt, { forward: 0, turn: 0 })
    }
  }
  while (digsSeen < sim.record.digs.length) {
    const d = sim.record.digs[digsSeen++]
    policy.outcome?.(sim.clearing.logs[d.log], d.outcome, sim)
  }
}

/** A straight step toward a point at the range pace; the body is placed, so footprints do not stop it. */
function walkToward(sim: NightSim, x: number, y: number, dt: number): void {
  const dx = x - sim.body.x
  const dy = y - sim.body.y
  const d = Math.hypot(dx, dy)
  const stepLen = SCRIPT_PACE * dt
  const heading = Math.atan2(dy, dx)
  if (d <= stepLen) sim.place(x, y, heading)
  else sim.place(sim.body.x + (dx / d) * stepLen, sim.body.y + (dy / d) * stepLen, heading)
}

/** The nearest of a set of logs to the forager. */
export function nearest(sim: NightSim, logs: Log[]): Log | null {
  let best: Log | null = null
  let bestD = Infinity
  for (const l of logs) {
    const d = Math.hypot(l.x - sim.body.x, l.y - sim.body.y)
    if (d < bestD) {
      bestD = d
      best = l
    }
  }
  return best
}
