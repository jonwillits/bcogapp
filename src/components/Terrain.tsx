import { useMemo, useRef } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'

const SIZE = 48 // extent of the surrounding plateau
/**
 * Height of the cliff around the arena; also where rim sources sit.
 *
 * Kept deliberately low. Because sources are sensed in 3D with a 1/(1+d²)
 * falloff, every unit of height costs signal fast: at 3 a rim light was barely
 * perceptible (~0.01), at 2 it's roughly twice as strong. Still weak enough
 * that a student has to raise the creature's connection strength to see much —
 * which is the interesting part — but not so weak that nothing happens at all.
 */
export const RIM_HEIGHT = 2

/**
 * The arena as a rectangular pit: a flat floor, **vertical** cliff walls, and a
 * flat plateau on top.
 *
 * Built from three separate surfaces rather than one displaced plane, so the
 * top and bottom edges are true right angles. That matters: a smooth incline
 * implies a slope a creature might drive up, but the sim simply reflects at the
 * boundary — nothing can ever climb. The wall should look as impassable as it
 * actually is.
 *
 * The floor and plateau are pointer targets (so lights can be placed on either,
 * including up on the rim). The walls deliberately are **not** — a light stuck
 * halfway up a cliff face has nowhere sensible to sit.
 */
export function Terrain({
  bounds,
  onAdd,
  onRemoveNearest,
}: {
  bounds: number
  /** `y` is the ground height at the clicked point (0 = floor, RIM_HEIGHT = rim). */
  onAdd: (x: number, y: number, z: number) => void
  onRemoveNearest: (x: number, z: number) => void
}) {
  // A flat frame at rim height with a square hole where the pit is.
  const plateau = useMemo(() => {
    const S = SIZE / 2
    const shape = new THREE.Shape()
    shape.moveTo(-S, -S)
    shape.lineTo(S, -S)
    shape.lineTo(S, S)
    shape.lineTo(-S, S)
    shape.closePath()
    const hole = new THREE.Path() // wound opposite to the outline
    hole.moveTo(-bounds, -bounds)
    hole.lineTo(-bounds, bounds)
    hole.lineTo(bounds, bounds)
    hole.lineTo(bounds, -bounds)
    hole.closePath()
    shape.holes.push(hole)
    const g = new THREE.ShapeGeometry(shape)
    g.rotateX(-Math.PI / 2) // XY shape → XZ ground plane, facing +Y
    return g
  }, [bounds])

  const down = useRef<{ x: number; y: number; button: number } | null>(null)
  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    down.current = {
      x: e.nativeEvent.clientX,
      y: e.nativeEvent.clientY,
      button: e.nativeEvent.button,
    }
  }
  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    const d = down.current
    down.current = null
    if (!d) return
    const moved = Math.hypot(
      e.nativeEvent.clientX - d.x,
      e.nativeEvent.clientY - d.y,
    )
    if (moved >= 5) return // a camera drag, not a click
    if (d.button === 2) onRemoveNearest(e.point.x, e.point.z)
    // e.point.y is the surface we hit: 0 on the floor, RIM_HEIGHT on the rim.
    else if (d.button === 0) onAdd(e.point.x, e.point.y, e.point.z)
  }
  const handlers = { onPointerDown, onPointerUp }

  // Each wall faces inward, toward the arena.
  const walls: { pos: [number, number, number]; rot: [number, number, number] }[] =
    [
      { pos: [0, RIM_HEIGHT / 2, bounds], rot: [0, Math.PI, 0] },
      { pos: [0, RIM_HEIGHT / 2, -bounds], rot: [0, 0, 0] },
      { pos: [bounds, RIM_HEIGHT / 2, 0], rot: [0, -Math.PI / 2, 0] },
      { pos: [-bounds, RIM_HEIGHT / 2, 0], rot: [0, Math.PI / 2, 0] },
    ]

  return (
    <group>
      {/* pit floor — the only ground the creatures can actually occupy */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} {...handlers}>
        <planeGeometry args={[bounds * 2, bounds * 2]} />
        <meshStandardMaterial color="#0b111c" roughness={1} />
      </mesh>

      {/* vertical cliff walls (not clickable) */}
      {walls.map((w, i) => (
        <mesh key={i} position={w.pos} rotation={w.rot} raycast={() => null}>
          <planeGeometry args={[bounds * 2, RIM_HEIGHT]} />
          <meshStandardMaterial
            color="#2a3a5f"
            roughness={1}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* plateau on top of the cliff */}
      <mesh geometry={plateau} position={[0, RIM_HEIGHT, 0]} {...handlers}>
        <meshStandardMaterial
          color="#55689c"
          roughness={1}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}
