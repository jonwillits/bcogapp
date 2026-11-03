/**
 * The three films of Part 3, Step 1 (spec §7.1), authored for this lab as
 * keyframe data and never traced or copied from the 1944 film. A large
 * triangle, a small triangle and a small disc, with a rectangle whose door
 * segment opens and closes, on a plain stage. Flat outlines, no faces.
 *
 * Film 2 is a new scenario in the spirit of Heider and Simmel (1944): an
 * approach, the door opening, a sudden approach followed by another shape
 * moving away (the cue the chapter says viewers read as hitting), a
 * pursuit, a shape entering the rectangle, the door closing, an escape.
 * Film 1, the control, has the same shapes, with each on a path
 * independent of the others, the same amount of motion, speeds and number
 * of contacts within 10% (`measure`, held by `films.test.ts`); no motion
 * is contingent on another shape's. Film 3 is Film 2 run backward, frame
 * for frame (`reversed`).
 *
 * Positions are interpolated linearly between keyframes; a triangle points
 * the way it moves.
 */

export const STAGE = { width: 480, height: 320 } as const

export type ShapeId = 'big' | 'small' | 'disc'
export const SHAPES: readonly ShapeId[] = ['big', 'small', 'disc']
export const SHAPE_SIZE: Record<ShapeId, number> = { big: 22, small: 14, disc: 11 }

export interface Keyframe {
  t: number
  x: number
  y: number
}

/** The rectangle and its door: the door is the left side's middle (52 px, wide enough for the large triangle to pass without touching the frame), hinged at its top, with an angle from 0 (shut) to 90 (open). */
export const HOUSE = { x: 300, y: 100, width: 110, height: 120, doorTop: 134, doorBottom: 186 } as const

export interface Film {
  id: 1 | 2 | 3
  title: string
  duration: number
  shapes: Record<ShapeId, Keyframe[]>
  /** The door's angle keyframes, degrees. */
  door: { t: number; angle: number }[]
}

const kf = (t: number, x: number, y: number): Keyframe => ({ t, x, y })

/** Film 2: the scenario. Times in seconds; 30 s. */
export const FILM_2: Film = {
  id: 2,
  title: 'Film 2',
  duration: 30,
  shapes: {
    // The large triangle: inside the house at the start, comes out, strikes, pursues, bumps the shut door, follows the escape and stops.
    big: [kf(0, 350, 160), kf(4, 350, 160), kf(5, 318, 160), kf(6.5, 262, 160), kf(8, 180, 150), kf(8.6, 130, 140), kf(9, 140, 142), kf(10.5, 200, 90), kf(12, 110, 60), kf(13.5, 70, 150), kf(15, 150, 240), kf(16.5, 240, 250), kf(18, 230, 190), kf(19.5, 275, 165), kf(21, 262, 160), kf(22, 279, 160), kf(22.5, 262, 160), kf(24, 262, 160), kf(25.5, 220, 120), kf(27, 300, 60), kf(28.5, 360, 60), kf(30, 360, 60)],
    // The small triangle: approaches with the disc, is struck and moves off, is pursued, waits, then escapes with the disc up the left of the rectangle and over its top (Jon, 2026-11-02: no shape passes through a wall).
    small: [kf(0, 40, 280), kf(3, 120, 220), kf(5, 160, 180), kf(8, 150, 150), kf(8.6, 110, 130), kf(9.2, 60, 70), kf(10.5, 150, 40), kf(12, 70, 40), kf(13.5, 40, 120), kf(15, 110, 230), kf(16.5, 200, 270), kf(18, 170, 250), kf(21, 170, 250), kf(23, 250, 230), kf(25, 265, 180), kf(26.5, 255, 90), kf(28, 420, 40), kf(30, 470, 20)],
    // The disc: approaches, keeps clear of the strike, goes to the house, enters it, waits inside, then comes out and escapes.
    disc: [kf(0, 20, 300), kf(3, 100, 250), kf(5, 150, 210), kf(8, 150, 180), kf(8.6, 150, 205), kf(10, 180, 230), kf(13, 240, 170), kf(15, 275, 160), kf(16.5, 330, 160), kf(18, 355, 140), kf(21, 355, 140), kf(24, 355, 140), kf(25, 330, 160), kf(26, 275, 170), kf(27.5, 265, 80), kf(29, 430, 60), kf(30, 470, 52)],
  },
  // Shut; the large triangle opens it to come out; the disc shuts it behind itself; the disc opens it to leave.
  door: [
    { t: 0, angle: 0 },
    { t: 4, angle: 0 },
    { t: 5, angle: 90 },
    { t: 16, angle: 90 },
    { t: 18.5, angle: 0 },
    { t: 24, angle: 0 },
    { t: 25, angle: 90 },
    { t: 30, angle: 90 },
  ],
}

/**
 * Film 1, the control: each shape on a path of its own, a loop or a sweep
 * that crosses the others' paths at fixed moments without any shape
 * answering another. Authored to match Film 2's total motion, speeds and
 * contacts within 10%, measured by `measure`.
 */
