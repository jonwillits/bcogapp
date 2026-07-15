import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Source } from '../../sim/world/source'

/**
 * A stimulus "light": an emissive sphere with a soft point light and a ground
 * glow. Purely visual — it carries no pointer handlers so add/remove clicks
 * pass through to the ground plane (see VehiclesScene's Floor). Gently bobs so
 * it reads as active.
 */
export function SourceMesh({ source }: { source: Source }) {
  const orb = useRef<THREE.Mesh>(null)
  const r = 0.18 + 0.12 * source.strength

  useFrame((state) => {
    if (orb.current) {
      orb.current.position.y =
        0.7 + Math.sin(state.clock.elapsedTime * 2 + source.id) * 0.06
    }
  })

  return (
    <group position={[source.x, 0, source.z]}>
      <mesh ref={orb} position={[0, 0.7, 0]} raycast={() => null}>
        <sphereGeometry args={[r, 24, 24]} />
        <meshStandardMaterial
          color="#ffe1a3"
          emissive="#ffb84d"
          emissiveIntensity={1.5}
        />
      </mesh>
      <pointLight
        position={[0, 0.8, 0]}
        color="#ffd9a0"
        intensity={source.strength * 5}
        distance={14}
        decay={2}
      />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
        raycast={() => null}
      >
        <ringGeometry args={[r * 1.4, r * 2, 32]} />
        <meshBasicMaterial color="#ffb84d" transparent opacity={0.3} />
      </mesh>
    </group>
  )
}
