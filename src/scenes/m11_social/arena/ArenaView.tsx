import { DOORS, POSITIONS, ROOM, SUBORDINATE_DOOR, barrierSegment, visibleFloor, type DoorId, type Point } from '../../../sim/social/arena/geometry'
import type { Trial } from '../../../sim/social/arena/animals'
import { TRIAL_SECONDS } from './store'

/**
 * The arena from above (spec §8.1): the three rooms, the doors with their
 * states, the pieces, the barriers, the dominant at its door with its
 * facing drawn where it can be seen, the subordinate at its door, and a
 * trial playing out: the subordinate's path to the piece it chose and the
 * dominant's to where its rule sent it. Chimpanzees are simple top-down
 * figures with a clear facing, each subordinate a letter in a colored
 * ring. No face anywhere.
 */

const S = 40
const PAD = 3 * S
const W = ROOM.width * S + 2 * PAD
const H = ROOM.height * S + 2 * PAD
const X = (x: number) => PAD + x * S
const Y = (y: number) => PAD + (ROOM.height - y) * S

const LETTER_COLORS: Record<string, string> = { A: '#4f9cff', B: '#f0a94b', C: '#34d399', D: '#c084fc', E: '#f87171' }

/** Where the dominant's room sits for a door, as a rectangle in room units. */
function dominantRoom(door: DoorId): { x: number; y: number; w: number; h: number } {
  const d = DOORS[door]
  if (d.x >= ROOM.width) return { x: ROOM.width, y: 0, w: 2.5, h: ROOM.height }
  if (d.y >= ROOM.height) return { x: 0, y: ROOM.height, w: ROOM.width, h: 2.5 }
  return { x: 0, y: -2.5, w: ROOM.width, h: 2.5 }
}

function Chimp({ at, facing, color, letter, size = 0.45 }: { at: Point; facing: number | null; color: string; letter?: string; size?: number }) {
  const r = size * S
  return (
    <g transform={`translate(${X(at.x)}, ${Y(at.y)})`} data-chimp={letter ?? 'dominant'}>
      <circle r={r} fill={color} stroke="#0b111c" strokeWidth={2} />
      {facing !== null && <path d={`M0,0 L${(r * 1.5 * Math.cos(facing)).toFixed(1)},${(-r * 1.5 * Math.sin(facing)).toFixed(1)}`} stroke="#0b111c" strokeWidth={3} strokeLinecap="round" data-facing />}
      {letter && (
        <text y={4} textAnchor="middle" fontSize={13} fontWeight={700} fill="#0b111c">
          {letter}
        </text>
      )}
    </g>
  )
}

const lerp = (a: Point, b: Point, u: number): Point => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u })
const angle = (from: Point, to: Point) => Math.atan2(to.y - from.y, to.x - from.x)

