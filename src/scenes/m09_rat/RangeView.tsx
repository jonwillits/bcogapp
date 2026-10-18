import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { makeRng } from '../../sim/random'
import { LANDMARKS, RANGE, type Light, type RangeLandmark } from '../../sim/rodent/range'
import type { Pose } from '../../sim/rodent/body'

/**
 * The range (spec §5.1): a stretch of forest floor at night. Leaf litter
 * with a fine ground texture, so the ground visibly moves past as the
 * animal moves (the only self-motion a screen can give); a nest under a
 * root; near landmarks of different kinds; one tall tree; a stream bank
 * along the west edge. Fog limits draw distance in both light levels: in
 * moonlight the near landmarks show within about 10 m and the tree from
 * anywhere; in the dark nothing but the ground within about 2 m, lit by
 * nothing more than the ground's own dim glow near the animal.
 *
 * Low poly, instanced clutter, and a *Low detail* switch that halves the
 * clutter and the draw distance. All of it is drawing: it draws from a
 * fixed stream of its own and the sim never sees it.
 */

export const NIGHT_SKY = '#06080f'
const MOON_FOG = '#0b1020'
const DARK_FOG = '#030407'

/** A canvas texture of leaf litter: many small dark leaves on a dark ground, repeated finely across the floor. */
function makeLitter(): THREE.CanvasTexture {
  const size = 256
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#2a241a'
  ctx.fillRect(0, 0, size, size)
  const rng = makeRng(99)
  for (let i = 0; i < 900; i++) {
    const x = rng.range(0, size)
    const y = rng.range(0, size)
    const w = rng.range(5, 14)
    const h = rng.range(3, 7)
    const shade = Math.floor(rng.range(0, 60))
    ctx.fillStyle = `rgb(${50 + shade}, ${40 + shade * 0.7}, ${22 + shade * 0.4})`
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rng.range(0, Math.PI))
    ctx.beginPath()
    ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = `rgba(0,0,0,${rng.range(0.1, 0.4)})`
    ctx.fillRect(rng.range(0, size), rng.range(0, size), rng.range(1, 3), rng.range(1, 3))
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(60, 60)
  t.anisotropy = 4
  return t
}

function Ground({ lowDetail }: { lowDetail: boolean }) {
  const tex = useMemo(() => makeLitter(), [])
  useEffect(() => () => tex.dispose(), [tex])
  const side = lowDetail ? 70 : 90
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[side, side]} />
      <meshStandardMaterial map={tex} roughness={1} />
    </mesh>
  )
}

/** Instanced clutter: fallen leaves standing a little proud of the ground, and pebbles. */
function Clutter({ lowDetail }: { lowDetail: boolean }) {
  const leaves = useRef<THREE.InstancedMesh>(null)
  const pebbles = useRef<THREE.InstancedMesh>(null)
  const nLeaves = lowDetail ? 1200 : 2600
  const nPebbles = lowDetail ? 300 : 700
  useEffect(() => {
    const rng = makeRng(7)
    const d = new THREE.Object3D()
    const place = (mesh: THREE.InstancedMesh | null, n: number, scaleOf: () => number, tilt: boolean) => {
      if (!mesh) return
      for (let i = 0; i < n; i++) {
        const r = Math.sqrt(rng.next()) * (RANGE.radius + 4)
        const a = rng.range(0, Math.PI * 2)
        d.position.set(r * Math.cos(a), tilt ? 0.012 : 0.01, r * Math.sin(a))
        d.rotation.set(tilt ? -Math.PI / 2 + rng.range(-0.5, 0.5) : 0, rng.range(0, Math.PI * 2), 0)
        const s = scaleOf()
        d.scale.set(s, s, s)
        d.updateMatrix()
        mesh.setMatrixAt(i, d.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    }
    place(leaves.current, nLeaves, () => rng.range(0.6, 1.4), true)
    place(pebbles.current, nPebbles, () => rng.range(0.5, 1.3), false)
  }, [nLeaves, nPebbles])
  return (
    <>
      <instancedMesh ref={leaves} args={[undefined, undefined, nLeaves]} frustumCulled={false}>
        <planeGeometry args={[0.12, 0.07]} />
        <meshStandardMaterial color="#5a4a2e" side={THREE.DoubleSide} roughness={1} />
      </instancedMesh>
      <instancedMesh ref={pebbles} args={[undefined, undefined, nPebbles]} frustumCulled={false}>
        <icosahedronGeometry args={[0.04, 0]} />
        <meshStandardMaterial color="#4a4a48" roughness={1} />
      </instancedMesh>
    </>
  )
}

function LandmarkMesh({ l, at }: { l: RangeLandmark; at: { x: number; y: number } }) {
  const [x, , z] = [at.x, 0, -at.y]
  if (l.kind === 'tree') {
    return (
      <group position={[x, 0, z]}>
        <mesh position={[0, l.size * 0.35, 0]}>
          <cylinderGeometry args={[0.35, 0.6, l.size * 0.7, 8]} />
          <meshStandardMaterial color="#2a2220" />
        </mesh>
        <mesh position={[0, l.size * 0.85, 0]}>
          <coneGeometry args={[3.2, l.size * 0.6, 8]} />
          <meshStandardMaterial color="#0f1a14" />
        </mesh>
      </group>
    )
  }
  if (l.kind === 'log') {
    return (
      <mesh position={[x, 0.22, z]} rotation={[0, 0.5, Math.PI / 2]}>
        <cylinderGeometry args={[0.22, 0.26, l.size, 9]} />
        <meshStandardMaterial color="#4b3b2a" roughness={1} />
      </mesh>
    )
  }
  if (l.kind === 'stump') {
    return (
      <mesh position={[x, 0.25, z]}>
        <cylinderGeometry args={[0.28, 0.34, 0.5, 9]} />
        <meshStandardMaterial color="#5c4a36" roughness={1} />
      </mesh>
    )
  }
  return (
    <mesh position={[x, l.size * 0.35, z]} rotation={[0.3, 0.7, 0]} scale={[1.2, 0.8, 1]}>
      <dodecahedronGeometry args={[l.size * 0.5, 0]} />
      <meshStandardMaterial color={l.id === 'split rock' ? '#6b6a66' : '#55585e'} roughness={1} />
    </mesh>
  )
}

/** The nest: a root arching over a dark hole. */
function Nest() {
  return (
    <group>
      <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.35, 16]} />
        <meshStandardMaterial color="#060504" />
      </mesh>
      <mesh position={[0, 0.1, 0]} rotation={[0, 0.4, 0]}>
        <torusGeometry args={[0.45, 0.1, 8, 14, Math.PI]} />
        <meshStandardMaterial color="#3d2f22" roughness={1} />
      </mesh>
    </group>
  )
}

