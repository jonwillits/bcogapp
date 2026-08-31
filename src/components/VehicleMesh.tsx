import { useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { Vehicle } from '../sim/world/world'
import { palette } from '../theme/theme'

/**
 * Renders one vehicle and drives its transform imperatively from the sim each
 * frame (no React re-render per frame). The two sensor spheres glow with their
 * live activation so you can see what each sensor "feels".
 */
export function VehicleMesh({
  vehicle,
  selected,
  onSelect,
  mark,
  energy,
}: {
  vehicle: Vehicle
  selected: boolean
  onSelect: (id: number) => void
  /**
   * Colour of the neutral trait, worn as a bead above the body. Omitted by
   * Module 1, which has no such gene.
   */
  mark?: string
  /**
   * How full this creature's energy store is, 0–1, drawn as a bar above it.
   *
   * The single most invisible thing in the lab made visible: without it,
   * reproduction and death are events with no legible cause. Omitted by Module
   * 1, where creatures do not eat.
   */
  energy?: number
}) {
  const group = useRef<THREE.Group>(null)
  const leftSensor = useRef<THREE.MeshStandardMaterial>(null)
  const rightSensor = useRef<THREE.MeshStandardMaterial>(null)
  const overlay = useRef<THREE.Group>(null)
  const bar = useRef<THREE.Mesh>(null)

  useFrame(() => {
    const g = group.current
    if (!g) return
    if (overlay.current) {
      // Cancel the body's heading so the bar and bead stay world-aligned and
      // read the same however the creature is pointing.
      overlay.current.rotation.y = vehicle.state.heading
    }
    if (bar.current && energy !== undefined) {
      const fill = Math.max(0.001, Math.min(1, energy))
      bar.current.scale.x = fill
      // Scaling a centred box grows it both ways; shift so it fills from the left.
      bar.current.position.x = -(1 - fill) * 0.3
    }
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
      {/* Energy bar and the neutral mark, both world-aligned. */}
      {(energy !== undefined || mark) && (
        <group ref={overlay} position={[0, 0.52, 0]}>
          {energy !== undefined && (
            <>
              <mesh position={[0, 0, 0]} raycast={() => null}>
                <boxGeometry args={[0.62, 0.03, 0.1]} />
                <meshBasicMaterial color="#0b111c" />
              </mesh>
              <mesh ref={bar} position={[0, 0.001, 0]} raycast={() => null}>
                <boxGeometry args={[0.6, 0.05, 0.12]} />
                <meshBasicMaterial color={palette.approach} />
              </mesh>
            </>
          )}
          {mark && (
            <mesh position={[0, 0.13, 0]} raycast={() => null}>
              <sphereGeometry args={[0.09, 12, 12]} />
              <meshStandardMaterial color={mark} emissive={mark} emissiveIntensity={0.5} />
            </mesh>
          )}
        </group>
      )}
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
