import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Worm } from '../../sim/bilaterian/worm'
import type { DishWorld } from '../../sim/bilaterian/dishWorld'
import { SEGMENTS } from '../../sim/bilaterian/worm'
import type { CueSource } from '../../sim/bilaterian/fields'
import type { ChannelSpec } from '../../sim/bilaterian/scenarios'

/**
 * The animal: a body of segments, drawn as a chain of beads that shrink
 * toward the tail, driven imperatively from the sim each frame. The wave
 * along the body is real — the head sweeps as it moves and the segments
 * follow — so nothing here animates anything the sim is not doing.
 *
 * The head carries one bead per sensory cell, lit by that cell's output.
 * The body tints while the reverse group is winning, so a reversal reads
 * from across the room.
 */
export function WormMesh({ worm, colors }: { worm: Worm; colors: string[] }) {
  const beads = useRef<(THREE.Mesh | null)[]>([])
  const body = useRef<THREE.MeshStandardMaterial>(null)
  const cells = useRef<(THREE.MeshStandardMaterial | null)[]>([])
  const forward = useMemo(() => new THREE.Color('#e9d8b4'), [])
  const reverse = useMemo(() => new THREE.Color('#f0a94b'), [])
  const turning = useMemo(() => new THREE.Color('#f7e07a'), [])

  useFrame(() => {
    worm.chain.forEach((p, i) => {
      const m = beads.current[i]
      if (m) m.position.set(p.x, 0.08, p.z)
    })
    if (body.current) {
      body.current.color.copy(worm.mode === 'reverse' ? reverse : worm.mode === 'turning' ? turning : forward)
    }
    const h = worm.chain[0]
    const n = worm.chain[1]
    const ang = Math.atan2(h.z - n.z, h.x - n.x)
    worm.cells.forEach((c, i) => {
      const mat = cells.current[i]
      if (!mat) return
      mat.emissiveIntensity = 0.2 + 2.2 * c.output
      const mesh = mat.userData.mesh as THREE.Mesh | undefined
      if (mesh) {
        // Spread the sensory beads across the tip of the head.
        const side = (i - (worm.cells.length - 1) / 2) * 0.09
        mesh.position.set(
          h.x + Math.cos(ang) * 0.1 - Math.sin(ang) * side,
          0.14,
          h.z + Math.sin(ang) * 0.1 + Math.cos(ang) * side,
        )
      }
    })
  })

  return (
    <group>
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <mesh key={i} ref={(el) => (beads.current[i] = el)} raycast={() => null}>
          <sphereGeometry args={[0.13 - (0.08 * i) / SEGMENTS, 12, 12]} />
          {i === 0 ? (
            <meshStandardMaterial ref={body} color="#e9d8b4" roughness={0.6} />
          ) : (
            <meshStandardMaterial color="#d9c8a4" roughness={0.7} />
          )}
        </mesh>
      ))}
      {worm.cells.map((c, i) => (
        <mesh
          key={`cell-${c.channel}`}
          raycast={() => null}
          ref={(el) => {
            if (el && cells.current[i]) cells.current[i]!.userData.mesh = el
          }}
        >
          <sphereGeometry args={[0.06, 10, 10]} />
          <meshStandardMaterial
            ref={(el) => {
              cells.current[i] = el
            }}
            color={colors[i]}
            emissive={colors[i]}
            emissiveIntensity={0.3}
          />
        </mesh>
      ))}
    </group>
  )
}

/**
 * One cue source: a glow on the floor that falls off the way the field does,
 * in the channel's colour, plus a small bright bead at its centre so the
 * source itself can be found. Fields add where they overlap, and so do
 * these. Kept bright on purpose: the dark theme has swallowed drawn
 * geometry twice before, and a field a student cannot see is a field that
 * is not there.
 */
/** A plume fades out over its last seconds, so dissipating never looks like being eaten. */
const PLUME_FADE_S = 5

export function CueFieldMesh({
  source,
  channel,
  scale,
  now,
}: {
  source: CueSource
  channel: ChannelSpec
  /** The concentration control, applied to this source. */
  scale: number
  now: number
}) {
  const texture = useMemo(() => {
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    const c = new THREE.Color(channel.color)
    const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`
    // Alpha follows 1/(1+q²) across the disc, which is the field's own shape.
    for (let i = 0; i <= 10; i++) {
      const t = i / 10
      const q = t * 3
      // Fade to nothing at the rim of the disc, or the square plane shows.
      const a = (0.85 / (1 + q * q)) * (1 - t * t)
      g.addColorStop(t, `rgba(${rgb},${a.toFixed(3)})`)
    }
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [channel.color])

  // The disc reaches out to three scale lengths, where the field is a tenth
  // of its centre value; stronger sources look bigger because they are.
  const radius = source.scale * 3 * Math.sqrt(Math.max(0.3, (source.strength * scale) / 4))
  const left = source.lifetime === null ? Infinity : source.lifetime - (now - source.born)
  const fade = Math.max(0.05, Math.min(1, left / PLUME_FADE_S))
  return (
    <group position={[source.x, 0.01, source.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <planeGeometry args={[radius * 2, radius * 2]} />
        <meshBasicMaterial map={texture} transparent opacity={fade} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh position={[0, 0.1, 0]} raycast={() => null}>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshStandardMaterial color={channel.color} emissive={channel.color} emissiveIntensity={1.2 * fade} />
      </mesh>
    </group>
  )
}

/**
 * A meal, marked: a ring that opens out from where the animal ate and fades
 * over a second and a half. A plume that dissipates fades slowly instead,
 * so the two never look alike.
 */
const MEAL_RING_S = 1.5

export function MealMarks({ world }: { world: DishWorld }) {
  const rings = useRef<(THREE.Mesh | null)[]>([])
  useFrame(() => {
    const recent = world.meals.slice(-4)
    rings.current.forEach((mesh, i) => {
      if (!mesh) return
      const meal = recent[i]
      const age = meal ? world.time - meal.t : Infinity
      if (age > MEAL_RING_S) {
        mesh.visible = false
        return
      }
      mesh.visible = true
      const k = age / MEAL_RING_S
      mesh.position.set(meal!.x, 0.03, meal!.z)
      const r = 0.3 + 1.6 * k
      mesh.scale.set(r, r, 1)
      ;(mesh.material as THREE.MeshBasicMaterial).opacity = 1 - k
    })
  })
  return (
    <group>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} ref={(el) => (rings.current[i] = el)} rotation={[-Math.PI / 2, 0, 0]} visible={false} raycast={() => null}>
          <ringGeometry args={[0.8, 1, 40]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}
