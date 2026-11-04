import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { CELLS, type Grasp } from '../../../sim/social/mirror/cells'
import type { MirrorStore } from './store'

/**
 * The table scene (spec §10.1): a macaque seated at a low table, seen from
 * behind and above its right shoulder, with a side view as the
 * alternative; a raisin-sized piece for a precision grip and a
 * fruit-sized one for a whole-hand grasp; across the table a second
 * macaque with its own pieces. The macaques are stylized from simple
 * shapes (decision 16): a rounded head with no face marks, a body, a short
 * tail, two arms that reach, and two hand shapes, a pinch of two fingers
 * for the precision grip and a closed hand for the whole-hand grasp. No
 * human hand appears. Everything here reads the store and writes nothing.
 */

const TABLE_Y = 0.55

function graspProgress(start: number, now: number): number {
  return Math.max(0, Math.min(1, (now - start) / CELLS.graspSeconds))
}

/** The reach: out over the first 40%, held, back over the last 30%. */
function reach(u: number): number {
  if (u < 0.4) return u / 0.4
  if (u < 0.7) return 1
  return 1 - (u - 0.7) / 0.3
}

function Hand({ grasp, closed, color }: { grasp: Grasp | null; closed: number; color: string }) {
  if (grasp === 'precision')
    return (
      <group>
        <mesh position={[0.025, 0, 0]} rotation={[0, 0, 0.3 * closed]}>
          <capsuleGeometry args={[0.012, 0.05, 4, 8]} />
          <meshStandardMaterial color={color} />
        </mesh>
        <mesh position={[-0.025, 0, 0]} rotation={[0, 0, -0.3 * closed]}>
          <capsuleGeometry args={[0.012, 0.05, 4, 8]} />
          <meshStandardMaterial color={color} />
        </mesh>
      </group>
    )
  return (
    <mesh scale={[1, 1 - 0.35 * closed, 1]}>
      <sphereGeometry args={[0.05, 12, 10]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

function Macaque({ position, facing, color, grasp, progress, pieces }: { position: [number, number, number]; facing: number; color: string; grasp: Grasp | null; progress: number; pieces: { precision: boolean; wholeHand: boolean } }) {
  const r = reach(progress)
  const armX = grasp === 'precision' ? 0.18 : grasp === 'wholeHand' ? -0.18 : 0
  const target: [number, number, number] = grasp === 'precision' ? [0.18, TABLE_Y + 0.03, 0.55] : [-0.18, TABLE_Y + 0.06, 0.55]
  const shoulder: [number, number, number] = [grasp === 'precision' ? 0.22 : -0.22, TABLE_Y + 0.32, 0.1]
  const hand: [number, number, number] = [shoulder[0] + (target[0] - shoulder[0]) * r, shoulder[1] + (target[1] - shoulder[1]) * r, shoulder[2] + (target[2] - shoulder[2]) * r]
  const mid: [number, number, number] = [(shoulder[0] + hand[0]) / 2, (shoulder[1] + hand[1]) / 2, (shoulder[2] + hand[2]) / 2]
  const len = Math.hypot(hand[0] - shoulder[0], hand[1] - shoulder[1], hand[2] - shoulder[2])
  const dir = new THREE.Vector3(hand[0] - shoulder[0], hand[1] - shoulder[1], hand[2] - shoulder[2]).normalize()
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
  const eaten = progress > 0.55
  void armX
  return (
    <group position={position} rotation={[0, facing, 0]}>
      {/* The body, the head, the tail. */}
      <mesh position={[0, TABLE_Y + 0.12, -0.05]}>
        <capsuleGeometry args={[0.2, 0.3, 6, 14]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, TABLE_Y + 0.5, 0.02]}>
        <sphereGeometry args={[0.15, 16, 14]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, TABLE_Y - 0.05, -0.32]} rotation={[0.9, 0, 0]}>
        <capsuleGeometry args={[0.03, 0.22, 4, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* The resting arm. */}
      <mesh position={[grasp === 'precision' ? -0.22 : 0.22, TABLE_Y + 0.18, 0.15]} rotation={[0.6, 0, 0]}>
        <capsuleGeometry args={[0.04, 0.3, 4, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* The reaching arm, with its hand. */}
      {grasp ? (
        <>
          <mesh position={mid} quaternion={q}>
            <capsuleGeometry args={[0.04, Math.max(0.05, len - 0.08), 4, 8]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <group position={hand}>
            <Hand grasp={grasp} closed={progress > 0.35 && progress < 0.75 ? 1 : 0} color={color} />
          </group>
        </>
      ) : (
        <mesh position={[0.22, TABLE_Y + 0.18, 0.15]} rotation={[0.6, 0, 0]}>
          <capsuleGeometry args={[0.04, 0.3, 4, 8]} />
          <meshStandardMaterial color={color} />
        </mesh>
      )}
      {/* The pieces of food in front of this macaque: hidden while being eaten. */}
      {pieces.precision && !(grasp === 'precision' && eaten) && (
        <mesh position={[0.18, TABLE_Y + 0.03, 0.55]}>
          <sphereGeometry args={[0.02, 10, 8]} />
          <meshStandardMaterial color="#5b2a86" />
        </mesh>
      )}
      {pieces.wholeHand && !(grasp === 'wholeHand' && eaten) && (
        <mesh position={[-0.18, TABLE_Y + 0.06, 0.55]}>
          <sphereGeometry args={[0.06, 12, 10]} />
          <meshStandardMaterial color="#e0533d" />
        </mesh>
      )}
    </group>
  )
}

export function MacaqueScene({ store }: { store: MirrorStore }) {
  const group = useRef<THREE.Group>(null)
  const { camera } = useThree()
  const applied = useRef<string>('')
  useFrame(() => {
    const want = store.sideView ? 'side' : 'shoulder'
    if (applied.current !== want) {
      applied.current = want
      if (want === 'side') {
        camera.position.set(2.6, 1.5, 0.1)
        camera.lookAt(0, TABLE_Y + 0.2, 0.1)
      } else {
        camera.position.set(0.55, 1.65, -1.5)
        camera.lookAt(0, TABLE_Y + 0.15, 0.6)
      }
    }
  })
  const you = store.yourGrasp
  const other = store.otherGrasp
  const now = store.time
  return (
    <group ref={group}>
      <color attach="background" args={['#0b1020']} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 4, 1]} intensity={1.1} />
      <mesh position={[0, -0.5, 0]}>
        <boxGeometry args={[6, 0.02, 6]} />
        <meshStandardMaterial color="#1a2233" />
      </mesh>
      {/* The low table. */}
      <mesh position={[0, TABLE_Y, 0.2]}>
        <boxGeometry args={[1.6, 0.06, 1.1]} />
        <meshStandardMaterial color="#6b4a2b" />
      </mesh>
      {[-0.7, 0.7].map((x) =>
        [-0.3, 0.7].map((z) => (
          <mesh key={`${x}${z}`} position={[x, TABLE_Y / 2 - 0.25, z]}>
            <boxGeometry args={[0.06, TABLE_Y + 0.5, 0.06]} />
            <meshStandardMaterial color="#4e351f" />
          </mesh>
        )),
      )}
      {/* You, facing +z; the other macaque across the table, facing −z. */}
      <Macaque position={[0, 0, -0.35]} facing={0} color="#b58b5a" grasp={you?.grasp ?? null} progress={you ? graspProgress(you.start, now) : 0} pieces={{ precision: true, wholeHand: true }} />
      <Macaque position={[0, 0, 0.75]} facing={Math.PI} color="#8f6a44" grasp={other?.grasp ?? null} progress={other ? graspProgress(other.start, now) : 0} pieces={{ precision: true, wholeHand: true }} />
    </group>
  )
}
