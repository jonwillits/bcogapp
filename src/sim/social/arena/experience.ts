import { makeRng, type Rng } from '../../random'
import { DOOR_IDS, NEW_DOOR, USUAL_DOOR, hidingSide, type Barrier, type DoorId } from './geometry'
import { ContestLearner, LEARNER } from './learner'
import { stageTrial, TESTS, testById, type TestSpec } from './trial'

/**
 * The learner's experience (spec §8.5): **the usual room**, a seeded
 * history of contests across T1–T7's layouts with the dominant always at
 * its usual door; or **many rooms**, the same number of contests across
 * many layouts and doors, never T8's exact layout. Each contest is staged
 * by the arena, the dominant takes a piece by its rule, and the learner is
 * given the observable record and the outcome.
 *
 * The world builds each layout (which barrier side hides a piece from a
 * door is the arena's knowledge); the learner never reads it.
 */

export type Experience = 'usual' | 'many'
export const EXPERIENCES: { id: Experience; label: string }[] = [
  { id: 'usual', label: 'the usual room' },
  { id: 'many', label: 'many rooms' },
]
export const HISTORY_CONTESTS = 300

const opaque = (side: Barrier['side']) => ({ side, kind: 'opaque' as const })
const clear = (side: Barrier['side']) => ({ side, kind: 'clear' as const })

/** A variant of a test type at random positions, with the hiding barriers on the side that hides from the door given. */
export function variantOf(base: TestSpec, door: DoorId, rng: Rng): TestSpec {
  // Two distinct positions, and a third for a move.
  const pool = Array.from({ length: 9 }, (_, i) => i)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const [p0, p1, p2] = pool
  const hides = (pos: number) => opaque(hidingSide(pos, door))
  const decoy = (pos: number) => {
    // A barrier on a side that does not hide the piece from the door, a quarter of the time.
    if (rng.next() > 0.25) return null
    const h = hidingSide(pos, door)
    const others = (['N', 'E', 'S', 'W'] as const).filter((s) => s !== h)
    return opaque(others[rng.int(others.length)])
  }
  const pieces: TestSpec['pieces'] = [
    { position: p0, barrier: base.pieces[0].barrier ? (base.pieces[0].barrier.kind === 'clear' ? clear(hidingSide(p0, door)) : hides(p0)) : decoy(p0) },
    { position: p1, barrier: base.pieces[1].barrier ? (base.pieces[1].barrier.kind === 'clear' ? clear(hidingSide(p1, door)) : hides(p1)) : decoy(p1) },
  ]
  const swapPieces = rng.next() < 0.5
  const spec: TestSpec = {
    ...base,
    door,
    pieces: swapPieces ? [pieces[1], pieces[0]] : pieces,
    placedDoor: swapPieces ? [base.placedDoor[1], base.placedDoor[0]] : base.placedDoor,
    placeOrder: rng.next() < 0.5 ? [0, 1] : [1, 0],
    move: base.move ? { ...base.move, piece: swapPieces ? ((1 - base.move.piece) as 0 | 1) : base.move.piece, to: p2, barrier: hides(p2) } : null,
    scoredPiece: swapPieces ? ((1 - base.scoredPiece) as 0 | 1) : base.scoredPiece,
  }
  return spec
}

/** Whether a layout is T8's exact one: its door and its two pieces with their barriers. */
export function isNewLayout(spec: TestSpec): boolean {
  const t8 = testById('T8')
  const same = (a: TestSpec['pieces'][number], b: TestSpec['pieces'][number]) => a.position === b.position && (a.barrier?.side ?? null) === (b.barrier?.side ?? null) && (a.barrier?.kind ?? null) === (b.barrier?.kind ?? null)
  if (spec.door !== t8.door) return false
  return (same(spec.pieces[0], t8.pieces[0]) && same(spec.pieces[1], t8.pieces[1])) || (same(spec.pieces[0], t8.pieces[1]) && same(spec.pieces[1], t8.pieces[0]))
}

/** A trained learner for one experience and seed. */
export function trainLearner(experience: Experience, seed: number, hidden = 0, contests = HISTORY_CONTESTS, passes?: number): ContestLearner {
  const rng = makeRng(seed ^ 0x1ea7)
  const learner = new ContestLearner(rng.fork(), hidden)
  const familiar = TESTS.filter((t) => !t.heldOut)
  const history: TestSpec[] = []
  while (history.length < contests) {
    const base = familiar[rng.int(familiar.length)]
    const door = experience === 'usual' ? USUAL_DOOR : DOOR_IDS[rng.int(DOOR_IDS.length)]
    const spec = variantOf(base, door, rng)
    if (experience === 'many' && isNewLayout(spec)) continue
    history.push(spec)
  }
  const nPasses = passes ?? LEARNER.passes
  const order = history.map((_, i) => i)
  for (let pass = 0; pass < nPasses; pass++) {
    for (let i = order.length - 1; i > 0; i--) {
      const j = rng.int(i + 1)
      ;[order[i], order[j]] = [order[j], order[i]]
    }
    for (const i of order) {
      const staged = stageTrial(history[i], rng)
      learner.learnContest(staged.view, staged.dominant)
    }
  }
  return learner
}

export { NEW_DOOR }
