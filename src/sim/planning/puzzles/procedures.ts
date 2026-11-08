import { applyMove, GOAL_PEG, idOf, isGoal, legalMoves, neighbors, arrangementOf, topDisk, type Arrangement, type Move, type Peg } from './hanoi'

/**
 * Five procedures that solve the Tower of Hanoi (spec §6.3), each from
 * Simon (1975) or from the definition of search in §12.2.2, and what each
 * must store at once. None is tuned: each runs as written, and a run that
 * cannot go on stops and says why.
 */

export type ProcedureId = 'search' | 'recursion' | 'largest' | 'pattern' | 'memorized'

export const PROCEDURE_IDS: readonly ProcedureId[] = ['search', 'recursion', 'largest', 'pattern', 'memorized']

export interface ProcedureSpec {
  id: ProcedureId
  label: string
  /** What it does, step by step, as the panel explains it. */
  does: string
  /** What it must store at once. */
  stores: string
  source: string
}

export const PROCEDURES: Record<ProcedureId, ProcedureSpec> = {
  search: {
    id: 'search',
    label: 'Search everything',
    does: 'It examines arrangements in order of their distance from the start, in moves. It takes the arrangement that has waited longest, lists every arrangement one legal move away that it has not seen, adds each to the end of its waiting list, and goes on until the arrangement it takes is the goal. Then it reads back the moves that led there.',
    stores: 'every arrangement waiting to be examined, and for every arrangement seen, which arrangement it was reached from',
    source: '§12.2.2 (search), computed',
  },
  recursion: {
    id: 'recursion',
    label: 'Goal recursion',
    does: 'To move a stack of k disks from one peg to another, it sets three goals in order: move the top k − 1 disks to the spare peg, move the largest of the k disks, then move the k − 1 disks back on top of it. Each goal to move a stack is met the same way, so the goals nest, and a goal to move one disk is a move.',
    stores: 'a stack of goals, which grows to depth n in solving an n-disk problem',
    source: 'simon_1975 pp. 269–270, 279',
  },
  largest: {
    id: 'largest',
    label: 'Largest disk out of place',
    does: 'It looks at the pegs, finds the largest disk that is not yet on the right peg, and finds the largest disk in that disk’s way: on top of it, or on the right peg. If nothing is in the way, it moves the disk. Otherwise its goal becomes moving the disk in the way to the third peg, and it looks again from there. This is means–ends analysis (§12.2.2): a heuristic, a rule of thumb that directs search toward small, promising parts of a problem space, which chooses each move by the difference between the current state and the goal and makes the conditions for a move that cannot yet be made into a subgoal.',
    stores: 'one current goal, whatever the number of disks',
    source: 'simon_1975 pp. 272, 281',
  },
  pattern: {
    id: 'pattern',
    label: 'Move pattern',
    does: 'On every odd-numbered move it moves the smallest disk one peg along, always in the same direction around the three pegs. The direction depends on whether the number of disks is odd or even. On every even-numbered move it makes the one legal move that does not move the smallest disk.',
    stores: 'whether the next move is odd or even',
    source: 'simon_1975 p. 273 (its page says “pegs” where it means disks; p. 282 says disks)',
  },
  memorized: {
    id: 'memorized',
    label: 'Memorized moves',
    does: 'It has the 15 moves of the four-disk solution as a list, each move a peg to take from and a peg to put on, and applies them in order.',
    stores: 'the list of 15 moves',
    source: 'simon_1975 pp. 272, 287',
  },
}

export interface Run {
  procedure: ProcedureId
  disks: number
  start: Arrangement
  /** Every arrangement passed through, start first. */
  states: Arrangement[]
  moves: Move[]
  /** Arrangements examined: for search, every arrangement taken from the waiting list; for the others, every arrangement passed through. */
  examined: number
  /** The most it had to store at once: a count of arrangements, goals, moves, or one. */
  stored: number
  /** What was stored, for the panel. */
  storedWhat: string
  solved: boolean
  /** Why it stopped short, when it did. */
  stopped: string | null
  /** For goal recursion: the stack's depth after each move, for the live display. */
  stackDepths?: number[]
}