export function ArenaView({ trial, letter, clock, showSight, door }: { trial: Trial | null; letter: string | null; clock: number; showSight: boolean; door: DoorId }) {
  const view = trial?.view ?? null
  const doorId = view?.door ?? door
  const dEye = DOORS[doorId]
  const room = dominantRoom(doorId)
  const barriers = view?.barriers ?? []
  const u = Math.max(0, Math.min(1, (clock - 0.3) / 0.6))
  const subChoice = trial ? POSITIONS[trial.view.pieces[trial.subordinate].position] : null
  // Where the dominant takes the piece, the subordinate stops short of it rather than standing on the dominant (Jon, 2026-11-02).
  const subEnd = subChoice && trial && !trial.got ? lerp(SUBORDINATE_DOOR, subChoice, 0.72) : subChoice
  const subAt = subEnd ? lerp(SUBORDINATE_DOOR, subEnd, u) : SUBORDINATE_DOOR
  const domStart = trial?.view.subordinateFirst ? Math.max(0, Math.min(1, (clock - 0.6) / 0.5)) : u
  const domAt = trial ? lerp(dEye, trial.dominantTarget, domStart) : dEye
  const doorOpenAtRelease = clock >= 0.3
  const facing: number | null = trial ? (clock < 0.3 ? (trial.view.facing === null ? null : angle(dEye, POSITIONS[trial.view.pieces[trial.view.facing].position])) : angle(dEye, trial.dominantTarget)) : null
  const subFacing = trial ? angle(SUBORDINATE_DOOR, subChoice!) : 0
  const doorState = trial ? (clock < 0.3 ? trial.view.doorBeforeRelease : 'open') : 'viewing'
  const sight = showSight && doorState !== 'shut' ? visibleFloor(doorId, barriers) : []
  const taken = trial && clock >= TRIAL_SECONDS - 0.05 ? trial.dominant : -1
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 8, maxWidth: '100%' }} role="img" aria-label="the arena from above" data-arena data-door={doorId}>
      {/* The central room and the two side rooms. */}
      <rect x={X(0)} y={Y(ROOM.height)} width={ROOM.width * S} height={ROOM.height * S} fill="#1e2738" stroke="var(--border)" strokeWidth={2} />
      <rect x={X(-2.5)} y={Y(ROOM.height)} width={2.5 * S} height={ROOM.height * S} fill="#161d2b" stroke="var(--border)" strokeWidth={2} />
      <text x={X(-1.25)} y={Y(ROOM.height) - 6} textAnchor="middle" fontSize={10} fill="var(--text-muted)">
        subordinate
      </text>
      <rect x={X(room.x)} y={Y(room.y + room.h)} width={room.w * S} height={room.h * S} fill="#161d2b" stroke="var(--border)" strokeWidth={2} />
      <text x={X(room.x + room.w / 2)} y={Y(room.y + room.h) - 6} textAnchor="middle" fontSize={10} fill="var(--text-muted)">
        dominant
      </text>
      {sight.map((p, i) => (
        <rect key={i} x={X(p.x) - 4} y={Y(p.y) - 4} width={9} height={9} fill="rgba(240,169,75,0.22)" data-sight />
      ))}
      {/* The doors: the subordinate's open at release, the dominant's by state. */}
      <rect x={X(0) - 4} y={Y(3) - S * 0.6} width={8} height={S * 1.2} fill={doorOpenAtRelease ? '#1e2738' : '#9aa6b8'} data-sub-door />
      <DominantDoor eye={dEye} state={doorState} />
      {/* The barriers. */}
      {barriers.map((b, i) => {
        const seg = barrierSegment(b)
        return <line key={i} x1={X(seg.a.x)} y1={Y(seg.a.y)} x2={X(seg.b.x)} y2={Y(seg.b.y)} stroke={b.kind === 'opaque' ? '#e7ecf3' : '#67e8f9'} strokeWidth={b.kind === 'opaque' ? 6 : 3} strokeDasharray={b.kind === 'clear' ? '4 3' : undefined} strokeLinecap="round" data-barrier={`${b.position}-${b.side}-${b.kind}`} />
      })}
      {/* The pieces. */}
      {view?.pieces.map((p, k) => {
        const at = POSITIONS[p.position]
        const gone = taken === k || (trial && clock >= TRIAL_SECONDS - 0.05 && trial.subordinate === k && trial.got)
        return <circle key={k} cx={X(at.x)} cy={Y(at.y)} r={7} fill={gone ? 'transparent' : '#f0a94b'} stroke="#f0a94b" strokeWidth={1.5} data-piece={k} />
      })}
      {trial && <Chimp at={subAt} facing={subFacing} color={LETTER_COLORS[letter ?? 'A'] ?? '#4f9cff'} letter={letter ?? undefined} />}
      {!trial && <Chimp at={SUBORDINATE_DOOR} facing={0} color={LETTER_COLORS[letter ?? 'A'] ?? '#4f9cff'} letter={letter ?? undefined} />}
      {doorState !== 'shut' && <Chimp at={domAt} facing={facing} color="#9aa6b8" size={0.55} />}
    </svg>
  )
}

function DominantDoor({ eye, state }: { eye: Point; state: 'open' | 'shut' | 'viewing' }) {
  const vertical = eye.x >= ROOM.width || eye.x <= 0
  const color = state === 'shut' ? '#9aa6b8' : state === 'viewing' ? '#4f9cff' : '#1e2738'
  if (vertical) return <rect x={X(eye.x) - 4} y={Y(eye.y) - S * 0.6} width={8} height={S * 1.2} fill={color} data-dom-door={state} />
  return <rect x={X(eye.x) - S * 0.6} y={Y(eye.y) - 4} width={S * 1.2} height={8} fill={color} data-dom-door={state} />
}

export const ARENA_LEGEND = 'The gray figure is the dominant, with a stroke for where it faces; a lettered figure is the subordinate. The dominant’s door is gray when shut, blue when raised for viewing, dark when open. A white wall is an opaque barrier, a dashed blue one is clear. Amber dots are the two pieces, hollow once taken. The amber shading is the floor the dominant can see from its door.'
