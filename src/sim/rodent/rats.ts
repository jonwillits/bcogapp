import { makeRng, type Rng } from '../random'
import { ARMS, PLUS, WATER, PATHS, armByTurn, armToward, foodBox, lampPosition, pathToward, type Arm, type TestSettings } from './lab'
import { rad, wrap } from './spatial/angles'

/**
 * The seven programmed rats of Part 2 (spec §8.1) and what each does on
 * each apparatus. Each rat is a weighting of four kinds of knowledge:
 *
 * - a **map**: where the goal lies relative to the room, used to set off
 *   toward it from any start, the heading kept by a running sum if the
 *   room goes dark after setting off (§9.2.5, §9.2.7);
 * - a **route**: the sequence of turns that led to the goal in training,
 *   repeated (§9.2.1), which is response learning (§9.1.6);
 * - a **beacon**: whatever visible thing stood nearest the goal in
 *   training, steered toward (§9.2.1);
 * - a **snapshot**: the stored view from the goal, matched by moving until
 *   the current view looks like it, which works only where the room can be
 *   seen and from where the view still resembles it (§9.2.1).
 *
 * The healthy rat has all of them, with the map leading early in training
 * and the turns after long training (§9.1.6, §9.3.2); in a room with
 * nothing outside the apparatus to go by, only the turns are left. The
 * hidden rats each have one, and R5 and R6 are the healthy rat without its
 * map or without its turns (§9.3.2). These are programs: they follow,
 * steer, repeat and head for, and none of them knows or decides.
 */

export type RatId = 'H' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6'
export type Strategy = 'beacon' | 'route' | 'snapshot' | 'map' | 'no hippocampus' | 'no striatum'

export interface Weights {
  map: number
  route: number
  beacon: number
  snapshot: number
}

export interface ProgrammedRat {
  id: RatId
  /** The name on the diagnosis menu, for the hidden rats. */
  strategy: Strategy | 'healthy'
  label: string
  /** One line, shown at Reveal. */
  reveal: string
  hidden: boolean
  weights: Weights
}

/** The route's weight grows with training: a habit. */
export function routeWeight(trainingTrials: number): number {
  return 0.35 + 1.7 * (1 - Math.exp(-Math.max(0, trainingTrials - 4) / 30))
}

export const RATS: ProgrammedRat[] = [
  { id: 'H', strategy: 'healthy', label: 'H — healthy', hidden: false, weights: { map: 1, route: 1, beacon: 1, snapshot: 0.6 }, reveal: 'A map, a route and a beacon together: the map leads early in training and the turns after long training, and with nothing outside the apparatus to go by, the turns.' },
  { id: 'R1', strategy: 'beacon', label: 'R1', hidden: true, weights: { map: 0, route: 0, beacon: 1, snapshot: 0 }, reveal: 'A beacon: it steers toward whatever visible thing stood nearest the goal in training.' },
  { id: 'R2', strategy: 'route', label: 'R2', hidden: true, weights: { map: 0, route: 1, beacon: 0, snapshot: 0 }, reveal: 'A route: it repeats the sequence of turns that led to the goal in training, whatever place they lead to.' },
  { id: 'R3', strategy: 'snapshot', label: 'R3', hidden: true, weights: { map: 0, route: 0, beacon: 0, snapshot: 1 }, reveal: 'A snapshot: it moves until the room looks the way it looked from the goal, which works only where the view still resembles it.' },
  { id: 'R4', strategy: 'map', label: 'R4', hidden: true, weights: { map: 1, route: 0, beacon: 0, snapshot: 0 }, reveal: 'A map: it heads for where the goal lies relative to the room, from any start, and keeps its heading by its running sum if the room goes dark after it sets off.' },
  { id: 'R5', strategy: 'no hippocampus', label: 'R5', hidden: true, weights: { map: 0, route: 1, beacon: 1, snapshot: 0 }, reveal: 'Damage to the hippocampus: the healthy rat without its map, so a beacon and the turns only.' },
  { id: 'R6', strategy: 'no striatum', label: 'R6', hidden: true, weights: { map: 1, route: 0, beacon: 1, snapshot: 0.6 }, reveal: 'Damage to the striatum: the healthy rat without its turns, so a map and a beacon, and no shift to the turns with long training.' },
]

