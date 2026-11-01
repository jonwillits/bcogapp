import { useEffect, useRef, useState } from 'react'
import { HOUSE, SHAPES, SHAPE_SIZE, STAGE, doorAngleAt, positionAt, type Film, type ShapeId } from '../../../sim/social/shapes/films'

/**
 * The film player (spec §7.1): the three shapes and the rectangle with its
 * door, drawn from the keyframe data at the wall clock's time, on an
 * animation frame loop. Flat outlines, no faces, no eyes. A triangle
 * points the way it moves. The player reports its clock to the store, and
 * the store ends the film at its duration; timing is by `performance.now`,
 * so a throttled frame loop lowers the frame rate and not the length.
 */

function triangle(size: number, heading: number): string {
  const pts = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((a) => `${(size * Math.cos(heading + a)).toFixed(1)},${(size * Math.sin(heading + a)).toFixed(1)}`)
  return pts.join(' ')
}

const COLORS: Record<ShapeId, string> = { big: '#e7ecf3', small: '#e7ecf3', disc: '#e7ecf3' }

export function FilmFrame({ film, t }: { film: Film; t: number }) {
  const door = doorAngleAt(film, t)
  const hinge = { x: HOUSE.x, y: HOUSE.doorTop }
  const len = HOUSE.doorBottom - HOUSE.doorTop
  const rad = (door * Math.PI) / 180
  const doorEnd = { x: hinge.x - len * Math.sin(rad), y: hinge.y + len * Math.cos(rad) }
  return (
    <svg width={STAGE.width} height={STAGE.height} viewBox={`0 0 ${STAGE.width} ${STAGE.height}`} style={{ display: 'block', background: '#0b1020', borderRadius: 8, maxWidth: '100%' }} role="img" aria-label={film.title} data-film={film.id}>
      {/* The rectangle: three sides and a top and bottom, with the door segment hinged on the left side. */}
      <path d={`M${HOUSE.x},${HOUSE.y} L${HOUSE.x + HOUSE.width},${HOUSE.y} L${HOUSE.x + HOUSE.width},${HOUSE.y + HOUSE.height} L${HOUSE.x},${HOUSE.y + HOUSE.height} L${HOUSE.x},${HOUSE.doorBottom} M${HOUSE.x},${HOUSE.doorTop} L${HOUSE.x},${HOUSE.y}`} fill="none" stroke="#e7ecf3" strokeWidth={3} />
      <line x1={hinge.x} y1={hinge.y} x2={doorEnd.x} y2={doorEnd.y} stroke="#e7ecf3" strokeWidth={3} data-door={Math.round(door)} />
      {SHAPES.map((s) => {
        const p = positionAt(film.shapes[s], t)
        const q = positionAt(film.shapes[s], Math.min(film.duration, t + 0.1))
        const heading = Math.hypot(q.x - p.x, q.y - p.y) > 0.5 ? Math.atan2(q.y - p.y, q.x - p.x) : 0
        if (s === 'disc') return <circle key={s} cx={p.x} cy={p.y} r={SHAPE_SIZE.disc} fill="none" stroke={COLORS[s]} strokeWidth={3} data-shape={s} />
        return <polygon key={s} points={triangle(SHAPE_SIZE[s], heading)} transform={`translate(${p.x.toFixed(1)}, ${p.y.toFixed(1)})`} fill="none" stroke={COLORS[s]} strokeWidth={3} data-shape={s} />
      })}
    </svg>
  )
}

export function FilmPlayer({ film, playing, onClock }: { film: Film; playing: boolean; onClock: (t: number) => void }) {
  const [t, setT] = useState(0)
  const start = useRef<number | null>(null)
  const cb = useRef(onClock)
  cb.current = onClock
  useEffect(() => {
    if (!playing) return
    start.current = performance.now()
    let raf = 0
    let done = false
    const frame = () => {
      const now = (performance.now() - (start.current ?? performance.now())) / 1000
      const clock = Math.min(film.duration, now)
      setT(clock)
      cb.current(clock)
      if (clock < film.duration) raf = requestAnimationFrame(frame)
      else done = true
    }
    raf = requestAnimationFrame(frame)
    // A fallback timer, since a hidden pane may not run frames at all: the film still ends on time.
    const guard = setInterval(() => {
      if (done) return
      const now = (performance.now() - (start.current ?? performance.now())) / 1000
      if (now >= film.duration) {
        done = true
        setT(film.duration)
        cb.current(film.duration)
      }
    }, 250)
    return () => {
      cancelAnimationFrame(raf)
      clearInterval(guard)
    }
  }, [playing, film])
  return <FilmFrame film={film} t={t} />
}
