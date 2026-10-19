import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Pose } from '../../sim/rodent/body'
import type { Rng } from '../../sim/random'

/**
 * The rat's body (spec §3.1): a small rodent in the same react-three-fiber
 * style as the worm and the fish. A body, a head that turns a little
 * relative to the body, ears, whiskers, a tail. Idle liveliness — whisking,
 * sniffing pauses, small head turns, an occasional rear onto the hind legs
 * — draws from the animation's own substream, so drawing can never change
 * a run, and none of it reaches the spatial system.
 *
 * About 20 cm long. Hidden in the eye view, where the camera is its eye.
 */

const FUR = '#8a7560'
const BELLY = '#c9b9a2'
const EAR = '#d9a6a0'
const EYE = '#1a1410'
const TAIL = '#c79c90'
/** Where the feet rest, in the body's frame: left fore, right fore, left hind, right hind. */
const FEET: [number, number][] = [
  [0.03, 0.02],
  [0.03, -0.02],
  [-0.06, 0.024],
  [-0.06, -0.024],
]

export function RatMesh({ pose, anim, moving, visible = true, scale = 1 }: { pose: () => Pose; anim: Rng; moving: () => boolean; visible?: boolean; scale?: number }) {
  const group = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const whiskL = useRef<THREE.Group>(null)
  const whiskR = useRef<THREE.Group>(null)
  const feet = useRef<(THREE.Mesh | null)[]>([null, null, null, null])
  const state = useRef({ clock: 0, yaw: 0, yawTarget: 0, rear: 0, rearing: 0, nextEvent: 2, lastX: NaN, lastY: NaN, stride: 0, gait: 0 })
  const tail = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.09, 0.025, 0), new THREE.Vector3(-0.17, 0.05, 0.02), new THREE.Vector3(-0.23, 0.015, 0.05))
    return new THREE.TubeGeometry(curve, 12, 0.006, 6, false)
  }, [])

  useFrame((_, delta) => {
    const g = group.current
    if (!g) return
    const p = pose()
    const st = state.current
    const dt = Math.min(delta, 0.05)
    st.clock += dt
    g.position.set(p.x, 0, -p.y)
    g.rotation.set(0, p.heading, 0)
    // Idle events from the animation's own stream: a new head turn, or a rear.
    st.nextEvent -= dt
    if (st.nextEvent <= 0) {
      st.nextEvent = anim.range(1.2, 3.5)
      const r = anim.next()
      if (!moving() && r < 0.25) st.rearing = 1.4
      else st.yawTarget = anim.range(-0.35, 0.35)
    }
    if (moving()) st.yawTarget *= 0.9
    st.yaw += (st.yawTarget - st.yaw) * Math.min(1, dt * 6)
    if (st.rearing > 0) {
      st.rearing -= dt
      st.rear += (1 - st.rear) * Math.min(1, dt * 5)
    } else st.rear += (0 - st.rear) * Math.min(1, dt * 5)
    if (head.current) head.current.rotation.set(0, st.yaw, 0)
    g.rotation.z = 0
    g.rotation.x = 0
    // A rear: the nose rises and the body pitches up about the hind feet (+z lifts +x, the nose, in this frame).
    g.rotation.z = 0.9 * st.rear
    g.position.y = 0.05 * st.rear
    // Whisking: both fans sweep forward and back together, in bouts that wax and wane, with a small lag between the sides.
    const bout = 0.04 + 0.08 * (0.5 + 0.5 * Math.sin(st.clock * 0.7))
    const amp = bout * (moving() ? 1.3 : 1)
    if (whiskL.current) whiskL.current.rotation.y = amp * Math.sin(st.clock * 44)
    if (whiskR.current) whiskR.current.rotation.y = -amp * Math.sin(st.clock * 44 + 0.4)
    // The feet: a trot, diagonal pairs together, at a stride rate that rises with the speed the pose is changing at.
    const speed = Number.isFinite(st.lastX) && dt > 0 ? Math.hypot(p.x - st.lastX, p.y - st.lastY) / dt : 0
    st.lastX = p.x
    st.lastY = p.y
    const walking = moving() && speed > 0.02
    st.gait += ((walking ? 1 : 0) - st.gait) * Math.min(1, dt * 8)
    if (walking) st.stride += dt * (3 + 3 * Math.min(speed, 1.5)) * Math.PI * 2
    feet.current.forEach((f, i) => {
      if (!f) return
      const phase = st.stride + (i === 1 || i === 2 ? Math.PI : 0)
      f.position.x = FEET[i][0] + 0.014 * Math.cos(phase) * st.gait
      f.position.y = 0.006 + 0.012 * Math.max(0, Math.sin(phase)) * st.gait
    })
  })

  if (!visible) return null
  return (
    <group ref={group} scale={scale}>
      {/* body: a capsule lying along +x, nose forward */}
      <mesh position={[-0.02, 0.035, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[0.032, 0.09, 4, 10]} />
        <meshStandardMaterial color={FUR} roughness={0.95} />
      </mesh>
      <mesh position={[-0.02, 0.018, 0]} rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.026, 0.08, 4, 8]} />
        <meshStandardMaterial color={BELLY} roughness={0.95} />
      </mesh>
      {/* head, turning a little */}
      <group ref={head} position={[0.055, 0.045, 0]}>
        <mesh position={[0.02, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.026, 0.07, 10]} />
          <meshStandardMaterial color={FUR} roughness={0.95} />
        </mesh>
        <mesh position={[0.058, 0, 0]}>
          <sphereGeometry args={[0.006, 8, 8]} />
          <meshStandardMaterial color="#3a2a26" />
        </mesh>
        {[1, -1].map((side) => (
          <group key={side}>
            <mesh position={[0.03, 0.012, side * 0.017]}>
              <sphereGeometry args={[0.004, 8, 8]} />
              <meshStandardMaterial color={EYE} />
            </mesh>
            <mesh position={[-0.005, 0.03, side * 0.02]} rotation={[0, 0, 0]}>
              <circleGeometry args={[0.014, 12]} />
              <meshStandardMaterial color={EAR} side={THREE.DoubleSide} />
            </mesh>
          </group>
        ))}
        {/* whiskers: a fan of four per side, each rod rooted at the snout and spread from forward to sideways, the outer ones drooping */}
        {[1, -1].map((side) => (
          <group key={side} ref={side === 1 ? whiskL : whiskR} position={[0.048, -0.004, side * 0.012]}>
            {[0, 1, 2, 3].map((k) => (
              <group key={k} rotation={[0, side * (0.3 + 0.32 * k), -0.05 - 0.1 * k]}>
                <mesh position={[0.026, 0, 0]}>
                  <boxGeometry args={[0.052 - 0.006 * k, 0.0007, 0.0007]} />
                  <meshStandardMaterial color="#e8e2d6" />
                </mesh>
              </group>
            ))}
          </group>
        ))}
      </group>
      {/* feet: left fore, right fore, left hind, right hind; they step in useFrame while the rat moves */}
      {FEET.map(([x, z], i) => (
        <mesh key={i} ref={(m) => void (feet.current[i] = m)} position={[x, 0.006, z]}>
          <sphereGeometry args={[0.008, 6, 6]} />
          <meshStandardMaterial color={EAR} />
        </mesh>
      ))}
      <mesh geometry={tail}>
        <meshStandardMaterial color={TAIL} roughness={0.9} />
      </mesh>
    </group>
  )
}