export const ratById = (id: RatId): ProgrammedRat => RATS.find((r) => r.id === id)!

export const STRATEGIES: { id: Strategy; label: string }[] = [
  { id: 'beacon', label: 'beacon' },
  { id: 'route', label: 'route' },
  { id: 'snapshot', label: 'snapshot' },
  { id: 'map', label: 'map' },
  { id: 'no hippocampus', label: 'damage to the hippocampus' },
  { id: 'no striatum', label: 'damage to the striatum' },
]

/** Beacons differ in how much they draw a rat: a cage rack a little, the only lamp in a dark room a great deal. */
export const BEACON_PULL = { rack: 0.25, lamp: 1.0, flag: 1.0 } as const
/** A rat sometimes goes somewhere else anyway. */
export const WANDER = 0.08

/** What a test lets each kind of knowledge do, at the moment of the choice. */
interface Available {
  /** Room cues visible at the choice. */
  cuesNow: boolean
  /** Room cues visible when the rat was placed at the start. */
  cuesAtStart: boolean
  rotated: boolean
}

function available(t: TestSettings): Available {
  const room = t.room === 'rich'
  const darkNow = t.darkness !== 'none'
  const darkAtStart = t.darkness === 'fromStart'
  return {
    cuesNow: room && !darkNow && !t.removeCues,
    cuesAtStart: room && !darkAtStart,
    rotated: t.rotateCues,
  }
}

/** A point on a trial's path, with the time it is reached. */
export interface PathPoint {
  t: number
  x: number
  y: number
}

export interface TrialResult {
  path: PathPoint[]
  /** Plus maze: the arm entered. */
  arm?: Arm
  /** Water maze: seconds to the platform, or null when not found within the cap. */
  latency?: number | null
  /** Water maze probe: share of the probe spent in each quarter, in the order of the platform's quarter first. */
  quarters?: number[]
  /** Radiating paths: the path taken, 1 to 12. */
  pathTaken?: number
}

export interface RunResult {
  settings: TestSettings
  rat: RatId
  trials: TrialResult[]
  /** Plus maze: trials ending in the food arm (place) and the same-turn arm. */
  place?: number
  turn?: number
  /** Water maze: mean latency over the trials that count (the test trials), and how many found it. */
  meanLatency?: number
  found?: number
  /** Water maze probe quarters, averaged. */
  quarters?: number[]
  /** Radiating paths: how many trials took each path, 1 to 12. */
  pathCounts?: number[]
  /** One line per result, fixed wording. */
  lines: string[]
}

/** Which kinds of knowledge a rat brings to a choice, by weight; the heaviest wins, with a little wandering. */
function vote(votes: { what: string; weight: number }[], rng: Rng, fallback: () => string): string {
  const live = votes.filter((v) => v.weight > 0)
  if (!live.length || rng.next() < WANDER) return fallback()
  let best = live[0]
  for (const v of live) if (v.weight > best.weight) best = v
  return best.what
}

/** Run a test: one rat, the apparatus and room in `settings`, `settings.trials` trials. Seeded. */
export function runTest(rat: ProgrammedRat, settings: TestSettings, seed: number): RunResult {
  const rng = makeRng(seed)
  if (settings.apparatus === 'plus') return runPlus(rat, settings, rng)
  if (settings.apparatus === 'water') return runWater(rat, settings, rng)
  return runPaths(rat, settings, rng)
}

// ------------------------------------------------------------- plus maze