export const FILM_1: Film = {
  id: 1,
  title: 'Film 1',
  duration: 30,
  shapes: {
    big: [kf(0, 84, 82), kf(3, 188, 82), kf(6, 226, 186), kf(9, 129, 231), kf(12, 84, 141), kf(15, 203, 119), kf(18, 151, 224), kf(21, 69, 186), kf(24, 173, 67), kf(27, 233, 156), kf(30, 151, 126)],
    small: [kf(0, 399, 282), kf(3, 285, 250), kf(6, 171, 282), kf(9, 90, 225), kf(12, 163, 136), kf(15, 252, 217), kf(18, 228, 87), kf(21, 122, 87), kf(24, 90, 185), kf(27, 228, 274), kf(30, 382, 234)],
    disc: [kf(0, 206, 85), kf(3, 141, 145), kf(6, 196, 195), kf(9, 206, 130), kf(12, 141, 60), kf(15, 101, 90), kf(18, 166, 165), kf(21, 201, 95), kf(24, 136, 170), kf(27, 111, 95), kf(30, 150, 190)],
  },
  door: [
    { t: 0, angle: 0 },
    { t: 7, angle: 0 },
    { t: 8, angle: 90 },
    { t: 14, angle: 90 },
    { t: 16.5, angle: 0 },
    { t: 22, angle: 0 },
    { t: 23, angle: 90 },
    { t: 30, angle: 90 },
  ],
}

/** Film 3: Film 2 run backward, frame for frame. */
export function reversed(film: Film): Film {
  const D = film.duration
  const flip = <K extends { t: number }>(frames: K[]): K[] => frames.map((f) => ({ ...f, t: D - f.t })).reverse()
  return { id: 3, title: 'Film 3', duration: D, shapes: { big: flip(film.shapes.big), small: flip(film.shapes.small), disc: flip(film.shapes.disc) }, door: flip(film.door) }
}

export const FILM_3: Film = reversed(FILM_2)
export const FILMS: readonly Film[] = [FILM_1, FILM_2, FILM_3]
export const filmById = (id: 1 | 2 | 3): Film => FILMS[id - 1]

/** Linear interpolation between keyframes. */
export function positionAt(frames: readonly Keyframe[], t: number): { x: number; y: number } {
  if (t <= frames[0].t) return { x: frames[0].x, y: frames[0].y }
  for (let i = 1; i < frames.length; i++) {
    if (t <= frames[i].t) {
      const a = frames[i - 1]
      const b = frames[i]
      const u = b.t === a.t ? 1 : (t - a.t) / (b.t - a.t)
      return { x: a.x + u * (b.x - a.x), y: a.y + u * (b.y - a.y) }
    }
  }
  const last = frames[frames.length - 1]
  return { x: last.x, y: last.y }
}

export function doorAngleAt(film: Film, t: number): number {
  const d = film.door
  if (t <= d[0].t) return d[0].angle
  for (let i = 1; i < d.length; i++) {
    if (t <= d[i].t) {
      const a = d[i - 1]
      const b = d[i]
      const u = b.t === a.t ? 1 : (t - a.t) / (b.t - a.t)
      return a.angle + u * (b.angle - a.angle)
    }
  }
  return d[d.length - 1].angle
}

/** Two shapes are in contact when their outlines touch: centers within the sum of their sizes. */
export const contactDistance = (a: ShapeId, b: ShapeId): number => SHAPE_SIZE[a] + SHAPE_SIZE[b]

export interface Measurement {
  /** Path length per shape, and in all. */
  motion: Record<ShapeId, number> & { total: number }
  /** Mean speed per shape, over the whole film. */
  speed: Record<ShapeId, number>
  /** Times two shapes came into contact (entering events), per pair and in all. */
  contacts: { pair: [ShapeId, ShapeId]; count: number }[]
  contactTotal: number
  /** Times the door opened or shut. */
  doorMoves: number
}

/** Measure a film on its keyframe data, sampling at `hz`. */
export function measure(film: Film, hz = 50): Measurement {
  const n = Math.round(film.duration * hz)
  const motion = { big: 0, small: 0, disc: 0, total: 0 }
  const speed = { big: 0, small: 0, disc: 0 }
  for (const s of SHAPES) {
    let last = positionAt(film.shapes[s], 0)
    for (let i = 1; i <= n; i++) {
      const p = positionAt(film.shapes[s], i / hz)
      motion[s] += Math.hypot(p.x - last.x, p.y - last.y)
      last = p
    }
    motion.total += motion[s]
    speed[s] = motion[s] / film.duration
  }
  const pairs: [ShapeId, ShapeId][] = [
    ['big', 'small'],
    ['big', 'disc'],
    ['small', 'disc'],
  ]
  const contacts = pairs.map((pair) => {
    let count = 0
    let inContact = false
    for (let i = 0; i <= n; i++) {
      const t = i / hz
      const a = positionAt(film.shapes[pair[0]], t)
      const b = positionAt(film.shapes[pair[1]], t)
      const close = Math.hypot(a.x - b.x, a.y - b.y) <= contactDistance(pair[0], pair[1])
      if (close && !inContact) count++
      inContact = close
    }
    return { pair, count }
  })
  let doorMoves = 0
  for (let i = 1; i < film.door.length; i++) if (film.door[i].angle !== film.door[i - 1].angle) doorMoves++
  return { motion, speed, contacts, contactTotal: contacts.reduce((a, c) => a + c.count, 0), doorMoves }
}

/** The rating question and the checklist (§7.1), shown only after all three descriptions. */
export const RATING_QUESTION = 'How much did the shapes seem to act on purpose?'
export const DESCRIPTION_PROMPT = 'Describe what happened in this film, in two or three sentences.'
export const MIN_DESCRIPTION_CHARS = 40
export const CHECKLIST = [
  { id: 'c1', label: 'gave a shape a goal (for example, trying to get somewhere or get something)' },
  { id: 'c2', label: 'gave a shape a feeling' },
  { id: 'c3', label: 'described a relationship between shapes' },
  { id: 'c4', label: 'none of these' },
] as const
export type CheckId = (typeof CHECKLIST)[number]['id']
