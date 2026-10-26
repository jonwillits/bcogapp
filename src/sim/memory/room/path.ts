import * as THREE from 'three'
import { LOOK_AT_HEIGHT, ROOM } from './layout'

/**
 * The fixed camera path (spec §7.1): a slow pan around the room over 30
 * seconds, the same for every student, with no student control. The camera
 * moves at eye height along a closed loop inside the room, looking across
 * the room past its middle, so that every side is swept in turn. Every
 * present item is in view for at least 4 of the 30 seconds, by the frustum
 * test in `path.test.ts`.
 */

export const PATH_SECONDS = 30
export const EYE_HEIGHT = 1.5
export const PATH_FOV = 60

/** The loop's keyframes, in order; the path is a closed Catmull-Rom curve through them. */
const KEYFRAMES: [number, number, number][] = [
  [0.2, EYE_HEIGHT, 1.1],
  [1.1, EYE_HEIGHT, 0.4],
  [1.0, EYE_HEIGHT, -0.6],
  [0.1, EYE_HEIGHT, -0.9],
  [-0.8, EYE_HEIGHT, -0.5],
  [-0.9, EYE_HEIGHT, 0.5],
  [-0.4, EYE_HEIGHT, 1.1],
]

const curve = new THREE.CatmullRomCurve3(
  KEYFRAMES.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
  true,
  'centripetal',
)

/** Where the camera is at time t of the loop (0 to PATH_SECONDS), at constant speed along the curve. */
export function cameraAt(t: number): THREE.Vector3 {
  const u = ((t % PATH_SECONDS) + PATH_SECONDS) % PATH_SECONDS / PATH_SECONDS
  return curve.getPointAt(u)
}

/** Where the camera looks at time t: across the room's middle to the far side, at a lower height, so the view sweeps the walls and the floor beyond. */
export function lookAt(t: number): THREE.Vector3 {
  const p = cameraAt(t)
  // Look through the middle, 1.8 times as far on the other side, at a lower height.
  const dir = new THREE.Vector3(-p.x, 0, -p.z)
  const target = new THREE.Vector3(p.x, LOOK_AT_HEIGHT, p.z).add(dir.multiplyScalar(1.8))
  target.x = THREE.MathUtils.clamp(target.x, -ROOM.width / 2 + 0.3, ROOM.width / 2 - 0.3)
  target.z = THREE.MathUtils.clamp(target.z, -ROOM.depth / 2 + 0.3, ROOM.depth / 2 - 0.3)
  return target
}

/** A camera posed as the path poses it at time t, for the frustum test and the scene. */
export function poseCamera(camera: THREE.PerspectiveCamera, t: number): void {
  camera.position.copy(cameraAt(t))
  camera.up.set(0, 1, 0)
  camera.lookAt(lookAt(t))
  camera.updateMatrixWorld(true)
  camera.updateProjectionMatrix()
}

/**
 * Seconds a sphere is in view over the whole path, sampled every `step`
 * seconds, at the given fov and aspect; and seconds it is within `near`
 * meters of the camera.
 */
export function secondsInView(center: [number, number, number], radius: number, fov = PATH_FOV, aspect = 16 / 9, step = 0.1, near = 4): { inView: number; near: number } {
  const camera = new THREE.PerspectiveCamera(fov, aspect, 0.05, 50)
  const frustum = new THREE.Frustum()
  const m = new THREE.Matrix4()
  const sphere = new THREE.Sphere(new THREE.Vector3(...center), radius)
  let inView = 0
  let nearS = 0
  for (let t = 0; t < PATH_SECONDS - 1e-9; t += step) {
    poseCamera(camera, t)
    m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    frustum.setFromProjectionMatrix(m)
    // In view means the whole sphere is inside, not merely touching: the frustum's planes must all contain the sphere.
    if (frustum.planes.every((pl) => pl.distanceToPoint(sphere.center) >= radius * 0.5)) {
      inView += step
      if (camera.position.distanceTo(sphere.center) <= near) nearS += step
    }
  }
  return { inView, near: nearS }
}
