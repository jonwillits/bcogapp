import { useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { Vehicle } from '../../sim/world/world'
import { palette } from '../../theme/theme'

/**
 * Renders one vehicle and drives its transform imperatively from the sim each
 * frame (no React re-render per frame). The two sensor spheres glow with their
 * live activation so you can see what each sensor "feels".
 */
export function VehicleMesh({
  vehicle,
  selected,
  onSelect,
}: {
  vehicle: Vehicle
  selected: boolean
  onSelect: (id: number) => void
}) {
  const group = useRef<THREE.Group>(null)
  const leftSensor = useRef<THREE.MeshStandardMaterial>(null)
  const rightSensor = useRef<THREE.MeshStandardMaterial>(null)

  useFrame(() => {
    const g = group.current
    if (!g) return
    // sim x/z → three x/z; heading (about +Y) maps to rotation.y = -heading
    g.position.set(vehicle.state.x, 0, vehicle.state.z)
    g.rotation.y = -vehicle.state.heading
    if (leftSensor.current) {
      leftSensor.current.emissiveIntensity = Math.min(
        2,
        vehicle.sensors.left * 1.6,
      )
    }
    if (rightSensor.current) {
      rightSensor.current.emissiveIntensity = Math.min(
        2,
        vehicle.sensors.right * 1.6,
      )
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onSelect(vehicle.id)
  }

  return (
    <group
      ref={group}
      onClick={handleClick}
      // Stop the press from reaching the ground plane so selecting a vehicle
      // never also places/removes a light behind it.
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* chassis */}
      <mesh position={[0, 0.12, 0]} castShadow>
        <boxGeometry args={[0.5, 0.16, 0.34]} />
        <meshStandardMaterial color={vehicle.color} roughness={0.5} />
      </mesh>
      {/* nose (points +X = forward) */}
      <mesh position={[0.3, 0.12, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.1, 0.18, 16]} />
        <meshStandardMaterial color={vehicle.color} roughness={0.5} />
      </mesh>
      {/* wheels (left = +Z, right = -Z) */}
      <mesh position={[0, 0.07, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.06, 16]} />
        <meshStandardMaterial color="#0c1220" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.07, -0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.06, 16]} />
        <meshStandardMaterial color="#0c1220" roughness={0.8} />
      </mesh>
      {/* sensors (left = +Z, right = -Z), glow with activation */}
      <mesh position={[0.27, 0.2, 0.13]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial
          ref={leftSensor}
          color={palette.sensor}
          emissive={palette.sensor}
          emissiveIntensity={0}
        />
      </mesh>
      <mesh position={[0.27, 0.2, -0.13]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial
          ref={rightSensor}
          color={palette.sensor}
          emissive={palette.sensor}
          emissiveIntensity={0}
        />
      </mesh>
      {/* selection ring */}
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
          <ringGeometry args={[0.42, 0.52, 40]} />
          <meshBasicMaterial
            color={palette.accent}
            transparent
            opacity={0.9}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  )
}