/** A run never goes past this many moves: a procedure that cycles is stopped and says so. */
const MOVE_CAP = (n: number) => 4 * 2 ** n

export function runProcedure(id: ProcedureId, disks: number, start: Arrangement): Run {
  switch (id) {
    case 'search':
      return searchEverything(disks, start)
    case 'recursion':
      return goalRecursion(disks, start)
    case 'largest':
      return largestOutOfPlace(disks, start)
    case 'pattern':
      return movePattern(disks, start)
    case 'memorized':
      return memorizedMoves(disks, start)
  }
}

function moveBetween(a: Arrangement, b: Arrangement): Move {
  const d = a.findIndex((p, i) => p !== b[i])
  return { from: a[d], to: b[d] }
}

export function searchEverything(disks: number, start: Arrangement): Run {
  const startId = idOf(start)
  const prev = new Map<number, number>([[startId, -1]])
  const queue = [startId]
  let examined = 0
  let stored = 1
  let found = false
  while (queue.length) {
    stored = Math.max(stored, queue.length)
    const id = queue.shift()!
    examined++
    const a = arrangementOf(id, disks)
    if (isGoal(a)) {
      found = true
      break
    }
    for (const nb of neighbors(a).map(idOf))
      if (!prev.has(nb)) {
        prev.set(nb, id)
        queue.push(nb)
      }
  }
  const states: Arrangement[] = []
  if (found) for (let id = idOf(new Array<Peg>(disks).fill(GOAL_PEG)); id !== -1; id = prev.get(id)!) states.unshift(arrangementOf(id, disks))
  const moves = states.slice(1).map((s, i) => moveBetween(states[i], s))
  return { procedure: 'search', disks, start, states, moves, examined, stored, storedWhat: 'arrangements waiting to be examined', solved: found, stopped: found ? null : 'The goal was not reached.' }
}

export function goalRecursion(disks: number, start: Arrangement): Run {
  const states: Arrangement[] = [start]
  const moves: Move[] = []
  const stackDepths: number[] = []
  let a = start
  let depth = 0
  let maxDepth = 0
  let stopped: string | null = null
  // Move the stack of disks 0..k−1 from wherever disk k−1 is to `to`.
  const moveStack = (k: number, to: Peg): void => {
    if (stopped || k === 0) return
    const top = k - 1
    const from = a[top]
    if (from === to) return
    // The stack must be a pyramid: every disk below `top` on the same peg as `top`.
    for (let d = 0; d < top; d++)
      if (a[d] !== from) {
        stopped = `Goal recursion sets the goal of moving the stack of disks 1 to ${k} as one pyramid, but from this arrangement those disks are not on one peg, so the goal cannot be set and the procedure stops.`
        return
      }
    depth++
    maxDepth = Math.max(maxDepth, depth)
    stackDepths[moves.length] = depth
    const spare = (3 - from - to) as Peg
    moveStack(top, spare)
    if (stopped) return
    a = applyMove(a, { from, to })
    moves.push({ from, to })
    states.push(a)
    stackDepths[moves.length] = depth
    moveStack(top, to)
    depth--
  }
  moveStack(disks, GOAL_PEG)
  const solved = isGoal(a)
  if (!solved && !stopped) stopped = 'The largest disk was already on the right peg, so the procedure’s one goal, to move the whole stack there, counted as met, and it stopped with smaller disks still out of place.'
  return { procedure: 'recursion', disks, start, states, moves, examined: states.length, stored: maxDepth, storedWhat: 'goals on the stack', solved, stopped, stackDepths }
}