function runPlus(rat: ProgrammedRat, t: TestSettings, rng: Rng): RunResult {
  const w = rat.weights
  const av = available(t)
  const trials: TrialResult[] = []
  const routeW = w.route * routeWeight(t.training)
  // The room cue nearest the food arm in training: the rack, behind the east arm, in the rich room.
  const rackArm: Arm | null = t.room === 'rich' ? 'east' : null
  for (let i = 0; i < t.trials; i++) {
    const from: Arm = PLUS.probeStart
    const rotate = (arm: Arm): Arm => (av.rotated ? armToward(PLUS.arms[arm] + rad(90)) : arm)
    const votes: { what: string; weight: number }[] = []
    // The map: the food arm relative to the room, if the room could be seen now or at the start.
    if (w.map > 0 && (av.cuesNow || av.cuesAtStart)) votes.push({ what: rotate(PLUS.food), weight: w.map })
    // The route: the same turn.
    if (routeW > 0) votes.push({ what: armByTurn(from), weight: routeW })
    // The beacon: the rack, if it can be seen now.
    if (w.beacon > 0 && rackArm && av.cuesNow) votes.push({ what: rotate(rackArm), weight: w.beacon * BEACON_PULL.rack })
    // The snapshot: the view from the food arm, matched from the center, if the room can be seen now.
    if (w.snapshot > 0 && av.cuesNow) votes.push({ what: rotate(PLUS.food), weight: w.snapshot })
    const arm = vote(votes, rng, () => ARMS[rng.int(4)]) as Arm
    trials.push({ arm, path: plusPath(from, arm) })
  }
  const place = trials.filter((x) => x.arm === (av.rotated ? armToward(PLUS.arms[PLUS.food] + rad(90)) : PLUS.food)).length
  const turn = trials.filter((x) => x.arm === armByTurn(PLUS.probeStart)).length
  return {
    settings: t,
    rat: rat.id,
    trials,
    place,
    turn,
    lines: [`Probe trials from the north arm: ${t.trials}`, `Ended at the east arm (the place): ${place}`, `Ended at the west arm (the same turn): ${turn}`, `Ended elsewhere: ${t.trials - place - turn}`],
  }
}

/** Start arm → center → chosen arm, at the box pace. */
function plusPath(from: Arm, to: Arm): PathPoint[] {
  const v = 0.4
  const a0 = PLUS.arms[from]
  const a1 = PLUS.arms[to]
  const L = PLUS.armLength
  const start = { x: L * Math.cos(a0), y: L * Math.sin(a0) }
  const end = { x: L * Math.cos(a1), y: L * Math.sin(a1) }
  return [
    { t: 0, x: start.x, y: start.y },
    { t: L / v, x: 0, y: 0 },
    { t: (2 * L) / v, x: end.x, y: end.y },
  ]
}

// ----------------------------------------------------------- water maze

interface Swimmer {
  x: number
  y: number
  heading: number
}

