import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { Pose } from '../../sim/rodent/body'

/**
 * A camera that moves *with* an animal, in two views (spec §4). This is the
 * new controller the spec asks for beside `CameraRig`, which orbits a scene
 * from outside and stays unchanged for every earlier scene and for Part 2.
 *
 * **Eye view**: first person, at the animal's eye height, facing where its
 * head faces. **Follow view**: a camera behind the animal and a little
 * above it, turning with it, low enough that it shows no more of the world
 * than the eye view does. Both get the same fog and the same light.
 *
 * The toggle never changes what the sim does: this component only reads
 * the pose. No head bob; the follow camera eases toward its place so a
 * turn does not snap. The view is a prop and the sim is never told it.
 */

export type View = 'eye' | 'follow'

/** The world's (x, y) plane maps to three.js (x, −z), with y up. */
export const toThree = (x: number, y: number, up = 0): [number, number, number] => [x, up, -y]

export interface CameraScale {
  /** Eye height above the ground, meters. */
  eye: number
  /** The follow camera: behind by, above by, and looking at a point ahead of the head by. */
  behind: number
  above: number
  ahead: number
}

export const BOX_SCALE: CameraScale = { eye: 0.045, behind: 0.32, above: 0.16, ahead: 0.08 }
export const RANGE_SCALE: CameraScale = { eye: 0.07, behind: 0.9, above: 0.42, ahead: 0.3 }

export function AnimalCamera({ pose, view, fov, scale, confine }: { pose: () => Pose; view: View; fov: number; scale: CameraScale; confine?: (x: number, y: number) => [number, number] }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const target = useRef(new THREE.Vector3()).current
  const want = useRef(new THREE.Vector3()).current
  const first = useRef(true)

  useEffect(() => {
    camera.fov = fov
    camera.near = 0.01
    camera.updateProjectionMatrix()
  }, [camera, fov])

  useEffect(() => {
    first.current = true
  }, [view])

  useFrame((_, delta) => {
    const p = pose()
    const c = Math.cos(p.heading)
    const s = Math.sin(p.heading)
    if (view === 'eye') {
      camera.position.set(p.x, scale.eye, -p.y)
      target.set(p.x + c, scale.eye, -(p.y + s))
      camera.lookAt(target)
      camera.up.set(0, 1, 0)
      return
    }
    let bx = p.x - scale.behind * c
    let by = p.y - scale.behind * s
    if (confine) [bx, by] = confine(bx, by)
    want.set(bx, scale.above, -by)
    if (first.current) {
      camera.position.copy(want)
      first.current = false
    } else {
      // Ease toward the wanted place: constant fraction per frame at 60 Hz, scaled to the frame.
      const k = 1 - Math.pow(0.001, Math.min(delta, 0.05))
      camera.position.lerp(want, k)
    }
    target.set(p.x + scale.ahead * c, scale.eye, -(p.y + scale.ahead * s))
    camera.lookAt(target)
    camera.up.set(0, 1, 0)
  })
  return null
}

/** The field of view in degrees for the comfort setting. */
export const FOV_NORMAL = 75
export const FOV_NARROW = 55