export function largestOutOfPlace(disks: number, start: Arrangement): Run {
  const states: Arrangement[] = [start]
  const moves: Move[] = []
  let a = start
  let stopped: string | null = null
  const cap = MOVE_CAP(disks)
  while (!isGoal(a)) {
    if (moves.length >= cap) {
      stopped = 'The procedure did not reach the goal within four times the shortest solution’s length.'
      break
    }
    // The largest disk not on the goal peg; then the largest disk in its way, on its peg above it or on the target peg, and so on.
    let disk = -1
    for (let d = disks - 1; d >= 0; d--)
      if (a[d] !== GOAL_PEG) {
        disk = d
        break
      }
    let target: Peg = GOAL_PEG
    for (;;) {
      let obstructor = -1
      for (let d = disk - 1; d >= 0; d--)
        if (a[d] === a[disk] || a[d] === target) {
          obstructor = d
          break
        }
      if (obstructor < 0) break
      target = (3 - a[disk] - target) as Peg
      disk = obstructor
    }
    const m = { from: a[disk], to: target }
    a = applyMove(a, m)
    moves.push(m)
    states.push(a)
  }
  return { procedure: 'largest', disks, start, states, moves, examined: states.length, stored: 1, storedWhat: 'one current goal', solved: isGoal(a), stopped }
}

export function movePattern(disks: number, start: Arrangement): Run {
  const states: Arrangement[] = [start]
  const moves: Move[] = []
  let a = start
  let stopped: string | null = null
  // The smallest disk cycles source → target → other for an odd number of disks, and source → other → target for an even one (simon_1975 p. 273).
  const cycle: Peg[] = disks % 2 === 1 ? [0, 2, 1] : [0, 1, 2]
  const seen = new Set<number>([idOf(a)])
  const cap = MOVE_CAP(disks)
  for (let k = 1; !isGoal(a); k++) {
    if (moves.length >= cap) {
      stopped = 'The pattern did not reach the goal within four times the shortest solution’s length.'
      break
    }
    let m: Move
    if (k % 2 === 1) {
      const from = a[0]
      const to = cycle[(cycle.indexOf(from) + 1) % 3]
      m = { from, to }
    } else {
      const others = legalMoves(a).filter((mv) => topDisk(a, mv.from) !== 0)
      if (others.length !== 1) {
        stopped = others.length === 0 ? 'On an even-numbered move there was no legal move that leaves the smallest disk where it is, so the pattern stops.' : 'On an even-numbered move more than one legal move left the smallest disk where it is, which the pattern does not decide between, so it stops.'
        break
      }
      m = others[0]
    }
    a = applyMove(a, m)
    moves.push(m)
    states.push(a)
    const id = idOf(a)
    if (seen.has(id) && !isGoal(a)) {
      stopped = 'The pattern returned to an arrangement it had already passed through, so it is cycling, and it stops.'
      break
    }
    seen.add(id)
  }
  return { procedure: 'pattern', disks, start, states, moves, examined: states.length, stored: 1, storedWhat: 'whether the move is odd or even', solved: isGoal(a), stopped }
}

/** The four-disk solution's 15 moves, as a list, computed once from goal recursion on four disks. */
export const MEMORIZED_LIST: Move[] = goalRecursion(4, [0, 0, 0, 0]).moves

export function memorizedMoves(disks: number, start: Arrangement): Run {
  const states: Arrangement[] = [start]
  const moves: Move[] = []
  let a = start
  let stopped: string | null = null
  for (const m of MEMORIZED_LIST) {
    if (isGoal(a)) break
    const why = illegal(a, m)
    if (why) {
      stopped = `Move ${moves.length + 1} of the list, ${PEG_WORD[m.from]} to ${PEG_WORD[m.to]}, is not legal from this arrangement: ${why}`
      break
    }
    a = applyMove(a, m)
    moves.push(m)
    states.push(a)
  }
  if (!stopped && !isGoal(a)) stopped = 'The list of 15 moves ran out with the disks on the wrong pegs.'
  return { procedure: 'memorized', disks, start, states, moves, examined: states.length, stored: MEMORIZED_LIST.length, storedWhat: 'moves in the list', solved: isGoal(a), stopped }
}

const PEG_WORD: Record<Peg, string> = { 0: 'the left peg', 1: 'the middle peg', 2: 'the right peg' }

function illegal(a: Arrangement, m: Move): string | null {
  const d = topDisk(a, m.from)
  if (d === null) return `${PEG_WORD[m.from]} has no disk to move.`
  const t = topDisk(a, m.to)
  if (t !== null && t < d) return 'a larger disk cannot be placed on a smaller one.'
  return null
}

/** The shortest solution's length for n disks: 2ⁿ − 1. */
export const shortestMoves = (n: number) => 2 ** n - 1