function runWater(rat: ProgrammedRat, t: TestSettings, rng: Rng): RunResult {
  const w = rat.weights
  const changed = t.rotateCues || t.removeCues || t.darkness !== 'none'
  // With a change, the rat is first trained with the platform in the ordinary room, then tested with the change.
  const trainingTrials = changed ? t.trials : 0
  const trials: TrialResult[] = []
  const knows = { map: false, snapshot: false, route: null as null | { heading: number; distance: number } }
  const plat = WATER.platform
  const rotatedPlat = { x: -plat.y, y: plat.x, radius: plat.radius }
  const total = trainingTrials + t.trials
  for (let i = 0; i < total; i++) {
    const testing = i >= trainingTrials
    const settings: TestSettings = testing ? t : { ...t, rotateCues: false, removeCues: false, darkness: 'none' }
    const av = available(settings)
    const startAngle = WATER.starts[i % WATER.starts.length]
    const s: Swimmer = { x: (WATER.radius - 0.05) * Math.cos(startAngle), y: (WATER.radius - 0.05) * Math.sin(startAngle), heading: startAngle + Math.PI }
    const goal = av.rotated ? rotatedPlat : plat
    const visible = t.platform === 'visible'
    // What this rat will do on this trial, from the start.
    const dt = 0.1
    const path: PathPoint[] = [{ t: 0, x: s.x, y: s.y }]
    let found: number | null = null
    // The map rat sets its heading at the start from the room; if the room goes dark or is removed after, it keeps that heading by its running sum, with noise.
    let keptHeading: number | null = null
    let routePlan: { heading: number; distance: number } | null = null
    if (w.route > 0 && knows.route) routePlan = { heading: s.heading + knows.route.heading, distance: knows.route.distance }
    let swum = 0
    let searchTurn = 0
    for (let time = 0; time < WATER.cap; time += dt) {
      let target: { x: number; y: number } | null = null
      let mode: 'direct' | 'kept' | 'route' | 'search' = 'search'
      if (visible && w.beacon > 0) {
        target = plat
        mode = 'direct'
      } else if (w.map > 0 && knows.map && av.cuesNow) {
        target = goal
        mode = 'direct'
      } else if (w.map > 0 && knows.map && av.cuesAtStart) {
        if (keptHeading === null) keptHeading = Math.atan2(goal.y - s.y, goal.x - s.x)
        mode = 'kept'
      } else if (w.snapshot > 0 && knows.snapshot && av.cuesNow) {
        target = goal
        mode = 'direct'
      } else if (routePlan && swum < routePlan.distance) {
        mode = 'route'
      }
      if (mode === 'direct' && target) s.heading = Math.atan2(target.y - s.y, target.x - s.x) + 0.08 * rng.normal()
      else if (mode === 'kept' && keptHeading !== null) {
        keptHeading += 0.06 * Math.sqrt(dt) * rng.normal()
        s.heading = keptHeading
      } else if (mode === 'route' && routePlan) s.heading = routePlan.heading + 0.05 * rng.normal()
      else {
        // Random search: a wandering turn rate, turning in from the wall.
        searchTurn += -searchTurn * dt + 1.5 * Math.sqrt(2 * dt) * rng.normal()
        s.heading += searchTurn * dt
        const r = Math.sqrt(s.x * s.x + s.y * s.y)
        if (r > WATER.radius - 0.12) {
          const inward = Math.atan2(-s.y, -s.x)
          s.heading += 0.5 * wrap(inward - s.heading)
        }
      }
      const step = WATER.speed * dt
      s.x += step * Math.cos(s.heading)
      s.y += step * Math.sin(s.heading)
      swum += step
      const r = Math.sqrt(s.x * s.x + s.y * s.y)
      if (r > WATER.radius - 0.03) {
        s.x *= (WATER.radius - 0.03) / r
        s.y *= (WATER.radius - 0.03) / r
      }
      path.push({ t: time + dt, x: s.x, y: s.y })
      // The platform that is there: in a rotated-cue test the platform itself stays put.
      const here = Math.sqrt((s.x - plat.x) ** 2 + (s.y - plat.y) ** 2) < plat.radius
      if (here) {
        found = time + dt
        break
      }
    }
    // What this trial teaches, in training or test alike.
    if (found !== null) {
      if (w.map > 0 && av.cuesNow) knows.map = true
      if (w.snapshot > 0 && av.cuesNow) knows.snapshot = true
      if (w.route > 0 && !knows.route) {
        const dx = plat.x - path[0].x
        const dy = plat.y - path[0].y
        knows.route = { heading: wrap(Math.atan2(dy, dx) - (startAngle + Math.PI)), distance: Math.sqrt(dx * dx + dy * dy) }
      }
    }
    trials.push({ path, latency: found })
  }
  const counted = trials.slice(trainingTrials)
  const latencies = counted.map((x) => x.latency ?? WATER.cap)
  const meanLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length
  const foundN = counted.filter((x) => x.latency !== null).length
  // The probe: the platform removed, 30 s from the north start, time in each quarter.
  const probe = probeTrial(rat, t, rng, knows)
  const quarters = probe.quarters!
  return {
    settings: t,
    rat: rat.id,
    trials: [...trials, probe],
    meanLatency,
    found: foundN,
    quarters,
    lines: [
      `Test trials: ${counted.length}${trainingTrials ? ` (after ${trainingTrials} training trials)` : ''}`,
      `Found the platform within ${WATER.cap} s: ${foundN} of ${counted.length}`,
      `Mean time to the platform: ${meanLatency.toFixed(1)} s`,
      `Probe, platform removed: ${Math.round(quarters[0] * 100)}% in the platform’s quarter, ${Math.round(quarters[1] * 100)}% in the rotated quarter`,
    ],
  }
}

