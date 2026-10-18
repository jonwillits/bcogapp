import { rad, wrap } from './spatial/angles'

/**
 * The laboratory of Part 2 (spec §5.2, §8.2): two rooms, three pieces of
 * apparatus, and the changes a test can apply to any of them. Geometry
 * only; the programmed rats are in `rats.ts`.
 *
 * Everything is in meters, relative to the apparatus's center, with +y to
 * the north (away from the student in the overhead view) and +x to the
 * east.
 */

export type RoomKind = 'rich' | 'plain'
export type Apparatus = 'plus' | 'water' | 'paths'

/** A test's settings: one rat, one apparatus, one room, and a set of changes. */
export interface TestSettings {
  apparatus: Apparatus
  room: RoomKind
  /** Plus maze: how many training trials before the probe from the north arm. */
  training: 4 | 16 | 64
  /** Water maze: a visible platform, marked by a flag, or a hidden one. */
  platform: 'hidden' | 'visible'
  /** Radiating paths: the lamp behind the old food box. */
  lamp: 'on' | 'off' | 'moved'
  /** Rotate the room's cues by 90° between training and test. */
  rotateCues: boolean
  /** Remove everything outside the apparatus just before the choice, with the rat placed at the start in view of the room. */
  removeCues: boolean
  /** Darkness from the start of the test, or only after the rat has set off. */
  darkness: 'none' | 'fromStart' | 'afterStart'
  /** Trials in a run. */
  trials: number
}

export const DEFAULT_TEST: TestSettings = {
  apparatus: 'plus',
  room: 'rich',
  training: 4,
  platform: 'hidden',
  lamp: 'on',
  rotateCues: false,
  removeCues: false,
  darkness: 'none',
  trials: 8,
}

/** The plus maze (§9.1.6): four arms from a center. Food in the east arm; training from the south; the probe from the north. */
export const PLUS = {
  armLength: 0.6,
  armWidth: 0.12,
  arms: { north: rad(90), east: 0, south: rad(-90), west: rad(180) } as const,
  food: 'east' as const,
  trainingStart: 'south' as const,
  probeStart: 'north' as const,
}
export type Arm = keyof typeof PLUS.arms
export const ARMS: Arm[] = ['north', 'east', 'south', 'west']

/** The water maze (§9.1.7): a round pool, a platform just under the surface, starts around the rim. */
export const WATER = {
  radius: 0.8,
  platform: { x: 0.35, y: 0.35, radius: 0.07 },
  /** Starts at the rim, by compass. The first trial of a run starts north; the rest vary. */
  starts: [rad(90), rad(0), rad(-90), rad(180)],
  /** Swimming speed, meters per second. */
  speed: 0.3,
  /** A trial ends unfound at this many seconds. */
  cap: 60,
  /** A probe trial: the platform removed, this many seconds of searching. */
  probeSeconds: 30,
}

/**
 * The radiating paths (§9.1.6, the chapter's figure): a start path from the
 * south to a round table; from the table an alley to the north; the
 * roundabout route turns left, right and right again to the food box; the
 * lamp just behind the box. At test the alley is blocked and twelve long
 * paths fan out from the table, path 6 ending nearest where the food box
 * had been.
 */
export const PATHS = {
  tableRadius: 0.25,
  /** The roundabout route from the table's north exit: segments as headings and lengths. */
  route: [
    { heading: rad(90), length: 0.5 },
    { heading: rad(180), length: 0.3 },
    { heading: rad(90), length: 0.5 },
    { heading: rad(0), length: 0.8 },
  ],
  pathLength: 1.3,
  /** Twelve long paths, path 1 at the west end of the fan, 15° apart. */
  fan: Array.from({ length: 12 }, (_, i) => rad(142.5 - 15 * i)),
  /** The paths either side of the blocked alley (heading 90°): 4 and 5. */
  besideBlocked: [4, 5] as const,
  /** The path pointing nearest the old food box. */
  goalPath: 6,
}

/** Where the food box stood, from the route. */
export function foodBox(): { x: number; y: number } {
  let x = 0
  let y = PATHS.tableRadius
  for (const seg of PATHS.route) {
    x += seg.length * Math.cos(seg.heading)
    y += seg.length * Math.sin(seg.heading)
  }
  return { x, y }
}

/** The lamp: just behind the food box, or moved to the other side of the room, or off. */
export function lampPosition(lamp: TestSettings['lamp']): { x: number; y: number } | null {
  if (lamp === 'off') return null
  const f = foodBox()
  if (lamp === 'on') return { x: f.x + 0.15, y: f.y + 0.25 }
  // Moved: to the far west side of the fan, well away from the food box.
  return { x: -1.2, y: 0.9 }
}

/** The path whose direction is nearest a point, 1 to 12. */
export function pathToward(p: { x: number; y: number }): number {
  const a = Math.atan2(p.y, p.x)
  let best = 1
  let bestD = Infinity
  PATHS.fan.forEach((h, i) => {
    const d = Math.abs(wrap(h - a))
    if (d < bestD) {
      bestD = d
      best = i + 1
    }
  })
  return best
}

/**
 * The rooms (§5.2). The rich room's rack of cages stands behind the east
 * arm, as the rack stood behind one food box in Tolman's room: a beacon
 * for the food arm. The plain enclosure is a cloth curtain with nothing
 * to tell one side from another.
 */
export interface LabRoom {
  kind: RoomKind
  /** Things around the apparatus a rat can see: for the beacon rat, the one nearest the goal; for the map and snapshot rats, the room. */
  features: { id: string; x: number; y: number }[]
}

export const RICH_ROOM: LabRoom = {
  kind: 'rich',
  features: [
    { id: 'rack of cages', x: 2.2, y: 0 },
    { id: 'window', x: 0, y: 2.4 },
    { id: 'door', x: -2.3, y: -0.6 },
    { id: 'poster', x: 0.8, y: -2.2 },
  ],
}

export const PLAIN_ROOM: LabRoom = { kind: 'plain', features: [] }

export const labRoom = (kind: RoomKind): LabRoom => (kind === 'rich' ? RICH_ROOM : PLAIN_ROOM)

/** The arm of the plus maze nearest a direction. */
export function armToward(angle: number): Arm {
  let best: Arm = 'north'
  let bestD = Infinity
  for (const a of ARMS) {
    const d = Math.abs(wrap(PLUS.arms[a] - angle))
    if (d < bestD) {
      bestD = d
      best = a
    }
  }
  return best
}

/** The arm reached by repeating a turn: from `from`, the turn that led from the training start to the food. */
export function armByTurn(from: Arm): Arm {
  // From the south arm, facing north at the center, the east arm is a right turn (−90°).
  const facing = PLUS.arms[from] + Math.PI
  const trainedFacing = PLUS.arms[PLUS.trainingStart] + Math.PI
  const turn = wrap(PLUS.arms[PLUS.food] - trainedFacing)
  return armToward(facing + turn)
}
