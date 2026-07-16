import { useMemo, useRef } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'

const SIZE = 48 // extent of the ground mesh
const SEG = 144 // resolution (enough to keep the ramp smooth)
const RIM_HEIGHT = 3.5 // how far the surrounding ground rises above the floor
const RAMP = 5 // distance over which it rises

/**
 * Ground height: flat (0) inside the arena, rising smoothly to RIM_HEIGHT
 * outside it, so the playable area reads as a shallow valley.
 *
 * Uses Chebyshev distance (max of |x|,|z|) rather than radial distance because
 * the sim's bounds are a *square* — `reflectInBounds` clamps x and z
 * independently. A round bowl would put the visible wall in the wrong place and
 * the bounce would still look arbitrary, which is the whole thing we're fixing.
 */
function rimHeight(x: number, z: number, bounds: number): number {
  const d = Math.max(Math.abs(x), Math.abs(z))
  const t = Math.min(1, Math.max(0, (d - bounds) / RAMP))
  return RIM_HEIGHT * t * t * (3 - 2 * t) // smoothstep
}

/**
 * The valley floor + surrounding rim. Also the pointer target for placing and
 * removing lights (the vehicles and lights let clicks fall through to it).
 */
export function Terrain({
  bounds,
  onAdd,
  onRemoveNearest,
}: {
  bounds: number
  onAdd: (x: number, z: number) => void
  onRemoveNearest: (x: number, z: number) => void
}) {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG)
    g.rotateX(-Math.PI / 2) // into the XZ plane, +Y up
    const pos = g.attributes.position
    // The rim must be markedly lighter than the floor, not just a shade off:
    // in a scene this dark, slope shading alone doesn't carry the shape.
    const floorColor = new THREE.Color('#0b111c')
    const rimColor = new THREE.Color('#55689c')
    const colors = new Float32Array(pos.count * 3)
    const c = new THREE.Color()

    for (let i = 0; i < pos.count; i++) {
      const h = rimHeight(pos.getX(i), pos.getZ(i), bounds)
      pos.setY(i, h)
      // Tint upward with height, so the boundary is legible even head-on where
      // the slope's shading alone would be ambiguous.
      c.copy(floorColor).lerp(rimColor, Math.min(1, h / RIM_HEIGHT))
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    g.computeVertexNormals()
    return g
  }, [bounds])

  const down = useRef<{ x: number; y: number; button: number } | null>(null)

  return (
    <mesh
      geometry={geometry}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        down.current = {
          x: e.nativeEvent.clientX,
          y: e.nativeEvent.clientY,
          button: e.nativeEvent.button,
        }
      }}
      onPointerUp={(e: ThreeEvent<PointerEvent>) => {
        const d = down.current
        down.current = null
        if (!d) return
        const moved = Math.hypot(
          e.nativeEvent.clientX - d.x,
          e.nativeEvent.clientY - d.y,
        )
        if (moved >= 5) return // a camera drag, not a click
        if (d.button === 2) onRemoveNearest(e.point.x, e.point.z)
        else if (d.button === 0) onAdd(e.point.x, e.point.z)
      }}
    >
      <meshStandardMaterial vertexColors roughness={1} />
    </mesh>
  )
}
