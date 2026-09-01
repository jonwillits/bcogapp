import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Source } from '../sim/world/source'

/**
 * Height the *sensed* source sits at above the ground it was placed on.
 *
 * This is a simulation quantity, not a rendering one: sources are sensed in 3D,
 * so a light on the rim is genuinely weaker than the same light on the floor.
 * The ball is drawn resting on the ground regardless — see below.
 */
export const ORB_HOVER = 0.7

/**
 * A food patch: a glowing ball resting on the ground, rolling as it drifts.
 *
 * It used to hover and bob, which read as levitation and undercut the physical
 * feel the rest of the scene works for. Now it sits on the surface and turns as
 * it travels, at the rate a ball of its size actually would — one radian per
 * radius covered. Nothing else about it moved.
 *
 * **The ball is drawn on the ground, but the source is still sensed at
 * `ORB_HOVER` above it.** Those are deliberately different. Tying the sensed
 * height to the drawn ball would make it vary with patch size, which would
 * change what every creature senses and invalidate the saved lineages — a
 * rendering change is not allowed to move the physics. The ground the ball rests
 * on is recovered as `source.y - ORB_HOVER`, so a light up on the rim still
 * renders up there rather than buried in the cliff.
 *
 * Carries no pointer handlers, so add/remove clicks pass through to the terrain.
 */
export function SourceMesh({ source }: { source: Source }) {
  const ball = useRef<THREE.Mesh>(null)
  const previous = useRef<{ x: number; z: number } | null>(null)
  const r = 0.18 + 0.12 * source.strength
  const groundY = source.y - ORB_HOVER

  useFrame(() => {
    const mesh = ball.current
    if (!mesh) return
    const last = previous.current
    previous.current = { x: source.x, z: source.z }
    if (!last) return

    const dx = source.x - last.x
    const dz = source.z - last.z
    const travelled = Math.hypot(dx, dz)
    if (travelled < 1e-6) return

    // Roll about the horizontal axis perpendicular to travel, by one radian per
    // radius covered — which is what rolling without slipping means.
    mesh.rotateOnWorldAxis(
      new THREE.Vector3(dz, 0, -dx).normalize(),
      travelled / r,
    )
  })

  return (
    <group position={[source.x, groundY, source.z]}>
      <mesh ref={ball} position={[0, r, 0]} raycast={() => null}>
        <sphereGeometry args={[r, 24, 24]} />
        <meshStandardMaterial
          color="#ffe1a3"
          emissive="#ffb84d"
          emissiveIntensity={1.5}
          roughness={0.55}
        />
      </mesh>
      <pointLight
        position={[0, r, 0]}
        color="#ffd9a0"
        intensity={source.strength * 5}
        distance={14}
        decay={2}
      />
    </group>
  )
}
