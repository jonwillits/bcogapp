import type { Rng } from '../../random'
import { DOORS, SUBORDINATE_DOOR, POSITIONS, distance, inLineOfSight, type Barrier, type DoorId, type Point } from './geometry'

/**
 * A trial (spec §8.2): baiting, an optional move, an optional swap of the
 * dominant, release, the subordinate's choice, then the dominant's. The
 * dominant follows one rule in every trial, for every subordinate: it goes
 * to the place it last saw a piece placed or moved, or, if it saw neither,
 * to the nearer piece in its line of sight at release, or, if it sees
 * neither, to a piece at random. Before release, while its door is open or
 * raised for viewing, it faces the place it will go to.
 *
 * What a subordinate is given is a `View`: the layout and what happened,
 * with the dominant's facing where it could be seen. The three sighted
 * subordinates compute line of sight from it through `geometry.ts`; the
 * learner reads only the observable record (`features.ts`).
 */

export type DoorState = 'open' | 'shut' | 'viewing'

export interface PieceSpec {
  position: number
  barrier: Omit<Barrier, 'position'> | null
}

export interface TestSpec {
  id: string
  title: string
  /** One line, for the menu and the matrix. */
  what: string
  door: DoorId
  pieces: [PieceSpec, PieceSpec]
  /** The dominant's door while each piece is placed: open or viewing, and the dominant watches the piece being placed, wherever it is put (Hare et al., 2001); shut, and it does not. In the standard tests the baiting is done with the door down, and the dominant sees the arena through its door only afterward. */
  placedDoor: [DoorState, DoorState]
  /** The order the pieces are placed in. */
  placeOrder: [0 | 1, 1 | 0]
  /** The dominant that was present is replaced by one that was not, after the first placement. */
  swapAfterFirst: boolean
  /** A piece moved to another position, with the dominant's door in the stated state. */
  move: { piece: 0 | 1; to: number; barrier: Omit<Barrier, 'position'> | null; door: DoorState } | null
  /** The dominant's door between the last baiting event and release: where it is open or viewing, the dominant can be seen facing. */
  doorBeforeRelease: DoorState
  /** The subordinate is released first, with a head start. */
  subordinateFirst: boolean
  /** Which piece the column counts: the piece outside the dominant's line of sight (T1–T3, T7, T8), by the barrier (T2), or the piece it did not see placed or moved (T4–T6). */
  scoredPiece: 0 | 1
  scoredLabel: string
  /** Held back until Part 4's Step 3. */
  heldOut?: boolean
}

/** What a subordinate is shown: the layout and the record, with the dominant's facing where visible. */
export interface View {
  door: DoorId
  /** Each piece at its current position with its barrier, if any. */
  pieces: { position: number; barrier: Omit<Barrier, 'position'> | null }[]
  /** Every barrier on the floor. */
  barriers: Barrier[]
  /** Per piece: the dominant's door while it was placed, whether the present dominant was present then, and the move if any. */
  record: {
    placedDoor: DoorState
    /** The present dominant was the one present at this piece's placement. */
    presentAtPlacement: boolean
    moved: { door: DoorState; presentAtMove: boolean } | null
    placedOrder: number
  }[]
  swapped: boolean
  subordinateFirst: boolean
  /** The piece the dominant faces before release, or null when its door is shut. */
  facing: 0 | 1 | null
  /** The dominant's door at release. */
  doorBeforeRelease: DoorState
}

export interface TrialOutcome {
  /** The piece the subordinate went to first. */
  subordinate: 0 | 1
  /** The piece the dominant went to; -1 where it went to an empty place. */
  dominant: 0 | 1 | -1
  /** Whether the subordinate got its piece. */
  got: boolean
  view: View
}

/** The dominant's record of what it saw: the location of the most recent placement or move it watched. */
interface DominantMemory {
  lastSeen: { piece: 0 | 1; position: number } | null
}

const sees = (door: DoorState) => door === 'open' || door === 'viewing'

