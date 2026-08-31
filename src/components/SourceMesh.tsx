import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Source } from '../sim/world/source'

/** How far the orb floats above whatever ground it was placed on. */
export const ORB_HOVER = 0.7

/**
 * A stimulus "light": an emissive sphere with a soft point light. Purely visual
 * — it carries no pointer handlers so add/remove clicks pass through to the
 * terrain (see Terrain.tsx). Gently bobs so it reads as active.
 *
 * It used to cast a ring on the ground beneath it. That was dropped: it read as
 * a reflection, which implied a hard surface the arena does not have, and it
 * cluttered the floor once several patches were drifting across it.
 *
 * `source.y` is the orb's own height, so a light placed on the rim renders up
 * there rather than buried in the cliff. The ground ring is offset back down by
 * ORB_HOVER so it lands on the surface the light is sitting on.
 */
export function SourceMesh({ source }: { source: Source }) {
  const orb = useRef<THREE.Mesh>(null)
  const r = 0.18 + 0.12 * source.strength

  useFrame((state) => {
    if (orb.current) {
      orb.current.position.y =
        Math.sin(state.clock.elapsedTime * 2 + source.id) * 0.06
    }
  })

  return (
    <group position={[source.x, source.y, source.z]}>
      <mesh ref={orb} raycast={() => null}>
        <sphereGeometry args={[r, 24, 24]} />
        <meshStandardMaterial
          color="#ffe1a3"
          emissive="#ffb84d"
          emissiveIntensity={1.5}
        />
      </mesh>
      <pointLight
        color="#ffd9a0"
        intensity={source.strength * 5}
        distance={14}
        decay={2}
      />
    </group>
  )
}
