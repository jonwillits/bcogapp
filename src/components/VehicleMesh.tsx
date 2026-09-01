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
   * Colour of the neutral trait, worn as a bead on the creature's tail — fixed
   * to the body, so it turns with it. Deliberately *not* part of the floating
   * energy readout above: the two say completely different things, and putting
   * them in one widget invited reading the bead as part of the bar.
   *
   * Omitted by Module 1, which has no such gene.
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
    // Selection is a left-click. A right-click over a vehicle is meant for the
    // ground behind it, so it must not also select.
    if (e.nativeEvent.button !== 0) return
    e.stopPropagation()
    onSelect(vehicle.id)
  }

  return (
    <group
      ref={group}
      onClick={handleClick}
      /**
       * Swallow the press only for the *left* button, so selecting a vehicle
       * never also places a light behind it — but a right-click still reaches
       * the ground.
       *
       * This used to stop every button, which made removing a light impossible
       * wherever a creature stood. `Terrain` records the button on pointer-down
       * and acts on pointer-up, so a swallowed press left it with nothing
       * recorded and the release did nothing at all. The failure was invisible
       * rather than noisy, and it bit hardest in the one place it mattered: once
       * a population swarms the light it is trying to reach, the creatures cover
       * it, and the light a student most wants to remove is the one they cannot.
       * Right-click removing a light is what Q14 rests on.
       */
      onPointerDown={(e) => {
        if (e.nativeEvent.button === 0) e.stopPropagation()
      }}
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
      {/* The neutral mark: a bead on the tail, turning with the body. */}
      {mark && (
        <mesh position={[-0.3, 0.12, 0]} raycast={() => null}>
          <sphereGeometry args={[0.1, 14, 14]} />
          <meshStandardMaterial color={mark} emissive={mark} emissiveIntensity={0.45} />
        </mesh>
      )}
      {/* Energy, floating above and kept world-aligned so it reads the same
          however the creature is pointing. */}
      {energy !== undefined && (
        <group ref={overlay} position={[0, 0.52, 0]}>
          <mesh raycast={() => null}>
            <boxGeometry args={[0.62, 0.03, 0.1]} />
            <meshBasicMaterial color="#0b111c" />
          </mesh>
          <mesh ref={bar} position={[0, 0.001, 0]} raycast={() => null}>
            <boxGeometry args={[0.6, 0.05, 0.12]} />
            <meshBasicMaterial color={palette.approach} />
          </mesh>
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