/** Lay out the trial and run the dominant's side of it: returns the view for a subordinate and the dominant's choice. */
export function stageTrial(test: TestSpec, rng: Rng): { view: View; dominant: 0 | 1 | -1; dominantTarget: Point } {
  const positions: [number, number] = [test.pieces[0].position, test.pieces[1].position]
  const barriersOf: [Omit<Barrier, 'position'> | null, Omit<Barrier, 'position'> | null] = [test.pieces[0].barrier, test.pieces[1].barrier]
  let memory: DominantMemory = { lastSeen: null }
  const presentAt: [boolean, boolean] = [true, true]
  const record: View['record'] = [
    { placedDoor: test.placedDoor[0], presentAtPlacement: true, moved: null, placedOrder: test.placeOrder.indexOf(0) },
    { placedDoor: test.placedDoor[1], presentAtPlacement: true, moved: null, placedOrder: test.placeOrder.indexOf(1) },
  ]
  // Baiting, in order, with the swap after the first placement where the test has one.
  test.placeOrder.forEach((piece, k) => {
    if (sees(test.placedDoor[piece])) memory = { lastSeen: { piece, position: positions[piece] } }
    if (k === 0 && test.swapAfterFirst) {
      memory = { lastSeen: null }
      presentAt[piece] = false
      record[piece].presentAtPlacement = false
    }
  })
  // The move.
  let moved: { piece: 0 | 1; presentAtMove: boolean; door: DoorState } | null = null
  if (test.move) {
    const m = test.move
    positions[m.piece] = m.to
    barriersOf[m.piece] = m.barrier
    moved = { piece: m.piece, presentAtMove: true, door: m.door }
    record[m.piece].moved = { door: m.door, presentAtMove: true }
    if (sees(m.door)) memory = { lastSeen: { piece: m.piece, position: m.to } }
  }
  const barriers: Barrier[] = []
  for (let k = 0; k < 2; k++) {
    const b = barriersOf[k]
    if (b) barriers.push({ position: positions[k], ...b })
  }
  // The dominant's target: where it last saw a piece, else the nearer piece in its line of sight at release, else at random.
  const eye = DOORS[test.door]
  let target: Point
  let dominant: 0 | 1 | -1
  if (memory.lastSeen) {
    target = POSITIONS[memory.lastSeen.position]
    dominant = positions[memory.lastSeen.piece] === memory.lastSeen.position ? memory.lastSeen.piece : -1
  } else {
    const visible = ([0, 1] as const).filter((k) => inLineOfSight(eye, POSITIONS[positions[k]], barriers))
    if (visible.length === 0) dominant = rng.int(2) as 0 | 1
    else if (visible.length === 1) dominant = visible[0]
    else {
      const d0 = distance(eye, POSITIONS[positions[0]])
      const d1 = distance(eye, POSITIONS[positions[1]])
      dominant = Math.abs(d0 - d1) < 1e-9 ? (rng.int(2) as 0 | 1) : d0 < d1 ? 0 : 1
    }
    target = POSITIONS[positions[dominant]]
  }
  const facing: 0 | 1 | null = sees(test.doorBeforeRelease) ? (dominant === -1 ? memory.lastSeen!.piece : dominant) : null
  void moved
  void presentAt
  const view: View = {
    door: test.door,
    pieces: [0, 1].map((k) => ({ position: positions[k], barrier: barriersOf[k] })),
    barriers,
    record,
    swapped: test.swapAfterFirst,
    subordinateFirst: test.subordinateFirst,
    facing,
    doorBeforeRelease: test.doorBeforeRelease,
  }
  return { view, dominant, dominantTarget: target }
}

/** The subordinate's door sees every piece: a sanity check on a layout. */
export function subordinateSeesBoth(view: View): boolean {
  return view.pieces.every((p) => inLineOfSight(SUBORDINATE_DOOR, POSITIONS[p.position], view.barriers))
}

// ------------------------------------------------------------- the tests (§8.3)

const opaque = (side: Barrier['side']) => ({ side, kind: 'opaque' as const })
const clear = (side: Barrier['side']) => ({ side, kind: 'clear' as const })

/**
 * The menu of presets, one row each of the chapter's chain (`t-canon-chain`)
 * or of Hare et al. (2001), plus T8 held out. Positions: 1 is (5, 1.5), 7
 * is (5, 4.5), equidistant from the east door and from the top door; 3 is
 * (3, 3), 5 is (7, 3), 4 is (5, 3).
 *
 * T6 departs from the spec's one line ("as T5 without the move; the
 * dominant that watched is replaced by one that did not"): with both pieces
 * placed before the swap, the new dominant watched neither, and no rule
 * could prefer one piece. Here the first piece is placed, the dominant is
 * replaced, and the second piece is placed with the new dominant watching,
 * so that exactly one piece is unwatched by the present dominant, which is
 * what Hare et al. (2001, Experiment 2) varied. The as-built notes record it.
 */
