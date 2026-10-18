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

export function RatMesh({ pose, anim, moving, visible = true, scale = 1 }: { pose: () => Pose; anim: Rng; moving: () => boolean; visible?: boolean; scale?: number }) {
  const group = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const whiskL = useRef<THREE.Group>(null)
  const whiskR = useRef<THREE.Group>(null)
  const state = useRef({ clock: 0, yaw: 0, yawTarget: 0, rear: 0, rearing: 0, nextEvent: 2 })
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
    // A rear: pitch the whole body up about the hind feet.
    g.rotation.z = -0.9 * st.rear
    g.position.y = 0.05 * st.rear
    const whisk = Math.sin(st.clock * 11) * (moving() ? 0.25 : 0.18)
    if (whiskL.current) whiskL.current.rotation.y = 0.35 + whisk
    if (whiskR.current) whiskR.current.rotation.y = -0.35 - whisk
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
        <group ref={whiskL} position={[0.045, -0.002, 0.012]}>
          {[-0.2, 0, 0.2].map((a) => (
            <mesh key={a} rotation={[a, 0.4, 0]} position={[0.02, 0, 0.02]}>
              <boxGeometry args={[0.05, 0.0012, 0.0012]} />
              <meshStandardMaterial color="#e8e2d6" />
            </mesh>
          ))}
        </group>
        <group ref={whiskR} position={[0.045, -0.002, -0.012]}>
          {[-0.2, 0, 0.2].map((a) => (
            <mesh key={a} rotation={[a, -0.4, 0]} position={[0.02, 0, -0.02]}>
              <boxGeometry args={[0.05, 0.0012, 0.0012]} />
              <meshStandardMaterial color="#e8e2d6" />
            </mesh>
          ))}
        </group>
      </group>
      {/* feet */}
      {[
        [0.03, 0.02],
        [0.03, -0.02],
        [-0.06, 0.024],
        [-0.06, -0.024],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.006, z]}>
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
