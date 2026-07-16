import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

export interface CameraRigProps {
  /** Point the camera orbits around, applied on mount. */
  target?: [number, number, number]
  minDistance?: number
  maxDistance?: number
  /** Prevent the camera from dropping below the ground plane. */
  maxPolarAngle?: number
  enablePan?: boolean
  /** WASD to pan, arrow keys to rotate. */
  keyboard?: boolean
  /** Pan speed in world units per second. */
  panSpeed?: number
  /** Rotate speed in radians per second. */
  rotateSpeed?: number
  /** Keep the orbit target within ±this, so you can't wander off and get lost. */
  panLimit?: number
}

const PAN_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD'] as const
const ROTATE_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const
const HANDLED = new Set<string>([...PAN_KEYS, ...ROTATE_KEYS])

/** Don't steal keys from a focused control (e.g. arrow keys on a slider). */
function isInteractive(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || !el.tagName) return false
  return (
    ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(el.tagName) ||
    el.isContentEditable
  )
}

/**
 * Standard game-style camera keys, driving the same orbit rig the mouse uses:
 * **WASD** pans across the ground and **arrow keys** rotate (yaw + pitch) — the
 * familiar strategy-game scheme, which suits looking into an arena far better
 * than a free-fly camera would.
 *
 * Reads the controls from r3f state (populated by `makeDefault`) rather than
 * taking a ref, so it composes with whatever else is in the scene.
 */
function KeyboardCameraControls({
  panSpeed,
  rotateSpeed,
  panLimit,
}: {
  panSpeed: number
  rotateSpeed: number
  panLimit: number
}) {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const camera = useThree((s) => s.camera)
  const held = useRef(new Set<string>())

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (isInteractive(e.target) || !HANDLED.has(e.code)) return
      held.current.add(e.code)
      e.preventDefault() // arrows would otherwise scroll the page
    }
    const onUp = (e: KeyboardEvent) => held.current.delete(e.code)
    // Losing focus mid-keypress would otherwise leave the key stuck down.
    const clear = () => held.current.clear()
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', clear)
    }
  }, [])

  // Scratch vectors, reused so the loop doesn't allocate every frame.
  const offset = useRef(new THREE.Vector3()).current
  const spherical = useRef(new THREE.Spherical()).current
  const forward = useRef(new THREE.Vector3()).current
  const right = useRef(new THREE.Vector3()).current
  const move = useRef(new THREE.Vector3()).current

  useFrame((_, delta) => {
    const c = controls
    if (!c || held.current.size === 0) return
    const dt = Math.min(delta, 0.05)
    const keys = held.current
    let changed = false

    // Rotate: arrows orbit around the target.
    let dTheta = 0
    let dPhi = 0
    if (keys.has('ArrowLeft')) dTheta += rotateSpeed * dt
    if (keys.has('ArrowRight')) dTheta -= rotateSpeed * dt
    if (keys.has('ArrowUp')) dPhi -= rotateSpeed * dt // rise toward top-down
    if (keys.has('ArrowDown')) dPhi += rotateSpeed * dt // drop toward the horizon
    if (dTheta !== 0 || dPhi !== 0) {
      offset.copy(camera.position).sub(c.target)
      spherical.setFromVector3(offset)
      spherical.theta += dTheta
      spherical.phi = THREE.MathUtils.clamp(
        spherical.phi + dPhi,
        c.minPolarAngle + 0.01,
        c.maxPolarAngle - 0.01,
      )
      offset.setFromSpherical(spherical)
      camera.position.copy(c.target).add(offset)
      changed = true
    }

    // Pan: WASD slides camera + target together across the ground plane.
    camera.getWorldDirection(forward)
    forward.y = 0
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1) // looking straight down
    forward.normalize()
    right.crossVectors(forward, camera.up).normalize()
    move.set(0, 0, 0)
    if (keys.has('KeyW')) move.add(forward)
    if (keys.has('KeyS')) move.sub(forward)
    if (keys.has('KeyD')) move.add(right)
    if (keys.has('KeyA')) move.sub(right)
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(panSpeed * dt)
      // Clamp the target so you can't pan off into empty space.
      const tx = THREE.MathUtils.clamp(c.target.x + move.x, -panLimit, panLimit)
      const tz = THREE.MathUtils.clamp(c.target.z + move.z, -panLimit, panLimit)
      move.x = tx - c.target.x
      move.z = tz - c.target.z
      c.target.add(move)
      camera.position.add(move)
      changed = true
    }

    if (changed) c.update()
  })

  return null
}

/**
 * Shared camera controller: an orbit rig (drei OrbitControls) plus optional
 * game-style keys (WASD pan, arrows rotate). Fly / first-person modes can be
 * added here later behind a `mode` prop without scenes needing to change.
 * Forward the ref to call `.reset()` for a "reset view" button.
 */
export const CameraRig = forwardRef<OrbitControlsImpl, CameraRigProps>(
  function CameraRig(
    {
      target = [0, 0, 0],
      minDistance = 4,
      maxDistance = 40,
      maxPolarAngle = Math.PI / 2.05,
      enablePan = true,
      keyboard = true,
      panSpeed = 9,
      rotateSpeed = 1.2,
      panLimit = 16,
    },
    ref,
  ) {
    const inner = useRef<OrbitControlsImpl>(null)
    useImperativeHandle(ref, () => inner.current as OrbitControlsImpl, [])

    // Apply the target imperatively, keyed on the numbers rather than the array.
    // Passing `target` as a prop would re-apply a freshly-allocated array on
    // every render, snapping the orbit centre back and undoing any panning.
    const [tx, ty, tz] = target
    useEffect(() => {
      const c = inner.current
      if (!c) return
      c.target.set(tx, ty, tz)
      c.update()
    }, [tx, ty, tz])

    return (
      <>
        <OrbitControls
          ref={inner}
          makeDefault
          minDistance={minDistance}
          maxDistance={maxDistance}
          maxPolarAngle={maxPolarAngle}
          enablePan={enablePan}
          enableDamping
          dampingFactor={0.1}
        />
        {keyboard && (
          <KeyboardCameraControls
            panSpeed={panSpeed}
            rotateSpeed={rotateSpeed}
            panLimit={panLimit}
          />
        )}
      </>
    )
  },
)