/** A beetle: a small glinting shape among the leaves. */
function Beetle({ at, clock }: { at: { x: number; y: number }; clock: () => number }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(() => {
    if (mat.current) mat.current.emissiveIntensity = 0.6 + 0.6 * Math.abs(Math.sin(clock() * 5))
  })
  return (
    <mesh position={[at.x, 0.05, -at.y]} rotation={[0.3, 0.2, 0]}>
      <octahedronGeometry args={[0.07, 0]} />
      <meshStandardMaterial ref={mat} color="#3c4a2a" emissive="#9fd16a" emissiveIntensity={0.8} metalness={0.5} roughness={0.3} />
    </mesh>
  )
}

/** A patch of beetles under a leaf pile, for the closer. */
function LeafPile({ at }: { at: { x: number; y: number } }) {
  return (
    <mesh position={[at.x, 0.12, -at.y]} scale={[1.4, 0.5, 1.2]}>
      <sphereGeometry args={[0.7, 8, 6]} />
      <meshStandardMaterial color="#4a3a22" roughness={1} />
    </mesh>
  )
}

/** The light near the animal in the dark: enough for the ground texture within a couple of meters, nothing more. */
function NearLight({ pose, light }: { pose: () => Pose; light: Light }) {
  const ref = useRef<THREE.PointLight>(null)
  useFrame(() => {
    const p = pose()
    if (ref.current) ref.current.position.set(p.x, 0.6, -p.y)
  })
  return <pointLight ref={ref} intensity={light === 'dark' ? 1.1 : 0.5} distance={light === 'dark' ? 2.6 : 6} decay={2} color="#c8d0ff" />
}

export interface RangeViewProps {
  light: Light
  lowDetail: boolean
  pose: () => Pose
  showNest: boolean
  treeHidden?: boolean
  moved?: Map<string, { x: number; y: number }> | null
  beetle?: { x: number; y: number } | null
  patches?: { x: number; y: number }[]
  clock: () => number
}

export function RangeView({ light, lowDetail, pose, showNest, treeHidden, moved, beetle, patches, clock }: RangeViewProps) {
  // Fog: exp2, set so the near landmarks fade by about 10 m in moonlight and everything but the ground by 2 m in the dark.
  const density = light === 'dark' ? (lowDetail ? 1.0 : 0.9) : lowDetail ? 0.17 : 0.13
  const fogColor = light === 'dark' ? DARK_FOG : MOON_FOG
  return (
    <>
      <color attach="background" args={[fogColor]} />
      <fogExp2 attach="fog" args={[fogColor, density]} />
      <hemisphereLight args={['#2c3a6a', '#0a0806', light === 'dark' ? 0.08 : 0.55]} />
      <directionalLight position={[20, 40, -10]} intensity={light === 'dark' ? 0.02 : 0.45} color="#b9c6ff" />
      <NearLight pose={pose} light={light} />
      <Ground lowDetail={lowDetail} />
      <Clutter lowDetail={lowDetail} />
      {LANDMARKS.map((l) => (treeHidden && l.distant ? null : <LandmarkMesh key={l.id} l={l} at={moved?.get(l.id) ?? l} />))}
      {/* the stream bank along the west edge: a dark strip, and a darker water surface beyond */}
      <mesh position={[RANGE.streamBankX - 3, -0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6, 90]} />
        <meshStandardMaterial color="#0a1a2a" roughness={0.2} metalness={0.3} />
      </mesh>
      <mesh position={[RANGE.streamBankX, 0.08, 0]}>
        <boxGeometry args={[0.6, 0.16, 90]} />
        <meshStandardMaterial color="#2b2418" />
      </mesh>
      {showNest && <Nest />}
      {beetle && <Beetle at={beetle} clock={clock} />}
      {patches?.map((p, i) => <LeafPile key={i} at={p} />)}
    </>
  )
}