export const TESTS: TestSpec[] = [
  {
    id: 'T1',
    title: 'T1 Standard',
    what: 'baited with the dominant’s door down; then the dominant watches through its door: one piece in the open, one behind an opaque barrier on the subordinate’s side',
    door: 'east',
    pieces: [
      { position: 1, barrier: opaque('E') },
      { position: 7, barrier: null },
    ],
    placedDoor: ['shut', 'shut'],
    placeOrder: [0, 1],
    swapAfterFirst: false,
    move: null,
    doorBeforeRelease: 'viewing',
    subordinateFirst: false,
    scoredPiece: 0,
    scoredLabel: 'the piece outside the dominant’s line of sight',
  },
  {
    id: 'T2',
    title: 'T2 Clear barrier',
    what: 'as T1, with a clear barrier',
    door: 'east',
    pieces: [
      { position: 1, barrier: clear('E') },
      { position: 7, barrier: null },
    ],
    placedDoor: ['shut', 'shut'],
    placeOrder: [0, 1],
    swapAfterFirst: false,
    move: null,
    doorBeforeRelease: 'viewing',
    subordinateFirst: false,
    scoredPiece: 0,
    scoredLabel: 'the piece by the clear barrier',
  },
  {
    id: 'T3',
    title: 'T3 Door shut',
    what: 'as T1, with the dominant’s door shut throughout until release',
    door: 'east',
    pieces: [
      { position: 1, barrier: opaque('E') },
      { position: 7, barrier: null },
    ],
    placedDoor: ['shut', 'shut'],
    placeOrder: [0, 1],
    swapAfterFirst: false,
    move: null,
    doorBeforeRelease: 'shut',
    subordinateFirst: false,
    scoredPiece: 0,
    scoredLabel: 'the piece outside the dominant’s line of sight',
  },
  {
    id: 'T4',
    title: 'T4 Did not watch',
    what: 'both pieces behind opaque barriers; one placed with the dominant watching, the other with its door shut; door open at release',
    door: 'east',
    pieces: [
      { position: 1, barrier: opaque('E') },
      { position: 7, barrier: opaque('E') },
    ],
    placedDoor: ['viewing', 'shut'],
    placeOrder: [0, 1],
    swapAfterFirst: false,
    move: null,
    doorBeforeRelease: 'viewing',
    subordinateFirst: false,
    scoredPiece: 1,
    scoredLabel: 'the piece the dominant did not see placed',
  },
  {
    id: 'T5',
    title: 'T5 Missed a move',
    what: 'both pieces behind barriers, placed with the dominant watching; one moved to a third barrier with its door shut',
    door: 'east',
    pieces: [
      { position: 1, barrier: opaque('E') },
      { position: 7, barrier: opaque('E') },
    ],
    placedDoor: ['viewing', 'viewing'],
    placeOrder: [0, 1],
    swapAfterFirst: false,
    move: { piece: 0, to: 3, barrier: opaque('E'), door: 'shut' },
    doorBeforeRelease: 'viewing',
    subordinateFirst: false,
    scoredPiece: 0,
    scoredLabel: 'the piece the dominant did not see moved',
  },
  {
    id: 'T6',
    title: 'T6 Swap',
    what: 'both pieces behind barriers; the first placed with the dominant watching, then that dominant replaced by one that did not watch, then the second placed with the new dominant watching',
    door: 'east',
    pieces: [
      { position: 1, barrier: opaque('E') },
      { position: 7, barrier: opaque('E') },
    ],
    placedDoor: ['viewing', 'viewing'],
    placeOrder: [0, 1],
    swapAfterFirst: true,
    move: null,
    doorBeforeRelease: 'viewing',
    subordinateFirst: false,
    scoredPiece: 0,
    scoredLabel: 'the piece the present dominant did not see placed',
  },
  {
    id: 'T7',
    title: 'T7 Released first',
    what: 'as T1, with the subordinate released first',
    door: 'east',
    pieces: [
      { position: 1, barrier: opaque('E') },
      { position: 7, barrier: null },
    ],
    placedDoor: ['shut', 'shut'],
    placeOrder: [0, 1],
    swapAfterFirst: false,
    move: null,
    doorBeforeRelease: 'viewing',
    subordinateFirst: true,
    scoredPiece: 0,
    scoredLabel: 'the piece outside the dominant’s line of sight',
  },
  {
    id: 'T8',
    title: 'T8 New layout',
    what: 'the dominant enters by a door on the top wall it has never used, with barriers at new positions',
    door: 'top',
    pieces: [
      { position: 1, barrier: opaque('N') },
      { position: 7, barrier: null },
    ],
    placedDoor: ['shut', 'shut'],
    placeOrder: [0, 1],
    swapAfterFirst: false,
    move: null,
    doorBeforeRelease: 'viewing',
    subordinateFirst: false,
    scoredPiece: 0,
    scoredLabel: 'the piece outside the dominant’s line of sight',
    heldOut: true,
  },
]

export const testById = (id: string): TestSpec => TESTS.find((t) => t.id === id)!
export const TRIALS_PER_RUN = 10