/** The probe trial: the platform removed, the rat swims 30 s from the north; the share of time in each quarter, the platform's first and the quarter 90° on next. */
function probeTrial(rat: ProgrammedRat, t: TestSettings, rng: Rng, knows: { map: boolean; snapshot: boolean; route: null | { heading: number; distance: number } }): TrialResult {
  const w = rat.weights
  const av = available(t)
  const plat = WATER.platform
  const goal = av.rotated ? { x: -plat.y, y: plat.x } : plat
  const s: Swimmer = { x: 0, y: WATER.radius - 0.05, heading: -Math.PI / 2 }
  const dt = 0.1
  const path: PathPoint[] = [{ t: 0, x: s.x, y: s.y }]
  const time = [0, 0, 0, 0]
  const usesGoal = (w.map > 0 && knows.map && (av.cuesNow || av.cuesAtStart)) || (w.snapshot > 0 && knows.snapshot && av.cuesNow)
  let keptHeading: number | null = null
  let searchTurn = 0
  let swum = 0
  const routePlan = w.route > 0 && knows.route ? { heading: s.heading + knows.route.heading, distance: knows.route.distance } : null
  for (let tt = 0; tt < WATER.probeSeconds; tt += dt) {
    const near = Math.sqrt((s.x - goal.x) ** 2 + (s.y - goal.y) ** 2) < 0.12
    if (usesGoal && !near) {
      if (w.map > 0 && knows.map && !av.cuesNow && av.cuesAtStart) {
        if (keptHeading === null) keptHeading = Math.atan2(goal.y - s.y, goal.x - s.x)
        keptHeading += 0.06 * Math.sqrt(dt) * rng.normal()
        s.heading = keptHeading
      } else s.heading = Math.atan2(goal.y - s.y, goal.x - s.x) + 0.08 * rng.normal()
    } else if (routePlan && swum < routePlan.distance) s.heading = routePlan.heading
    else {
      searchTurn += -searchTurn * dt + (usesGoal && near ? 4 : 1.5) * Math.sqrt(2 * dt) * rng.normal()
      s.heading += searchTurn * dt
      const r = Math.sqrt(s.x * s.x + s.y * s.y)
      if (r > WATER.radius - 0.12) s.heading += 0.5 * wrap(Math.atan2(-s.y, -s.x) - s.heading)
      // A rat that is where its goal should be circles there.
      if (usesGoal && near) {
        const back = Math.atan2(goal.y - s.y, goal.x - s.x)
        s.heading += 0.3 * wrap(back - s.heading)
      }
    }
    const step = WATER.speed * dt
    s.x += step * Math.cos(s.heading)
    s.y += step * Math.sin(s.heading)
    swum += step
    const r = Math.sqrt(s.x * s.x + s.y * s.y)
    if (r > WATER.radius - 0.03) {
      s.x *= (WATER.radius - 0.03) / r
      s.y *= (WATER.radius - 0.03) / r
    }
    path.push({ t: tt + dt, x: s.x, y: s.y })
    time[quarterOf(s.x, s.y)] += dt
  }
  const total = time.reduce((a, b) => a + b, 0)
  return { path, quarters: time.map((v) => v / total) }
}

/** Which quarter of the pool a point is in: 0 the platform's (north-east), then counterclockwise. */
export function quarterOf(x: number, y: number): number {
  if (x >= 0 && y >= 0) return 0
  if (x < 0 && y >= 0) return 1
  if (x < 0 && y < 0) return 2
  return 3
}

// ------------------------------------------------------- radiating paths

function runPaths(rat: ProgrammedRat, t: TestSettings, rng: Rng): RunResult {
  const w = rat.weights
  const av = available(t)
  const lamp = lampPosition(t.lamp)
  const goal = foodBox()
  const counts = new Array<number>(12).fill(0)
  const trials: TrialResult[] = []
  const routeW = w.route * routeWeight(5)
  for (let i = 0; i < t.trials; i++) {
    const votes: { what: string; weight: number }[] = []
    const rotate = (p: number): number => (av.rotated ? ((p + 6 - 1) % 12) + 1 : p)
    if (w.map > 0 && (av.cuesNow || av.cuesAtStart)) votes.push({ what: String(rotate(pathToward(goal))), weight: w.map })
    if (routeW > 0) votes.push({ what: String(PATHS.besideBlocked[rng.int(2)]), weight: routeW })
    // The lamp is part of the apparatus, not the room: it draws the beacon rat whenever it is lit.
    if (w.beacon > 0 && lamp) votes.push({ what: String(pathToward(lamp)), weight: w.beacon * BEACON_PULL.lamp })
    // The snapshot from the food box is dominated by the lamp; without it, the view from the table matches nothing.
    if (w.snapshot > 0 && lamp && t.lamp === 'on') votes.push({ what: String(pathToward(goal)), weight: w.snapshot })
    const taken = Number(vote(votes, rng, () => String(1 + rng.int(12))))
    counts[taken - 1]++
    trials.push({ pathTaken: taken, path: fanPath(taken) })
  }
  let best = 1
  for (let p = 1; p <= 12; p++) if (counts[p - 1] > counts[best - 1]) best = p
  const besideN = counts[3] + counts[4]
  return {
    settings: t,
    rat: rat.id,
    trials,
    pathCounts: counts,
    lines: [`Trials: ${t.trials}`, `Most taken: path ${best} (${counts[best - 1]} of ${t.trials})`, `Path 6, nearest the old food box: ${counts[5]}`, `Paths 4 and 5, beside the blocked route: ${besideN}`],
  }
}

