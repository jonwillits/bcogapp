import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { radiusAt } from '../../sim/rodent/shape'
import type { Pose, Room } from '../../sim/rodent/body'
import { makeRng } from '../../sim/random'

/**
 * A recording box (spec §9): a floor, walls on the room's boundary, and a
 * card flush against its wall. Lit, a ceiling light and a soft ambient;
 * dark, nothing but a faint glow at the floor near the rat, and fog that
 * closes in within a few centimeters, so the floor's texture is the only
 * thing that moves past.
 */

const WALL_COLORS: Record<string, string> = { gray: '#8d8d8a', blue: '#4a5f8a', white: '#d8d8d4' }
const FLOOR_COLORS: Record<string, string> = { dark: '#3a3531', pale: '#9a9486' }

function makeFloorTexture(pale: boolean): THREE.CanvasTexture {
  const size = 128
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  ctx.fillStyle = pale ? '#9a9486' : '#3a3531'
  ctx.fillRect(0, 0, size, size)
  const rng = makeRng(31)
  for (let i = 0; i < 500; i++) {
    const v = Math.floor(rng.range(-25, 25))
    ctx.fillStyle = pale ? `rgb(${154 + v},${148 + v},${134 + v})` : `rgb(${58 + v},${53 + v},${49 + v})`
    ctx.fillRect(rng.range(0, size), rng.range(0, size), rng.range(1, 4), rng.range(1, 4))
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(8, 8)
  return t
}

function NearGlow({ pose, lit }: { pose: () => Pose; lit: boolean }) {
  const ref = useRef<THREE.PointLight>(null)
  useFrame(() => {
    const p = pose()
    if (ref.current) ref.current.position.set(p.x, 0.12, -p.y)
  })
  return <pointLight ref={ref} intensity={lit ? 0 : 0.35} distance={0.35} decay={2} color="#c8d0ff" />
}

export function BoxView({ room, lit, pose, cardMoved }: { room: Room; lit: boolean; pose: () => Pose; cardMoved: Map<string, { x: number; y: number }> }) {
  const tex = useMemo(() => makeFloorTexture(room.floorColor === 'pale'), [room.floorColor])
  useEffect(() => () => tex.dispose(), [tex])
  const wallH = 0.5
  // Walls as segments along the boundary: 4 for a rectangle, 48 for anything round.
  const segments = useMemo(() => {
    const n = room.shape.roundness > 0 ? 48 : 4
    const out: { x: number; y: number; angle: number; length: number }[] = []
    if (n === 4) {
      const [hx, hy] = [room.shape.width / 2, room.shape.length / 2]
      out.push({ x: hx, y: 0, angle: Math.PI / 2, length: room.shape.length }, { x: -hx, y: 0, angle: Math.PI / 2, length: room.shape.length }, { x: 0, y: hy, angle: 0, length: room.shape.width }, { x: 0, y: -hy, angle: 0, length: room.shape.width })
      return out
    }
    for (let i = 0; i < n; i++) {
      const a0 = (2 * Math.PI * i) / n
      const a1 = (2 * Math.PI * (i + 1)) / n
      const r0 = radiusAt(room.shape, a0)
      const r1 = radiusAt(room.shape, a1)
      const x0 = r0 * Math.cos(a0)
      const y0 = r0 * Math.sin(a0)
      const x1 = r1 * Math.cos(a1)
      const y1 = r1 * Math.sin(a1)
      out.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, angle: Math.atan2(y1 - y0, x1 - x0), length: Math.hypot(x1 - x0, y1 - y0) * 1.03 })
    }
    return out
  }, [room.shape])
  const [hx, hy] = [room.shape.width / 2, room.shape.length / 2]
  const fog = lit ? '#1a1a1c' : '#010102'
  return (
    <>
      <color attach="background" args={[fog]} />
      <fogExp2 attach="fog" args={[fog, lit ? 0.25 : 7]} />
      <ambientLight intensity={lit ? 0.5 : 0.0} />
      <pointLight position={[0, 1.6, 0]} intensity={lit ? 2.2 : 0} distance={5} decay={1.6} />
      <NearGlow pose={pose} lit={lit} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[Math.max(hx, hy) * 2.2, Math.max(hx, hy) * 2.2]} />
        <meshStandardMaterial map={tex} color={FLOOR_COLORS[room.floorColor] ?? '#444'} roughness={1} />
      </mesh>
      {segments.map((s, i) => (
        <mesh key={i} position={[s.x, wallH / 2, -s.y]} rotation={[0, s.angle, 0]}>
          <boxGeometry args={[s.length, wallH, 0.02]} />
          <meshStandardMaterial color={WALL_COLORS[room.wallColor] ?? '#888'} roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {room.landmarks.map((l) => {
        const p = cardMoved.get(l.id) ?? l
        const a = Math.atan2(p.y, p.x)
        // Flush on the wall, facing the center: a plane turned to face −radial.
        const inset = 0.015
        return (
          <mesh key={l.id} position={[p.x - inset * Math.cos(a), 0.27, -(p.y - inset * Math.sin(a))]} rotation={[0, a + Math.PI / 2, 0]}>
            <planeGeometry args={[0.3, 0.36]} />
            <meshStandardMaterial color={l.color} roughness={0.8} side={THREE.DoubleSide} emissive={l.color} emissiveIntensity={lit ? 0.15 : 0} />
          </mesh>
        )
      })}
    </>
  )
}
