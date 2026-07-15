import { forwardRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

export interface CameraRigProps {
  /** Point the camera orbits around. */
  target?: [number, number, number]
  minDistance?: number
  maxDistance?: number
  /** Prevent the camera from dropping below the ground plane. */
  maxPolarAngle?: number
  enablePan?: boolean
}

/**
 * Shared camera controller. For now a sensible orbit rig (drei OrbitControls);
 * fly / first-person modes can be added here later behind a `mode` prop without
 * scenes needing to change. Forward the ref to call `.reset()` for a "reset
 * view" button.
 */
export const CameraRig = forwardRef<OrbitControlsImpl, CameraRigProps>(
  function CameraRig(
    {
      target = [0, 0, 0],
      minDistance = 4,
      maxDistance = 40,
      maxPolarAngle = Math.PI / 2.05,
      enablePan = true,
    },
    ref,
  ) {
    return (
      <OrbitControls
        ref={ref}
        makeDefault
        target={target}
        minDistance={minDistance}
        maxDistance={maxDistance}
        maxPolarAngle={maxPolarAngle}
        enablePan={enablePan}
        enableDamping
        dampingFactor={0.1}
      />
    )
  },
)