/** Start path → table → out along a fan path. */
function fanPath(p: number): PathPoint[] {
  const v = 0.4
  const h = PATHS.fan[p - 1]
  const startY = -(PATHS.tableRadius + 0.8)
  return [
    { t: 0, x: 0, y: startY },
    { t: 0.8 / v, x: 0, y: -PATHS.tableRadius },
    { t: (0.8 + PATHS.tableRadius) / v, x: 0, y: 0 },
    { t: (0.8 + PATHS.tableRadius + PATHS.pathLength) / v, x: PATHS.pathLength * Math.cos(h), y: PATHS.pathLength * Math.sin(h) },
  ]
}

/** The training route of the radiating paths, drawn once before the test. */
export function trainingRoutePath(): PathPoint[] {
  const v = 0.4
  const pts: PathPoint[] = [{ t: 0, x: 0, y: -(PATHS.tableRadius + 0.8) }]
  let x = 0
  let y = PATHS.tableRadius
  let time = (0.8 + 2 * PATHS.tableRadius) / v
  pts.push({ t: time, x, y })
  for (const seg of PATHS.route) {
    x += seg.length * Math.cos(seg.heading)
    y += seg.length * Math.sin(seg.heading)
    time += seg.length / v
    pts.push({ t: time, x, y })
  }
  return pts
}

/** The outcome kinds of spec §8.3, read off a run, so the table test and the panel speak the same words. */
export type Outcome = string

export function outcomeOf(r: RunResult): Outcome {
  const t = r.settings
  if (t.apparatus === 'plus') {
    if (r.place! > t.trials / 2) return 'east'
    if (r.turn! > t.trials / 2) return 'west'
    return 'no consistent arm'
  }
  if (t.apparatus === 'water') {
    const n = t.trials
    if (t.rotateCues) return r.quarters![1] > 0.4 ? 'searches the rotated quarter' : 'fails'
    // "Finds it" means swims to it: within 20 s, which a direct swim from the rim takes about 5 of and a random search seldom does.
    const counted = r.trials.slice(r.trials.length - 1 - n, r.trials.length - 1)
    const quickCount = counted.filter((x) => x.latency != null && x.latency < 20).length
    if (t.removeCues || t.darkness !== 'none') return quickCount >= Math.ceil(n * 0.6) ? 'finds it most times' : 'fails'
    if (t.platform === 'visible') return r.found! >= Math.ceil(n * 0.75) && r.meanLatency! < 20 ? 'finds it' : 'fails from new starts'
    // Hidden, varied starts: learned when the later trials are quick.
    const later = r.trials.slice(Math.floor(n / 2), n).map((x) => x.latency)
    const quick = later.filter((l) => l != null && l < 20).length
    return quick >= Math.ceil(later.length * 0.75) ? 'learns it' : 'fails'
  }
  const c = r.pathCounts!
  const n = t.trials
  if (c[5] > n / 2) return 'path nearest the old food box'
  if (c[3] + c[4] > n / 2) return 'paths beside the blocked route'
  const lamp = lampPosition(t.lamp)
  if (lamp && c[pathToward(lamp) - 1] > n / 2) return `path toward the lamp (path ${pathToward(lamp)})`
  return 'no preferred path'
}

